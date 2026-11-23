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
    // Unidades e `auto` sem caixa, como no CSS e no validate: "2PX" vale 2 pt.
    let lower = s.trim().to_ascii_lowercase();
    let t = lower.as_str();
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
        // As fatias abaixo são por byte: um `é` no meio cortaria um caractere ao meio (panic).
        if !hex.is_ascii() {
            return None;
        }
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

/// Palavras separadas por espaço fora de parênteses: `rgba(0, 0, 0, 0.5)` é uma palavra só.
fn words(s: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let (mut depth, mut start) = (0_i32, None);
    for (i, ch) in s.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => depth -= 1,
            c if c.is_whitespace() && depth <= 0 => {
                out.extend(start.take().map(|st| &s[st..i]));
                continue;
            }
            _ => {}
        }
        start.get_or_insert(i);
    }
    out.extend(start.map(|st| &s[st..]));
    out
}

/// `border: '1px solid #ccc'` (ordem livre). Número puro = largura sólida preta.
/// `style none` → None. Sem estilo explícito vale sólido (o pptsx também desenha). Uma palavra que não é
/// largura, estilo nem cor também → None: o validate a reporta como `css-not-emitted` ("ignorado"), e o
/// arquivo tem de bater com isso em vez de desenhar uma borda preta.
pub fn parse_border(s: &str) -> Option<Stroke> {
    let mut width = None;
    let mut color = None;
    let mut dash = Dash::Solid;
    for word in words(s) {
        // Palavras-chave sem caixa ("Solid", "DASHED"), como o validate as aceita.
        let token = word.to_ascii_lowercase();
        match token.as_str() {
            "none" | "hidden" => return None,
            "solid" => dash = Dash::Solid,
            "dashed" => dash = Dash::Dashed,
            "dotted" => dash = Dash::Dotted,
            "thin" => width = Some(1.0),
            "medium" => width = Some(3.0),
            "thick" => width = Some(5.0),
            t => match parse_len(t) {
                Some(Len::Pt(w)) => width = Some(w),
                _ => color = Some(parse_color(t)?),
            },
        }
    }
    let width = width.unwrap_or(3.0);
    if width <= 0.0 {
        return None;
    }
    Some(Stroke { width, color: color.unwrap_or(Rgba { r: 0, g: 0, b: 0, a: 1.0 }), dash })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rgba(r: u8, g: u8, b: u8, a: f32) -> Rgba {
        Rgba { r, g, b, a }
    }

    #[test]
    fn len_accepts_pt_px_percent_and_auto() {
        assert_eq!(parse_len("12"), Some(Len::Pt(12.0)));
        assert_eq!(parse_len("12px"), Some(Len::Pt(12.0)));
        assert_eq!(parse_len(" 8.5pt "), Some(Len::Pt(8.5)));
        assert_eq!(parse_len("50%"), Some(Len::Pct(0.5)));
        assert_eq!(parse_len("auto"), Some(Len::Auto));
    }

    #[test]
    fn len_units_ignore_case_like_css() {
        assert_eq!(parse_len("2PX"), Some(Len::Pt(2.0)));
        assert_eq!(parse_len("3Pt"), Some(Len::Pt(3.0)));
        assert_eq!(parse_len("AUTO"), Some(Len::Auto));
    }

    #[test]
    fn len_rejects_unknown_units_and_garbage() {
        assert_eq!(parse_len("12em"), None);
        assert_eq!(parse_len("abc"), None);
        assert_eq!(parse_len(""), None);
    }

    #[test]
    fn box_shorthand_expands_one_to_four_values_like_css() {
        let pt = Len::Pt;
        assert_eq!(parse_box("8"), Some([pt(8.0); 4]));
        assert_eq!(parse_box("8 16"), Some([pt(8.0), pt(16.0), pt(8.0), pt(16.0)]));
        assert_eq!(parse_box("1 2 3"), Some([pt(1.0), pt(2.0), pt(3.0), pt(2.0)]));
        assert_eq!(parse_box("1 2 3 4"), Some([pt(1.0), pt(2.0), pt(3.0), pt(4.0)]));
    }

    #[test]
    fn box_shorthand_rejects_five_values_empty_and_bad_parts() {
        assert_eq!(parse_box("1 2 3 4 5"), None);
        assert_eq!(parse_box(""), None);
        assert_eq!(parse_box("1 x"), None);
    }

    #[test]
    fn color_hex_short_long_and_with_alpha() {
        assert_eq!(parse_color("#abc"), Some(rgba(0xAA, 0xBB, 0xCC, 1.0)));
        assert_eq!(parse_color("#1F2933"), Some(rgba(0x1F, 0x29, 0x33, 1.0)));
        assert_eq!(parse_color("#abcd"), Some(rgba(0xAA, 0xBB, 0xCC, f32::from(0xDDu8) / 255.0)));
        assert_eq!(parse_color("#00000080"), Some(rgba(0, 0, 0, 128.0 / 255.0)));
    }

    #[test]
    fn color_names_are_case_insensitive_and_transparent_has_no_alpha() {
        assert_eq!(parse_color("Red"), Some(rgba(0xFF, 0, 0, 1.0)));
        assert_eq!(parse_color("grey"), parse_color("gray"));
        assert_eq!(parse_color("transparent").map(|c| c.a), Some(0.0));
    }

    #[test]
    fn color_rgb_functions_with_commas_spaces_percent_and_slash_alpha() {
        assert_eq!(parse_color("rgb(255, 0, 0)"), Some(rgba(255, 0, 0, 1.0)));
        assert_eq!(parse_color("rgba(0,0,0,0.5)"), Some(rgba(0, 0, 0, 0.5)));
        assert_eq!(parse_color("rgb(100% 0% 0% / 50%)"), Some(rgba(255, 0, 0, 0.5)));
        // Canal fora da faixa é limitado, como no navegador.
        assert_eq!(parse_color("rgb(300, -5, 0)"), Some(rgba(255, 0, 0, 1.0)));
    }

    #[test]
    fn color_rejects_malformed_values() {
        for bad in ["#12345", "#gg0000", "notacolor", "rgb(1, 2)", "rgb(1, 2, 3", ""] {
            assert_eq!(parse_color(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn color_hex_and_alpha_helpers() {
        assert_eq!(rgba(1, 2, 255, 1.0).hex(), "0102FF");
        assert_eq!(rgba(0, 0, 0, 0.5).with_alpha(0.5).a, 0.25);
    }

    #[test]
    fn border_reads_width_style_and_color_in_any_order() {
        let b = parse_border("1px solid #ccc").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (1.0, rgba(0xCC, 0xCC, 0xCC, 1.0), Dash::Solid));
        let b = parse_border("#ccc dashed 2").expect("borda");
        assert_eq!((b.width, b.dash), (2.0, Dash::Dashed));
        let b = parse_border("thin dotted").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (1.0, rgba(0, 0, 0, 1.0), Dash::Dotted));
    }

    #[test]
    fn border_without_width_is_medium_and_a_bare_number_is_solid_black() {
        assert_eq!(parse_border("solid red").map(|b| b.width), Some(3.0));
        let b = parse_border("2").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (2.0, rgba(0, 0, 0, 1.0), Dash::Solid));
    }

    #[test]
    fn color_hex_with_non_ascii_is_invalid_instead_of_panicking() {
        for bad in ["#aéaaa", "#é", "#ééé", "#aaaaéa", "#☃"] {
            assert_eq!(parse_color(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn words_keep_function_arguments_together() {
        assert_eq!(words("  1px solid rgba(1, 2, 3, 0.5)  "), ["1px", "solid", "rgba(1, 2, 3, 0.5)"]);
        assert_eq!(words("rgb(1 2 3) dashed"), ["rgb(1 2 3)", "dashed"]);
        assert!(words("   ").is_empty());
    }

    #[test]
    fn border_color_function_may_have_spaces_inside() {
        let b = parse_border("2px solid rgba(255, 0, 0, 0.5)").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (2.0, rgba(255, 0, 0, 0.5), Dash::Solid));
        let b = parse_border("rgb(0 128 0) dotted 1").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (1.0, rgba(0, 128, 0, 1.0), Dash::Dotted));
    }

    #[test]
    fn border_keywords_and_units_ignore_case() {
        let b = parse_border("1px Solid red").expect("borda");
        assert_eq!((b.width, b.color, b.dash), (1.0, rgba(255, 0, 0, 1.0), Dash::Solid));
        assert_eq!(parse_border("1px DASHED #ccc").map(|b| b.dash), Some(Dash::Dashed));
        assert_eq!(parse_border("2PX solid RED").map(|b| (b.width, b.color)), Some((2.0, rgba(255, 0, 0, 1.0))));
        assert!(parse_border("NONE").is_none());
    }

    #[test]
    fn border_with_an_unknown_word_draws_nothing_instead_of_black() {
        for bad in ["1px solid #aéaaa", "1px solid notacolor", "50% solid red"] {
            assert!(parse_border(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn border_none_hidden_and_zero_width_draw_nothing() {
        assert!(parse_border("none").is_none());
        assert!(parse_border("1px hidden red").is_none());
        assert!(parse_border("0 solid red").is_none());
    }
}
