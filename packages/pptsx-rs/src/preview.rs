//! Preview nativo (src/preview do pptsx): SVG de cada slide a partir da árvore posicionada,
//! rasterizado pelo resvg em `slide-NN.png`, mais o `overview.png` com a grade de miniaturas.
//! O texto sai como contorno dos glifos, com as mesmas fontes e o mesmo shaping da medição:
//! o preview não depende de fontes do sistema e desenha as quebras que o PPTX recebe.

use std::fmt::Write as _;
use std::path::Path;

use crate::css::{Dash, Rgba, Stroke};
use crate::layout::{Frame, Placed, SlideLayout};
use crate::model::{Align, NodeKind, Paint, ShapeSpec, SlideSpec, TextSpec};
use crate::objects::{ChartKind, ChartSpec, Slot, TableLayout, TableSpec};
use crate::text::{Fonts, Laid, RunInput};

/// Largura padrão do PNG de cada slide (DEFAULTS.preview.width) e grade do overview.
pub const PREVIEW_WIDTH: u32 = 1280;
const THUMB_WIDTH: f32 = 320.0;
const COLUMNS: usize = 4;
const MARGIN: f32 = 24.0;
const GAP: f32 = 24.0;
const LABEL: f32 = 22.0;

fn color(c: Rgba, opacity: f32) -> String {
    let a = c.a * opacity;
    if a >= 0.999 { format!("fill=\"#{}\"", c.hex()) } else { format!("fill=\"#{}\" fill-opacity=\"{a:.3}\"", c.hex()) }
}

fn stroke_attrs(s: Stroke, opacity: f32) -> String {
    let dash = match s.dash {
        Dash::Solid => String::new(),
        Dash::Dashed => format!(" stroke-dasharray=\"{:.2} {:.2}\"", s.width * 3.0, s.width * 2.0),
        Dash::Dotted => format!(" stroke-dasharray=\"{:.2} {:.2}\"", s.width, s.width),
    };
    let a = s.color.a * opacity;
    format!("stroke=\"#{}\" stroke-opacity=\"{a:.3}\" stroke-width=\"{:.2}\"{dash}", s.color.hex(), s.width)
}

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = u32::from(chunk[0]) << 16 | u32::from(*chunk.get(1).unwrap_or(&0)) << 8 | u32::from(*chunk.get(2).unwrap_or(&0));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

fn data_uri(path: &Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let mime = match path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => "image/png",
    };
    Some(format!("data:{mime};base64,{}", base64(&bytes)))
}

// ───────────── formas ─────────────

fn polygon(points: &[(f32, f32)], f: Frame) -> String {
    let pts: Vec<String> = points.iter().map(|(x, y)| format!("{:.2},{:.2}", f.x + x, f.y + y)).collect();
    format!("<polygon points=\"{}\"", pts.join(" "))
}

/// Geometria aproximada dos presets do PPTX (src/preview/shapes.ts usa os mesmos ajustes).
fn preset(prst: &str, adj: &[(&str, i64)], radius: Option<f32>, f: Frame) -> String {
    let (w, h) = (f.w, f.h);
    let ss = w.min(h);
    let a = |name: &str, default: f32| adj.iter().find(|(n, _)| *n == name).map_or(default, |(_, v)| *v as f32 / 100000.0);
    match prst {
        "ellipse" | "cloud" => format!("<ellipse cx=\"{:.2}\" cy=\"{:.2}\" rx=\"{:.2}\" ry=\"{:.2}\"", f.x + w / 2.0, f.y + h / 2.0, w / 2.0, h / 2.0),
        "roundRect" => {
            let r = radius.unwrap_or(a("adj", 0.16667) * ss).min(ss / 2.0);
            format!("<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" rx=\"{r:.2}\"", f.x, f.y, w, h)
        }
        "triangle" => polygon(&[(w * a("adj", 0.5), 0.0), (w, h), (0.0, h)], f),
        "rtTriangle" => polygon(&[(0.0, 0.0), (w, h), (0.0, h)], f),
        "diamond" => polygon(&[(w / 2.0, 0.0), (w, h / 2.0), (w / 2.0, h), (0.0, h / 2.0)], f),
        "parallelogram" => {
            let o = ss * a("adj", 0.25);
            polygon(&[(o, 0.0), (w, 0.0), (w - o, h), (0.0, h)], f)
        }
        "trapezoid" => {
            let o = ss * a("adj", 0.25);
            polygon(&[(0.0, h), (o, 0.0), (w - o, 0.0), (w, h)], f)
        }
        "pentagon" => polygon(&[(w / 2.0, 0.0), (w, h * 0.38), (w * 0.81, h), (w * 0.19, h), (0.0, h * 0.38)], f),
        "hexagon" => {
            let o = ss * a("adj", 0.25);
            polygon(&[(o, 0.0), (w - o, 0.0), (w, h / 2.0), (w - o, h), (o, h), (0.0, h / 2.0)], f)
        }
        "octagon" => {
            let o = ss * a("adj", 0.29289);
            polygon(&[(o, 0.0), (w - o, 0.0), (w, o), (w, h - o), (w - o, h), (o, h), (0.0, h - o), (0.0, o)], f)
        }
        "chevron" => {
            let o = ss * a("adj", 0.5);
            polygon(&[(0.0, 0.0), (w - o, 0.0), (w, h / 2.0), (w - o, h), (0.0, h), (o, h / 2.0)], f)
        }
        "rightArrow" | "leftArrow" | "leftRightArrow" => {
            let (t, head) = (h * a("adj1", 0.5) / 2.0, ss * a("adj2", 0.5));
            let (y0, y1) = (h / 2.0 - t, h / 2.0 + t);
            let right = [(0.0, y0), (w - head, y0), (w - head, 0.0), (w, h / 2.0), (w - head, h), (w - head, y1), (0.0, y1)];
            match prst {
                "rightArrow" => polygon(&right, f),
                "leftArrow" => polygon(&right.map(|(x, y)| (w - x, y)), f),
                _ => polygon(&[(0.0, h / 2.0), (head, 0.0), (head, y0), (w - head, y0), (w - head, 0.0), (w, h / 2.0), (w - head, h), (w - head, y1), (head, y1), (head, h)], f),
            }
        }
        "upArrow" | "downArrow" => {
            let (t, head) = (w * a("adj1", 0.5) / 2.0, ss * a("adj2", 0.5));
            let (x0, x1) = (w / 2.0 - t, w / 2.0 + t);
            let up = [(x0, h), (x0, head), (0.0, head), (w / 2.0, 0.0), (w, head), (x1, head), (x1, h)];
            if prst == "upArrow" { polygon(&up, f) } else { polygon(&up.map(|(x, y)| (x, h - y)), f) }
        }
        "star5" => {
            let inner = a("adj", 0.19098) / 0.5;
            let pts: Vec<(f32, f32)> = (0..10)
                .map(|i| {
                    let r = if i % 2 == 0 { 1.0 } else { inner };
                    let t = std::f32::consts::PI * (i as f32 / 5.0) - std::f32::consts::FRAC_PI_2;
                    (w / 2.0 + w / 2.0 * r * t.cos(), h / 2.0 + h / 2.0 * r * t.sin())
                })
                .collect();
            polygon(&pts, f)
        }
        "can" => format!("<path d=\"M{x0:.2} {y1:.2} A{rx:.2} {ry:.2} 0 0 1 {x2:.2} {y1:.2} L{x2:.2} {y3:.2} A{rx:.2} {ry:.2} 0 0 1 {x0:.2} {y3:.2} Z\"", x0 = f.x, x2 = f.right(), y1 = f.y + ss * 0.125, y3 = f.bottom() - ss * 0.125, rx = w / 2.0, ry = ss * 0.125),
        _ => format!("<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\"", f.x, f.y, w, h),
    }
}

// ───────────── texto ─────────────

/// Linhas medidas → contornos, com alinhamento, sobrescrito e cor por trecho.
#[allow(clippy::too_many_arguments)]
fn draw_lines(out: &mut String, fonts: &Fonts, laid: &Laid, runs: &[RunInput], colors: &[Rgba], decorations: &[(bool, bool)], baselines: &[Option<i32>], align: Align, frame: Frame, size: f32, letter_spacing: f32, opacity: f32) {
    let lines: Vec<&crate::text::Pieces> = laid.paragraphs.iter().flatten().collect();
    let mut y = frame.y;
    for (i, line) in lines.iter().enumerate() {
        let height = laid.line_heights.as_ref().and_then(|h| h.get(i).copied()).unwrap_or(laid.line.height);
        let ascent = laid.line.ascent * height / laid.line.height.max(1e-3);
        let size_of = |run: usize| runs.get(run).map_or(size, |r| r.size.unwrap_or(size) * if r.shifted { 2.0 / 3.0 } else { 1.0 });
        let face_of = |run: usize| runs.get(run).map_or(0, |r| r.face);
        let widths: Vec<f32> = line.iter().map(|p| fonts.width(face_of(p.run), &p.text, size_of(p.run), letter_spacing)).collect();
        let trailing = line.last().map_or(0.0, |p| {
            let trimmed = p.text.trim_end();
            fonts.width(face_of(p.run), &p.text, size_of(p.run), letter_spacing) - fonts.width(face_of(p.run), trimmed, size_of(p.run), letter_spacing)
        });
        let total: f32 = widths.iter().sum::<f32>() - trailing;
        let mut x = match align {
            Align::Left => frame.x,
            Align::Center => frame.x + (frame.w - total) / 2.0,
            Align::Right => frame.x + frame.w - total,
        };
        for (p, w) in line.iter().zip(&widths) {
            let shift = match baselines.get(p.run).copied().flatten() {
                Some(b) if b > 0 => -size * 0.3,
                Some(_) => size * 0.25,
                None => 0.0,
            };
            let base = y + ascent + shift;
            let (d, _) = fonts.glyph_path(face_of(p.run), &p.text, size_of(p.run), letter_spacing, x, base);
            let c = colors.get(p.run).copied().unwrap_or(Rgba { r: 0, g: 0, b: 0, a: 1.0 });
            if !d.is_empty() {
                let _ = write!(out, "<path d=\"{d}\" {}/>", color(c, opacity));
            }
            let (under, strike) = decorations.get(p.run).copied().unwrap_or((false, false));
            let thick = (size / 16.0).max(0.5);
            for (on, dy) in [(under, size * 0.12), (strike, -size * 0.28)] {
                if on {
                    let _ = write!(out, "<rect x=\"{x:.2}\" y=\"{:.2}\" width=\"{w:.2}\" height=\"{thick:.2}\" {}/>", base + dy, color(c, opacity));
                }
            }
            x += w;
        }
        y += height;
    }
}

fn text(out: &mut String, fonts: &Fonts, p: &Placed, spec: &TextSpec, opacity: f32) {
    let Some(t) = &p.text else { return };
    let [top, right, bottom, left] = p.inset;
    let f = p.frame;
    let content = Frame { x: f.x + left, y: f.y + top, w: (f.w - left - right).max(0.0), h: (f.h - top - bottom).max(0.0) };
    let runs = crate::layout::runs_of(spec, fonts, t.size / spec.size.max(1e-3));
    let colors: Vec<Rgba> = spec.runs.iter().map(|r| r.color).collect();
    let decorations: Vec<(bool, bool)> = spec.runs.iter().map(|r| (r.underline, r.strike)).collect();
    let baselines: Vec<Option<i32>> = spec.runs.iter().map(|r| r.baseline).collect();
    draw_lines(out, fonts, &t.laid, &runs, &colors, &decorations, &baselines, spec.align, content, t.size, spec.letter_spacing, opacity);
}

// ───────────── nós ─────────────

fn decoration(out: &mut String, p: &Placed, paint: &Paint, opacity: f32) {
    let f = p.frame;
    if let Some(fill) = paint.fill {
        let _ = write!(out, "<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" rx=\"{:.2}\" {}/>", f.x, f.y, f.w, f.h, paint.radius, color(fill, opacity));
    }
    if let Some((path, _)) = &paint.background_image
        && let Some(uri) = data_uri(path) {
            let _ = write!(out, "<image x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" preserveAspectRatio=\"xMidYMid slice\" href=\"{uri}\" opacity=\"{opacity:.3}\"/>", f.x, f.y, f.w, f.h);
        }
    match paint.uniform_border() {
        Some(s) => {
            let h = s.width / 2.0;
            let _ = write!(out, "<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" rx=\"{:.2}\" fill=\"none\" {}/>", f.x + h, f.y + h, (f.w - s.width).max(0.0), (f.h - s.width).max(0.0), (paint.radius - h).max(0.0), stroke_attrs(s, opacity));
        }
        None => {
            for (i, side) in paint.borders.iter().enumerate() {
                let Some(s) = side else { continue };
                let h = s.width / 2.0;
                let (x1, y1, x2, y2) = match i {
                    0 => (f.x, f.y + h, f.right(), f.y + h),
                    1 => (f.right() - h, f.y, f.right() - h, f.bottom()),
                    2 => (f.x, f.bottom() - h, f.right(), f.bottom() - h),
                    _ => (f.x + h, f.y, f.x + h, f.bottom()),
                };
                let _ = write!(out, "<line x1=\"{x1:.2}\" y1=\"{y1:.2}\" x2=\"{x2:.2}\" y2=\"{y2:.2}\" {}/>", stroke_attrs(*s, opacity));
            }
        }
    }
}

fn shape(out: &mut String, p: &Placed, spec: &ShapeSpec, paint: &Paint, opacity: f32) {
    let f = p.frame;
    let stroke = paint.borders[0].map(|s| stroke_attrs(s, opacity)).unwrap_or_else(|| "stroke=\"none\"".into());
    if spec.line {
        let (x1, x2) = if spec.flip_h { (f.right(), f.x) } else { (f.x, f.right()) };
        let (y1, y2) = if spec.flip_v { (f.bottom(), f.y) } else { (f.y, f.bottom()) };
        let _ = write!(out, "<line x1=\"{x1:.2}\" y1=\"{y1:.2}\" x2=\"{x2:.2}\" y2=\"{y2:.2}\" {stroke}/>");
        return;
    }
    let fill = paint.fill.map_or_else(|| "fill=\"none\"".into(), |c| color(c, opacity));
    let radius = if spec.pill { Some(f.w.min(f.h) / 2.0) } else { spec.radius };
    let _ = write!(out, "{} {fill} {stroke}/>", preset(spec.prst, &spec.adj, radius, f));
}

fn vector(out: &mut String, cmds: &[crate::vector::Cmd], t: crate::vector::Transform, path: &crate::vector::VectorPath, stroke_width: f64, dash: Dash, opacity: f32) {
    let mut d = String::new();
    let px = |x: f64| x * t.sx + t.dx;
    let py = |y: f64| y * t.sy + t.dy;
    for c in cmds {
        let _ = match *c {
            crate::vector::Cmd::M(x, y) => write!(d, "M{:.2} {:.2}", px(x), py(y)),
            crate::vector::Cmd::L(x, y) => write!(d, "L{:.2} {:.2}", px(x), py(y)),
            crate::vector::Cmd::C(a, b, c2, e, x, y) => write!(d, "C{:.2} {:.2} {:.2} {:.2} {:.2} {:.2}", px(a), py(b), px(c2), py(e), px(x), py(y)),
            crate::vector::Cmd::Q(a, b, x, y) => write!(d, "Q{:.2} {:.2} {:.2} {:.2}", px(a), py(b), px(x), py(y)),
            crate::vector::Cmd::Z => write!(d, "Z"),
        };
    }
    let fill = path.fill.map_or_else(|| "fill=\"none\"".into(), |c| color(c, opacity));
    let stroke = path
        .stroke
        .map(|c| {
            let cap = match path.cap {
                Some("rnd") => " stroke-linecap=\"round\"",
                Some("sq") => " stroke-linecap=\"square\"",
                _ => "",
            };
            let join = path.join.map(|j| format!(" stroke-linejoin=\"{j}\"")).unwrap_or_default();
            format!("{}{cap}{join}", stroke_attrs(Stroke { width: stroke_width as f32, color: c, dash }, opacity))
        })
        .unwrap_or_default();
    let _ = write!(out, "<path d=\"{d}\" {fill} {stroke}/>");
}

fn icon(out: &mut String, icon: &crate::vector::Icon, f: Frame, opacity: f32) {
    let frame = (f64::from(f.x), f64::from(f.y), f64::from(f.w), f64::from(f.h));
    let t = crate::vector::view_transform(icon.view_box, frame, true);
    match &icon.content {
        crate::vector::IconContent::Vector(paths) => {
            for p in paths {
                vector(out, &p.cmds, t, p, p.stroke_width * t.sx, Dash::Solid, opacity);
            }
        }
        crate::vector::IconContent::Raster { svg, .. } => {
            let uri = format!("data:image/svg+xml;base64,{}", base64(svg.as_bytes()));
            let _ = write!(out, "<image x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" href=\"{uri}\" opacity=\"{opacity:.3}\"/>", f.x, f.y, f.w, f.h);
        }
    }
}

fn table(out: &mut String, fonts: &Fonts, p: &Placed, spec: &TableSpec, layout: &TableLayout, opacity: f32) {
    let [top, _, _, left] = p.inset;
    let (x0, y0) = (p.frame.x + left, p.frame.y + top);
    let mut ys = vec![y0];
    for h in &layout.heights {
        ys.push(ys.last().copied().unwrap_or(y0) + h);
    }
    let mut xs = vec![x0];
    for w in &layout.widths {
        xs.push(xs.last().copied().unwrap_or(x0) + w);
    }
    for (r, row) in layout.grid.iter().enumerate() {
        for (c, slot) in row.iter().enumerate() {
            let Slot::Cell(i) = *slot else { continue };
            let cell = &spec.rows[r].cells[i];
            let (x, y) = (xs[c], ys[r]);
            let w = xs[(c + cell.span).min(xs.len() - 1)] - x;
            let h = ys[(r + cell.row_span.max(1)).min(ys.len() - 1)] - y;
            if let Some(fill) = cell.fill {
                let _ = write!(out, "<rect x=\"{x:.2}\" y=\"{y:.2}\" width=\"{w:.2}\" height=\"{h:.2}\" {}/>", color(fill, opacity));
            }
            if let Some(b) = spec.border {
                let _ = write!(out, "<rect x=\"{x:.2}\" y=\"{y:.2}\" width=\"{w:.2}\" height=\"{h:.2}\" fill=\"none\" {}/>", stroke_attrs(Stroke { width: 0.5, color: b, dash: Dash::Solid }, opacity));
            }
            let Some(laid) = layout.cells[r].get(i) else { continue };
            let space = cell.icon.as_ref().map_or(0.0, |ic| ic.size + crate::objects::ICON_GAP);
            let inner = Frame { x: x + spec.padding + space, y: y + spec.padding, w: (w - 2.0 * spec.padding - space).max(0.0), h: (h - 2.0 * spec.padding).max(0.0) };
            let content = Frame { y: inner.y + (inner.h - laid.height).max(0.0) * cell.valign, ..inner };
            let runs: Vec<RunInput> = cell
                .runs
                .iter()
                .map(|r| RunInput { text: r.text.clone(), face: fonts.face_for(&spec.family, r.weight, r.italic), size: None, shifted: r.baseline.is_some(), own_metrics: false, missing: false })
                .collect();
            let colors: Vec<Rgba> = cell.runs.iter().map(|r| r.color).collect();
            let baselines: Vec<Option<i32>> = cell.runs.iter().map(|r| r.baseline).collect();
            draw_lines(out, fonts, laid, &runs, &colors, &[], &baselines, cell.align, content, layout.size, 0.0, opacity);
        }
    }
    for (ic, (ix, iy, iw, ih)) in crate::objects::cell_icons(spec, layout, x0, y0) {
        icon(out, &ic, Frame { x: ix, y: iy, w: iw, h: ih }, opacity);
    }
}

/// Gráfico simplificado (barras, linhas, áreas, pizza, dispersão): o arquivo tem o gráfico nativo.
/// Rótulo do gráfico em contornos de glifo (face regular), centrado em `cx` ou alinhado à direita.
#[allow(clippy::too_many_arguments)]
fn label(out: &mut String, fonts: &Fonts, text: &str, size: f32, x: f32, y: f32, anchor: f32, c: Rgba) {
    let face = fonts.face_for("Arial", 400, false);
    let (_, w) = fonts.glyph_path(face, text, size, 0.0, 0.0, 0.0);
    let (d, _) = fonts.glyph_path(face, text, size, 0.0, x - w * anchor, y);
    if !d.is_empty() {
        let _ = write!(out, "<path d=\"{d}\" {}/>", color(c, 1.0));
    }
}

fn short_num(v: f64) -> String {
    let s = crate::js::value::num_to_string((v * 100.0).round() / 100.0);
    s.replace('.', ",")
}

// ───────────── escala do eixo de valores (preview/chart.ts) ─────────────

/// Número máximo de intervalos no eixo de valores (4–5 ticks contando o zero).
const MAX_AXIS_INTERVALS: f64 = 5.0;
/// Passos "bonitos" (× 10^n) do eixo de valores.
const NICE_STEPS: [f64; 6] = [1.0, 2.0, 5.0, 10.0, 20.0, 50.0];
/// Grade clara igual à do emit (DDDDDD, 0,5 pt); linha do zero mais escura.
const GRID_LINE: (&str, f32) = ("#DDDDDD", 0.5);
const ZERO_LINE: (&str, f32) = ("#999999", 0.75);

#[derive(Clone, Copy, Debug, PartialEq)]
struct Scale {
    min: f64,
    max: f64,
    step: f64,
}

fn round_to(value: f64, decimals: i32) -> f64 {
    let factor = 10f64.powi(decimals);
    (value * factor).round() / factor
}

fn decimals_of(step: f64) -> i32 {
    (-((step.log10() + 1e-9).floor() as i32)).max(0)
}

fn intervals_of(min: f64, max: f64, step: f64) -> f64 {
    (max / step - 1e-9).ceil() - (min / step + 1e-9).floor()
}

/// Eixo de 0 (ou do mínimo negativo) ao máximo "bonito": o menor passo 1/2/5 × 10^n que cobre
/// os dados em até MAX_AXIS_INTERVALS intervalos (niceScaleOf).
fn nice_scale(values: &[f64]) -> Scale {
    let lo = values.iter().copied().fold(0.0, f64::min);
    let hi = values.iter().copied().fold(0.0, f64::max);
    let range = if hi - lo > 0.0 { hi - lo } else { 1.0 };
    let magnitude = 10f64.powf((range / MAX_AXIS_INTERVALS).log10().floor());
    let step = NICE_STEPS.iter().map(|m| m * magnitude).find(|s| intervals_of(lo, hi, *s) <= MAX_AXIS_INTERVALS).unwrap_or(range);
    let min = (lo / step + 1e-9).floor() * step;
    let max = if hi - lo > 0.0 { (hi / step - 1e-9).ceil() * step } else { step };
    Scale { min: round_to(min, decimals_of(step)), max: round_to(max, decimals_of(step)), step }
}

/// Escala dos dados com o min/max/step do autor por cima (scaleOf).
fn scale_of(values: &[f64], axis: &crate::objects::Axis, fixed: Option<Scale>) -> Scale {
    let base = fixed.unwrap_or_else(|| nice_scale(values));
    let min = axis.min.unwrap_or(base.min);
    let max = axis.max.unwrap_or(base.max);
    let step = axis.step.unwrap_or_else(|| if axis.min.is_some() || axis.max.is_some() { nice_scale(&[min, max]).step } else { base.step });
    Scale { min, max: if max > min { max } else { min + step }, step }
}

fn ticks_of(scale: &Scale) -> Vec<f64> {
    let count = ((scale.max - scale.min) / scale.step).round().max(1.0) as usize;
    (0..=count).map(|i| round_to(scale.min + i as f64 * scale.step, decimals_of(scale.step).max(6))).collect()
}

/// Número como o PPTX mostra em pt-BR: até `decimals` casas (General) ou exatamente `decimals`
/// (`fixed`), vírgula decimal, sem separador de milhar (formatValue).
fn format_value(value: f64, decimals: i32, fixed: bool) -> String {
    let mut s = format!("{:.*}", decimals.max(0) as usize, value);
    if !fixed && s.contains('.') {
        s = s.trim_end_matches('0').trim_end_matches('.').to_string();
    }
    if s == "-0" {
        s = "0".into();
    }
    s.replace('.', ",")
}

/// Formato simples do Excel no preview: '0%' / '0.0%', '0.00'; o resto como 'General' (formatWith).
fn format_with(value: f64, format: Option<&str>, fallback_decimals: i32, fixed: bool) -> String {
    let Some(f) = format.filter(|f| *f != "General") else { return format_value(value, fallback_decimals, fixed) };
    let decimals = f.find('.').map_or(0, |i| f[i + 1..].chars().take_while(|c| *c == '0').count() as i32);
    if f.contains('%') {
        return format!("{}%", format_value(value * 100.0, decimals, true));
    }
    format_value(value, decimals, true)
}

fn tick_label(tick: f64, scale: &Scale, format: Option<&str>, percent: bool) -> String {
    if percent {
        return format!("{}%", format_value(tick * 100.0, decimals_of(scale.step * 100.0).max(0), false));
    }
    format_with(tick, format, decimals_of(scale.step), false)
}

fn chart(out: &mut String, fonts: &Fonts, p: &Placed, spec: &ChartSpec, opacity: f32) {
    let f = p.frame;
    let top = if spec.title.is_some() { spec.size * 2.0 } else { 4.0 };
    let bottom = if spec.legend.is_some() { spec.size * 2.2 } else { 4.0 };
    let plot = Frame { x: f.x + spec.size * 2.5, y: f.y + top, w: (f.w - spec.size * 3.0).max(1.0), h: (f.h - top - bottom - spec.size * 1.5).max(1.0) };
    if let ChartKind::Pie { hole } = spec.kind {
        let Some(s) = spec.series.first() else { return };
        let total: f64 = s.values.iter().filter(|v| **v > 0.0).sum();
        let (cx, cy) = (f.x + f.w / 2.0, plot.y + plot.h / 2.0);
        let r = plot.h.min(f.w) / 2.0;
        let mut angle = -std::f64::consts::FRAC_PI_2;
        for (i, v) in s.values.iter().enumerate() {
            let sweep = if total > 0.0 { v.max(0.0) / total * std::f64::consts::TAU } else { 0.0 };
            let (a0, a1) = (angle, angle + sweep);
            let pt = |a: f64| (cx + r * a.cos() as f32, cy + r * a.sin() as f32);
            let (p0, p1) = (pt(a0), pt(a1));
            let large = u8::from(sweep > std::f64::consts::PI);
            let c = spec.point_colors.get(i).copied().unwrap_or(s.color);
            let _ = write!(out, "<path d=\"M{cx:.2} {cy:.2} L{:.2} {:.2} A{r:.2} {r:.2} 0 {large} 1 {:.2} {:.2} Z\" {} stroke=\"#FFFFFF\" stroke-width=\"1\"/>", p0.0, p0.1, p1.0, p1.1, color(c, opacity));
            angle = a1;
        }
        if let Some(h) = hole {
            let _ = write!(out, "<circle cx=\"{cx:.2}\" cy=\"{cy:.2}\" r=\"{:.2}\" fill=\"#FFFFFF\"/>", r * h as f32 / 100.0);
        }
        return;
    }
    // preview/chart.ts: rótulos de eixo, categorias e legenda no corpo dos rótulos (`size`, padrão 12).
    let small = spec.size;
    if let Some(t) = &spec.title {
        label(out, fonts, t, spec.size + 2.0, f.x + f.w / 2.0, f.y + spec.size + 2.0, 0.5, spec.color);
    }
    let (horizontal, grouping) = match spec.kind {
        ChartKind::Bar { horizontal, grouping } => (horizontal, grouping),
        ChartKind::Area { stacked: true } => (false, "stacked"),
        _ => (false, "clustered"),
    };
    let n = spec.categories.len().max(spec.series.iter().map(|s| s.values.len()).max().unwrap_or(0)).max(1);
    let primary: Vec<usize> = (0..spec.series.len()).filter(|&i| !spec.series[i].secondary).collect();
    // Escala do eixo (preview/chart.ts rangeValuesOf + valueAxisOf): empilhado soma por categoria
    // (positivos e negativos à parte); 100 % no percentStacked; o resto, os valores todos.
    let percent = grouping == "percentStacked";
    let range_values: Vec<f64> = match grouping {
        "percentStacked" => Vec::new(),
        "stacked" => (0..n)
            .flat_map(|j| {
                let values: Vec<f64> = primary.iter().map(|&i| spec.series[i].values.get(j).copied().unwrap_or(0.0)).collect();
                [values.iter().filter(|v| **v > 0.0).sum::<f64>(), values.iter().filter(|v| **v < 0.0).sum::<f64>()]
            })
            .collect(),
        _ => primary.iter().flat_map(|&i| spec.series[i].values.iter().copied().chain(spec.series[i].points.iter().map(|p| p.1))).collect(),
    };
    let sum_at = |j: usize| primary.iter().map(|&i| spec.series[i].values.get(j).copied().unwrap_or(0.0).max(0.0)).sum::<f64>();
    let scale = scale_of(&range_values, &spec.y_axis, percent.then_some(Scale { min: 0.0, max: 1.0, step: 0.25 }));
    let (min, max) = (scale.min, scale.max);
    let span = (max - min).max(1e-9);
    // Eixo de valores: vertical (ou horizontal no barH).
    let v_len = if horizontal { plot.w } else { plot.h };
    let pos = |v: f64| ((v - min) / span) as f32 * v_len;
    let grid_attrs = |tick: f64| {
        let (c, w) = if tick == 0.0 { ZERO_LINE } else { GRID_LINE };
        format!("stroke=\"{c}\" stroke-width=\"{w}\"")
    };
    for v in ticks_of(&scale) {
        let text = tick_label(v, &scale, spec.y_axis.format.as_deref(), percent);
        if horizontal {
            let x = plot.x + pos(v);
            if spec.y_axis.grid != Some(false) {
                let _ = write!(out, "<line x1=\"{x:.2}\" y1=\"{:.2}\" x2=\"{x:.2}\" y2=\"{:.2}\" {}/>", plot.y, plot.bottom(), grid_attrs(v));
            }
            if !spec.y_axis.hidden {
                label(out, fonts, &text, small, x, plot.bottom() + small + 3.0, 0.5, spec.color);
            }
        } else {
            let y = plot.bottom() - pos(v);
            if spec.y_axis.grid != Some(false) {
                let _ = write!(out, "<line x1=\"{:.2}\" y1=\"{y:.2}\" x2=\"{:.2}\" y2=\"{y:.2}\" {}/>", plot.x, plot.right(), grid_attrs(v));
            }
            if !spec.y_axis.hidden {
                label(out, fonts, &text, small, plot.x - 4.0, y + small / 3.0, 1.0, spec.color);
            }
        }
    }
    let band = if horizontal { plot.h } else { plot.w } / n as f32;
    if spec.kind != ChartKind::Scatter {
        for (j, cat) in spec.categories.iter().enumerate() {
            if horizontal {
                label(out, fonts, cat, small, plot.x - 4.0, plot.y + band * (j as f32 + 0.5) + small / 3.0, 1.0, spec.color);
            } else {
                label(out, fonts, cat, small, plot.x + band * (j as f32 + 0.5), plot.bottom() + small + 3.0, 0.5, spec.color);
            }
        }
    }
    let y_of = |v: f64| plot.bottom() - pos(v);
    let bars: Vec<usize> = (0..spec.series.len()).filter(|&i| matches!(spec.kind, ChartKind::Bar { .. }) || (spec.kind == ChartKind::Combo && !spec.series[i].line)).collect();
    let stacked = grouping != "clustered";
    let mut base = vec![0.0_f64; n];
    for (k, &i) in bars.iter().enumerate() {
        let s = &spec.series[i];
        for (j, v) in s.values.iter().enumerate() {
            let v = if grouping == "percentStacked" { v / sum_at(j).max(1e-9) } else { *v };
            let (slot, count) = if stacked { (0, 1) } else { (k, bars.len()) };
            let thick = band * 0.6 / count as f32;
            let offset = band * j as f32 + band * 0.2 + thick * slot as f32;
            let (from, to) = if stacked { (base[j], base[j] + v) } else { (0.0, v) };
            if stacked {
                base[j] += v;
            }
            let (a, b) = (pos(from), pos(to));
            let rect = if horizontal { (plot.x + a.min(b), plot.y + offset, (b - a).abs(), thick) } else { (plot.x + offset, plot.bottom() - a.max(b), thick, (b - a).abs()) };
            let _ = write!(out, "<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" {}/>", rect.0, rect.1, rect.2, rect.3, color(s.color, opacity));
            if spec.labels && !horizontal {
                label(out, fonts, &short_num(v), small, rect.0 + thick / 2.0, rect.1 - 3.0, 0.5, spec.color);
            }
        }
    }
    // Eixo secundário do combo: escala própria (valueAxisOf com as séries secundárias).
    let secondary_values: Vec<f64> = spec.series.iter().filter(|s| s.secondary).flat_map(|s| s.values.iter().copied()).collect();
    let secondary = scale_of(&secondary_values, &spec.y2_axis, None);
    let (secondary_min, secondary_max) = (secondary.min, secondary.max);
    // Scatter: eixo x pela escala de todos os pontos (scatterSvg xScale).
    let x_points: Vec<f64> = spec.series.iter().flat_map(|s| s.points.iter().map(|p| p.0)).collect();
    let x_scale = scale_of(&x_points, &spec.x_axis, None);
    let mut area_base = vec![0.0_f64; n];
    for s in &spec.series {
        let line = matches!(spec.kind, ChartKind::Line | ChartKind::Area { .. }) || (spec.kind == ChartKind::Combo && s.line);
        if spec.kind == ChartKind::Scatter {
            for (x, y) in &s.points {
                let px = plot.x + ((x - x_scale.min) / (x_scale.max - x_scale.min).max(1e-9)) as f32 * plot.w;
                let _ = write!(out, "<circle cx=\"{px:.2}\" cy=\"{:.2}\" r=\"3\" {}/>", y_of(*y), color(s.color, opacity));
            }
            continue;
        }
        if !line {
            continue;
        }
        let y_at = |v: f64| if s.secondary { plot.bottom() - ((v - secondary_min) / (secondary_max - secondary_min).max(1e-9)) as f32 * plot.h } else { y_of(v) };
        let values: Vec<f64> = s
            .values
            .iter()
            .enumerate()
            .map(|(j, v)| if grouping == "stacked" { area_base[j] + v } else { *v })
            .collect();
        let pts: Vec<(f32, f32)> = values.iter().enumerate().map(|(j, v)| (plot.x + band * (j as f32 + 0.5), y_at(*v))).collect();
        let list: Vec<String> = pts.iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
        if matches!(spec.kind, ChartKind::Area { .. }) {
            let floor: Vec<String> = (0..values.len()).rev().map(|j| format!("{:.2},{:.2}", plot.x + band * (j as f32 + 0.5), y_of(if grouping == "stacked" { area_base[j] } else { 0.0 }))).collect();
            let _ = write!(out, "<polygon points=\"{} {}\" {}/>", list.join(" "), floor.join(" "), color(s.color.with_alpha(0.85), opacity));
            if grouping == "stacked" {
                area_base = values.clone();
            }
        } else {
            let _ = write!(out, "<polyline points=\"{}\" fill=\"none\" stroke=\"#{}\" stroke-width=\"2\" stroke-opacity=\"{opacity:.3}\"/>", list.join(" "), s.color.hex());
            if spec.markers {
                for (x, y) in &pts {
                    let _ = write!(out, "<circle cx=\"{x:.2}\" cy=\"{y:.2}\" r=\"2.5\" {}/>", color(s.color, opacity));
                }
            }
        }
    }
    if !horizontal {
        let _ = write!(out, "<line x1=\"{:.2}\" y1=\"{:.2}\" x2=\"{:.2}\" y2=\"{:.2}\" stroke=\"{}\" stroke-width=\"{}\"/>", plot.x, y_of(0.0), plot.right(), y_of(0.0), ZERO_LINE.0, ZERO_LINE.1);
    }
    if spec.legend.is_some() {
        let names: Vec<(&str, Rgba)> = spec.series.iter().map(|s| (s.name.as_str(), s.color)).collect();
        let widths: Vec<f32> = names.iter().map(|(n, _)| fonts.glyph_path(0, n, small, 0.0, 0.0, 0.0).1 + small * 2.0).collect();
        let mut x = f.x + (f.w - widths.iter().sum::<f32>()) / 2.0;
        let y = f.bottom() - small;
        for ((name, c), w) in names.iter().zip(&widths) {
            let _ = write!(out, "<rect x=\"{x:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" {}/>", y - small * 0.7, small * 0.7, small * 0.7, color(*c, opacity));
            label(out, fonts, name, small, x + small, y, 0.0, spec.color);
            x += w;
        }
    }
}

fn connector(out: &mut String, c: &crate::layout::Routed) {
    let s = c.spec.stroke;
    let pts: Vec<String> = c.points.iter().map(|(x, y)| format!("{x:.2},{y:.2}")).collect();
    let _ = write!(out, "<polyline points=\"{}\" fill=\"none\" {}/>", pts.join(" "), stroke_attrs(s, 1.0));
    // Ponta de seta no fim (3× a espessura, mínimo 4,5 pt, como DEFAULTS.shape.arrow).
    for (end, kind) in [(true, &c.spec.end_arrow), (false, &c.spec.start_arrow)] {
        if kind.is_none() || c.points.len() < 2 {
            continue;
        }
        let (tip, from) = if end { (c.points[c.points.len() - 1], c.points[c.points.len() - 2]) } else { (c.points[0], c.points[1]) };
        let size = (s.width * 3.0).max(4.5);
        let (dx, dy) = (tip.0 - from.0, tip.1 - from.1);
        let len = dx.hypot(dy).max(1e-3);
        let (ux, uy) = (dx / len, dy / len);
        let base = (tip.0 - ux * size, tip.1 - uy * size);
        let _ = write!(out, "<polygon points=\"{:.2},{:.2} {:.2},{:.2} {:.2},{:.2}\" fill=\"#{}\"/>", tip.0, tip.1, base.0 - uy * size / 2.0, base.1 + ux * size / 2.0, base.0 + uy * size / 2.0, base.1 - ux * size / 2.0, s.color.hex());
    }
}

/// SVG do slide em pt (viewBox = tamanho do slide).
pub fn slide_svg(slide: &SlideSpec, layout: &SlideLayout, fonts: &Fonts, width: f32, height: f32) -> String {
    let mut out = format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {width} {height}\" width=\"{width}\" height=\"{height}\">");
    // Sem fundo próprio, vale o do layout (defineLayout background), como no PowerPoint.
    let inherited = if slide.background.is_none() && slide.background_image.is_none() { slide.layout.as_ref().and_then(|l| l.background.clone()) } else { None };
    let layout_color = match &inherited {
        Some(crate::model::LayoutBackground::Color(c)) => Some(*c),
        _ => None,
    };
    let bg = slide.background.or(layout_color).unwrap_or(Rgba { r: 255, g: 255, b: 255, a: 1.0 });
    let _ = write!(out, "<rect width=\"{width}\" height=\"{height}\" {}/>", color(bg, 1.0));
    let image = match &inherited {
        Some(crate::model::LayoutBackground::Image(path)) => Some(path),
        _ => slide.background_image.as_ref().map(|(path, _)| path),
    };
    if let Some(path) = image
        && let Some(uri) = data_uri(path) {
            let _ = write!(out, "<image width=\"{width}\" height=\"{height}\" preserveAspectRatio=\"none\" href=\"{uri}\"/>");
        }
    for p in &layout.placed {
        if std::ptr::eq(p.node, &slide.root) {
            continue;
        }
        let fx = &p.effects;
        let mut transform: String = fx.rotations.iter().map(|(px, py, deg)| format!("rotate({deg} {px} {py}) ")).collect();
        if fx.shift != (0.0, 0.0) {
            let _ = write!(transform, "translate({} {})", fx.shift.0, fx.shift.1);
        }
        let _ = write!(out, "<g transform=\"{}\">", transform.trim());
        let op = fx.opacity;
        let paint = &p.node.paint;
        match &p.node.kind {
            NodeKind::Container => decoration(&mut out, p, paint, op),
            NodeKind::Shape(spec) => shape(&mut out, p, spec, paint, op),
            NodeKind::Text(spec) => {
                decoration(&mut out, p, paint, op);
                text(&mut out, fonts, p, spec, op);
            }
            NodeKind::Image(img) => {
                decoration(&mut out, p, paint, op);
                if let Some(uri) = data_uri(&img.path) {
                    let f = p.frame;
                    let fit = if img.cover { "xMidYMid slice" } else { "xMidYMid meet" };
                    let _ = write!(out, "<svg x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" viewBox=\"0 0 {:.2} {:.2}\" preserveAspectRatio=\"{fit}\"><image width=\"{:.2}\" height=\"{:.2}\" href=\"{uri}\" opacity=\"{op:.3}\"/></svg>", f.x, f.y, f.w, f.h, img.natural.0, img.natural.1, img.natural.0, img.natural.1);
                }
            }
            NodeKind::Path(spec) => {
                decoration(&mut out, p, paint, op);
                let f = p.frame;
                let t = crate::vector::view_transform(spec.view_box, (f64::from(f.x), f64::from(f.y), f64::from(f.w), f64::from(f.h)), false);
                vector(&mut out, &spec.path.cmds, t, &spec.path, spec.path.stroke_width, spec.dash, op);
            }
            NodeKind::Icon(spec) => icon(&mut out, &spec.icon, p.frame, op),
            NodeKind::Table(spec) => {
                decoration(&mut out, p, paint, op);
                if let Some(t) = &p.table {
                    table(&mut out, fonts, p, spec, t, op);
                }
            }
            NodeKind::Chart(spec) => {
                decoration(&mut out, p, paint, op);
                chart(&mut out, fonts, p, spec, op);
            }
        }
        out.push_str("</g>");
    }
    for c in &layout.connectors {
        connector(&mut out, c);
        if let (Some((frame, t)), Some(spec)) = (&c.label, &c.spec.label) {
            if let Some(bg) = c.spec.label_background {
                let _ = write!(out, "<rect x=\"{:.2}\" y=\"{:.2}\" width=\"{:.2}\" height=\"{:.2}\" {}/>", frame.x - 3.0, frame.y - 3.0, frame.w + 6.0, frame.h + 6.0, color(bg, 1.0));
            }
            let runs = crate::layout::runs_of(spec, fonts, 1.0);
            let colors: Vec<Rgba> = spec.runs.iter().map(|r| r.color).collect();
            draw_lines(&mut out, fonts, &t.laid, &runs, &colors, &[], &[], Align::Center, *frame, spec.size, 0.0, 1.0);
        }
    }
    out.push_str("</svg>");
    out
}

pub fn render_png(svg: &str, width_px: u32) -> Option<Vec<u8>> {
    let tree = resvg::usvg::Tree::from_str(svg, &resvg::usvg::Options::default()).ok()?;
    let size = tree.size();
    let scale = width_px as f32 / size.width();
    let mut pixmap = resvg::tiny_skia::Pixmap::new(width_px, (size.height() * scale).round().max(1.0) as u32)?;
    resvg::render(&tree, resvg::tiny_skia::Transform::from_scale(scale, scale), &mut pixmap.as_mut());
    pixmap.encode_png().ok()
}

/// Grade de miniaturas (src/preview/overview.ts): número embaixo, selo vermelho em slide com erro,
/// miniatura esmaecida em slide oculto.
pub fn overview_svg(slides: &[(String, bool, bool)], width: f32, height: f32, fonts: &Fonts) -> String {
    let thumb_h = THUMB_WIDTH * height / width;
    let rows = slides.len().div_ceil(COLUMNS);
    let cols = slides.len().clamp(1, COLUMNS);
    let total_w = MARGIN * 2.0 + cols as f32 * THUMB_WIDTH + (cols - 1) as f32 * GAP;
    let total_h = MARGIN * 2.0 + rows as f32 * (thumb_h + LABEL) + rows.saturating_sub(1) as f32 * GAP;
    let mut out = format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {total_w} {total_h}\" width=\"{total_w}\" height=\"{total_h}\"><rect width=\"{total_w}\" height=\"{total_h}\" fill=\"#EEEEEE\"/>");
    let scale = THUMB_WIDTH / width;
    for (i, (svg, error, hidden)) in slides.iter().enumerate() {
        let (c, r) = (i % COLUMNS, i / COLUMNS);
        let x = MARGIN + c as f32 * (THUMB_WIDTH + GAP);
        let y = MARGIN + r as f32 * (thumb_h + LABEL + GAP);
        let inner = svg.split_once('>').map_or("", |(_, rest)| rest).trim_end_matches("</svg>");
        // A miniatura recorta no slide: decoração que sangra para fora não invade a vizinha.
        let _ = write!(out, "<clipPath id=\"s{i}\"><rect width=\"{width}\" height=\"{height}\"/></clipPath><g transform=\"translate({x} {y}) scale({scale})\"><g clip-path=\"url(#s{i})\">{inner}</g></g>");
        if *hidden {
            let _ = write!(out, "<rect x=\"{x}\" y=\"{y}\" width=\"{THUMB_WIDTH}\" height=\"{thumb_h}\" fill=\"#FFFFFF\" fill-opacity=\"0.6\"/>");
        }
        let _ = write!(out, "<rect x=\"{x}\" y=\"{y}\" width=\"{THUMB_WIDTH}\" height=\"{thumb_h}\" fill=\"none\" stroke=\"#C8C8C8\" stroke-width=\"1\"/>");
        if *error {
            let _ = write!(out, "<circle cx=\"{}\" cy=\"{}\" r=\"12\" fill=\"#E02424\" stroke=\"#FFFFFF\" stroke-width=\"2.5\"/>", x + THUMB_WIDTH - 18.0, y + 18.0);
        }
        let label = if *hidden { format!("{} · oculto", i + 1) } else { (i + 1).to_string() };
        let (d, w) = fonts.glyph_path(0, &label, 14.0, 0.0, 0.0, 0.0);
        let _ = write!(out, "<path transform=\"translate({} {})\" d=\"{d}\" fill=\"#444444\"/>", x + (THUMB_WIDTH - w) / 2.0, y + thumb_h + 18.0);
    }
    out.push_str("</svg>");
    out
}
