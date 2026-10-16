//! Validação das props como o resolve do pptsx (resolve/normalize.ts e as tabelas de handlers):
//! prop da 0.x, valor inválido de cor/id/href e erro de estrutura derrubam o build (`Prop "x" de
//! <Box>: … (em path)`); o que chega e não tem de/para para o PPTX vira `css-not-emitted`.
//! Roda sobre a árvore avaliada, antes do resolve do Rust, e não muda o layout.

use crate::diag::{Diag, Level};
use crate::js::value::{LAYOUT_KEY, Obj};
use crate::js::{self, DeckCtx, Element, Kind, Value};
use std::sync::LazyLock;

use regex::Regex;

/// Erro que o resolve do pptsx lança: o build para no primeiro.
#[derive(Clone, Debug)]
pub struct Fatal {
    pub message: String,
    pub path: String,
    /// Prop da 0.x (o lint mostra como legacy-prop).
    pub removed: bool,
}

impl Fatal {
    /// Como o ResolveError: `mensagem (em path)`.
    pub fn text(&self) -> String {
        if self.path.is_empty() { self.message.clone() } else { format!("{} (em {})", self.message, self.path) }
    }
}

#[derive(Clone, Debug)]
pub struct Note {
    pub path: String,
    pub property: String,
    pub value: String,
    pub reason: String,
}

const INVALID: &str = "valor não reconhecido; ignorado";
const NO_BOX: &str = "o nó vetorial não tem caixa; envolva-o num Box para ter fundo ou borda";
const SIDE_BORDER: &str = "a forma não tem borda por lado; use border ou outline (contorno inteiro)";
const SOLID_ONLY: &str = "o PPTX só tem contorno sólido; sai sólido";
const COLOR_EXPECTED: &str = "use #RGB, #RRGGBB, rgb()/rgba(), transparent ou um nome básico (black, white, red…)";
const TEXT_CHILD_ERROR: &str = "<Text> só aceita strings, números e <Span>/<B>/<I> como filhos";
const SPAN_OUTSIDE_TEXT: &str = "<Span> só pode aparecer dentro de <Text>";

/// Handler de uma prop: tudo certo, notas (não sai no PPTX) ou erro de valor (InvalidPropError).
enum Outcome {
    Ok,
    Reject(Vec<(String, String)>),
    Invalid { property: String, message: String, removed: bool },
}

fn reject(reason: &str) -> Outcome {
    Outcome::Reject(vec![(String::new(), reason.to_string())])
}

fn json(v: &Value) -> String {
    let mut out = String::new();
    js::value::to_json(v, &mut out);
    out
}

/// Como o pptsx descreve o valor: texto cru, o resto em JSON.
fn describe(v: &Value) -> String {
    match v {
        Value::Str(s) => s.to_string(),
        other => json(other),
    }
}

fn invalid(property: &str, value: &Value, expected: &str) -> Outcome {
    Outcome::Invalid { property: property.to_string(), message: format!("valor {} inválido; {expected}", json(value)), removed: false }
}

// ───────────── valores (resolve/values.ts, keywords.ts) ─────────────

const NUMBER: &str = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?";

/// Regex compilada uma vez (antes, `Regex::new` rodava em cada prop de cada nó).
macro_rules! re {
    ($name:ident, $pattern:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new(&$pattern).expect("regex fixa"));
    };
}

re!(NUMBER_RE, format!("^{NUMBER}$"));
re!(PERCENT_RE, format!("^({NUMBER})%$"));
re!(LENGTH_RE, format!("(?i)^({NUMBER})(px|pt)?$"));
re!(HEX_COLOR_RE, r"^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$");
re!(RGB_RE, r"^rgba?\(\s*([^)]+)\)$");
re!(TOKEN_RE, r"(?i)[a-z]+\([^)]*\)|\S+");
re!(ANGLE_RE, format!("(?i)^({NUMBER})(deg|turn|rad)?$"));
re!(SPAN_RE, r"^span\s+(\d+)$");
re!(FR_RE, format!("^({NUMBER})fr$"));
re!(FUNC_RE, r"^([a-z-]+)\((.*)\)$");
re!(SLIDE_HREF_RE, r"^slide:(\d+)$");
re!(SCHEME_RE, r"(?i)^[a-z][a-z0-9+.-]*:");
re!(TRANSFORM_RE, r"([a-zA-Z]+)\(([^)]*)\)");
re!(IMAGE_EXT_RE, r"(?i)\.(png|jpe?g|gif|svg|webp)$");
re!(URL_RE, r#"^url\(\s*['"]?([^'")]+)['"]?\s*\)$"#);

fn is_number_token(t: &str) -> bool {
    NUMBER_RE.is_match(t)
}

#[derive(Clone, Copy, PartialEq)]
enum Len {
    Pt(f64),
    Percent,
}

fn parse_length(v: &Value) -> Option<Len> {
    match v {
        Value::Num(n) => n.is_finite().then_some(Len::Pt(*n)),
        Value::Str(s) => {
            let t = s.trim();
            if PERCENT_RE.is_match(t) {
                return Some(Len::Percent);
            }
            let c = LENGTH_RE.captures(t)?;
            c[1].parse::<f64>().ok().map(Len::Pt)
        }
        _ => None,
    }
}

fn parse_pt(v: &Value) -> Option<f64> {
    match parse_length(v)? {
        Len::Pt(n) => Some(n),
        Len::Percent => None,
    }
}

fn str_of(v: &Value) -> Option<&str> {
    match v {
        Value::Str(s) => Some(s),
        _ => None,
    }
}

fn one_of(v: &Value, options: &[&str]) -> bool {
    str_of(v).is_some_and(|s| options.contains(&s.trim()))
}

fn finite(v: &Value) -> Option<f64> {
    match v {
        Value::Num(n) => n.is_finite().then_some(*n),
        Value::Str(s) => s.trim().parse::<f64>().ok().filter(|n| n.is_finite()),
        _ => None,
    }
}

/// 1 a 4 valores (número, string com espaços) ou o objeto { top, … } (lados inválidos somem).
fn parse_sides<T>(v: &Value, mut parse: impl FnMut(&Value) -> Option<T>) -> Option<Vec<T>> {
    match v {
        Value::Num(_) => parse(v).map(|x| vec![x]),
        Value::Str(s) => {
            let items: Option<Vec<T>> = s.split_whitespace().map(|t| parse(&js::value::str_val(t))).collect::<Vec<_>>().into_iter().collect();
            items.filter(|i| !i.is_empty() && i.len() <= 4)
        }
        Value::Object(o) => Some(["top", "right", "bottom", "left"].iter().filter_map(|k| o.get(*k).and_then(&mut parse)).collect()),
        _ => None,
    }
}

fn parse_color(v: &Value) -> bool {
    let Some(s) = str_of(v) else { return false };
    let t = s.trim().to_lowercase();
    if t == "transparent" || matches!(t.as_str(), "black" | "white" | "red" | "green" | "blue" | "gray" | "grey") {
        return true;
    }
    if HEX_COLOR_RE.is_match(&t) {
        return true;
    }
    let Some(c) = RGB_RE.captures(&t) else { return false };
    let parts: Vec<&str> = c[1].split(|ch: char| ch.is_whitespace() || ch == ',' || ch == '/').filter(|p| !p.is_empty()).collect();
    if parts.len() < 3 || parts.len() > 4 {
        return false;
    }
    parts.iter().all(|p| p.trim_end_matches('%').parse::<f64>().is_ok_and(f64::is_finite))
}

fn strict_color(property: &str, v: &Value) -> Outcome {
    if parse_color(v) { Outcome::Ok } else { invalid(property, v, COLOR_EXPECTED) }
}

fn tokens(s: &str) -> Vec<String> {
    TOKEN_RE.find_iter(s.trim()).map(|m| m.as_str().to_string()).collect()
}

/// (largura?, estilo?, cor?) ou None.
fn parse_border(v: &Value) -> Option<(Option<f64>, Option<String>, bool)> {
    match v {
        Value::Num(n) => Some((Some(*n), Some("solid".into()), false)),
        Value::Str(s) => {
            let mut out = (None, None, false);
            for t in tokens(s) {
                let lower = t.to_lowercase();
                if matches!(lower.as_str(), "solid" | "dashed" | "dotted" | "none") {
                    out.1 = Some(lower);
                } else if let Some(w) = parse_pt(&js::value::str_val(&t)) {
                    out.0 = Some(w);
                } else if parse_color(&js::value::str_val(&t)) {
                    out.2 = true;
                } else {
                    return None;
                }
            }
            Some(out)
        }
        _ => None,
    }
}

fn parse_flex(v: &Value) -> bool {
    match v {
        Value::Num(_) => true,
        Value::Str(s) => {
            let t = s.trim();
            if t == "auto" || t == "none" {
                return true;
            }
            let toks: Vec<&str> = t.split_whitespace().collect();
            let numbers = toks.iter().filter(|t| is_number_token(t)).count();
            let basis: Vec<&&str> = toks.iter().filter(|t| !is_number_token(t)).collect();
            let basis_ok = basis.first().is_none_or(|b| **b == "auto" || parse_length(&js::value::str_val(b)).is_some());
            (1..=2).contains(&numbers) && basis_ok
        }
        _ => false,
    }
}

fn parse_angle(v: &Value) -> bool {
    match v {
        Value::Num(_) => true,
        Value::Str(s) => ANGLE_RE.is_match(s.trim()),
        _ => false,
    }
}

fn parse_grid_line(v: &Value) -> bool {
    match v {
        Value::Undefined => true,
        Value::Num(n) => n.fract() == 0.0 && *n != 0.0,
        Value::Str(s) => {
            let t = s.trim();
            if t == "auto" {
                return true;
            }
            if let Some(c) = SPAN_RE.captures(t) {
                return c[1].parse::<u32>().is_ok_and(|n| n > 0);
            }
            is_number_token(t) && t.parse::<f64>().is_ok_and(|n| n.fract() == 0.0 && n != 0.0)
        }
        _ => false,
    }
}

fn parse_grid_placement(v: &Value) -> bool {
    match v {
        Value::Num(_) => parse_grid_line(v),
        Value::Str(s) => {
            let parts: Vec<&str> = s.split('/').collect();
            parts.len() <= 2 && parts.iter().all(|p| parse_grid_line(&js::value::str_val(p)))
        }
        _ => false,
    }
}

fn split_top_level(text: &str, sep: char) -> Vec<String> {
    let (mut parts, mut depth, mut current) = (Vec::new(), 0i32, String::new());
    for ch in text.chars() {
        if ch == '(' {
            depth += 1;
        }
        if ch == ')' {
            depth -= 1;
        }
        let is_sep = if sep == ' ' { ch.is_whitespace() } else { ch == sep };
        if depth == 0 && is_sep {
            if !current.trim().is_empty() {
                parts.push(current.trim().to_string());
            }
            current.clear();
            continue;
        }
        current.push(ch);
    }
    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }
    parts
}

fn breadth(token: &str) -> Option<bool> {
    // Some(is_fr)
    if matches!(token, "auto" | "min-content" | "max-content") {
        return Some(false);
    }
    if LENGTH_RE.is_match(token) || PERCENT_RE.is_match(token) {
        return Some(false);
    }
    FR_RE.is_match(token).then_some(true)
}

fn track_list(text: &str) -> bool {
    let t = text.trim();
    if t.is_empty() || t == "none" {
        return true;
    }
    split_top_level(t, ' ').iter().all(|token| {
        let Some(c) = FUNC_RE.captures(token) else { return breadth(token).is_some() };
        let args = split_top_level(&c[2], ',');
        match (&c[1], args.len()) {
            ("minmax", 2) => matches!((breadth(&args[0]), breadth(&args[1])), (Some(false), Some(_))),
            ("repeat", 2) => args[0].parse::<u32>().is_ok_and(|n| n >= 1) && track_list(&args[1]),
            _ => false,
        }
    })
}

fn parse_font_weight(v: &Value) -> bool {
    match v {
        Value::Str(s) if matches!(&**s, "bold" | "normal" | "regular") => true,
        Value::Num(n) => n.is_finite() && (1.0..=1000.0).contains(n),
        Value::Str(s) if is_number_token(s) => s.parse::<f64>().is_ok_and(|n| (1.0..=1000.0).contains(&n)),
        _ => false,
    }
}

fn parse_href(key: &str, v: &Value) -> Outcome {
    let Some(s) = str_of(v).filter(|s| !s.trim().is_empty()) else { return invalid(key, v, "use uma URL (\"https://…\", \"mailto:…\") ou \"slide:N\"") };
    let href = s.trim();
    if href.starts_with("slide:") {
        let ok = SLIDE_HREF_RE.captures(href).is_some_and(|c| c[1].parse::<u64>().is_ok_and(|n| n >= 1));
        return if ok { Outcome::Ok } else { invalid(key, v, "use \"slide:N\" com N ≥ 1 (o número do slide no seu <Deck>)") };
    }
    if SCHEME_RE.is_match(href) { Outcome::Ok } else { invalid(key, v, "a URL precisa do esquema (\"https://…\", \"mailto:…\") ou use \"slide:N\"") }
}

// ───────────── props removidas na 1.0 (resolve/removed-props.ts) ─────────────

fn removed_suggestion(kind: Kind, prop: &str, value: &Value) -> Option<String> {
    use Kind::*;
    let items = [Box, Text, Image, Shape, Chart, Table, Path, Icon, SlideNumber, Container];
    let texts = [Text, SlideNumber];
    let v = value.to_js_string();
    let mapped = |css: &str, table: &[(&str, &str)]| match table.iter().find(|(old, _)| *old == v) {
        Some((_, new)) if matches!(value, Value::Str(_)) => format!("{css}=\"{new}\""),
        _ => css.to_string(),
    };
    let align = [("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("stretch", "stretch"), ("baseline", "baseline")];
    let justify = [("start", "flex-start"), ("end", "flex-end"), ("center", "center"), ("between", "space-between"), ("around", "space-around"), ("evenly", "space-evenly")];
    Some(match prop {
        "direction" if kind == Box => if v == "row" { "display=\"flex\"".into() } else { "flexDirection=\"column\" (ou nada: Box sem display já é coluna)".into() },
        "direction" if kind == Slide => "flexDirection".into(),
        "align" if matches!(kind, Box | Slide) => mapped("alignItems", &align),
        "align" if texts.contains(&kind) => "textAlign".into(),
        "justify" if matches!(kind, Box | Slide) => mapped("justifyContent", &justify),
        "grow" if items.contains(&kind) => match value {
            Value::Num(n) if *n == 0.0 => "flexGrow={0}".into(),
            Value::Num(n) => format!("flex={{{}}}", js::value::num_to_string(*n)),
            _ => "flex={n} quando n > 0, flexGrow={0} (ou flex=\"0 1 auto\") quando 0".into(),
        },
        "shrink" if items.contains(&kind) => "flexShrink".into(),
        "fill" if matches!(kind, Box | Slide) => "backgroundColor".into(),
        "stroke" | "strokeWidth" if kind == Box => "outline=\"<largura>px solid <cor>\" (como o stroke antigo, não ocupa espaço)".into(),
        "radius" if kind == Box => "borderRadius".into(),
        "size" if texts.contains(&kind) || kind == Table => "fontSize".into(),
        "weight" if texts.contains(&kind) || kind == Span => "fontWeight".into(),
        "italic" if texts.contains(&kind) || kind == Span => "fontStyle=\"italic\"".into(),
        "font" if texts.contains(&kind) || kind == Table => "fontFamily".into(),
        "fit" if kind == Image => "objectFit".into(),
        "showValues" if kind == Chart => "labels".into(),
        _ => return None,
    })
}

fn removed(property: &str, suggestion: &str) -> Outcome {
    Outcome::Invalid {
        property: property.to_string(),
        message: format!("removida na 1.0; troque por {suggestion} (`pptsx lint --fix` reescreve o deck; `pptsx lint --from 0.x <pasta>` migra uma pasta inteira)"),
        removed: true,
    }
}

// ───────────── handlers (box/paint/outline/text/shape/kind-handlers.ts) ─────────────

fn border_part(part: &str, key: &str, v: &Value) -> Result<bool, Outcome> {
    match part {
        "width" => Ok(parse_pt(v).is_some()),
        "style" => Ok(one_of(v, &["solid", "dashed", "dotted", "none"])),
        _ => match strict_color(key, v) {
            Outcome::Ok => Ok(true),
            other => Err(other),
        },
    }
}

fn border_part_sides(part: &str, key: &str, v: &Value) -> Outcome {
    if part == "color" && parse_color(v) {
        return Outcome::Ok;
    }
    let mut fatal = None;
    let sides = parse_sides(v, |item| match border_part(part, key, item) {
        Ok(true) => Some(()),
        Ok(false) => None,
        Err(e) => {
            fatal.get_or_insert(e);
            None
        }
    });
    if let Some(e) = fatal {
        return e;
    }
    if sides.is_some() { Outcome::Ok } else { reject(INVALID) }
}

fn radius(v: &Value) -> Outcome {
    let Some(radii) = parse_sides(v, parse_pt) else { return reject(INVALID) };
    let Some(first) = radii.first().copied() else { return reject(INVALID) };
    if radii.iter().all(|r| *r == first) {
        return Outcome::Ok;
    }
    let min = radii.iter().copied().fold(f64::INFINITY, f64::min);
    reject(&format!("raios por canto não existem no PPTX; sai com o menor ({} pt)", js::value::num_to_string(min)))
}

fn outline(v: &Value) -> Outcome {
    match parse_border(v) {
        None => reject(INVALID),
        Some((_, Some(style), _)) if style == "none" => Outcome::Ok,
        Some((_, style, _)) if style.as_deref().is_none_or(|s| s == "solid") => Outcome::Ok,
        Some(_) => reject(SOLID_ONLY),
    }
}

fn shadow(v: &Value) -> Outcome {
    if one_of(v, &["none"]) {
        return Outcome::Ok;
    }
    let Some(s) = str_of(v) else { return reject(INVALID) };
    // Vírgula fora de parênteses separa sombras.
    let (mut depth, mut count) = (0, 1);
    for ch in s.chars() {
        match ch {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => count += 1,
            _ => {}
        }
    }
    let first: String = {
        let mut depth = 0;
        s.chars()
            .take_while(|ch| {
                match ch {
                    '(' => depth += 1,
                    ')' => depth -= 1,
                    ',' if depth == 0 => return false,
                    _ => {}
                }
                true
            })
            .collect()
    };
    let toks = tokens(&first);
    let inset = toks.iter().any(|t| t.eq_ignore_ascii_case("inset"));
    let lengths: Vec<f64> = toks.iter().filter_map(|t| parse_pt(&js::value::str_val(t))).collect();
    if lengths.len() < 2 {
        return reject(INVALID);
    }
    let spread = lengths.get(3).copied().unwrap_or(0.0);
    let mut reasons = Vec::new();
    if inset {
        reasons.push((String::new(), "sombra inset não existe no PPTX; não sai".to_string()));
    }
    if count > 1 {
        reasons.push((String::new(), "o PPTX tem uma sombra por forma; só a primeira sai".to_string()));
    }
    if spread != 0.0 && !inset {
        reasons.push((String::new(), "spread da sombra não existe no PPTX; sai sem spread".to_string()));
    }
    if reasons.is_empty() { Outcome::Ok } else { Outcome::Reject(reasons) }
}

fn transform(v: &Value) -> Outcome {
    let Some(s) = str_of(v) else { return reject(INVALID) };
    if s.trim() == "none" {
        return Outcome::Ok;
    }
    let mut notes = Vec::new();
    for c in TRANSFORM_RE.captures_iter(s) {
        let args: Vec<&str> = c[2].split(|ch: char| ch.is_whitespace() || ch == ',').filter(|a| !a.is_empty()).collect();
        let pt = |a: Option<&&str>| a.is_some_and(|a| parse_pt(&js::value::str_val(a)).is_some());
        let ok = match &c[1] {
            "rotate" => args.first().is_some_and(|a| parse_angle(&js::value::str_val(a))),
            "translate" => pt(args.first()) && (args.len() < 2 || pt(args.get(1))),
            "translateX" | "translateY" => pt(args.first()),
            _ => false,
        };
        if !ok {
            notes.push((c[0].to_string(), "só rotate e translate têm de/para (scale/skew/matrix não saem)".to_string()));
        }
    }
    if notes.is_empty() { Outcome::Ok } else { Outcome::Reject(notes) }
}

fn set(ok: bool) -> Outcome {
    if ok { Outcome::Ok } else { reject(INVALID) }
}

fn background(key: &str, v: &Value) -> Outcome {
    if let Value::Object(o) = v
        && o.contains_key("image") {
            return removed(key, &format!("backgroundImage=\"url({})\"", o.get("image").map(Value::to_js_string).unwrap_or_default()));
        }
    if let Some(s) = str_of(v) {
        if s.trim().starts_with("url(") {
            return background_image(v);
        }
        if !parse_color(v) && IMAGE_EXT_RE.is_match(s.trim()) {
            return removed(key, &format!("backgroundImage=\"url({})\"", s.trim()));
        }
    }
    strict_color(key, v)
}

fn background_image(v: &Value) -> Outcome {
    let ok = str_of(v).is_some_and(|s| URL_RE.is_match(s.trim()));
    if ok { Outcome::Ok } else { reject("só url(...) sai no PPTX (gradiente não tem de/para)") }
}

/// Handlers de CSS (CSS_HANDLERS do normalize); None = chave desconhecida.
fn css_handler(key: &str, v: &Value) -> Option<Outcome> {
    let sides = ["Top", "Right", "Bottom", "Left"];
    let side_key = |prefix: &str, suffix: &str| sides.iter().any(|s| key == format!("{prefix}{s}{suffix}"));
    Some(match key {
        "display" => set(one_of(v, &["flex", "block", "grid", "none"])),
        "position" => set(one_of(v, &["static", "relative", "absolute"])),
        "inset" => set(parse_sides(v, parse_length).is_some()),
        "top" | "right" | "bottom" | "left" | "width" | "height" | "minWidth" | "maxWidth" | "minHeight" | "maxHeight" => set(parse_length(v).is_some()),
        "aspectRatio" => set(match v {
            Value::Num(n) => *n > 0.0,
            Value::Str(s) => {
                let p: Vec<f64> = s.split('/').filter_map(|x| x.trim().parse().ok()).collect();
                p.len() == 2 && p[0] > 0.0 && p[1] > 0.0
            }
            _ => false,
        }),
        "boxSizing" => if one_of(v, &["border-box"]) { Outcome::Ok } else { reject("a engine é sempre border-box") },
        "flexDirection" => set(one_of(v, &["row", "column", "row-reverse", "column-reverse"])),
        "flexWrap" => set(one_of(v, &["nowrap", "wrap", "wrap-reverse"])),
        "justifyContent" => set(one_of(v, &["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly", "start", "end", "between", "around", "evenly"])),
        "alignItems" => set(one_of(v, &["flex-start", "center", "flex-end", "stretch", "baseline", "start", "end"])),
        "alignContent" => set(one_of(v, &["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly", "stretch", "start", "end", "between", "around", "evenly"])),
        "alignSelf" => set(one_of(v, &["auto", "flex-start", "center", "flex-end", "stretch", "baseline", "start", "end"])),
        "justifySelf" => set(one_of(v, &["auto", "start", "center", "end", "stretch", "flex-start", "flex-end"])),
        "justifyItems" => set(one_of(v, &["start", "center", "end", "stretch", "flex-start", "flex-end"])),
        "placeItems" | "placeSelf" => set(str_of(v).is_some_and(|s| {
            let t: Vec<&str> = s.split_whitespace().collect();
            let a = t.first().copied().unwrap_or("");
            let j = t.get(1).copied().unwrap_or(a);
            ["flex-start", "center", "flex-end", "stretch", "baseline", "start", "end"].contains(&a) && ["start", "center", "end", "stretch", "flex-start", "flex-end"].contains(&j)
        })),
        "flex" => set(parse_flex(v)),
        "flexGrow" | "flexShrink" | "order" => set(finite(v).is_some()),
        "flexBasis" => set(one_of(v, &["auto"]) || parse_length(v).is_some()),
        "gap" => set(match v {
            Value::Str(s) => {
                let t: Vec<&str> = s.split_whitespace().collect();
                !t.is_empty() && t.len() <= 2 && t.iter().all(|x| parse_pt(&js::value::str_val(x)).is_some())
            }
            other => parse_pt(other).is_some(),
        }),
        "rowGap" | "columnGap" => set(parse_pt(v).is_some()),
        "margin" => set(parse_sides(v, |x| if one_of(x, &["auto"]) { Some(()) } else { parse_length(x).map(|_| ()) }).is_some()),
        "padding" => set(parse_sides(v, parse_length).is_some()),
        _ if side_key("margin", "") => set(one_of(v, &["auto"]) || parse_length(v).is_some()),
        _ if side_key("padding", "") => set(parse_length(v).is_some()),
        "border" => set(parse_border(v).is_some()),
        _ if side_key("border", "") => set(parse_border(v).is_some()),
        "borderWidth" => border_part_sides("width", key, v),
        "borderStyle" => border_part_sides("style", key, v),
        "borderColor" => border_part_sides("color", key, v),
        _ if side_key("border", "Width") => border_part("width", key, v).map_or_else(|e| e, set),
        _ if side_key("border", "Style") => border_part("style", key, v).map_or_else(|e| e, set),
        _ if side_key("border", "Color") => border_part("color", key, v).map_or_else(|e| e, set),
        "gridTemplateColumns" | "gridTemplateRows" | "gridAutoRows" | "gridAutoColumns" => {
            let text = match v {
                Value::Num(n) => format!("{}px", js::value::num_to_string(*n)),
                other => other.to_js_string(),
            };
            if track_list(&text) { Outcome::Ok } else { reject("sintaxe de track fora do subconjunto suportado (px, %, fr, auto, min/max-content, minmax, repeat(n, …)); a grade ignora este valor") }
        }
        "gridAutoFlow" => if one_of(v, &["row"]) { Outcome::Ok } else { reject("só auto-placement em linhas (row)") },
        "gridColumn" | "gridRow" => set(parse_grid_placement(v)),
        "gridColumnStart" | "gridColumnEnd" | "gridRowStart" | "gridRowEnd" => set(parse_grid_line(v)),
        "borderRadius" => radius(v),
        "backgroundColor" => strict_color(key, v),
        "backgroundImage" => background_image(v),
        "background" => background(key, v),
        "boxShadow" => shadow(v),
        "opacity" => set(finite(v).is_some()),
        "transform" => transform(v),
        "rotate" => set(parse_angle(v)),
        "zIndex" => set(finite(v).is_some_and(|n| n.fract() == 0.0)),
        "overflow" => set(one_of(v, &["visible", "hidden"])),
        "outline" => outline(v),
        "outlineWidth" => set(parse_pt(v).is_some()),
        "outlineColor" => strict_color(key, v),
        "fontFamily" => set(str_of(v).is_some_and(|s| !s.trim().is_empty())),
        "fontSize" => set(parse_pt(v).is_some()),
        "fontWeight" => if parse_font_weight(v) { Outcome::Ok } else { reject("use bold, normal ou um número de 1 a 1000") },
        "fontStyle" => set(one_of(v, &["italic", "normal"])),
        "color" => strict_color(key, v),
        "lineHeight" => if one_of(v, &["normal"]) || matches!(v, Value::Num(n) if n.is_finite() && *n > 0.0) { Outcome::Ok } else { reject("só número (múltiplo do fontSize) ou \"normal\"") },
        "textAlign" => set(one_of(v, &["left", "center", "right", "start", "end"])),
        "letterSpacing" => set(one_of(v, &["normal"]) || parse_pt(v).is_some()),
        "textTransform" => set(one_of(v, &["none", "uppercase", "lowercase", "capitalize"])),
        "textDecoration" => set(str_of(v).is_some_and(|s| s.split_whitespace().all(|t| matches!(t, "none" | "underline" | "line-through")))),
        _ => return None,
    })
}

/// Shape e Path (SHAPE_CSS): borda e outline são o contorno da forma.
fn shape_css(key: &str, v: &Value) -> Option<Outcome> {
    let per_side = |v: &Value| str_of(v).is_some_and(|s| s.trim().contains(char::is_whitespace) && !s.contains('('));
    if ["Top", "Right", "Bottom", "Left"].iter().any(|s| key.starts_with(&format!("border{s}"))) {
        return Some(reject(SIDE_BORDER));
    }
    Some(match key {
        "border" | "outline" => outline(v),
        "borderColor" | "outlineColor" => if per_side(v) { reject(SIDE_BORDER) } else { strict_color(key, v) },
        "borderWidth" | "outlineWidth" => {
            if per_side(v) {
                reject(SIDE_BORDER)
            } else if parse_pt(v).is_some() {
                Outcome::Ok
            } else {
                invalid(key, v, "use uma largura em pt (número ou \"2px\")")
            }
        }
        "borderStyle" => if one_of(v, &["none", "solid"]) { Outcome::Ok } else { reject(SOLID_ONLY) },
        "borderRadius" => radius(v),
        _ => return None,
    })
}

/// Props próprias de cada primitiva (KIND_HANDLERS); None = não é dela.
fn kind_handler(kind: Kind, key: &str, v: &Value) -> Option<Outcome> {
    use Kind::*;
    let id = |v: &Value| if str_of(v).is_some_and(|s| !s.trim().is_empty()) { Outcome::Ok } else { invalid("id", v, "use um texto não vazio, único no slide") };
    let placeholder = |v: &Value| if str_of(v).is_some_and(|s| !s.trim().is_empty()) { Outcome::Ok } else { invalid("placeholder", v, "use o nome de um placeholder do layout (\"title\", \"body\"…)") };
    let white_space = |v: &Value| if one_of(v, &["nowrap", "normal"]) { Outcome::Ok } else { reject("só normal e nowrap") };
    let pass = Outcome::Ok;
    Some(match (kind, key) {
        (Slide, "notes" | "hidden") => pass,
        (Box | Text | Image | Shape | Chart | Table | Path | Icon | SlideNumber | Container, "id") => id(v),
        (Box, "paginate" | "shape") => pass,
        // M19: Container = Box sem paginate/placeholder.
        (Container, "shape") => pass,
        (Box | Text | Image | Container, "href") => parse_href(key, v),
        (Box | Text | Image, "placeholder") => placeholder(v),
        (Text | SlideNumber, "whiteSpace") => white_space(v),
        (Text | SlideNumber, "nowrap" | "fit" | "minSize" | "maxLines") => pass,
        (Text, "paginate") => pass,
        (SlideNumber, "format") => pass,
        (Image, "src") => pass,
        (Image, "objectFit") => if one_of(v, &["contain", "cover"]) { pass } else { reject("só contain e cover") },
        (Shape, "kind" | "strokeWidth" | "radius" | "flipH" | "flipV" | "lineStyle" | "lineCap" | "startArrow" | "endArrow") => pass,
        (Shape | Path, "fill" | "stroke" | "backgroundColor") => strict_color(key, v),
        (Shape, _) => return shape_css(key, v),
        (Path, "d" | "viewBox" | "strokeWidth" | "lineCap" | "lineJoin" | "lineStyle") => pass,
        (Path, "borderRadius") => reject("o Path não tem cantos; desenhe-os no d"),
        (Path, "backgroundImage") => reject(NO_BOX),
        (Path, _) => return shape_css(key, v),
        (Chart, "kind" | "data" | "legend" | "title" | "font" | "size" | "labels" | "xAxis" | "yAxis" | "y2Axis" | "holeSize" | "smooth" | "markers") => pass,
        (Chart, "colors") => match v {
            Value::Array(items) => items.borrow().iter().enumerate().map(|(i, c)| strict_color(&format!("colors[{i}]"), c)).find(|o| !matches!(o, Outcome::Ok)).unwrap_or(Outcome::Ok),
            other => invalid(key, other, "use uma lista de cores"),
        },
        (Table, "columns" | "rows" | "cellPadding" | "fit" | "minSize" | "lineHeight" | "headerRows" | "cell" | "paginate" | "repeatHeader" | "valign") => pass,
        (Table, "stripe" | "border") => strict_color(key, v),
        (Table, "header") => match v {
            Value::Object(o) => ["fill", "color"].iter().filter_map(|f| o.get(*f).filter(|x| !x.is_nullish()).map(|x| strict_color(&format!("header.{f}"), x))).find(|o| !matches!(o, Outcome::Ok)).unwrap_or(Outcome::Ok),
            _ => pass,
        },
        (Icon, "src" | "size" | "recolor" | "render") => pass,
        (Icon, "background" | "backgroundColor" | "backgroundImage" | "fill" | "stroke" | "strokeWidth" | "border" | "borderWidth" | "borderColor" | "borderStyle" | "borderRadius" | "borderTop" | "borderRight" | "borderBottom" | "borderLeft" | "outline" | "outlineColor" | "outlineWidth") => reject(NO_BOX),
        _ => return None,
    })
}

const CONNECTOR_KEYS: [&str; 12] = ["from", "to", "fromSide", "toSide", "route", "startArrow", "endArrow", "stroke", "strokeWidth", "lineStyle", "label", "labelStyle"];

// ───────────── caminhada ─────────────

struct Walker<'a> {
    ctx: &'a DeckCtx,
    notes: Vec<Note>,
}

type Res<T> = Result<T, Fatal>;

fn fatal(message: impl Into<String>, path: &str) -> Fatal {
    Fatal { message: message.into(), path: path.to_string(), removed: false }
}

/// Props efetivas (responsivo resolvido), com `style` por cima e os shorthands primeiro.
fn entries_of(props: &Obj, ctx: &DeckCtx) -> Vec<(String, Value)> {
    let mut merged: Vec<(String, Value)> = Vec::new();
    let mut put = |k: &str, v: &Value| {
        if k == "children" || k == "key" || k == "style" || k.starts_with("@@") {
            return;
        }
        let picked = js::value_pick(v, ctx);
        if matches!(picked, Value::Undefined) {
            merged.retain(|(other, _)| other != k);
            return;
        }
        match merged.iter_mut().find(|(other, _)| other == k) {
            Some(entry) => entry.1 = picked,
            None => merged.push((k.to_string(), picked)),
        }
    };
    for (k, v) in props.iter() {
        put(k, v);
    }
    if let Some(Value::Object(style)) = props.get("style").map(|s| js::value_pick(s, ctx)) {
        for (k, v) in style.iter() {
            put(k, v);
        }
    }
    const SHORTHANDS: [&str; 15] = ["margin", "padding", "inset", "border", "borderWidth", "borderStyle", "borderColor", "flex", "gap", "placeItems", "placeSelf", "background", "outline", "gridColumn", "gridRow"];
    merged.sort_by_key(|(k, _)| usize::from(!SHORTHANDS.contains(&k.as_str())));
    merged
}

impl Walker<'_> {
    /// normalizeProps: cada prop pelo handler da primitiva, da prop removida, do CSS ou o desconhecido.
    fn props(&mut self, el: &Element, path: &str) -> Res<()> {
        let kind = el.kind;
        if kind == Kind::Connector {
            return self.connector(el, path);
        }
        for (key, value) in entries_of(&el.props, self.ctx) {
            let outcome = kind_handler(kind, &key, &value)
                .or_else(|| (key != "background").then(|| removed_suggestion(kind, &key, &value).map(|s| removed(&key, &s))).flatten())
                .or_else(|| css_handler(&key, &value))
                .unwrap_or_else(|| reject("propriedade sem de/para para o PPTX"));
            match outcome {
                Outcome::Ok => {}
                Outcome::Reject(reasons) => {
                    for (raw, reason) in reasons {
                        let shown = if raw.is_empty() { describe(&value) } else { raw };
                        self.notes.push(Note { path: path.to_string(), property: key.clone(), value: shown, reason });
                    }
                }
                Outcome::Invalid { property, message, removed } => {
                    return Err(Fatal { message: format!("Prop \"{property}\" de <{}>: {message}", kind.name()), path: path.to_string(), removed });
                }
            }
        }
        self.contextual(el, path);
        Ok(())
    }

    /// Combinações que só se vê com o nó inteiro (fit/css.ts contextualOf, invisibleBorderNotes).
    fn contextual(&mut self, el: &Element, path: &str) {
        let entries = entries_of(&el.props, self.ctx);
        let get = |k: &str| entries.iter().find(|(key, _)| key == k).map(|(_, v)| v.clone());
        let mut note = |property: &str, value: &str, reason: &str| self.notes.push(Note { path: path.to_string(), property: property.into(), value: value.into(), reason: reason.into() });
        if get("overflow").is_some_and(|v| one_of(&v, &["hidden"])) && el.kind != Kind::Image {
            note("overflow", "hidden", "o PPTX não recorta formas; os filhos saem inteiros");
        }
        let has_bg = get("backgroundColor").is_some() || get("background").is_some_and(|b| parse_color(&b));
        let shadow = get("boxShadow").is_some_and(|s| !one_of(&s, &["none"]) && matches!(shadow(&s), Outcome::Ok | Outcome::Reject(_)) && str_of(&s).is_some_and(|t| t.split(',').next().is_some_and(|f| !f.to_lowercase().contains("inset"))));
        if shadow && !has_bg && !matches!(el.kind, Kind::Shape | Kind::Path | Kind::Icon) {
            note("boxShadow", "sombra", "sem backgroundColor a forma não tem preenchimento e a sombra não aparece no PPTX");
        }
        if matches!(el.kind, Kind::Shape | Kind::Path | Kind::Icon) {
            return;
        }
        for side in ["Top", "Right", "Bottom", "Left"] {
            let width = get(&format!("border{side}Width")).and_then(|w| parse_pt(&w));
            let style = get(&format!("border{side}Style")).or_else(|| get("borderStyle")).or_else(|| get(&format!("border{side}"))).or_else(|| get("border"));
            if let Some(w) = width.filter(|w| *w > 0.0)
                && style.is_none() {
                    let n = js::value::num_to_string(w);
                    note(&format!("border{side}Width"), &n, &format!("sem border{side}Style a borda não aparece (o estilo padrão do CSS é none); use border{side}=\"{n}px solid <cor>\" ou borderStyle=\"solid\""));
                }
        }
    }

    fn connector(&mut self, el: &Element, path: &str) -> Res<()> {
        let keys: Vec<String> = entries_of(&el.props, self.ctx).into_iter().map(|(k, _)| k).filter(|k| !CONNECTOR_KEYS.contains(&k.as_str())).collect();
        if !keys.is_empty() {
            return Err(fatal(format!("<Connector> não aceita {}: ele não é uma caixa (use {})", keys.iter().map(|k| format!("\"{k}\"")).collect::<Vec<_>>().join(", "), CONNECTOR_KEYS.join(", ")), path));
        }
        for end in ["from", "to"] {
            if !matches!(el.props.get(end), Some(Value::Str(s)) if !s.trim().is_empty()) {
                return Err(fatal(format!("<Connector> precisa de {end}: o id de um nó do mesmo slide"), path));
            }
        }
        Ok(())
    }

    fn span(&mut self, el: &Element, path: &str) -> Res<()> {
        let props = entries_of(&el.props, self.ctx);
        let wrap = |property: &str, message: String, removed: bool| Fatal { message: format!("Prop \"{property}\" de <Span>: {message}"), path: path.to_string(), removed };
        for (key, value) in &props {
            if let Some(s) = removed_suggestion(Kind::Span, key, value)
                && let Outcome::Invalid { property, message, removed } = removed(key, &s) {
                    return Err(wrap(&property, message, removed));
                }
        }
        for (key, value) in &props {
            let outcome = match key.as_str() {
                "color" => strict_color("color", value),
                "fontSize" => if parse_pt(value).is_some_and(|s| s > 0.0) { Outcome::Ok } else { invalid("fontSize", value, "use um tamanho positivo em pt (número ou \"14px\")") },
                "fontFamily" => if str_of(value).is_some_and(|s| !s.trim().is_empty()) { Outcome::Ok } else { invalid("fontFamily", value, "use o nome de uma família registrada") },
                "verticalAlign" => if one_of(value, &["baseline", "super", "sub"]) { Outcome::Ok } else { invalid("verticalAlign", value, "use \"baseline\", \"super\" ou \"sub\"") },
                "href" => parse_href("href", value),
                _ => Outcome::Ok,
            };
            if let Outcome::Invalid { property, message, removed } = outcome {
                return Err(wrap(&property, message, removed));
            }
        }
        for c in &el.children {
            match c {
                Value::Element(e) if e.kind == Kind::Span => self.span(e, path)?,
                Value::Element(_) => return Err(fatal(TEXT_CHILD_ERROR, path)),
                _ => {}
            }
        }
        Ok(())
    }

    fn node(&mut self, el: &Element, path: &str) -> Res<()> {
        self.props(el, path)?;
        match el.kind {
            Kind::Text => {
                for c in &el.children {
                    match c {
                        Value::Element(e) if e.kind == Kind::Span => self.span(e, path)?,
                        Value::Element(_) => return Err(fatal(TEXT_CHILD_ERROR, path)),
                        _ => {}
                    }
                }
            }
            Kind::Box => {
                self.children(&el.children, path, &[])?;
                // M19: a paginação divide o conteúdo depois do layout; um Container lá dentro não teria um espaço único.
                let paginate = el.props.get("paginate").map(|v| js::value_pick(v, self.ctx));
                if matches!(paginate, Some(Value::Bool(true))) && has_container(&el.children) {
                    return Err(fatal("<Container> não pode ficar dentro de um Box paginate", path));
                }
            }
            Kind::Container => {
                if !matches!(el.children.as_slice(), [Value::Func(_)]) {
                    return Err(fatal(CONTAINER_NEEDS_FUNCTION, path));
                }
            }
            Kind::Slide | Kind::Deck => return Err(fatal(format!("<{}> só pode aparecer {}", el.kind.name(), if el.kind == Kind::Slide { "como filho de <Deck>" } else { "na raiz" }), path)),
            _ => {
                if !el.children.is_empty() {
                    return Err(fatal(format!("<{}> não aceita filhos", el.kind.name()), path));
                }
                if el.kind == Kind::SlideNumber
                    && let Some(f) = el.props.get("format").map(|f| js::value_pick(f, self.ctx)).filter(|f| !f.is_nullish())
                        && !one_of(&f, &["n", "n / total"]) {
                            return Err(fatal(format!("<SlideNumber>: format {} inválido; use \"n\" ou \"n / total\"", json(&f)), path));
                        }
            }
        }
        Ok(())
    }

    fn children(&mut self, children: &[Value], parent: &str, extra: &[&str]) -> Res<Vec<String>> {
        let (paths, extras) = crate::model::child_paths(parent, children, extra);
        let mut k = 0;
        for c in children {
            match c {
                Value::Element(e) if e.kind == Kind::Span => return Err(fatal(SPAN_OUTSIDE_TEXT, parent)),
                Value::Element(e) => {
                    let path = paths[k].clone();
                    k += 1;
                    self.node(e, &path)?;
                }
                Value::Str(s) => return Err(fatal(format!("Texto {} fora de <Text>; envolva o conteúdo em <Text>", json(&js::value::str_val(s))), parent)),
                _ => {}
            }
        }
        Ok(extras)
    }

    fn slide(&mut self, slide: &Element, footer: Option<&Value>) -> Res<()> {
        let path = crate::model::segment_of(slide);
        self.props(slide, &path)?;
        let fixed = match slide.props.get(LAYOUT_KEY) {
            Some(Value::Object(o)) => o.get("fixed").filter(|v| !matches!(v, Value::Undefined | Value::Null | Value::Bool(false))).cloned(),
            _ => None,
        };
        let extra: Vec<&str> = [fixed.as_ref().map(|_| "Fixed"), footer.map(|_| "Footer")].into_iter().flatten().collect();
        let extras = self.children(&slide.children, &path, &extra)?;
        let mut extras = extras.into_iter();
        for content in [fixed.as_ref(), footer].into_iter().flatten() {
            let wrapper = extras.next().unwrap_or_default();
            let mut flat = Vec::new();
            let _ = js::normalize(vec![content.clone()], &mut flat);
            self.children(&flat, &wrapper, &[])?;
        }
        Ok(())
    }
}

const CONTAINER_NEEDS_FUNCTION: &str = "<Container> precisa de uma função como filho: {(box) => …} (ela recebe o espaço medido)";

/// Há um `<Container>` entre os filhos (sem entrar na função dele, que ainda não rodou).
fn has_container(children: &[Value]) -> bool {
    children.iter().any(|c| matches!(c, Value::Element(e) if e.kind == Kind::Container || (e.kind == Kind::Box && has_container(&e.children))))
}

/// M19: valida o que a função de um Container devolveu (o resolve do pptsx valida esse conteúdo
/// na passada que o resolve): erro fatal ou as notas css-not-emitted.
pub fn validate_content(children: &[Value], parent: &str, ctx: &DeckCtx) -> Result<Vec<Note>, Fatal> {
    let mut w = Walker { ctx, notes: Vec::new() };
    w.children(children, parent, &[])?;
    Ok(w.notes)
}

pub struct Validation {
    pub fatal: Option<Fatal>,
    /// Por slide do autor (base 1): as notas css-not-emitted.
    pub notes: Vec<(usize, Note)>,
}

/// Valida o deck avaliado num tamanho (o responsivo pode mudar o que é válido).
pub fn validate(deck: &Element, ctx: &DeckCtx) -> Validation {
    let mut w = Walker { ctx, notes: Vec::new() };
    let footer = deck.props.get("footer").cloned().filter(|f| !matches!(f, Value::Undefined | Value::Null | Value::Bool(false)));
    let mut notes = Vec::new();
    for (i, c) in deck.children.iter().enumerate() {
        let result = match c {
            Value::Element(e) if e.kind == Kind::Slide => w.slide(e, footer.as_ref()),
            Value::Element(e) => Err(fatal(format!("Filhos de <Deck> têm que ser <Slide>; encontrado <{}>", e.kind.name()), &crate::model::segment_of(e))),
            Value::Str(s) => Err(fatal(format!("Texto {} fora de <Text>; envolva o conteúdo em <Text>", json(&js::value::str_val(s))), "Deck")),
            _ => Ok(()),
        };
        notes.extend(w.notes.drain(..).map(|n| (i + 1, n)));
        if let Err(f) = result {
            return Validation { fatal: Some(f), notes };
        }
    }
    Validation { fatal: None, notes }
}

/// css-not-emitted (fit/css.ts messageOf).
pub fn note_diag(slide: usize, n: &Note) -> Diag {
    Diag::new(Level::Warn, "css-not-emitted", slide, n.path.clone(), format!(
        "A propriedade CSS {}: {} não sai no PPTX: {}. O preview também não a desenha; remova-a ou troque por uma suportada (ver docs/AGENT_GUIDE.md).",
        n.property, n.value, n.reason
    ))
}
