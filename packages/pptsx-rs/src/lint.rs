//! `lint` (lint/lint.ts do pptsx): avalia e resolve o deck sem gravar nada e aponta o que vai dar
//! trabalho. Regras da engine (props da 0.x, `lineHeight` alto, `fr` solto, cores fora do tema,
//! estrutura) e as regras externas da config e dos DS (`lint.rules`, `ds[].rules`): funções JS
//! chamadas pelo avaliador que carregou a config, com o nó no formato do pptsx (kind, path, props,
//! css, runs, children) e o contexto (size, theme, slide, path, component, parent).

use std::collections::{HashMap, HashSet};
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
    /// `Some("ds")`: o achado é do design system (cor dos tokens dele, nó de dentro de um componente
    /// dele), não de quem escreve o deck. Não sai no texto nem conta no cabeçalho; o `--json` marca.
    pub origin: Option<&'static str>,
}

/// Origem dos achados que o autor do deck não resolve.
pub const ORIGIN_DS: &str = "ds";

struct Rule {
    id: String,
    severity: String,
    /// Por nó (slide e descendentes).
    check: Option<Value>,
    /// Uma vez por tamanho, com todos os slides.
    check_deck: Option<Value>,
}

/// O que os DS registrados na config dizem de si: os componentes e as cores que são deles.
#[derive(Default)]
struct DsScope {
    names: HashSet<String>,
    components: HashSet<String>,
    /// '#RRGGBB' em maiúsculas.
    colors: HashSet<String>,
}

impl DsScope {
    /// O elemento é a raiz de um componente de DS registrado: pelo nome no manifesto ou pelo `ds`
    /// que o `meta` do componente declara.
    fn owns(&self, el: &Element) -> bool {
        let Some(Value::Object(meta)) = el.props.get(COMPONENT_PROP) else { return false };
        let named = |key: &str, set: &HashSet<String>| meta.get(key).is_some_and(|v| set.contains(&v.to_js_string()));
        named("name", &self.components) || named("ds", &self.names)
    }
}

/// Onde o andar da árvore está em relação aos DS: dentro de um componente de DS, e quais
/// elementos o autor entregou a ele (filhos e props), que voltam a ser do autor.
#[derive(Clone, Default)]
struct Scope {
    inside_ds: bool,
    /// A cor de texto herdada aqui foi posta por um componente de DS: o Text do autor que a herda
    /// (dentro de um cartão do DS, p. ex.) pinta uma cor que não é dele.
    color_of_ds: bool,
    /// Identidade pelo `props` do elemento: `containers::fill` recria o elemento e mantém o `Rc` das props.
    slots: Rc<HashSet<*const Obj>>,
}

/// Níveis de objeto/array em que se procura elemento nas props de um componente (`items[].icon`).
const SLOT_DEPTH: usize = 4;

fn collect_slots(v: &Value, depth: usize, out: &mut HashSet<*const Obj>) {
    match v {
        Value::Element(e) if e.kind == Kind::Fragment => e.children.iter().for_each(|c| collect_slots(c, depth, out)),
        Value::Element(e) => {
            out.insert(Rc::as_ptr(&e.props));
        }
        Value::Array(items) if depth < SLOT_DEPTH => items.borrow().iter().for_each(|c| collect_slots(c, depth + 1, out)),
        Value::Object(o) if depth < SLOT_DEPTH => o.values().for_each(|c| collect_slots(c, depth + 1, out)),
        _ => {}
    }
}

impl Scope {
    /// De quem é o nó: do autor (o footer do Deck, o que ele entregou a um componente) ou do DS.
    fn owner(&self, n: &LNode, ds: &DsScope) -> Scope {
        let author = Scope { inside_ds: false, ..self.clone() };
        if n.author {
            return author;
        }
        if ds.owns(&n.el) {
            let mut slots = (*self.slots).clone();
            if let Some(source) = &n.el.source {
                source.1.values().for_each(|v| collect_slots(v, 0, &mut slots));
            }
            return Scope { inside_ds: true, slots: Rc::new(slots), ..self.clone() };
        }
        if self.slots.contains(&Rc::as_ptr(&n.el.props)) {
            return author;
        }
        self.clone()
    }

    fn enter(&self, n: &LNode, ds: &DsScope) -> Scope {
        let scope = self.owner(n, ds);
        let own_color = n.el.props.get("color").is_some_and(|c| !c.is_nullish());
        Scope { color_of_ds: if own_color { scope.inside_ds } else { scope.color_of_ds }, ..scope }
    }
}

/// lineHeight numérico a partir daqui desloca a 1ª linha no Keynote (M11-G).
const KEYNOTE_LINE_HEIGHT: f64 = 1.5;
const TEXT_COLOR: &str = "#000000";
const SEPARATOR: &str = " > ";
const FOOTER_SEGMENT: &str = "Footer";

/// Nó do deck do autor como o lint vê: o elemento, o path do pptsx e a cor de texto herdada.
struct LNode {
    el: Rc<Element>,
    segment: String,
    path: String,
    style: TextStyle,
    children: Vec<LNode>,
    /// display none e Connector contam nos índices dos irmãos, mas saem da árvore (resolve.ts).
    visible: bool,
    /// Conteúdo que o autor escreveu fora da árvore do slide (o `footer` do Deck): nunca é do DS,
    /// mesmo quando o slide vem de um layout de DS.
    author: bool,
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
    Some(LNode { el: el.clone(), segment, path: String::new(), style, children, visible, author: false })
}

/// Invólucro sintético (Fixed do layout, Footer do Deck), como o resolve do pptsx monta.
fn wrapper(segment: &str, content: &Value, ctx: &DeckCtx, style: &TextStyle) -> LNode {
    let mut flat = Vec::new();
    let _ = js::normalize(vec![content.clone()], &mut flat);
    let children = flat.iter().filter_map(|c| match c { Value::Element(e) => build(e, ctx, style), _ => None }).collect();
    let el = Rc::new(Element { kind: Kind::Box, props: Rc::new(Obj::new()), children: flat, component: true, source: None });
    LNode { el, segment: segment.into(), path: String::new(), style: style.clone(), children, visible: true, author: segment == FOOTER_SEGMENT }
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
                node.children.push(wrapper(FOOTER_SEGMENT, footer, ctx, &node.style));
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
        Kind::Box => &["id", "paginate", "shape", "href", "placeholder", "fitGroup"],
        Kind::Container => &["id", "shape", "href", "fitGroup"],
        Kind::Text => &["id", "whiteSpace", "nowrap", "fit", "minSize", "maxLines", "fitGroup", "href", "paginate", "placeholder"],
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

/// Grava o valor com o nome que o autor escreve (CSS) e com o da 0.x, que as regras antigas leem.
fn put_alias(o: &mut Obj, css: &str, legacy: &str, v: Value) {
    o.insert(Rc::from(css), v.clone());
    o.insert(Rc::from(legacy), v);
}

/// Estilo de texto herdado, nos dois vocabulários: `fontSize`/`size`, `fontFamily`/`font`…
fn text_style_props(o: &mut Obj, kind: Kind, t: &TextStyle) {
    let color = || str_val(&t.color);
    match kind {
        Kind::Text | Kind::SlideNumber => {
            put_alias(o, "fontFamily", "font", t.font.clone());
            put_alias(o, "fontSize", "size", t.size.clone());
            put_alias(o, "fontWeight", "weight", t.weight.clone());
            o.insert(Rc::from("fontStyle"), str_val(if t.italic { "italic" } else { "normal" }));
            o.insert(Rc::from("italic"), Value::Bool(t.italic));
            o.insert(Rc::from("color"), color());
            o.insert(Rc::from("lineHeight"), t.line_height.clone());
            put_alias(o, "textAlign", "align", t.align.clone());
        }
        Kind::Chart => {
            put_alias(o, "fontFamily", "font", t.font.clone());
            o.insert(Rc::from("color"), color());
        }
        Kind::Table => {
            put_alias(o, "fontFamily", "font", t.font.clone());
            put_alias(o, "fontSize", "size", t.size.clone());
            o.insert(Rc::from("color"), color());
            o.insert(Rc::from("lineHeight"), t.line_height.clone());
        }
        Kind::Icon => {
            o.insert(Rc::from("color"), color());
        }
        _ => {}
    }
}

/// Uma prop própria do elemento no `props` do nó: cor vira '#RRGGBB', e as que têm dois nomes
/// (o CSS que o autor escreve e o da 0.x) saem com os dois.
fn put_own(o: &mut Obj, kind: Kind, key: &str, v: Value) {
    let hex = |v: &Value| match v {
        Value::Str(c) => hex_of(c).map_or(v.clone(), |h| str_val(&h)),
        _ => v.clone(),
    };
    let painted = matches!(kind, Kind::Shape | Kind::Path | Kind::Connector);
    match key {
        "objectFit" => put_alias(o, "objectFit", "fit", v),
        "backgroundColor" | "fill" if painted => put_alias(o, "backgroundColor", "fill", hex(&v)),
        "stroke" if painted => {
            o.insert(Rc::from(key), hex(&v));
        }
        "stripe" | "border" if kind == Kind::Table => {
            o.insert(Rc::from(key), hex(&v));
        }
        // No Chart, `font`/`size` são os dos rótulos: os mesmos nomes CSS do Text valem para eles.
        "font" if kind == Kind::Chart => put_alias(o, "fontFamily", "font", v),
        "size" if kind == Kind::Chart => put_alias(o, "fontSize", "size", v),
        _ => {
            o.insert(Rc::from(key), v);
        }
    }
}

/// `props` do nó resolvido: estilo de texto herdado onde se aplica e as props próprias. Cada valor
/// sai com o nome que o autor escreve (`fontSize`, `backgroundColor`…) e com o da 0.x (`size`,
/// `fill`…): regra que lê um ou outro encontra o mesmo valor.
fn props_of(n: &LNode, ctx: &DeckCtx) -> Obj {
    let el = &n.el;
    let mut o = Obj::new();
    text_style_props(&mut o, el.kind, &n.style);
    for key in own_keys(el.kind) {
        if let Some(v) = prop(el, ctx, key) {
            put_own(&mut o, el.kind, key, v);
        }
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

/// O que as regras da engine precisam saber do deck: o tamanho, as cores do tema e os DS da config.
struct EngineCx<'a> {
    ctx: &'a DeckCtx,
    declared: Option<&'a HashSet<String>>,
    ds: &'a DsScope,
}

const OFF_THEME_FIXED: &str = "Ela fica fixa no arquivo (trocar o tema não a repinta)";

fn engine_findings(n: &LNode, cx: &EngineCx, slide: usize, scope: &Scope, out: &mut Vec<Finding>) {
    let inside_ds = scope.inside_ds;
    let inherited = scope.color_of_ds.then(|| n.style.color.to_ascii_uppercase());
    let (el, ctx) = (&n.el, cx.ctx);
    // Info de dentro de um componente de DS é para quem faz o DS; warning continua com o autor.
    let ds_origin = inside_ds.then_some(ORIGIN_DS);
    let mut push = |severity: &str, code: &str, origin: Option<&'static str>, message: String| out.push(Finding { severity: severity.into(), code: code.into(), size: None, slide, path: n.path.clone(), message, origin });
    if matches!(el.kind, Kind::Text | Kind::Table)
        && let Value::Num(lh) = n.style.inherit(el, ctx).line_height
            && lh >= KEYNOTE_LINE_HEIGHT {
                push("warning", "keynote-line-height", None, format!("lineHeight={{{}}}: no Keynote a 1ª linha desce até ~2 pt (guia §4). Se a posição exata importa, use até 1.4 ou confira no Keynote.", js::value::num_to_string(lh)));
            }
    if matches!(el.kind, Kind::Box | Kind::Container) && prop_str(el, ctx, "display").as_deref() == Some("grid")
        && let Some(t) = prop_str(el, ctx, "gridTemplateColumns").filter(|t| bare_fr(t)) {
            push("info", "grid-fr", ds_origin, format!("gridTemplateColumns=\"{t}\": `1fr` cresce até a palavra mais longa; com valores longos o grid sai do slide. Use repeat(n, minmax(0, 1fr)) (guia §3)."));
        }
    let Some(declared) = cx.declared else { return };
    let off: Vec<String> = painted_colors(n, ctx).into_iter().filter(|c| c.starts_with('#') && !declared.contains(c)).collect();
    // O tema do arquivo só tem 10 slots: a cor de token que não coube neles é do DS, e o autor do
    // deck não tem o que fazer com ela. Hex solto fora de componente de DS continua com o autor.
    let (of_ds, loose): (Vec<String>, Vec<String>) = off.into_iter().partition(|c| inside_ds || cx.ds.colors.contains(c) || inherited.as_ref() == Some(c));
    if !loose.is_empty() {
        push("info", "off-theme-color", None, format!("Cor fora do tema: {}. {OFF_THEME_FIXED}; use uma cor do tema se ela faz parte da marca.", loose.join(", ")));
    }
    if !of_ds.is_empty() {
        push("info", "off-theme-color", Some(ORIGIN_DS), format!("Cor do design system fora do tema: {}. {OFF_THEME_FIXED}. É do DS, não do deck: quem resolve é o DS (um slot do tema para ela).", of_ds.join(", ")));
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

/// Corpo final de cada Text/Table depois do fit, por path. Só existe com o layout do slide.
type Fitted = HashMap<String, f64>;

/// Layout do slide como o `check` faz (sem paginar, como o resto do lint) só para ler o corpo
/// com que cada texto e tabela seria desenhado.
fn fitted_sizes(slide: &crate::model::SlideSpec, fonts: &crate::text::Fonts, index: usize) -> Fitted {
    let round = |size: f32| (f64::from(size) * 100.0).round() / 100.0;
    let laid = crate::layout::layout_slide(slide, fonts, index, &crate::diag::Diags::default());
    laid.placed
        .iter()
        .filter_map(|p| {
            let size = p.text.as_ref().map(|t| t.size).or_else(|| p.table.as_ref().map(|t| t.size))?;
            Some((p.node.label.clone(), round(size)))
        })
        .collect()
}

fn has_children(kind: Kind) -> bool {
    matches!(kind, Kind::Box | Kind::Slide | Kind::Container)
}

/// O nó no formato do ResolvedNode do pptsx (o que as regras dos DS leem).
fn node_value(n: &LNode, ctx: &DeckCtx, fitted: &Fitted) -> Value {
    let mut o = Obj::new();
    o.insert(Rc::from("kind"), str_val(&kind_name(n.el.kind)));
    o.insert(Rc::from("path"), str_val(&n.path));
    let mut props = props_of(n, ctx);
    if let Some(size) = fitted.get(&n.path) {
        props.insert(Rc::from("fittedFontSize"), Value::Num(*size));
    }
    o.insert(Rc::from("props"), obj_val(props));
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
    if has_children(n.el.kind) {
        o.insert(Rc::from("children"), arr_val(n.children.iter().map(|c| node_value(c, ctx, fitted)).collect()));
    }
    if let Some(meta) = n.el.props.get(COMPONENT_PROP) {
        o.insert(Rc::from("component"), meta.clone());
    }
    obj_val(o)
}

/// O slide como as regras o recebem: o nó resolvido e `sourceSlide`, o número dele no <Deck> do
/// autor (base 1; o lint não pagina, então é a posição do slide).
fn slide_value(n: &LNode, ctx: &DeckCtx, fitted: &Fitted, number: usize) -> Value {
    let value = node_value(n, ctx, fitted);
    let Value::Object(o) = &value else { return value };
    let mut o = (**o).clone();
    o.insert(Rc::from("sourceSlide"), Value::Num(number as f64));
    obj_val(o)
}

struct External {
    interp: js::Interp,
    rules: Vec<Rule>,
    theme: Value,
}

fn function_of(o: &Obj, key: &str) -> Option<Value> {
    o.get(key).filter(|v| matches!(v, Value::Func(_))).cloned()
}

fn rules_of(list: Option<&Value>, out: &mut Vec<Rule>) {
    let Some(Value::Array(items)) = list else { return };
    for r in items.borrow().iter() {
        let Value::Object(o) = r else { continue };
        let (check, check_deck) = (function_of(o, "check"), function_of(o, "checkDeck"));
        if check.is_none() && check_deck.is_none() {
            continue;
        }
        out.push(Rule { id: o.get("id").map(Value::to_js_string).unwrap_or_else(|| "regra".into()), severity: o.get("severity").map(Value::to_js_string).unwrap_or_else(|| "warning".into()), check, check_deck });
    }
}

/// Toda string que é cor dentro do valor (lista ou árvore de tokens), como '#RRGGBB' em maiúsculas.
fn colors_in(v: &Value, out: &mut HashSet<String>) {
    match v {
        Value::Str(c) => out.extend(hex_of(c).map(|h| h.to_ascii_uppercase())),
        Value::Array(items) => items.borrow().iter().for_each(|c| colors_in(c, out)),
        Value::Object(o) => o.values().for_each(|c| colors_in(c, out)),
        _ => {}
    }
}

/// O que o manifesto de um DS declara como dele: os nomes dos componentes e as cores (`colors` ou
/// `palette`: lista ou árvore de cores; `tokens.color`/`tokens.colors`; e as do `theme`).
fn ds_scope_of(ds: &Obj, out: &mut DsScope) {
    out.names.extend(ds.get("name").map(Value::to_js_string));
    if let Some(Value::Array(components)) = ds.get("components") {
        out.components.extend(components.borrow().iter().filter_map(|c| match c {
            Value::Object(meta) => meta.get("name").map(Value::to_js_string),
            _ => None,
        }));
    }
    for key in ["colors", "palette"] {
        if let Some(v) = ds.get(key) {
            colors_in(v, &mut out.colors);
        }
    }
    let group = |holder: &str, key: &str| match ds.get(holder) {
        Some(Value::Object(o)) => o.get(key).cloned(),
        _ => None,
    };
    for v in [group("tokens", "color"), group("tokens", "colors"), group("theme", "colors")].into_iter().flatten() {
        colors_in(&v, &mut out.colors);
    }
}

/// O que a config traz para o lint: as regras externas com o avaliador que as roda, os códigos
/// desligados e o que os DS registrados declaram.
#[derive(Default)]
struct Loaded {
    external: Option<External>,
    disable: Vec<String>,
    ds: DsScope,
}

/// Regras de `lint.rules` e de cada `ds[].rules` da config, e os códigos desligados.
fn external_of(config: &Config) -> Result<Loaded, String> {
    let Some(path) = &config.path else { return Ok(Loaded::default()) };
    let (interp, value) = js::evaluate_module(path)?;
    let Value::Object(cfg) = &value else { return Ok(Loaded::default()) };
    let mut rules = Vec::new();
    let mut disable = Vec::new();
    let mut ds_scope = DsScope::default();
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
                ds_scope_of(ds, &mut ds_scope);
            }
        }
    }
    let theme = cfg.get("theme").cloned().unwrap_or(Value::Undefined);
    Ok(Loaded { external: Some(External { interp, rules, theme }), disable, ds: ds_scope })
}

/// Um achado devolvido por uma regra, com os padrões de quem a chamou (severidade da regra, slide e path do nó ou do deck).
struct RuleCall<'a> {
    id: &'a str,
    severity: &'a str,
    size: &'a str,
    slide: usize,
    path: &'a str,
}

fn text_field(f: &Obj, key: &str) -> Option<String> {
    f.get(key).filter(|v| !v.is_nullish()).map(Value::to_js_string)
}

fn collect_findings(result: Result<Value, String>, call: &RuleCall, slide_of: impl Fn(&Obj) -> (usize, String), out: &mut Vec<Finding>) {
    let finding = |severity: String, slide: usize, path: String, message: String| Finding { severity, code: call.id.to_string(), size: Some(call.size.to_string()), slide, path, message, origin: None };
    match result {
        Ok(Value::Array(found)) => {
            for f in found.borrow().iter() {
                let Value::Object(f) = f else { continue };
                let (slide, path) = slide_of(f);
                out.push(finding(text_field(f, "severity").unwrap_or_else(|| call.severity.to_string()), slide, text_field(f, "path").unwrap_or(path), text_field(f, "message").unwrap_or_default()));
            }
        }
        Ok(_) => {}
        Err(e) => out.push(finding("error".into(), call.slide, call.path.to_string(), format!("A regra {} falhou: {e}", call.id))),
    }
}

/// O tamanho em que o deck foi resolvido, como o Rust o usa e como as regras o recebem (`ctx.size`).
struct SizeCx<'a> {
    ctx: &'a DeckCtx,
    size: Value,
}

impl<'a> SizeCx<'a> {
    fn new(ctx: &'a DeckCtx) -> Self {
        let mut o = Obj::new();
        o.insert(Rc::from("name"), str_val(&ctx.name));
        o.insert(Rc::from("width"), Value::Num(ctx.width));
        o.insert(Rc::from("height"), Value::Num(ctx.height));
        SizeCx { ctx, size: obj_val(o) }
    }
}

fn base_context(ext: &External, size: &Value) -> Obj {
    let mut c = Obj::new();
    c.insert(Rc::from("size"), size.clone());
    if !matches!(ext.theme, Value::Undefined) {
        c.insert(Rc::from("theme"), ext.theme.clone());
    }
    c
}

/// `check` de cada regra no nó e nos descendentes. `node` é o valor já montado de `n` (o mesmo
/// objeto que o pai tem em `children` e que `checkDeck` recebe).
fn external_findings(ext: &mut External, n: &LNode, node: &Value, parent: Option<&Value>, slide: usize, at: &SizeCx, out: &mut Vec<Finding>) {
    let mut c = base_context(ext, &at.size);
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
        let Some(check) = ext.rules[i].check.clone() else { continue };
        let (id, severity) = (ext.rules[i].id.clone(), ext.rules[i].severity.clone());
        let result = js::call_function(&mut ext.interp, &check, vec![node.clone(), context.clone()]);
        let call = RuleCall { id: &id, severity: &severity, size: &at.ctx.name, slide, path: &n.path };
        collect_findings(result, &call, |_| (slide, n.path.clone()), out);
    }
    if !has_children(n.el.kind) {
        return;
    }
    let Value::Object(o) = node else { return };
    let Some(Value::Array(children)) = o.get("children") else { return };
    let children = children.borrow().clone();
    for (child, value) in n.children.iter().zip(&children) {
        external_findings(ext, child, value, Some(node), slide, at, out);
    }
}

const DECK_PATH: &str = "Deck";

/// `checkDeck` de cada regra, uma vez por tamanho, com todos os slides resolvidos: o que só se vê
/// no deck inteiro (ritmo, repetição, slide que falta). Achado sem `slide` é do deck (slide 0).
fn deck_findings(ext: &mut External, slides: &[Value], paths: &[String], at: &SizeCx, out: &mut Vec<Finding>) {
    if ext.rules.iter().all(|r| r.check_deck.is_none()) {
        return;
    }
    let mut d = Obj::new();
    d.insert(Rc::from("slides"), arr_val(slides.to_vec()));
    let deck = obj_val(d);
    let context = obj_val(base_context(ext, &at.size));
    // Sem `path`, o achado aponta o slide que ele citou; sem slide (ou fora do deck), o Deck.
    let place = |f: &Obj| match f.get("slide") {
        Some(Value::Num(n)) if *n >= 1.0 && (*n as usize) <= paths.len() => (*n as usize, paths[*n as usize - 1].clone()),
        _ => (0, DECK_PATH.to_string()),
    };
    for i in 0..ext.rules.len() {
        let Some(check) = ext.rules[i].check_deck.clone() else { continue };
        let (id, severity) = (ext.rules[i].id.clone(), ext.rules[i].severity.clone());
        let result = js::call_function(&mut ext.interp, &check, vec![deck.clone(), context.clone()]);
        let call = RuleCall { id: &id, severity: &severity, size: &at.ctx.name, slide: 0, path: DECK_PATH };
        collect_findings(result, &call, place, out);
    }
}

// ───────────── junção ─────────────

fn walk_engine(n: &LNode, cx: &EngineCx, slide: usize, scope: &Scope, out: &mut Vec<Finding>) {
    for c in &n.children {
        let inner = scope.enter(c, cx.ds);
        engine_findings(c, cx, slide, &inner, out);
        walk_engine(c, cx, slide, &inner, out);
    }
}

/// Como lint.ts keyOf: sem o slide, o mesmo achado em vários slides (o rodapé de cada um) sai uma vez.
fn key_of(f: &Finding) -> String {
    format!("{}|{}|{}|{}", f.code, f.path, f.message, f.origin.unwrap_or_default())
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

fn fatal_finding(f: &crate::validate::Fatal) -> Finding {
    Finding { severity: "error".into(), code: if f.removed { "legacy-prop" } else { "structure" }.into(), size: None, slide: 0, path: f.path.clone(), message: f.text(), origin: None }
}

/// Regras externas num tamanho: `check` em cada slide e nó, depois `checkDeck` com todos os slides.
/// O layout só roda aqui (é ele que dá o `fittedFontSize`): sem regra externa o lint não o paga.
fn external_pass(ext: &mut External, slides: &[LNode], spec: &crate::model::DeckSpec, fonts: &crate::text::Fonts, ctx: &DeckCtx, out: &mut Vec<Finding>) {
    if ext.rules.is_empty() {
        return;
    }
    let at = SizeCx::new(ctx);
    // Só casa slide com layout quando os dois lados têm os mesmos slides.
    let aligned = spec.slides.len() == slides.len();
    let values: Vec<Value> = slides
        .iter()
        .enumerate()
        .map(|(i, slide)| {
            let fitted = if aligned { fitted_sizes(&spec.slides[i], fonts, i + 1) } else { Fitted::new() };
            slide_value(slide, ctx, &fitted, i + 1)
        })
        .collect();
    for (i, (slide, value)) in slides.iter().zip(&values).enumerate() {
        external_findings(ext, slide, value, None, i + 1, &at, out);
    }
    let paths: Vec<String> = slides.iter().map(|s| s.path.clone()).collect();
    deck_findings(ext, &values, &paths, &at, out);
}

pub fn lint(deck_path: &Path, sizes: &[DeckCtx], config: &Config, options: crate::text::TextOptions) -> Result<Vec<Finding>, String> {
    let (interp, decks) = js::evaluate_deck_with(deck_path, sizes, &mut Vec::new())?;
    // lint.ts: resolve no 1º tamanho; erro de resolve é o único achado (prop da 0.x vira legacy-prop).
    if let Some(f) = decks.first().zip(sizes.first()).and_then(|(d, c)| crate::validate::validate(d, c).fatal) {
        return Ok(vec![fatal_finding(&f)]);
    }
    let Loaded { mut external, disable, ds } = external_of(config)?;
    let declared: Option<HashSet<String>> = config.theme.as_ref().map(|t| t.colors.iter().map(|(_, hex)| format!("#{}", hex.to_ascii_uppercase())).collect());
    let canonical = std::fs::canonicalize(deck_path).unwrap_or_else(|_| deck_path.to_path_buf());
    let mut per_size = Vec::new();
    let (fonts, _) = crate::text::Fonts::new(&config.fonts, options);
    let run = std::cell::RefCell::new(crate::model::ContainerRun::new(interp));
    for (i, (ctx, deck)) in sizes.iter().zip(&decks).enumerate() {
        let mut found = Vec::new();
        // Estrutura: o que o resolve recusa (placeholder fora de layout, Connector sem alvo…).
        // M19: com os Containers medidos, o lint vê o conteúdo que a função de cada um devolveu.
        let (spec, diags) = match crate::containers::resolve(deck, ctx, &canonical, &fonts, &run) {
            Ok(resolved) => resolved,
            Err(f) if i == 0 => return Ok(vec![fatal_finding(&f)]),
            Err(f) => return Err(f.text()),
        };
        let filled = crate::containers::filled_deck(deck, &run.borrow());
        for d in diags.into_vec().into_iter().filter(|d| d.level == Level::Error && !d.code.starts_with("container-")) {
            found.push(Finding { severity: "error".into(), code: "structure".into(), size: None, slide: d.slide, path: if d.slide == 0 { DECK_PATH.into() } else { "Slide".into() }, message: d.msg, origin: None });
        }
        // css-not-emitted do build (cada slide do autor; o lint não pagina).
        let mut notes = crate::validate::validate(deck, ctx).notes;
        notes.append(&mut run.borrow_mut().notes);
        notes.sort_by_key(|(slide, _)| *slide);
        let css: Vec<crate::diag::Diag> = notes.iter().map(|(slide, n)| crate::validate::note_diag(*slide, n)).collect();
        for d in crate::report::group_by_message(css) {
            found.push(Finding { severity: "warning".into(), code: "css-not-emitted".into(), size: Some(ctx.name.clone()), slide: d.slide, path: d.path, message: d.msg, origin: None });
        }
        let slides = slides_of(&filled, ctx);
        let cx = EngineCx { ctx, declared: declared.as_ref(), ds: &ds };
        for (i, slide) in slides.iter().enumerate() {
            walk_engine(slide, &cx, i + 1, &Scope::default().enter(slide, &ds), &mut found);
        }
        if let Some(ext) = external.as_mut() {
            external_pass(ext, &slides, &spec, &fonts, ctx, &mut found);
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

/// O achado é do design system: o autor do deck não o resolve.
fn of_ds(f: &Finding) -> bool {
    f.origin == Some(ORIGIN_DS)
}

fn line_of(f: &Finding) -> String {
    let mark = match f.severity.as_str() {
        "error" => "✖",
        "warning" => "▲",
        _ => "•",
    };
    let size = f.size.as_ref().map(|s| format!("{s} · ")).unwrap_or_default();
    // Slide 0 é o deck inteiro (estrutura do Deck, achado de `checkDeck` sem slide).
    let place = if f.slide == 0 { "deck".to_string() } else { format!("slide {}", f.slide) };
    let origin = if of_ds(f) { " (do DS)" } else { "" };
    format!("\n  {mark} [{size}{place}] {}{origin} em {}\n    {}", f.code, f.path, f.message)
}

/// Resumo em texto. Achado do DS (`origin: "ds"`) não sai nem conta no cabeçalho: quem escreve o
/// deck não tem o que fazer com ele. `verbose` mostra todos; o `--json` sempre traz todos.
pub fn summary(findings: &[Finding], verbose: bool) -> String {
    let mut shown: Vec<&Finding> = findings.iter().filter(|f| verbose || !of_ds(f)).collect();
    if shown.is_empty() {
        return "Lint: nada a apontar.".into();
    }
    let counts = ["error", "warning", "info"].map(|s| format!("{} {s}", shown.iter().filter(|f| f.severity == s).count())).join(", ");
    shown.sort_by_key(|f| (rank(&f.severity), f.slide));
    let lines: String = shown.into_iter().map(line_of).collect();
    format!("Lint: {counts}{lines}")
}

/// JSON dos achados. Os do DS levam `"origin": "ds"`; `include_ds` falso os deixa de fora (o MCP).
pub fn json(findings: &[Finding], include_ds: bool) -> String {
    let esc = |s: &str| {
        let mut o = String::new();
        js::value::to_json(&str_val(s), &mut o);
        o
    };
    let items: Vec<String> = findings
        .iter()
        .filter(|f| include_ds || !of_ds(f))
        .map(|f| {
            let size = f.size.as_ref().map(|s| format!(", \"size\": {}", esc(s))).unwrap_or_default();
            let origin = f.origin.map(|o| format!(", \"origin\": {}", esc(o))).unwrap_or_default();
            format!("    {{ \"severity\": {}, \"code\": {}{size}, \"slide\": {}, \"path\": {}, \"message\": {}{origin} }}", esc(&f.severity), esc(&f.code), f.slide, esc(&f.path), esc(&f.message))
        })
        .collect();
    if items.is_empty() {
        return "{\n  \"findings\": []\n}".into();
    }
    format!("{{\n  \"findings\": [\n{}\n  ]\n}}", items.join(",\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const DS: &str = r##"import { Box, Text, defineComponent, defineDs } from 'pptsx';

export const Card = defineComponent({ name: 'Card' }, ({ children }) => (
  <Box backgroundColor="#ABCDEF" color="#0F0F0F" padding={8}>
    <Text color="#FEDCBA">interno</Text>
    {children}
  </Box>
));

const textProps = {
  id: 'test/text-props',
  severity: 'warning',
  check: (node) => {
    if (node.kind !== 'text' || node.props.fontSize !== 20) return [];
    const p = node.props;
    return [{ message: [p.fontSize, p.size, p.fontFamily, p.font, p.fontWeight, p.weight, p.fontStyle, p.italic, p.textAlign, p.align, typeof p.fittedFontSize].join('|') }];
  },
};

const shapeProps = {
  id: 'test/shape-props',
  severity: 'info',
  check: (node) => (node.kind === 'shape' ? [{ message: `${node.props.backgroundColor}|${node.props.fill}` }] : []),
};

const closing = {
  id: 'test/closing',
  severity: 'warning',
  checkDeck: (deck, ctx) => {
    const last = deck.slides[deck.slides.length - 1];
    const repeated = deck.slides.filter((slide, i) => i > 0 && slide.component?.name === deck.slides[i - 1].component?.name);
    return [
      { message: `${deck.slides.length} slides em ${ctx.size.name}; o último é ${last.component?.name ?? last.kind} (${last.sourceSlide})` },
      ...repeated.map((slide) => ({ message: 'Mesmo layout do slide anterior.', slide: slide.sourceSlide, severity: 'info' })),
    ];
  },
};

export const ds = defineDs({
  name: 'test-ds',
  version: '0.0.0',
  components: [{ name: 'Card' }],
  colors: { extra: '#0A0B0C' },
  rules: [textProps, shapeProps, closing],
});
"##;

    const CONFIG: &str = r##"import { defineConfig } from 'pptsx';
import { ds } from './ds.tsx';

export default defineConfig({ ds: [ds], theme: { name: 'T', colors: { dark1: '#000000', accent1: '#112233' } } });
"##;

    const DECK: &str = r##"import { Deck, Shape, Slide, Text, defineDeck } from 'pptsx';
import { Card } from './ds.tsx';

const Plain = ({ children }) => <Slide>{children}</Slide>;

export default defineDeck(() => (
  <Deck>
    <Slide>
      <Text fontSize={20} fontFamily="Arial" fontWeight="bold" fontStyle="italic" textAlign="center">Título</Text>
      <Shape kind="rect" width={10} height={10} backgroundColor="#112233" />
      <Text color="#123456">hex solto</Text>
      <Text color="#0A0B0C">cor de token</Text>
      <Card>
        <Text color="#654321">do autor, dentro do Card</Text>
        <Text>do autor, com a cor que o Card dá</Text>
      </Card>
    </Slide>
    <Plain><Text>dois</Text></Plain>
    <Plain><Text>três</Text></Plain>
  </Deck>
));
"##;

    fn run(name: &str) -> Vec<Finding> {
        let dir = std::env::temp_dir().join(format!("pptsx-rs-lint-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("pasta temporária");
        for (file, text) in [("ds.tsx", DS), (crate::config::CONFIG_FILE, CONFIG), ("deck.tsx", DECK)] {
            std::fs::write(dir.join(file), text).expect("arquivo de teste");
        }
        let deck = dir.join("deck.tsx");
        let config = crate::config::load(&deck).expect("config");
        let sizes = [DeckCtx { name: "16x9".into(), width: 720.0, height: 405.0 }];
        let findings = lint(&deck, &sizes, &config, crate::text::TextOptions::default()).expect("lint");
        let _ = std::fs::remove_dir_all(&dir);
        findings
    }

    fn by_code<'a>(findings: &'a [Finding], code: &str) -> Vec<&'a Finding> {
        findings.iter().filter(|f| f.code == code).collect()
    }

    #[test]
    fn rule_reads_css_names_and_legacy_aliases() {
        let findings = run("props");
        let text = by_code(&findings, "test/text-props");
        assert_eq!(text.len(), 1);
        assert_eq!(text[0].message, "20|20|Arial|Arial|bold|bold|italic|true|center|center|number");
        let shape = by_code(&findings, "test/shape-props");
        assert_eq!(shape.len(), 1);
        assert_eq!(shape[0].message, "#112233|#112233");
    }

    #[test]
    fn check_deck_runs_once_with_every_slide() {
        let findings = run("deck");
        let found = by_code(&findings, "test/closing");
        let whole: Vec<_> = found.iter().filter(|f| f.slide == 0).collect();
        assert_eq!(whole.len(), 1);
        assert_eq!((whole[0].path.as_str(), whole[0].severity.as_str()), ("Deck", "warning"));
        assert_eq!(whole[0].message, "3 slides em 16x9; o último é Plain (3)");
        let repeated: Vec<_> = found.iter().filter(|f| f.slide != 0).collect();
        assert_eq!(repeated.len(), 1);
        assert_eq!((repeated[0].slide, repeated[0].path.as_str(), repeated[0].severity.as_str()), (3, "Plain", "info"));
        assert!(summary(&findings, false).contains("[deck] test/closing em Deck"));
    }

    #[test]
    fn ds_colors_stay_out_of_the_text_summary() {
        let findings = run("origin");
        let off = by_code(&findings, "off-theme-color");
        let colors = |ds: bool| -> String { off.iter().filter(|f| of_ds(f) == ds).map(|f| f.message.as_str()).collect() };
        // Do autor: o hex solto e o filho que ele entregou ao Card.
        assert!(colors(false).contains("#123456") && colors(false).contains("#654321"));
        // Do DS: a cor declarada no manifesto, o que o Card pinta por dentro e a cor de texto que
        // o Text do autor herda dele.
        for color in ["#0A0B0C", "#ABCDEF", "#FEDCBA", "#0F0F0F"] {
            assert!(colors(true).contains(color) && !colors(false).contains(color), "{color}");
        }
        let text = summary(&findings, false);
        assert!(text.contains("#123456") && text.contains("#654321"));
        assert!(!text.contains("#0A0B0C") && !text.contains("#ABCDEF") && !text.contains("#FEDCBA"));
        let shown = findings.iter().filter(|f| f.severity == "info" && !of_ds(f)).count();
        assert!(text.contains(&format!("{shown} info")));
        assert!(summary(&findings, true).contains("#ABCDEF"));
        assert!(json(&findings, true).contains("\"origin\": \"ds\""));
        assert!(!json(&findings, false).contains("\"origin\""));
    }

    #[test]
    fn only_ds_findings_reads_as_clean() {
        let finding = Finding { severity: "info".into(), code: "off-theme-color".into(), size: None, slide: 1, path: "Slide > Text".into(), message: "m".into(), origin: Some(ORIGIN_DS) };
        assert_eq!(summary(std::slice::from_ref(&finding), false), "Lint: nada a apontar.");
        assert!(summary(&[finding], true).contains("off-theme-color (do DS)"));
    }
}
