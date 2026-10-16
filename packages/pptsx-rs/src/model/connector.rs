//! Conector: props → `ConnectorSpec` (lados, cotovelo, setas, rótulo).

use crate::css::{Dash, Stroke, parse_color};
use crate::js::Value;
use crate::text::LineHeight;

use super::*;

// ───────────── conector ─────────────

pub(super) fn connector_spec(cx: &mut Cx, props: &Props, inherit: &Inherit, path: &str) -> ConnectorSpec {
    let side = |k: &str| cx.string(props, k).filter(|s| s != "auto");
    let dash = match cx.string(props, "lineStyle").as_deref() {
        Some("dashed") => Dash::Dashed,
        Some("dotted") => Dash::Dotted,
        _ => Dash::Solid,
    };
    let stroke = Stroke {
        width: cx.num(props, "strokeWidth").unwrap_or(1.5),
        color: cx.color(props, "stroke").unwrap_or_else(|| parse_color("#333333").unwrap_or(BLACK)),
        dash,
    };
    let arrow_of = |k: &str, default: &str| {
        let v = cx.string(props, k).unwrap_or_else(|| default.to_string());
        (v != "none").then_some(v)
    };
    let (start_arrow, end_arrow) = (arrow_of("startArrow", "none"), arrow_of("endArrow", "triangle"));
    let (from_side, to_side) = (side("fromSide"), side("toSide"));
    let elbow = cx.string(props, "route").as_deref() == Some("elbow");
    let (from, to) = (cx.string(props, "from").unwrap_or_default(), cx.string(props, "to").unwrap_or_default());
    // Rótulo = Text de uma linha, centrado, com a tipografia de labelStyle (fonte herdada).
    let style = match cx.get(props, "labelStyle") {
        Some(Value::Object(o)) => Some((*o).clone()),
        _ => None,
    };
    let style = style.unwrap_or_default();
    let label = cx.get(props, "label").map(|label| {
        let t = Inherit {
            family: cx.string(&style, "font").unwrap_or_else(|| inherit.family.clone()),
            size: cx.num(&style, "fontSize").unwrap_or(12.0),
            color: cx.color(&style, "color").unwrap_or_else(|| parse_color("#333333").unwrap_or(BLACK)),
            align: Align::Center,
            ..inherit.clone()
        };
        let mut runs = Vec::new();
        let children = match &label {
            Value::Array(items) => items.borrow().to_vec(),
            other => vec![other.clone()],
        };
        let children: Vec<Value> = children.into_iter().map(|v| if let Value::Num(n) = v { Value::Str(std::rc::Rc::from(crate::js::value::num_to_string(n))) } else { v }).collect();
        collect_runs(cx, &children, &t, None, &mut runs);
        own_metrics(&mut runs, t.size, &t.family);
        TextSpec { runs, family: t.family.clone(), size: t.size, min_size: t.size, line_height: LineHeight::Normal, align: Align::Center, letter_spacing: 0.0, nowrap: true, max_lines: None, fit: Fit::Error, sample: None }
    });
    ConnectorSpec {
        path: path.to_string(),
        from,
        to,
        from_side,
        to_side,
        elbow,
        start_arrow,
        end_arrow,
        stroke,
        label,
        label_background: cx.color(&style, "background"),
    }
}
