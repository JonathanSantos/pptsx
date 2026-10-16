//! Valores CSS do autor: comprimentos (pt; 'px' vale como pt, como no pptsx), cores,
//! shorthands de espaçamento e de borda.

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Len {
    Pt(f32),
    Pct(f32),
    Auto,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    /// 0..1
    pub a: f32,
}

impl Rgba {
    pub fn hex(self) -> String {
        format!("{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }

    pub fn with_alpha(self, a: f32) -> Rgba {
        Rgba { a: self.a * a, ..self }
    }
}

pub fn parse_len(s: &str) -> Option<Len> {
    let t = s.trim();
    if t == "auto" {
        return Some(Len::Auto);
    }
    if let Some(n) = t.strip_suffix('%') {
        return n.trim().parse::<f32>().ok().map(|v| Len::Pct(v / 100.0));
    }
    let n = t.strip_suffix("px").or_else(|| t.strip_suffix("pt")).unwrap_or(t);
    n.trim().parse::<f32>().ok().map(Len::Pt)
}

/// Shorthand CSS de 1 a 4 valores → (top, right, bottom, left).
pub fn parse_box(s: &str) -> Option<[Len; 4]> {
    let parts: Vec<Len> = s.split_whitespace().map(parse_len).collect::<Option<_>>()?;
    Some(match parts.as_slice() {
        [a] => [*a, *a, *a, *a],
        [v, h] => [*v, *h, *v, *h],
        [t, h, b] => [*t, *h, *b, *h],
        [t, r, b, l] => [*t, *r, *b, *l],
        _ => return None,
    })
}

const NAMED: &[(&str, &str)] = &[
    ("black", "000000"),
    ("white", "FFFFFF"),
    ("red", "FF0000"),
    ("green", "008000"),
    ("blue", "0000FF"),
    ("yellow", "FFFF00"),
    ("orange", "FFA500"),
    ("purple", "800080"),
    ("gray", "808080"),
    ("grey", "808080"),
    ("silver", "C0C0C0"),
    ("navy", "000080"),
    ("teal", "008080"),
    ("maroon", "800000"),
    ("olive", "808000"),
    ("lime", "00FF00"),
    ("aqua", "00FFFF"),
    ("cyan", "00FFFF"),
    ("fuchsia", "FF00FF"),
    ("magenta", "FF00FF"),
    ("pink", "FFC0CB"),
    ("brown", "A52A2A"),
    ("gold", "FFD700"),
    ("indigo", "4B0082"),
    ("violet", "EE82EE"),
    ("crimson", "DC143C"),
    ("coral", "FF7F50"),
    ("tomato", "FF6347"),
    ("salmon", "FA8072"),
    ("khaki", "F0E68C"),
    ("beige", "F5F5DC"),
    ("ivory", "FFFFF0"),
    ("lavender", "E6E6FA"),
    ("whitesmoke", "F5F5F5"),
    ("gainsboro", "DCDCDC"),
    ("lightgray", "D3D3D3"),
    ("lightgrey", "D3D3D3"),
    ("darkgray", "A9A9A9"),
    ("darkgrey", "A9A9A9"),
    ("dimgray", "696969"),
    ("slategray", "708090"),
    ("steelblue", "4682B4"),
    ("royalblue", "4169E1"),
    ("skyblue", "87CEEB"),
    ("tan", "D2B48C"),
];

fn hex_digit_pair(s: &str) -> Option<u8> {
    u8::from_str_radix(s, 16).ok()
}

pub fn parse_color(s: &str) -> Option<Rgba> {
    let t = s.trim();
    let lower = t.to_ascii_lowercase();
    if lower == "transparent" {
        return Some(Rgba { r: 0, g: 0, b: 0, a: 0.0 });
    }
    if let Some((_, hex)) = NAMED.iter().find(|(n, _)| *n == lower) {
        return parse_color(&format!("#{hex}"));
    }
    if let Some(hex) = t.strip_prefix('#') {
        let expand: String;
        let hex = if hex.len() == 3 || hex.len() == 4 {
            expand = hex.chars().flat_map(|c| [c, c]).collect();
            expand.as_str()
        } else {
            hex
        };
        if hex.len() != 6 && hex.len() != 8 {
            return None;
        }
        let r = hex_digit_pair(&hex[0..2])?;
        let g = hex_digit_pair(&hex[2..4])?;
        let b = hex_digit_pair(&hex[4..6])?;
        let a = if hex.len() == 8 { f32::from(hex_digit_pair(&hex[6..8])?) / 255.0 } else { 1.0 };
        return Some(Rgba { r, g, b, a });
    }
    let inner = lower.strip_prefix("rgba(").or_else(|| lower.strip_prefix("rgb("))?.strip_suffix(')')?;
    let parts: Vec<&str> = inner.split([',', '/', ' ']).filter(|p| !p.is_empty()).collect();
    if parts.len() < 3 {
        return None;
    }
    let channel = |p: &str| -> Option<u8> {
        if let Some(pct) = p.strip_suffix('%') {
            return pct.parse::<f32>().ok().map(|v| (v / 100.0 * 255.0).round().clamp(0.0, 255.0) as u8);
        }
        p.parse::<f32>().ok().map(|v| v.round().clamp(0.0, 255.0) as u8)
    };
    let a = match parts.get(3) {
        Some(p) => match p.strip_suffix('%') {
            Some(pct) => pct.parse::<f32>().ok()? / 100.0,
            None => p.parse::<f32>().ok()?,
        },
        None => 1.0,
    };
    Some(Rgba { r: channel(parts[0])?, g: channel(parts[1])?, b: channel(parts[2])?, a: a.clamp(0.0, 1.0) })
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Dash {
    Solid,
    Dashed,
    Dotted,
}

#[derive(Clone, Copy, Debug)]
pub struct Stroke {
    pub width: f32,
    pub color: Rgba,
    pub dash: Dash,
}

/// `border: '1px solid #ccc'` (ordem livre). Número puro = largura sólida preta.
/// `style none` → None. Sem estilo explícito vale sólido (o pptsx também desenha).
pub fn parse_border(s: &str) -> Option<Stroke> {
    let mut width = None;
    let mut color = None;
    let mut dash = Dash::Solid;
    for token in s.split_whitespace() {
        match token {
            "none" | "hidden" => return None,
            "solid" => dash = Dash::Solid,
            "dashed" => dash = Dash::Dashed,
            "dotted" => dash = Dash::Dotted,
            "thin" => width = Some(1.0),
            "medium" => width = Some(3.0),
            "thick" => width = Some(5.0),
            t => match parse_len(t) {
                Some(Len::Pt(w)) => width = Some(w),
                _ => color = parse_color(t).or(color),
            },
        }
    }
    let width = width.unwrap_or(3.0);
    if width <= 0.0 {
        return None;
    }
    Some(Stroke { width, color: color.unwrap_or(Rgba { r: 0, g: 0, b: 0, a: 1.0 }), dash })
}
