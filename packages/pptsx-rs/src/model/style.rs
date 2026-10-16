//! Estilo de layout e pintura: props → `taffy::Style` (flex, grid, box model), `Paint`, herança de texto, efeitos (sombra, rotação, translação).

use std::path::{Path, PathBuf};
use taffy::geometry::{Line, MinMax};
use taffy::style::{AlignContent, AlignItems, FlexDirection, FlexWrap, GridPlacement, GridTemplateComponent, MaxTrackSizingFunction, MinTrackSizingFunction, TrackSizingFunction};
use crate::css::{Dash, Len, Stroke, parse_border, parse_box, parse_color, parse_len};
use crate::js::Value;
use crate::text::LineHeight;

use super::*;

// ───────────── conversões para o taffy ─────────────

pub(super) fn dim(l: Len) -> Dimension {
    match l {
        Len::Pt(v) => Dimension::length(v),
        Len::Pct(p) => Dimension::percent(p),
        Len::Auto => Dimension::auto(),
    }
}

pub(super) fn lpa(l: Len) -> LengthPercentageAuto {
    match l {
        Len::Pt(v) => LengthPercentageAuto::length(v),
        Len::Pct(p) => LengthPercentageAuto::percent(p),
        Len::Auto => LengthPercentageAuto::auto(),
    }
}

pub(super) fn lp(l: Len) -> LengthPercentage {
    match l {
        Len::Pt(v) => LengthPercentage::length(v),
        Len::Pct(p) => LengthPercentage::percent(p),
        Len::Auto => LengthPercentage::length(0.0),
    }
}

pub(super) fn align_items(s: &str) -> Option<AlignItems> {
    Some(match s {
        "start" | "flex-start" => AlignItems::FLEX_START,
        "center" => AlignItems::CENTER,
        "end" | "flex-end" => AlignItems::FLEX_END,
        "stretch" => AlignItems::STRETCH,
        "baseline" => AlignItems::BASELINE,
        _ => return None,
    })
}

/// justify-content e align-content usam o mesmo tipo no taffy.
pub(super) fn justify(s: &str) -> Option<AlignContent> {
    Some(match s {
        "start" | "flex-start" => AlignContent::FLEX_START,
        "center" => AlignContent::CENTER,
        "end" | "flex-end" => AlignContent::FLEX_END,
        "between" | "space-between" => AlignContent::SPACE_BETWEEN,
        "around" | "space-around" => AlignContent::SPACE_AROUND,
        "evenly" | "space-evenly" => AlignContent::SPACE_EVENLY,
        "stretch" => AlignContent::STRETCH,
        _ => return None,
    })
}

/// Espaçamento: número, shorthand string ou objeto { top, right, bottom, left }.
pub(super) fn spacing(cx: &Cx, props: &Props, key: &str) -> Option<[Len; 4]> {
    match cx.get(props, key)? {
        Value::Num(n) => Some([Len::Pt(n as f32); 4]),
        Value::Str(s) => {
            let b = parse_box(&s);
            if b.is_none() {
                cx.warn(format!("{key}=\"{s}\" inválido"));
            }
            b
        }
        Value::Object(o) => {
            let side = |k: &str| match o.get(k) {
                Some(Value::Num(n)) => Len::Pt(*n as f32),
                Some(Value::Str(s)) => parse_len(s).unwrap_or(Len::Pt(0.0)),
                _ => Len::Pt(0.0),
            };
            Some([side("top"), side("right"), side("bottom"), side("left")])
        }
        _ => None,
    }
}

pub(super) const SIDES: [&str; 4] = ["Top", "Right", "Bottom", "Left"];

// ───────────── grid ─────────────

/// Separa no nível 0 de parênteses: 'repeat(2, 1fr) 100px' → ['repeat(2, 1fr)', '100px'].
pub(super) fn split_top(s: &str, sep: impl Fn(char) -> bool) -> Vec<String> {
    let mut out = Vec::new();
    let mut depth = 0;
    let mut cur = String::new();
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            _ => {}
        }
        if depth == 0 && sep(c) {
            if !cur.trim().is_empty() {
                out.push(cur.trim().to_string());
            }
            cur.clear();
        } else {
            cur.push(c);
        }
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}

pub(super) fn track_min(t: &str) -> Option<MinTrackSizingFunction> {
    Some(match t {
        "auto" => MinTrackSizingFunction::auto(),
        "min-content" => MinTrackSizingFunction::min_content(),
        "max-content" => MinTrackSizingFunction::max_content(),
        _ => match parse_len(t)? {
            Len::Pt(v) => MinTrackSizingFunction::length(v),
            Len::Pct(p) => MinTrackSizingFunction::percent(p),
            Len::Auto => MinTrackSizingFunction::auto(),
        },
    })
}

pub(super) fn track_max(t: &str) -> Option<MaxTrackSizingFunction> {
    if let Some(fr) = t.strip_suffix("fr") {
        return fr.trim().parse().ok().map(MaxTrackSizingFunction::fr);
    }
    Some(match t {
        "auto" => MaxTrackSizingFunction::auto(),
        "min-content" => MaxTrackSizingFunction::min_content(),
        "max-content" => MaxTrackSizingFunction::max_content(),
        _ => match parse_len(t)? {
            Len::Pt(v) => MaxTrackSizingFunction::length(v),
            Len::Pct(p) => MaxTrackSizingFunction::percent(p),
            Len::Auto => MaxTrackSizingFunction::auto(),
        },
    })
}

/// Lista de trilhas CSS: tamanhos, `Nfr`, `minmax(a, b)` e `repeat(n, …)` (expandido, como no grid.ts).
pub(super) fn parse_tracks(s: &str) -> Option<Vec<TrackSizingFunction>> {
    let mut out = Vec::new();
    for token in split_top(s, char::is_whitespace) {
        if let Some(inner) = token.strip_prefix("repeat(").and_then(|t| t.strip_suffix(')')) {
            let args = split_top(inner, |c| c == ',');
            let [count, tracks] = args.as_slice() else { return None };
            let n: usize = count.trim().parse().ok()?;
            let tracks = parse_tracks(tracks)?;
            for _ in 0..n {
                out.extend(tracks.iter().cloned());
            }
        } else if let Some(inner) = token.strip_prefix("minmax(").and_then(|t| t.strip_suffix(')')) {
            let args = split_top(inner, |c| c == ',');
            let [min, max] = args.as_slice() else { return None };
            out.push(MinMax { min: track_min(min.trim())?, max: track_max(max.trim())? });
        } else if token.ends_with("fr") {
            // `1fr` = minmax(auto, 1fr) (CSS Grid §7.2.4).
            out.push(MinMax { min: MinTrackSizingFunction::auto(), max: track_max(&token)? });
        } else {
            out.push(MinMax { min: track_min(&token)?, max: track_max(&token)? });
        }
    }
    Some(out)
}

pub(super) fn grid_line(v: &str) -> Option<GridPlacement> {
    let t = v.trim();
    if t == "auto" {
        return Some(GridPlacement::Auto);
    }
    if let Some(n) = t.strip_prefix("span") {
        return n.trim().parse().ok().map(GridPlacement::Span);
    }
    t.parse::<i16>().ok().map(|n| GridPlacement::Line(n.into()))
}

pub(super) fn grid_placement(cx: &Cx, props: &Props, key: &str) -> Option<Line<GridPlacement>> {
    let mut line = Line { start: GridPlacement::Auto, end: GridPlacement::Auto };
    let mut any = false;
    if let Some(v) = cx.string(props, key) {
        let parts: Vec<&str> = v.split('/').collect();
        line.start = grid_line(parts[0])?;
        if let Some(end) = parts.get(1) {
            line.end = grid_line(end)?;
        }
        any = true;
    }
    for (suffix, slot) in [("Start", &mut line.start), ("End", &mut line.end)] {
        if let Some(v) = cx.string(props, &format!("{key}{suffix}")) {
            *slot = grid_line(&v)?;
            any = true;
        }
    }
    any.then_some(line)
}

pub(super) fn grid_style(cx: &Cx, props: &Props, style: &mut Style) {
    style.display = Display::Grid;
    for (key, slot) in [("gridTemplateColumns", &mut style.grid_template_columns), ("gridTemplateRows", &mut style.grid_template_rows)] {
        if let Some(v) = cx.string(props, key) {
            match parse_tracks(&v) {
                Some(tracks) => *slot = tracks.into_iter().map(GridTemplateComponent::Single).collect(),
                None => cx.warn(format!("{key}=\"{v}\" não suportado")),
            }
        }
    }
    for (key, slot) in [("gridAutoRows", &mut style.grid_auto_rows), ("gridAutoColumns", &mut style.grid_auto_columns)] {
        if let Some(v) = cx.string(props, key) {
            match parse_tracks(&v) {
                Some(tracks) => *slot = tracks,
                None => cx.warn(format!("{key}=\"{v}\" não suportado")),
            }
        }
    }
    if let Some(p) = cx.string(props, "placeItems") {
        let mut parts = p.split_whitespace();
        let align = parts.next().and_then(align_items);
        let justify = parts.next().and_then(align_items).or(align);
        if let Some(a) = align {
            style.align_items = a;
        }
        if let Some(j) = justify {
            style.justify_items = j;
        }
    }
    if let Some(j) = cx.string(props, "justifyItems").and_then(|j| align_items(&j)) {
        style.justify_items = j;
    }
}

/// BasisSource do pptsx: `flex` numérico (ou sem basis escrita) = implícita; basis escrita = do autor.
pub(super) fn basis_of(cx: &Cx, props: &Props) -> Basis {
    let mut basis = Basis::None;
    if let Some(flex) = cx.get(props, "flex") {
        basis = match flex {
            Value::Num(_) => Basis::Flex(Dimension::length(0.0)),
            Value::Str(s) => {
                let t = s.trim();
                if t == "auto" || t == "none" {
                    Basis::Author(Dimension::auto())
                } else {
                    match s.split_whitespace().find(|x| x.parse::<f64>().is_err()) {
                        Some("auto") => Basis::Author(Dimension::auto()),
                        Some(b) => parse_len(b).map_or(Basis::None, |l| Basis::Author(dim(l))),
                        None => Basis::Flex(Dimension::length(0.0)),
                    }
                }
            }
            _ => Basis::None,
        };
    }
    if let Some(b) = cx.get(props, "flexBasis") {
        basis = match b {
            Value::Str(s) if s.trim() == "auto" => Basis::Author(Dimension::auto()),
            _ => cx.len(props, "flexBasis").map_or(basis, |l| Basis::Author(dim(l))),
        };
    }
    basis
}

pub(super) fn item_style(cx: &Cx, props: &Props, style: &mut Style) -> bool {
    // O pptsx usa Yoga: sem o min-size automático do CSS (itens podem ser espremidos e o fit vê).
    style.min_size = Size { width: LengthPercentageAuto::length(0.0), height: LengthPercentageAuto::length(0.0) };
    // Yoga (pptsx): todo nó é posicionado; o absoluto mede sempre pelo pai direto.
    let absolute = cx.string(props, "position").as_deref() == Some("absolute");
    style.position = if absolute { Position::Absolute } else { Position::Relative };
    let mut inset = Rect { top: LengthPercentageAuto::auto(), right: LengthPercentageAuto::auto(), bottom: LengthPercentageAuto::auto(), left: LengthPercentageAuto::auto() };
    if let Some(all) = spacing(cx, props, "inset") {
        inset = Rect { top: lpa(all[0]), right: lpa(all[1]), bottom: lpa(all[2]), left: lpa(all[3]) };
    }
    for (side, slot) in ["top", "right", "bottom", "left"].iter().zip([&mut inset.top, &mut inset.right, &mut inset.bottom, &mut inset.left]) {
        if let Some(l) = cx.len(props, side) {
            *slot = lpa(l);
        }
    }
    style.inset = inset;
    if let Some(l) = cx.len(props, "width") {
        style.size.width = dim(l);
    }
    if let Some(l) = cx.len(props, "height") {
        style.size.height = dim(l);
    }
    if let Some(l) = cx.len(props, "minWidth") {
        style.min_size.width = lpa(l);
    }
    if let Some(l) = cx.len(props, "minHeight") {
        style.min_size.height = lpa(l);
    }
    if let Some(l) = cx.len(props, "maxWidth") {
        style.max_size.width = lpa(l);
    }
    if let Some(l) = cx.len(props, "maxHeight") {
        style.max_size.height = lpa(l);
    }
    if let Some(r) = cx.get(props, "aspectRatio") {
        style.aspect_ratio = match r {
            Value::Num(n) => Some(n as f32),
            Value::Str(s) => match s.split_once('/') {
                Some((a, b)) => a.trim().parse::<f32>().ok().zip(b.trim().parse::<f32>().ok()).map(|(a, b)| a / b),
                None => s.trim().parse().ok(),
            },
            _ => None,
        };
    }
    // flex: n = grow n, shrink 1, basis 0 (DEFAULTS.item: grow > 0 implica basis 0).
    if let Some(flex) = cx.get(props, "flex") {
        match flex {
            Value::Num(n) => set_flex(style, n as f32, 1.0, None),
            Value::Str(s) => {
                let parts: Vec<&str> = s.split_whitespace().collect();
                match parts.as_slice() {
                    ["none"] => set_flex(style, 0.0, 0.0, Some(Dimension::auto())),
                    ["auto"] => set_flex(style, 1.0, 1.0, Some(Dimension::auto())),
                    [g] => set_flex(style, g.parse().unwrap_or(0.0), 1.0, None),
                    [g, s] => set_flex(style, g.parse().unwrap_or(0.0), s.parse().unwrap_or(1.0), None),
                    [g, s, b, ..] => set_flex(style, g.parse().unwrap_or(0.0), s.parse().unwrap_or(1.0), parse_len(b).map(dim)),
                    [] => {}
                }
            }
            _ => {}
        }
    }
    if let Some(g) = cx.num(props, "flexGrow").or_else(|| cx.num(props, "grow")) {
        style.flex_grow = g;
        if g > 0.0 && cx.get(props, "flexBasis").is_none() {
            style.flex_basis = Dimension::length(0.0);
        }
    }
    if let Some(s) = cx.num(props, "flexShrink").or_else(|| cx.num(props, "shrink")) {
        style.flex_shrink = s;
    }
    if let Some(b) = cx.len(props, "flexBasis") {
        style.flex_basis = dim(b);
    }
    if let Some(a) = cx.string(props, "alignSelf") {
        style.align_self = if a == "auto" { None } else { align_items(&a) };
    }
    if let Some(j) = cx.string(props, "justifySelf") {
        style.justify_self = if j == "auto" { None } else { align_items(&j) };
    }
    if let Some(p) = cx.string(props, "placeSelf") {
        let mut parts = p.split_whitespace();
        let align = parts.next().and_then(align_items);
        style.align_self = align;
        style.justify_self = parts.next().and_then(align_items).or(align);
    }
    if let Some(l) = grid_placement(cx, props, "gridColumn") {
        style.grid_column = l;
    }
    if let Some(l) = grid_placement(cx, props, "gridRow") {
        style.grid_row = l;
    }
    if let Some(m) = spacing(cx, props, "margin") {
        style.margin = Rect { top: lpa(m[0]), right: lpa(m[1]), bottom: lpa(m[2]), left: lpa(m[3]) };
    }
    for (i, side) in SIDES.iter().enumerate() {
        if let Some(l) = cx.len(props, &format!("margin{side}")) {
            let slot = [&mut style.margin.top, &mut style.margin.right, &mut style.margin.bottom, &mut style.margin.left];
            *slot.into_iter().nth(i).unwrap() = lpa(l);
        }
    }
    absolute
}

pub(super) fn set_flex(style: &mut Style, grow: f32, shrink: f32, basis: Option<Dimension>) {
    style.flex_grow = grow;
    style.flex_shrink = shrink;
    style.flex_basis = basis.unwrap_or(if grow > 0.0 { Dimension::length(0.0) } else { Dimension::auto() });
}

pub(super) fn container_style(cx: &Cx, props: &Props, style: &mut Style, is_slide: bool) {
    style.display = Display::Flex;
    // Box/Slide sem `display` = flex column; `display="flex"` explícito = row (DEFAULTS.css).
    let display = cx.string(props, "display");
    let mut direction = if display.as_deref() == Some("flex") && !is_slide { FlexDirection::Row } else { FlexDirection::Column };
    if let Some(d) = cx.string(props, "flexDirection").or_else(|| cx.string(props, "direction")) {
        direction = match d.as_str() {
            "row" => FlexDirection::Row,
            "row-reverse" => FlexDirection::RowReverse,
            "column-reverse" => FlexDirection::ColumnReverse,
            _ => FlexDirection::Column,
        };
    }
    style.flex_direction = direction;
    if display.as_deref() == Some("grid") {
        grid_style(cx, props, style);
    }
    if let Some(w) = cx.string(props, "flexWrap") {
        style.flex_wrap = if w.starts_with("wrap") { FlexWrap::Wrap } else { FlexWrap::NoWrap };
    }
    if let Some(j) = cx.string(props, "justifyContent").or_else(|| cx.string(props, "justify")).and_then(|j| justify(&j)) {
        style.justify_content = j;
    }
    if let Some(a) = cx.string(props, "alignItems").or_else(|| cx.string(props, "align")).and_then(|a| align_items(&a)) {
        style.align_items = a;
    }
    if let Some(a) = cx.string(props, "alignContent").and_then(|a| justify(&a)) {
        style.align_content = a;
    }
    if let Some(g) = cx.get(props, "gap") {
        let (row, col) = match g {
            Value::Num(n) => (Len::Pt(n as f32), Len::Pt(n as f32)),
            Value::Str(s) => {
                let parts: Vec<Len> = s.split_whitespace().filter_map(parse_len).collect();
                match parts.as_slice() {
                    [a] => (*a, *a),
                    [a, b, ..] => (*a, *b),
                    [] => (Len::Pt(0.0), Len::Pt(0.0)),
                }
            }
            _ => (Len::Pt(0.0), Len::Pt(0.0)),
        };
        style.gap = Size { width: lp(col), height: lp(row) };
    }
    if let Some(l) = cx.len(props, "rowGap") {
        style.gap.height = lp(l);
    }
    if let Some(l) = cx.len(props, "columnGap") {
        style.gap.width = lp(l);
    }
}

pub(super) fn padding_style(cx: &Cx, props: &Props, style: &mut Style) {
    if let Some(p) = spacing(cx, props, "padding") {
        style.padding = Rect { top: lp(p[0]), right: lp(p[1]), bottom: lp(p[2]), left: lp(p[3]) };
    }
    for (i, side) in SIDES.iter().enumerate() {
        if let Some(l) = cx.len(props, &format!("padding{side}")) {
            let slot = [&mut style.padding.top, &mut style.padding.right, &mut style.padding.bottom, &mut style.padding.left];
            *slot.into_iter().nth(i).unwrap() = lp(l);
        }
    }
}

/// Fundo, bordas (ocupam espaço, como no CSS border-box), raio e opacidade.
pub(super) fn paint_of(cx: &Cx, props: &Props, style: &mut Style) -> Paint {
    let mut paint = Paint { opacity: cx.num(props, "opacity").unwrap_or(1.0).clamp(0.0, 1.0), ..Paint::default() };
    paint.fill = cx.color(props, "backgroundColor").or_else(|| cx.string(props, "background").and_then(|bg| parse_color(&bg)));
    paint.background_image = background_image(cx, props);
    if let Some(v) = cx.string(props, "boxShadow") {
        paint.shadow = parse_shadow(&v);
        if v.contains("inset") {
            cx.warn("boxShadow inset não tem equivalente no PPTX (sai como sombra externa)".into());
        }
    }
    let (rotate, translate) = transform_of(cx, props);
    paint.rotate = rotate;
    paint.translate = translate;
    let mut borders: [Option<Stroke>; 4] = [None; 4];
    match cx.get(props, "border") {
        Some(Value::Num(n)) if n > 0.0 => borders = [Some(Stroke { width: n as f32, color: BLACK, dash: Dash::Solid }); 4],
        Some(Value::Str(s)) => borders = [parse_border(&s); 4],
        _ => {}
    }
    for (i, side) in SIDES.iter().enumerate() {
        if let Some(v) = cx.get(props, &format!("border{side}")) {
            borders[i] = match v {
                Value::Num(n) if n > 0.0 => Some(Stroke { width: n as f32, color: BLACK, dash: Dash::Solid }),
                Value::Str(s) => parse_border(&s),
                _ => None,
            };
        }
    }
    // Longhands: borderColor/borderWidth/borderStyle valem para os lados já definidos (ou criam).
    let width = cx.num(props, "borderWidth");
    let color = cx.color(props, "borderColor");
    let dash = cx.string(props, "borderStyle");
    if width.is_some() || color.is_some() || dash.is_some() {
        for b in &mut borders {
            let mut s = b.unwrap_or(Stroke { width: 3.0, color: BLACK, dash: Dash::Solid });
            if let Some(w) = width {
                s.width = w;
            }
            if let Some(c) = color {
                s.color = c;
            }
            match dash.as_deref() {
                Some("dashed") => s.dash = Dash::Dashed,
                Some("dotted") => s.dash = Dash::Dotted,
                Some("none") => {
                    *b = None;
                    continue;
                }
                _ => {}
            }
            *b = if b.is_some() || dash.is_some() { Some(s) } else { None };
        }
    }
    // Aliases antigos de Box (fill/stroke/strokeWidth/radius).
    if paint.fill.is_none() {
        paint.fill = cx.color(props, "fill");
    }
    if let Some(stroke) = cx.color(props, "stroke") {
        let w = cx.num(props, "strokeWidth").unwrap_or(1.0);
        borders = [Some(Stroke { width: w, color: stroke, dash: Dash::Solid }); 4];
    }
    paint.borders = borders;
    let side_width = |b: &Option<Stroke>| b.map_or(0.0, |s| s.width);
    style.border = Rect {
        top: LengthPercentage::length(side_width(&borders[0])),
        right: LengthPercentage::length(side_width(&borders[1])),
        bottom: LengthPercentage::length(side_width(&borders[2])),
        left: LengthPercentage::length(side_width(&borders[3])),
    };
    paint.radius = cx.num(props, "borderRadius").or_else(|| cx.num(props, "radius")).unwrap_or(0.0);
    paint
}

/// `backgroundImage: "url(./x.png)"` (ou `background: "url(…)"`) → arquivo e tamanho natural.
pub(super) fn background_image(cx: &Cx, props: &Props) -> Option<(PathBuf, (f32, f32))> {
    let raw = cx.string(props, "backgroundImage").or_else(|| cx.string(props, "background").filter(|b| b.trim_start().starts_with("url(")))?;
    let src = raw.trim().strip_prefix("url(").and_then(|r| r.strip_suffix(')')).unwrap_or(&raw).trim().trim_matches(|c| c == '"' || c == '\'').to_string();
    let path = if Path::new(&src).is_absolute() { PathBuf::from(&src) } else { cx.base_dir.join(&src) };
    match imagesize::size(&path) {
        Ok(s) => Some((path, (s.width as f32 * PX_TO_PT, s.height as f32 * PX_TO_PT))),
        Err(e) => {
            cx.warn(format!("imagem de fundo \"{src}\" não pôde ser lida ({e})"));
            None
        }
    }
}

pub(super) fn inherit_from(cx: &Cx, props: &Props, parent: &Inherit) -> Inherit {
    let mut t = parent.clone();
    if let Some(f) = cx.string(props, "fontFamily").or_else(|| cx.string(props, "font")) {
        t.family = f.split(',').next().unwrap_or("Arial").trim().trim_matches(|c| c == '"' || c == '\'').to_string();
    }
    if let Some(s) = cx.num(props, "fontSize").or_else(|| cx.num(props, "size")) {
        t.size = s;
    }
    if let Some(w) = cx.get(props, "fontWeight").or_else(|| cx.get(props, "weight")) {
        t.weight = match w {
            Value::Num(n) => n.clamp(1.0, 1000.0) as u16,
            Value::Str(s) => match &*s {
                "bold" | "bolder" => 700,
                "normal" | "regular" => 400,
                "lighter" => 300,
                other => other.parse::<f64>().map_or(t.weight, |n| n.clamp(1.0, 1000.0) as u16),
            },
            _ => t.weight,
        };
    }
    if let Some(s) = cx.string(props, "fontStyle") {
        t.italic = s == "italic";
    }
    if let Some(i) = cx.bool(props, "italic") {
        t.italic = i;
    }
    if let Some(c) = cx.color(props, "color") {
        t.color = c;
        t.color_set = true;
    }
    match cx.get(props, "lineHeight") {
        Some(Value::Num(n)) => t.line_height = LineHeight::Multiple(n as f32),
        Some(Value::Str(s)) if &*s == "normal" => t.line_height = LineHeight::Normal,
        _ => {}
    }
    if let Some(a) = cx.string(props, "textAlign").or_else(|| cx.string(props, "align").filter(|a| matches!(a.as_str(), "left" | "center" | "right"))) {
        t.align = match a.as_str() {
            "center" => Align::Center,
            "right" | "end" => Align::Right,
            _ => Align::Left,
        };
    }
    if let Some(l) = cx.num(props, "letterSpacing") {
        t.letter_spacing = l;
    }
    if let Some(tr) = cx.string(props, "textTransform") {
        t.transform = (tr != "none").then_some(tr);
    }
    if let Some(d) = cx.string(props, "textDecoration") {
        t.underline = d.contains("underline");
        t.strike = d.contains("line-through");
    }
    t
}

pub(super) fn transform_text(s: &str, transform: Option<&str>) -> String {
    match transform {
        Some("uppercase") => s.to_uppercase(),
        Some("lowercase") => s.to_lowercase(),
        Some("capitalize") => {
            let mut out = String::with_capacity(s.len());
            let mut start = true;
            for c in s.chars() {
                if start && c.is_alphabetic() {
                    out.extend(c.to_uppercase());
                    start = false;
                } else {
                    out.push(c);
                }
                if c.is_whitespace() {
                    start = true;
                }
            }
            out
        }
        _ => s.to_string(),
    }
}


// ───────────── efeitos ─────────────

/// `x y [blur [spread]] color` (resolve/values.ts parseShadow): só a primeira sombra da lista.
pub(super) fn parse_shadow(v: &str) -> Option<Shadow> {
    if v.trim() == "none" {
        return None;
    }
    let mut depth = 0;
    let first: String = v.chars().take_while(|c| {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => return false,
            _ => {}
        }
        true
    }).collect();
    let mut tokens = Vec::new();
    let mut cur = String::new();
    let mut depth = 0;
    for c in first.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            _ => {}
        }
        if c.is_whitespace() && depth == 0 {
            if !cur.is_empty() {
                tokens.push(std::mem::take(&mut cur));
            }
        } else {
            cur.push(c);
        }
    }
    if !cur.is_empty() {
        tokens.push(cur);
    }
    let lengths: Vec<f32> = tokens.iter().filter_map(|t| match parse_len(t) {
        Some(Len::Pt(v)) => Some(v),
        _ => None,
    }).collect();
    let color = tokens.iter().find_map(|t| parse_color(t)).unwrap_or(BLACK);
    let (&x, &y) = (lengths.first()?, lengths.get(1)?);
    Some(Shadow { x, y, blur: lengths.get(2).copied().unwrap_or(0.0), color })
}

pub(super) fn angle_of(s: &str) -> Option<f32> {
    let t = s.trim();
    if let Some(v) = t.strip_suffix("deg") {
        return v.trim().parse().ok();
    }
    if let Some(v) = t.strip_suffix("turn") {
        return v.trim().parse::<f32>().ok().map(|v| v * 360.0);
    }
    if let Some(v) = t.strip_suffix("rad") {
        return v.trim().parse::<f32>().ok().map(f32::to_degrees);
    }
    t.parse().ok()
}

/// `rotate` (graus) e `transform: rotate(…) translate(…)`; o resto do transform é ignorado.
pub(super) fn transform_of(cx: &Cx, props: &Props) -> (f32, (f32, f32)) {
    let mut rotate = match cx.get(props, "rotate") {
        Some(Value::Num(n)) => n as f32,
        Some(Value::Str(s)) => angle_of(&s).unwrap_or(0.0),
        _ => 0.0,
    };
    let mut translate = (0.0, 0.0);
    if let Some(t) = cx.string(props, "transform") {
        let mut rest = t.as_str();
        while let Some(open) = rest.find('(') {
            let name = rest[..open].trim().rsplit(char::is_whitespace).next().unwrap_or("").to_string();
            let Some(close) = rest[open..].find(')') else { break };
            let args: Vec<&str> = rest[open + 1..open + close].split([',', ' ']).filter(|a| !a.is_empty()).collect();
            let len = |a: Option<&&str>| a.and_then(|a| match parse_len(a) {
                Some(Len::Pt(v)) => Some(v),
                _ => None,
            }).unwrap_or(0.0);
            match name.as_str() {
                "rotate" => rotate += args.first().and_then(|a| angle_of(a)).unwrap_or(0.0),
                "translate" => translate = (translate.0 + len(args.first()), translate.1 + len(args.get(1))),
                "translateX" => translate.0 += len(args.first()),
                "translateY" => translate.1 += len(args.first()),
                other => cx.warn(format!("transform {other}() não tem equivalente no PPTX (ignorado)")),
            }
            rest = &rest[open + close + 1..];
        }
    }
    (rotate, translate)
}
