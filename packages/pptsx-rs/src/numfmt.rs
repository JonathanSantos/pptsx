//! Códigos de formato numérico do Excel mais comuns, para o preview mostrar o rótulo como o
//! PowerPoint mostra (`0`, `0.0`, `0%`, `#,##0`, literais entre aspas, seções `pos;neg;zero`).

/// Separadores do idioma do deck.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Locale {
    pub decimal: char,
    pub group: char,
}

impl Locale {
    /// Pelo `lang` do deck (BCP 47): inglês e os idiomas do leste da Ásia usam ponto decimal;
    /// francês e os eslavos agrupam com espaço; o resto (pt, es, de, it…) usa vírgula e ponto.
    pub fn of(lang: &str) -> Locale {
        let primary = lang.split(['-', '_']).next().unwrap_or_default().to_ascii_lowercase();
        match primary.as_str() {
            "en" | "ja" | "zh" | "ko" | "he" | "th" | "hi" => Locale { decimal: '.', group: ',' },
            "fr" | "ru" | "pl" | "cs" | "sk" | "uk" | "bg" | "sv" | "nb" | "no" | "fi" => Locale { decimal: ',', group: '\u{a0}' },
            _ => Locale { decimal: ',', group: '.' },
        }
    }
}

#[derive(Debug, Default, PartialEq)]
struct Pattern {
    prefix: String,
    suffix: String,
    /// Zeros obrigatórios da parte inteira.
    min_integer: usize,
    grouped: bool,
    /// Casas fixas (`0`) e opcionais (`#`) depois do ponto.
    fixed: usize,
    optional: usize,
    percent: bool,
}

/// Seções separadas por `;` fora de aspas.
fn sections(code: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let (mut quoted, mut start) = (false, 0);
    for (i, ch) in code.char_indices() {
        match ch {
            '"' => quoted = !quoted,
            ';' if !quoted => {
                out.push(&code[start..i]);
                start = i + 1;
            }
            _ => {}
        }
    }
    out.push(&code[start..]);
    out
}

/// Literal que o Excel aceita sem aspas.
fn bare_literal(c: char) -> bool {
    matches!(c, ' ' | '$' | '-' | '+' | '/' | '(' | ')' | ':' | '!' | '&' | '~' | '{' | '}' | '<' | '>' | '=' | '^' | '\u{a0}') || (!c.is_ascii() && c.is_alphanumeric()) || matches!(c, '€' | '£' | '¥' | '°')
}

fn parse_section(code: &str) -> Option<Pattern> {
    let mut p = Pattern::default();
    // 0 = prefixo, 1 = parte inteira, 2 = decimais, 3 = sufixo.
    let mut stage = 0;
    let mut digits = false;
    let mut chars = code.chars().peekable();
    while let Some(c) = chars.next() {
        let literal = |p: &mut Pattern, stage: &mut i32, text: &str| {
            if *stage == 0 {
                p.prefix.push_str(text);
            } else {
                *stage = 3;
                p.suffix.push_str(text);
            }
        };
        match c {
            '"' => {
                let text: String = chars.by_ref().take_while(|c| *c != '"').collect();
                literal(&mut p, &mut stage, &text);
            }
            '\\' => literal(&mut p, &mut stage, &chars.next()?.to_string()),
            // `_x` deixa o espaço de um caractere; `*x` repete: no rótulo, nada.
            '_' | '*' => {
                chars.next()?;
            }
            '0' | '#' if stage <= 1 => {
                stage = 1;
                digits = true;
                if c == '0' {
                    p.min_integer += 1;
                }
            }
            ',' if stage == 1 => {
                // Vírgula no fim da parte inteira divide por mil: fora do suportado.
                if !matches!(chars.peek(), Some('0' | '#')) {
                    return None;
                }
                p.grouped = true;
            }
            '.' if stage <= 1 => stage = 2,
            '0' if stage == 2 && p.optional == 0 => p.fixed += 1,
            '#' if stage == 2 => p.optional += 1,
            '%' if !p.percent => {
                p.percent = true;
                literal(&mut p, &mut stage, "%");
            }
            c if bare_literal(c) => literal(&mut p, &mut stage, &c.to_string()),
            _ => return None,
        }
    }
    digits.then_some(p)
}

fn group_thousands(digits: &str, sep: char) -> String {
    let mut out = String::new();
    for (i, d) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push(sep);
        }
        out.push(d);
    }
    out
}

fn apply(p: &Pattern, magnitude: f64, locale: Locale) -> String {
    let scaled = if p.percent { magnitude * 100.0 } else { magnitude };
    let places = p.fixed + p.optional;
    // O Excel arredonda o meio para longe do zero (18,5 → 19); o `format!` arredondaria para o par.
    let factor = 10f64.powi(places as i32);
    let rounded = (scaled * factor * (1.0 + 1e-12)).round() / factor;
    let text = format!("{rounded:.places$}");
    let (int, frac) = text.split_once('.').unwrap_or((&text, ""));
    let keep = frac.trim_end_matches('0').len().max(p.fixed);
    let frac = &frac[..keep];
    let mut int = if p.min_integer == 0 && int == "0" && !frac.is_empty() { String::new() } else { format!("{int:0>width$}", width = p.min_integer) };
    if p.grouped {
        int = group_thousands(&int, locale.group);
    }
    let number = if frac.is_empty() { int } else { format!("{int}{}{frac}", locale.decimal) };
    format!("{}{number}{}", p.prefix, p.suffix)
}

/// O valor no formato dado, ou None se o código foge do subconjunto (e para `General`).
pub fn format_number(value: f64, code: &str, locale: Locale) -> Option<String> {
    if !value.is_finite() || code.trim().is_empty() || code.trim().eq_ignore_ascii_case("general") {
        return None;
    }
    let parts = sections(code);
    if parts.len() > 3 {
        return None;
    }
    let patterns: Vec<Pattern> = parts.iter().map(|s| parse_section(s)).collect::<Option<_>>()?;
    let positive = &patterns[0];
    // Zero é o que o formato arredonda para zero (0,04 em "0.0" não leva sinal).
    let rounds_to_zero = |p: &Pattern| apply(p, value.abs(), locale) == apply(p, 0.0, locale);
    if let Some(zero) = patterns.get(2).filter(|_| value == 0.0) {
        return Some(apply(zero, 0.0, locale));
    }
    if value >= 0.0 {
        return Some(apply(positive, value, locale));
    }
    // A seção de negativos já traz o sinal (ou os parênteses) que o autor quis.
    if let Some(negative) = patterns.get(1) {
        return Some(apply(negative, -value, locale));
    }
    let sign = if rounds_to_zero(positive) { "" } else { "-" };
    Some(format!("{sign}{}", apply(positive, -value, locale)))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PT: Locale = Locale { decimal: ',', group: '.' };
    const EN: Locale = Locale { decimal: '.', group: ',' };

    fn pt(v: f64, code: &str) -> Option<String> {
        format_number(v, code, PT)
    }

    #[test]
    fn locale_follows_the_deck_language() {
        assert_eq!(Locale::of("pt-BR"), PT);
        assert_eq!(Locale::of("en-US"), EN);
        assert_eq!(Locale::of("es"), PT);
        assert_eq!(Locale::of("fr-FR"), Locale { decimal: ',', group: '\u{a0}' });
    }

    #[test]
    fn integers_and_fixed_decimals() {
        assert_eq!(pt(18.0, "0").as_deref(), Some("18"));
        assert_eq!(pt(18.5, "0").as_deref(), Some("19"));
        assert_eq!(pt(18.0, "0.0").as_deref(), Some("18,0"));
        assert_eq!(pt(18.26, "0.0").as_deref(), Some("18,3"));
        assert_eq!(pt(7.126, "0.00").as_deref(), Some("7,13"));
        assert_eq!(format_number(18.26, "0.0", EN).as_deref(), Some("18.3"));
        assert_eq!(pt(7.0, "00").as_deref(), Some("07"));
    }

    #[test]
    fn percent_multiplies_by_one_hundred() {
        assert_eq!(pt(0.18, "0%").as_deref(), Some("18%"));
        assert_eq!(pt(0.1234, "0.0%").as_deref(), Some("12,3%"));
        assert_eq!(pt(1.0, "0%").as_deref(), Some("100%"));
    }

    #[test]
    fn thousands_separator() {
        assert_eq!(pt(1234567.0, "#,##0").as_deref(), Some("1.234.567"));
        assert_eq!(pt(999.0, "#,##0").as_deref(), Some("999"));
        assert_eq!(pt(1234.56, "#,##0.0").as_deref(), Some("1.234,6"));
        assert_eq!(format_number(1234.56, "#,##0.00", EN).as_deref(), Some("1,234.56"));
        assert_eq!(pt(0.0, "#,##0").as_deref(), Some("0"));
    }

    #[test]
    fn quoted_and_bare_literals() {
        assert_eq!(pt(18.0, "0\"%\"").as_deref(), Some("18%"));
        assert_eq!(pt(4.5, "\"R$ \"0.0").as_deref(), Some("R$ 4,5"));
        assert_eq!(pt(1200.0, "\"R$\" #,##0").as_deref(), Some("R$ 1.200"));
        assert_eq!(pt(12.0, "0\" mi\"").as_deref(), Some("12 mi"));
        assert_eq!(pt(12.0, "$0.00").as_deref(), Some("$12,00"));
        assert_eq!(pt(3.0, "0\\x").as_deref(), Some("3x"));
        assert_eq!(pt(2.5, "+0.0").as_deref(), Some("+2,5"));
    }

    #[test]
    fn optional_decimals_and_negative_numbers() {
        assert_eq!(pt(2.5, "0.##").as_deref(), Some("2,5"));
        assert_eq!(pt(2.0, "0.##").as_deref(), Some("2"));
        assert_eq!(pt(2.0, "0.0#").as_deref(), Some("2,0"));
        assert_eq!(pt(-4.5, "\"R$ \"0.0").as_deref(), Some("-R$ 4,5"));
        assert_eq!(pt(-0.04, "0.0").as_deref(), Some("0,0"));
        assert_eq!(pt(-5.0, "0;(0)").as_deref(), Some("(5)"));
        assert_eq!(pt(0.0, "0;-0;\"-\"0").as_deref(), Some("-0"));
        assert_eq!(pt(0.5, "#.0").as_deref(), Some(",5"));
    }

    #[test]
    fn unknown_codes_fall_back() {
        for code in ["General", "", "0.0E+00", "dd/mm/yyyy", "[Red]0", "# ?/?", "#,##0,\"k\"", "@", "\"só texto\""] {
            assert_eq!(pt(1.0, code), None, "{code}");
        }
        assert_eq!(pt(f64::NAN, "0"), None);
    }
}
