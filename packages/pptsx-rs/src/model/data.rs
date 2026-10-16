//! Tabela e gráfico: props → `TableSpec` e `ChartSpec` (objects.rs).

use std::path::{Path, PathBuf};
use crate::css::{Rgba, parse_color};
use crate::js::{Kind, Value};

use super::*;

// ───────────── tabela e gráfico ─────────────

/// Estilo de partida de uma célula (cabeçalho, listra, coluna).
#[derive(Clone)]
pub(super) struct CellBase {
    text: Inherit,
    fill: Option<Rgba>,
    align: Align,
    valign: f32,
}

pub(super) fn valign_of(v: &str) -> f32 {
    match v {
        "middle" | "center" => 0.5,
        "bottom" => 1.0,
        _ => 0.0,
    }
}

/// Célula: string, número ou objeto `{ text | children, fill, color, fontWeight, fontStyle,
/// align, valign, colSpan, rowSpan, icon }` (children = rich text, como num Text).
pub(super) fn cell_of(cx: &mut Cx, v: &Value, base: &CellBase) -> crate::objects::Cell {
    use crate::objects::{Cell, CellIcon, CellRun};
    let mut cell = Cell { runs: Vec::new(), fill: base.fill, align: base.align, valign: base.valign, span: 1, row_span: 1, icon: None };
    let mut t = base.text.clone();
    let mut children: Vec<Value> = Vec::new();
    match v {
        Value::Str(_) => children.push(v.clone()),
        Value::Num(n) => children.push(crate::js::value::str_val(&crate::js::value::num_to_string(*n))),
        Value::Element(e) => children.extend(e.children.iter().cloned()),
        Value::Object(o) => {
            t = inherit_from(cx, o, &t);
            if let Some(c) = cx.color(o, "fill") {
                cell.fill = Some(c);
            }
            if let Some(a) = cx.string(o, "align") {
                cell.align = align_of(&a);
            }
            if let Some(a) = cx.string(o, "valign") {
                cell.valign = valign_of(&a);
            }
            cell.span = cx.num(o, "colSpan").map_or(1, |n| n.max(1.0) as usize);
            cell.row_span = cx.num(o, "rowSpan").map_or(1, |n| n.max(1.0) as usize);
            match o.get("children") {
                Some(Value::Array(items)) => {
                    let _ = crate::js::normalize(items.borrow().clone(), &mut children);
                }
                Some(Value::Element(e)) if e.kind == Kind::Fragment => children.extend(e.children.iter().cloned()),
                Some(c) if !c.is_nullish() => {
                    let _ = crate::js::normalize(vec![c.clone()], &mut children);
                }
                _ => match o.get("text") {
                    Some(Value::Num(n)) => children.push(crate::js::value::str_val(&crate::js::value::num_to_string(*n))),
                    Some(text) if !text.is_nullish() => children.push(crate::js::value::str_val(&text.to_js_string())),
                    _ => {}
                },
            }
            if let Some(Value::Object(icon)) = o.get("icon") {
                let src = cx.string(icon, "src").unwrap_or_default();
                let path = if Path::new(&src).is_absolute() { PathBuf::from(&src) } else { cx.base_dir.join(&src) };
                match std::fs::read_to_string(&path) {
                    Ok(svg) => {
                        let color = cx.color(icon, "color").unwrap_or(t.color);
                        let read = crate::vector::read_icon(&svg, color, true, false);
                        cell.icon = Some(CellIcon { icon: std::rc::Rc::new(read), size: cx.num(icon, "size").unwrap_or(t.size) });
                    }
                    Err(e) => cx.warn(format!("ícone de célula \"{src}\" não pôde ser lido ({e})")),
                }
            }
        }
        _ => {}
    }
    let mut runs = Vec::new();
    collect_runs(cx, &children, &t, None, &mut runs);
    cell.runs = runs.into_iter().map(|r| CellRun { text: r.text, weight: r.weight, italic: r.italic, color: r.color, baseline: r.baseline }).collect();
    cell
}

pub(super) fn align_of(a: &str) -> Align {
    match a {
        "center" => Align::Center,
        "right" | "end" => Align::Right,
        _ => Align::Left,
    }
}

/// `covered[c]` = quantas linhas ainda estão cobertas na coluna c por um rowSpan de cima: a
/// célula vai para a próxima coluna livre (é a coluna da grade que decide o alinhamento).
pub(super) fn row_of(cx: &mut Cx, values: &[Value], base: &CellBase, cols: &[crate::objects::Col], covered: &mut Vec<usize>) -> crate::objects::Row {
    let mut col = 0;
    let mut cells = Vec::new();
    for v in values {
        while covered.get(col).is_some_and(|&n| n > 0) {
            col += 1;
        }
        let mut b = base.clone();
        if let Some(c) = cols.get(col) {
            b.align = c.align;
        }
        let cell = cell_of(cx, v, &b);
        if covered.len() < col + cell.span {
            covered.resize(col + cell.span, 0);
        }
        for slot in &mut covered[col..col + cell.span] {
            *slot = cell.row_span;
        }
        col += cell.span;
        cells.push(cell);
    }
    // A linha terminou: cada cobertura desce uma linha.
    covered.iter_mut().for_each(|n| *n = n.saturating_sub(1));
    crate::objects::Row { cells }
}

pub(super) fn table_spec(cx: &mut Cx, props: &Props, t: &Inherit) -> crate::objects::TableSpec {
    use crate::objects::{Col, TableSpec};
    let size = cx.num(props, "size").unwrap_or(if props.contains_key("fontSize") { t.size } else { 14.0 });
    let columns: Vec<Props> = match cx.get(props, "columns") {
        Some(Value::Array(items)) => items.borrow().iter().filter_map(|c| if let Value::Object(o) = c { Some((**o).clone()) } else { None }).collect(),
        _ => Vec::new(),
    };
    let cols: Vec<Col> = columns.iter().map(|c| Col { width: cx.len(c, "width"), align: cx.string(c, "align").map_or(Align::Left, |a| align_of(&a)) }).collect();
    let valign = cx.string(props, "valign").map_or(0.0, |v| valign_of(&v));
    let text = Inherit { size, weight: 400, italic: false, ..t.clone() };
    let base = CellBase { text, fill: None, align: Align::Left, valign };
    let header = cx.get(props, "header");
    let mut rows = Vec::new();
    if !matches!(header, Some(Value::Bool(false))) {
        let mut h = CellBase { text: Inherit { weight: 700, ..base.text.clone() }, ..base.clone() };
        if let Some(Value::Object(o)) = &header {
            h.fill = cx.color(o, "fill");
            if let Some(c) = cx.color(o, "color") {
                h.text.color = c;
            }
            if let Some(w) = cx.get(o, "weight").or_else(|| cx.get(o, "fontWeight")) {
                h.text.weight = match w {
                    Value::Num(n) => n.clamp(1.0, 1000.0) as u16,
                    Value::Str(s) if &*s == "bold" => 700,
                    Value::Str(s) => s.parse::<f64>().map_or(400, |n| n as u16),
                    _ => 700,
                };
            }
        }
        let mut covered = Vec::new();
        if let Some(Value::Array(extra)) = cx.get(props, "headerRows") {
            for r in extra.borrow().iter() {
                if let Value::Array(values) = r {
                    rows.push(row_of(cx, &values.borrow(), &h, &cols, &mut covered));
                }
            }
        }
        // Títulos das colunas que um rowSpan do cabeçalho de cima já cobre não entram.
        let titles: Vec<Value> = columns.iter().enumerate().filter(|(c, _)| covered.get(*c).is_none_or(|&n| n == 0)).map(|(_, c)| c.get("header").cloned().unwrap_or(Value::Undefined)).collect();
        rows.push(row_of(cx, &titles, &h, &cols, &mut covered));
    }
    let header_count = rows.len();
    let stripe = cx.color(props, "stripe");
    if let Some(Value::Array(data)) = cx.get(props, "rows") {
        let mut covered = Vec::new();
        for (i, r) in data.borrow().iter().enumerate() {
            let Value::Array(values) = r else { continue };
            let fill = if i % 2 == 1 { stripe } else { None };
            rows.push(row_of(cx, &values.borrow(), &CellBase { fill, ..base.clone() }, &cols, &mut covered));
        }
    }
    TableSpec {
        cols,
        rows,
        family: t.family.clone(),
        size,
        line_height: t.line_height,
        padding: cx.num(props, "cellPadding").unwrap_or(4.0),
        border: cx.color(props, "border"),
        header_count,
        repeat_header: cx.bool(props, "repeatHeader") != Some(false),
        author_size: size,
        // Mesma regra do Text: 75% do corpo com piso legível, salvo minSize do autor (tableMinSizeOf).
        min_size: cx.num(props, "minSize").unwrap_or_else(|| (size * 0.75).floor().max(10.0)),
        fit: if cx.string(props, "fit").as_deref() == Some("error") { Fit::Error } else { Fit::Shrink },
    }
}

pub(super) fn axis_of(cx: &Cx, props: &Props, key: &str) -> crate::objects::Axis {
    let Some(Value::Object(o)) = cx.get(props, key) else { return crate::objects::Axis::default() };
    crate::objects::Axis {
        title: cx.string(&o, "title"),
        min: cx.num(&o, "min").map(f64::from),
        max: cx.num(&o, "max").map(f64::from),
        step: cx.num(&o, "step").map(f64::from),
        format: cx.string(&o, "format"),
        grid: cx.bool(&o, "grid"),
        hidden: cx.bool(&o, "hidden").unwrap_or(false),
    }
}

pub(super) fn chart_spec(cx: &Cx, props: &Props, t: &Inherit) -> Option<crate::objects::ChartSpec> {
    use crate::objects::{CHART_PALETTE, ChartKind, ChartSpec, Series};
    let kind_name = cx.string(props, "kind")?;
    let hole = cx.num(props, "holeSize").map_or(50, |h| h.clamp(10.0, 90.0) as u32);
    let kind = match kind_name.as_str() {
        "bar" => ChartKind::Bar { horizontal: false, grouping: "clustered" },
        "barH" => ChartKind::Bar { horizontal: true, grouping: "clustered" },
        "stackedBar" => ChartKind::Bar { horizontal: false, grouping: "stacked" },
        "stackedBarH" => ChartKind::Bar { horizontal: true, grouping: "stacked" },
        "stackedBar100" => ChartKind::Bar { horizontal: false, grouping: "percentStacked" },
        "line" => ChartKind::Line,
        "area" => ChartKind::Area { stacked: false },
        "stackedArea" => ChartKind::Area { stacked: true },
        "pie" => ChartKind::Pie { hole: None },
        "doughnut" => ChartKind::Pie { hole: Some(hole) },
        "scatter" => ChartKind::Scatter,
        "combo" => ChartKind::Combo,
        _ => return None,
    };
    let Some(Value::Object(data)) = cx.get(props, "data") else { return None };
    let categories: Vec<String> = match data.get("categories") {
        Some(Value::Array(c)) => c.borrow().iter().map(Value::to_js_string).collect(),
        _ => Vec::new(),
    };
    let colors: Vec<Rgba> = match cx.get(props, "colors") {
        Some(Value::Array(c)) => c.borrow().iter().filter_map(|v| parse_color(&v.to_js_string())).collect(),
        _ => Vec::new(),
    };
    let color_at = |i: usize| colors.get(i).copied().unwrap_or_else(|| parse_color(CHART_PALETTE[i % CHART_PALETTE.len()]).unwrap_or(BLACK));
    let series: Vec<Series> = match data.get("series") {
        Some(Value::Array(items)) => items
            .borrow()
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                let Value::Object(o) = s else { return None };
                let values = match o.get("values") {
                    Some(Value::Array(v)) => v.borrow().iter().map(Value::to_num).collect(),
                    _ => Vec::new(),
                };
                let points = match o.get("points") {
                    Some(Value::Array(p)) => p
                        .borrow()
                        .iter()
                        .filter_map(|pt| match pt {
                            Value::Array(xy) => {
                                let xy = xy.borrow();
                                Some((xy.first()?.to_num(), xy.get(1)?.to_num()))
                            }
                            _ => None,
                        })
                        .collect(),
                    _ => Vec::new(),
                };
                Some(Series {
                    name: o.get("name").map(Value::to_js_string).unwrap_or_default(),
                    values,
                    points,
                    color: cx.color(o, "color").unwrap_or_else(|| color_at(i)),
                    line: cx.string(o, "as").as_deref() == Some("line"),
                    secondary: cx.string(o, "axis").as_deref() == Some("secondary"),
                })
            })
            .collect(),
        _ => Vec::new(),
    };
    let pie = matches!(kind, ChartKind::Pie { .. });
    let legend = match cx.get(props, "legend") {
        Some(Value::Bool(false)) => None,
        Some(Value::Object(o)) => Some(match o.get("position").map(Value::to_js_string).as_deref() {
            Some("right") => "r",
            Some("top") => "t",
            Some("left") => "l",
            _ => "b",
        }),
        Some(_) => Some("b"),
        None => (pie || series.len() > 1).then_some("b"),
    };
    let label_format = match cx.get(props, "labels") {
        Some(Value::Object(o)) => cx.string(&o, "format"),
        _ => None,
    };
    Some(ChartSpec {
        kind,
        point_colors: if pie { (0..categories.len()).map(color_at).collect() } else { Vec::new() },
        categories,
        series,
        legend,
        labels: cx.get(props, "labels").is_some_and(|v| v.truthy()),
        label_format,
        title: cx.string(props, "title"),
        family: cx.string(props, "font").unwrap_or_else(|| t.family.clone()),
        size: cx.num(props, "size").unwrap_or(12.0),
        // emit/chart.ts textOf: a cor do texto do gráfico é a `color` dele ou a herdada da cascata;
        // sem nenhuma, DEFAULTS.chart.labelColor (#333333).
        color: cx.color(props, "color").unwrap_or(if t.color_set { t.color } else { Rgba { r: 0x33, g: 0x33, b: 0x33, a: 1.0 } }),
        smooth: cx.bool(props, "smooth").unwrap_or(false),
        markers: cx.bool(props, "markers").unwrap_or(false),
        x_axis: axis_of(cx, props, "xAxis"),
        y_axis: axis_of(cx, props, "yAxis"),
        y2_axis: axis_of(cx, props, "y2Axis"),
    })
}
