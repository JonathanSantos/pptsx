//! Estouros e diagnósticos do slide posicionado, portados do pptsx: detecção (fit/detect.ts,
//! fit/geometry.ts), mensagens (fit/diagnostics.ts, policies.ts, table.ts, vector.ts), causa
//! (fit/cause.ts) e agrupamento de irmãos (fit/group.ts). Puro: posições entram, diagnósticos saem.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use crate::diag::{Data, Diag, Level, fmt, round};
use crate::layout::Placed;

/// Geometria do relatório em f64, como no pptsx (as contas são do JavaScript).
#[derive(Clone, Copy, Debug, Default)]
pub struct Frame {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Frame {
    fn right(&self) -> f64 {
        self.x + self.w
    }

    fn bottom(&self) -> f64 {
        self.y + self.h
    }
}

fn frame_of(p: &Placed) -> Frame {
    Frame { x: p.exact[0], y: p.exact[1], w: p.exact[2], h: p.exact[3] }
}

fn cell_of(p: &Placed) -> Option<Frame> {
    p.exact_cell.map(|c| Frame { x: c[0], y: c[1], w: c[2], h: c[3] })
}
use crate::model::{Fit, NodeKind};
use crate::text::{Fonts, Laid};

/// DEFAULTS.fit.epsilon
pub const EPSILON: f64 = 0.5;
/// DEFAULTS.text.minLegibleSize
const MIN_LEGIBLE: f64 = 10.0;
/// DEFAULTS.text.weightTolerance
const WEIGHT_TOLERANCE: u16 = 100;
const SEPARATOR: &str = " > ";
const ELLIPSIS: char = '…';

// ───────────── geometria (fit/geometry.ts) ─────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Axis {
    Width,
    Height,
}

impl Axis {
    fn of(self, f: Frame) -> f64 {
        match self {
            Axis::Width => f.w,
            Axis::Height => f.h,
        }
    }
}

#[derive(Clone, Copy)]
struct Excess {
    pt: f64,
    axis: Axis,
}

pub fn content_of(p: &Placed) -> Frame {
    let [t, r, b, l] = p.inset.map(f64::from);
    let f = frame_of(p);
    Frame { x: f.x + l, y: f.y + t, w: (f.w - l - r).max(0.0), h: (f.h - t - b).max(0.0) }
}

fn margin_box(p: &Placed) -> Frame {
    let [t, r, b, l] = p.margin.map(f64::from);
    let f = frame_of(p);
    Frame { x: f.x - l, y: f.y - t, w: f.w + l + r, h: f.h + t + b }
}

fn in_flow(p: &Placed) -> bool {
    !p.node.absolute
}

/// Box (inclusive com `shape`) e o Slide: contêineres com filhos.
fn is_box(p: &Placed) -> bool {
    matches!(p.node.kind, NodeKind::Container) || (matches!(p.node.kind, NodeKind::Shape(_)) && !p.node.children.is_empty())
}

fn is_text(p: &Placed) -> bool {
    matches!(p.node.kind, NodeKind::Text(_)) && p.node.slide_number.is_none()
}

fn sides_outside(inner: Frame, outer: Frame) -> Vec<(&'static str, f64)> {
    [("top", outer.y - inner.y), ("bottom", inner.bottom() - outer.bottom()), ("left", outer.x - inner.x), ("right", inner.right() - outer.right())]
        .into_iter()
        .filter(|(_, pt)| *pt > 0.0)
        .collect()
}

fn excess_of(inner: Frame, outer: Frame) -> Excess {
    sides_outside(inner, outer).into_iter().fold(Excess { pt: 0.0, axis: Axis::Height }, |max, (side, pt)| {
        if pt > max.pt { Excess { pt, axis: if side == "top" || side == "bottom" { Axis::Height } else { Axis::Width } } } else { max }
    })
}

fn percent_of(excess: f64, base: f64) -> f64 {
    if base > 0.0 { excess / base * 100.0 } else { 100.0 }
}

pub fn children_of(placed: &[Placed]) -> Vec<Vec<usize>> {
    let mut out = vec![Vec::new(); placed.len()];
    for (i, p) in placed.iter().enumerate().skip(1) {
        out[p.parent].push(i);
    }
    out
}

fn row_direction(p: &Placed) -> bool {
    use taffy::style::FlexDirection::*;
    matches!(p.node.style.flex_direction, Row | RowReverse)
}

fn is_grid(p: &Placed) -> bool {
    p.node.style.display == taffy::style::Display::Grid
}

fn is_wrap(p: &Placed) -> bool {
    !is_grid(p) && p.node.style.flex_wrap != taffy::style::FlexWrap::NoWrap
}

fn length(l: taffy::style::LengthPercentage) -> f64 {
    let raw = l.into_raw();
    if raw.tag() == taffy::CompactLength::LENGTH_TAG { f64::from(raw.value()) } else { 0.0 }
}

struct ContainerExcess {
    excess: Excess,
    available: f64,
    row: bool,
    layout: Option<&'static str>,
}

/// Estouro dos filhos em fluxo sobre a área de conteúdo, ignorando os já explicados.
fn container_excess(placed: &[Placed], kids: &[Vec<usize>], c: usize, explained: &HashSet<usize>) -> ContainerExcess {
    let content = content_of(&placed[c]);
    let excess = kids[c]
        .iter()
        .filter(|&&k| in_flow(&placed[k]) && !explained.contains(&k))
        .map(|&k| excess_of(margin_box(&placed[k]), content))
        .fold(Excess { pt: 0.0, axis: Axis::Height }, |max, e| if e.pt > max.pt { e } else { max });
    let layout = if is_grid(&placed[c]) { Some("grid") } else if is_wrap(&placed[c]) { Some("wrap") } else { None };
    ContainerExcess { available: excess.axis.of(content), excess, row: row_direction(&placed[c]), layout }
}

// ───────────── detecção (fit/detect.ts) ─────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Text,
    Table,
    Box,
    Slide,
}

#[derive(Clone, Debug)]
pub struct Overflow {
    pub index: usize,
    pub kind: Kind,
    /// Só Text com nowrap estoura na largura.
    pub width: bool,
    /// Item de grid maior que a própria célula (a área é a célula).
    pub cell: bool,
    pub pt: f64,
    pub pct: f64,
}

/// A área do nó é cortada pela célula, quando é item de grid, senão pela área de conteúdo do pai.
fn clip_of(placed: &[Placed], i: usize) -> Frame {
    cell_of(&placed[i]).unwrap_or_else(|| content_of(&placed[placed[i].parent]))
}

fn available_height(placed: &[Placed], i: usize) -> f64 {
    let area = content_of(&placed[i]);
    if !in_flow(&placed[i]) {
        return area.h;
    }
    let clip = clip_of(placed, i);
    (area.bottom().min(clip.bottom()) - area.y).max(0.0)
}

fn available_width(placed: &[Placed], i: usize) -> f64 {
    let area = content_of(&placed[i]);
    if !in_flow(&placed[i]) {
        return area.w;
    }
    let clip = clip_of(placed, i);
    (area.right().min(clip.right()) - area.x).max(0.0)
}

fn leaf_overflows(placed: &[Placed]) -> Vec<Overflow> {
    let mut out = Vec::new();
    for (i, p) in placed.iter().enumerate().skip(1) {
        if let Some(t) = &p.table {
            let available = available_height(placed, i);
            let excess = f64::from(t.height()) - available;
            if excess > EPSILON {
                out.push(Overflow { index: i, kind: Kind::Table, width: false, cell: false, pt: excess, pct: percent_of(excess, available) });
            }
        }
        if !is_text(p) {
            continue;
        }
        let (Some(t), NodeKind::Text(spec)) = (&p.text, &p.node.kind) else { continue };
        let available = available_height(placed, i);
        let excess = f64::from(t.laid.height) - available;
        if excess > EPSILON {
            out.push(Overflow { index: i, kind: Kind::Text, width: false, cell: false, pt: excess, pct: percent_of(excess, available) });
        }
        if spec.nowrap {
            let available = available_width(placed, i);
            let excess = f64::from(t.laid.width) - available;
            if excess > EPSILON {
                out.push(Overflow { index: i, kind: Kind::Text, width: true, cell: false, pt: excess, pct: percent_of(excess, available) });
            }
        }
    }
    out
}

/// O slide e os Box em fluxo, recursivamente (só por Box em fluxo).
fn flow_containers(placed: &[Placed], kids: &[Vec<usize>], c: usize, out: &mut Vec<usize>) {
    out.push(c);
    for &k in &kids[c] {
        if in_flow(&placed[k]) && is_box(&placed[k]) {
            flow_containers(placed, kids, k, out);
        }
    }
}

fn box_overflow(placed: &[Placed], kids: &[Vec<usize>], c: usize, explained: &HashSet<usize>) -> Option<Overflow> {
    let e = container_excess(placed, kids, c, explained);
    (e.excess.pt > EPSILON).then(|| Overflow { index: c, kind: Kind::Box, width: false, cell: false, pt: e.excess.pt, pct: percent_of(e.excess.pt, e.available) })
}

pub fn is_descendant(placed: &[Placed], mut i: usize, ancestor: usize) -> bool {
    while i != 0 {
        i = placed[i].parent;
        if i == ancestor {
            return true;
        }
    }
    false
}

fn slide_overflows(placed: &[Placed], kids: &[Vec<usize>], c: usize, bounds: Frame, boxes: &[usize], wide: &HashSet<usize>, out: &mut Vec<Overflow>) {
    for &k in &kids[c] {
        if !in_flow(&placed[k]) {
            continue;
        }
        let e = excess_of(frame_of(&placed[k]), bounds);
        if e.pt <= EPSILON {
            if is_box(&placed[k]) {
                slide_overflows(placed, kids, k, bounds, boxes, wide, out);
            }
            continue;
        }
        if boxes.iter().any(|&b| b != k && is_descendant(placed, k, b)) || wide.contains(&k) {
            continue;
        }
        out.push(Overflow { index: k, kind: Kind::Slide, width: false, cell: false, pt: e.pt, pct: percent_of(e.pt, e.axis.of(frame_of(&placed[k]))) });
    }
}

/// Item de grid (que não é Text/Table) cuja caixa de margem passa da célula.
fn cell_overflows(placed: &[Placed], kids: &[Vec<usize>], c: usize, already: &HashSet<usize>, out: &mut Vec<Overflow>) {
    for &k in kids[c].iter().filter(|&&k| in_flow(&placed[k])) {
        let p = &placed[k];
        let nested = |out: &mut Vec<Overflow>| {
            if is_box(p) {
                cell_overflows(placed, kids, k, already, out);
            }
        };
        let Some(cell) = cell_of(p) else {
            nested(out);
            continue;
        };
        if is_text(p) || p.table.is_some() || already.contains(&k) {
            nested(out);
            continue;
        }
        let e = excess_of(margin_box(p), cell);
        if e.pt > EPSILON {
            out.push(Overflow { index: k, kind: Kind::Box, width: false, cell: true, pt: e.pt, pct: percent_of(e.pt, e.axis.of(cell)) });
        }
        nested(out);
    }
}

/// Estouros do slide posicionado, com as regras contra duplicata do detect.ts.
pub fn detect(placed: &[Placed]) -> Vec<Overflow> {
    let kids = children_of(placed);
    let leaves = leaf_overflows(placed);
    let mut containers = Vec::new();
    flow_containers(placed, &kids, 0, &mut containers);
    let leaf_paths: HashSet<usize> = leaves.iter().map(|o| o.index).collect();
    let inner: HashSet<usize> = containers.iter().skip(1).filter_map(|&c| box_overflow(placed, &kids, c, &leaf_paths)).map(|o| o.index).collect();
    // M11: estouro de célula conta como explicado para o grid (a causa é o item, como no Text).
    let mut cells = Vec::new();
    cell_overflows(placed, &kids, 0, &inner, &mut cells);
    let mut explained = leaf_paths.clone();
    explained.extend(cells.iter().map(|o| o.index));
    let mut boxes: Vec<Overflow> = containers.iter().skip(1).filter_map(|&c| box_overflow(placed, &kids, c, &explained)).collect();
    boxes.extend(cells);
    let wide: HashSet<usize> = leaves.iter().filter(|o| o.width).map(|o| o.index).collect();
    let mut outside = Vec::new();
    let box_paths: Vec<usize> = boxes.iter().map(|o| o.index).collect();
    slide_overflows(placed, &kids, 0, frame_of(&placed[0]), &box_paths, &wide, &mut outside);
    let mut slide_explained = explained.clone();
    slide_explained.extend(outside.iter().map(|o| o.index));
    let slide_box = box_overflow(placed, &kids, 0, &slide_explained);
    leaves.into_iter().chain(slide_box).chain(boxes).chain(outside).collect()
}

// ───────────── mensagens (fit/diagnostics.ts) ─────────────

fn amount(o: &Overflow) -> String {
    format!("{}% ({} pt)", fmt(o.pct), fmt(o.pt))
}

fn overflow_data(d: Diag, o: &Overflow) -> Diag {
    d.num("overflowPt", round(o.pt)).num("overflowPct", round(o.pct))
}

fn sizes_data(d: Diag, from: f64, to: f64) -> Diag {
    d.num("fromSize", round(from)).num("toSize", round(to))
}

fn where_of(to: f64, min: f64) -> String {
    if to <= min { format!("mesmo em {} pt (mínimo)", fmt(to)) } else { format!("em {} pt", fmt(to)) }
}

const ZERO_AREA_MESSAGE: &str = "A área disponível para o texto é 0 pt: o contêiner não deu altura a ele (flexGrow={1} em coluna com altura pelo conteúdo, flexShrink dos irmãos ou height fixo). Remova flexGrow do Text ou dê altura ao contêiner.";

fn with_zero_area(mut d: Diag, available: f64) -> Diag {
    if available <= EPSILON {
        d.msg = ZERO_AREA_MESSAGE.into();
    }
    d
}

fn width_message(o: &Overflow, line_width: f64, place: &str) -> String {
    format!(
        "Texto com nowrap tem {} pt de largura numa área de {} pt {place}; encurte o texto, alargue a área ou remova nowrap.",
        fmt(line_width),
        fmt(line_width - o.pt)
    )
}

fn quoted(words: &[String]) -> String {
    words.iter().map(|w| format!("\"{w}\"")).collect::<Vec<_>>().join(", ")
}

fn weight_name(w: u16) -> String {
    match w {
        400 => "regular".into(),
        700 => "bold".into(),
        other => other.to_string(),
    }
}

// ───────────── palavras partidas (text/broken.ts) ─────────────

fn normalize(paragraph: &str) -> String {
    paragraph.split(|c: char| c.is_whitespace() && c != '\u{a0}').filter(|w| !w.is_empty()).collect::<Vec<_>>().join(" ")
}

fn word_at(text: &[char], at: usize) -> String {
    let start = text[..at].iter().rposition(|&c| c == ' ').map_or(0, |i| i + 1);
    let end = text[at..].iter().position(|&c| c == ' ').map_or(text.len(), |i| at + i);
    text[start..end].iter().collect()
}

fn broken_in_paragraph(paragraph: &str, lines: &[String]) -> Vec<String> {
    let text: Vec<char> = normalize(paragraph).chars().collect();
    let mut found = Vec::new();
    let mut cursor = 0;
    for line in lines {
        if line.ends_with(ELLIPSIS) {
            break;
        }
        let line: Vec<char> = line.chars().collect();
        if cursor + line.len() > text.len() || text[cursor..cursor + line.len()] != line[..] {
            break;
        }
        let end = cursor + line.len();
        if end >= text.len() {
            break;
        }
        if text[end] == ' ' {
            cursor = end + 1;
            continue;
        }
        if matches!(line.last(), Some('-' | '/')) {
            cursor = end;
            continue;
        }
        found.push(word_at(&text, end));
        cursor = end;
    }
    found
}

fn line_strings(laid: &Laid) -> Vec<Vec<String>> {
    laid.paragraphs.iter().map(|lines| lines.iter().map(|pieces| pieces.iter().map(|p| p.text.as_str()).collect()).collect()).collect()
}

pub fn broken_words(content: &str, laid: &Laid) -> Vec<String> {
    let sources: Vec<&str> = content.split('\n').collect();
    let mut out: Vec<String> = Vec::new();
    for (i, lines) in line_strings(laid).iter().enumerate() {
        for w in broken_in_paragraph(sources.get(i).copied().unwrap_or(""), lines) {
            if !out.contains(&w) {
                out.push(w);
            }
        }
    }
    out
}

// ───────────── diagnósticos por nó (fit/fit.ts) ─────────────

fn text_diagnostics(placed: &[Placed], i: usize, heights: &HashMap<usize, &Overflow>, widths: &HashMap<usize, &Overflow>, slide: usize, fonts: &Fonts) -> Vec<Diag> {
    let p = &placed[i];
    let (NodeKind::Text(spec), Some(t)) = (&p.node.kind, &p.text) else { return Vec::new() };
    let path = p.node.label.as_str();
    // Fonte ausente: a medição é estimada, então estouro, shrink e palavra partida seriam ruído.
    let families: Vec<&str> = spec.runs.iter().map(|r| r.family.as_deref().unwrap_or(&spec.family)).collect();
    if families.iter().any(|f| !fonts.has_family(f)) || (spec.runs.is_empty() && !fonts.has_family(&spec.family)) {
        let first = spec.runs.first();
        let face = format!("{} {}{}", spec.family, weight_name(first.map_or(400, |r| r.weight)), if first.is_some_and(|r| r.italic) { " italic" } else { "" });
        return vec![Diag::new(Level::Error, "font-missing", slide, path, format!("Fonte \"{face}\" não foi encontrada: não está em options.fonts, ou foi registrada sem \"file\" e não existe no sistema. O texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a face com \"file\", instale a fonte ou use uma família disponível."))];
    }
    let (from, to, min) = (f64::from(spec.size), f64::from(t.size), f64::from(spec.min_size.min(spec.size)));
    let height = heights.get(&i).copied();
    let width = widths.get(&i).copied();
    let available = |o: &Overflow| f64::from(t.laid.height) - o.pt;
    let mut out = Vec::new();
    match spec.fit {
        Fit::Shrink => {
            let mut overflows = Vec::new();
            if let Some(o) = height {
                let d = Diag::new(Level::Error, "text-overflow", slide, path, format!("Texto estourou {} da altura disponível {}; reduza o conteúdo, aumente a área ou baixe minSize.", amount(o), where_of(to, min)));
                overflows.push(with_zero_area(sizes_data(overflow_data(d, o), from, to), available(o)));
            }
            if let Some(o) = width {
                let d = Diag::new(Level::Error, "text-overflow", slide, path, width_message(o, f64::from(t.laid.width), &where_of(to, min)));
                overflows.push(sizes_data(overflow_data(d, o).with("axis", Data::Str("width".into())), from, to));
            }
            if overflows.is_empty() && to < from {
                out.push(sizes_data(Diag::new(Level::Info, "text-shrunk", slide, path, format!("Texto reduzido de {} pt para {} pt para caber na área. Se a redução incomodar, encurte o conteúdo ou aumente a área.", fmt(from), fmt(to))), from, to));
            }
            out.extend(overflows);
            if to < from && to < MIN_LEGIBLE {
                out.push(sizes_data(Diag::new(Level::Warn, "text-illegible", slide, path, format!("Texto reduzido de {} pt para {} pt, abaixo do piso legível de {} pt; encurte o conteúdo, aumente a área ou aceite com minSize explícito.", fmt(from), fmt(to), fmt(MIN_LEGIBLE))), from, to));
            }
        }
        Fit::Truncate | Fit::Error => {
            let truncate = spec.fit == Fit::Truncate;
            if let Some(o) = height {
                let msg = if truncate {
                    format!("Texto estourou {} da altura disponível mesmo truncado; a área não comporta nem uma linha. Aumente a área, reduza o fontSize ou remova o texto.", amount(o))
                } else {
                    format!("Texto estourou {} da altura disponível em {} pt (fit=\"error\" não ajusta); reduza o conteúdo, aumente a área ou troque para fit=\"shrink\" ou fit=\"truncate\".", amount(o), fmt(to))
                };
                out.push(with_zero_area(overflow_data(Diag::new(Level::Error, "text-overflow", slide, path, msg), o), available(o)));
            }
            if let Some(o) = width {
                let reason = if truncate { "fit=\"truncate\" só corta linhas, não largura" } else { "fit=\"error\" não ajusta" };
                let d = Diag::new(Level::Error, "text-overflow", slide, path, width_message(o, f64::from(t.laid.width), &format!("em {} pt ({reason})", fmt(to))));
                out.push(overflow_data(d, o).with("axis", Data::Str("width".into())));
            }
        }
    }
    // M13: um aviso por par (pedido, usado).
    let mut pairs: Vec<(u16, u16)> = Vec::new();
    for (r, family) in spec.runs.iter().zip(&families) {
        let used = fonts.matching(family, r.weight, r.italic).weight;
        if r.weight.abs_diff(used) > WEIGHT_TOLERANCE && !pairs.contains(&(r.weight, used)) {
            pairs.push((r.weight, used));
        }
    }
    for (requested, used) in pairs {
        out.push(
            Diag::new(Level::Warn, "font-weight-fallback", slide, path, format!("Peso {requested} de \"{}\" não tem face registrada; o texto sai com a face de peso {used}. Registre a face desse peso em options.fonts (ex.: {{ family: \"{}\", weight: {requested}, file: \"…\" }}) ou use um peso disponível.", spec.family, spec.family))
                .num("requestedWeight", requested as f64)
                .num("usedWeight", used as f64),
        );
    }
    if t.laid.truncated {
        let shown: usize = t.laid.paragraphs.iter().map(Vec::len).sum();
        let runs = crate::layout::runs_of(spec, fonts, t.size / spec.size.max(1e-3));
        let full = crate::text::layout_text(fonts, &crate::layout::text_input(spec, &runs, t.size, None), p.frame.w);
        let total: usize = full.paragraphs.iter().map(Vec::len).sum();
        let hidden = if total > 0 { (((total - shown.min(total)) as f64 / total as f64) * 100.0).round() as i64 } else { 0 };
        out.push(Diag::new(Level::Warn, "text-truncated", slide, path, format!("Texto cortado com reticências: mostradas {shown} de {total} linhas (~{hidden}% do conteúdo oculto). Encurte o conteúdo, aumente a área, aumente maxLines ou use fit=\"shrink\".")));
    }
    if t.laid.word_broken {
        let content: String = spec.runs.iter().map(|r| r.text.as_str()).collect();
        let words = broken_words(&content, &t.laid);
        let plural = words.len() > 1;
        let sizes = if to < from { format!("mesmo reduzido de {} pt para {} pt", fmt(from), fmt(to)) } else { format!("em {} pt", fmt(to)) };
        out.push(sizes_data(
            Diag::new(Level::Warn, "text-word-broken", slide, path, format!(
                "{} no meio por falta de largura: {} não {} inteira{} numa linha de {} pt {sizes}. Encurte a palavra/valor (abrevie, ex.: \"R$ 52,4 mi\"), alargue a área (menos colunas, flexGrow, width maior) ou reduza o fontSize.",
                if plural { "Palavras partidas" } else { "Palavra partida" },
                quoted(&words),
                if plural { "cabem" } else { "cabe" },
                if plural { "s" } else { "" },
                fmt(frame_of(p).w)
            )),
            from,
            to,
        ));
    }
    out
}

fn cell_text(cell: &crate::objects::Cell) -> String {
    cell.runs.iter().map(|r| r.text.as_str()).collect()
}

fn table_diagnostics(placed: &[Placed], i: usize, overflow: Option<&Overflow>, slide: usize, fonts: &Fonts) -> Vec<Diag> {
    let p = &placed[i];
    let (NodeKind::Table(spec), Some(t)) = (&p.node.kind, &p.table) else { return Vec::new() };
    let path = p.node.label.as_str();
    if !fonts.has_family(&spec.family) {
        let face = format!("{} {}", spec.family, weight_name(400));
        return vec![Diag::new(Level::Error, "font-missing", slide, path, format!("Fonte \"{face}\" não foi encontrada: não está em options.fonts, ou foi registrada sem \"file\" e não existe no sistema. O texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a face com \"file\", instale a fonte ou use uma família disponível."))];
    }
    let (from, to, min) = (f64::from(spec.author_size), f64::from(t.size), f64::from(spec.min_size.min(spec.author_size)));
    let header = spec.header_count;
    let total = spec.rows.len().saturating_sub(header);
    // Linhas de dados cujo fundo (com as mescladas que começam nelas) cabe na altura disponível.
    let shown = match overflow {
        None => total,
        Some(o) => {
            let available = f64::from(t.height()) - o.pt;
            let mut bottoms = Vec::new();
            let mut acc = 0.0;
            for h in &t.heights {
                acc += f64::from(*h);
                bottoms.push(acc);
            }
            let reach: Vec<usize> = t
                .grid
                .iter()
                .enumerate()
                .map(|(r, row)| {
                    row.iter()
                        .map(|slot| match slot {
                            crate::objects::Slot::Cell(c) => r + spec.rows[r].cells.get(*c).map_or(1, |cell| cell.row_span.max(1)) - 1,
                            _ => r,
                        })
                        .max()
                        .unwrap_or(r)
                })
                .collect();
            (header..bottoms.len()).filter(|&r| bottoms.get(reach.get(r).copied().unwrap_or(r)).copied().unwrap_or(f64::INFINITY) <= available + EPSILON).count()
        }
    };
    let rows = format!("{shown} de {total} {} {}", if total == 1 { "linha" } else { "linhas" }, if shown == 1 { "cabe inteira" } else { "cabem inteiras" });
    let table_amount = |o: &Overflow| format!("{} pt ({}%)", fmt(o.pt), fmt(o.pct));
    let rows_data = |d: Diag, from: f64, to: f64| sizes_data(d, from, to).num("shownRows", shown as f64).num("totalRows", total as f64);
    const ADVICE: &str = "Reduza linhas/colunas, encurte o texto das células, aumente a área";
    let mut out = Vec::new();
    match spec.fit {
        Fit::Error => {
            if let Some(o) = overflow {
                let d = Diag::new(Level::Error, "table-overflow", slide, path, format!("Tabela estourou {} da altura disponível em {} pt (fit=\"error\" não ajusta): {rows}. {ADVICE} ou troque para fit=\"shrink\".", table_amount(o), fmt(to)));
                out.push(rows_data(overflow_data(d, o), to, to));
            }
        }
        _ => {
            if let Some(o) = overflow {
                let d = Diag::new(Level::Error, "table-overflow", slide, path, format!("Tabela estourou {} da altura disponível {}: {rows}. {ADVICE} ou baixe minSize.", table_amount(o), where_of(to, min)));
                out.push(rows_data(overflow_data(d, o), from, to));
            } else if to < from {
                out.push(sizes_data(Diag::new(Level::Info, "text-shrunk", slide, path, format!("Tabela reduzida de {} pt para {} pt para caber na área. Se a redução incomodar, encurte o texto das células, reduza linhas/colunas ou aumente a área.", fmt(from), fmt(to))), from, to));
            }
            if to < from && to < MIN_LEGIBLE {
                out.push(sizes_data(Diag::new(Level::Warn, "text-illegible", slide, path, format!("Tabela reduzida de {} pt para {} pt, abaixo do piso legível de {} pt; reduza linhas/colunas, encurte o texto das células, aumente a área ou aceite com minSize explícito.", fmt(from), fmt(to), fmt(MIN_LEGIBLE))), from, to));
            }
        }
    }
    // Palavras partidas por coluna (na ordem das colunas, sem repetir palavra).
    let mut columns: Vec<String> = Vec::new();
    let mut plural = false;
    for c in 0..t.widths.len() {
        let mut words: Vec<String> = Vec::new();
        for (r, row) in t.grid.iter().enumerate() {
            let Some(crate::objects::Slot::Cell(k)) = row.get(c) else { continue };
            let Some(cell) = spec.rows[r].cells.get(*k) else { continue };
            let Some(laid) = t.cells.get(r).and_then(|cells| cells.get(*k)) else { continue };
            if cell.span != 1 || !laid.word_broken {
                continue;
            }
            for w in broken_words(&cell_text(cell), laid) {
                if !words.contains(&w) {
                    words.push(w);
                }
            }
        }
        if words.is_empty() {
            continue;
        }
        let header_text = (header > 0).then(|| t.grid[0].get(c).and_then(|s| if let crate::objects::Slot::Cell(k) = s { spec.rows[0].cells.get(*k).map(cell_text) } else { None })).flatten().unwrap_or_default();
        let width = f64::from((t.widths[c] - 2.0 * spec.padding).max(0.0));
        plural |= words.len() > 1;
        columns.push(format!("{} não {} inteira{} numa linha de {} pt na coluna \"{header_text}\"", quoted(&words), if words.len() > 1 { "cabem" } else { "cabe" }, if words.len() > 1 { "s" } else { "" }, fmt(width)));
    }
    if !columns.is_empty() {
        let plural = plural || columns.len() > 1;
        let sizes = if to < from { format!("mesmo com a tabela reduzida de {} pt para {} pt", fmt(from), fmt(to)) } else { format!("em {} pt", fmt(to)) };
        out.push(sizes_data(
            Diag::new(Level::Warn, "text-word-broken", slide, path, format!("{} no meio por falta de largura na tabela: {} {sizes}. Encurte a palavra/valor (abrevie, ex.: \"R$ 52,4 mi\"), alargue a coluna (width da coluna, tabela mais larga ou menos colunas) ou reduza o fontSize.", if plural { "Palavras partidas" } else { "Palavra partida" }, columns.join("; "))),
            from,
            to,
        ));
    }
    if spec.rows.iter().any(|r| r.cells.iter().any(|c| c.icon.is_some())) {
        out.push(Diag::new(Level::Info, "table-cell-icon", slide, path, "Os ícones das células saem como formas sobre a tabela, não dentro dela: se alguém mover ou redimensionar a tabela no PowerPoint, os ícones não acompanham."));
    }
    out
}

fn box_message(placed: &[Placed], kids: &[Vec<usize>], o: &Overflow, explained: &HashSet<usize>, slide: usize) -> Diag {
    let e = container_excess(placed, kids, o.index, explained);
    let used = fmt(e.available + e.excess.pt);
    let axis = if e.excess.axis == Axis::Width { "horizontal" } else { "vertical" };
    let direction = if e.row { "row" } else { "column" };
    let main = e.row == (e.excess.axis == Axis::Width);
    let usage = match e.layout {
        Some("grid") => format!("Os tracks do grid ocupam {used} pt na {axis}"),
        Some("wrap") if !main => format!("As linhas do wrap ocupam {used} pt na {axis}"),
        _ if main => format!("Os filhos em fluxo somam {used} pt na {axis} ({direction})"),
        _ => format!("O maior filho em fluxo ocupa {used} pt na {axis} (eixo cruzado da {direction})"),
    };
    let d = Diag::new(Level::Error, "box-overflow", slide, placed[o.index].node.label.as_str(), format!(
        "{usage}, mas a área de conteúdo tem {} pt: estouro de {} pt ({}%). Reduza width/height fixos ou gap/padding, permita flexShrink nos filhos (flexShrink={{0}} impede), ou aumente o contêiner.",
        fmt(e.available),
        fmt(o.pt),
        fmt(o.pct)
    ));
    overflow_data(d, o)
}

fn cell_message(placed: &[Placed], o: &Overflow, slide: usize) -> Diag {
    let p = &placed[o.index];
    let cell = cell_of(p).unwrap_or(frame_of(p));
    let d = Diag::new(Level::Error, "box-overflow", slide, p.node.label.as_str(), format!(
        "O item ocupa {} × {} pt (com margens), mas a célula do grid tem {} × {} pt: estouro de {} pt ({}%). Use um track auto/minmax(auto, …) nessa linha/coluna, reduza o conteúdo ou o tamanho fixo do item.",
        fmt(frame_of(p).w),
        fmt(frame_of(p).h),
        fmt(cell.w),
        fmt(cell.h),
        fmt(o.pt),
        fmt(o.pct)
    ));
    overflow_data(d, o)
}

fn out_of_slide(placed: &[Placed], o: &Overflow, slide: usize) -> Diag {
    let sides: Vec<String> = sides_outside(frame_of(&placed[o.index]), frame_of(&placed[0]))
        .into_iter()
        .map(|(side, pt)| {
            let name = match side {
                "top" => "pelo topo",
                "right" => "pela direita",
                "bottom" => "pela base",
                _ => "pela esquerda",
            };
            format!("{} pt {name}", fmt(pt))
        })
        .collect();
    Diag::new(Level::Error, "out-of-slide", slide, placed[o.index].node.label.as_str(), format!("O elemento sai do slide: {}. Reduza o tamanho dele ou o conteúdo ao redor, ou ajuste top/left. Só se for decoração intencional fora do fluxo, use position=\"absolute\".", sides.join(" e ")))
        .num("overflowPt", round(o.pt))
}

fn image_diagnostic(p: &Placed, slide: usize) -> Option<Diag> {
    let NodeKind::Image(img) = &p.node.kind else { return None };
    let (w, h) = (f64::from(img.natural.0), f64::from(img.natural.1));
    if w <= 0.0 || h <= 0.0 {
        return None;
    }
    let (sx, sy) = (frame_of(p).w / w, frame_of(p).h / h);
    let scale = if img.cover { sx.max(sy) } else { sx.min(sy) };
    let drawn = w * scale;
    let pixels = (w / 0.75).round() as i64;
    (drawn - w > EPSILON).then(|| {
        Diag::new(Level::Info, "image-upscaled", slide, p.node.label.as_str(), format!("Imagem desenhada com {} pt de largura, acima do natural ({pixels} px = {} pt a 96 dpi); pode sair borrada. Use um arquivo com mais resolução ou reduza a área da imagem.", fmt(drawn), fmt(w)))
    })
}

fn icon_diagnostic(p: &Placed, slide: usize) -> Option<Diag> {
    let NodeKind::Icon(spec) = &p.node.kind else { return None };
    let crate::vector::IconContent::Raster { reason, .. } = &spec.icon.content else { return None };
    let msg = if reason == "render=\"image\"" {
        "O ícone saiu como imagem porque render=\"image\" foi pedido (não é editável como forma no PowerPoint).".to_string()
    } else {
        format!("O ícone saiu como imagem (não editável como forma): {reason}. Para forma nativa, use um SVG só com path/rect/circle/ellipse/line/polygon/polyline, cores sólidas e sem transform/opacity.")
    };
    Some(Diag::new(Level::Info, "icon-rasterized", slide, p.node.label.as_str(), msg))
}

// ───────────── causa (fit/cause.ts) ─────────────

#[derive(Clone, Copy, PartialEq)]
enum Flow {
    Column,
    Row,
    Wrap,
    Grid,
}

fn flow_of(p: &Placed) -> Flow {
    if is_grid(p) {
        Flow::Grid
    } else if !row_direction(p) {
        Flow::Column
    } else if p.node.style.flex_wrap == taffy::style::FlexWrap::NoWrap {
        Flow::Row
    } else {
        Flow::Wrap
    }
}

fn lines_of(placed: &[Placed], kids: &[Vec<usize>], c: usize) -> Vec<Vec<usize>> {
    let mut lines: Vec<(f64, Vec<usize>)> = Vec::new();
    for &k in kids[c].iter().filter(|&&k| in_flow(&placed[k])) {
        let top = round(cell_of(&placed[k]).map_or(frame_of(&placed[k]).y - f64::from(placed[k].margin[0]), |c| c.y));
        match lines.iter_mut().find(|(t, _)| *t == top) {
            Some((_, l)) => l.push(k),
            None => lines.push((top, vec![k])),
        }
    }
    lines.into_iter().map(|(_, l)| l).collect()
}

fn demand_of(placed: &[Placed], kids: &[Vec<usize>], i: usize, fonts: &Fonts) -> f64 {
    let p = &placed[i];
    if !p.node.style.size.height.is_auto() {
        return 0.0;
    }
    if is_text(p) {
        let (NodeKind::Text(spec), Some(t)) = (&p.node.kind, &p.text) else { return 0.0 };
        let missing = spec.runs.iter().any(|r| !fonts.has_family(r.family.as_deref().unwrap_or(&spec.family)));
        return if missing { 0.0 } else { (f64::from(t.laid.height) - frame_of(p).h).max(0.0) };
    }
    if let Some(t) = &p.table {
        return (f64::from(t.height()) - frame_of(p).h).max(0.0);
    }
    if !is_box(p) {
        return 0.0;
    }
    let children: Vec<usize> = kids[i].iter().copied().filter(|&k| in_flow(&placed[k])).collect();
    match flow_of(p) {
        Flow::Column => children.iter().map(|&k| demand_of(placed, kids, k, fonts)).sum(),
        Flow::Row => children.iter().map(|&k| demand_of(placed, kids, k, fonts)).fold(0.0, f64::max),
        _ => lines_of(placed, kids, i).iter().map(|l| l.iter().map(|&k| demand_of(placed, kids, k, fonts)).fold(0.0, f64::max)).sum(),
    }
}

fn wanted_of(placed: &[Placed], kids: &[Vec<usize>], i: usize, fonts: &Fonts) -> f64 {
    frame_of(&placed[i]).h + f64::from(placed[i].margin[0]) + f64::from(placed[i].margin[2]) + demand_of(placed, kids, i, fonts)
}

fn is_overloaded(placed: &[Placed], kids: &[Vec<usize>], c: usize, fonts: &Fonts) -> bool {
    let content = content_of(&placed[c]).h + EPSILON;
    let style = &placed[c].node.style;
    if flow_of(&placed[c]) == Flow::Wrap {
        let lines = lines_of(placed, kids, c);
        let wanted: f64 = lines.iter().map(|l| l.iter().map(|&k| wanted_of(placed, kids, k, fonts)).fold(0.0, f64::max)).sum();
        return wanted + length(style.gap.height) * lines.len().saturating_sub(1) as f64 > content;
    }
    let children: Vec<usize> = kids[c].iter().copied().filter(|&k| in_flow(&placed[k])).collect();
    let wanted: f64 = children.iter().map(|&k| wanted_of(placed, kids, k, fonts)).sum();
    let gap = if row_direction(&placed[c]) { length(style.gap.width) } else { length(style.gap.height) };
    wanted + gap * children.len().saturating_sub(1) as f64 > content
}

fn is_within(path: &str, scope: &str) -> bool {
    path == scope || path.starts_with(&format!("{scope}{SEPARATOR}"))
}

fn ancestors_of(path: &str) -> Vec<String> {
    let segments: Vec<&str> = path.split(SEPARATOR).collect();
    (1..segments.len()).map(|drop| segments[..segments.len() - drop].join(SEPARATOR)).collect()
}

struct Cause {
    path: String,
    demand: f64,
}

struct WidthCause {
    path: String,
    pt: f64,
    siblings: Vec<String>,
}

fn attribute_causes(diags: Vec<Diag>, placed: &[Placed], kids: &[Vec<usize>], overflows: &[Overflow], fonts: &Fonts) -> Vec<Diag> {
    let mut containers = Vec::new();
    flow_containers(placed, kids, 0, &mut containers);
    let label = |i: usize| placed[i].node.label.clone();
    // Altura: contêineres em coluna/wrap sobrecarregados apontam o filho de maior demanda.
    let overflowing: Vec<String> = overflows.iter().filter(|o| o.kind != Kind::Slide && !o.width).map(|o| label(o.index)).collect();
    let mut causes: HashMap<String, Cause> = HashMap::new();
    for &c in &containers {
        let flow = flow_of(&placed[c]);
        let path = label(c);
        if matches!(flow, Flow::Row | Flow::Grid) || !overflowing.iter().any(|o| *o != path && is_within(o, &path)) {
            continue;
        }
        if !is_overloaded(placed, kids, c, fonts) {
            continue;
        }
        let mut best: Option<Cause> = None;
        for &k in kids[c].iter().filter(|&&k| in_flow(&placed[k])) {
            let demand = demand_of(placed, kids, k, fonts);
            if demand <= 0.0 || best.as_ref().is_some_and(|b| demand <= b.demand) {
                continue;
            }
            best = Some(Cause { path: label(k), demand });
        }
        if let Some(b) = best {
            causes.insert(path, b);
        }
    }
    // Largura: numa row, o nowrap de maior estouro espreme os irmãos.
    let widths: HashMap<usize, &Overflow> = overflows.iter().filter(|o| o.width).map(|o| (o.index, o)).collect();
    let mut width_causes: HashMap<String, WidthCause> = HashMap::new();
    if !widths.is_empty() {
        for &c in &containers {
            if flow_of(&placed[c]) != Flow::Row {
                continue;
            }
            let in_flow_kids: Vec<usize> = kids[c].iter().copied().filter(|&k| in_flow(&placed[k])).collect();
            let mut worst: Option<&Overflow> = None;
            for k in &in_flow_kids {
                if let Some(o) = widths.get(k)
                    && worst.is_none_or(|w| o.pt > w.pt) {
                        worst = Some(o);
                    }
            }
            if let Some(w) = worst {
                let siblings = in_flow_kids.iter().filter(|&&k| k != w.index).map(|&k| label(k)).collect();
                width_causes.insert(label(c), WidthCause { path: label(w.index), pt: w.pt, siblings });
            }
        }
    }
    diags
        .into_iter()
        .map(|mut d| {
            let width_axis = d.get_str("axis") == Some("width");
            if matches!(d.code, "text-overflow" | "table-overflow" | "box-overflow") && !width_axis
                && let Some(cause) = ancestors_of(&d.path).iter().filter_map(|a| causes.get(a)).find(|c| !is_within(&d.path, &c.path)) {
                    d.msg = format!("{} Esse estouro é consequência: {} pede {} pt a mais do que a área tem; corrija {} primeiro.", d.msg, cause.path, fmt(cause.demand), cause.path);
                    d.set("causedBy", Data::Str(cause.path.clone()));
                }
            if matches!(d.code, "text-overflow" | "table-overflow" | "text-word-broken" | "box-overflow" | "out-of-slide") && d.get("causedBy").is_none() {
                let candidates = std::iter::once(d.path.clone()).chain(ancestors_of(&d.path));
                let found = candidates.filter_map(|row| width_causes.get(&row).filter(|c| d.path == row || c.siblings.iter().any(|s| is_within(&d.path, s)))).next();
                if let Some(c) = found {
                    d.msg = format!("{} Esse estouro é consequência: {} tem {} pt a mais de largura do que a área tem; corrija {} primeiro.", d.msg, c.path, fmt(c.pt), c.path);
                    d.set("causedBy", Data::Str(c.path.clone()));
                }
            }
            d
        })
        .collect()
}

// ───────────── agrupamento (fit/group.ts) ─────────────

/// Nesses códigos o motivo está só na mensagem: mensagens diferentes não se agrupam.
const MESSAGE_IDENTITY: [&str; 4] = ["icon-rasterized", "path-invalid", "connector-target-missing", "connector-omitted"];

fn identity_of(d: &Diag) -> String {
    let data = |k: &str| match d.get(k) {
        Some(Data::Num(n)) => crate::js::value::num_to_string(*n),
        Some(Data::Str(s)) => s.clone(),
        _ => String::new(),
    };
    [
        d.slide.to_string(),
        d.code.to_string(),
        d.level.name().to_string(),
        data("causedBy"),
        data("fromSize"),
        data("toSize"),
        data("axis"),
        data("requestedWeight"),
        data("usedWeight"),
        if MESSAGE_IDENTITY.contains(&d.code) { d.msg.clone() } else { String::new() },
    ]
    .join("\u{0}")
}

fn is_worse(a: &Diag, b: &Diag) -> bool {
    let (oa, ob) = (a.get_num("overflowPt"), b.get_num("overflowPt"));
    if oa.is_some() || ob.is_some() {
        return oa.unwrap_or(f64::NEG_INFINITY) > ob.unwrap_or(f64::NEG_INFINITY);
    }
    a.get_num("toSize").unwrap_or(f64::INFINITY) < b.get_num("toSize").unwrap_or(f64::INFINITY)
}

static INDEX_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"^(.*)\[(\d+)\]$").expect("regex fixa"));

pub fn group(diags: Vec<Diag>) -> Vec<Diag> {
    let index_re = &*INDEX_RE;
    struct Candidate {
        key: String,
        depth: usize,
        base: String,
        /// (posição, índice)
        members: Vec<(usize, usize)>,
    }
    let mut candidates: Vec<Candidate> = Vec::new();
    for (position, d) in diags.iter().enumerate() {
        let segments: Vec<&str> = d.path.split(SEPARATOR).collect();
        for (depth, seg) in segments.iter().enumerate() {
            let Some(c) = index_re.captures(seg) else { continue };
            let base = c[1].to_string();
            let index: usize = c[2].parse().unwrap_or(0);
            let wildcard: Vec<String> = segments.iter().enumerate().map(|(at, o)| if at == depth { format!("{base}[*]") } else { o.to_string() }).collect();
            let key = format!("{}\u{0}{}", identity_of(d), wildcard.join(SEPARATOR));
            match candidates.iter_mut().find(|c| c.key == key) {
                Some(c) => {
                    if !c.members.iter().any(|(_, i)| *i == index) {
                        c.members.push((position, index));
                    }
                }
                None => candidates.push(Candidate { key, depth, base, members: vec![(position, index)] }),
            }
        }
    }
    let first = |c: &Candidate| c.members.iter().map(|(p, _)| *p).min().unwrap_or(usize::MAX);
    let mut taken: HashSet<usize> = HashSet::new();
    let mut chosen: Vec<Candidate> = Vec::new();
    loop {
        for c in candidates.iter_mut() {
            c.members.retain(|(p, _)| !taken.contains(p));
        }
        let best = candidates
            .iter()
            .enumerate()
            .filter(|(_, c)| c.members.len() >= 2)
            .max_by(|(_, a), (_, b)| a.members.len().cmp(&b.members.len()).then(a.depth.cmp(&b.depth)).then(first(b).cmp(&first(a))))
            .map(|(i, _)| i);
        let Some(i) = best else { break };
        let c = candidates.remove(i);
        taken.extend(c.members.iter().map(|(p, _)| *p));
        chosen.push(c);
    }
    if chosen.is_empty() {
        return diags;
    }
    let mut out = Vec::new();
    for (position, d) in diags.iter().enumerate() {
        if let Some(c) = chosen.iter().find(|c| first(c) == position) {
            let mut members = c.members.clone();
            members.sort_by_key(|(_, i)| *i);
            let indices: Vec<usize> = members.iter().map(|(_, i)| *i).collect();
            let contiguous = indices.windows(2).all(|w| w[1] == w[0] + 1);
            let label = if contiguous { format!("{}[{}..{}]", c.base, indices[0], indices[indices.len() - 1]) } else { format!("{}[{}]", c.base, indices.iter().map(usize::to_string).collect::<Vec<_>>().join(",")) };
            let worst = members.iter().map(|(p, _)| &diags[*p]).fold(&diags[members[0].0], |chosen, item| if is_worse(item, chosen) { item } else { chosen });
            let mut g = worst.clone();
            let mut segments: Vec<String> = g.path.split(SEPARATOR).map(str::to_string).collect();
            segments[c.depth] = label.clone();
            g.path = segments.join(SEPARATOR);
            g.msg = format!("{} (×{}: mesmo problema em {label})", g.msg, indices.len());
            g.set("count", Data::Num(indices.len() as f64));
            g.set("paths", Data::List(members.iter().map(|(p, _)| diags[*p].path.clone()).collect()));
            out.push(g);
        } else if !taken.contains(&position) {
            out.push(d.clone());
        }
    }
    out
}

// ───────────── junção (fit/fit.ts diagnosticsOf) ─────────────

/// Diagnósticos do slide final: Text/Table na ordem do slide, Box, fora do slide, imagens e
/// vetores; depois a causa de cada estouro e o agrupamento de irmãos iguais.
pub fn slide_diagnostics(placed: &[Placed], slide: usize, fonts: &Fonts) -> Vec<Diag> {
    let overflows = detect(placed);
    let kids = children_of(placed);
    let heights: HashMap<usize, &Overflow> = overflows.iter().filter(|o| o.kind == Kind::Text && !o.width).map(|o| (o.index, o)).collect();
    let widths: HashMap<usize, &Overflow> = overflows.iter().filter(|o| o.kind == Kind::Text && o.width).map(|o| (o.index, o)).collect();
    let tables: HashMap<usize, &Overflow> = overflows.iter().filter(|o| o.kind == Kind::Table).map(|o| (o.index, o)).collect();
    let mut out = Vec::new();
    for i in 1..placed.len() {
        if placed[i].table.is_some() {
            out.extend(table_diagnostics(placed, i, tables.get(&i).copied(), slide, fonts));
        } else if is_text(&placed[i]) {
            out.extend(text_diagnostics(placed, i, &heights, &widths, slide, fonts));
        }
    }
    let explained: HashSet<usize> = overflows.iter().filter(|o| matches!(o.kind, Kind::Text | Kind::Table) || o.cell).map(|o| o.index).collect();
    out.extend(overflows.iter().filter(|o| o.kind == Kind::Box).map(|o| if o.cell { cell_message(placed, o, slide) } else { box_message(placed, &kids, o, &explained, slide) }));
    out.extend(overflows.iter().filter(|o| o.kind == Kind::Slide).map(|o| out_of_slide(placed, o, slide)));
    out.extend(placed.iter().skip(1).filter_map(|p| image_diagnostic(p, slide)));
    out.extend(placed.iter().skip(1).filter_map(|p| icon_diagnostic(p, slide)));
    group(with_component(attribute_causes(out, placed, &kids, &overflows, fonts), placed))
}

/// `data.component`: o componente do autor mais próximo acima do nó do diagnóstico (ou o próprio),
/// com as props que ele passou. O path continua o do pptsx; isto é o que diz "o que mexer".
fn with_component(mut diags: Vec<Diag>, placed: &[Placed]) -> Vec<Diag> {
    let by_path: HashMap<&str, usize> = placed.iter().enumerate().map(|(i, p)| (p.node.label.as_str(), i)).collect();
    for d in &mut diags {
        let Some(&start) = by_path.get(d.path.as_str()) else { continue };
        let mut i = start;
        loop {
            if let Some(source) = &placed[i].node.source {
                d.set("component", Data::Str(source.to_string()));
                break;
            }
            if i == 0 {
                break;
            }
            i = placed[i].parent;
        }
    }
    diags
}

// ───────────── paginação, JSON e resumo ─────────────

/// slide-continued (fit/diagnostics.ts slideContinued): "3 de 12 itens no 1º, 5 no 2º…".
pub fn slide_continued(slide: usize, path: &str, source: usize, items: &[usize], kind: &str) -> Diag {
    let (unit, advice) = match kind {
        "text" => ("linhas", "reduza o fontSize do texto ou encurte-o"),
        "table" => ("linhas da tabela", "reduza o fontSize da tabela ou o cellPadding"),
        _ => ("itens", "reduza o fontSize dos itens ou o conteúdo"),
    };
    let total: usize = items.iter().sum();
    let parts: Vec<String> = items.iter().enumerate().map(|(i, n)| if i == 0 { format!("{n} de {total} {unit} no 1º") } else { format!("{n} no {}º", i + 1) }).collect();
    let d = Diag::new(Level::Info, "slide-continued", slide, path, format!("Slide {source} do autor virou {} slides ({}). Para caber em menos slides, {advice}.", items.len(), parts.join(", ")))
        .num("parts", items.len() as f64)
        .num("sourceSlide", source as f64);
    if kind == "box" { d } else { d.with("kind", Data::Str(kind.into())) }
}

fn data_json(v: &Data) -> String {
    let mut out = String::new();
    match v {
        Data::Num(n) => out.push_str(&crate::js::value::num_to_string(*n)),
        Data::Str(s) => crate::js::value::to_json(&crate::js::value::str_val(s), &mut out),
        Data::List(items) => {
            let values = items.iter().map(|s| crate::js::value::str_val(s)).collect();
            crate::js::value::to_json(&crate::js::value::arr_val(values), &mut out);
        }
    }
    out
}

fn str_json(s: &str) -> String {
    let mut out = String::new();
    crate::js::value::to_json(&crate::js::value::str_val(s), &mut out);
    out
}

/// `<deck>.diagnostics.json`: a lista do pptsx (size, slide, severity, code, path, message, data).
pub fn json(list: &[(String, Diag)]) -> String {
    if list.is_empty() {
        return "[]".into();
    }
    let items: Vec<String> = list
        .iter()
        .map(|(size, d)| {
            let data = if d.data.is_empty() {
                String::new()
            } else {
                let fields: Vec<String> = d.data.iter().map(|(k, v)| format!("\n      {}: {}", str_json(k), data_json(v))).collect();
                format!(",\n    \"data\": {{{}\n    }}", fields.join(","))
            };
            format!(
                "  {{\n    \"size\": {},\n    \"slide\": {},\n    \"severity\": {},\n    \"code\": {},\n    \"path\": {},\n    \"message\": {}{data}\n  }}",
                str_json(size),
                d.slide,
                str_json(d.level.name()),
                str_json(d.code),
                str_json(&d.path),
                str_json(&d.msg)
            )
        })
        .collect();
    format!("[\n{}\n]", items.join(",\n"))
}

fn is_derived(d: &Diag) -> bool {
    d.get("causedBy").is_some()
}

/// Causa do derivado: o diagnóstico de path igual ao causedBy, senão o primeiro dentro dele (cli.ts).
fn cause_index(list: &[(String, Diag)], i: usize) -> Option<usize> {
    let (size, d) = &list[i];
    let caused = d.get_str("causedBy")?;
    let candidates = |exact: bool| {
        list.iter().position(|(s, c)| s == size && c.slide == d.slide && !is_derived(c) && if exact { c.path == caused } else { c.path.starts_with(&format!("{caused}{SEPARATOR}")) })
    };
    candidates(true).or_else(|| candidates(false))
}

/// Resumo como o `pptsx build` imprime: cabeçalho sem os derivados e cada causa com os derivados embaixo.
pub fn summary(list: &[(String, Diag)]) -> String {
    if list.is_empty() {
        return "Nenhum diagnóstico.".into();
    }
    let icon = |l: Level| match l {
        Level::Error => "✖",
        Level::Warn => "▲",
        Level::Info => "•",
    };
    let line = |size: &str, d: &Diag, indent: &str, marker: &str| {
        let slide = match d.get_num("sourceSlide") {
            Some(s) if s as usize != d.slide => format!("slide {} ({} no deck)", d.slide, s),
            _ => format!("slide {}", d.slide),
        };
        let component = d.get_str("component").map(|c| format!("\n{indent}  no componente {c}")).unwrap_or_default();
        format!("{indent}{marker}{} [{size} · {slide}] {} em {}\n{indent}  {}{component}", icon(d.level), d.code, d.path, d.msg)
    };
    let primary: Vec<&Diag> = list.iter().map(|(_, d)| d).filter(|d| !is_derived(d)).collect();
    let derived = list.len() - primary.len();
    let count = |l: Level| primary.iter().filter(|d| d.level == l).count();
    let note = if derived > 0 { format!(" (+{derived} {})", if derived == 1 { "derivado" } else { "derivados" }) } else { String::new() };
    let mut out = vec![format!("Diagnósticos: {} error{note}, {} warning, {} info", count(Level::Error), count(Level::Warn), count(Level::Info))];
    let anchors: Vec<Option<usize>> = (0..list.len()).map(|i| cause_index(list, i)).collect();
    for (i, (size, d)) in list.iter().enumerate() {
        if anchors[i].is_some() {
            continue;
        }
        out.push(line(size, d, "  ", ""));
        for (j, (s, c)) in list.iter().enumerate() {
            if anchors[j] == Some(i) {
                out.push(line(s, c, "    ", "↳ "));
            }
        }
    }
    out.join("\n")
}

/// css-not-emitted: irmãos só se agrupam com a mesma mensagem (propriedade, valor e motivo).
pub fn group_by_message(diags: Vec<Diag>) -> Vec<Diag> {
    let mut messages: Vec<String> = Vec::new();
    for d in &diags {
        if !messages.contains(&d.msg) {
            messages.push(d.msg.clone());
        }
    }
    let first = |m: &str| messages.iter().position(|x| x == m).unwrap_or(0);
    let mut out: Vec<Diag> = messages.iter().flat_map(|m| group(diags.iter().filter(|d| &d.msg == m).cloned().collect())).collect();
    out.sort_by_key(|d| (d.slide, first(d.msg.split(" (×").next().unwrap_or(&d.msg))));
    out
}
