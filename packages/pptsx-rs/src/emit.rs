//! Emissor OOXML: árvore posicionada → `slideN.xml`. Escreve o XML direto (sem pptxgenjs),
//! no mesmo formato que o pptsx gera: texto com quebras forçadas (uma `<a:br/>` por linha
//! calculada), `lnSpc` em pontos, insets zero e as formas como `prstGeom`.

use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::PathBuf;
use std::sync::LazyLock;

use crate::css::{Dash, Rgba, Stroke};
use crate::layout::{Frame, Placed, SlideLayout, TextOut};
use crate::model::{Align, NodeKind, Paint, ShapeSpec, SlideSpec};

const EMU_PER_PT: f32 = 12700.0;

pub fn emu(pt: f32) -> i64 {
    (pt * EMU_PER_PT).round() as i64
}

pub fn esc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            // Como o pptsx (pptxgenjs) grava: o mesmo texto no PowerPoint.
            '\'' => out.push_str("&apos;"),
            // Caracteres de controle são inválidos em XML 1.0.
            c if (c as u32) < 0x20 && c != '\t' && c != '\n' && c != '\r' => {}
            c => out.push(c),
        }
    }
    out
}

/// Imagens do deck inteiro, sem repetir arquivo.
pub enum MediaSource {
    File(PathBuf),
    Bytes(Vec<u8>),
}

#[derive(Default)]
pub struct Media {
    pub files: Vec<(String, MediaSource)>,
    by_path: HashMap<PathBuf, String>,
    by_key: HashMap<String, String>,
    /// `ppt/charts/chartN.xml` do deck inteiro, com a planilha embutida de cada um.
    pub charts: Vec<(String, Vec<u8>)>,
}

impl Media {
    fn add(&mut self, path: &PathBuf) -> String {
        if let Some(name) = self.by_path.get(path) {
            return name.clone();
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_ascii_lowercase();
        let name = format!("image{}.{ext}", self.files.len() + 1);
        self.files.push((name.clone(), MediaSource::File(path.clone())));
        self.by_path.insert(path.clone(), name.clone());
        name
    }

    /// Imagem gerada em memória (ícone rasterizado); `key` evita repetir o mesmo PNG.
    pub fn add_bytes(&mut self, key: &str, bytes: Vec<u8>, ext: &str) -> String {
        if let Some(name) = self.by_key.get(key) {
            return name.clone();
        }
        let name = format!("image{}.{ext}", self.files.len() + 1);
        self.files.push((name.clone(), MediaSource::Bytes(bytes)));
        self.by_key.insert(key.to_string(), name.clone());
        name
    }
}

pub enum RelKind {
    Image(String),
    Hyperlink(String),
    /// Número do chartN.xml.
    Chart(usize),
}

pub struct SlideXml {
    pub xml: String,
    /// rId2.. (rId1 é o layout).
    pub rels: Vec<RelKind>,
    /// M15: só no 1º slide de cada layout.
    pub layout: Option<LayoutPart>,
}

struct Writer<'m> {
    out: String,
    next_id: u32,
    rels: Vec<RelKind>,
    media: &'m mut Media,
    lang: &'m str,
    /// Efeitos herdados do nó sendo emitido (opacidade, rotações, translação).
    fx: crate::layout::Effects,
    /// Sombra da próxima forma "principal" do nó (consumida pelo sp).
    shadow: Option<crate::model::Shadow>,
    fonts: &'m crate::text::Fonts,
}

impl Writer<'_> {
    /// Cor com a opacidade herdada (o PPTX não tem opacidade de grupo).
    fn solid(&self, c: Rgba) -> String {
        solid_raw(c.with_alpha(self.fx.opacity))
    }

    fn line_xml(&self, stroke: Option<Stroke>, head: Option<&str>, tail: Option<&str>) -> String {
        line_raw(stroke.map(|s| Stroke { color: s.color.with_alpha(self.fx.opacity), ..s }), head, tail)
    }

    /// Posição com a translação acumulada e as rotações dos ancestrais: o PPTX gira cada forma
    /// em torno do próprio centro, então o centro gira em torno de cada pivô (emit/paint.ts).
    fn xfrm(&self, f: Frame, flip_h: bool, flip_v: bool) -> String {
        let (mut cx, mut cy) = (f.x + f.w / 2.0 + self.fx.shift.0, f.y + f.h / 2.0 + self.fx.shift.1);
        let mut total = 0.0;
        for &(px, py, deg) in &self.fx.rotations {
            let (sin, cos) = deg.to_radians().sin_cos();
            let (dx, dy) = (cx - px, cy - py);
            cx = px + dx * cos - dy * sin;
            cy = py + dx * sin + dy * cos;
            total += deg;
        }
        xfrm_raw(Frame { x: cx - f.w / 2.0, y: cy - f.h / 2.0, w: f.w, h: f.h }, flip_h, flip_v, total)
    }

    fn effect_list(&mut self) -> String {
        let Some(s) = self.shadow.take() else { return String::new() };
        let dist = s.x.hypot(s.y);
        // Ângulo em graus inteiros, como o pptxgenjs grava.
        let dir = (((s.y.atan2(s.x).to_degrees() + 360.0) % 360.0).round() * 60000.0) as i64;
        let c = s.color.with_alpha(self.fx.opacity);
        format!(
            "<a:effectLst><a:outerShdw blurRad=\"{}\" dist=\"{}\" dir=\"{dir}\" algn=\"bl\" rotWithShape=\"0\"><a:srgbClr val=\"{}\"><a:alpha val=\"{}\"/></a:srgbClr></a:outerShdw></a:effectLst>",
            emu(s.blur),
            emu(dist),
            c.hex(),
            (c.a * 100000.0).round() as i64
        )
    }

    fn id(&mut self) -> u32 {
        self.next_id += 1;
        self.next_id
    }

    fn rel(&mut self, kind: RelKind) -> String {
        if let RelKind::Hyperlink(url) = &kind
            && let Some(i) = self.rels.iter().position(|r| matches!(r, RelKind::Hyperlink(u) if u == url)) {
                return format!("rId{}", i + 2);
            }
        self.rels.push(kind);
        format!("rId{}", self.rels.len() + 1)
    }
}

fn solid_raw(c: Rgba) -> String {
    if c.a >= 0.999 {
        return format!("<a:solidFill><a:srgbClr val=\"{}\"/></a:solidFill>", c.hex());
    }
    format!("<a:solidFill><a:srgbClr val=\"{}\"><a:alpha val=\"{}\"/></a:srgbClr></a:solidFill>", c.hex(), (c.a * 100000.0).round() as i64)
}

fn line_raw(stroke: Option<Stroke>, head: Option<&str>, tail: Option<&str>) -> String {
    let Some(s) = stroke else { return "<a:ln><a:noFill/></a:ln>".into() };
    let dash = match s.dash {
        Dash::Solid => "solid",
        Dash::Dashed => "dash",
        Dash::Dotted => "sysDot",
    };
    let mut out = format!("<a:ln w=\"{}\">{}<a:prstDash val=\"{dash}\"/>", emu(s.width), solid_raw(s.color));
    if let Some(h) = head {
        let _ = write!(out, "<a:headEnd type=\"{h}\" w=\"med\" len=\"med\"/>");
    }
    if let Some(t) = tail {
        let _ = write!(out, "<a:tailEnd type=\"{t}\" w=\"med\" len=\"med\"/>");
    }
    out.push_str("</a:ln>");
    out
}

fn xfrm_raw(f: Frame, flip_h: bool, flip_v: bool, rot: f32) -> String {
    let turn = ((rot % 360.0) + 360.0) % 360.0;
    let rot_attr = if turn.abs() < 1e-3 { String::new() } else { format!(" rot=\"{}\"", (turn * 60000.0).round() as i64) };
    let flip = format!("{rot_attr}{}{}", if flip_h { " flipH=\"1\"" } else { "" }, if flip_v { " flipV=\"1\"" } else { "" });
    format!(
        "<a:xfrm{flip}><a:off x=\"{}\" y=\"{}\"/><a:ext cx=\"{}\" cy=\"{}\"/></a:xfrm>",
        emu(f.x),
        emu(f.y),
        emu(f.w.max(0.0)),
        emu(f.h.max(0.0))
    )
}

fn geom(prst: &str, adj: &[(&str, i64)]) -> String {
    let gd: String = adj.iter().map(|(n, v)| format!("<a:gd name=\"{n}\" fmla=\"val {v}\"/>")).collect();
    format!("<a:prstGeom prst=\"{prst}\"><a:avLst>{gd}</a:avLst></a:prstGeom>")
}

/// Raio CSS → ajuste do roundRect (relativo ao menor lado, como o pptsx).
fn round_adj(radius: f32, f: Frame) -> i64 {
    let min = f.w.min(f.h);
    if min <= 0.0 {
        return 0;
    }
    ((radius / min) * 100000.0).round().clamp(0.0, 50000.0) as i64
}

fn inset_frame(f: Frame, d: f32) -> Frame {
    Frame { x: f.x + d, y: f.y + d, w: (f.w - 2.0 * d).max(0.0), h: (f.h - 2.0 * d).max(0.0) }
}

impl Writer<'_> {
    #[allow(clippy::too_many_arguments)]
    fn sp(&mut self, name: &str, frame: Frame, geometry: &str, fill: Option<Rgba>, ln: String, flips: (bool, bool), body: Option<String>, link: Option<&str>) {
        let id = self.id();
        let click = link.map(|url| {
            let rid = self.rel(RelKind::Hyperlink(url.to_string()));
            format!("<a:hlinkClick r:id=\"{rid}\"/>")
        });
        let fill = fill.map_or_else(|| "<a:noFill/>".to_string(), |c| self.solid(c));
        let effects = self.effect_list();
        let _ = write!(
            self.out,
            "<p:sp><p:nvSpPr><p:cNvPr id=\"{id}\" name=\"{} {id}\">{}</p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>{}{geometry}{fill}{ln}{effects}</p:spPr>",
            esc(name),
            click.unwrap_or_default(),
            self.xfrm(frame, flips.0, flips.1)
        );
        if let Some(b) = body {
            self.out.push_str(&b);
        }
        self.out.push_str("</p:sp>");
    }

    /// Fundo + borda de uma caixa. Borda uniforme = contorno da forma (inset pela metade da
    /// espessura, porque a linha do PPTX é centrada na borda); lados diferentes = uma linha por lado.
    fn decoration(&mut self, p: &Placed, paint: &Paint) {
        let f = p.frame;
        if let Some((path, natural)) = &paint.background_image {
            // Imagem de fundo (cover) entre o fundo e as bordas: fundo primeiro, se houver.
            if paint.fill.is_some() || paint.shadow.is_some() {
                let only_fill = Paint { borders: [None; 4], background_image: None, ..paint.clone() };
                self.decoration(p, &only_fill);
            }
            self.picture(f, path, *natural, true, None);
            let only_borders = Paint { fill: None, shadow: None, background_image: None, ..paint.clone() };
            if only_borders.has_border() {
                self.decoration(p, &only_borders);
            }
            return;
        }
        let uniform = paint.uniform_border();
        let has_any = paint.has_border();
        // Sombra sem fundo ainda desenha (a forma existe só para levar a sombra), como no pptsx.
        if paint.fill.is_none() && !has_any && paint.shadow.is_none() {
            return;
        }
        self.shadow = paint.shadow;
        let shape_of = |frame: Frame, radius: f32| if radius > 0.0 { geom("roundRect", &[("adj", round_adj(radius, frame))]) } else { geom("rect", &[]) };
        match uniform {
            Some(s) => {
                let frame = inset_frame(f, s.width / 2.0);
                let radius = (paint.radius - s.width / 2.0).max(0.0);
                self.sp("Box", frame, &shape_of(frame, radius), paint.fill, self.line_xml(Some(s), None, None), (false, false), None, p.node.href.as_deref());
            }
            None => {
                if paint.fill.is_some() {
                    self.sp("Box", f, &shape_of(f, paint.radius), paint.fill, self.line_xml(None, None, None), (false, false), None, p.node.href.as_deref());
                }
                for (i, side) in paint.borders.iter().enumerate() {
                    let Some(s) = side else { continue };
                    let h = s.width / 2.0;
                    let line = match i {
                        0 => Frame { x: f.x, y: f.y + h, w: f.w, h: 0.0 },
                        1 => Frame { x: f.right() - h, y: f.y, w: 0.0, h: f.h },
                        2 => Frame { x: f.x, y: f.bottom() - h, w: f.w, h: 0.0 },
                        _ => Frame { x: f.x + h, y: f.y, w: 0.0, h: f.h },
                    };
                    self.sp("Border", line, &geom("line", &[]), None, self.line_xml(Some(*s), None, None), (false, false), None, None);
                }
            }
        }
    }

    fn shape(&mut self, p: &Placed, spec: &ShapeSpec, paint: &Paint) {
        let f = p.frame;
        self.shadow = paint.shadow;
        let adj: Vec<(&str, i64)> = match (spec.radius, spec.pill) {
            (Some(r), _) => vec![("adj", round_adj(r, f))],
            _ => spec.adj.clone(),
        };
        let stroke = paint.borders[0];
        self.sp(
            "Shape",
            f,
            &geom(spec.prst, &adj),
            if spec.line { None } else { paint.fill },
            self.line_xml(stroke, spec.head.as_deref(), spec.tail.as_deref()),
            (spec.flip_h, spec.flip_v),
            None,
            p.node.href.as_deref(),
        );
    }

    fn text_body(&mut self, t: &TextOut, spec: &crate::model::TextSpec, slide_number: bool) -> String {
        let algn = match spec.align {
            Align::Left => "l",
            Align::Center => "ctr",
            Align::Right => "r",
        };
        let size = (t.size * 100.0).round() as i64;
        // Shrink: os corpos próprios (Span fontSize) encolhem na mesma proporção do Text.
        let ratio = t.size / spec.size.max(1e-3);
        let mut out = String::from("<p:txBody><a:bodyPr wrap=\"square\" lIns=\"0\" tIns=\"0\" rIns=\"0\" bIns=\"0\" rtlCol=\"0\" anchor=\"t\"><a:noAutofit/></a:bodyPr><a:lstStyle/>");
        // M13-7 (forced): linhas de alturas diferentes viram um parágrafo cada, com o próprio
        // spcPts (o PPTX só tem espaçamento por parágrafo).
        let paragraphs: Vec<(Vec<crate::text::Pieces>, f32)> = if self.fonts.options.auto_breaks && !slide_number {
            auto_paragraphs(t, spec)
        } else {
            match &t.laid.line_heights {
                Some(heights) => t.laid.paragraphs.iter().flatten().zip(heights).map(|(line, h)| (vec![line.clone()], *h)).collect(),
                None => t.laid.paragraphs.iter().map(|lines| (lines.clone(), t.laid.line.height)).collect(),
            }
        };
        for (lines, height) in paragraphs {
            let spacing = (height * 100.0).round() as i64;
            let _ = write!(out, "<a:p><a:pPr algn=\"{algn}\" indent=\"0\" marL=\"0\"><a:lnSpc><a:spcPts val=\"{spacing}\"/></a:lnSpc><a:buNone/></a:pPr>");
            for (li, line) in lines.iter().enumerate() {
                if li > 0 {
                    let _ = write!(out, "<a:br><a:rPr lang=\"{}\" sz=\"{size}\" dirty=\"0\"/></a:br>", self.lang);
                }
                for piece in line.iter() {
                    let run = &spec.runs[piece.run];
                    let run_size = run.size.map_or(size, |s| (s * ratio * 100.0).round() as i64);
                    let mut attrs = format!("lang=\"{}\" sz=\"{run_size}\"", self.lang);
                    let (face_name, bold) = t.faces.get(piece.run).cloned().unwrap_or((None, run.weight >= 600));
                    if bold {
                        attrs.push_str(" b=\"1\"");
                    }
                    if run.italic {
                        attrs.push_str(" i=\"1\"");
                    }
                    if run.underline {
                        attrs.push_str(" u=\"sng\"");
                    }
                    if run.strike {
                        attrs.push_str(" strike=\"sngStrike\"");
                    }
                    if let Some(b) = run.baseline {
                        let _ = write!(attrs, " baseline=\"{b}\"");
                    }
                    if spec.letter_spacing != 0.0 {
                        let _ = write!(attrs, " spc=\"{}\"", (spec.letter_spacing * 100.0).round() as i64);
                    }
                    let link = run.href.as_ref().map(|url| {
                        let rid = self.rel(RelKind::Hyperlink(url.clone()));
                        format!("<a:hlinkClick r:id=\"{rid}\"/>")
                    });
                    // Peso fora de 400/700: o nome da própria face (ex.: "Inter SemiBold"), como no pptsx.
                    let typeface = esc(face_name.as_deref().or(run.family.as_deref()).unwrap_or(&spec.family));
                    let rpr = format!(
                        "<a:rPr {attrs} dirty=\"0\">{}<a:latin typeface=\"{typeface}\"/><a:ea typeface=\"{typeface}\"/><a:cs typeface=\"{typeface}\"/>{}</a:rPr>",
                        self.solid(run.color),
                        link.unwrap_or_default()
                    );
                    // SlideNumber: o número é o campo slidenum do PPTX (se atualiza ao reordenar).
                    let digits: String = piece.text.chars().take_while(char::is_ascii_digit).collect();
                    let rest = if slide_number && !digits.is_empty() {
                        let _ = write!(out, "<a:fld id=\"{{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}}\" type=\"slidenum\">{rpr}<a:t>{digits}</a:t></a:fld>");
                        &piece.text[digits.len()..]
                    } else {
                        piece.text.as_str()
                    };
                    if !rest.is_empty() {
                        let _ = write!(out, "<a:r>{rpr}<a:t>{}</a:t></a:r>", esc(rest));
                    }
                }
            }
            let _ = write!(out, "<a:endParaRPr lang=\"{}\" sz=\"{size}\" dirty=\"0\"/></a:p>", self.lang);
        }
        out.push_str("</p:txBody>");
        out
    }

    /// Como o pptsx: fundo e bordas são formas próprias; a caixa de texto ocupa só a área de
    /// conteúdo (dentro de padding e borda), sem insets.
    fn text(&mut self, p: &Placed, t: &TextOut, spec: &crate::model::TextSpec, paint: &Paint) {
        self.decoration(p, paint);
        let [top, right, bottom, left] = p.inset;
        let f = p.frame;
        let content = Frame { x: f.x + left, y: f.y + top, w: (f.w - left - right).max(0.0), h: (f.h - top - bottom).max(0.0) };
        if let (Some((num_w, rest_w)), Some(run)) = (t.split, spec.runs.first()) {
            // Campo slidenum numa caixa e " / total" noutra, lado a lado (emit/slide-number.ts).
            let digits: String = run.text.chars().take_while(char::is_ascii_digit).collect();
            for (text, x, w) in [(digits.clone(), content.x, num_w), (run.text[digits.len()..].to_string(), content.x + num_w, rest_w)] {
                let part = crate::model::TextSpec { runs: vec![crate::model::StyledRun { text: text.clone(), ..run.clone() }], ..spec.clone() };
                let laid = crate::text::Laid {
                    paragraphs: vec![vec![vec![crate::text::Piece { text, run: 0 }]]],
                    line_heights: None,
                    width: w,
                    height: t.laid.height,
                    line: t.laid.line,
                    widest_segment: w,
                    truncated: false,
                    word_broken: false,
                };
                let out = TextOut { laid, size: t.size, split: None, faces: t.faces.clone(), missing: t.missing };
                let body = self.text_body(&out, &part, true).replace("wrap=\"square\"", "wrap=\"none\"");
                self.sp("Text", Frame { x, y: content.y, w, h: content.h }, &geom("rect", &[]), None, self.line_xml(None, None, None), (false, false), Some(body), None);
            }
            return;
        }
        let body = self.text_body(t, spec, p.node.slide_number.is_some());
        self.sp("Text", content, &geom("rect", &[]), None, self.line_xml(None, None, None), (false, false), Some(body), p.node.href.as_deref());
    }

    fn custom(&mut self, frame: Frame, geometry: &str, path: &crate::vector::VectorPath, width: f64, dash: Dash, link: Option<&str>) {
        let ln = match path.stroke {
            Some(color) => {
                let d = match dash {
                    Dash::Solid => "solid",
                    Dash::Dashed => "dash",
                    Dash::Dotted => "sysDot",
                };
                let cap = path.cap.map(|c| format!(" cap=\"{c}\"")).unwrap_or_default();
                let join = match path.join {
                    Some("round") => "<a:round/>",
                    Some("bevel") => "<a:bevel/>",
                    Some(_) => "<a:miter lim=\"800000\"/>",
                    None => "",
                };
                format!("<a:ln w=\"{}\"{cap}>{}<a:prstDash val=\"{d}\"/>{join}</a:ln>", emu(width as f32), self.solid(color))
            }
            None => "<a:ln><a:noFill/></a:ln>".into(),
        };
        self.sp("Path", frame, geometry, path.fill, ln, (false, false), None, link);
    }

    fn vector_path(&mut self, p: &Placed, spec: &crate::model::PathSpec) {
        if spec.path.cmds.is_empty() {
            return;
        }
        let f = p.frame;
        let frame = (f64::from(f.x), f64::from(f.y), f64::from(f.w), f64::from(f.h));
        let t = crate::vector::view_transform(spec.view_box, frame, false);
        let geometry = crate::vector::cust_geom(&spec.path.cmds, t, frame);
        self.shadow = p.node.paint.shadow;
        self.custom(f, &geometry, &spec.path, spec.path.stroke_width, spec.dash, p.node.href.as_deref());
    }

    fn icon(&mut self, p: &Placed, spec: &crate::model::IconSpec) {
        self.icon_at(&spec.icon, p.frame, p.node.href.as_deref());
    }

    fn icon_at(&mut self, icon: &crate::vector::Icon, f: Frame, link: Option<&str>) {
        let frame = (f64::from(f.x), f64::from(f.y), f64::from(f.w), f64::from(f.h));
        let vb = icon.view_box;
        let t = crate::vector::view_transform(vb, frame, true);
        match &icon.content {
            crate::vector::IconContent::Vector(paths) => {
                for path in paths {
                    let geometry = crate::vector::cust_geom(&path.cmds, t, frame);
                    self.custom(f, &geometry, path, path.stroke_width * t.sx, Dash::Solid, link);
                }
            }
            crate::vector::IconContent::Raster { svg, .. } => {
                // Retângulo que o desenho ocupa (xMidYMid meet); PNG a 2× a largura final.
                let drawn = Frame { x: (vb.x * t.sx + t.dx) as f32, y: (vb.y * t.sy + t.dy) as f32, w: (vb.w * t.sx) as f32, h: (vb.h * t.sy) as f32 };
                let px = (drawn.w * 96.0 / 72.0 * 2.0).round().max(1.0) as u32;
                let Some(png) = crate::vector::rasterize(svg, px) else { return };
                let name = self.media.add_bytes(&format!("{px}:{svg}"), png, "png");
                let rid = self.rel(RelKind::Image(name));
                let id = self.id();
                let _ = write!(
                    self.out,
                    "<p:pic><p:nvPicPr><p:cNvPr id=\"{id}\" name=\"Icon {id}\"/><p:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed=\"{rid}\"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>{}<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></p:spPr></p:pic>",
                    self.xfrm(drawn, false, false)
                );
            }
        }
    }

    /// Reta = `line` (o PPTX desenha da quina sup. esq. à inf. dir.; flips dão a direção);
    /// cotovelo = custGeom aberto, sem fill (emit/connector.ts).
    fn connector(&mut self, c: &crate::layout::Routed) {
        let xs = c.points.iter().map(|p| p.0);
        let ys = c.points.iter().map(|p| p.1);
        let (x0, y0) = (xs.clone().fold(f32::INFINITY, f32::min), ys.clone().fold(f32::INFINITY, f32::min));
        let frame = Frame { x: x0, y: y0, w: xs.fold(f32::NEG_INFINITY, f32::max) - x0, h: ys.fold(f32::NEG_INFINITY, f32::max) - y0 };
        let ln = self.line_xml(Some(c.spec.stroke), c.spec.start_arrow.as_deref(), c.spec.end_arrow.as_deref());
        if c.points.len() == 2 {
            let (a, b) = (c.points[0], c.points[1]);
            self.sp("Connector", frame, &geom("line", &[]), None, ln, (b.0 < a.0, b.1 < a.1), None, None);
        } else {
            let cmds: Vec<crate::vector::Cmd> = c
                .points
                .iter()
                .enumerate()
                .map(|(i, p)| if i == 0 { crate::vector::Cmd::M(f64::from(p.0), f64::from(p.1)) } else { crate::vector::Cmd::L(f64::from(p.0), f64::from(p.1)) })
                .collect();
            let f = (f64::from(frame.x), f64::from(frame.y), f64::from(frame.w), f64::from(frame.h));
            let geometry = crate::vector::cust_geom(&cmds, crate::vector::Transform { sx: 1.0, sy: 1.0, dx: 0.0, dy: 0.0 }, f);
            self.sp("Connector", frame, &geometry, None, ln, (false, false), None, None);
        }
        if let (Some((text_frame, out)), Some(spec)) = (&c.label, &c.spec.label) {
            if let Some(bg) = c.spec.label_background {
                let pad = 3.0;
                let f = Frame { x: text_frame.x - pad, y: text_frame.y - pad, w: text_frame.w + 2.0 * pad, h: text_frame.h + 2.0 * pad };
                self.sp("Label", f, &geom("rect", &[]), Some(bg), self.line_xml(None, None, None), (false, false), None, None);
            }
            let body = self.text_body(out, spec, false);
            self.sp("Label", *text_frame, &geom("rect", &[]), None, self.line_xml(None, None, None), (false, false), Some(body), None);
        }
    }

    fn image(&mut self, p: &Placed, img: &crate::model::ImageSpec) {
        self.shadow = p.node.paint.shadow;
        self.picture(p.frame, &img.path, img.natural, img.cover, p.node.href.clone());
    }

    fn picture(&mut self, f: Frame, path: &std::path::Path, natural: (f32, f32), cover: bool, href: Option<String>) {
        let (iw, ih) = natural;
        if iw <= 0.0 || ih <= 0.0 || f.w <= 0.0 || f.h <= 0.0 {
            return;
        }
        // contain/cover pelo srcRect (negativo = margem, positivo = corte), como o pptsx.
        let scale = if cover { (f.w / iw).max(f.h / ih) } else { (f.w / iw).min(f.h / ih) };
        let (dw, dh) = (iw * scale, ih * scale);
        let lr = ((1.0 - f.w / dw) / 2.0 * 100000.0).round() as i64;
        let tb = ((1.0 - f.h / dh) / 2.0 * 100000.0).round() as i64;
        let name = self.media.add(&path.to_path_buf());
        let rid = self.rel(RelKind::Image(name));
        let id = self.id();
        // Opacidade herdada na imagem: alphaModFix (o PPTX não tem opacidade de grupo).
        let alpha = if self.fx.opacity < 0.999 { format!("<a:alphaModFix amt=\"{}\"/>", (self.fx.opacity * 100000.0).round() as i64) } else { String::new() };
        let effects = self.effect_list();
        let descr = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let click = href.map(|url| {
            let rid = self.rel(RelKind::Hyperlink(url));
            format!("<a:hlinkClick r:id=\"{rid}\"/>")
        });
        let _ = write!(
            self.out,
            "<p:pic><p:nvPicPr><p:cNvPr id=\"{id}\" name=\"Image {id}\" descr=\"{}\">{}</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed=\"{rid}\">{alpha}</a:blip><a:srcRect l=\"{lr}\" t=\"{tb}\" r=\"{lr}\" b=\"{tb}\"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>{}<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom>{effects}</p:spPr></p:pic>",
            esc(&descr),
            click.unwrap_or_default(),
            self.xfrm(f, false, false)
        );
    }
}

/// M15: placeholder do layout (`<p:ph>`), com frame e estilo do 1º slide que usa o layout.
pub struct PhSpec {
    pub name: String,
    pub ty: &'static str,
    /// Ausente no título (o PowerPoint casa o título pelo tipo).
    pub idx: Option<usize>,
    pub frame: Frame,
    pub text: Option<PhText>,
}

pub struct PhText {
    pub family: String,
    pub size: f32,
    pub color: Rgba,
    pub bold: bool,
    pub italic: bool,
    pub align: Align,
}

/// O que o 1º slide de um layout manda para o slideLayout: conteúdo fixo (com os próprios rels,
/// a partir de rId2) e os placeholders.
pub struct LayoutPart {
    /// `<p:bg>` do layout (cor ou imagem), ou vazio.
    pub background: String,
    pub drawings: String,
    pub rels: Vec<RelKind>,
    pub placeholders: Vec<PhSpec>,
}

/// DEFAULTS.placeholder: nome do autor → tipo do PowerPoint; os outros viram body.
pub fn placeholder_type(name: &str) -> &'static str {
    match name {
        "title" => "title",
        "subtitle" => "subTitle",
        "body" => "body",
        "footer" => "ftr",
        "pictures" => "pic",
        _ => "body",
    }
}

/// Texto de exemplo do placeholder vazio ("Novo slide" no PowerPoint).
pub fn placeholder_prompt(name: &str) -> &str {
    match name {
        "title" => "Título",
        "subtitle" => "Subtítulo",
        "body" => "Conteúdo",
        "footer" => "Rodapé",
        "pictures" => "Imagem",
        other => other,
    }
}

const PLACEHOLDER_FIRST_INDEX: usize = 10;
/// Ids dos shapes do layout, longe dos do slide.
const LAYOUT_FIRST_SHAPE_ID: u32 = 1000;

fn ph_spec(layout: &crate::model::LayoutSpec, name: &str) -> (&'static str, Option<usize>) {
    let ty = placeholder_type(name);
    let index = layout.placeholders.iter().position(|p| p == name).unwrap_or(0);
    (ty, (ty != "title").then_some(PLACEHOLDER_FIRST_INDEX + index))
}

pub fn ph_xml(ty: &str, idx: Option<usize>) -> String {
    match idx {
        Some(i) => format!("<p:ph type=\"{ty}\" idx=\"{i}\"/>"),
        None => format!("<p:ph type=\"{ty}\"/>"),
    }
}

/// O último `<p:sp>`/`<p:pic>` emitido para o nó vira o placeholder: nome do prompt, sem agrupar,
/// `<p:ph>`; xfrm e estilo do slide ficam. Negrito/itálico explícitos em cada run, porque o run
/// herdaria do estilo do placeholder (emit/layouts.ts linkPlaceholder).
fn link_placeholder(segment: &str, name: &str, ty: &str, idx: Option<usize>) -> Option<String> {
    let at = segment.rfind("<p:sp>").into_iter().chain(segment.rfind("<p:pic>")).max()?;
    let (before, element) = segment.split_at(at);
    let mut el = element.to_string();
    if let Some(n) = el.find(" name=\"") {
        let from = n + 7;
        let to = from + el[from..].find('"')?;
        el.replace_range(from..to, &esc(placeholder_prompt(name)));
    }
    el = el.replacen("<p:cNvSpPr/>", "<p:cNvSpPr><a:spLocks noGrp=\"1\"/></p:cNvSpPr>", 1);
    el = el.replacen("<p:nvPr/>", &format!("<p:nvPr>{}</p:nvPr>", ph_xml(ty, idx)), 1);
    static RPR_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"<a:rPr\b([^>]*?)(/?)>").expect("regex fixa"));
    let el = RPR_RE.replace_all(&el, |c: &regex::Captures| {
        let attrs = &c[1];
        let b = if attrs.contains(" b=\"") { "" } else { " b=\"0\"" };
        let i = if attrs.contains(" i=\"") { "" } else { " i=\"0\"" };
        format!("<a:rPr{attrs}{b}{i}{}>", &c[2])
    });
    Some(format!("{before}{el}"))
}

fn ph_text(p: &Placed) -> Option<PhText> {
    let (NodeKind::Text(spec), Some(t)) = (&p.node.kind, &p.text) else { return None };
    let run = spec.runs.first();
    let family = t.faces.first().and_then(|(face, _)| face.clone()).unwrap_or_else(|| spec.family.clone());
    Some(PhText {
        family,
        size: t.size,
        color: run.map_or(Rgba { r: 0, g: 0, b: 0, a: 1.0 }, |r| r.color),
        bold: run.is_some_and(|r| r.weight >= 700),
        italic: run.is_some_and(|r| r.italic),
        align: spec.align,
    })
}

fn emit_placed(w: &mut Writer, p: &Placed) {
    match &p.node.kind {
        NodeKind::Container => w.decoration(p, &p.node.paint),
        NodeKind::Shape(spec) => w.shape(p, spec, &p.node.paint),
        NodeKind::Text(spec) => {
            if let Some(t) = &p.text {
                w.text(p, t, spec, &p.node.paint);
            }
        }
        NodeKind::Image(img) => {
            w.decoration(p, &Paint { shadow: None, ..p.node.paint.clone() });
            w.image(p, img);
        }
        NodeKind::Path(spec) => {
            w.decoration(p, &Paint { shadow: None, ..p.node.paint.clone() });
            w.vector_path(p, spec);
        }
        NodeKind::Icon(spec) => {
            w.decoration(p, &Paint { shadow: None, ..p.node.paint.clone() });
            w.icon(p, spec);
        }
        NodeKind::Table(spec) => {
            w.decoration(p, &p.node.paint);
            if let Some(t) = &p.table {
                let id = w.id();
                let f = p.frame;
                let [top, _, _, left] = p.inset;
                let frame = (f.x + left, f.y + top, t.widths.iter().sum(), t.height());
                w.out.push_str(&crate::objects::table_xml(spec, t, id, frame, w.lang, w.fonts));
                // Ícones das células por cima da tabela (o PPTX não põe forma dentro de célula).
                for (icon, (ix, iy, iw, ih)) in crate::objects::cell_icons(spec, t, frame.0, frame.1) {
                    w.icon_at(&icon, Frame { x: ix, y: iy, w: iw, h: ih }, None);
                }
            }
        }
        NodeKind::Chart(spec) => {
            w.decoration(p, &p.node.paint);
            let f = p.frame;
            let [top, right, bottom, left] = p.inset;
            if f.w - left - right > 0.0 && f.h - top - bottom > 0.0 {
                w.media.charts.push((crate::objects::chart_xml(spec, w.lang), crate::objects::chart_workbook(spec)));
                let n = w.media.charts.len();
                let rid = w.rel(RelKind::Chart(n));
                let id = w.id();
                w.out.push_str(&crate::objects::chart_frame_xml(id, &rid, (f.x + left, f.y + top, f.w - left - right, f.h - top - bottom)));
            }
        }
    }
}

/// lineBreaks "auto" (emit/runs.ts authorParagraphsOf): os parágrafos do autor, cada um numa linha
/// só (o renderizador quebra), com os espaços normalizados como o medidor. Truncado usa as linhas
/// calculadas unidas (a reticência fica). Linhas de alturas diferentes: a maior do parágrafo.
fn auto_paragraphs(t: &TextOut, spec: &crate::model::TextSpec) -> Vec<(Vec<crate::text::Pieces>, f32)> {
    use crate::text::Piece;
    let merge = |pieces: Vec<Piece>| -> crate::text::Pieces {
        let mut out: Vec<Piece> = Vec::new();
        for p in pieces {
            match out.last_mut() {
                Some(last) if last.run == p.run => last.text.push_str(&p.text),
                _ => out.push(p),
            }
        }
        out
    };
    let texts: Vec<Vec<Piece>> = if t.laid.truncated {
        t.laid
            .paragraphs
            .iter()
            .map(|lines| {
                let mut joined: Vec<Piece> = Vec::new();
                for (i, line) in lines.iter().enumerate() {
                    if i > 0 {
                        let so_far: String = joined.iter().map(|p| p.text.as_str()).collect();
                        if !(so_far.ends_with('-') || so_far.ends_with('/'))
                            && let Some(last) = joined.last_mut() {
                                last.text.push(' ');
                            }
                    }
                    joined.extend(line.iter().cloned());
                }
                joined
            })
            .collect()
    } else {
        let mut paras: Vec<Vec<Piece>> = vec![Vec::new()];
        for (i, run) in spec.runs.iter().enumerate() {
            for (k, piece) in run.text.split('\n').enumerate() {
                if k > 0 {
                    paras.push(Vec::new());
                }
                paras.last_mut().expect("parágrafo").push(Piece { text: piece.to_string(), run: i });
            }
        }
        paras
            .into_iter()
            .map(|pieces| {
                let mut out: Vec<Piece> = Vec::new();
                let mut open = true;
                for p in pieces {
                    let collapsed: String = {
                        let mut s = String::new();
                        let mut in_ws = false;
                        for ch in p.text.chars() {
                            if ch.is_whitespace() && ch != ' ' && ch != '\u{a0}' {
                                if !in_ws {
                                    s.push(' ');
                                }
                                in_ws = true;
                            } else {
                                s.push(ch);
                                in_ws = false;
                            }
                        }
                        s
                    };
                    let text = if open { collapsed.strip_prefix(' ').map(str::to_string).unwrap_or(collapsed) } else { collapsed };
                    if text.is_empty() {
                        continue;
                    }
                    open = text.ends_with(' ');
                    out.push(Piece { text, run: p.run });
                }
                if let Some(last) = out.last_mut()
                    && last.text.ends_with(' ') {
                        last.text.pop();
                        if last.text.is_empty() {
                            out.pop();
                        }
                    }
                out
            })
            .collect()
    };
    let heights: Vec<f32> = match &t.laid.line_heights {
        Some(h) => {
            let mut start = 0;
            t.laid
                .paragraphs
                .iter()
                .map(|lines| {
                    let end = start + lines.len();
                    let m = h[start.min(h.len())..end.min(h.len())].iter().copied().fold(0.0, f32::max);
                    start = end;
                    m
                })
                .collect()
        }
        None => Vec::new(),
    };
    texts.into_iter().enumerate().map(|(i, p)| (vec![merge(p)], heights.get(i).copied().unwrap_or(t.laid.line.height))).collect()
}

pub fn slide_xml(slide: &SlideSpec, layout: &SlideLayout, media: &mut Media, lang: &str, fonts: &crate::text::Fonts, first_of_layout: bool) -> SlideXml {
    let mut w = Writer { out: String::new(), next_id: 1, rels: Vec::new(), media, lang, fx: crate::layout::Effects { opacity: 1.0, ..Default::default() }, shadow: None, fonts };
    let mut fixed: Vec<&Placed> = Vec::new();
    for p in &layout.placed {
        // O próprio slide (raiz) só tem fundo, emitido em <p:bg>.
        if std::ptr::eq(p.node, &slide.root) {
            continue;
        }
        // M15: conteúdo fixo sai só no slideLayout (a partir do 1º slide do layout).
        if p.node.fixed {
            fixed.push(p);
            continue;
        }
        w.fx = p.effects.clone();
        let start = w.out.len();
        emit_placed(&mut w, p);
        let (Some(name), Some(spec)) = (&p.node.placeholder, &slide.layout) else { continue };
        if !matches!(p.node.kind, NodeKind::Text(_) | NodeKind::Image(_)) {
            continue;
        }
        let (ty, idx) = ph_spec(spec, name);
        if let Some(linked) = link_placeholder(&w.out[start..], name, ty, idx) {
            w.out.truncate(start);
            w.out.push_str(&linked);
        }
    }
    let part = match (&slide.layout, first_of_layout) {
        (Some(spec), true) => Some(layout_part(spec, layout, &fixed, w.media, lang, fonts)),
        _ => None,
    };
    // Conectores ligam frames já posicionados: sem os efeitos do último nó.
    w.fx = crate::layout::Effects { opacity: 1.0, ..Default::default() };
    for c in &layout.connectors {
        w.connector(c);
    }
    let bg = match &slide.background_image {
        Some((path, _)) => {
            let name = w.media.add(path);
            let rid = w.rel(RelKind::Image(name));
            format!("<p:bg><p:bgPr><a:blipFill dpi=\"0\" rotWithShape=\"1\"><a:blip r:embed=\"{rid}\"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>")
        }
        None => slide.background.map(|c| format!("<p:bg><p:bgPr>{}<a:effectLst/></p:bgPr></p:bg>", solid_raw(c))).unwrap_or_default(),
    };
    let show = if slide.hidden { " show=\"0\"" } else { "" };
    let xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"{show}><p:cSld>{bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>{}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>",
        w.out
    );
    SlideXml { xml, rels: w.rels, layout: part }
}

fn layout_part(spec: &crate::model::LayoutSpec, layout: &SlideLayout, fixed: &[&Placed], media: &mut Media, lang: &str, fonts: &crate::text::Fonts) -> LayoutPart {
    let mut w = Writer { out: String::new(), next_id: LAYOUT_FIRST_SHAPE_ID - 1, rels: Vec::new(), media, lang, fx: crate::layout::Effects { opacity: 1.0, ..Default::default() }, shadow: None, fonts };
    for p in fixed {
        w.fx = p.effects.clone();
        emit_placed(&mut w, p);
    }
    let placeholders = spec
        .placeholders
        .iter()
        .filter_map(|name| {
            let p = layout.placed.iter().find(|p| p.node.placeholder.as_deref() == Some(name.as_str()))?;
            let [t, r, b, l] = p.inset;
            let f = p.frame;
            // Texto e imagem na área de conteúdo; Box inteiro (emit/layouts.ts frameOf).
            let frame = if matches!(p.node.kind, NodeKind::Container) { f } else { Frame { x: f.x + l, y: f.y + t, w: (f.w - l - r).max(0.0), h: (f.h - t - b).max(0.0) } };
            let (ty, idx) = ph_spec(spec, name);
            Some(PhSpec { name: name.clone(), ty, idx, frame, text: ph_text(p) })
        })
        .collect();
    let background = match &spec.background {
        Some(crate::model::LayoutBackground::Color(c)) => format!("<p:bg><p:bgPr>{}<a:effectLst/></p:bgPr></p:bg>", solid_raw(*c)),
        Some(crate::model::LayoutBackground::Image(path)) => {
            let name = w.media.add(path);
            let rid = w.rel(RelKind::Image(name));
            format!("<p:bg><p:bgPr><a:blipFill dpi=\"0\" rotWithShape=\"1\"><a:blip r:embed=\"{rid}\"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>")
        }
        None => String::new(),
    };
    LayoutPart { background, drawings: w.out, rels: w.rels, placeholders }
}
