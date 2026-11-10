//! Gradiente CSS (`linear-gradient`, `radial-gradient(circle, …)`) → `<a:gradFill>` do DrawingML
//! e `<linearGradient>`/`<radialGradient>` do SVG do preview.

use std::fmt::Write as _;

use crate::css::{Rgba, parse_color};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Direction {
    /// Ângulo CSS em graus: 0 aponta para cima, sentido horário.
    Angle(f32),
    /// `to <canto>`: sinais de x e y (y para baixo). O ângulo depende da proporção da caixa.
    Corner(f32, f32),
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum GradientKind {
    Linear(Direction),
    /// Círculo centrado que chega aos cantos (farthest-corner, o padrão do CSS).
    Radial,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Stop {
    /// 0..1 ao longo da linha do gradiente.
    pub pos: f32,
    pub color: Rgba,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Gradient {
    pub kind: GradientKind,
    pub stops: Vec<Stop>,
}

/// O valor começa como um gradiente CSS (suportado ou não)?
pub fn looks_like_gradient(s: &str) -> bool {
    let t = s.trim_start().to_ascii_lowercase();
    ["linear-gradient(", "radial-gradient(", "conic-gradient(", "repeating-linear-gradient(", "repeating-radial-gradient(", "repeating-conic-gradient("].iter().any(|p| t.starts_with(p))
}

/// Vírgulas fora de parênteses (as de `rgba(…)` não separam paradas).
fn split_top_level(s: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let (mut depth, mut start) = (0_i32, 0);
    for (i, ch) in s.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                parts.push(s[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    parts.push(s[start..].trim());
    parts
}

fn parse_angle(t: &str) -> Option<f32> {
    let unit = |suffix: &str, to_deg: f32| t.strip_suffix(suffix).and_then(|n| n.trim().parse::<f32>().ok()).filter(|n| n.is_finite()).map(|n| n * to_deg);
    // "grad" antes de "rad": um termina no outro.
    unit("deg", 1.0).or_else(|| unit("grad", 0.9)).or_else(|| unit("rad", 180.0 / std::f32::consts::PI)).or_else(|| unit("turn", 360.0)).or_else(|| (t == "0").then_some(0.0))
}

fn parse_direction(t: &str) -> Option<Direction> {
    let Some(side) = t.strip_prefix("to ") else { return parse_angle(t).map(Direction::Angle) };
    let (mut x, mut y) = (0.0_f32, 0.0_f32);
    let words: Vec<&str> = side.split_whitespace().collect();
    if words.is_empty() || words.len() > 2 {
        return None;
    }
    for w in words {
        match w {
            "left" if x == 0.0 => x = -1.0,
            "right" if x == 0.0 => x = 1.0,
            "top" if y == 0.0 => y = -1.0,
            "bottom" if y == 0.0 => y = 1.0,
            _ => return None,
        }
    }
    Some(match (x, y) {
        (0.0, -1.0) => Direction::Angle(0.0),
        (1.0, 0.0) => Direction::Angle(90.0),
        (0.0, 1.0) => Direction::Angle(180.0),
        (-1.0, 0.0) => Direction::Angle(270.0),
        _ => Direction::Corner(x, y),
    })
}

/// `cor [pos% [pos%]]` → a cor e as posições escritas (0..1).
fn parse_stop(t: &str) -> Option<(Rgba, Vec<f32>)> {
    let mut rest = t.trim();
    let mut positions = Vec::new();
    while let Some(head) = rest.strip_suffix('%') {
        let cut = head.rfind(|c: char| c.is_whitespace() || c == ')').map_or(0, |i| i + 1);
        positions.insert(0, head[cut..].parse::<f32>().ok().filter(|n| n.is_finite())? / 100.0);
        rest = head[..cut].trim_end();
    }
    if positions.len() > 2 {
        return None;
    }
    Some((parse_color(rest)?, positions))
}

/// Regras do CSS para posições omitidas: a primeira vale 0, a última 1, as do meio se
/// distribuem por igual entre as vizinhas escritas; nenhuma parada fica antes da anterior.
fn fill_positions(raw: Vec<(Rgba, Option<f32>)>) -> Vec<Stop> {
    let mut pos: Vec<Option<f32>> = raw.iter().map(|(_, p)| *p).collect();
    let last = pos.len() - 1;
    pos[0] = pos[0].or(Some(0.0));
    pos[last] = pos[last].or(Some(1.0));
    let mut floor = 0.0_f32;
    for p in pos.iter_mut().flatten() {
        *p = p.max(floor);
        floor = *p;
    }
    let mut i = 1;
    while i < last {
        if pos[i].is_some() {
            i += 1;
            continue;
        }
        let end = (i..=last).find(|&j| pos[j].is_some()).unwrap_or(last);
        let (a, b) = (pos[i - 1].unwrap_or(0.0), pos[end].unwrap_or(1.0));
        let span = (end - i + 1) as f32;
        for (k, slot) in pos[i..end].iter_mut().enumerate() {
            *slot = Some(a + (b - a) * (k + 1) as f32 / span);
        }
        i = end;
    }
    raw.iter().zip(pos).map(|((color, _), p)| Stop { pos: p.unwrap_or(0.0).clamp(0.0, 1.0), color: *color }).collect()
}

fn parse_stops(parts: &[&str]) -> Result<Vec<Stop>, String> {
    let mut raw = Vec::new();
    for part in parts {
        let (color, positions) = parse_stop(part).ok_or_else(|| format!("parada \"{part}\" fora do suportado (use cor e, se quiser, a posição em %)"))?;
        match positions.as_slice() {
            [] => raw.push((color, None)),
            list => raw.extend(list.iter().map(|p| (color, Some(*p)))),
        }
    }
    if raw.len() < 2 {
        return Err("o gradiente precisa de pelo menos 2 paradas de cor".into());
    }
    Ok(fill_positions(raw))
}

/// O gradiente do autor, ou o motivo (em português) de ele não sair no PPTX.
pub fn parse_gradient(s: &str) -> Result<Gradient, String> {
    let t = s.trim();
    let lower = t.to_ascii_lowercase();
    let body = |prefix: &str| lower.strip_prefix(prefix).and_then(|r| r.strip_suffix(')'));
    let balanced = |inner: &str| inner.chars().try_fold(0_i32, |d, c| match c {
        '(' => Some(d + 1),
        ')' if d == 0 => None,
        ')' => Some(d - 1),
        _ => Some(d),
    }) == Some(0);
    if let Some(inner) = body("linear-gradient(") {
        if !balanced(inner) {
            return Err("só um gradiente por fundo (camadas separadas por vírgula não saem)".into());
        }
        let parts = split_top_level(inner);
        let first = parts.first().copied().unwrap_or_default();
        let (direction, stops) = match parse_direction(first) {
            Some(d) => (d, &parts[1..]),
            None if parse_stop(first).is_some() => (Direction::Angle(180.0), &parts[..]),
            None => return Err(format!("direção \"{first}\" fora do suportado (use um ângulo como 90deg ou \"to right\", \"to bottom left\"…)")),
        };
        return Ok(Gradient { kind: GradientKind::Linear(direction), stops: parse_stops(stops)? });
    }
    if let Some(inner) = body("radial-gradient(") {
        if !balanced(inner) {
            return Err("só um gradiente por fundo (camadas separadas por vírgula não saem)".into());
        }
        let parts = split_top_level(inner);
        let first = parts.first().copied().unwrap_or_default();
        if !matches!(first, "circle" | "circle at center" | "circle farthest-corner" | "circle farthest-corner at center") {
            return Err("do radial só sai radial-gradient(circle, cor, cor…): círculo centrado até os cantos (elipse, tamanho e posição não têm de/para)".into());
        }
        return Ok(Gradient { kind: GradientKind::Radial, stops: parse_stops(&parts[1..])? });
    }
    Err("só linear-gradient(…) e radial-gradient(circle, …) saem no PPTX (conic e repeating não têm de/para)".into())
}

impl Direction {
    /// Ângulo CSS (graus) numa caixa w × h. `to <canto>`: a linha de 50% passa pelos outros dois
    /// cantos, então a direção é perpendicular a essa diagonal.
    pub fn css_angle(self, w: f32, h: f32) -> f32 {
        match self {
            Direction::Angle(a) => a.rem_euclid(360.0),
            Direction::Corner(sx, sy) => (sx * h).atan2(-sy * w).to_degrees().rem_euclid(360.0),
        }
    }
}

/// Ângulo CSS (0 = para cima, horário) → `ang` do `<a:lin>` (0 = esquerda→direita, horário), em
/// 60000-avos de grau.
pub fn drawingml_angle(css_deg: f32) -> i64 {
    (f64::from((css_deg - 90.0).rem_euclid(360.0)) * 60000.0).round() as i64 % 21_600_000
}

/// Extremos da linha do gradiente CSS numa caixa (x, y, w, h): passa pelo centro e tem o
/// comprimento que põe 0% e 100% nos cantos.
pub fn line_points(css_deg: f32, x: f32, y: f32, w: f32, h: f32) -> (f32, f32, f32, f32) {
    let (sin, cos) = css_deg.to_radians().sin_cos();
    let half = ((w * sin).abs() + (h * cos).abs()) / 2.0;
    let (cx, cy) = (x + w / 2.0, y + h / 2.0);
    (cx - sin * half, cy + cos * half, cx + sin * half, cy - cos * half)
}

fn color_xml(c: Rgba) -> String {
    if c.a >= 0.999 {
        return format!("<a:srgbClr val=\"{}\"/>", c.hex());
    }
    format!("<a:srgbClr val=\"{}\"><a:alpha val=\"{}\"/></a:srgbClr>", c.hex(), (c.a * 100000.0).round() as i64)
}

impl Gradient {
    /// `<a:gradFill>` numa caixa w × h, com a opacidade herdada multiplicada no alfa das paradas.
    pub fn fill_xml(&self, w: f32, h: f32, opacity: f32) -> String {
        let mut out = String::from("<a:gradFill flip=\"none\" rotWithShape=\"1\"><a:gsLst>");
        // Corte seco (duas paradas na mesma posição): o Keynote descarta a segunda parada de uma
        // posição repetida, então ela sai 1 milésimo de ponto percentual adiante.
        let mut last = -1_i64;
        for s in &self.stops {
            let pos = ((s.pos * 100000.0).round() as i64).max(last + 1).min(100_000);
            last = pos;
            let _ = write!(out, "<a:gs pos=\"{pos}\">{}</a:gs>", color_xml(s.color.with_alpha(opacity)));
        }
        out.push_str("</a:gsLst>");
        match self.kind {
            // scaled="0": o ângulo é o da tela, não se deforma com a proporção da forma.
            GradientKind::Linear(d) => {
                let _ = write!(out, "<a:lin ang=\"{}\" scaled=\"0\"/>", drawingml_angle(d.css_angle(w, h)));
            }
            GradientKind::Radial => out.push_str("<a:path path=\"circle\"><a:fillToRect l=\"50000\" t=\"50000\" r=\"50000\" b=\"50000\"/></a:path>"),
        }
        out.push_str("</a:gradFill>");
        out
    }

    /// Definição SVG (`<defs>`) do gradiente na caixa dada, em coordenadas do slide.
    pub fn svg_def(&self, id: &str, (x, y, w, h): (f32, f32, f32, f32), opacity: f32) -> String {
        let stops: String = self.stops.iter().map(|s| format!("<stop offset=\"{:.4}\" stop-color=\"#{}\" stop-opacity=\"{:.3}\"/>", s.pos, s.color.hex(), s.color.a * opacity)).collect();
        match self.kind {
            GradientKind::Linear(d) => {
                let (x1, y1, x2, y2) = line_points(d.css_angle(w, h), x, y, w, h);
                format!("<defs><linearGradient id=\"{id}\" gradientUnits=\"userSpaceOnUse\" x1=\"{x1:.2}\" y1=\"{y1:.2}\" x2=\"{x2:.2}\" y2=\"{y2:.2}\">{stops}</linearGradient></defs>")
            }
            GradientKind::Radial => format!("<defs><radialGradient id=\"{id}\" gradientUnits=\"userSpaceOnUse\" cx=\"{:.2}\" cy=\"{:.2}\" r=\"{:.2}\">{stops}</radialGradient></defs>", x + w / 2.0, y + h / 2.0, w.hypot(h) / 2.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn positions(g: &Gradient) -> Vec<f32> {
        g.stops.iter().map(|s| (s.pos * 1000.0).round() / 1000.0).collect()
    }

    #[test]
    fn parses_angle_and_two_stops() {
        let g = parse_gradient("linear-gradient(90deg, #2A2F9E, #FF6A3D)").unwrap();
        assert_eq!(g.kind, GradientKind::Linear(Direction::Angle(90.0)));
        assert_eq!(positions(&g), vec![0.0, 1.0]);
        assert_eq!(g.stops[0].color.hex(), "2A2F9E");
        assert_eq!(g.stops[1].color.hex(), "FF6A3D");
    }

    #[test]
    fn parses_keywords_default_direction_and_units() {
        let dir = |s: &str| match parse_gradient(s).unwrap().kind {
            GradientKind::Linear(d) => d,
            GradientKind::Radial => panic!("linear esperado"),
        };
        assert_eq!(dir("linear-gradient(to right, red, blue)"), Direction::Angle(90.0));
        assert_eq!(dir("linear-gradient(to top, red, blue)"), Direction::Angle(0.0));
        assert_eq!(dir("linear-gradient(red, blue)"), Direction::Angle(180.0));
        assert_eq!(dir("linear-gradient(0.25turn, red, blue)"), Direction::Angle(90.0));
        assert_eq!(dir("linear-gradient(100grad, red, blue)"), Direction::Angle(90.0));
        assert_eq!(dir("linear-gradient(to bottom right, red, blue)"), Direction::Corner(1.0, 1.0));
        assert_eq!(dir("LINEAR-GRADIENT(TO LEFT TOP, red, blue)"), Direction::Corner(-1.0, -1.0));
    }

    #[test]
    fn stops_keep_alpha_and_commas_inside_rgba() {
        let g = parse_gradient("linear-gradient(45deg, rgba(102, 0, 153, 0.5) 10%, #FFFFFF00 90%)").unwrap();
        assert_eq!(positions(&g), vec![0.1, 0.9]);
        assert!((g.stops[0].color.a - 0.5).abs() < 1e-6);
        assert_eq!(g.stops[1].color.a, 0.0);
    }

    #[test]
    fn missing_positions_are_spread_and_never_go_back() {
        let g = parse_gradient("linear-gradient(to right, red, green, blue, white 80%, black)").unwrap();
        assert_eq!(positions(&g), vec![0.0, 0.267, 0.533, 0.8, 1.0]);
        let g = parse_gradient("linear-gradient(red 60%, blue 20%, white)").unwrap();
        assert_eq!(positions(&g), vec![0.6, 0.6, 1.0]);
        let g = parse_gradient("linear-gradient(red 0% 50%, blue 50% 100%)").unwrap();
        assert_eq!(positions(&g), vec![0.0, 0.5, 0.5, 1.0]);
    }

    #[test]
    fn rejects_what_has_no_mapping() {
        for bad in [
            "linear-gradient(red)",
            "linear-gradient(to nowhere, red, blue)",
            "linear-gradient(90deg, red 10px, blue)",
            "linear-gradient(90deg, red, 30%, blue)",
            "linear-gradient(red, blue), linear-gradient(blue, red)",
            "repeating-linear-gradient(red, blue)",
            "conic-gradient(red, blue)",
            "radial-gradient(red, blue)",
            "radial-gradient(ellipse, red, blue)",
            "radial-gradient(circle at top left, red, blue)",
            "url(a.png)",
        ] {
            assert!(parse_gradient(bad).is_err(), "{bad}");
        }
        assert!(parse_gradient("radial-gradient(circle, red, blue)").is_ok());
    }

    #[test]
    fn css_angle_becomes_drawingml_angle() {
        assert_eq!(drawingml_angle(90.0), 0); // to right
        assert_eq!(drawingml_angle(180.0), 5_400_000); // to bottom
        assert_eq!(drawingml_angle(270.0), 10_800_000); // to left
        assert_eq!(drawingml_angle(0.0), 16_200_000); // to top
        assert_eq!(drawingml_angle(45.0), 18_900_000); // para cima e à direita
        assert_eq!(drawingml_angle(135.0), 2_700_000); // para baixo e à direita
        assert_eq!(drawingml_angle(-90.0), 10_800_000);
        assert_eq!(drawingml_angle(450.0), 0);
    }

    #[test]
    fn corner_direction_depends_on_the_box() {
        let d = Direction::Corner(1.0, 1.0);
        assert!((d.css_angle(100.0, 100.0) - 135.0).abs() < 1e-3);
        // Caixa larga: a linha fica mais vertical (perpendicular à diagonal).
        assert!((d.css_angle(200.0, 100.0) - 153.435).abs() < 1e-2);
        assert!((Direction::Corner(-1.0, -1.0).css_angle(100.0, 100.0) - 315.0).abs() < 1e-3);
    }

    #[test]
    fn line_reaches_the_corners() {
        let close = |a: (f32, f32, f32, f32), b: (f32, f32, f32, f32)| [(a.0, b.0), (a.1, b.1), (a.2, b.2), (a.3, b.3)].iter().all(|(x, y)| (x - y).abs() < 1e-3);
        assert!(close(line_points(90.0, 0.0, 0.0, 200.0, 100.0), (0.0, 50.0, 200.0, 50.0)));
        assert!(close(line_points(180.0, 10.0, 20.0, 200.0, 100.0), (110.0, 20.0, 110.0, 120.0)));
        // 45° num quadrado: de um canto ao outro.
        assert!(close(line_points(45.0, 0.0, 0.0, 100.0, 100.0), (0.0, 100.0, 100.0, 0.0)));
    }

    #[test]
    fn fill_xml_carries_stops_alpha_and_angle() {
        let g = parse_gradient("linear-gradient(to right, #2A2F9E, rgba(255, 106, 61, 0.5))").unwrap();
        assert_eq!(
            g.fill_xml(200.0, 100.0, 1.0),
            "<a:gradFill flip=\"none\" rotWithShape=\"1\"><a:gsLst><a:gs pos=\"0\"><a:srgbClr val=\"2A2F9E\"/></a:gs><a:gs pos=\"100000\"><a:srgbClr val=\"FF6A3D\"><a:alpha val=\"50000\"/></a:srgbClr></a:gs></a:gsLst><a:lin ang=\"0\" scaled=\"0\"/></a:gradFill>"
        );
        assert!(g.fill_xml(200.0, 100.0, 0.5).contains("<a:alpha val=\"25000\"/>"));
    }
}
