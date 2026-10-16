//! Formas: presets do OOXML, pontas de seta e o tamanho natural dos nós vetoriais.

use crate::css::{Dash, Stroke};

use super::*;

// ───────────── formas ─────────────

pub(super) fn shape_preset(kind: &str) -> Option<(&'static str, &'static [(&'static str, i64)])> {
    Some(match kind {
        "rect" => ("rect", &[]),
        "roundRect" => ("roundRect", &[("adj", 16667)]),
        "ellipse" => ("ellipse", &[]),
        "line" => ("line", &[]),
        "triangle" => ("triangle", &[("adj", 50000)]),
        "rightTriangle" => ("rtTriangle", &[]),
        "diamond" => ("diamond", &[]),
        "parallelogram" => ("parallelogram", &[("adj", 25000)]),
        "trapezoid" => ("trapezoid", &[("adj", 25000)]),
        "pentagon" => ("pentagon", &[("hf", 105146), ("vf", 110557)]),
        "hexagon" => ("hexagon", &[("adj", 25000), ("vf", 115470)]),
        "octagon" => ("octagon", &[("adj", 29289)]),
        "chevron" => ("chevron", &[("adj", 50000)]),
        "arrowRight" => ("rightArrow", &[("adj1", 50000), ("adj2", 50000)]),
        "arrowLeft" => ("leftArrow", &[("adj1", 50000), ("adj2", 50000)]),
        "arrowUp" => ("upArrow", &[("adj1", 50000), ("adj2", 50000)]),
        "arrowDown" => ("downArrow", &[("adj1", 50000), ("adj2", 50000)]),
        "doubleArrow" => ("leftRightArrow", &[("adj1", 50000), ("adj2", 50000)]),
        "pill" => ("roundRect", &[("adj", 50000)]),
        "star" => ("star5", &[("adj", 19098), ("hf", 105146), ("vf", 110557)]),
        "cloud" => ("cloud", &[]),
        "callout" => ("wedgeRectCallout", &[("adj1", -20833), ("adj2", 62500)]),
        "bracketPair" => ("bracketPair", &[("adj", 16667)]),
        "cylinder" => ("can", &[("adj", 25000)]),
        _ => return None,
    })
}

pub(super) fn arrow(cx: &Cx, props: &Props, key: &str) -> Option<String> {
    let a = cx.string(props, key)?;
    let t = match a.as_str() {
        "arrow" => "arrow",
        "triangle" => "triangle",
        "stealth" => "stealth",
        "diamond" => "diamond",
        "oval" => "oval",
        _ => return None,
    };
    Some(t.to_string())
}

/// layout/tree.ts vectorSizeStyle: sem tamanho nem flex, o natural; com um eixo, a proporção.
pub(super) fn vector_size(cx: &Cx, props: &Props, style: &mut Style, natural: (f32, f32)) {
    let spans = |a: &str, b: &str| style.position == Position::Absolute && (cx.get(props, "inset").is_some() || (cx.get(props, a).is_some() && cx.get(props, b).is_some()));
    let has_w = cx.get(props, "width").is_some() || spans("left", "right");
    let has_h = cx.get(props, "height").is_some() || spans("top", "bottom");
    if !has_w && !has_h && style.flex_grow == 0.0 {
        style.size = Size { width: Dimension::length(natural.0), height: Dimension::length(natural.1) };
        return;
    }
    if has_w != has_h && style.aspect_ratio.is_none() && natural.0 > 0.0 && natural.1 > 0.0 {
        style.aspect_ratio = Some(natural.0 / natural.1);
    }
}

pub(super) fn shape_spec(cx: &Cx, props: &Props, kind: &str, paint: &mut Paint) -> Option<ShapeSpec> {
    let Some((prst, adj)) = shape_preset(kind) else {
        cx.warn(format!("Shape kind=\"{kind}\" não existe"));
        return None;
    };
    let line = matches!(kind, "line" | "bracketPair");
    // Forma usa stroke/strokeWidth (prop da engine); `line` sem stroke ganha preto.
    let stroke_color = cx.color(props, "stroke").or(if line { Some(BLACK) } else { None });
    let dash = match cx.string(props, "lineStyle").as_deref() {
        Some("dashed") => Dash::Dashed,
        Some("dotted") => Dash::Dotted,
        _ => Dash::Solid,
    };
    if let Some(color) = stroke_color {
        let width = cx.num(props, "strokeWidth").unwrap_or(1.0);
        paint.borders = [Some(Stroke { width, color, dash }); 4];
    }
    if line {
        paint.fill = None;
    }
    let radius = match kind {
        "roundRect" => cx.num(props, "radius").or_else(|| cx.num(props, "borderRadius")),
        _ => None,
    };
    Some(ShapeSpec {
        prst,
        adj: adj.to_vec(),
        radius,
        pill: kind == "pill",
        line,
        flip_h: cx.bool(props, "flipH").unwrap_or(false),
        flip_v: cx.bool(props, "flipV").unwrap_or(false),
        head: arrow(cx, props, "startArrow"),
        tail: arrow(cx, props, "endArrow"),
    })
}
