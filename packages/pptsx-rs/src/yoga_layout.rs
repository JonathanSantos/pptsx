//! Árvore do Yoga a partir do modelo, como o pptsx monta (layout/tree.ts e layout/style.ts): o
//! estilo de cada nó vem do mesmo `Style` que o modelo resolve, com as regras que o pptsx passa
//! ao Yoga (flex-basis pela origem, minWidth da linha nowrap só numa row, baseline do Text lida
//! pelo pai). Texto e tabela são folhas medidas; o grid é uma folha medida pelo motor de grid
//! próprio (`grid.rs`, porta do `grid.ts`), e os itens dele saem de árvores Yoga do tamanho da área
//! (grid-layout.ts).

use std::collections::HashMap;

use taffy::prelude::*;
use taffy::style::FlexDirection as TFlexDir;

use crate::layout::{Frame, NodeBox, Scales};
use crate::model::{Basis, Node, NodeKind, SlideSpec};
use crate::text::{Fonts, RunInput, layout_text};
use crate::yoga::{self, Align, Justify, Len, Measurer, Mode, Tree, Wrap};

enum Leaf<'a> {
    Text { spec: &'a crate::model::TextSpec, runs: Vec<RunInput>, size: f32, lines: Option<usize>, baseline: Option<f32> },
    Table(std::borrow::Cow<'a, crate::objects::TableSpec>),
    /// Grid: a grade é dimensionada pelo `grid.rs` com os itens medidos em árvores Yoga isoladas.
    Grid { node: &'a Node, base: usize },
}

struct Ctx<'a, 'f> {
    fonts: &'f Fonts,
    scales: &'f Scales,
    leaves: HashMap<usize, Leaf<'a>>,
}

impl Measurer for Ctx<'_, '_> {
    fn measure(&mut self, n: usize, w: f32, wm: Mode, h: f32, hm: Mode) -> (f32, f32) {
        let fonts = self.fonts;
        match self.leaves.get(&n) {
            // layout/tree.ts textMeasureFunc
            Some(Leaf::Text { spec, runs, size, lines, .. }) => {
                let max = if wm == Mode::MaxContent || w.is_nan() { f32::INFINITY } else { w };
                let laid = layout_text(fonts, &crate::layout::text_input(spec, runs, *size, *lines), max);
                match wm {
                    Mode::StretchFit => (w, laid.height),
                    Mode::FitContent => (laid.width.min(w), laid.height),
                    Mode::MaxContent => (laid.width, laid.height),
                }
            }
            // tableMeasureFunc
            Some(Leaf::Table(spec)) => {
                if wm == Mode::StretchFit {
                    return (w, crate::objects::layout_table(spec, fonts, w).height());
                }
                let natural: f32 = crate::objects::layout_table(spec, fonts, f32::INFINITY).widths.iter().sum();
                let limit = if wm == Mode::FitContent && w.is_finite() { w } else { f32::INFINITY };
                let chosen = natural.min(limit);
                (chosen, crate::objects::layout_table(spec, fonts, chosen).height())
            }
            // grid-layout.ts gridMeasureFunc: largura definida só com Exactly; AtMost limita a natural.
            Some(Leaf::Grid { node, base }) => {
                let definite_w = (wm == Mode::StretchFit).then_some(w);
                let definite_h = (hm == Mode::StretchFit).then_some(h);
                let natural = grid_model(node, *base, fonts, self.scales, definite_w, definite_h);
                let natural_w = crate::grid::total_of(&natural.columns, natural.column_gap);
                // fit-content: a grade não passa do limite (as colunas fr/auto se reajustam a ele).
                let limited = wm == Mode::FitContent && natural_w > w;
                let model = if limited { grid_model(node, *base, fonts, self.scales, Some(w), definite_h) } else { natural };
                let used_w = if wm == Mode::StretchFit || limited { w } else { natural_w };
                (used_w, definite_h.unwrap_or_else(|| crate::grid::total_of(&model.rows, model.row_gap)))
            }
            None => (0.0, 0.0),
        }
    }

    fn baseline(&mut self, n: usize, _w: f32, h: f32) -> f32 {
        match self.leaves.get(&n) {
            Some(Leaf::Text { baseline: Some(b), .. }) => *b,
            _ => h,
        }
    }
}

// ───────────── estilo (taffy → Yoga, layout/style.ts) ─────────────

fn lpa(l: LengthPercentageAuto) -> Len {
    let raw = l.into_raw();
    match raw.tag() {
        taffy::CompactLength::LENGTH_TAG => Len::Pt(raw.value()),
        taffy::CompactLength::PERCENT_TAG => Len::Pct(raw.value() * 100.0),
        taffy::CompactLength::AUTO_TAG => Len::Auto,
        _ => Len::Undef,
    }
}

fn lp(l: LengthPercentage) -> Len {
    let raw = l.into_raw();
    match raw.tag() {
        taffy::CompactLength::LENGTH_TAG => Len::Pt(raw.value()),
        taffy::CompactLength::PERCENT_TAG => Len::Pct(raw.value() * 100.0),
        _ => Len::Undef,
    }
}

fn dimension(d: Dimension) -> Len {
    let raw = d.into_raw();
    match raw.tag() {
        taffy::CompactLength::LENGTH_TAG => Len::Pt(raw.value()),
        taffy::CompactLength::PERCENT_TAG => Len::Pct(raw.value() * 100.0),
        _ => Len::Auto,
    }
}

fn pt(l: LengthPercentage) -> f32 {
    match lp(l) {
        Len::Pt(v) => v,
        _ => 0.0,
    }
}

fn align(a: Option<AlignItems>, default: Align) -> Align {
    let Some(a) = a.filter(|a| *a != AlignItems::NORMAL) else { return default };
    if a == AlignItems::START || a == AlignItems::FLEX_START {
        Align::FlexStart
    } else if a == AlignItems::END || a == AlignItems::FLEX_END {
        Align::FlexEnd
    } else if a == AlignItems::CENTER {
        Align::Center
    } else if a == AlignItems::BASELINE {
        Align::Baseline
    } else {
        Align::Stretch
    }
}

fn align_content(a: AlignContent) -> Align {
    let Some(a) = Some(a).filter(|a| *a != AlignContent::NORMAL) else { return Align::Stretch };
    if a == AlignContent::START || a == AlignContent::FLEX_START {
        Align::FlexStart
    } else if a == AlignContent::END || a == AlignContent::FLEX_END {
        Align::FlexEnd
    } else if a == AlignContent::CENTER {
        Align::Center
    } else if a == AlignContent::SPACE_BETWEEN {
        Align::SpaceBetween
    } else if a == AlignContent::SPACE_AROUND {
        Align::SpaceAround
    } else if a == AlignContent::SPACE_EVENLY {
        Align::SpaceEvenly
    } else {
        Align::Stretch
    }
}

fn justify(j: JustifyContent) -> Justify {
    let Some(j) = Some(j).filter(|j| *j != JustifyContent::NORMAL) else { return Justify::FlexStart };
    if j == JustifyContent::END || j == JustifyContent::FLEX_END {
        Justify::FlexEnd
    } else if j == JustifyContent::CENTER {
        Justify::Center
    } else if j == JustifyContent::SPACE_BETWEEN {
        Justify::SpaceBetween
    } else if j == JustifyContent::SPACE_AROUND {
        Justify::SpaceAround
    } else if j == JustifyContent::SPACE_EVENLY {
        Justify::SpaceEvenly
    } else {
        Justify::FlexStart
    }
}

/// O que o pai passa ao estilo do filho (style.ts ParentLayout).
#[derive(Clone, Copy)]
struct Parent {
    row: bool,
    align_items: Align,
    /// A baseline deste contêiner é lida por um ancestral (então a dos filhos também).
    baseline: bool,
}

fn style_of(node: &Node, parent: Option<Parent>) -> yoga::Style {
    let s = &node.style;
    let mut y = yoga::Style {
        dir: match s.flex_direction {
            TFlexDir::Row => yoga::FlexDir::Row,
            TFlexDir::RowReverse => yoga::FlexDir::RowRev,
            TFlexDir::Column => yoga::FlexDir::Col,
            TFlexDir::ColumnReverse => yoga::FlexDir::ColRev,
        },
        wrap: match s.flex_wrap {
            FlexWrap::NoWrap => Wrap::NoWrap,
            FlexWrap::Wrap => Wrap::Wrap,
            FlexWrap::WrapReverse => Wrap::WrapReverse,
            _ => Wrap::Wrap,
        },
        justify: justify(s.justify_content),
        align_items: align(Some(s.align_items), Align::Stretch),
        align_self: align(s.align_self, Align::Auto),
        align_content: align_content(s.align_content),
        absolute: s.position == Position::Absolute,
        display_none: s.display == Display::None,
        // O pptsx só passa os insets escritos (auto = ausente).
        inset: [lpa(s.inset.left), lpa(s.inset.top), lpa(s.inset.right), lpa(s.inset.bottom)].map(|l| if l == Len::Auto { Len::Undef } else { l }),
        margin: [lpa(s.margin.left), lpa(s.margin.top), lpa(s.margin.right), lpa(s.margin.bottom)],
        padding: [lp(s.padding.left), lp(s.padding.top), lp(s.padding.right), lp(s.padding.bottom)],
        border: [pt(s.border.left), pt(s.border.top), pt(s.border.right), pt(s.border.bottom)],
        gap: [lp(s.gap.width), lp(s.gap.height)],
        grow: s.flex_grow,
        shrink: s.flex_shrink,
        basis: Len::Auto,
        dim: [dimension(s.size.width), dimension(s.size.height)],
        // O modelo põe mínimo 0 em todo item (Yoga): no Yoga é o mesmo que não ter mínimo.
        min: [lpa(s.min_size.width), lpa(s.min_size.height)].map(|l| if matches!(l, Len::Auto | Len::Pt(0.0)) { Len::Undef } else { l }),
        max: [lpa(s.max_size.width), lpa(s.max_size.height)].map(|l| if l == Len::Auto { Len::Undef } else { l }),
        aspect: s.aspect_ratio.unwrap_or(f32::NAN),
    };
    // style.ts flexBasisOf: `flex: n` não dá basis 0 a Text/Table numa column.
    let content_leaf = matches!(node.kind, NodeKind::Text(_) | NodeKind::Table(_));
    let in_column = parent.is_some_and(|p| !p.row);
    y.basis = match node.basis {
        Basis::None => Len::Auto,
        Basis::Author(d) => dimension(d),
        Basis::Flex(_) if content_leaf && in_column => Len::Auto,
        Basis::Flex(d) => dimension(d),
    };
    if parent.is_none() {
        y.grow = f32::NAN;
        y.shrink = f32::NAN;
    }
    y
}

fn count_nodes(node: &Node) -> usize {
    1 + if matches!(node.kind, NodeKind::Container | NodeKind::Shape(_)) { node.children.iter().map(count_nodes).sum::<usize>() } else { 0 }
}

struct Builder<'a, 'f> {
    tree: Tree,
    ctx: Ctx<'a, 'f>,
    /// Índice (pré-ordem do slide) do primeiro nó desta árvore (item de grid isolado começa no meio).
    base: usize,
    /// Nó Yoga de cada nó do modelo (pré-ordem local); None = dentro de um grid.
    ids: Vec<Option<usize>>,
}

impl<'a> Builder<'a, '_> {
    fn build(&mut self, node: &'a Node, parent: Option<Parent>) -> usize {
        let local = self.ids.len();
        let index = self.base + local;
        self.ids.push(None);
        let mut style = style_of(node, parent);
        let reads_baseline = parent.is_some_and(|p| p.baseline || (p.row && (if style.align_self == Align::Auto { p.align_items } else { style.align_self }) == Align::Baseline));
        let id;
        match &node.kind {
            NodeKind::Text(t) => {
                let size = crate::layout::effective_size(t, self.ctx.scales.get(&index).copied());
                let runs = crate::layout::runs_of(t, self.ctx.fonts, size / t.size.max(1e-3));
                let lines = crate::layout::max_lines_of(t, self.ctx.scales, index);
                let unbounded = layout_text(self.ctx.fonts, &crate::layout::text_input(t, &runs, size, lines), f32::INFINITY);
                // nowrap numa row: o Yoga não espreme a caixa abaixo da linha (withLineMinWidth).
                // SlideNumber: a caixa tem a largura do pior caso ("88 / 88") em qualquer pai.
                if t.nowrap && (parent.is_some_and(|p| p.row) || t.sample.is_some()) {
                    let sample = t.sample.as_ref().map(|text| vec![RunInput::plain(text.clone(), runs.first().map_or(0, |r| r.face))]);
                    let line = match &sample {
                        Some(sr) => layout_text(self.ctx.fonts, &crate::layout::text_input(t, sr, size, lines), f32::INFINITY).width,
                        None => unbounded.width,
                    };
                    let horizontal = style.border[yoga::LEFT] + style.border[yoga::RIGHT] + [style.padding[yoga::LEFT], style.padding[yoga::RIGHT]].iter().map(|p| if let Len::Pt(v) = p { *v } else { 0.0 }).sum::<f32>();
                    let author = if let Len::Pt(v) = style.min[0] { v } else { 0.0 };
                    style.min[0] = Len::Pt(author.max(line + horizontal));
                    if t.sample.is_some() && style.dim[0] == Len::Auto {
                        style.dim[0] = Len::Pt(line + horizontal);
                    }
                }
                let top = style.border[yoga::TOP] + if let Len::Pt(v) = style.padding[yoga::TOP] { v } else { 0.0 };
                id = self.tree.add(style);
                self.tree.nodes[id].has_measure = true;
                self.tree.nodes[id].has_baseline = reads_baseline;
                self.ctx.leaves.insert(id, Leaf::Text { spec: t, runs, size, lines, baseline: reads_baseline.then_some(top + unbounded.line.ascent) });
            }
            NodeKind::Table(t) => {
                id = self.tree.add(style);
                self.tree.nodes[id].has_measure = true;
                let scaled = crate::layout::scaled_table(t, self.ctx.scales.get(&index).copied());
                self.ctx.leaves.insert(id, Leaf::Table(scaled));
            }
            _ if node.style.display == Display::Grid => {
                id = self.tree.add(style);
                self.tree.nodes[id].has_measure = true;
                self.ctx.leaves.insert(id, Leaf::Grid { node, base: index });
                // Os descendentes não entram nesta árvore: cada item ganha a sua, do tamanho da área.
                for _ in 1..count_nodes(node) {
                    self.ids.push(None);
                }
            }
            NodeKind::Container | NodeKind::Shape(_) => {
                let me = Parent { row: matches!(style.dir, yoga::FlexDir::Row | yoga::FlexDir::RowRev), align_items: style.align_items, baseline: reads_baseline };
                id = self.tree.add(style);
                for child in &node.children {
                    let c = self.build(child, Some(me));
                    self.tree.append(id, c);
                }
            }
            _ => {
                id = self.tree.add(style);
            }
        }
        self.ids[local] = Some(id);
        id
    }
}

fn box_of(t: &Tree, id: usize) -> NodeBox {
    let l = &t.nodes[id].layout;
    let trbl = |a: [f32; 4]| [a[yoga::TOP], a[yoga::RIGHT], a[yoga::BOTTOM], a[yoga::LEFT]];
    NodeBox { x: l.position[yoga::LEFT], y: l.position[yoga::TOP], w: l.dims[0], h: l.dims[1], padding: trbl(l.padding), border: trbl(l.border), margin: trbl(l.margin), cell: None }
}

/// Caixas em pré-ordem a partir de `node`, lidas da árvore `b` (`local` = posição em `b.ids`).
fn read(b: &Builder, node: &Node, local: &mut usize, fonts: &Fonts, scales: &Scales, out: &mut Vec<NodeBox>) {
    let id = b.ids[*local].expect("nó Yoga");
    let index = b.base + *local;
    *local += 1;
    let own = box_of(&b.tree, id);
    out.push(own);
    if node.style.display == Display::Grid {
        // grid-layout.ts: a grade com a caixa final decide as áreas; cada item é uma árvore Yoga
        // do tamanho da sua área (placeInArea). Os descendentes não estão em `b`.
        let skip = count_nodes(node) - 1;
        grid_children(node, index, own, fonts, scales, out);
        *local += skip;
        return;
    }
    if matches!(node.kind, NodeKind::Container | NodeKind::Shape(_)) {
        for child in &node.children {
            read(b, child, local, fonts, scales, out);
        }
    }
}

fn place_align(a: Option<AlignItems>) -> Option<&'static str> {
    let a = a.filter(|a| *a != AlignItems::NORMAL)?;
    Some(if a == AlignItems::START || a == AlignItems::FLEX_START || a == AlignItems::SELF_START {
        "start"
    } else if a == AlignItems::END || a == AlignItems::FLEX_END || a == AlignItems::SELF_END {
        "end"
    } else if a == AlignItems::CENTER {
        "center"
    } else if a == AlignItems::BASELINE {
        "baseline"
    } else {
        "stretch"
    })
}

// ───────────── grid (grid-layout.ts + intrinsic.ts) ─────────────

use crate::grid::{self, Area, Breadth, Contribution, LineSpec, PlacementInput, SizingItem, TrackSize};

fn breadth_of(raw: taffy::CompactLength) -> Breadth {
    match raw.tag() {
        taffy::CompactLength::LENGTH_TAG => Breadth::Fixed(raw.value()),
        taffy::CompactLength::PERCENT_TAG => Breadth::Percent(raw.value() * 100.0),
        taffy::CompactLength::FR_TAG => Breadth::Fr(raw.value()),
        taffy::CompactLength::MIN_CONTENT_TAG => Breadth::MinContent,
        taffy::CompactLength::MAX_CONTENT_TAG => Breadth::MaxContent,
        _ => Breadth::Auto,
    }
}

fn track_of(t: &TrackSizingFunction) -> TrackSize {
    TrackSize { min: breadth_of(t.min.into_raw()), max: breadth_of(t.max.into_raw()) }
}

fn explicit_tracks(list: &[GridTemplateComponent<String>]) -> Vec<TrackSize> {
    list.iter()
        .flat_map(|c| match c {
            GridTemplateComponent::Single(t) => vec![track_of(t)],
            GridTemplateComponent::Repeat(r) => {
                let count = match r.count {
                    RepetitionCount::Count(n) => n as usize,
                    _ => 1,
                };
                let inner: Vec<TrackSize> = r.tracks.iter().map(track_of).collect();
                (0..count).flat_map(|_| inner.clone()).collect()
            }
        })
        .collect()
}

fn line_spec(p: &GridPlacement) -> LineSpec {
    match p {
        GridPlacement::Line(l) => LineSpec::Line(i32::from(l.as_i16())),
        GridPlacement::Span(n) => LineSpec::Span(usize::from(*n)),
        // Linhas nomeadas não existem no subconjunto do pptsx.
        _ => LineSpec::Auto,
    }
}

fn margin_pt(l: LengthPercentageAuto) -> f32 {
    match lpa(l) {
        Len::Pt(v) => v,
        _ => 0.0,
    }
}

fn horizontal_margin(node: &Node) -> f32 {
    margin_pt(node.style.margin.left) + margin_pt(node.style.margin.right)
}

fn vertical_margin(node: &Node) -> f32 {
    margin_pt(node.style.margin.top) + margin_pt(node.style.margin.bottom)
}

/// Borda + padding horizontais (intrinsic.ts horizontalBoxOf).
fn horizontal_box(node: &Node) -> f32 {
    pt(node.style.border.left) + pt(node.style.border.right) + pt(node.style.padding.left) + pt(node.style.padding.right)
}

fn is_image(node: &Node) -> bool {
    matches!(node.kind, NodeKind::Image(_))
}

/// `normal` estica item comum e alinha no início elemento substituído (Image); o alinhamento do
/// contêiner chega já resolvido (grid-layout.ts justifyOf / alignOf / stretchesInline).
fn justify_of(child: &Node, container: &Node) -> &'static str {
    place_align(child.style.justify_self).or_else(|| place_align(Some(container.style.justify_items))).unwrap_or(if is_image(child) { "start" } else { "stretch" })
}

fn align_of(child: &Node, container: &Node) -> &'static str {
    match place_align(child.style.align_self) {
        Some(a) => a,
        None => {
            let c = place_align(Some(container.style.align_items)).unwrap_or("stretch");
            if is_image(child) && c == "stretch" { "start" } else { c }
        }
    }
}

fn stretches_inline(child: &Node, container: &Node) -> bool {
    let auto_margin = lpa(child.style.margin.left) == Len::Auto || lpa(child.style.margin.right) == Len::Auto;
    justify_of(child, container) == "stretch" && dimension(child.style.size.width) == Len::Auto && !auto_margin
}

/// Árvore Yoga descartável com um único item (grid-layout.ts withIsolated): raiz com `root`,
/// o item construído como filho, `adjust` no estilo dele, layout no tamanho dado.
#[allow(clippy::too_many_arguments)]
fn isolated<'a, 'f>(child: &'a Node, child_index: usize, fonts: &'f Fonts, scales: &'f Scales, root: yoga::Style, parent: Parent, size: (f32, f32), adjust: impl FnOnce(&mut yoga::Style)) -> (Builder<'a, 'f>, usize, usize) {
    let mut b = Builder { tree: Tree::new(), ctx: Ctx { fonts, scales, leaves: HashMap::new() }, base: child_index, ids: Vec::new() };
    let root_id = b.tree.add(root);
    let item = b.build(child, Some(parent));
    b.tree.append(root_id, item);
    adjust(&mut b.tree.nodes[item].style);
    let mut tree = std::mem::replace(&mut b.tree, Tree::new());
    tree.calculate(root_id, size.0, size.1, &mut b.ctx);
    b.tree = tree;
    (b, root_id, item)
}

/// Largura max-content (border-box): o item sozinho, sem limite de largura.
fn max_content_width(child: &Node, child_index: usize, fonts: &Fonts, scales: &Scales) -> f32 {
    let root = yoga::Style { dir: yoga::FlexDir::Col, align_items: Align::FlexStart, ..yoga::Style::default() };
    let parent = Parent { row: false, align_items: Align::FlexStart, baseline: false };
    let (b, _, item) = isolated(child, child_index, fonts, scales, root, parent, (f32::NAN, f32::NAN), |_| {});
    b.tree.nodes[item].layout.dims[0]
}

/// Altura (com margens) do item numa área de largura `width`, como ele vai ficar na célula.
fn height_in(child: &Node, child_index: usize, width: f32, container: &Node, fonts: &Fonts, scales: &Scales) -> f32 {
    let align = if stretches_inline(child, container) { Align::Stretch } else { Align::FlexStart };
    let root = yoga::Style { dim: [Len::Pt(width), Len::Auto], dir: yoga::FlexDir::Col, align_items: align, ..yoga::Style::default() };
    let parent = Parent { row: false, align_items: align, baseline: false };
    let (b, _, item) = isolated(child, child_index, fonts, scales, root, parent, (width, f32::NAN), |st| {
        st.grow = 0.0;
        st.shrink = 0.0;
    });
    b.tree.nodes[item].layout.dims[1] + vertical_margin(child)
}

fn clamp_width(value: f32, node: &Node) -> f32 {
    let min = if let Len::Pt(v) = lpa(node.style.min_size.width) { v } else { 0.0 };
    let max = if let Len::Pt(v) = lpa(node.style.max_size.width) { v } else { f32::INFINITY };
    value.min(max).max(min)
}

/// Largura min-content (CSS Sizing §5) de uma subárvore (intrinsic.ts minContentWidthOf): Text é
/// o maior trecho indivisível (com a folga do textSafety); Box row sem wrap soma os filhos, os
/// outros pegam o maior; grid aninhado é a própria grade sem espaço; width numérica vence;
/// Image/Shape/Chart sem width = 0 (como `max-width: 100%`).
fn min_content_width(node: &Node, index: usize, fonts: &Fonts, scales: &Scales) -> f32 {
    if let Len::Pt(w) = dimension(node.style.size.width) {
        return w;
    }
    let bx = horizontal_box(node);
    let inner = match &node.kind {
        NodeKind::Text(t) => {
            let size = crate::layout::effective_size(t, scales.get(&index).copied());
            let runs = crate::layout::runs_of(t, fonts, size / t.size.max(1e-3));
            let lines = crate::layout::max_lines_of(t, scales, index);
            let laid = layout_text(fonts, &crate::layout::text_input(t, &runs, size, lines), f32::INFINITY);
            if t.nowrap { laid.width } else { laid.widest_segment / fonts.options.safety }
        }
        NodeKind::Table(t) => crate::objects::min_content_width(&crate::layout::scaled_table(t, scales.get(&index).copied()), fonts),
        NodeKind::Container | NodeKind::Shape(_) => {
            if node.style.display == Display::Grid {
                let model = grid_model(node, index, fonts, scales, Some(0.0), None);
                crate::grid::total_of(&model.columns, model.column_gap)
            } else {
                let mut child_index = index + 1;
                let mut widths = Vec::new();
                for child in &node.children {
                    if !child.absolute {
                        widths.push(min_content_width(child, child_index, fonts, scales) + horizontal_margin(child));
                    }
                    child_index += count_nodes(child);
                }
                let row = node.style.display != Display::Block && matches!(node.style.flex_direction, TFlexDir::Row | TFlexDir::RowReverse);
                if row && node.style.flex_wrap == FlexWrap::NoWrap {
                    widths.iter().sum::<f32>() + pt(node.style.gap.width) * (widths.len() as f32 - 1.0).max(0.0)
                } else {
                    widths.into_iter().fold(0.0, f32::max)
                }
            }
        }
        _ => 0.0,
    };
    clamp_width(inner + bx, node)
}

/// Contribuição mínima na largura (CSS Grid §11.5 / §6.6): o min-content só vale com `min-width: auto`;
/// com `minWidth` numérico e largura não fixa, o mínimo é o próprio minWidth (`minWidth={0}` deixa
/// a trilha `1fr` encolher abaixo do conteúdo).
fn min_contribution(child: &Node, child_index: usize, fonts: &Fonts, scales: &Scales) -> f32 {
    match (dimension(child.style.size.width), lpa(child.style.min_size.width)) {
        (Len::Pt(_), _) => min_content_width(child, child_index, fonts, scales),
        (_, Len::Pt(min)) => min,
        _ => min_content_width(child, child_index, fonts, scales),
    }
}

struct GridModel {
    columns: Vec<f32>,
    rows: Vec<f32>,
    /// Uma área por filho em fluxo, na ordem dos filhos (None = absoluto).
    areas: Vec<Option<Area>>,
    column_gap: f32,
    row_gap: f32,
}

/// Dimensiona a grade (grid-layout.ts gridModelOf): placement, colunas (com `width` disponível
/// ou indefinida) e depois as linhas, com a altura de cada item medida na largura da sua área
/// (§11.1: colunas primeiro).
fn grid_model(node: &Node, index: usize, fonts: &Fonts, scales: &Scales, width: Option<f32>, height: Option<f32>) -> GridModel {
    let s = &node.style;
    let (column_gap, row_gap) = (pt(s.gap.width), pt(s.gap.height));
    let mut child_index = index + 1;
    let mut items: Vec<(&Node, usize)> = Vec::new();
    for child in &node.children {
        if !child.absolute {
            items.push((child, child_index));
        }
        child_index += count_nodes(child);
    }
    let explicit_columns = explicit_tracks(&s.grid_template_columns);
    let explicit_rows = explicit_tracks(&s.grid_template_rows);
    let placement: Vec<PlacementInput> = items
        .iter()
        .map(|(c, _)| PlacementInput { column: (line_spec(&c.style.grid_column.start), line_spec(&c.style.grid_column.end)), row: (line_spec(&c.style.grid_row.start), line_spec(&c.style.grid_row.end)) })
        .collect();
    let placed = grid::place_items(&placement, explicit_columns.len(), explicit_rows.len());
    let auto_columns: Vec<TrackSize> = s.grid_auto_columns.iter().map(track_of).collect();
    let auto_rows: Vec<TrackSize> = s.grid_auto_rows.iter().map(track_of).collect();
    let column_tracks = grid::tracks_for(&explicit_columns, &auto_columns, placed.columns);
    let row_tracks = grid::tracks_for(&explicit_rows, &auto_rows, placed.rows);
    let column_items: Vec<SizingItem> = items
        .iter()
        .zip(&placed.areas)
        .map(|((child, ci), area)| {
            let margin = horizontal_margin(child);
            let min = min_contribution(child, *ci, fonts, scales) + margin;
            let max = min.max(max_content_width(child, *ci, fonts, scales) + margin);
            SizingItem { start: area.column_start, end: area.column_end, contribution: Contribution { min, max } }
        })
        .collect();
    let columns = grid::size_tracks(&column_tracks, &column_items, width, column_gap);
    let zero_rows = vec![0.0; row_tracks.len()];
    let row_items: Vec<SizingItem> = items
        .iter()
        .zip(&placed.areas)
        .map(|((child, ci), area)| {
            let (_, _, area_width, _) = grid::area_rect(*area, &columns, &zero_rows, column_gap, 0.0);
            let item_height = height_in(child, *ci, (area_width - horizontal_margin(child)).max(0.0), node, fonts, scales);
            SizingItem { start: area.row_start, end: area.row_end, contribution: Contribution { min: item_height, max: item_height } }
        })
        .collect();
    let rows = grid::size_tracks(&row_tracks, &row_items, height, row_gap);
    let mut areas = Vec::with_capacity(node.children.len());
    let mut k = 0;
    for child in &node.children {
        if child.absolute {
            areas.push(None);
        } else {
            areas.push(Some(placed.areas[k]));
            k += 1;
        }
    }
    GridModel { columns, rows, areas, column_gap, row_gap }
}

/// Itens do grid: a grade com a caixa final decide as áreas; cada item é uma árvore Yoga do
/// tamanho da sua área (placeInArea); absolutos pela caixa de padding do contêiner (placeAbsolute).
fn grid_children(node: &Node, index: usize, own: NodeBox, fonts: &Fonts, scales: &Scales, out: &mut Vec<NodeBox>) {
    // NodeBox: padding/border em [top, right, bottom, left].
    let (content_x, content_y) = (own.border[3] + own.padding[3], own.border[0] + own.padding[0]);
    let content_w = (own.w - own.border[1] - own.border[3] - own.padding[1] - own.padding[3]).max(0.0);
    let content_h = (own.h - own.border[0] - own.border[2] - own.padding[0] - own.padding[2]).max(0.0);
    let model = grid_model(node, index, fonts, scales, Some(content_w), Some(content_h));
    let mut child_index = index + 1;
    for (child, area) in node.children.iter().zip(&model.areas) {
        match area {
            Some(area) => {
                let (rx, ry, rw, rh) = grid::area_rect(*area, &model.columns, &model.rows, model.column_gap, model.row_gap);
                let area = Frame { x: content_x + rx, y: content_y + ry, w: rw, h: rh };
                let justify = justify_of(child, node);
                let align = align_of(child, node);
                let stretch = stretches_inline(child, node);
                let root_style = yoga::Style {
                    dim: [Len::Pt(area.w), Len::Pt(area.h)],
                    dir: yoga::FlexDir::Row,
                    justify: match justify {
                        "center" => Justify::Center,
                        "end" => Justify::FlexEnd,
                        _ => Justify::FlexStart,
                    },
                    align_items: match align {
                        "center" => Align::Center,
                        "end" => Align::FlexEnd,
                        "stretch" => Align::Stretch,
                        _ => Align::FlexStart,
                    },
                    ..yoga::Style::default()
                };
                let parent = Parent { row: true, align_items: root_style.align_items, baseline: false };
                let (b, _, _) = isolated(child, child_index, fonts, scales, root_style, parent, (area.w, area.h), |st| {
                    if stretch {
                        st.grow = 1.0;
                        st.shrink = 1.0;
                        st.basis = Len::Pt(0.0);
                        // Proporção esticada: o maxHeight vira maxWidth (transferredMaxWidthOf).
                        if !st.aspect.is_nan() {
                            let max_h = match st.max[1] {
                                Len::Pt(v) => Some(v),
                                Len::Pct(p) => Some(p * area.h * 0.01),
                                _ => None,
                            };
                            if let Some(mh) = max_h {
                                let own_max = match st.max[0] {
                                    Len::Pt(v) => v,
                                    Len::Pct(p) => p * area.w * 0.01,
                                    _ => f32::INFINITY,
                                };
                                st.max[0] = Len::Pt(own_max.min(mh * st.aspect));
                            }
                        }
                    } else {
                        st.grow = 0.0;
                        st.shrink = 0.0;
                        st.basis = Len::Auto;
                    }
                });
                let mut items = Vec::new();
                let mut local = 0;
                read(&b, child, &mut local, fonts, scales, &mut items);
                if let Some(first) = items.first_mut() {
                    first.x += area.x;
                    first.y += area.y;
                    first.cell = Some(area);
                }
                out.extend(items);
            }
            None => {
                // Absoluto num grid: posicionado pela caixa de padding do contêiner.
                let (pw, ph) = ((own.w - own.border[1] - own.border[3]).max(0.0), (own.h - own.border[0] - own.border[2]).max(0.0));
                let root_style = yoga::Style { dim: [Len::Pt(pw), Len::Pt(ph)], dir: yoga::FlexDir::Col, ..yoga::Style::default() };
                let parent = Parent { row: false, align_items: Align::Stretch, baseline: false };
                let (b, _, _) = isolated(child, child_index, fonts, scales, root_style, parent, (pw, ph), |st| st.absolute = true);
                let mut items = Vec::new();
                let mut local = 0;
                read(&b, child, &mut local, fonts, scales, &mut items);
                if let Some(first) = items.first_mut() {
                    first.x += own.border[3];
                    first.y += own.border[0];
                }
                out.extend(items);
            }
        }
        child_index += count_nodes(child);
    }
}

/// Caixas em pré-ordem do slide pelo motor Yoga.
pub fn boxes(slide: &SlideSpec, fonts: &Fonts, scales: &Scales) -> Vec<NodeBox> {
    let mut b = Builder { tree: Tree::new(), ctx: Ctx { fonts, scales, leaves: HashMap::new() }, base: 0, ids: Vec::new() };
    let root = b.build(&slide.root, None);
    let (w, h) = (slide.root.style.size.width, slide.root.style.size.height);
    let size = |d: Dimension| if let Len::Pt(v) = dimension(d) { v } else { f32::NAN };
    let (sw, sh) = (size(w), size(h));
    let mut tree = std::mem::replace(&mut b.tree, Tree::new());
    tree.calculate(root, sw, sh, &mut b.ctx);
    b.tree = tree;
    let mut out = Vec::new();
    let mut local = 0;
    read(&b, &slide.root, &mut local, fonts, scales, &mut out);
    let _ = Frame::default();
    out
}
