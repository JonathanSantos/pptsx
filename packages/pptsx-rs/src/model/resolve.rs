//! Resolve: Deck → Slide → nós, com paths, placeholders, ids de conector, Container (M19), footer e numeração.

use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use taffy::style::{AlignContent, FlexDirection};
use crate::css::{Dash, Stroke, parse_color};
use crate::diag::Diags;
use crate::js::{DeckCtx, Element, Kind, Value};
use crate::js::value::LAYOUT_KEY;
use crate::text::LineHeight;

use super::*;

// ───────────── resolve ─────────────

pub fn resolve_deck(deck: &Element, ctx: &DeckCtx, deck_path: &Path, diags: &Diags, containers: Option<&RefCell<ContainerRun>>) -> DeckSpec {
    let base_dir = deck_path.parent().unwrap_or(Path::new("."));
    let slides: Vec<&Rc<Element>> = deck
        .children
        .iter()
        .filter_map(|c| match c {
            Value::Element(e) if e.kind == Kind::Slide => Some(e),
            Value::Element(e) => {
                diags.warn(0, format!("<{}> direto no <Deck> foi ignorado (esperado <Slide>)", e.kind.name()));
                None
            }
            _ => None,
        })
        .collect();
    let total = slides.len();
    let theme = deck.props.get("theme").and_then(crate::config::theme_of);
    let sections = match deck.props.get("sections") {
        Some(Value::Array(items)) => items
            .borrow()
            .iter()
            .filter_map(|s| match s {
                Value::Object(o) => Some((o.get("title").map(Value::to_js_string).unwrap_or_default(), o.get("from").map_or(1.0, Value::to_num).max(1.0) as usize)),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    };
    let footer = deck.props.get("footer").cloned().filter(|f| !matches!(f, Value::Undefined | Value::Null | Value::Bool(false)));
    let mut fatal = None;
    let slides = slides
        .iter()
        .enumerate()
        .map(|(i, slide)| {
            let mut cx = Cx { ctx, base_dir, diags, slide: i + 1, total, connectors: Vec::new(), fixed: false, containers, fatal: None };
            let spec = resolve_slide(&mut cx, slide, footer.as_ref());
            if fatal.is_none() {
                fatal = cx.fatal.take();
            }
            spec
        })
        .collect();
    DeckSpec { slides, width: ctx.width as f32, height: ctx.height as f32, theme, sections, fatal }
}

pub(super) fn resolve_slide(cx: &mut Cx, slide: &Element, footer: Option<&Value>) -> SlideSpec {
    let props = &slide.props;
    let mut style = Style { position: Position::Relative, size: Size { width: Dimension::length(cx.ctx.width as f32), height: Dimension::length(cx.ctx.height as f32) }, ..Style::default() };
    container_style(cx, props, &mut style, true);
    padding_style(cx, props, &mut style);
    let background = cx.color(props, "backgroundColor").or_else(|| cx.string(props, "background").and_then(|b| parse_color(&b))).or_else(|| cx.color(props, "fill"));
    let background_image = background_image(cx, props);
    let inherit = inherit_from(cx, props, &Inherit::default());
    let notes = match cx.get(props, "notes") {
        Some(Value::Str(s)) => Some(s.to_string()),
        Some(Value::Element(e)) => Some(plain_text(&e.children)),
        Some(Value::Array(items)) => Some(plain_text(&items.borrow())),
        _ => None,
    }
    .filter(|n| !n.is_empty());
    // resolve/layout.ts notesOf: trechos com o estilo padrão de notas (regular, preto).
    let mut notes_runs = Vec::new();
    if notes.is_some() {
        let mut flat = Vec::new();
        let raw = cx.get(props, "notes").unwrap_or(Value::Undefined);
        let _ = crate::js::normalize(vec![raw], &mut flat);
        let expanded: Vec<Value> = flat.into_iter().flat_map(|v| match v {
            Value::Element(e) if e.kind == Kind::Fragment => e.children.clone(),
            other => vec![other],
        }).collect();
        collect_runs(cx, &expanded, &Inherit::default(), None, &mut notes_runs);
    }
    let hidden = cx.bool(props, "hidden").unwrap_or(false);
    let slide_path = segment_of(slide);
    let has_fixed = matches!(cx.get(props, LAYOUT_KEY), Some(Value::Object(o)) if o.get("fixed").is_some_and(|v| !matches!(v, Value::Undefined | Value::Null | Value::Bool(false))));
    let extra: Vec<&str> = [has_fixed.then_some("Fixed"), footer.is_some().then_some("Footer")].into_iter().flatten().collect();
    let (mut children, extra_paths) = resolve_children_with(cx, &slide.children, &inherit, &slide_path, style.display == Display::Grid, &extra);
    let mut extra_paths = extra_paths.into_iter();
    let layout = layout_of(cx, props);
    check_placeholders(cx, &children, layout.as_deref());
    // M15: conteúdo fixo do layout depois dos filhos do autor, absoluto do tamanho do slide e atrás
    // de tudo (zIndex -1), como o master no PowerPoint (resolve/layout.ts Fixed).
    if let Some(Value::Object(o)) = cx.get(props, LAYOUT_KEY)
        && let Some(fixed) = o.get("fixed").filter(|v| !matches!(v, Value::Undefined | Value::Null | Value::Bool(false))) {
            let mut flat = Vec::new();
            let _ = crate::js::normalize(vec![fixed.clone()], &mut flat);
            cx.fixed = true;
            let fixed_path = extra_paths.next().unwrap_or_else(|| format!("{slide_path} > Fixed"));
            let inner = resolve_children(cx, &flat, &inherit, &fixed_path, false);
            cx.fixed = false;
            let style = Style { position: Position::Absolute, inset: Rect { top: LengthPercentageAuto::length(0.0), right: LengthPercentageAuto::length(0.0), bottom: LengthPercentageAuto::length(0.0), left: LengthPercentageAuto::length(0.0) }, ..Style::default() };
            children.push(Node { kind: NodeKind::Container, style, z: Some(-1.0), absolute: true, paint: Paint { opacity: 1.0, ..Paint::default() }, children: inner, label: fixed_path, href: None, component: true, id: None, paginate: false, slide_number: None, layered: true, placeholder: None, fixed: true, basis: Basis::None });
        }
    // M13: o footer do Deck entra em cada slide como último filho, num invólucro absoluto do
    // tamanho do slide com o conteúdo empurrado para a base (resolve.ts withFooter).
    if let Some(footer) = footer {
        let items = match footer {
            Value::Array(a) => a.borrow().clone(),
            other => vec![other.clone()],
        };
        let mut flat = Vec::new();
        let _ = crate::js::normalize(items, &mut flat);
        let footer_path = extra_paths.next().unwrap_or_else(|| format!("{slide_path} > Footer"));
        let inner = resolve_children(cx, &flat, &inherit, &footer_path, false);
        let style = Style {
            display: Display::Flex,
            position: Position::Absolute,
            inset: Rect { top: LengthPercentageAuto::length(0.0), right: LengthPercentageAuto::length(0.0), bottom: LengthPercentageAuto::length(0.0), left: LengthPercentageAuto::length(0.0) },
            flex_direction: FlexDirection::Column,
            justify_content: AlignContent::FLEX_END,
            ..Style::default()
        };
        children.push(Node { kind: NodeKind::Container, style, z: None, absolute: true, paint: Paint { opacity: 1.0, ..Paint::default() }, children: inner, label: footer_path, href: None, component: true, id: None, paginate: false, slide_number: None, layered: true, placeholder: None, fixed: false, basis: Basis::None });
    }
    let root = Node { kind: NodeKind::Container, style, z: None, absolute: false, paint: Paint { opacity: 1.0, ..Paint::default() }, children, label: slide_path, href: None, component: false, id: None, paginate: false, slide_number: None, layered: false, placeholder: None, fixed: false, basis: Basis::None };
    let mut root = root;
    let mut connectors = std::mem::take(&mut cx.connectors);
    let ids = match scope_ids(&mut root, &mut connectors) {
        Ok(ids) => ids,
        Err(f) => {
            cx.fatal.get_or_insert(f);
            ids_of(&root)
        }
    };
    for c in &connectors {
        for end in [&c.from, &c.to] {
            if !ids.contains(end) {
                cx.diags.push(crate::diag::Level::Error, cx.slide, format!("Connector aponta para id=\"{end}\", mas nenhum nó do slide tem esse id (ids do slide: {})", if ids.is_empty() { "(nenhum)".into() } else { ids.join(", ") }));
            }
        }
    }
    SlideSpec { root, background, background_image, notes, notes_runs, hidden, connectors, layout }
}

pub(super) fn layout_of(cx: &Cx, props: &Props) -> Option<Rc<LayoutSpec>> {
    let Some(Value::Object(o)) = cx.get(props, LAYOUT_KEY) else { return None };
    let name = o.get("name").map(Value::to_js_string).unwrap_or_default();
    if name.trim().is_empty() {
        cx.diags.push(crate::diag::Level::Error, cx.slide, "defineLayout: o nome do layout não pode ser vazio".into());
        return None;
    }
    let placeholders: Vec<String> = match o.get("placeholders") {
        Some(Value::Array(items)) => items.borrow().iter().map(Value::to_js_string).collect(),
        _ => Vec::new(),
    };
    if let Some(dup) = placeholders.iter().enumerate().find(|(i, p)| placeholders[..*i].contains(p)).map(|(_, p)| p) {
        cx.diags.push(crate::diag::Level::Error, cx.slide, format!("defineLayout(\"{name}\"): placeholder \"{dup}\" repetido"));
    }
    let background = match o.get("background") {
        None | Some(Value::Undefined | Value::Null) => None,
        Some(Value::Str(c)) => match parse_color(c) {
            Some(c) => Some(LayoutBackground::Color(c)),
            None => {
                cx.diags.push(crate::diag::Level::Error, cx.slide, format!("defineLayout: background \"{c}\" inválido; use uma cor ou {{ image }}"));
                None
            }
        },
        Some(Value::Object(b)) => match b.get("image") {
            Some(Value::Str(src)) => {
                let path = if Path::new(&**src).is_absolute() { PathBuf::from(&**src) } else { cx.base_dir.join(&**src) };
                if path.is_file() {
                    Some(LayoutBackground::Image(path))
                } else {
                    cx.diags.push(crate::diag::Level::Error, cx.slide, format!("defineLayout(\"{name}\"): imagem de fundo \"{src}\" não encontrada"));
                    None
                }
            }
            _ => {
                cx.diags.push(crate::diag::Level::Error, cx.slide, format!("defineLayout(\"{name}\"): background precisa ser uma cor ou {{ image }}"));
                None
            }
        },
        Some(other) => {
            cx.diags.push(crate::diag::Level::Error, cx.slide, format!("defineLayout: background {} inválido; use uma cor ou {{ image }}", other.to_js_string()));
            None
        }
    };
    Some(Rc::new(LayoutSpec { name, placeholders, background }))
}

pub(super) fn marked_of(nodes: &[Node], out: &mut Vec<String>) {
    for n in nodes {
        if let Some(p) = &n.placeholder {
            out.push(p.clone());
        }
        marked_of(&n.children, out);
    }
}

/// Nós com `placeholder` precisam de um layout que declare o nome, uma vez por slide (resolve/layout.ts).
pub(super) fn check_placeholders(cx: &Cx, children: &[Node], layout: Option<&LayoutSpec>) {
    let mut marked = Vec::new();
    marked_of(children, &mut marked);
    for (i, name) in marked.iter().enumerate() {
        let message = match layout {
            None => format!("placeholder=\"{name}\" fora de um layout: o <Slide> precisa vir de um componente defineLayout(…)"),
            Some(l) if !l.placeholders.contains(name) => {
                let known = if l.placeholders.is_empty() { "nenhum".to_string() } else { l.placeholders.iter().map(|p| format!("\"{p}\"")).collect::<Vec<_>>().join(", ") };
                format!("placeholder=\"{name}\" não existe no layout \"{}\" (declarados: {known})", l.name)
            }
            Some(_) if marked[..i].contains(name) => format!("placeholder=\"{name}\" usado duas vezes no mesmo slide"),
            Some(_) => continue,
        };
        cx.diags.push(crate::diag::Level::Error, cx.slide, message);
    }
}

pub(super) fn ids_of(node: &Node) -> Vec<String> {
    node.id.iter().cloned().chain(node.children.iter().flat_map(ids_of)).collect()
}

/// Dono de um id: o path do nó e o escopo (a instância de componente mais próxima; "" = o slide).
pub(super) struct IdOwner {
    id: String,
    path: String,
    scope: String,
}

pub(super) fn id_owners(node: &Node, scope: &str, out: &mut Vec<IdOwner>, roots: &mut Vec<String>) {
    let own = if node.component { node.label.as_str() } else { scope };
    if node.component {
        roots.push(node.label.clone());
    }
    if let Some(id) = &node.id {
        out.push(IdOwner { id: id.clone(), path: node.label.clone(), scope: own.to_string() });
    }
    for c in &node.children {
        id_owners(c, own, out, roots);
    }
}

pub(super) fn within(path: &str, scope: &str) -> bool {
    scope.is_empty() || path == scope || path.strip_prefix(scope).is_some_and(|rest| rest.starts_with(" > "))
}

pub(super) fn rename_ids(node: &mut Node, finals: &HashMap<String, String>) {
    if node.id.is_some()
        && let Some(id) = finals.get(&node.label) {
            node.id = Some(id.clone());
        }
    for c in &mut node.children {
        rename_ids(c, finals);
    }
}

/// M19 (resolve/connector.ts scopeIds): o mesmo id pode se repetir em instâncias diferentes de
/// componente, nunca no mesmo escopo; as repetições ganham `id#2`, `id#3`… e cada ponta de
/// conector se liga à ocorrência do seu escopo, subindo para os de fora; empate → erro.
pub(super) fn scope_ids(root: &mut Node, connectors: &mut [ConnectorSpec]) -> Result<Vec<String>, crate::validate::Fatal> {
    let fatal = |message: String, path: &str| crate::validate::Fatal { message, path: path.to_string(), removed: false };
    let (mut owners, mut roots) = (Vec::new(), Vec::new());
    for c in &root.children {
        id_owners(c, "", &mut owners, &mut roots);
    }
    for (i, o) in owners.iter().enumerate() {
        if let Some(first) = owners[..i].iter().find(|other| other.id == o.id && other.scope == o.scope) {
            return Err(fatal(format!("id \"{}\" repetido no slide (já usado em {}); ids têm que ser únicos por slide (ou por instância de componente)", o.id, first.path), &o.path));
        }
    }
    let repeated = owners.iter().enumerate().any(|(i, o)| owners[..i].iter().any(|other| other.id == o.id));
    if !repeated {
        return Ok(owners.into_iter().map(|o| o.id).collect());
    }
    let mut seen: HashMap<&str, usize> = HashMap::new();
    let finals: HashMap<String, String> = owners
        .iter()
        .map(|o| {
            let n = seen.entry(o.id.as_str()).or_insert(0);
            *n += 1;
            (o.path.clone(), if *n == 1 { o.id.clone() } else { format!("{}#{n}", o.id) })
        })
        .collect();
    for c in connectors.iter_mut() {
        let mut scopes: Vec<&String> = roots.iter().filter(|r| within(&c.path, r)).collect();
        scopes.sort_by_key(|r| std::cmp::Reverse(r.len()));
        let empty = String::new();
        scopes.push(&empty);
        for end in [&mut c.from, &mut c.to] {
            let named: Vec<&IdOwner> = owners.iter().filter(|o| o.id == *end).collect();
            if named.len() <= 1 {
                continue;
            }
            let mut bound = None;
            for scope in &scopes {
                let visible: Vec<&&IdOwner> = named.iter().filter(|o| within(&o.path, scope)).collect();
                if visible.is_empty() {
                    continue;
                }
                let exact: Vec<&&&IdOwner> = visible.iter().filter(|o| o.scope == **scope).collect();
                if visible.len() == 1 {
                    bound = Some(visible[0].path.clone());
                } else if exact.len() == 1 {
                    bound = Some(exact[0].path.clone());
                } else {
                    let list: Vec<&str> = visible.iter().map(|o| o.path.as_str()).collect();
                    return Err(fatal(format!("id \"{end}\" ambíguo para o conector: existe em {}; declare o conector dentro do componente do nó que ele liga", list.join(", ")), &c.path));
                }
                break;
            }
            if let Some(path) = bound {
                *end = finals[&path].clone();
            }
        }
    }
    rename_ids(root, &finals);
    let mut ids: Vec<String> = Vec::new();
    for o in &owners {
        let id = finals[&o.path].clone();
        if !ids.contains(&id) {
            ids.push(id);
        }
    }
    Ok(ids)
}

pub(super) fn plain_text(children: &[Value]) -> String {
    children
        .iter()
        .map(|c| match c {
            Value::Str(s) => s.to_string(),
            Value::Element(e) => plain_text(&e.children),
            _ => String::new(),
        })
        .collect()
}

/// Segmento do path do pptsx: o componente mais externo que gerou o elemento, senão a primitiva.
pub(crate) fn segment_of(el: &Element) -> String {
    match el.props.get(crate::js::value::COMPONENT_PROP) {
        Some(Value::Object(meta)) => meta.get("name").map(Value::to_js_string).filter(|n| !n.is_empty()).unwrap_or_else(|| el.kind.name().to_string()),
        _ => el.kind.name().to_string(),
    }
}

/// Paths dos filhos (resolve.ts siblingSegments): `[i]` só entre irmãos com o mesmo segmento,
/// contando os que depois saem (display none, Connector) e os invólucros `extra` do slide.
pub(crate) fn child_paths(parent: &str, children: &[Value], extra: &[&str]) -> (Vec<String>, Vec<String>) {
    let mut segments: Vec<String> = children.iter().filter_map(|c| match c { Value::Element(e) => Some(segment_of(e)), _ => None }).collect();
    let own = segments.len();
    segments.extend(extra.iter().map(|s| s.to_string()));
    let mut seen: Vec<(String, usize)> = Vec::new();
    let paths: Vec<String> = segments
        .iter()
        .map(|seg| {
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
            format!("{parent} > {label}")
        })
        .collect();
    let (a, b) = paths.split_at(own);
    (a.to_vec(), b.to_vec())
}

pub(super) fn resolve_children(cx: &mut Cx, children: &[Value], inherit: &Inherit, parent: &str, grid: bool) -> Vec<Node> {
    resolve_children_with(cx, children, inherit, parent, grid, &[]).0
}

pub(super) fn resolve_children_with(cx: &mut Cx, children: &[Value], inherit: &Inherit, parent: &str, grid: bool, extra: &[&str]) -> (Vec<Node>, Vec<String>) {
    let (paths, extras) = child_paths(parent, children, extra);
    let mut out = Vec::new();
    let mut k = 0;
    for child in children {
        match child {
            Value::Element(e) => {
                let path = &paths[k];
                k += 1;
                if let Some(n) = resolve_node(cx, e, inherit, path, grid) {
                    out.push(n);
                }
            }
            Value::Str(s) if !s.trim().is_empty() => {
                cx.warn(format!("texto solto em {parent} (\"{}\") foi ignorado: use <Text>", s.chars().take(30).collect::<String>()));
            }
            _ => {}
        }
    }
    (out, extras)
}

pub(super) fn resolve_node(cx: &mut Cx, el: &Element, inherit: &Inherit, path: &str, in_grid: bool) -> Option<Node> {
    let props = &el.props;
    if cx.string(props, "display").as_deref() == Some("none") {
        return None;
    }
    // `label` é o path do pptsx (Slide > Box[1] > Text): diagnósticos e --debug.
    let label = path.to_string();
    let mut style = Style::default();
    let absolute = item_style(cx, props, &mut style);
    let basis = basis_of(cx, props);
    // Item de grid mantém o mínimo automático: `1fr` = minmax(auto, 1fr) respeita o conteúdo.
    if in_grid {
        if cx.get(props, "minWidth").is_none() {
            style.min_size.width = LengthPercentageAuto::auto();
        }
        if cx.get(props, "minHeight").is_none() {
            style.min_size.height = LengthPercentageAuto::auto();
        }
    }
    let z = cx.num(props, "zIndex");
    let href = cx.string(props, "href");
    let component = el.component;
    let id = cx.string(props, "id");
    let paginate = matches!(el.kind, Kind::Box | Kind::Text | Kind::Table) && cx.bool(props, "paginate").unwrap_or(false);
    let slide_number = (el.kind == Kind::SlideNumber).then(|| cx.string(props, "format").unwrap_or_else(|| "n".into()));
    let placeholder = if matches!(el.kind, Kind::Text | Kind::Image | Kind::Box) { cx.string(props, "placeholder") } else { None };
    let fixed = cx.fixed;
    let explicit = cx.string(props, "position").is_some_and(|p| p != "static");
    let layered_of = |paint: &Paint| explicit || z.is_some() || paint.opacity < 1.0 || paint.rotate != 0.0 || paint.translate != (0.0, 0.0);
    let mk = |kind, style, paint: Paint, children, label| {
        let layered = layered_of(&paint);
        Some(Node { kind, style, z, absolute, paint, children, label, href: href.clone(), component, id: id.clone(), paginate, slide_number: slide_number.clone(), layered, placeholder: placeholder.clone(), fixed, basis })
    };
    match el.kind {
        Kind::Box => {
            container_style(cx, props, &mut style, false);
            padding_style(cx, props, &mut style);
            let mut paint = paint_of(cx, props, &mut style);
            let inner = inherit_from(cx, props, inherit);
            let children = resolve_children(cx, &el.children, &inner, &label, style.display == Display::Grid);
            // Box com `shape` desenha a forma no lugar do retângulo.
            if let Some(shape) = cx.string(props, "shape")
                && let Some(spec) = shape_spec(cx, props, &shape, &mut paint) {
                    let layered = layered_of(&paint);
                    let mut node = Node { kind: NodeKind::Shape(spec), style, z, absolute, paint, children, label, href, component, id, paginate, slide_number: None, layered, placeholder, fixed, basis };
                    node.style.display = Display::Flex;
                    return Some(node);
                }
            mk(NodeKind::Container, style, paint, children, label)
        }
        Kind::Container => {
            container_style(cx, props, &mut style, false);
            padding_style(cx, props, &mut style);
            let mut paint = paint_of(cx, props, &mut style);
            let inner = inherit_from(cx, props, inherit);
            let children = container_children(cx, el, &inner, &label, style.display == Display::Grid, &mut style);
            let measured = cx.containers.is_some_and(|c| c.borrow().measures.contains_key(&(cx.slide - 1, label.clone())));
            let mut node = match cx.string(props, "shape").and_then(|shape| shape_spec(cx, props, &shape, &mut paint)) {
                Some(spec) => {
                    let layered = layered_of(&paint);
                    let mut node = Node { kind: NodeKind::Shape(spec), style, z, absolute, paint, children, label, href, component, id, paginate: false, slide_number: None, layered, placeholder: None, fixed, basis };
                    node.style.display = Display::Flex;
                    node
                }
                None => mk(NodeKind::Container, style, paint, children, label)?,
            };
            node.placeholder = None;
            node.paginate = false;
            if measured {
                // Contenção de tamanho: flex-basis auto (o tamanho fixado no frame medido vale).
                node.basis = Basis::None;
            }
            Some(node)
        }
        Kind::Text | Kind::SlideNumber => {
            padding_style(cx, props, &mut style);
            let paint = paint_of(cx, props, &mut style);
            let t = inherit_from(cx, props, inherit);
            let mut runs = Vec::new();
            if el.kind == Kind::SlideNumber {
                let format = cx.string(props, "format").unwrap_or_else(|| "n".into());
                let text = if format == "n / total" { format!("{} / {}", cx.slide, cx.total) } else { cx.slide.to_string() };
                runs.push(run_of(&t, text, None, None));
            } else {
                collect_runs(cx, &el.children, &t, href.as_deref(), &mut runs);
            }
            let fit = match cx.string(props, "fit").as_deref() {
                Some("truncate") => Fit::Truncate,
                Some("error") => Fit::Error,
                _ => Fit::Shrink,
            };
            let min_size = cx.num(props, "minSize").unwrap_or_else(|| (t.size * 0.75).floor().max(10.0));
            let nowrap = cx.bool(props, "nowrap").unwrap_or(false) || cx.string(props, "whiteSpace").as_deref() == Some("nowrap");
            let max_lines = cx.num(props, "maxLines").map(|n| n.max(1.0) as usize);
            own_metrics(&mut runs, t.size, &t.family);
            let sample = (el.kind == Kind::SlideNumber).then(|| if cx.string(props, "format").as_deref() == Some("n / total") { "88 / 88".to_string() } else { "88".to_string() });
            let nowrap = nowrap || sample.is_some();
            let spec = TextSpec { runs, family: t.family.clone(), size: t.size, min_size, line_height: t.line_height, align: t.align, letter_spacing: t.letter_spacing, nowrap, max_lines, fit, sample };
            mk(NodeKind::Text(spec), style, paint, Vec::new(), label)
        }
        Kind::Shape => {
            let mut paint = paint_of(cx, props, &mut style);
            let kind = cx.string(props, "kind").unwrap_or_else(|| "rect".into());
            let spec = shape_spec(cx, props, &kind, &mut paint)?;
            // Contorno de forma não ocupa espaço (é a linha da forma, não a borda CSS).
            style.border = Rect::zero();
            mk(NodeKind::Shape(spec), style, paint, Vec::new(), label)
        }
        Kind::Image => {
            let paint = paint_of(cx, props, &mut style);
            let src = cx.string(props, "src").unwrap_or_default();
            let path = if Path::new(&src).is_absolute() { PathBuf::from(&src) } else { cx.base_dir.join(&src) };
            let natural = match imagesize::size(&path) {
                Ok(s) => (s.width as f32 * PX_TO_PT, s.height as f32 * PX_TO_PT),
                Err(e) => {
                    cx.warn(format!("imagem \"{src}\" não pôde ser lida ({e})"));
                    return mk(NodeKind::Container, style, Paint { fill: parse_color("#E5E7EB"), ..paint }, Vec::new(), label);
                }
            };
            let cover = cx.string(props, "objectFit").or_else(|| cx.string(props, "fit")).as_deref() == Some("cover");
            // layout/style.ts toImageStyle: as duas dimensões → nada; uma → proporção; grow → o flex
            // decide; nenhuma → tamanho natural.
            let has_w = cx.get(props, "width").is_some();
            let has_h = cx.get(props, "height").is_some();
            if has_w != has_h && style.aspect_ratio.is_none() {
                style.aspect_ratio = Some(natural.0 / natural.1);
            } else if !has_w && !has_h && style.flex_grow <= 0.0 {
                style.size = Size { width: Dimension::length(natural.0), height: Dimension::length(natural.1) };
            }
            mk(NodeKind::Image(ImageSpec { path, cover, natural }), style, paint, Vec::new(), label)
        }
        Kind::Span | Kind::B | Kind::I | Kind::Sup | Kind::Sub => {
            cx.warn(format!("<{}> fora de <Text> foi ignorado", el.kind.name()));
            None
        }
        Kind::Table => {
            // Na Table, `border` é a cor das linhas da grade (prop da engine), não a borda CSS.
            let mut box_props = props.as_ref().clone();
            box_props.shift_remove("border");
            let paint = paint_of(cx, &box_props, &mut style);
            let t = inherit_from(cx, props, inherit);
            let spec = table_spec(cx, props, &t);
            let _ = &box_props;
            mk(NodeKind::Table(spec), style, paint, Vec::new(), label)
        }
        Kind::Chart if chart_spec(cx, props, inherit).is_some() => {
            let paint = paint_of(cx, props, &mut style);
            let spec = chart_spec(cx, props, inherit)?;
            mk(NodeKind::Chart(spec), style, paint, Vec::new(), label)
        }
        Kind::Path => {
            // fill/stroke do Path são da geometria, não o fundo/borda de caixa (aliases antigos de Box).
            let mut box_props = props.as_ref().clone();
            for k in ["fill", "stroke", "strokeWidth"] {
                box_props.shift_remove(k);
            }
            let paint = paint_of(cx, &box_props, &mut style);
            let d = cx.string(props, "d").unwrap_or_default();
            let cmds = match crate::vector::parse_path(&d) {
                Ok(c) => c,
                Err(e) => {
                    cx.warn(format!("<Path> d inválido: {e}"));
                    Vec::new()
                }
            };
            let view_box = match cx.get(props, "viewBox") {
                Some(Value::Array(v)) if v.borrow().len() == 2 => crate::vector::Bounds { x: 0.0, y: 0.0, w: v.borrow()[0].to_num(), h: v.borrow()[1].to_num() },
                _ => crate::vector::bounds_of(&cmds),
            };
            // pathPaintOf: sem fill nem stroke, fill preto (como o SVG).
            let mut fill = cx.color(props, "fill");
            let stroke = cx.color(props, "stroke");
            if fill.is_none() && stroke.is_none() {
                fill = Some(BLACK);
            }
            let cap = match cx.string(props, "lineCap").as_deref() {
                Some("round") => Some("rnd"),
                _ => None,
            };
            let join = cx.string(props, "lineJoin").and_then(|j| match j.as_str() {
                "round" => Some("round"),
                "bevel" => Some("bevel"),
                _ => None,
            });
            let dash = match cx.string(props, "lineStyle").as_deref() {
                Some("dashed") => Dash::Dashed,
                Some("dotted") => Dash::Dotted,
                _ => Dash::Solid,
            };
            vector_size(cx, props, &mut style, (view_box.w as f32, view_box.h as f32));
            let path = crate::vector::VectorPath { cmds, fill, stroke, stroke_width: f64::from(cx.num(props, "strokeWidth").unwrap_or(1.0)), cap, join };
            mk(NodeKind::Path(PathSpec { path, view_box, dash }), style, paint, Vec::new(), label)
        }
        Kind::Icon => {
            let paint = paint_of(cx, props, &mut style);
            let src = cx.string(props, "src").unwrap_or_default();
            let path = if Path::new(&src).is_absolute() { PathBuf::from(&src) } else { cx.base_dir.join(&src) };
            let svg = match std::fs::read_to_string(&path) {
                Ok(s) => s,
                Err(e) => {
                    cx.warn(format!("<Icon>: não consegui ler \"{src}\" ({e})"));
                    return None;
                }
            };
            let color = cx.color(props, "color").unwrap_or(inherit.color);
            let recolor = cx.bool(props, "recolor").unwrap_or(true);
            let render = cx.string(props, "render");
            let icon = crate::vector::read_icon(&svg, color, recolor, render.as_deref() == Some("image"));
            if let (crate::vector::IconContent::Raster { reason, .. }, Some("shape")) = (&icon.content, render.as_deref()) {
                cx.warn(format!("<Icon render=\"shape\">: o SVG não vira forma nativa ({reason}); saiu como imagem"));
            }
            let size = cx.num(props, "size").unwrap_or(24.0);
            let vb = icon.view_box;
            let natural = if vb.h > 0.0 { (size * (vb.w / vb.h) as f32, size) } else { (size, size) };
            vector_size(cx, props, &mut style, natural);
            mk(NodeKind::Icon(IconSpec { icon: std::rc::Rc::new(icon) }), style, paint, Vec::new(), label)
        }
        Kind::Connector => {
            let spec = connector_spec(cx, props, inherit, &label);
            cx.connectors.push(spec);
            None
        }
        Kind::Chart => {
            cx.warn("<Chart> com esse kind ainda não é suportado no MVP Rust (placeholder no lugar)".into());
            let paint = Paint {
                fill: parse_color("#F3F4F6"),
                borders: [Some(Stroke { width: 1.0, color: parse_color("#9CA3AF").unwrap_or(BLACK), dash: Dash::Dashed }); 4],
                radius: 0.0,
                opacity: 1.0,
                ..Paint::default()
            };
            if style.size.height == Dimension::auto() && style.flex_grow == 0.0 {
                style.min_size.height = LengthPercentageAuto::length(40.0);
            }
            let t = Inherit { size: 11.0, color: parse_color("#6B7280").unwrap_or(BLACK), align: Align::Center, ..inherit.clone() };
            let mut placeholder_runs = vec![run_of(&t, format!("{} (não suportado no MVP Rust)", el.kind.name()), None, None)];
            own_metrics(&mut placeholder_runs, 11.0, &t.family);
            let spec = TextSpec {
                runs: placeholder_runs,
                family: t.family.clone(),
                size: 11.0,
                min_size: 8.0,
                line_height: LineHeight::Normal,
                align: Align::Center,
                letter_spacing: 0.0,
                nowrap: false,
                max_lines: Some(2),
                fit: Fit::Truncate,
                sample: None,
            };
            mk(NodeKind::Text(spec), style, paint, Vec::new(), label)
        }
        Kind::Slide | Kind::Deck => {
            cx.warn(format!("<{}> aninhado foi ignorado", el.kind.name()));
            None
        }
        Kind::Fragment => None,
    }
}

/// M19 (resolve.ts resolveContainer): sem medida o Container fica vazio e pendente (a passada
/// de layout mede o espaço que o pai lhe dá). Com medida, a função recebe a content box, os
/// filhos são resolvidos como os de um Box e o tamanho fica no frame medido, sem grow/shrink:
/// o conteúdo escolhido não muda o espaço, então irmãos e paths ficam como na passada que mediu.
pub(super) fn container_children(cx: &mut Cx, el: &Element, inherit: &Inherit, path: &str, grid: bool, style: &mut Style) -> Vec<Node> {
    let Some(run) = cx.containers else { return Vec::new() };
    let key = (cx.slide - 1, path.to_string());
    let Some(measure) = run.borrow().measures.get(&key).copied() else {
        run.borrow_mut().pending.push(key);
        return Vec::new();
    };
    let Some(f) = el.children.first() else { return Vec::new() };
    let cache_key = (key.0, key.1.clone(), (measure.content.0 as f32).to_bits(), (measure.content.1 as f32).to_bits());
    let cached = run.borrow().cache.get(&cache_key).cloned();
    let (values, notes) = match cached {
        Some(hit) => hit,
        None => {
            let values = {
                let mut r = run.borrow_mut();
                crate::js::call_container(&mut r.interp, f, measure.content.0, measure.content.1, cx.ctx)
            };
            let values = match values {
                Ok(v) => v,
                Err(message) => {
                    cx.fatal.get_or_insert(crate::validate::Fatal { message, path: path.to_string(), removed: false });
                    return Vec::new();
                }
            };
            let notes = match crate::validate::validate_content(&values, path, cx.ctx) {
                Ok(notes) => notes,
                Err(f) => {
                    cx.fatal.get_or_insert(f);
                    return Vec::new();
                }
            };
            run.borrow_mut().cache.insert(cache_key, (values.clone(), notes.clone()));
            (values, notes)
        }
    };
    {
        let mut r = run.borrow_mut();
        r.notes.extend(notes.into_iter().map(|n| (cx.slide, n)));
        r.filled.insert(key, values.clone());
    }
    style.size = Size { width: Dimension::length(measure.frame.0 as f32), height: Dimension::length(measure.frame.1 as f32) };
    style.flex_grow = 0.0;
    style.flex_shrink = 0.0;
    style.flex_basis = Dimension::auto();
    resolve_children(cx, &values, inherit, path, grid)
}

pub(super) fn run_of(t: &Inherit, text: String, baseline: Option<i32>, href: Option<String>) -> StyledRun {
    StyledRun {
        text: transform_text(&text, t.transform.as_deref()),
        weight: t.weight,
        italic: t.italic,
        color: t.color,
        underline: t.underline,
        strike: t.strike,
        baseline,
        href,
        size: Some(t.size),
        family: Some(t.family.clone()),
    }
}

/// Corpo e família iguais aos do Text não são "próprios" (só os Span que mudam contam).
pub(super) fn own_metrics(runs: &mut [StyledRun], size: f32, family: &str) {
    for r in runs {
        if r.size.is_some_and(|s| (s - size).abs() < 1e-3) {
            r.size = None;
        }
        if r.family.as_deref().is_some_and(|f| f.eq_ignore_ascii_case(family)) {
            r.family = None;
        }
    }
}

pub(super) fn collect_runs(cx: &mut Cx, children: &[Value], t: &Inherit, href: Option<&str>, out: &mut Vec<StyledRun>) {
    for child in children {
        match child {
            Value::Str(s) => out.push(run_of(t, s.to_string(), None, href.map(String::from))),
            Value::Element(e) if e.kind == Kind::Span => {
                let inner = inherit_from(cx, &e.props, t);
                let baseline = match cx.string(&e.props, "verticalAlign").as_deref() {
                    Some("super") => Some(30000),
                    Some("sub") => Some(-25000),
                    _ => None,
                };
                let own_href = cx.string(&e.props, "href");
                let href = own_href.as_deref().or(href);
                let start = out.len();
                collect_runs(cx, &e.children, &inner, href, out);
                if let Some(b) = baseline {
                    for r in &mut out[start..] {
                        r.baseline = Some(b);
                    }
                }
            }
            Value::Element(e) => {
                cx.warn(format!("<{}> dentro de <Text> foi ignorado (só texto e <Span>/<B>/<I>)", e.kind.name()));
            }
            _ => {}
        }
    }
}

/// Preenche os SlideNumber com a numeração do deck de saída (depois da paginação, fit/slide-number.ts).
pub fn number_slide(node: &mut Node, n: usize, total: usize) {
    if let (Some(format), NodeKind::Text(t)) = (&node.slide_number, &mut node.kind) {
        let text = if format == "n / total" { format!("{n} / {total}") } else { n.to_string() };
        if let Some(run) = t.runs.first_mut() {
            run.text = text;
        }
        t.runs.truncate(1);
    }
    for c in &mut node.children {
        number_slide(c, n, total);
    }
}
