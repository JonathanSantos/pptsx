//! Geometria livre (M12): `d` do SVG → comandos absolutos M/L/C/Q/Z (portado de
//! `resolve/path-data.ts`), ícones SVG → vetores (`resolve/svg-icon.ts`) e `custGeom` do PPTX.
//! Ícone que não tem de/para exato vira PNG pelo resvg, como no pptsx.

use std::fmt::Write as _;

use crate::css::{Rgba, parse_color};
use crate::emit::emu;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Cmd {
    M(f64, f64),
    L(f64, f64),
    C(f64, f64, f64, f64, f64, f64),
    Q(f64, f64, f64, f64),
    Z,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

// ───────────── parser do `d` ─────────────

struct Reader<'a> {
    s: &'a [u8],
    i: usize,
}

impl Reader<'_> {
    fn skip(&mut self) {
        while self.i < self.s.len() && (self.s[self.i].is_ascii_whitespace() || self.s[self.i] == b',') {
            self.i += 1;
        }
    }

    fn starts_number(&mut self) -> bool {
        self.skip();
        matches!(self.s.get(self.i), Some(b'0'..=b'9' | b'.' | b'-' | b'+'))
    }

    fn number(&mut self) -> Option<f64> {
        self.skip();
        let start = self.i;
        if matches!(self.s.get(self.i), Some(b'-' | b'+')) {
            self.i += 1;
        }
        let mut dot = false;
        let mut digits = false;
        while let Some(&c) = self.s.get(self.i) {
            if c.is_ascii_digit() {
                digits = true;
            } else if c == b'.' && !dot {
                dot = true;
            } else {
                break;
            }
            self.i += 1;
        }
        if !digits {
            self.i = start;
            return None;
        }
        if matches!(self.s.get(self.i), Some(b'e' | b'E')) {
            let save = self.i;
            self.i += 1;
            if matches!(self.s.get(self.i), Some(b'-' | b'+')) {
                self.i += 1;
            }
            let exp_start = self.i;
            while self.s.get(self.i).is_some_and(u8::is_ascii_digit) {
                self.i += 1;
            }
            if self.i == exp_start {
                self.i = save;
            }
        }
        std::str::from_utf8(&self.s[start..self.i]).ok()?.parse().ok()
    }

    /// Flags do A são um dígito só: "a1 1 0 01 5 5" é válido.
    fn flag(&mut self) -> Option<f64> {
        self.skip();
        match self.s.get(self.i) {
            Some(b'0') => {
                self.i += 1;
                Some(0.0)
            }
            Some(b'1') => {
                self.i += 1;
                Some(1.0)
            }
            _ => None,
        }
    }
}

fn arity(c: u8) -> Option<usize> {
    Some(match c.to_ascii_uppercase() {
        b'M' | b'L' | b'T' => 2,
        b'H' | b'V' => 1,
        b'C' => 6,
        b'S' | b'Q' => 4,
        b'A' => 7,
        b'Z' => 0,
        _ => return None,
    })
}

/// Arco elíptico (parametrização do SVG) → cúbicas, uma por quarto de volta no máximo.
#[allow(clippy::too_many_arguments)]
fn arc_to_cubics(x1: f64, y1: f64, rx: f64, ry: f64, angle: f64, large: bool, sweep: bool, x2: f64, y2: f64, out: &mut Vec<Cmd>) {
    if (x1 - x2).abs() < 1e-12 && (y1 - y2).abs() < 1e-12 {
        return;
    }
    let (mut rx, mut ry) = (rx.abs(), ry.abs());
    if rx < 1e-12 || ry < 1e-12 {
        out.push(Cmd::L(x2, y2));
        return;
    }
    let phi = angle.to_radians();
    let (sin, cos) = phi.sin_cos();
    let dx = (x1 - x2) / 2.0;
    let dy = (y1 - y2) / 2.0;
    let x1p = cos * dx + sin * dy;
    let y1p = -sin * dx + cos * dy;
    let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if lambda > 1.0 {
        rx *= lambda.sqrt();
        ry *= lambda.sqrt();
    }
    let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    let den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let mut coef = if den == 0.0 { 0.0 } else { (num / den).max(0.0).sqrt() };
    if large == sweep {
        coef = -coef;
    }
    let cxp = coef * rx * y1p / ry;
    let cyp = -coef * ry * x1p / rx;
    let cx = cos * cxp - sin * cyp + (x1 + x2) / 2.0;
    let cy = sin * cxp + cos * cyp + (y1 + y2) / 2.0;
    let angle_of = |ux: f64, uy: f64, vx: f64, vy: f64| {
        
        (ux * vy - uy * vx).atan2(ux * vx + uy * vy)
    };
    let theta1 = angle_of(1.0, 0.0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let mut delta = angle_of((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if !sweep && delta > 0.0 {
        delta -= std::f64::consts::TAU;
    } else if sweep && delta < 0.0 {
        delta += std::f64::consts::TAU;
    }
    // Tolerância do pptsx (path-data.ts): 90° com ruído de ponto flutuante é um segmento, não dois.
    let segments = (delta.abs() / std::f64::consts::FRAC_PI_2 - 1e-9).ceil().max(1.0) as usize;
    let step = delta / segments as f64;
    let k = 4.0 / 3.0 * (step / 4.0).tan();
    let point = |t: f64| {
        let (s, c) = t.sin_cos();
        (cx + rx * c * cos - ry * s * sin, cy + rx * c * sin + ry * s * cos)
    };
    let deriv = |t: f64| {
        let (s, c) = t.sin_cos();
        (-rx * s * cos - ry * c * sin, -rx * s * sin + ry * c * cos)
    };
    let mut t = theta1;
    for i in 0..segments {
        let t2 = t + step;
        let (p1x, p1y) = point(t);
        let (p2x, p2y) = if i == segments - 1 { (x2, y2) } else { point(t2) };
        let (d1x, d1y) = deriv(t);
        let (d2x, d2y) = deriv(t2);
        out.push(Cmd::C(p1x + k * d1x, p1y + k * d1y, p2x - k * d2x, p2y - k * d2y, p2x, p2y));
        t = t2;
    }
}

/// `d` → comandos absolutos. Erro de sintaxe → Err com o motivo.
pub fn parse_path(d: &str) -> Result<Vec<Cmd>, String> {
    let mut r = Reader { s: d.as_bytes(), i: 0 };
    let mut out = Vec::new();
    let (mut x, mut y) = (0.0, 0.0);
    let (mut sx, mut sy) = (0.0, 0.0);
    // Último controle (para S/T refletirem).
    let mut last_c: Option<(f64, f64)> = None;
    let mut last_q: Option<(f64, f64)> = None;
    let mut cmd: Option<u8> = None;
    loop {
        r.skip();
        if r.i >= r.s.len() {
            break;
        }
        let head = r.s[r.i];
        let letter = if head.is_ascii_alphabetic() {
            r.i += 1;
            if arity(head).is_none() {
                return Err(format!("comando \"{}\" fora do subconjunto", head as char));
            }
            head
        } else if r.starts_number() {
            match cmd {
                // M repetido vira L (regra do SVG).
                Some(b'M') => b'L',
                Some(b'm') => b'l',
                Some(c) if !c.eq_ignore_ascii_case(&b'Z') => c,
                _ => return Err("número sem comando antes".into()),
            }
        } else {
            return Err(format!("caractere inesperado \"{}\"", head as char));
        };
        cmd = Some(letter);
        let n = arity(letter).unwrap_or(0);
        let mut a = [0.0; 7];
        for (k, slot) in a.iter_mut().enumerate().take(n) {
            let v = if letter.eq_ignore_ascii_case(&b'A') && (k == 3 || k == 4) { r.flag() } else { r.number() };
            *slot = v.ok_or_else(|| format!("argumentos faltando em \"{}\"", letter as char))?;
        }
        let rel = letter.is_ascii_lowercase();
        let (ox, oy) = if rel { (x, y) } else { (0.0, 0.0) };
        let upper = letter.to_ascii_uppercase();
        let (mut nc, mut nq) = (None, None);
        match upper {
            b'M' => {
                x = a[0] + ox;
                y = a[1] + oy;
                sx = x;
                sy = y;
                out.push(Cmd::M(x, y));
            }
            b'L' => {
                x = a[0] + ox;
                y = a[1] + oy;
                out.push(Cmd::L(x, y));
            }
            b'H' => {
                x = a[0] + ox;
                out.push(Cmd::L(x, y));
            }
            b'V' => {
                y = a[0] + if rel { y } else { 0.0 };
                out.push(Cmd::L(x, y));
            }
            b'C' => {
                let c = Cmd::C(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy);
                nc = Some((a[2] + ox, a[3] + oy));
                x = a[4] + ox;
                y = a[5] + oy;
                out.push(c);
            }
            b'S' => {
                let (c1x, c1y) = last_c.map_or((x, y), |(cx, cy)| (2.0 * x - cx, 2.0 * y - cy));
                nc = Some((a[0] + ox, a[1] + oy));
                out.push(Cmd::C(c1x, c1y, a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy));
                x = a[2] + ox;
                y = a[3] + oy;
            }
            b'Q' => {
                nq = Some((a[0] + ox, a[1] + oy));
                out.push(Cmd::Q(a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy));
                x = a[2] + ox;
                y = a[3] + oy;
            }
            b'T' => {
                let (qx, qy) = last_q.map_or((x, y), |(cx, cy)| (2.0 * x - cx, 2.0 * y - cy));
                nq = Some((qx, qy));
                out.push(Cmd::Q(qx, qy, a[0] + ox, a[1] + oy));
                x = a[0] + ox;
                y = a[1] + oy;
            }
            b'A' => {
                let (ex, ey) = (a[5] + ox, a[6] + oy);
                arc_to_cubics(x, y, a[0], a[1], a[2], a[3] != 0.0, a[4] != 0.0, ex, ey, &mut out);
                x = ex;
                y = ey;
            }
            _ => {
                out.push(Cmd::Z);
                x = sx;
                y = sy;
            }
        }
        last_c = nc;
        last_q = nq;
    }
    Ok(out)
}

fn cubic_extrema(p0: f64, p1: f64, p2: f64, p3: f64) -> Vec<f64> {
    let a = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
    let b = 2.0 * (p0 - 2.0 * p1 + p2);
    let c = p1 - p0;
    if a.abs() < 1e-12 {
        return if b.abs() < 1e-12 { Vec::new() } else { vec![-c / b] };
    }
    let disc = b * b - 4.0 * a * c;
    if disc < 0.0 {
        return Vec::new();
    }
    let root = disc.sqrt();
    vec![(-b + root) / (2.0 * a), (-b - root) / (2.0 * a)]
}

fn cubic_at(p0: f64, p1: f64, p2: f64, p3: f64, t: f64) -> f64 {
    let u = 1.0 - t;
    u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3
}

/// Caixa envolvente exata (curvas pelos extremos, não pelos controles).
pub fn bounds_of(cmds: &[Cmd]) -> Bounds {
    let mut pts: Vec<(f64, f64)> = Vec::new();
    let (mut x, mut y) = (0.0, 0.0);
    for c in cmds {
        let (cx1, cy1, cx2, cy2, ex, ey) = match *c {
            Cmd::Z => continue,
            Cmd::M(a, b) | Cmd::L(a, b) => {
                pts.push((a, b));
                x = a;
                y = b;
                continue;
            }
            Cmd::C(a, b, c2, d, e, f) => (a, b, c2, d, e, f),
            Cmd::Q(qx, qy, e, f) => (x + 2.0 / 3.0 * (qx - x), y + 2.0 / 3.0 * (qy - y), e + 2.0 / 3.0 * (qx - e), f + 2.0 / 3.0 * (qy - f), e, f),
        };
        let ts: Vec<f64> = cubic_extrema(x, cx1, cx2, ex).into_iter().chain(cubic_extrema(y, cy1, cy2, ey)).filter(|t| *t > 0.0 && *t < 1.0).collect();
        for t in ts {
            pts.push((cubic_at(x, cx1, cx2, ex, t), cubic_at(y, cy1, cy2, ey, t)));
        }
        pts.push((ex, ey));
        x = ex;
        y = ey;
    }
    if pts.is_empty() {
        return Bounds::default();
    }
    let min_x = pts.iter().map(|p| p.0).fold(f64::INFINITY, f64::min);
    let min_y = pts.iter().map(|p| p.1).fold(f64::INFINITY, f64::min);
    let max_x = pts.iter().map(|p| p.0).fold(f64::NEG_INFINITY, f64::max);
    let max_y = pts.iter().map(|p| p.1).fold(f64::NEG_INFINITY, f64::max);
    Bounds { x: min_x, y: min_y, w: max_x - min_x, h: max_y - min_y }
}

// ───────────── viewBox → frame ─────────────

#[derive(Clone, Copy)]
pub struct Transform {
    pub sx: f64,
    pub sy: f64,
    pub dx: f64,
    pub dy: f64,
}

/// `stretch` (Path) estica o viewBox até o frame; `meet` (ícone) mantém a proporção, centrado.
pub fn view_transform(vb: Bounds, frame: (f64, f64, f64, f64), meet: bool) -> Transform {
    let (fx, fy, fw, fh) = frame;
    let sx = if vb.w > 0.0 { fw / vb.w } else { 1.0 };
    let sy = if vb.h > 0.0 { fh / vb.h } else { 1.0 };
    if !meet {
        return Transform { sx, sy, dx: fx - vb.x * sx, dy: fy - vb.y * sy };
    }
    let s = (if vb.w > 0.0 { sx } else { sy }).min(if vb.h > 0.0 { sy } else { sx });
    Transform { sx: s, sy: s, dx: fx + (fw - vb.w * s) / 2.0 - vb.x * s, dy: fy + (fh - vb.h * s) / 2.0 - vb.y * s }
}

// ───────────── custGeom ─────────────

#[derive(Clone, Debug)]
pub struct VectorPath {
    pub cmds: Vec<Cmd>,
    pub fill: Option<Rgba>,
    pub stroke: Option<Rgba>,
    /// Em unidades do viewBox (ícone) ou pt (Path).
    pub stroke_width: f64,
    pub cap: Option<&'static str>,
    pub join: Option<&'static str>,
}

/// `<a:custGeom>` com os pontos relativos ao frame, em EMU (como o pptxgenjs).
pub fn cust_geom(cmds: &[Cmd], t: Transform, frame: (f64, f64, f64, f64)) -> String {
    let (fx, fy, fw, fh) = frame;
    let px = |x: f64| emu(((x * t.sx + t.dx) - fx) as f32);
    let py = |y: f64| emu(((y * t.sy + t.dy) - fy) as f32);
    let mut out = format!("<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l=\"l\" t=\"t\" r=\"r\" b=\"b\"/><a:pathLst><a:path w=\"{}\" h=\"{}\">", emu(fw as f32), emu(fh as f32));
    for c in cmds {
        match *c {
            Cmd::M(x, y) => {
                let _ = write!(out, "<a:moveTo><a:pt x=\"{}\" y=\"{}\"/></a:moveTo>", px(x), py(y));
            }
            Cmd::L(x, y) => {
                let _ = write!(out, "<a:lnTo><a:pt x=\"{}\" y=\"{}\"/></a:lnTo>", px(x), py(y));
            }
            Cmd::C(a, b, c2, d, e, f) => {
                let _ = write!(out, "<a:cubicBezTo><a:pt x=\"{}\" y=\"{}\"/><a:pt x=\"{}\" y=\"{}\"/><a:pt x=\"{}\" y=\"{}\"/></a:cubicBezTo>", px(a), py(b), px(c2), py(d), px(e), py(f));
            }
            Cmd::Q(a, b, e, f) => {
                let _ = write!(out, "<a:quadBezTo><a:pt x=\"{}\" y=\"{}\"/><a:pt x=\"{}\" y=\"{}\"/></a:quadBezTo>", px(a), py(b), px(e), py(f));
            }
            Cmd::Z => out.push_str("<a:close/>"),
        }
    }
    out.push_str("</a:path></a:pathLst></a:custGeom>");
    out
}

// ───────────── ícone SVG ─────────────

#[derive(Debug)]
pub enum IconContent {
    Vector(Vec<VectorPath>),
    /// SVG já recolorido, para o raster.
    Raster { svg: String, reason: String },
}

#[derive(Debug)]
pub struct Icon {
    pub view_box: Bounds,
    pub content: IconContent,
}

#[derive(Clone)]
struct Paint {
    fill: String,
    stroke: String,
    width: String,
    cap: String,
    join: String,
}

struct Tag {
    kind: u8, // b'o' abre, b'c' fecha, b's' auto-fechada
    name: String,
    attrs: Vec<(String, String)>,
}

enum Token {
    Tag(Tag),
    Text(String),
}

fn tokens(svg: &str) -> Vec<Token> {
    let mut out = Vec::new();
    let mut rest = svg;
    while !rest.is_empty() {
        let Some(lt) = rest.find('<') else {
            out.push(Token::Text(rest.to_string()));
            break;
        };
        if lt > 0 {
            out.push(Token::Text(rest[..lt].to_string()));
        }
        rest = &rest[lt..];
        for (open, close) in [("<!--", "-->"), ("<?", "?>"), ("<!DOCTYPE", ">"), ("<![CDATA[", "]]>")] {
            if rest.starts_with(open) {
                let end = rest.find(close).map_or(rest.len(), |e| e + close.len());
                if open == "<![CDATA[" {
                    out.push(Token::Text(rest[9..end.saturating_sub(3).max(9)].to_string()));
                }
                rest = &rest[end..];
                break;
            }
        }
        if !rest.starts_with('<') || rest.starts_with("<!") || rest.starts_with("<?") {
            continue;
        }
        let Some(gt) = rest.find('>') else { break };
        let inner = &rest[1..gt];
        rest = &rest[gt + 1..];
        let (kind, inner) = if let Some(n) = inner.strip_prefix('/') {
            (b'c', n)
        } else if let Some(n) = inner.strip_suffix('/') {
            (b's', n)
        } else {
            (b'o', inner)
        };
        let name_end = inner.find(|c: char| c.is_whitespace()).unwrap_or(inner.len());
        let name = inner[..name_end].to_ascii_lowercase();
        let mut attrs = Vec::new();
        let mut a = &inner[name_end..];
        loop {
            a = a.trim_start();
            if a.is_empty() {
                break;
            }
            let key_end = a.find(|c: char| c == '=' || c.is_whitespace()).unwrap_or(a.len());
            let key = a[..key_end].to_string();
            a = a[key_end..].trim_start();
            let value = if let Some(v) = a.strip_prefix('=') {
                let v = v.trim_start();
                let quote = v.chars().next().unwrap_or('"');
                if quote == '"' || quote == '\'' {
                    let end = v[1..].find(quote).map_or(v.len(), |e| e + 1);
                    let val = v[1..end].to_string();
                    a = &v[(end + 1).min(v.len())..];
                    val
                } else {
                    let end = v.find(char::is_whitespace).unwrap_or(v.len());
                    let val = v[..end].to_string();
                    a = &v[end..];
                    val
                }
            } else {
                String::new()
            };
            if !key.is_empty() {
                attrs.push((key, value));
            }
        }
        out.push(Token::Tag(Tag { kind, name, attrs }));
    }
    out
}

fn attr<'a>(t: &'a Tag, name: &str) -> Option<&'a str> {
    t.attrs.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.as_str())
}

fn num_attr(t: &Tag, name: &str) -> f64 {
    attr(t, name).and_then(|v| v.trim().trim_end_matches("px").parse().ok()).unwrap_or(0.0)
}

fn shape_data(t: &Tag) -> Option<String> {
    let n = |k: &str| num_attr(t, k);
    Some(match t.name.as_str() {
        "path" => attr(t, "d").unwrap_or("").to_string(),
        "rect" => {
            let (x, y, w, h) = (n("x"), n("y"), n("width"), n("height"));
            let rxg = attr(t, "rx").map(|_| n("rx"));
            let ryg = attr(t, "ry").map(|_| n("ry"));
            let rx = rxg.or(ryg).unwrap_or(0.0).min(w / 2.0);
            let ry = ryg.or(rxg).unwrap_or(0.0).min(h / 2.0);
            if rx <= 0.0 || ry <= 0.0 {
                format!("M{x} {y} H{} V{} H{x} Z", x + w, y + h)
            } else {
                let arc = |ex: f64, ey: f64| format!("A{rx} {ry} 0 0 1 {ex} {ey}");
                format!(
                    "M{} {y} H{} {} V{} {} H{} {} V{} {} Z",
                    x + rx,
                    x + w - rx,
                    arc(x + w, y + ry),
                    y + h - ry,
                    arc(x + w - rx, y + h),
                    x + rx,
                    arc(x, y + h - ry),
                    y + ry,
                    arc(x + rx, y)
                )
            }
        }
        "circle" | "ellipse" => {
            let (cx, cy) = (n("cx"), n("cy"));
            let (rx, ry) = if t.name == "circle" { (n("r"), n("r")) } else { (n("rx"), n("ry")) };
            format!("M{} {cy} A{rx} {ry} 0 1 0 {} {cy} A{rx} {ry} 0 1 0 {} {cy} Z", cx - rx, cx + rx, cx - rx)
        }
        "line" => format!("M{} {} L{} {}", n("x1"), n("y1"), n("x2"), n("y2")),
        "polygon" | "polyline" => {
            let values: Vec<&str> = attr(t, "points").unwrap_or("").split(|c: char| c.is_whitespace() || c == ',').filter(|s| !s.is_empty()).collect();
            let pairs: Vec<String> = values.chunks(2).map(|p| format!("{} {}", p[0], p.get(1).unwrap_or(&"0"))).collect();
            if pairs.is_empty() {
                String::new()
            } else {
                format!("M{}{}", pairs.join(" L"), if t.name == "polygon" { " Z" } else { "" })
            }
        }
        _ => return None,
    })
}

const IGNORED: &[&str] = &[
    "id", "class", "version", "xml:space", "role", "focusable", "width", "height", "viewbox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
    "stroke-miterlimit", "clip-rule", "baseprofile", "preserveaspectratio", "enable-background", "style", "fill", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "stroke-dashoffset",
];

fn attribute_problem(name: &str, value: &str) -> Option<String> {
    let name = name.to_ascii_lowercase();
    let v = value.trim();
    match name.as_str() {
        "transform" => Some("usa transform".into()),
        "opacity" | "fill-opacity" | "stroke-opacity" => (!matches!(v, "1" | "1.0" | "100%")).then(|| format!("usa {name}")),
        "fill-rule" => (v == "evenodd").then(|| "usa fill-rule evenodd".into()),
        "stroke-dasharray" => (v != "none").then(|| "usa stroke-dasharray".into()),
        "display" | "visibility" => Some("usa display/visibility".into()),
        n if IGNORED.contains(&n) || n.starts_with("xmlns") || n.starts_with("aria-") || n.starts_with("data-") => None,
        n => Some(format!("usa o atributo {n}")),
    }
}

fn paint_of(t: &Tag, inherited: &Paint) -> Result<Paint, String> {
    let mut declared: Vec<(String, String)> = t.attrs.iter().map(|(k, v)| (k.to_ascii_lowercase(), v.clone())).collect();
    if let Some(style) = attr(t, "style") {
        for part in style.split(';') {
            if let Some((k, v)) = part.split_once(':') {
                declared.push((k.trim().to_ascii_lowercase(), v.trim().to_string()));
            }
        }
    }
    let mut p = inherited.clone();
    for (k, v) in &declared {
        if let Some(problem) = attribute_problem(k, v) {
            return Err(problem);
        }
        let v = v.trim().to_string();
        match k.as_str() {
            "fill" => p.fill = v,
            "stroke" => p.stroke = v,
            "stroke-width" => p.width = v,
            "stroke-linecap" => p.cap = v,
            "stroke-linejoin" => p.join = v,
            _ => {}
        }
    }
    Ok(p)
}

fn color_of(value: &str, color: Rgba, recolor: bool) -> Result<Option<Rgba>, String> {
    let t = value.trim();
    if t == "none" {
        return Ok(None);
    }
    if t.eq_ignore_ascii_case("currentcolor") {
        return Ok(Some(color));
    }
    if t.starts_with("url(") {
        return Err("usa gradiente ou padrão (url)".into());
    }
    let c = parse_color(t).ok_or_else(|| format!("cor \"{t}\" não reconhecida"))?;
    if c.a < 1.0 {
        return Err(format!("cor translúcida \"{t}\""));
    }
    if recolor && c.hex() == "000000" {
        return Ok(Some(color));
    }
    Ok(Some(c))
}

fn vector_of(d: &str, p: &Paint, color: Rgba, recolor: bool) -> Result<VectorPath, String> {
    let cmds = parse_path(d).map_err(|e| format!("caminho inválido ({e})"))?;
    let fill = color_of(&p.fill, color, recolor)?;
    let stroke = color_of(&p.stroke, color, recolor)?;
    let cap = match p.cap.as_str() {
        "butt" => Some("flat"),
        "round" => Some("rnd"),
        "square" => Some("sq"),
        other => return Err(format!("stroke-linecap {other}")),
    };
    let join = match p.join.as_str() {
        "miter" | "round" | "bevel" => Some(match p.join.as_str() {
            "round" => "round",
            "bevel" => "bevel",
            _ => "miter",
        }),
        other => return Err(format!("stroke-linejoin {other}")),
    };
    let stroke_width: f64 = p.width.trim().trim_end_matches("px").parse().map_err(|_| format!("stroke-width {}", p.width))?;
    Ok(VectorPath { cmds, fill, stroke, stroke_width, cap, join })
}

fn view_box_of(root: Option<&Tag>) -> Bounds {
    let Some(root) = root else { return Bounds { x: 0.0, y: 0.0, w: 24.0, h: 24.0 } };
    let nums: Vec<f64> = attr(root, "viewBox").unwrap_or("").split(|c: char| c.is_whitespace() || c == ',').filter(|s| !s.is_empty()).filter_map(|s| s.parse().ok()).collect();
    if let [x, y, w, h] = nums[..]
        && w > 0.0 && h > 0.0 {
            return Bounds { x, y, w, h };
        }
    let (w, h) = (num_attr(root, "width"), num_attr(root, "height"));
    if w > 0.0 && h > 0.0 { Bounds { x: 0.0, y: 0.0, w, h } } else { Bounds { x: 0.0, y: 0.0, w: 24.0, h: 24.0 } }
}

/// SVG para o raster: currentColor (e, com recolor, preto) trocados pela cor do ícone.
fn recolored(svg: &str, color: Rgba, recolor: bool) -> String {
    let hex = format!("#{}", color.hex());
    let mut out = svg.replace("currentColor", &hex).replace("currentcolor", &hex);
    if recolor {
        for attr in ["fill", "stroke"] {
            for black in ["#000000", "#000", "black"] {
                for q in ['"', '\''] {
                    out = out.replace(&format!("{attr}={q}{black}{q}"), &format!("{attr}={q}{hex}{q}"));
                }
            }
        }
    }
    out
}

/// Lê o SVG: vetor quando tudo tem de/para exato no custGeom; senão raster com o motivo.
pub fn read_icon(svg: &str, color: Rgba, recolor: bool, force_image: bool) -> Icon {
    let toks = tokens(svg);
    let root = toks.iter().find_map(|t| match t {
        Token::Tag(tag) if tag.name == "svg" => Some(tag),
        _ => None,
    });
    let view_box = view_box_of(root);
    let raster = |reason: &str| Icon { view_box, content: IconContent::Raster { svg: recolored(svg, color, recolor), reason: reason.to_string() } };
    if root.is_none() {
        return raster("o arquivo não tem <svg>");
    }
    if force_image {
        return raster("render=\"image\"");
    }
    let initial = Paint { fill: "black".into(), stroke: "none".into(), width: "1".into(), cap: "butt".into(), join: "miter".into() };
    let mut stack: Vec<Paint> = Vec::new();
    let mut paths = Vec::new();
    let mut skipping = 0;
    for tok in &toks {
        if skipping > 0 {
            match tok {
                Token::Tag(t) if t.kind == b'o' => skipping += 1,
                Token::Tag(t) if t.kind == b'c' => skipping -= 1,
                _ => {}
            }
            continue;
        }
        let tag = match tok {
            Token::Text(t) if t.trim().is_empty() => continue,
            Token::Text(_) => return raster("tem texto"),
            Token::Tag(t) => t,
        };
        let container = tag.name == "svg" || tag.name == "g";
        if tag.kind == b'c' {
            if container {
                stack.pop();
            }
            continue;
        }
        if matches!(tag.name.as_str(), "title" | "desc" | "metadata") {
            if tag.kind == b'o' {
                skipping = 1;
            }
            continue;
        }
        let d = if container { Some(String::new()) } else { shape_data(tag) };
        let Some(d) = d else { return raster(&format!("usa <{}>", tag.name)) };
        let inherited = stack.last().unwrap_or(&initial).clone();
        let paint = match paint_of(tag, &inherited) {
            Ok(p) => p,
            Err(problem) => return raster(&problem),
        };
        if container {
            if tag.kind == b'o' {
                stack.push(paint);
            }
            continue;
        }
        match vector_of(&d, &paint, color, recolor) {
            Ok(v) => paths.push(v),
            Err(problem) => return raster(&problem),
        }
    }
    if paths.is_empty() {
        return raster("nenhuma forma desenhável");
    }
    Icon { view_box, content: IconContent::Vector(paths) }
}

/// PNG do ícone na largura dada (px), sem fontes do sistema.
pub fn rasterize(svg: &str, width_px: u32) -> Option<Vec<u8>> {
    let opt = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_str(svg, &opt).ok()?;
    let size = tree.size();
    let scale = width_px as f32 / size.width().max(1e-3);
    let height = (size.height() * scale).ceil().max(1.0) as u32;
    let mut pixmap = resvg::tiny_skia::Pixmap::new(width_px.max(1), height)?;
    resvg::render(&tree, resvg::tiny_skia::Transform::from_scale(scale, scale), &mut pixmap.as_mut());
    pixmap.encode_png().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_and_implicit_commands() {
        let c = parse_path("m10 10 h5 v5 l-5 0z").unwrap();
        assert_eq!(c, vec![Cmd::M(10.0, 10.0), Cmd::L(15.0, 10.0), Cmd::L(15.0, 15.0), Cmd::L(10.0, 15.0), Cmd::Z]);
    }

    #[test]
    fn arc_bounds_are_the_circle() {
        let c = parse_path("M0 10 A10 10 0 1 0 20 10 A10 10 0 1 0 0 10 Z").unwrap();
        let b = bounds_of(&c);
        assert!((b.w - 20.0).abs() < 0.01 && (b.h - 20.0).abs() < 0.01, "{b:?}");
    }

    #[test]
    fn compact_arc_flags() {
        assert!(parse_path("M0 0a1 1 0 01 5 5").is_ok());
    }
}
