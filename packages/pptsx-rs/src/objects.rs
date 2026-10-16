//! Objetos nativos do PowerPoint: tabela (`<a:tbl>`) e gráfico (`chartN.xml` com dados
//! literais, sem planilha embutida). Layout da tabela portado de `layout/table.ts`.

use std::fmt::Write as _;

use crate::css::{Len, Rgba};
use crate::emit::{emu, esc};
use crate::model::Align;
use crate::text::{Fonts, Laid, LineHeight, RunInput, TextInput, layout_text};

// ───────────── tabela ─────────────

#[derive(Clone, Debug)]
pub struct Col {
    pub width: Option<Len>,
    pub align: Align,
}

/// Trecho de texto de uma célula (rich text: Span/B/I/Sup/Sub).
#[derive(Clone, Debug)]
pub struct CellRun {
    pub text: String,
    pub weight: u16,
    pub italic: bool,
    pub color: Rgba,
    pub baseline: Option<i32>,
}

#[derive(Clone, Debug)]
pub struct CellIcon {
    pub icon: std::rc::Rc<crate::vector::Icon>,
    pub size: f32,
}

#[derive(Clone, Debug)]
pub struct Cell {
    pub runs: Vec<CellRun>,
    pub fill: Option<Rgba>,
    pub align: Align,
    /// 0 = topo, 0.5 = meio, 1 = base (VALIGN_SHARE).
    pub valign: f32,
    pub span: usize,
    pub row_span: usize,
    pub icon: Option<CellIcon>,
}

#[derive(Clone, Debug)]
pub struct Row {
    pub cells: Vec<Cell>,
}

#[derive(Clone, Debug)]
pub struct TableSpec {
    pub cols: Vec<Col>,
    pub rows: Vec<Row>,
    pub family: String,
    pub size: f32,
    pub line_height: LineHeight,
    pub padding: f32,
    pub border: Option<Rgba>,
    /// Linhas de cabeçalho no início de `rows` (repetidas em cada parte com paginate).
    pub header_count: usize,
    pub repeat_header: bool,
    /// Corpo do autor (`size` pode descer no fit).
    pub author_size: f32,
    pub min_size: f32,
    pub fit: crate::model::Fit,
}

/// Posição da grade: a célula que começa aqui (linha, índice em `cells`) ou coberta por merge.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Slot {
    Cell(usize),
    /// Coberta: por gridSpan (h), por rowSpan (v), ou pelos dois.
    Covered { h: bool, v: bool },
    Empty,
}

pub struct TableLayout {
    /// Corpo das células neste layout (o do fit, quando a tabela encolheu).
    pub size: f32,
    pub widths: Vec<f32>,
    pub heights: Vec<f32>,
    pub grid: Vec<Vec<Slot>>,
    /// Uma medição por célula (na ordem de `rows[r].cells`).
    pub cells: Vec<Vec<Laid>>,
}

impl TableLayout {
    pub fn height(&self) -> f32 {
        self.heights.iter().sum()
    }
}

/// Passo de arredondamento da altura da linha (DEFAULTS.table.rowHeightStep).
const ROW_STEP: f32 = 0.5;
/// Espessura das bordas quando `border` é informado (DEFAULTS.table.borderWidth).
const BORDER_WIDTH: f32 = 0.5;
/// Espaço entre o ícone da célula e o texto (DEFAULTS.table.iconGap).
pub const ICON_GAP: f32 = 4.0;

fn input<'a>(spec: &TableSpec, runs: &'a [RunInput], nowrap: bool) -> TextInput<'a> {
    TextInput { runs, size: spec.size, line_height: spec.line_height, letter_spacing: 0.0, nowrap, max_lines: None }
}

fn runs_of(spec: &TableSpec, cell: &Cell, fonts: &Fonts) -> Vec<RunInput> {
    cell.runs
        .iter()
        .map(|r| RunInput { text: r.text.clone(), face: fonts.face_for(&spec.family, r.weight, r.italic), size: None, shifted: r.baseline.is_some(), own_metrics: false, missing: false })
        .collect()
}

fn icon_space(cell: &Cell) -> f32 {
    cell.icon.as_ref().map_or(0.0, |i| i.size + ICON_GAP)
}

/// Largura min-content da tabela (layout/intrinsic.ts tableMin): coluna com largura fixa vale a
/// largura; as outras, o maior trecho indivisível das células (sem a folga do safety) + padding.
pub fn min_content_width(spec: &TableSpec, fonts: &Fonts) -> f32 {
    let padding = 2.0 * spec.padding;
    (0..spec.cols.len())
        .map(|c| {
            if let Some(Len::Pt(w)) = spec.cols[c].width {
                return w;
            }
            let widest = spec
                .rows
                .iter()
                .filter_map(|row| row.cells.get(c))
                .map(|cell| layout_text(fonts, &input(spec, &runs_of(spec, cell, fonts), cell.icon.is_some()), f32::INFINITY).widest_segment)
                .fold(0.0, f32::max);
            widest + padding
        })
        .sum()
}

/// Grade com os merges (CSS 2.1 §17.5): cada linha ocupa as colunas livres da esquerda para a
/// direita, pulando as cobertas por rowSpan de cima.
pub fn grid_of(spec: &TableSpec) -> Vec<Vec<Slot>> {
    let ncols = spec.cols.len().max(spec.rows.iter().map(|r| r.cells.iter().map(|c| c.span).sum::<usize>()).max().unwrap_or(0));
    let mut grid = vec![vec![Slot::Empty; ncols]; spec.rows.len()];
    for (r, row) in spec.rows.iter().enumerate() {
        let mut c = 0;
        for (i, cell) in row.cells.iter().enumerate() {
            while c < ncols && grid[r][c] != Slot::Empty {
                c += 1;
            }
            if c >= ncols {
                break;
            }
            for dr in 0..cell.row_span.max(1) {
                for dc in 0..cell.span.max(1) {
                    let (rr, cc) = (r + dr, c + dc);
                    if rr >= grid.len() || cc >= ncols {
                        continue;
                    }
                    grid[rr][cc] = if dr == 0 && dc == 0 { Slot::Cell(i) } else { Slot::Covered { h: dc > 0, v: dr > 0 } };
                }
            }
            c += cell.span.max(1);
        }
    }
    grid
}

/// min/max-content de cada coluna pelas células de uma coluna só (layout/table.ts contentWidthsOf).
fn content_widths(spec: &TableSpec, fonts: &Fonts, grid: &[Vec<Slot>], ncols: usize) -> Vec<(f32, f32)> {
    (0..ncols)
        .map(|c| {
            let (mut min, mut max) = (0.0_f32, 0.0_f32);
            for (r, row) in grid.iter().enumerate() {
                let Slot::Cell(i) = row[c] else { continue };
                let cell = &spec.rows[r].cells[i];
                if cell.span != 1 {
                    continue;
                }
                let laid = layout_text(fonts, &input(spec, &runs_of(spec, cell, fonts), cell.icon.is_some()), f32::INFINITY);
                let segment = if cell.icon.is_some() { laid.width } else { laid.widest_segment / fonts.options.safety };
                min = min.max(segment + icon_space(cell));
                max = max.max(laid.width + icon_space(cell));
            }
            (min + 2.0 * spec.padding, max + 2.0 * spec.padding)
        })
        .collect()
}

/// Colunas pt/% ficam; as auto dividem o resto pelo conteúdo: com espaço para o max-content de
/// todas, a sobra vai na proporção do max; sem espaço nem para o min, o min escala; entre os
/// dois, interpola de min para max (CSS 2.1 §17.5.2.2).
pub fn column_widths(spec: &TableSpec, fonts: &Fonts, width: f32, grid: &[Vec<Slot>]) -> Vec<f32> {
    let ncols = grid.first().map_or(spec.cols.len(), Vec::len);
    let fixed: Vec<Option<f32>> = (0..ncols)
        .map(|c| match spec.cols.get(c).and_then(|col| col.width) {
            Some(Len::Pt(v)) => Some(v),
            Some(Len::Pct(p)) if width.is_finite() => Some(p * width),
            _ => None,
        })
        .collect();
    let free: Vec<usize> = (0..ncols).filter(|&c| fixed[c].is_none()).collect();
    let used: f32 = fixed.iter().flatten().sum();
    if free.is_empty() {
        if width.is_finite() && used > 0.0 && (used - width).abs() > 1e-3 {
            return fixed.iter().map(|w| w.unwrap_or(0.0) * width / used).collect();
        }
        return fixed.iter().map(|w| w.unwrap_or(0.0)).collect();
    }
    let content = content_widths(spec, fonts, grid, ncols);
    let autos: Vec<(f32, f32)> = free.iter().map(|&c| content[c]).collect();
    let available = if width.is_finite() { (width - used).max(0.0) } else { f32::INFINITY };
    let min_total: f32 = autos.iter().map(|a| a.0).sum();
    let max_total: f32 = autos.iter().map(|a| a.1).sum();
    let sized: Vec<f32> = if !available.is_finite() {
        autos.iter().map(|a| a.1).collect()
    } else if max_total <= available {
        autos.iter().map(|a| a.1 + if max_total > 0.0 { (available - max_total) * a.1 / max_total } else { (available - max_total) / autos.len() as f32 }).collect()
    } else if min_total >= available {
        autos.iter().map(|a| if min_total > 0.0 { available * a.0 / min_total } else { available / autos.len() as f32 }).collect()
    } else {
        let ratio = (available - min_total) / (max_total - min_total);
        autos.iter().map(|a| a.0 + (a.1 - a.0) * ratio).collect()
    };
    let widths: Vec<f32> = (0..ncols).map(|c| fixed[c].unwrap_or_else(|| sized[free.iter().position(|&f| f == c).unwrap_or(0)])).collect();
    let total: f32 = widths.iter().sum();
    // Fixas que já passam da largura: escala tudo para fechar a soma.
    if width.is_finite() && total > width + 1e-6 { widths.iter().map(|w| w * width / total).collect() } else { widths }
}

pub fn layout_table(spec: &TableSpec, fonts: &Fonts, width: f32) -> TableLayout {
    let grid = grid_of(spec);
    let widths = column_widths(spec, fonts, width, &grid);
    let mut cells: Vec<Vec<Laid>> = spec.rows.iter().map(|_| Vec::new()).collect();
    let mut wanted: Vec<(usize, usize, f32)> = Vec::new();
    for (r, row) in grid.iter().enumerate() {
        let mut by_index: Vec<(usize, Laid)> = Vec::new();
        for (c, slot) in row.iter().enumerate() {
            let Slot::Cell(i) = *slot else { continue };
            let cell = &spec.rows[r].cells[i];
            let span_width: f32 = widths.iter().skip(c).take(cell.span).sum();
            // Célula com ícone fica numa linha (o espaço do ícone só existe na 1ª linha).
            let max = (span_width - 2.0 * spec.padding - icon_space(cell)).max(0.0);
            let laid = layout_text(fonts, &input(spec, &runs_of(spec, cell, fonts), cell.icon.is_some()), max);
            let icon = cell.icon.as_ref().map_or(0.0, |i| i.size);
            wanted.push((r, cell.row_span.max(1), laid.height.max(icon) + 2.0 * spec.padding));
            by_index.push((i, laid));
        }
        by_index.sort_by_key(|(i, _)| *i);
        cells[r] = by_index.into_iter().map(|(_, l)| l).collect();
    }
    // Linhas de uma célula só primeiro; depois cada rowSpan que não coube reparte o que falta.
    let mut heights = vec![0.0_f32; spec.rows.len()];
    for &(r, span, h) in &wanted {
        if span == 1 {
            heights[r] = heights[r].max(h);
        }
    }
    for &(r, span, h) in &wanted {
        if span > 1 {
            let end = (r + span).min(heights.len());
            let missing = h - heights[r..end].iter().sum::<f32>();
            if missing > 0.0 {
                let share = missing / (end - r) as f32;
                heights[r..end].iter_mut().for_each(|x| *x += share);
            }
        }
    }
    // Para cima no passo do Keynote: ele só cresce a linha quando falta espaço (M10-H).
    let heights = heights.into_iter().map(|h| (h / ROW_STEP - 1e-6).ceil() * ROW_STEP).collect();
    TableLayout { size: spec.size, widths, heights, grid, cells }
}

fn solid(c: Rgba) -> String {
    if c.a >= 0.999 {
        return format!("<a:solidFill><a:srgbClr val=\"{}\"/></a:solidFill>", c.hex());
    }
    format!("<a:solidFill><a:srgbClr val=\"{}\"><a:alpha val=\"{}\"/></a:srgbClr></a:solidFill>", c.hex(), (c.a * 100000.0).round() as i64)
}

fn algn(a: Align) -> &'static str {
    match a {
        Align::Left => "l",
        Align::Center => "ctr",
        Align::Right => "r",
    }
}

/// Ícones das células: (célula do layout, frame em pt) para o emissor desenhar sobre a tabela.
pub fn cell_icons(spec: &TableSpec, layout: &TableLayout, x0: f32, y0: f32) -> Vec<(std::rc::Rc<crate::vector::Icon>, (f32, f32, f32, f32))> {
    let mut out = Vec::new();
    let mut y = y0;
    for (r, row) in layout.grid.iter().enumerate() {
        let mut x = x0;
        for (c, slot) in row.iter().enumerate() {
            if let Slot::Cell(i) = *slot {
                let cell = &spec.rows[r].cells[i];
                if let (Some(icon), Some(laid)) = (&cell.icon, layout.cells[r].get(i)) {
                    let height: f32 = layout.heights[r..(r + cell.row_span.max(1)).min(layout.heights.len())].iter().sum();
                    let inner_h = (height - 2.0 * spec.padding).max(0.0);
                    let block = icon.size.max(laid.height);
                    let top = y + spec.padding + (inner_h - block).max(0.0) * cell.valign;
                    let line_top = ((laid.line.height.min(block)) - icon.size).max(0.0) / 2.0;
                    out.push((icon.icon.clone(), (x + spec.padding, top + line_top, icon.size, icon.size)));
                }
            }
            x += layout.widths[c];
        }
        y += layout.heights[r];
    }
    out
}

pub fn table_xml(spec: &TableSpec, layout: &TableLayout, id: u32, frame: (f32, f32, f32, f32), lang: &str, fonts: &Fonts) -> String {
    let (x, y, w, h) = frame;
    let mut out = format!(
        "<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id=\"{id}\" name=\"Table {id}\"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp=\"1\"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x=\"{}\" y=\"{}\"/><a:ext cx=\"{}\" cy=\"{}\"/></p:xfrm><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/table\"><a:tbl><a:tblPr/><a:tblGrid>",
        emu(x),
        emu(y),
        emu(w),
        emu(h)
    );
    for cw in &layout.widths {
        let _ = write!(out, "<a:gridCol w=\"{}\"/>", emu(*cw));
    }
    out.push_str("</a:tblGrid>");
    let size = (layout.size * 100.0).round() as i64;
    let pad = emu(spec.padding);
    let line = |tag: &str| match spec.border {
        Some(c) => format!("<a:{tag} w=\"{}\" cap=\"flat\" cmpd=\"sng\" algn=\"ctr\">{}<a:prstDash val=\"solid\"/></a:{tag}>", emu(BORDER_WIDTH), solid(c)),
        None => format!("<a:{tag}><a:noFill/></a:{tag}>"),
    };
    let borders = format!("{}{}{}{}", line("lnL"), line("lnR"), line("lnT"), line("lnB"));
    let typeface_of = |r: &CellRun| {
        let m = fonts.matching(&spec.family, r.weight, r.italic);
        (esc(&m.typeface.unwrap_or_else(|| spec.family.clone())), m.bold)
    };
    // Espaço inicial do ícone: o Keynote ignora margem por célula e recuo, então vai como um
    // espaço com charSpacing (largura do espaço + espaçamento = ícone + intervalo), como no pptsx.
    let space_width = fonts.width(fonts.face_for(&spec.family, 400, false), " ", layout.size, 0.0);
    for (r, row) in layout.grid.iter().enumerate() {
        let _ = write!(out, "<a:tr h=\"{}\">", emu(layout.heights[r]));
        for slot in row {
            let i = match *slot {
                Slot::Cell(i) => i,
                Slot::Covered { h, v } => {
                    let attrs = format!("{}{}", if h { " hMerge=\"1\"" } else { "" }, if v { " vMerge=\"1\"" } else { "" });
                    let _ = write!(out, "<a:tc{attrs}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=\"{lang}\"/></a:p></a:txBody><a:tcPr/></a:tc>");
                    continue;
                }
                Slot::Empty => {
                    let _ = write!(out, "<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang=\"{lang}\"/></a:p></a:txBody><a:tcPr marL=\"{pad}\" marR=\"{pad}\" marT=\"{pad}\" marB=\"{pad}\">{borders}<a:noFill/></a:tcPr></a:tc>");
                    continue;
                }
            };
            let cell = &spec.rows[r].cells[i];
            let laid = &layout.cells[r][i];
            let span = format!(
                "{}{}",
                if cell.span > 1 { format!(" gridSpan=\"{}\"", cell.span) } else { String::new() },
                if cell.row_span > 1 { format!(" rowSpan=\"{}\"", cell.row_span) } else { String::new() }
            );
            // lineHeight 'normal' sem lnSpc (o Keynote bate com a altura natural); número = spcPts exato.
            let spacing = match spec.line_height {
                LineHeight::Multiple(_) => format!("<a:lnSpc><a:spcPts val=\"{}\"/></a:lnSpc>", (laid.line.height * 100.0).round() as i64),
                LineHeight::Normal => String::new(),
            };
            let _ = write!(out, "<a:tc{span}><a:txBody><a:bodyPr/><a:lstStyle/>");
            for (pi, paragraph) in laid.paragraphs.iter().enumerate() {
                let _ = write!(out, "<a:p><a:pPr algn=\"{}\">{spacing}</a:pPr>", algn(cell.align));
                if pi == 0
                    && let Some(icon) = &cell.icon {
                        let spc = ((icon.size + ICON_GAP - space_width).max(0.0) * 100.0).round() as i64;
                        let _ = write!(out, "<a:r><a:rPr lang=\"{lang}\" sz=\"{size}\" spc=\"{spc}\" dirty=\"0\"/><a:t> </a:t></a:r>");
                    }
                for (li, pieces) in paragraph.iter().enumerate() {
                    if li > 0 {
                        let _ = write!(out, "<a:br><a:rPr lang=\"{lang}\" sz=\"{size}\"/></a:br>");
                    }
                    for piece in pieces {
                        let Some(run) = cell.runs.get(piece.run) else { continue };
                        let (typeface, bold) = typeface_of(run);
                        let baseline = run.baseline.map(|b| format!(" baseline=\"{b}\"")).unwrap_or_default();
                        let _ = write!(
                            out,
                            "<a:r><a:rPr lang=\"{lang}\" sz=\"{size}\" b=\"{}\"{}{baseline} dirty=\"0\">{}<a:latin typeface=\"{typeface}\"/><a:ea typeface=\"{typeface}\"/><a:cs typeface=\"{typeface}\"/></a:rPr><a:t>{}</a:t></a:r>",
                            u8::from(bold),
                            if run.italic { " i=\"1\"" } else { "" },
                            solid(run.color),
                            esc(&piece.text)
                        );
                    }
                }
                let _ = write!(out, "<a:endParaRPr lang=\"{lang}\" sz=\"{size}\" dirty=\"0\"/></a:p>");
            }
            let anchor = if cell.valign >= 0.99 { "b" } else if cell.valign >= 0.49 { "ctr" } else { "t" };
            let fill = cell.fill.map_or_else(|| "<a:noFill/>".to_string(), solid);
            let _ = write!(out, "</a:txBody><a:tcPr marL=\"{pad}\" marR=\"{pad}\" marT=\"{pad}\" marB=\"{pad}\" anchor=\"{anchor}\">{borders}{fill}</a:tcPr></a:tc>");
        }
        out.push_str("</a:tr>");
    }
    out.push_str("</a:tbl></a:graphicData></a:graphic></p:graphicFrame>");
    out
}

// ───────────── gráfico ─────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ChartKind {
    Bar { horizontal: bool, grouping: &'static str },
    Line,
    Area { stacked: bool },
    Pie { hole: Option<u32> },
    /// Pares (x, y): dois eixos de valor.
    Scatter,
    /// Barras e linhas no mesmo gráfico; série com `axis: 'secondary'` vai no eixo da direita.
    Combo,
}

#[derive(Clone, Debug)]
pub struct Series {
    pub name: String,
    pub values: Vec<f64>,
    pub points: Vec<(f64, f64)>,
    pub color: Rgba,
    /// combo: desenhada como linha (senão barra).
    pub line: bool,
    pub secondary: bool,
}

/// ChartAxis do contrato (M14): tudo opcional.
#[derive(Clone, Debug, Default)]
pub struct Axis {
    pub title: Option<String>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
    pub format: Option<String>,
    pub grid: Option<bool>,
    pub hidden: bool,
}

#[derive(Clone, Debug)]
pub struct ChartSpec {
    pub kind: ChartKind,
    pub categories: Vec<String>,
    pub series: Vec<Series>,
    /// Cores por categoria (pizza/rosca).
    pub point_colors: Vec<Rgba>,
    pub legend: Option<&'static str>,
    pub labels: bool,
    pub label_format: Option<String>,
    pub title: Option<String>,
    pub family: String,
    pub size: f32,
    pub color: Rgba,
    pub smooth: bool,
    pub markers: bool,
    pub x_axis: Axis,
    pub y_axis: Axis,
    pub y2_axis: Axis,
}

pub const CHART_PALETTE: [&str; 6] = ["#2F6FED", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#64748B"];

fn num(v: f64) -> String {
    crate::js::value::num_to_string(v)
}

fn text_props(spec: &ChartSpec, size: f32, bold: bool) -> String {
    format!(
        "<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=\"{}\" b=\"{}\">{}<a:latin typeface=\"{}\"/></a:defRPr></a:pPr><a:endParaRPr lang=\"pt-BR\"/></a:p></c:txPr>",
        (size * 100.0).round() as i64,
        u8::from(bold),
        solid(spec.color),
        esc(&spec.family)
    )
}

/// Coluna da planilha: 0 → A, 1 → B…
fn col_letter(mut n: usize) -> String {
    let mut out = Vec::new();
    loop {
        out.push((b'A' + (n % 26) as u8) as char);
        if n < 26 {
            break;
        }
        n = n / 26 - 1;
    }
    out.iter().rev().collect()
}

/// Referência à planilha embutida com o cache dos valores (o Keynote desenha pelo cache;
/// o PowerPoint edita pela planilha).
fn str_ref(formula: &str, items: &[String]) -> String {
    let mut out = format!("<c:strRef><c:f>{}</c:f><c:strCache><c:ptCount val=\"{}\"/>", esc(formula), items.len());
    for (i, s) in items.iter().enumerate() {
        let _ = write!(out, "<c:pt idx=\"{i}\"><c:v>{}</c:v></c:pt>", esc(s));
    }
    out.push_str("</c:strCache></c:strRef>");
    out
}

fn num_ref(formula: &str, values: &[f64]) -> String {
    let mut out = format!("<c:numRef><c:f>{}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val=\"{}\"/>", esc(formula), values.len());
    for (i, v) in values.iter().enumerate() {
        let _ = write!(out, "<c:pt idx=\"{i}\"><c:v>{}</c:v></c:pt>", num(*v));
    }
    out.push_str("</c:numCache></c:numRef>");
    out
}

/// Planilha: categorias na coluna A e uma série por coluna; no scatter, x e y lado a lado por série.
fn series_refs(spec: &ChartSpec, i: usize) -> (String, String, String) {
    let s = &spec.series[i];
    if spec.kind == ChartKind::Scatter {
        let (cx, cy) = (col_letter(2 * i), col_letter(2 * i + 1));
        let n = s.points.len();
        let xs: Vec<f64> = s.points.iter().map(|p| p.0).collect();
        let ys: Vec<f64> = s.points.iter().map(|p| p.1).collect();
        let tx = format!("<c:tx>{}</c:tx>", str_ref(&format!("Sheet1!${cy}$1"), std::slice::from_ref(&s.name)));
        return (tx, format!("<c:xVal>{}</c:xVal>", num_ref(&format!("Sheet1!${cx}$2:${cx}${}", n + 1), &xs)), format!("<c:yVal>{}</c:yVal>", num_ref(&format!("Sheet1!${cy}$2:${cy}${}", n + 1), &ys)));
    }
    let col = col_letter(i + 1);
    let n = spec.categories.len().max(s.values.len());
    let tx = format!("<c:tx>{}</c:tx>", str_ref(&format!("Sheet1!${col}$1"), std::slice::from_ref(&s.name)));
    let cat = format!("<c:cat>{}</c:cat>", str_ref(&format!("Sheet1!$A$2:$A${}", n + 1), &spec.categories));
    let val = format!("<c:val>{}</c:val>", num_ref(&format!("Sheet1!${col}$2:${col}${}", n + 1), &s.values));
    (tx, cat, val)
}

/// Planilha mínima (.xlsx) com os dados do gráfico.
pub fn chart_workbook(spec: &ChartSpec) -> Vec<u8> {
    use std::io::Write;
    let inline = |r: &str, s: &str| format!("<c r=\"{r}\" t=\"inlineStr\"><is><t>{}</t></is></c>", esc(s));
    let mut table: Vec<Vec<String>> = Vec::new();
    let mut put = |r: usize, c: usize, cell: String| {
        while table.len() <= r {
            table.push(Vec::new());
        }
        while table[r].len() <= c {
            table[r].push(String::new());
        }
        table[r][c] = cell;
    };
    let number = |r: usize, c: usize, v: f64| format!("<c r=\"{}{}\"><v>{}</v></c>", col_letter(c), r + 1, num(v));
    if spec.kind == ChartKind::Scatter {
        for (i, s) in spec.series.iter().enumerate() {
            put(0, 2 * i, inline(&format!("{}1", col_letter(2 * i)), "x"));
            put(0, 2 * i + 1, inline(&format!("{}1", col_letter(2 * i + 1)), &s.name));
            for (k, (x, y)) in s.points.iter().enumerate() {
                put(k + 1, 2 * i, number(k + 1, 2 * i, *x));
                put(k + 1, 2 * i + 1, number(k + 1, 2 * i + 1, *y));
            }
        }
    } else {
        put(0, 0, inline("A1", ""));
        for (i, s) in spec.series.iter().enumerate() {
            put(0, i + 1, inline(&format!("{}1", col_letter(i + 1)), &s.name));
            for (k, v) in s.values.iter().enumerate() {
                put(k + 1, i + 1, number(k + 1, i + 1, *v));
            }
        }
        for (k, cat) in spec.categories.iter().enumerate() {
            put(k + 1, 0, inline(&format!("A{}", k + 2), cat));
        }
    }
    let rows: String = table.iter().enumerate().map(|(r, cells)| format!("<row r=\"{}\">{}</row>", r + 1, cells.concat())).collect();
    let head = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
    let parts: [(&str, String); 6] = [
        ("[Content_Types].xml", format!("{head}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>")),
        ("_rels/.rels", format!("{head}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>")),
        ("xl/workbook.xml", format!("{head}<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>")),
        ("xl/_rels/workbook.xml.rels", format!("{head}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>")),
        ("xl/styles.xml", format!("{head}<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"1\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs></styleSheet>")),
        ("xl/worksheets/sheet1.xml", format!("{head}<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>{rows}</sheetData></worksheet>")),
    ];
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for (name, data) in parts {
        if zip.start_file(name, opts).is_ok() {
            let _ = zip.write_all(data.as_bytes());
        }
    }
    zip.finish().map(|c| c.into_inner()).unwrap_or_default()
}

fn data_labels(spec: &ChartSpec) -> String {
    if !spec.labels {
        return String::new();
    }
    let fmt = spec.label_format.as_ref().map(|f| format!("<c:numFmt formatCode=\"{}\" sourceLinked=\"0\"/>", esc(f))).unwrap_or_default();
    format!(
        "<c:dLbls>{fmt}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>{}<c:showLegendKey val=\"0\"/><c:showVal val=\"1\"/><c:showCatName val=\"0\"/><c:showSerName val=\"0\"/><c:showPercent val=\"0\"/><c:showBubbleSize val=\"0\"/></c:dLbls>",
        text_props(spec, spec.size, false)
    )
}

const CAT_AX: u32 = 500_000_001;
const VAL_AX: u32 = 500_000_002;
const CAT2_AX: u32 = 500_000_003;
const VAL2_AX: u32 = 500_000_004;

fn axis_title(spec: &ChartSpec, axis: &Axis) -> String {
    let Some(t) = &axis.title else { return String::new() };
    format!(
        "<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=\"{sz}\" b=\"0\"/></a:pPr><a:r><a:rPr lang=\"pt-BR\" sz=\"{sz}\" b=\"0\">{}<a:latin typeface=\"{}\"/></a:rPr><a:t>{}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>",
        solid(spec.color),
        esc(&spec.family),
        esc(t),
        sz = (spec.size * 100.0).round() as i64
    )
}

fn scaling(axis: &Axis, reversed: bool) -> String {
    let mut out = format!("<c:scaling><c:orientation val=\"{}\"/>", if reversed { "maxMin" } else { "minMax" });
    if let Some(max) = axis.max {
        let _ = write!(out, "<c:max val=\"{}\"/>", num(max));
    }
    if let Some(min) = axis.min {
        let _ = write!(out, "<c:min val=\"{}\"/>", num(min));
    }
    out.push_str("</c:scaling>");
    out
}

// emit/chart.ts VALUE_GRID_LINE ({ color: 'DDDDDD', size: 0.5 }) e a linha do eixo do pptxgenjs (888888, 1 pt).
const GRID: &str = "<c:majorGridlines><c:spPr><a:ln w=\"6350\"><a:solidFill><a:srgbClr val=\"DDDDDD\"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>";
const AXIS_LINE: &str = "<c:spPr><a:ln w=\"12700\"><a:solidFill><a:srgbClr val=\"888888\"/></a:solidFill></a:ln></c:spPr>";

/// Eixo de valores (`pos` = lado; `cross` = o eixo que ele cruza; `crosses` = autoZero/max).
#[allow(clippy::too_many_arguments)]
fn val_axis(spec: &ChartSpec, axis: &Axis, id: u32, cross: u32, pos: &str, crosses: &str, default_grid: bool, delete: bool) -> String {
    let grid = if axis.grid.unwrap_or(default_grid) { GRID } else { "" };
    let fmt = axis.format.as_deref().unwrap_or("General");
    let step = axis.step.map(|s| format!("<c:majorUnit val=\"{}\"/>", num(s))).unwrap_or_default();
    format!(
        "<c:valAx><c:axId val=\"{id}\"/>{}<c:delete val=\"{}\"/><c:axPos val=\"{pos}\"/>{grid}{}<c:numFmt formatCode=\"{}\" sourceLinked=\"0\"/><c:majorTickMark val=\"none\"/><c:minorTickMark val=\"none\"/><c:tickLblPos val=\"nextTo\"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>{}<c:crossAx val=\"{cross}\"/><c:crosses val=\"{crosses}\"/><c:crossBetween val=\"{}\"/>{step}</c:valAx>",
        scaling(axis, false),
        u8::from(axis.hidden || delete),
        axis_title(spec, axis),
        esc(fmt),
        text_props(spec, spec.size, false),
        if spec.kind == ChartKind::Scatter { "midCat" } else { "between" }
    )
}

fn cat_axis(spec: &ChartSpec, axis: &Axis, id: u32, cross: u32, pos: &str, reversed: bool, delete: bool) -> String {
    let grid = if axis.grid.unwrap_or(false) { GRID } else { "" };
    format!(
        "<c:catAx><c:axId val=\"{id}\"/>{}<c:delete val=\"{}\"/><c:axPos val=\"{pos}\"/>{grid}{}<c:numFmt formatCode=\"General\" sourceLinked=\"0\"/><c:majorTickMark val=\"none\"/><c:minorTickMark val=\"none\"/><c:tickLblPos val=\"nextTo\"/>{AXIS_LINE}{}<c:crossAx val=\"{cross}\"/><c:crosses val=\"autoZero\"/><c:auto val=\"1\"/><c:lblAlgn val=\"ctr\"/><c:lblOffset val=\"100\"/><c:noMultiLvlLbl val=\"0\"/></c:catAx>",
        scaling(axis, reversed),
        u8::from(axis.hidden || delete),
        axis_title(spec, axis),
        text_props(spec, spec.size, false)
    )
}

fn marker(spec: &ChartSpec, color: Rgba) -> String {
    if spec.markers || spec.kind == ChartKind::Scatter {
        format!("<c:marker><c:symbol val=\"circle\"/><c:size val=\"6\"/><c:spPr>{}<a:ln><a:noFill/></a:ln></c:spPr></c:marker>", solid(color))
    } else {
        "<c:marker><c:symbol val=\"none\"/></c:marker>".into()
    }
}

fn bar_series(spec: &ChartSpec, i: usize) -> String {
    let (tx, cat, val) = series_refs(spec, i);
    format!("<c:ser><c:idx val=\"{i}\"/><c:order val=\"{i}\"/>{tx}<c:spPr>{}</c:spPr><c:invertIfNegative val=\"0\"/>{cat}{val}</c:ser>", solid(spec.series[i].color))
}

fn line_series(spec: &ChartSpec, i: usize) -> String {
    let s = &spec.series[i];
    let (tx, cat, val) = series_refs(spec, i);
    format!(
        "<c:ser><c:idx val=\"{i}\"/><c:order val=\"{i}\"/>{tx}<c:spPr><a:ln w=\"25400\" cap=\"rnd\">{}<a:round/></a:ln></c:spPr>{}{cat}{val}<c:smooth val=\"{}\"/></c:ser>",
        solid(s.color),
        marker(spec, s.color),
        u8::from(spec.smooth)
    )
}

pub fn chart_xml(spec: &ChartSpec, lang: &str) -> String {
    let mut plot = String::new();
    let all: Vec<usize> = (0..spec.series.len()).collect();
    match spec.kind {
        ChartKind::Bar { horizontal, grouping } => {
            let _ = write!(plot, "<c:barChart><c:barDir val=\"{}\"/><c:grouping val=\"{grouping}\"/><c:varyColors val=\"0\"/>", if horizontal { "bar" } else { "col" });
            all.iter().for_each(|&i| plot.push_str(&bar_series(spec, i)));
            let overlap = if grouping == "clustered" { String::new() } else { "<c:overlap val=\"100\"/>".into() };
            let _ = write!(plot, "{}<c:gapWidth val=\"80\"/>{overlap}<c:axId val=\"{CAT_AX}\"/><c:axId val=\"{VAL_AX}\"/></c:barChart>", data_labels(spec));
            let (cp, vp) = if horizontal { ("l", "b") } else { ("b", "l") };
            // Barras horizontais: a 1ª categoria em cima, como se lê.
            plot.push_str(&cat_axis(spec, &spec.x_axis, CAT_AX, VAL_AX, cp, horizontal, false));
            plot.push_str(&val_axis(spec, &spec.y_axis, VAL_AX, CAT_AX, vp, "autoZero", true, false));
        }
        ChartKind::Line => {
            plot.push_str("<c:lineChart><c:grouping val=\"standard\"/><c:varyColors val=\"0\"/>");
            all.iter().for_each(|&i| plot.push_str(&line_series(spec, i)));
            let _ = write!(plot, "{}<c:marker val=\"1\"/><c:axId val=\"{CAT_AX}\"/><c:axId val=\"{VAL_AX}\"/></c:lineChart>", data_labels(spec));
            plot.push_str(&cat_axis(spec, &spec.x_axis, CAT_AX, VAL_AX, "b", false, false));
            plot.push_str(&val_axis(spec, &spec.y_axis, VAL_AX, CAT_AX, "l", "autoZero", true, false));
        }
        ChartKind::Area { stacked } => {
            let _ = write!(plot, "<c:areaChart><c:grouping val=\"{}\"/><c:varyColors val=\"0\"/>", if stacked { "stacked" } else { "standard" });
            for &i in &all {
                let (tx, cat, val) = series_refs(spec, i);
                let _ = write!(plot, "<c:ser><c:idx val=\"{i}\"/><c:order val=\"{i}\"/>{tx}<c:spPr>{}</c:spPr>{cat}{val}</c:ser>", solid(spec.series[i].color.with_alpha(0.85)));
            }
            let _ = write!(plot, "{}<c:axId val=\"{CAT_AX}\"/><c:axId val=\"{VAL_AX}\"/></c:areaChart>", data_labels(spec));
            plot.push_str(&cat_axis(spec, &spec.x_axis, CAT_AX, VAL_AX, "b", false, false));
            plot.push_str(&val_axis(spec, &spec.y_axis, VAL_AX, CAT_AX, "l", "autoZero", true, false));
        }
        ChartKind::Pie { hole } => {
            let tag = if hole.is_some() { "doughnutChart" } else { "pieChart" };
            let _ = write!(plot, "<c:{tag}><c:varyColors val=\"1\"/>");
            if !spec.series.is_empty() {
                let points: String = spec
                    .point_colors
                    .iter()
                    .enumerate()
                    .map(|(i, c)| format!("<c:dPt><c:idx val=\"{i}\"/><c:bubble3D val=\"0\"/><c:spPr>{}<a:ln w=\"9525\"><a:solidFill><a:srgbClr val=\"F9F9F9\"/></a:solidFill></a:ln></c:spPr></c:dPt>", solid(*c)))
                    .collect();
                let (tx, cat, val) = series_refs(spec, 0);
                let _ = write!(plot, "<c:ser><c:idx val=\"0\"/><c:order val=\"0\"/>{tx}{points}{}{cat}{val}</c:ser>", data_labels(spec));
            }
            plot.push_str("<c:firstSliceAng val=\"0\"/>");
            if let Some(h) = hole {
                let _ = write!(plot, "<c:holeSize val=\"{h}\"/>");
            }
            let _ = write!(plot, "</c:{tag}>");
        }
        ChartKind::Scatter => {
            plot.push_str("<c:scatterChart><c:scatterStyle val=\"lineMarker\"/><c:varyColors val=\"0\"/>");
            for &i in &all {
                let s = &spec.series[i];
                let (tx, x, y) = series_refs(spec, i);
                let _ = write!(plot, "<c:ser><c:idx val=\"{i}\"/><c:order val=\"{i}\"/>{tx}<c:spPr><a:ln w=\"25400\"><a:noFill/></a:ln></c:spPr>{}{x}{y}<c:smooth val=\"0\"/></c:ser>", marker(spec, s.color));
            }
            let _ = write!(plot, "{}<c:axId val=\"{CAT_AX}\"/><c:axId val=\"{VAL_AX}\"/></c:scatterChart>", data_labels(spec));
            plot.push_str(&val_axis(spec, &spec.x_axis, CAT_AX, VAL_AX, "b", "autoZero", false, false));
            plot.push_str(&val_axis(spec, &spec.y_axis, VAL_AX, CAT_AX, "l", "autoZero", true, false));
        }
        ChartKind::Combo => {
            // Um grupo por (tipo, eixo): barras e linhas do eixo principal, e as do secundário
            // sobre um par de eixos próprio (categorias ocultas, valores à direita).
            let groups = [(false, false), (true, false), (false, true), (true, true)];
            for (line, secondary) in groups {
                let members: Vec<usize> = all.iter().copied().filter(|&i| spec.series[i].line == line && spec.series[i].secondary == secondary).collect();
                if members.is_empty() {
                    continue;
                }
                let (cat, val) = if secondary { (CAT2_AX, VAL2_AX) } else { (CAT_AX, VAL_AX) };
                if line {
                    plot.push_str("<c:lineChart><c:grouping val=\"standard\"/><c:varyColors val=\"0\"/>");
                    members.iter().for_each(|&i| plot.push_str(&line_series(spec, i)));
                    let _ = write!(plot, "{}<c:marker val=\"1\"/><c:axId val=\"{cat}\"/><c:axId val=\"{val}\"/></c:lineChart>", data_labels(spec));
                } else {
                    plot.push_str("<c:barChart><c:barDir val=\"col\"/><c:grouping val=\"clustered\"/><c:varyColors val=\"0\"/>");
                    members.iter().for_each(|&i| plot.push_str(&bar_series(spec, i)));
                    let _ = write!(plot, "{}<c:gapWidth val=\"80\"/><c:axId val=\"{cat}\"/><c:axId val=\"{val}\"/></c:barChart>", data_labels(spec));
                }
            }
            plot.push_str(&cat_axis(spec, &spec.x_axis, CAT_AX, VAL_AX, "b", false, false));
            plot.push_str(&val_axis(spec, &spec.y_axis, VAL_AX, CAT_AX, "l", "autoZero", true, false));
            if spec.series.iter().any(|s| s.secondary) {
                plot.push_str(&cat_axis(spec, &Axis::default(), CAT2_AX, VAL2_AX, "b", false, true));
                plot.push_str(&val_axis(spec, &spec.y2_axis, VAL2_AX, CAT2_AX, "r", "max", false, false));
            }
        }
    }
    let title = match &spec.title {
        Some(t) => format!(
            // Como o pptxgenjs: título regular (b="0"), 2 pt maior que os rótulos (TITLE_SIZE_DELTA).
            "<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=\"{sz}\" b=\"0\"/></a:pPr><a:r><a:rPr lang=\"{lang}\" sz=\"{sz}\" b=\"0\">{}<a:latin typeface=\"{}\"/></a:rPr><a:t>{}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title><c:autoTitleDeleted val=\"0\"/>",
            solid(spec.color),
            esc(&spec.family),
            esc(t),
            sz = ((spec.size + 2.0) * 100.0).round() as i64
        ),
        None => "<c:autoTitleDeleted val=\"1\"/>".into(),
    };
    let legend = spec
        .legend
        .map(|pos| format!("<c:legend><c:legendPos val=\"{pos}\"/><c:overlay val=\"0\"/>{}</c:legend>", text_props(spec, spec.size, false)))
        .unwrap_or_default();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<c:chartSpace xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><c:roundedCorners val=\"0\"/><c:chart>{title}<c:plotArea><c:layout/>{plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>{legend}<c:plotVisOnly val=\"1\"/><c:dispBlanksAs val=\"gap\"/></c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>{}<c:externalData r:id=\"rId1\"><c:autoUpdate val=\"0\"/></c:externalData></c:chartSpace>",
        text_props(spec, spec.size, false)
    )
}

pub fn chart_frame_xml(id: u32, rid: &str, frame: (f32, f32, f32, f32)) -> String {
    let (x, y, w, h) = frame;
    format!(
        "<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id=\"{id}\" name=\"Chart {id}\"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x=\"{}\" y=\"{}\"/><a:ext cx=\"{}\" cy=\"{}\"/></p:xfrm><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/chart\"><c:chart xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" r:id=\"{rid}\"/></a:graphicData></a:graphic></p:graphicFrame>",
        emu(x),
        emu(y),
        emu(w),
        emu(h)
    )
}
