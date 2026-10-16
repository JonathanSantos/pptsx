//! `lint` (lint/lint.ts do pptsx): avalia e resolve o deck sem gravar nada e aponta o que vai dar
//! trabalho. Regras da engine (props da 0.x, `lineHeight` alto, `fr` solto, cores fora do tema,
//! estrutura) e as regras externas da config e dos DS (`lint.rules`, `ds[].rules`): funções JS
//! chamadas pelo avaliador que carregou a config, com o nó no formato do pptsx (kind, path, props,
//! css, runs, children) e o contexto (size, theme, slide, path, component, parent).

use std::collections::HashSet;
use std::path::Path;
use std::rc::Rc;
use std::sync::LazyLock;

use crate::config::Config;
use crate::css::{parse_border, parse_color};
use crate::diag::Level;
use crate::js::value::{COMPONENT_PROP, LAYOUT_KEY, Obj, arr_val, obj_val, str_val};
use crate::js::{self, DeckCtx, Element, Kind, Value};

#[derive(Clone)]
pub struct Finding {
    pub severity: String,
    pub code: String,
    /// Ausente quando vale para todos os tamanhos.
    pub size: Option<String>,
    pub slide: usize,
    pub path: String,
    pub message: String,
}

struct Rule {
    id: String,
    severity: String,
    check: Value,
}

/// lineHeight numérico a partir daqui desloca a 1ª linha no Keynote (M11-G).
const KEYNOTE_LINE_HEIGHT: f64 = 1.5;
const TEXT_COLOR: &str = "#000000";
const SEPARATOR: &str = " > ";

/// Nó do deck do autor como o lint vê: o elemento, o path do pptsx e a cor de texto herdada.
struct LNode {
    el: Rc<Element>,
    segment: String,
    path: String,
    style: TextStyle,
    children: Vec<LNode>,
    /// display none e Connector contam nos índices dos irmãos, mas saem da árvore (resolve.ts).
    visible: bool,
}

/// Estilo de texto herdado (resolve/inherit): o que entra no `props` de Text, Table, Chart e Icon.
#[derive(Clone)]
struct TextStyle {
    color: String,
    font: Value,
    size: Value,
    weight: Value,
    italic: bool,
    line_height: Value,
    align: Value,
}

impl TextStyle {
    fn root() -> Self {
        TextStyle { color: TEXT_COLOR.into(), font: str_val("Arial"), size: Value::Num(18.0), weight: str_val("regular"), italic: false, line_height: str_val("normal"), align: str_val("left") }
    }

    fn inherit(&self, el: &Element, ctx: &DeckCtx) -> Self {
        let mut t = self.clone();
        if let Some(c) = prop_str(el, ctx, "color").and_then(|c| hex_of(&c)) {
            t.color = c;
        }
        if let Some(v) = prop(el, ctx, "fontFamily") {
            t.font = v;
        }
        if let Some(v) = prop(el, ctx, "fontSize") {
            t.size = v;
        }
        if let Some(v) = prop(el, ctx, "fontWeight") {
            t.weight = v;
        }
        if let Some(v) = prop_str(el, ctx, "fontStyle") {
            t.italic = v == "italic";
        }
        if let Some(v) = prop(el, ctx, "lineHeight") {
            t.line_height = v;
        }
        if let Some(v) = prop(el, ctx, "textAlign") {
            t.align = v;
        }
        t
    }
}

fn kind_name(kind: Kind) -> String {
    // M19: o Container resolvido é um box (resolve.ts resolveContainer).
    let name = if kind == Kind::Container { "Box" } else { kind.name() };
    let mut chars = name.chars();
    chars.next().map(|c| c.to_ascii_lowercase().to_string() + chars.as_str()).unwrap_or_default()
}

fn component_name(el: &Element) -> Option<String> {
    match el.props.get(COMPONENT_PROP) {
        Some(Value::Object(meta)) => meta.get("name").map(Value::to_js_string),
        _ => None,
    }
}

fn hex_of(raw: &str) -> Option<String> {
    parse_color(raw).map(|c| format!("#{}", c.hex()))
}

fn prop(el: &Element, ctx: &DeckCtx, key: &str) -> Option<Value> {
    let v = el.props.get(key)?;
    let picked = js::value_pick(v, ctx);
    (!matches!(picked, Value::Undefined | Value::Null)).then_some(picked)
}

fn prop_str(el: &Element, ctx: &DeckCtx, key: &str) -> Option<String> {
    match prop(el, ctx, key)? {
        Value::Str(s) => Some(s.to_string()),
        _ => None,
    }
}

/// Segmento do path: o componente mais externo que gerou o nó, senão a primitiva; `[i]` só
/// quando há irmãos com o mesmo segmento (resolve.ts siblingSegments).
fn with_indices(mut nodes: Vec<LNode>, parent: &str) -> Vec<LNode> {
    let segments: Vec<String> = nodes.iter().map(|n| n.segment.clone()).collect();
    let mut seen: Vec<(String, usize)> = Vec::new();
    for (i, n) in nodes.iter_mut().enumerate() {
        let seg = &segments[i];
        let label = if segments.iter().filter(|s| *s == seg).count() == 1 {
            seg.clone()
        } else {
            let index = match seen.iter_mut().find(|(s, _)| s == seg) {
                Some((_, k)) => {
                    *k += 1;
                    *k
                }
                None => {
                    seen.push((seg.clone(), 0));
                    0
                }
            };
            format!("{seg}[{index}]")
        };
        n.path = format!("{parent}{SEPARATOR}{label}");
        let path = n.path.clone();
        let children = std::mem::take(&mut n.children);
        n.children = with_indices(children, &path);
    }
    nodes.retain(|n| n.visible);
    nodes
}

fn build(el: &Rc<Element>, ctx: &DeckCtx, parent: &TextStyle) -> Option<LNode> {
    if matches!(el.kind, Kind::Span | Kind::B | Kind::I | Kind::Sup | Kind::Sub | Kind::Fragment) {
        return None;
    }
    let visible = el.kind != Kind::Connector && prop_str(el, ctx, "display").as_deref() != Some("none");
    let style = parent.inherit(el, ctx);
    let children = if matches!(el.kind, Kind::Box | Kind::Slide | Kind::Container) { el.children.iter().filter_map(|c| match c { Value::Element(e) => build(e, ctx, &style), _ => None }).collect() } else { Vec::new() };
    let segment = component_name(el).unwrap_or_else(|| el.kind.name().to_string());
    Some(LNode { el: el.clone(), segment, path: String::new(), style, children, visible })
}

/// Invólucro sintético (Fixed do layout, Footer do Deck), como o resolve do pptsx monta.
fn wrapper(segment: &str, content: &Value, ctx: &DeckCtx, style: &TextStyle) -> LNode {
    let mut flat = Vec::new();
    let _ = js::normalize(vec![content.clone()], &mut flat);
    let children = flat.iter().filter_map(|c| match c { Value::Element(e) => build(e, ctx, style), _ => None }).collect();
    let el = Rc::new(Element { kind: Kind::Box, props: Rc::new(Obj::new()), children: flat, component: true, source: None });
    LNode { el, segment: segment.into(), path: String::new(), style: style.clone(), children, visible: true }
}

fn slides_of(deck: &Element, ctx: &DeckCtx) -> Vec<LNode> {
    let footer = deck.props.get("footer").cloned().filter(|f| !matches!(f, Value::Undefined | Value::Null | Value::Bool(false)));
    deck.children
        .iter()
        .filter_map(|c| match c {
            Value::Element(e) if e.kind == Kind::Slide => Some(e),
            _ => None,
        })
        .map(|slide| {
            let mut node = build(slide, ctx, &TextStyle::root()).expect("slide");
            if let Some(Value::Object(layout)) = slide.props.get(LAYOUT_KEY)
                && let Some(fixed) = layout.get("fixed").filter(|v| !matches!(v, Value::Undefined | Value::Null | Value::Bool(false))) {
                    node.children.push(wrapper("Fixed", fixed, ctx, &node.style));
                }
            if let Some(footer) = &footer {
                node.children.push(wrapper("Footer", footer, ctx, &node.style));
            }
            node.path = node.segment.clone();
            let path = node.path.clone();
            let children = std::mem::take(&mut node.children);
            node.children = with_indices(children, &path);
            node
        })
        .collect()
}

// ───────────── cores pintadas ─────────────

struct Css {
    background: Option<String>,
    outline: Option<String>,
    borders: [Option<(f32, String)>; 4],
}

fn css_of(el: &Element, ctx: &DeckCtx) -> Css {
    // Shape e Path: o fundo CSS é o preenchimento (props.fill); Icon não tem caixa.
    if matches!(el.kind, Kind::Shape | Kind::Path | Kind::Icon | Kind::Connector) {
        return Css { background: None, outline: None, borders: [None, None, None, None] };
    }
    let background = ["backgroundColor", "background"].iter().find_map(|k| prop_str(el, ctx, k).and_then(|v| hex_of(&v)));
    let outline = prop_str(el, ctx, "outline").and_then(|o| parse_border(&o)).map(|s| format!("#{}", s.color.hex()));
    let all = prop(el, ctx, "border").map(|b| b.to_js_string()).and_then(|b| parse_border(&b));
    let side = |key: &str| prop(el, ctx, key).map(|b| b.to_js_string()).and_then(|b| parse_border(&b)).or(all).map(|s| (s.width, format!("#{}", s.color.hex())));
    let borders = [side("borderTop"), side("borderRight"), side("borderBottom"), side("borderLeft")];
    // Tabela: `border` é a grade das células, não CSS do contêiner.
    let borders = if el.kind == Kind::Table { [None, None, None, None] } else { borders };
    Css { background, outline, borders }
}

/// Trechos do Text com a cor resolvida (herdada do Text e dos Span de fora para dentro).
fn runs_of(children: &[Value], ctx: &DeckCtx, color: &str, out: &mut Vec<(String, String)>) {
    for c in children {
        match c {
            Value::Str(s) => out.push((s.to_string(), color.to_string())),
            Value::Element(e) => {
                let own = prop_str(e, ctx, "color").and_then(|c| hex_of(&c));
                runs_of(&e.children, ctx, own.as_deref().unwrap_or(color), out);
            }
            _ => {}
        }
    }
}

fn painted_colors(n: &LNode, ctx: &DeckCtx) -> Vec<String> {
    let css = css_of(&n.el, ctx);
    let mut out: Vec<String> = Vec::new();
    out.extend(css.background);
    out.extend(css.outline);
    out.extend(css.borders.iter().flatten().filter(|(w, _)| *w > 0.0).map(|(_, c)| c.clone()));
    if matches!(n.el.kind, Kind::Text | Kind::SlideNumber) {
        let mut runs = Vec::new();
        runs_of(&n.el.children, ctx, &n.style.color, &mut runs);
        out.extend(runs.into_iter().map(|(_, c)| c));
    }
    let props = props_of(n, ctx);
    for key in ["color", "fill", "stroke"] {
        if let Some(Value::Str(v)) = props.get(key) {
            out.push(v.to_string());
        }
    }
    let mut unique: Vec<String> = Vec::new();
    for c in out.into_iter().map(|c| c.to_ascii_uppercase()) {
        if !unique.contains(&c) {
            unique.push(c);
        }
    }
    unique
}

/// Props da primitiva que não são CSS (kind-handlers.ts); as de cor seguem como '#RRGGBB'.
fn own_keys(kind: Kind) -> &'static [&'static str] {
    match kind {
        Kind::Slide => &["notes", "hidden"],
        Kind::Box => &["id", "paginate", "shape", "href", "placeholder"],
        Kind::Container => &["id", "shape", "href"],
        Kind::Text => &["id", "whiteSpace", "nowrap", "fit", "minSize", "maxLines", "href", "paginate", "placeholder"],
        Kind::Image => &["id", "src", "objectFit", "href", "placeholder"],
        Kind::Shape => &["id", "kind", "strokeWidth", "radius", "flipH", "flipV", "lineStyle", "lineCap", "startArrow", "endArrow", "fill", "stroke", "backgroundColor"],
        Kind::Chart => &["id", "kind", "data", "legend", "title", "font", "size", "labels", "xAxis", "yAxis", "y2Axis", "holeSize", "smooth", "markers", "colors"],
        Kind::Table => &["id", "columns", "rows", "cellPadding", "fit", "minSize", "lineHeight", "headerRows", "cell", "paginate", "repeatHeader", "valign", "stripe", "border", "header"],
        Kind::Path => &["id", "d", "viewBox", "strokeWidth", "lineCap", "lineJoin", "lineStyle", "fill", "stroke", "backgroundColor"],
        Kind::Icon => &["id", "src", "size", "recolor", "render"],
        Kind::SlideNumber => &["id", "whiteSpace", "nowrap", "fit", "minSize", "maxLines", "format"],
        Kind::Connector => &["from", "to", "kind", "stroke", "strokeWidth", "startArrow", "endArrow", "label", "fromSide", "toSide", "lineStyle"],
        _ => &[],
    }
}

/// `props` do nó resolvido (resolve/legacy.ts): estilo de texto herdado onde se aplica e as props próprias.
fn props_of(n: &LNode, ctx: &DeckCtx) -> Obj {
    let el = &n.el;
    let t = &n.style;
    let mut o = Obj::new();
    let mut put = |k: &str, v: Value| {
        o.insert(Rc::from(k), v);
    };
    match el.kind {
        Kind::Text | Kind::SlideNumber => {
            put("font", t.font.clone());
            put("size", t.size.clone());
            put("weight", t.weight.clone());
            put("italic", Value::Bool(t.italic));
            put("color", str_val(&t.color));
            put("lineHeight", t.line_height.clone());
            put("align", t.align.clone());
        }
        Kind::Chart => {
            put("font", t.font.clone());
            put("color", str_val(&t.color));
        }
        Kind::Table => {
            put("font", t.font.clone());
            put("size", t.size.clone());
            put("color", str_val(&t.color));
            put("lineHeight", t.line_height.clone());
        }
        Kind::Icon => put("color", str_val(&t.color)),
        _ => {}
    }
    for key in own_keys(el.kind) {
        let Some(v) = prop(el, ctx, key) else { continue };
        let (name, v) = match (*key, &v) {
            ("objectFit", _) => ("fit", v),
            ("backgroundColor" | "fill" | "stroke", Value::Str(c)) if matches!(el.kind, Kind::Shape | Kind::Path | Kind::Connector) => {
                let name = if *key == "backgroundColor" { "fill" } else { key };
                (name, hex_of(c).map_or(v.clone(), |h| str_val(&h)))
            }
            ("stripe" | "border", Value::Str(c)) if el.kind == Kind::Table => (*key, hex_of(c).map_or(v.clone(), |h| str_val(&h))),
            _ => (*key, v),
        };
        put(name, v);
    }
    o
}

// ───────────── regras da engine ─────────────

static MINMAX_ZERO_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"minmax\(\s*0\s*,[^)]*\)").expect("regex fixa"));
static BARE_FR_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"(^|[\s(,])(\d*\.?\d+)fr\b").expect("regex fixa"));
static INDEX_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r"^(.*)\[(\d+)\]$").expect("regex fixa"));

fn bare_fr(template: &str) -> bool {
    let cleaned = MINMAX_ZERO_RE.replace_all(template, "");
    BARE_FR_RE.is_match(&cleaned)
}

fn engine_findings(n: &LNode, ctx: &DeckCtx, slide: usize, declared: Option<&HashSet<String>>, out: &mut Vec<Finding>) {
    let el = &n.el;
    let mut push = |severity: &str, code: &str, message: String| out.push(Finding { severity: severity.into(), code: code.into(), size: None, slide, path: n.path.clone(), message });
    if matches!(el.kind, Kind::Text | Kind::Table)
        && let Value::Num(lh) = n.style.inherit(el, ctx).line_height
            && lh >= KEYNOTE_LINE_HEIGHT {
                push("warning", "keynote-line-height", format!("lineHeight={{{}}}: no Keynote a 1ª linha desce até ~2 pt (guia §4). Se a posição exata importa, use até 1.4 ou confira no Keynote.", js::value::num_to_string(lh)));
            }
    if matches!(el.kind, Kind::Box | Kind::Container) && prop_str(el, ctx, "display").as_deref() == Some("grid")
        && let Some(t) = prop_str(el, ctx, "gridTemplateColumns").filter(|t| bare_fr(t)) {
            push("info", "grid-fr", format!("gridTemplateColumns=\"{t}\": `1fr` cresce até a palavra mais longa; com valores longos o grid sai do slide. Use repeat(n, minmax(0, 1fr)) (guia §3)."));
        }
    if let Some(declared) = declared {
        let off: Vec<String> = painted_colors(n, ctx).into_iter().filter(|c| c.starts_with('#') && !declared.contains(c)).collect();
        if !off.is_empty() {
            push("info", "off-theme-color", format!("Cor fora do tema: {}. Ela fica fixa no arquivo (trocar o tema não a repinta); use uma cor do tema se ela faz parte da marca.", off.join(", ")));
        }
    }
}

// ───────────── regras externas ─────────────

fn css_value(css: &Css, el: &Element, ctx: &DeckCtx) -> Value {
    let mut o = Obj::new();
    if let Some(bg) = &css.background {
        o.insert(Rc::from("backgroundColor"), str_val(bg));
    }
    if let Some(color) = &css.outline {
        let mut outline = Obj::new();
        outline.insert(Rc::from("color"), str_val(color));
        o.insert(Rc::from("outline"), obj_val(outline));
    }
    let mut border = Obj::new();
    for (side, b) in ["top", "right", "bottom", "left"].iter().zip(&css.borders) {
        let mut s = Obj::new();
        s.insert(Rc::from("width"), Value::Num(b.as_ref().map_or(0.0, |(w, _)| f64::from(*w))));
        s.insert(Rc::from("color"), str_val(b.as_ref().map_or(TEXT_COLOR, |(_, c)| c.as_str())));
        border.insert(Rc::from(*side), obj_val(s));
    }
    o.insert(Rc::from("border"), obj_val(border));
    for key in ["display", "gridTemplateColumns", "gridTemplateRows", "flexDirection"] {
        if let Some(v) = prop(el, ctx, key) {
            o.insert(Rc::from(key), v);
        }
    }
    obj_val(o)
}

/// O nó no formato do ResolvedNode do pptsx (o que as regras dos DS leem).
fn node_value(n: &LNode, ctx: &DeckCtx) -> Value {
    let mut o = Obj::new();
    o.insert(Rc::from("kind"), str_val(&kind_name(n.el.kind)));
    o.insert(Rc::from("path"), str_val(&n.path));
    o.insert(Rc::from("props"), obj_val(props_of(n, ctx)));
    o.insert(Rc::from("css"), css_value(&css_of(&n.el, ctx), &n.el, ctx));
    if matches!(n.el.kind, Kind::Text | Kind::SlideNumber) {
        let mut runs = Vec::new();
        runs_of(&n.el.children, ctx, &n.style.color, &mut runs);
        let runs = runs
            .into_iter()
            .map(|(text, color)| {
                let mut r = Obj::new();
                r.insert(Rc::from("text"), str_val(&text));
                r.insert(Rc::from("color"), str_val(&color));
                obj_val(r)
            })
            .collect();
        o.insert(Rc::from("runs"), arr_val(runs));
    }
    if matches!(n.el.kind, Kind::Box | Kind::Slide | Kind::Container) {
        o.insert(Rc::from("children"), arr_val(n.children.iter().map(|c| node_value(c, ctx)).collect()));
    }
    if let Some(meta) = n.el.props.get(COMPONENT_PROP) {
        o.insert(Rc::from("component"), meta.clone());
    }
    obj_val(o)
}

struct External {
    interp: js::Interp,
    rules: Vec<Rule>,
    theme: Value,
}

fn rules_of(list: Option<&Value>, out: &mut Vec<Rule>) {
    let Some(Value::Array(items)) = list else { return };
    for r in items.borrow().iter() {
        let Value::Object(o) = r else { continue };
        let Some(check @ Value::Func(_)) = o.get("check").cloned() else { continue };
        out.push(Rule { id: o.get("id").map(Value::to_js_string).unwrap_or_else(|| "regra".into()), severity: o.get("severity").map(Value::to_js_string).unwrap_or_else(|| "warning".into()), check });
    }
}

/// Regras de `lint.rules` e de cada `ds[].rules` da config, e os códigos desligados.
fn external_of(config: &Config) -> Result<(Option<External>, Vec<String>), String> {
    let Some(path) = &config.path else { return Ok((None, Vec::new())) };
    let (interp, value) = js::evaluate_module(path)?;
    let Value::Object(cfg) = &value else { return Ok((None, Vec::new())) };
    let mut rules = Vec::new();
    let mut disable = Vec::new();
    if let Some(Value::Object(lint)) = cfg.get("lint") {
        rules_of(lint.get("rules"), &mut rules);
        if let Some(Value::Array(d)) = lint.get("disable") {
            disable.extend(d.borrow().iter().map(Value::to_js_string));
        }
    }
    if let Some(Value::Array(dss)) = cfg.get("ds") {
        for ds in dss.borrow().iter() {
            if let Value::Object(ds) = ds {
                rules_of(ds.get("rules"), &mut rules);
            }
        }
    }
    let theme = cfg.get("theme").cloned().unwrap_or(Value::Undefined);
    Ok((Some(External { interp, rules, theme }), disable))
}

fn external_findings(ext: &mut External, n: &LNode, parent: Option<&Value>, slide: usize, ctx: &DeckCtx, size: &Value, out: &mut Vec<Finding>) {
    let node = node_value(n, ctx);
    let mut c = Obj::new();
    c.insert(Rc::from("size"), size.clone());
    if !matches!(ext.theme, Value::Undefined) {
        c.insert(Rc::from("theme"), ext.theme.clone());
    }
    c.insert(Rc::from("slide"), Value::Num(slide as f64));
    c.insert(Rc::from("path"), str_val(&n.path));
    if let Some(meta) = n.el.props.get(COMPONENT_PROP) {
        c.insert(Rc::from("component"), meta.clone());
    }
    if let Some(p) = parent {
        c.insert(Rc::from("parent"), p.clone());
    }
    let context = obj_val(c);
    for i in 0..ext.rules.len() {
        let (id, severity, check) = (ext.rules[i].id.clone(), ext.rules[i].severity.clone(), ext.rules[i].check.clone());
        match js::call_function(&mut ext.interp, &check, vec![node.clone(), context.clone()]) {
            Ok(Value::Array(found)) => {
                for f in found.borrow().iter() {
                    let Value::Object(f) = f else { continue };
                    out.push(Finding {
                        severity: f.get("severity").filter(|v| !v.is_nullish()).map_or(severity.clone(), Value::to_js_string),
                        code: id.clone(),
                        size: Some(ctx.name.clone()),
                        slide,
                        path: f.get("path").filter(|v| !v.is_nullish()).map_or(n.path.clone(), Value::to_js_string),
                        message: f.get("message").map(Value::to_js_string).unwrap_or_default(),
                    });
                }
            }
            Ok(_) => {}
            Err(e) => out.push(Finding { severity: "error".into(), code: id.clone(), size: Some(ctx.name.clone()), slide, path: n.path.clone(), message: format!("A regra {id} falhou: {e}") }),
        }
    }
    for child in &n.children {
        external_findings(ext, child, Some(&node), slide, ctx, size, out);
    }
}

// ───────────── junção ─────────────

fn walk_engine(n: &LNode, ctx: &DeckCtx, slide: usize, declared: Option<&HashSet<String>>, out: &mut Vec<Finding>) {
    for c in &n.children {
        engine_findings(c, ctx, slide, declared, out);
        walk_engine(c, ctx, slide, declared, out);
    }
}

/// Como lint.ts keyOf: sem o slide, o mesmo achado em vários slides (o rodapé de cada um) sai uma vez.
fn key_of(f: &Finding) -> String {
    format!("{}|{}|{}", f.code, f.path, f.message)
}

/// Achados de todos os tamanhos sem repetir o que vale em todos (lint.ts mergeSizes).
fn merge_sizes(per_size: Vec<Vec<Finding>>, names: &[String]) -> Vec<Finding> {
    let count = per_size.len();
    let mut keys: Vec<String> = Vec::new();
    let mut by_key: Vec<(Finding, usize)> = Vec::new();
    for (i, list) in per_size.into_iter().enumerate() {
        for mut f in list {
            let k = key_of(&f);
            match keys.iter().position(|x| *x == k) {
                Some(at) => by_key[at].1 += 1,
                None => {
                    f.size = Some(names[i].clone());
                    keys.push(k);
                    by_key.push((f, 1));
                }
            }
        }
    }
    by_key
        .into_iter()
        .map(|(mut f, n)| {
            if n >= count {
                f.size = None;
            }
            f
        })
        .collect()
}

/// Irmãos homônimos com o mesmo achado viram um (`Text[0,3]`, `Box[0..3]`), como os diagnósticos
/// (fit/group.ts): cada segmento com `[i]` é uma variação; escolha gulosa do maior grupo, empate
/// no mais fundo e depois no que vem antes; o grupo fica na posição do primeiro membro.
fn group_same(findings: Vec<Finding>) -> Vec<Finding> {
    let index_re = &*INDEX_RE;
    struct Candidate {
        key: String,
        depth: usize,
        base: String,
        members: Vec<(usize, usize)>,
    }
    let mut candidates: Vec<Candidate> = Vec::new();
    for (position, f) in findings.iter().enumerate() {
        let segments: Vec<&str> = f.path.split(SEPARATOR).collect();
        for (depth, seg) in segments.iter().enumerate() {
            let Some(c) = index_re.captures(seg) else { continue };
            let base = c[1].to_string();
            let index: usize = c[2].parse().unwrap_or(0);
            let wildcard: Vec<String> = segments.iter().enumerate().map(|(at, other)| if at == depth { format!("{base}[*]") } else { other.to_string() }).collect();
            let key = format!("{}\u{0}{}\u{0}{}\u{0}{}", f.size.clone().unwrap_or_default(), f.slide, f.severity, wildcard.join(SEPARATOR));
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
    let mut taken: HashSet<usize> = HashSet::new();
    let mut chosen: Vec<Candidate> = Vec::new();
    loop {
        for c in candidates.iter_mut() {
            c.members.retain(|(p, _)| !taken.contains(p));
        }
        let first = |c: &Candidate| c.members.iter().map(|(p, _)| *p).min().unwrap_or(usize::MAX);
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
    let mut out = Vec::new();
    for (position, f) in findings.iter().enumerate() {
        if let Some(c) = chosen.iter().find(|c| c.members.iter().map(|(p, _)| *p).min() == Some(position)) {
            let mut members = c.members.clone();
            members.sort_by_key(|(_, i)| *i);
            let indices: Vec<usize> = members.iter().map(|(_, i)| *i).collect();
            let contiguous = indices.windows(2).all(|w| w[1] == w[0] + 1);
            let label = if contiguous { format!("{}[{}..{}]", c.base, indices[0], indices[indices.len() - 1]) } else { format!("{}[{}]", c.base, indices.iter().map(usize::to_string).collect::<Vec<_>>().join(",")) };
            // Sem dados de gravidade, o "pior" é o de menor índice.
            let mut g = findings[members[0].0].clone();
            let mut segments: Vec<String> = g.path.split(SEPARATOR).map(str::to_string).collect();
            segments[c.depth] = label.clone();
            g.path = segments.join(SEPARATOR);
            g.message = format!("{} (×{}: mesmo problema em {label})", g.message, indices.len());
            out.push(g);
        } else if !taken.contains(&position) {
            out.push(f.clone());
        }
    }
    out
}

/// lint.ts groupFindings: agrupa dentro de cada (código, mensagem).
fn group(findings: Vec<Finding>) -> Vec<Finding> {
    let mut keys: Vec<(String, String)> = Vec::new();
    for f in &findings {
        let k = (f.code.clone(), f.message.clone());
        if !keys.contains(&k) {
            keys.push(k);
        }
    }
    keys.into_iter().flat_map(|(code, message)| group_same(findings.iter().filter(|f| f.code == code && f.message == message).cloned().collect())).collect()
}

pub fn lint(deck_path: &Path, sizes: &[DeckCtx], config: &Config, options: crate::text::TextOptions) -> Result<Vec<Finding>, String> {
    let (interp, decks) = js::evaluate_deck_with(deck_path, sizes, &mut Vec::new())?;
    // lint.ts: resolve no 1º tamanho; erro de resolve é o único achado (prop da 0.x vira legacy-prop).
    if let Some(f) = decks.first().zip(sizes.first()).and_then(|(d, c)| crate::validate::validate(d, c).fatal) {
        return Ok(vec![Finding { severity: "error".into(), code: if f.removed { "legacy-prop" } else { "structure" }.into(), size: None, slide: 0, path: f.path.clone(), message: f.text() }]);
    }
    let (mut external, disable) = external_of(config)?;
    let declared: Option<HashSet<String>> = config.theme.as_ref().map(|t| t.colors.iter().map(|(_, hex)| format!("#{}", hex.to_ascii_uppercase())).collect());
    let canonical = std::fs::canonicalize(deck_path).unwrap_or_else(|_| deck_path.to_path_buf());
    let mut per_size = Vec::new();
    let (fonts, _) = crate::text::Fonts::new(&config.fonts, options);
    let run = std::cell::RefCell::new(crate::model::ContainerRun::new(interp));
    for (i, (ctx, deck)) in sizes.iter().zip(&decks).enumerate() {
        let mut found = Vec::new();
        // Estrutura: o que o resolve recusa (placeholder fora de layout, Connector sem alvo…).
        // M19: com os Containers medidos, o lint vê o conteúdo que a função de cada um devolveu.
        let diags = match crate::containers::resolve(deck, ctx, &canonical, &fonts, &run) {
            Ok((_, diags)) => diags,
            Err(f) if i == 0 => return Ok(vec![Finding { severity: "error".into(), code: if f.removed { "legacy-prop" } else { "structure" }.into(), size: None, slide: 0, path: f.path.clone(), message: f.text() }]),
            Err(f) => return Err(f.text()),
        };
        let filled = crate::containers::filled_deck(deck, &run.borrow());
        for d in diags.into_vec().into_iter().filter(|d| d.level == Level::Error && !d.code.starts_with("container-")) {
            found.push(Finding { severity: "error".into(), code: "structure".into(), size: None, slide: d.slide, path: if d.slide == 0 { "Deck".into() } else { "Slide".into() }, message: d.msg });
        }
        // css-not-emitted do build (cada slide do autor; o lint não pagina).
        let mut notes = crate::validate::validate(deck, ctx).notes;
        notes.append(&mut run.borrow_mut().notes);
        notes.sort_by_key(|(slide, _)| *slide);
        let css: Vec<crate::diag::Diag> = notes.iter().map(|(slide, n)| crate::validate::note_diag(*slide, n)).collect();
        for d in crate::report::group_by_message(css) {
            found.push(Finding { severity: "warning".into(), code: "css-not-emitted".into(), size: Some(ctx.name.clone()), slide: d.slide, path: d.path, message: d.msg });
        }
        let slides = slides_of(&filled, ctx);
        let mut size_obj = Obj::new();
        size_obj.insert(Rc::from("name"), str_val(&ctx.name));
        size_obj.insert(Rc::from("width"), Value::Num(ctx.width));
        size_obj.insert(Rc::from("height"), Value::Num(ctx.height));
        let size = obj_val(size_obj);
        for (i, slide) in slides.iter().enumerate() {
            walk_engine(slide, ctx, i + 1, declared.as_ref(), &mut found);
            if let Some(ext) = external.as_mut() {
                external_findings(ext, slide, None, i + 1, ctx, &size, &mut found);
            }
        }
        per_size.push(found);
    }
    let names: Vec<String> = sizes.iter().map(|s| s.name.clone()).collect();
    let merged = merge_sizes(per_size, &names).into_iter().filter(|f| !disable.contains(&f.code)).collect();
    Ok(group(merged))
}

fn rank(severity: &str) -> u8 {
    match severity {
        "error" => 0,
        "warning" => 1,
        _ => 2,
    }
}

pub fn summary(findings: &[Finding]) -> String {
    if findings.is_empty() {
        return "Lint: nada a apontar.".into();
    }
    let counts = ["error", "warning", "info"].map(|s| format!("{} {s}", findings.iter().filter(|f| f.severity == s).count())).join(", ");
    let mut sorted: Vec<&Finding> = findings.iter().collect();
    sorted.sort_by_key(|f| (rank(&f.severity), f.slide));
    let mut out = format!("Lint: {counts}");
    for f in sorted {
        let mark = match f.severity.as_str() {
            "error" => "✖",
            "warning" => "▲",
            _ => "•",
        };
        let size = f.size.as_ref().map(|s| format!("{s} · ")).unwrap_or_default();
        out.push_str(&format!("\n  {mark} [{size}slide {}] {} em {}\n    {}", f.slide, f.code, f.path, f.message));
    }
    out
}

pub fn json(findings: &[Finding]) -> String {
    let esc = |s: &str| {
        let mut o = String::new();
        js::value::to_json(&str_val(s), &mut o);
        o
    };
    let items: Vec<String> = findings
        .iter()
        .map(|f| {
            let size = f.size.as_ref().map(|s| format!(", \"size\": {}", esc(s))).unwrap_or_default();
            format!("    {{ \"severity\": {}, \"code\": {}{size}, \"slide\": {}, \"path\": {}, \"message\": {} }}", esc(&f.severity), esc(&f.code), f.slide, esc(&f.path), esc(&f.message))
        })
        .collect();
    if items.is_empty() {
        return "{\n  \"findings\": []\n}".into();
    }
    format!("{{\n  \"findings\": [\n{}\n  ]\n}}", items.join(",\n"))
}
