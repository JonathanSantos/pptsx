//! Medição e quebra de texto, portada de `src/text/*` do pptsx: mesma quebra gulosa
//! (palavras por espaço, corte depois de '-'/'/', quebra por caractere quando a palavra não
//! cabe), mesma folga `textSafety` e mesma altura de linha (hhea da face). A largura vem do
//! shaping do rustybuzz (kerning incluso), como o `font.layout` do fontkit.

use std::cell::RefCell;
use std::collections::HashMap;

use std::fmt::Write as _;

use rustybuzz::{Face, UnicodeBuffer};

/// Opções de medição: a folga de quebra (DEFAULTS.textSafety; a config pode trocar) e o modo das
/// quebras de linha no arquivo (`lineBreaks: "auto"`: o arquivo leva os parágrafos do autor e o
/// renderizador quebra). Vêm da config e das flags, por valor, em `Fonts`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TextOptions {
    pub safety: f32,
    pub auto_breaks: bool,
}

impl Default for TextOptions {
    fn default() -> Self {
        TextOptions { safety: 0.97, auto_breaks: false }
    }
}
/// Folga do float32 do layout ao remedir com a largura que o próprio texto devolveu.
const FIT_TOLERANCE: f32 = 0.01;
const ELLIPSIS: &str = "…";

static FACES: [&[u8]; 4] = [
    include_bytes!("../assets/fonts/LiberationSans-Regular.ttf"),
    include_bytes!("../assets/fonts/LiberationSans-Bold.ttf"),
    include_bytes!("../assets/fonts/LiberationSans-Italic.ttf"),
    include_bytes!("../assets/fonts/LiberationSans-BoldItalic.ttf"),
];

/// Famílias que a Liberation Sans mede com métrica idêntica.
const METRIC_COMPATIBLE: &[&str] = &["arial", "helvetica", "helvetica neue", "liberation sans", "sans-serif", "arimo"];

/// Face do autor (`fonts` do pptsx.config.ts): arquivo .ttf/.otf ou face de uma coleção .ttc.
pub struct FontFile {
    pub family: String,
    /// Peso CSS (400 regular, 700 bold, 100–900).
    pub weight: u16,
    pub italic: bool,
    pub path: std::path::PathBuf,
    pub postscript: Option<String>,
}

/// Face registrada numa família.
#[derive(Clone, Copy)]
struct Entry {
    weight: u16,
    italic: bool,
    face: usize,
}

/// Face registrada pelo autor (pptsx.config.ts `fonts`): o que o embed precisa.
pub struct AuthorFace {
    pub family: String,
    pub weight: u16,
    pub italic: bool,
    pub data: &'static [u8],
    /// Índice da face no arquivo (> 0 só em coleções .ttc).
    pub index: u32,
}

pub struct Fonts {
    /// Folga de quebra, quebras automáticas e motor: o ambiente de medição que o layout, o
    /// emissor e o preview recebem junto com as faces.
    pub options: TextOptions,
    faces: Vec<Face<'static>>,
    /// Nome de família da própria face (name ID 1, ex.: "Inter SemiBold").
    face_names: Vec<String>,
    /// Paralelo a `faces`: None para as embutidas, Some para as do autor.
    authors: Vec<Option<AuthorFace>>,
    families: HashMap<String, Vec<Entry>>,
    cache: RefCell<HashMap<(usize, String), f32>>,
}

/// Face escolhida para um trecho: o que o PPTX recebe (text/fontkit.ts runFaceOf).
pub struct FaceMatch {
    pub face: usize,
    /// 400/700 = família do autor + flag negrito; outro peso = nome da própria face, sem negrito.
    pub typeface: Option<String>,
    pub bold: bool,
    /// Peso da face escolhida (o diagnóstico font-weight-fallback compara com o pedido).
    pub weight: u16,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LineHeight {
    Normal,
    Multiple(f32),
}

#[derive(Clone, Copy, Debug)]
pub struct LineBox {
    pub height: f32,
    pub ascent: f32,
}

/// Nome da tabela `name`: Unicode pelo ttf-parser; Mac Roman (fontes antigas do macOS) como ASCII.
pub fn font_name(face: &rustybuzz::ttf_parser::Face, id: u16) -> Option<String> {
    let names: Vec<_> = face.names().into_iter().filter(|n| n.name_id == id).collect();
    names
        .iter()
        .find_map(|n| n.to_string())
        .or_else(|| names.iter().find(|n| n.name.iter().all(u8::is_ascii)).map(|n| String::from_utf8_lossy(n.name).into_owned()))
}

fn postscript_of(face: &rustybuzz::ttf_parser::Face) -> Option<String> {
    font_name(face, rustybuzz::ttf_parser::name_id::POST_SCRIPT_NAME)
}

/// Índice da face num arquivo: numa coleção, a que tem o nome PostScript pedido.
fn face_in(data: &'static [u8], postscript: Option<&str>) -> Option<u32> {
    let count = rustybuzz::ttf_parser::fonts_in_collection(data).unwrap_or(1);
    let Some(wanted) = postscript else { return Some(0) };
    (0..count).find(|&i| rustybuzz::ttf_parser::Face::parse(data, i).ok().and_then(|f| postscript_of(&f)).as_deref() == Some(wanted))
}

const BUILTIN: [(u16, bool); 4] = [(400, false), (700, false), (400, true), (700, true)];

impl Fonts {
    /// Liberation Sans embutida (como Arial e afins) + as faces do autor; devolve os avisos.
    pub fn new(extra: &[FontFile], options: TextOptions) -> (Self, Vec<String>) {
        let mut faces: Vec<Face<'static>> = FACES.iter().map(|data| Face::from_slice(data, 0).expect("fonte embutida inválida")).collect();
        let mut face_names: Vec<String> = faces.iter().map(|f| font_name(f, rustybuzz::ttf_parser::name_id::FAMILY).unwrap_or_default()).collect();
        let builtin: Vec<Entry> = BUILTIN.iter().enumerate().map(|(face, &(weight, italic))| Entry { weight, italic, face }).collect();
        let mut authors: Vec<Option<AuthorFace>> = vec![None, None, None, None];
        let mut families: HashMap<String, Vec<Entry>> = HashMap::new();
        for name in METRIC_COMPATIBLE {
            families.insert((*name).to_string(), builtin.clone());
        }
        let mut warnings = Vec::new();
        let mut replaced: Vec<String> = Vec::new();
        for f in extra {
            let data: &'static [u8] = match std::fs::read(&f.path) {
                Ok(bytes) => Box::leak(bytes.into_boxed_slice()),
                Err(e) => {
                    warnings.push(format!("fonte {} ({}) não pôde ser lida: {e}", f.family, f.path.display()));
                    continue;
                }
            };
            let Some(index) = face_in(data, f.postscript.as_deref()) else {
                warnings.push(format!("fonte {}: {} não tem a face \"{}\"", f.family, f.path.display(), f.postscript.as_deref().unwrap_or("")));
                continue;
            };
            let Some(face) = Face::from_slice(data, index) else {
                warnings.push(format!("fonte {}: {} não é uma fonte válida", f.family, f.path.display()));
                continue;
            };
            face_names.push(font_name(&face, rustybuzz::ttf_parser::name_id::FAMILY).unwrap_or_else(|| f.family.clone()));
            faces.push(face);
            authors.push(Some(AuthorFace { family: f.family.clone(), weight: f.weight, italic: f.italic, data, index }));
            let key = f.family.to_lowercase();
            // A primeira face do autor numa família padrão (Arial…) substitui as embutidas.
            if !replaced.contains(&key) {
                families.insert(key.clone(), Vec::new());
                replaced.push(key.clone());
            }
            let list = families.entry(key).or_default();
            list.retain(|e| !(e.weight == f.weight && e.italic == f.italic));
            list.push(Entry { weight: f.weight, italic: f.italic, face: faces.len() - 1 });
        }
        (Fonts { options, faces, face_names, authors, families, cache: RefCell::new(HashMap::new()) }, warnings)
    }

    pub fn has_family(&self, family: &str) -> bool {
        self.families.contains_key(&family.to_lowercase())
    }

    /// Face mais próxima (mesmo estilo primeiro, depois o peso mais perto). Família desconhecida
    /// mede com a Liberation (o build avisa).
    pub fn matching(&self, family: &str, weight: u16, italic: bool) -> FaceMatch {
        let builtin = || {
            let face = usize::from(weight >= 600) + 2 * usize::from(italic);
            FaceMatch { face, typeface: None, bold: weight >= 600, weight: if weight >= 600 { 700 } else { 400 } }
        };
        let Some(list) = self.families.get(&family.to_lowercase()).filter(|l| !l.is_empty()) else { return builtin() };
        let best = list
            .iter()
            .min_by_key(|e| (u16::from(e.italic != italic), e.weight.abs_diff(weight), u16::from(e.weight < weight)))
            .copied()
            .expect("lista não vazia");
        let canonical = best.weight == 400 || best.weight == 700;
        FaceMatch { face: best.face, typeface: (!canonical).then(|| self.face_names[best.face].clone()), bold: best.weight == 700, weight: best.weight }
    }

    /// Face do autor por índice (None para as Liberation embutidas).
    pub fn author_face(&self, face: usize) -> Option<&AuthorFace> {
        self.authors.get(face).and_then(Option::as_ref)
    }

    /// Nome de família da própria face (name ID 1).
    pub fn face_name(&self, face: usize) -> &str {
        self.face_names.get(face).map_or("", String::as_str)
    }

    pub fn face_for(&self, family: &str, weight: u16, italic: bool) -> usize {
        self.matching(family, weight, italic).face
    }

    fn units(&self, face: usize, text: &str) -> f32 {
        let key = (face, text.to_string());
        if let Some(w) = self.cache.borrow().get(&key) {
            return *w;
        }
        let mut buf = UnicodeBuffer::new();
        // NBSP é medido como espaço (CONTRACTS M8).
        buf.push_str(&text.replace('\u{a0}', " "));
        buf.guess_segment_properties();
        let shaped = rustybuzz::shape(&self.faces[face], &[], buf);
        let units = shaped.glyph_positions().iter().map(|p| p.x_advance as f32).sum::<f32>();
        self.cache.borrow_mut().insert(key, units);
        units
    }

    pub fn width(&self, face: usize, text: &str, size: f32, letter_spacing: f32) -> f32 {
        if text.is_empty() {
            return 0.0;
        }
        let upm = f32::from(self.faces[face].units_per_em() as u16);
        self.units(face, text) * size / upm + letter_spacing * text.chars().count() as f32
    }

    /// Contornos dos glifos do texto como `d` de SVG (pt), com a origem na baseline em (x, y):
    /// o preview desenha com as mesmas fontes e o mesmo shaping da medição.
    pub fn glyph_path(&self, face: usize, text: &str, size: f32, letter_spacing: f32, x: f32, y: f32) -> (String, f32) {
        struct Pen<'a> {
            out: &'a mut String,
            scale: f32,
            ox: f32,
            oy: f32,
        }
        impl rustybuzz::ttf_parser::OutlineBuilder for Pen<'_> {
            fn move_to(&mut self, x: f32, y: f32) {
                let _ = write!(self.out, "M{:.2} {:.2}", self.ox + x * self.scale, self.oy - y * self.scale);
            }
            fn line_to(&mut self, x: f32, y: f32) {
                let _ = write!(self.out, "L{:.2} {:.2}", self.ox + x * self.scale, self.oy - y * self.scale);
            }
            fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
                let s = self.scale;
                let _ = write!(self.out, "Q{:.2} {:.2} {:.2} {:.2}", self.ox + x1 * s, self.oy - y1 * s, self.ox + x * s, self.oy - y * s);
            }
            fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
                let s = self.scale;
                let _ = write!(self.out, "C{:.2} {:.2} {:.2} {:.2} {:.2} {:.2}", self.ox + x1 * s, self.oy - y1 * s, self.ox + x2 * s, self.oy - y2 * s, self.ox + x * s, self.oy - y * s);
            }
            fn close(&mut self) {
                self.out.push('Z');
            }
        }
        let f = &self.faces[face];
        let scale = size / f32::from(f.units_per_em() as u16);
        let mut buf = UnicodeBuffer::new();
        buf.push_str(&text.replace('\u{a0}', " "));
        buf.guess_segment_properties();
        let shaped = rustybuzz::shape(f, &[], buf);
        let mut out = String::new();
        let mut pen_x = x;
        for (info, pos) in shaped.glyph_infos().iter().zip(shaped.glyph_positions()) {
            let gx = pen_x + pos.x_offset as f32 * scale;
            let gy = y - pos.y_offset as f32 * scale;
            let mut pen = Pen { out: &mut out, scale, ox: gx, oy: gy };
            f.outline_glyph(rustybuzz::ttf_parser::GlyphId(info.glyph_id as u16), &mut pen);
            pen_x += pos.x_advance as f32 * scale + letter_spacing;
        }
        (out, pen_x - x)
    }

    /// Linha natural (`normal`) = ascent − descent + lineGap da hhea; número = múltiplo do corpo
    /// com a meia-entrelinha somada ao ascent (semântica CSS, text/leading.ts).
    pub fn line_box(&self, face: usize, size: f32, line_height: LineHeight) -> LineBox {
        let f = &self.faces[face];
        let hhea = f.tables().hhea;
        let upm = f32::from(f.units_per_em() as u16);
        let natural = LineBox {
            height: f32::from(hhea.ascender - hhea.descender + hhea.line_gap) / upm * size,
            ascent: f32::from(hhea.ascender) / upm * size,
        };
        match line_height {
            LineHeight::Normal => natural,
            LineHeight::Multiple(m) => {
                let used = m * size;
                LineBox { height: used, ascent: (used - natural.height) / 2.0 + natural.ascent }
            }
        }
    }
}

// ───────────── quebra ─────────────

#[derive(Clone, Debug, PartialEq)]
pub struct Piece {
    pub text: String,
    pub run: usize,
}

pub type Pieces = Vec<Piece>;

pub struct RunInput {
    pub text: String,
    pub face: usize,
    /// Corpo próprio do trecho (Span fontSize); None = o do Text.
    pub size: Option<f32>,
    /// Sobrescrito/subscrito: desenhado a 2/3 do corpo (DEFAULTS.text.superscriptRatio).
    pub shifted: bool,
    /// Trecho com corpo ou família próprios: a altura da linha passa a depender dos trechos.
    pub own_metrics: bool,
    /// Família não registrada: o texto inteiro é medido por estimativa (text/estimate.ts).
    pub missing: bool,
}

impl RunInput {
    pub fn plain(text: String, face: usize) -> Self {
        RunInput { text, face, size: None, shifted: false, own_metrics: false, missing: false }
    }
}

pub struct TextInput<'a> {
    pub runs: &'a [RunInput],
    pub size: f32,
    pub line_height: LineHeight,
    pub letter_spacing: f32,
    pub nowrap: bool,
    pub max_lines: Option<usize>,
}

pub struct Laid {
    /// Linhas por parágrafo do autor.
    pub paragraphs: Vec<Vec<Pieces>>,
    /// M13-7: altura de cada linha (todas as linhas, em ordem) quando um trecho muda as métricas.
    pub line_heights: Option<Vec<f32>>,
    pub width: f32,
    pub height: f32,
    pub line: LineBox,
    pub widest_segment: f32,
    pub truncated: bool,
    pub word_broken: bool,
}

fn concat(left: &[Piece], right: &[Piece]) -> Pieces {
    let mut out = left.to_vec();
    for piece in right {
        match out.last_mut() {
            Some(last) if last.run == piece.run => last.text.push_str(&piece.text),
            _ => out.push(piece.clone()),
        }
    }
    out
}

fn trim_end(p: &[Piece]) -> Pieces {
    let mut out = p.to_vec();
    while let Some(last) = out.last_mut() {
        let trimmed = last.text.trim_end().to_string();
        if trimmed.is_empty() {
            out.pop();
            continue;
        }
        last.text = trimmed;
        break;
    }
    out
}

fn drop_last_char(p: &[Piece]) -> Pieces {
    let mut out = p.to_vec();
    if let Some(last) = out.last_mut() {
        last.text.pop();
        if last.text.is_empty() {
            out.pop();
        }
    }
    out
}

struct Segment {
    pieces: Pieces,
    glue: Pieces,
}

/// Parágrafo com o run de cada caractere.
struct Source {
    chars: Vec<char>,
    runs: Vec<usize>,
    /// Run de um parágrafo vazio.
    run: usize,
}

impl Source {
    fn pieces(&self, start: usize, end: usize) -> Pieces {
        let mut out: Pieces = Vec::new();
        for i in start..end.min(self.chars.len()) {
            let run = self.runs[i];
            match out.last_mut() {
                Some(last) if last.run == run => last.text.push(self.chars[i]),
                _ => out.push(Piece { text: self.chars[i].to_string(), run }),
            }
        }
        out
    }

    fn run_at(&self, i: usize) -> usize {
        self.runs.get(i).copied().unwrap_or(self.run)
    }

    /// Palavras separadas por espaço (NBSP é cola), cada uma cortada depois de '-' e '/'.
    fn segments(&self) -> Vec<Segment> {
        let is_space = |c: char| c.is_whitespace() && c != '\u{a0}';
        let mut out = Vec::new();
        let mut i = 0;
        while i < self.chars.len() {
            if is_space(self.chars[i]) {
                i += 1;
                continue;
            }
            let start = i;
            while i < self.chars.len() && !is_space(self.chars[i]) {
                i += 1;
            }
            let glue = vec![Piece { text: " ".into(), run: self.run_at(start.saturating_sub(1)) }];
            for (index, (from, to)) in break_after_parts(&self.chars[start..i]).into_iter().enumerate() {
                out.push(Segment { pieces: self.pieces(start + from, start + to), glue: if index == 0 { glue.clone() } else { Vec::new() } });
            }
        }
        out
    }
}

/// `/[-/]*[^-/]+[-/]*|[-/]+/g`: hífen/barra iniciais grudam no que vem depois; finais, no anterior.
fn break_after_parts(word: &[char]) -> Vec<(usize, usize)> {
    let is_br = |c: char| c == '-' || c == '/';
    let mut parts = Vec::new();
    let mut i = 0;
    while i < word.len() {
        let start = i;
        while i < word.len() && is_br(word[i]) {
            i += 1;
        }
        let body = i;
        while i < word.len() && !is_br(word[i]) {
            i += 1;
        }
        if i == body {
            parts.push((start, i));
            continue;
        }
        while i < word.len() && is_br(word[i]) {
            i += 1;
        }
        parts.push((start, i));
    }
    parts
}

struct Measurer<'a> {
    fonts: &'a Fonts,
    runs: &'a [RunInput],
    size: f32,
    letter_spacing: f32,
    /// Sem fonte real: cada caractere mede 0,5 × corpo (CHAR_WIDTH_RATIO), todas as faces iguais.
    estimate: bool,
}

/// text/estimate.ts: linha 1,2 × corpo com baseline em 0,9 × corpo.
const ESTIMATE_CHAR: f32 = 0.5;
const ESTIMATE_LINE: f32 = 1.2;
const ESTIMATE_ASCENT: f32 = 0.9;

fn estimate_line_box(size: f32, line_height: LineHeight) -> LineBox {
    let natural = LineBox { height: ESTIMATE_LINE * size, ascent: ESTIMATE_ASCENT * size };
    match line_height {
        LineHeight::Normal => natural,
        LineHeight::Multiple(m) => {
            let used = m * size;
            LineBox { height: used, ascent: (used - natural.height) / 2.0 + natural.ascent }
        }
    }
}

impl Measurer<'_> {
    fn width(&self, p: &[Piece]) -> f32 {
        p.iter()
            .map(|x| {
                let run = &self.runs[x.run];
                if self.estimate {
                    let chars = x.text.chars().count() as f32;
                    return chars * ESTIMATE_CHAR * run.size.unwrap_or(self.size) + chars * self.letter_spacing;
                }
                let size = run.size.unwrap_or(self.size) * if run.shifted { 2.0 / 3.0 } else { 1.0 };
                self.fonts.width(run.face, &x.text, size, self.letter_spacing)
            })
            .sum()
    }
}

fn fits(width: f32, max: f32) -> bool {
    width <= max + FIT_TOLERANCE
}

fn break_word(pieces: &[Piece], max: f32, m: &Measurer) -> Vec<Pieces> {
    let mut lines: Vec<Pieces> = Vec::new();
    for piece in pieces {
        for c in piece.text.chars() {
            let ch = vec![Piece { text: c.to_string(), run: piece.run }];
            match lines.last_mut() {
                Some(current) => {
                    let candidate = concat(current, &ch);
                    if fits(m.width(&candidate), max) {
                        *current = candidate;
                    } else {
                        lines.push(ch);
                    }
                }
                None => lines.push(ch),
            }
        }
    }
    lines
}

fn wrap(segments: &[Segment], max: f32, m: &Measurer, nowrap: bool) -> (Vec<Pieces>, bool) {
    if segments.is_empty() {
        return (vec![Vec::new()], false);
    }
    if nowrap {
        let mut line = segments[0].pieces.clone();
        for s in &segments[1..] {
            line = concat(&concat(&line, &s.glue), &s.pieces);
        }
        return (vec![line], false);
    }
    let mut lines: Vec<Pieces> = Vec::new();
    let mut broken = false;
    for seg in segments {
        if let Some(current) = lines.last() {
            let candidate = concat(&concat(current, &seg.glue), &seg.pieces);
            if fits(m.width(&candidate), max) {
                *lines.last_mut().unwrap() = candidate;
                continue;
            }
        }
        if fits(m.width(&seg.pieces), max) {
            lines.push(seg.pieces.clone());
        } else {
            broken = true;
            lines.extend(break_word(&seg.pieces, max, m));
        }
    }
    (lines, broken)
}

fn with_ellipsis(line: &[Piece], run: usize, max: f32, m: &Measurer) -> Pieces {
    let mut trimmed = trim_end(line);
    loop {
        let tail_run = trimmed.last().map_or(run, |p| p.run);
        let candidate = concat(&trimmed, &[Piece { text: ELLIPSIS.into(), run: tail_run }]);
        if trimmed.is_empty() || fits(m.width(&candidate), max) {
            return candidate;
        }
        trimmed = trim_end(&drop_last_char(&trimmed));
    }
}

/// Quebra o texto para caber em `max_width` (largura da caixa; a quebra usa × `fonts.options.safety`).
pub fn layout_text(fonts: &Fonts, input: &TextInput, max_width: f32) -> Laid {
    let estimate = input.runs.iter().any(|r| r.missing);
    let m = Measurer { fonts, runs: input.runs, size: input.size, letter_spacing: input.letter_spacing, estimate };
    // A estimativa quebra na largura cheia e devolve a linha mais larga (sem a folga do safety).
    let safety = if estimate { 1.0 } else { fonts.options.safety };
    let break_width = if max_width.is_finite() { max_width * safety } else { f32::INFINITY };

    // Fonte por caractere → parágrafos por '\n'.
    let mut sources: Vec<Source> = vec![Source { chars: Vec::new(), runs: Vec::new(), run: 0 }];
    for (run, r) in input.runs.iter().enumerate() {
        for c in r.text.chars() {
            if c == '\n' {
                sources.push(Source { chars: Vec::new(), runs: Vec::new(), run });
                continue;
            }
            let last = sources.last_mut().unwrap();
            if last.chars.is_empty() {
                last.run = run;
            }
            last.chars.push(c);
            last.runs.push(run);
        }
    }

    let mut paragraphs = Vec::new();
    let mut widest_segment: f32 = 0.0;
    let mut word_broken = false;
    for source in &sources {
        let segments = source.segments();
        if input.nowrap {
            let (joined, _) = wrap(&segments, f32::INFINITY, &m, true);
            widest_segment = widest_segment.max(m.width(&joined[0]));
        } else {
            for s in &segments {
                widest_segment = widest_segment.max(m.width(&s.pieces));
            }
        }
        let (lines, broken) = wrap(&segments, break_width, &m, input.nowrap);
        word_broken |= broken;
        paragraphs.push((lines, source.run));
    }

    // maxLines: corta e termina a última linha com reticência.
    let mut truncated = false;
    if let Some(limit) = input.max_lines.map(|l| l.max(1)) {
        let total: usize = paragraphs.iter().map(|(l, _)| l.len()).sum();
        if total > limit {
            truncated = true;
            let mut kept = Vec::new();
            let mut count = 0;
            for (lines, run) in paragraphs {
                if count >= limit {
                    break;
                }
                let take = (limit - count).min(lines.len());
                count += take;
                kept.push((lines.into_iter().take(take).collect::<Vec<_>>(), run));
            }
            if let Some((lines, run)) = kept.last_mut() {
                let max = if input.nowrap { f32::INFINITY } else { break_width };
                let last = lines.pop().unwrap_or_default();
                lines.push(with_ellipsis(&last, *run, max, &m));
            }
            paragraphs = kept;
        }
    }

    let paragraphs: Vec<Vec<Pieces>> = paragraphs.into_iter().map(|(l, _)| l).collect();
    let widest_line = paragraphs.iter().flatten().map(|l| m.width(&trim_end(l))).fold(0.0_f32, f32::max);
    let face = input.runs.first().map_or(0, |r| r.face);
    let line = if estimate { estimate_line_box(input.size, input.line_height) } else { fonts.line_box(face, input.size, input.line_height) };
    let count = paragraphs.iter().map(Vec::len).sum::<usize>() as f32;
    // A caixa inclui a folga do safety: remedida com largura × safety, não quebra de novo.
    let width = if input.nowrap || !max_width.is_finite() { widest_line / safety } else { (widest_line / safety).min(max_width) };
    // M13-7 (text/leading.ts): sem strut, a linha vai da maior ascendente à maior descendente
    // dos trechos que caem nela; linha vazia usa a caixa do Text.
    let line_heights = input.runs.iter().any(|r| r.own_metrics).then(|| {
        paragraphs
            .iter()
            .flatten()
            .map(|pieces| {
                let mut runs: Vec<usize> = pieces.iter().map(|p| p.run).collect();
                runs.dedup();
                let boxes: Vec<LineBox> = if runs.is_empty() {
                    vec![line]
                } else {
                    runs.iter().map(|&r| if estimate { estimate_line_box(input.runs[r].size.unwrap_or(input.size), input.line_height) } else { fonts.line_box(input.runs[r].face, input.runs[r].size.unwrap_or(input.size), input.line_height) }).collect()
                };
                let ascent = boxes.iter().map(|b| b.ascent).fold(f32::MIN, f32::max);
                let descent = boxes.iter().map(|b| b.height - b.ascent).fold(f32::MIN, f32::max);
                ascent + descent
            })
            .collect::<Vec<f32>>()
    });
    let height = line_heights.as_ref().map_or(count * line.height, |h| h.iter().sum());
    let mut laid = Laid { paragraphs, line_heights, width, height, line, widest_segment, truncated, word_broken: word_broken && !input.nowrap };
    // Truncado: só as linhas visíveis contam, até a da reticência (text/broken.ts brokenWordsOf).
    if truncated && !input.nowrap {
        let content: String = input.runs.iter().map(|r| r.text.as_str()).collect();
        laid.word_broken = !crate::report::broken_words(&content, &laid).is_empty();
    }
    laid
}
