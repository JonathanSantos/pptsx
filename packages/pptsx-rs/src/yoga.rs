//! Port do algoritmo de flexbox do Yoga 3.2.1 (algorithm/CalculateLayout.cpp, FlexLine.cpp,
//! AbsoluteLayout.cpp, Baseline.cpp, Cache.cpp e os trechos de Node/Style que eles usam), na
//! configuração do pptsx: `useWebDefaults(true)` (row, alignContent stretch, flexShrink 1),
//! `pointScaleFactor(0)` (sem arredondamento), sem errata, direção LTR. Os nomes e a ordem das
//! contas seguem o C++ de propósito: a paridade com o pptsx depende de cada detalhe (o Yoga não é
//! o CSS: espreme o contêiner automático ao espaço disponível, não tem min-size automático…).
//! Indefinido é NaN, como o `YGUndefined` do Yoga; `f32::max`/`min` já são o maxOrDefined/minOrDefined.

// Port fiel ao C++: nomes de variantes (NoWrap/Wrap/WrapReverse), assinaturas longas e as
// comparações negadas (`!(a < b)` é verdadeiro com NaN, o YGUndefined) seguem o Yoga de propósito.
#![allow(clippy::enum_variant_names, clippy::too_many_arguments, clippy::neg_cmp_op_on_partial_ord)]

pub const LEFT: usize = 0;
pub const TOP: usize = 1;
pub const RIGHT: usize = 2;
pub const BOTTOM: usize = 3;
const UNDEF: f32 = f32::NAN;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FlexDir {
    Row,
    RowRev,
    Col,
    ColRev,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Justify {
    FlexStart,
    Center,
    FlexEnd,
    SpaceBetween,
    SpaceAround,
    SpaceEvenly,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Align {
    Auto,
    FlexStart,
    Center,
    FlexEnd,
    Stretch,
    Baseline,
    SpaceBetween,
    SpaceAround,
    SpaceEvenly,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Wrap {
    NoWrap,
    Wrap,
    WrapReverse,
}

/// SizingMode do Yoga (MaxContent = Undefined, FitContent = AtMost, StretchFit = Exactly).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mode {
    MaxContent,
    FitContent,
    StretchFit,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Len {
    Undef,
    Auto,
    Pt(f32),
    Pct(f32),
}

impl Len {
    fn resolve(self, reference: f32) -> f32 {
        match self {
            Len::Pt(v) => v,
            Len::Pct(p) => p * reference * 0.01,
            _ => UNDEF,
        }
    }

    fn is_defined(self) -> bool {
        self != Len::Undef
    }

    fn is_auto(self) -> bool {
        self == Len::Auto
    }
}

#[derive(Clone, Debug)]
pub struct Style {
    pub dir: FlexDir,
    pub wrap: Wrap,
    pub justify: Justify,
    pub align_items: Align,
    pub align_self: Align,
    pub align_content: Align,
    pub absolute: bool,
    pub display_none: bool,
    /// left, top, right, bottom
    pub inset: [Len; 4],
    pub margin: [Len; 4],
    pub padding: [Len; 4],
    pub border: [f32; 4],
    /// [column gap (eixo row), row gap (eixo column)]
    pub gap: [Len; 2],
    /// NaN = não definido (o Yoga resolve o padrão).
    pub grow: f32,
    pub shrink: f32,
    pub basis: Len,
    /// [width, height]
    pub dim: [Len; 2],
    pub min: [Len; 2],
    pub max: [Len; 2],
    pub aspect: f32,
}

impl Default for Style {
    /// Os padrões web do Yoga (useWebDefaults).
    fn default() -> Self {
        Style {
            dir: FlexDir::Row,
            wrap: Wrap::NoWrap,
            justify: Justify::FlexStart,
            align_items: Align::Stretch,
            align_self: Align::Auto,
            align_content: Align::Stretch,
            absolute: false,
            display_none: false,
            inset: [Len::Undef; 4],
            margin: [Len::Undef; 4],
            padding: [Len::Undef; 4],
            border: [0.0; 4],
            gap: [Len::Undef; 2],
            grow: UNDEF,
            shrink: UNDEF,
            basis: Len::Auto,
            dim: [Len::Auto; 2],
            min: [Len::Undef; 2],
            max: [Len::Undef; 2],
            aspect: UNDEF,
        }
    }
}

#[derive(Clone, Copy, Default)]
struct Entry {
    aw: f32,
    ah: f32,
    wm: Option<Mode>,
    hm: Option<Mode>,
    cw: f32,
    ch: f32,
}

#[derive(Clone)]
pub struct Layout {
    pub position: [f32; 4],
    pub dims: [f32; 2],
    pub measured: [f32; 2],
    pub margin: [f32; 4],
    pub border: [f32; 4],
    pub padding: [f32; 4],
    flex_basis: f32,
    flex_basis_gen: u32,
    line: usize,
    generation: u32,
    cached_layout: Option<Entry>,
    measures: Vec<Entry>,
    next_measure: usize,
}

impl Default for Layout {
    fn default() -> Self {
        Layout {
            position: [0.0; 4],
            dims: [UNDEF; 2],
            measured: [UNDEF; 2],
            margin: [0.0; 4],
            border: [0.0; 4],
            padding: [0.0; 4],
            flex_basis: UNDEF,
            flex_basis_gen: 0,
            line: 0,
            generation: 0,
            cached_layout: None,
            measures: Vec::new(),
            next_measure: 0,
        }
    }
}

pub struct Node {
    pub style: Style,
    pub children: Vec<usize>,
    pub parent: Option<usize>,
    pub has_measure: bool,
    pub has_baseline: bool,
    pub reference_baseline: bool,
    pub layout: Layout,
    processed: [Len; 2],
    dirty: bool,
}

/// O que o pptsx mede fora do Yoga: texto, tabela, grid (e a baseline do texto).
pub trait Measurer {
    /// Tamanho do conteúdo (sem padding/borda), como a measure function do Yoga.
    fn measure(&mut self, node: usize, width: f32, width_mode: Mode, height: f32, height_mode: Mode) -> (f32, f32);
    fn baseline(&mut self, node: usize, width: f32, height: f32) -> f32;
}

pub struct Tree {
    pub nodes: Vec<Node>,
    generation: u32,
}

// ───────────── eixos e bordas ─────────────

fn is_row(d: FlexDir) -> bool {
    matches!(d, FlexDir::Row | FlexDir::RowRev)
}

fn is_col(d: FlexDir) -> bool {
    !is_row(d)
}

fn dim(axis: FlexDir) -> usize {
    if is_row(axis) { 0 } else { 1 }
}

fn cross_of(main: FlexDir) -> FlexDir {
    if is_col(main) { FlexDir::Row } else { FlexDir::Col }
}

fn flex_start_edge(axis: FlexDir) -> usize {
    match axis {
        FlexDir::Row => LEFT,
        FlexDir::RowRev => RIGHT,
        FlexDir::Col => TOP,
        FlexDir::ColRev => BOTTOM,
    }
}

fn flex_end_edge(axis: FlexDir) -> usize {
    match axis {
        FlexDir::Row => RIGHT,
        FlexDir::RowRev => LEFT,
        FlexDir::Col => BOTTOM,
        FlexDir::ColRev => TOP,
    }
}

fn inline_start_edge(axis: FlexDir) -> usize {
    if is_row(axis) { LEFT } else { TOP }
}

fn inline_end_edge(axis: FlexDir) -> usize {
    if is_row(axis) { RIGHT } else { BOTTOM }
}

fn defined(v: f32) -> bool {
    !v.is_nan()
}

fn inexact_equals(a: f32, b: f32) -> bool {
    if defined(a) && defined(b) {
        return (a - b).abs() < 0.0001;
    }
    a.is_nan() && b.is_nan()
}

fn or_zero(v: f32) -> f32 {
    if v.is_nan() { 0.0 } else { v }
}

// ───────────── Style (style/Style.h) ─────────────

impl Style {
    fn margin_at(&self, edge: usize, width: f32) -> f32 {
        match self.margin[edge] {
            Len::Auto => 0.0,
            other => or_zero(other.resolve(width)),
        }
    }

    fn flex_start_margin(&self, axis: FlexDir, width: f32) -> f32 {
        self.margin_at(flex_start_edge(axis), width)
    }

    fn flex_end_margin(&self, axis: FlexDir, width: f32) -> f32 {
        self.margin_at(flex_end_edge(axis), width)
    }

    fn inline_start_margin(&self, axis: FlexDir, width: f32) -> f32 {
        self.margin_at(inline_start_edge(axis), width)
    }

    fn inline_end_margin(&self, axis: FlexDir, width: f32) -> f32 {
        self.margin_at(inline_end_edge(axis), width)
    }

    fn margin_for_axis(&self, axis: FlexDir, width: f32) -> f32 {
        self.inline_start_margin(axis, width) + self.inline_end_margin(axis, width)
    }

    fn flex_start_margin_is_auto(&self, axis: FlexDir) -> bool {
        self.margin[flex_start_edge(axis)].is_auto()
    }

    fn flex_end_margin_is_auto(&self, axis: FlexDir) -> bool {
        self.margin[flex_end_edge(axis)].is_auto()
    }

    fn padding_at(&self, edge: usize, width: f32) -> f32 {
        or_zero(self.padding[edge].resolve(width)).max(0.0)
    }

    fn border_at(&self, edge: usize) -> f32 {
        self.border[edge].max(0.0)
    }

    fn flex_start_pb(&self, axis: FlexDir, width: f32) -> f32 {
        let e = flex_start_edge(axis);
        self.padding_at(e, width) + self.border_at(e)
    }

    fn flex_end_pb(&self, axis: FlexDir, width: f32) -> f32 {
        let e = flex_end_edge(axis);
        self.padding_at(e, width) + self.border_at(e)
    }

    fn padding_and_border_for_axis(&self, axis: FlexDir, width: f32) -> f32 {
        let (s, e) = (inline_start_edge(axis), inline_end_edge(axis));
        self.padding_at(s, width) + self.border_at(s) + self.padding_at(e, width) + self.border_at(e)
    }

    fn border_for_axis(&self, axis: FlexDir) -> f32 {
        self.border_at(inline_start_edge(axis)) + self.border_at(inline_end_edge(axis))
    }

    fn gap_for_axis(&self, axis: FlexDir, owner: f32) -> f32 {
        let g = if is_row(axis) { self.gap[0] } else { self.gap[1] };
        or_zero(g.resolve(owner)).max(0.0)
    }

    fn position_defined(&self, edge: usize) -> bool {
        self.inset[edge].is_defined()
    }

    fn position_auto(&self, edge: usize) -> bool {
        self.inset[edge].is_auto()
    }

    fn position_at(&self, edge: usize, size: f32) -> f32 {
        or_zero(self.inset[edge].resolve(size))
    }

    fn horizontal_insets_defined(&self) -> bool {
        self.inset[LEFT].is_defined() || self.inset[RIGHT].is_defined()
    }

    fn vertical_insets_defined(&self) -> bool {
        self.inset[TOP].is_defined() || self.inset[BOTTOM].is_defined()
    }

    fn resolved_min(&self, d: usize, reference: f32) -> f32 {
        self.min[d].resolve(reference)
    }

    fn resolved_max(&self, d: usize, reference: f32) -> f32 {
        self.max[d].resolve(reference)
    }
}

fn resolve_child_alignment(node: &Style, child: &Style) -> Align {
    let align = if child.align_self == Align::Auto { node.align_items } else { child.align_self };
    if align == Align::Baseline && is_col(node.dir) {
        return Align::FlexStart;
    }
    align
}

fn fallback_align(a: Align) -> Align {
    match a {
        Align::SpaceBetween | Align::Stretch | Align::SpaceAround | Align::SpaceEvenly => Align::FlexStart,
        other => other,
    }
}

fn fallback_justify(j: Justify) -> Justify {
    match j {
        Justify::SpaceBetween | Justify::SpaceAround | Justify::SpaceEvenly => Justify::FlexStart,
        other => other,
    }
}

struct FlexLine {
    items: Vec<usize>,
    size_consumed: f32,
    auto_margins: usize,
    total_grow: f32,
    total_shrink_scaled: f32,
    remaining: f32,
    main_dim: f32,
    cross_dim: f32,
}

impl Tree {
    pub fn new() -> Self {
        Tree { nodes: Vec::new(), generation: 0 }
    }

    pub fn add(&mut self, style: Style) -> usize {
        self.nodes.push(Node { style, children: Vec::new(), parent: None, has_measure: false, has_baseline: false, reference_baseline: false, layout: Layout::default(), processed: [Len::Auto; 2], dirty: true });
        self.nodes.len() - 1
    }

    pub fn append(&mut self, parent: usize, child: usize) {
        self.nodes[parent].children.push(child);
        self.nodes[child].parent = Some(parent);
    }

    fn st(&self, n: usize) -> &Style {
        &self.nodes[n].style
    }

    fn lay(&mut self, n: usize) -> &mut Layout {
        &mut self.nodes[n].layout
    }

    // ───────────── Node (node/Node.cpp) ─────────────

    fn process_dimensions(&mut self, n: usize) {
        for d in 0..2 {
            let s = &self.nodes[n].style;
            self.nodes[n].processed[d] = if s.max[d].is_defined() && s.max[d] == s.min[d] { s.max[d] } else { s.dim[d] };
        }
    }

    fn has_definite_length(&self, n: usize, d: usize, owner: f32) -> bool {
        let v = self.nodes[n].processed[d].resolve(owner);
        defined(v) && v >= 0.0
    }

    fn resolved_dimension(&self, n: usize, d: usize, reference: f32) -> f32 {
        self.nodes[n].processed[d].resolve(reference)
    }

    fn resolve_flex_grow(&self, n: usize) -> f32 {
        if self.nodes[n].parent.is_none() {
            return 0.0;
        }
        let g = self.st(n).grow;
        if defined(g) { g } else { 0.0 }
    }

    fn resolve_flex_shrink(&self, n: usize) -> f32 {
        if self.nodes[n].parent.is_none() {
            return 0.0;
        }
        let s = self.st(n).shrink;
        if defined(s) { s } else { 1.0 }
    }

    fn is_flexible(&self, n: usize) -> bool {
        !self.st(n).absolute && (self.resolve_flex_grow(n) != 0.0 || self.resolve_flex_shrink(n) != 0.0)
    }

    fn resolve_flex_basis(&self, n: usize, reference: f32) -> f32 {
        self.st(n).basis.resolve(reference)
    }

    fn relative_position(&self, n: usize, axis: FlexDir, size: f32) -> f32 {
        let s = self.st(n);
        let start = inline_start_edge(axis);
        if s.position_defined(start) && !s.position_auto(start) {
            return s.position_at(start, size);
        }
        -s.position_at(inline_end_edge(axis), size)
    }

    fn set_position(&mut self, n: usize, owner_w: f32, owner_h: f32) {
        let main = self.st(n).dir;
        let cross = cross_of(main);
        let rel_main = self.relative_position(n, main, if is_row(main) { owner_w } else { owner_h });
        let rel_cross = self.relative_position(n, cross, if is_row(main) { owner_h } else { owner_w });
        let s = self.st(n).clone();
        let l = self.lay(n);
        l.position[inline_start_edge(main)] = s.inline_start_margin(main, owner_w) + rel_main;
        l.position[inline_end_edge(main)] = s.inline_end_margin(main, owner_w) + rel_main;
        l.position[inline_start_edge(cross)] = s.inline_start_margin(cross, owner_w) + rel_cross;
        l.position[inline_end_edge(cross)] = s.inline_end_margin(cross, owner_w) + rel_cross;
    }

    fn dimension_with_margin(&self, n: usize, axis: FlexDir, width: f32) -> f32 {
        self.nodes[n].layout.measured[dim(axis)] + self.st(n).margin_for_axis(axis, width)
    }

    fn is_layout_dimension_defined(&self, n: usize, axis: FlexDir) -> bool {
        let v = self.nodes[n].layout.measured[dim(axis)];
        defined(v) && v >= 0.0
    }

    // ───────────── BoundAxis.h ─────────────

    fn bound_within_min_max(&self, n: usize, axis: FlexDir, value: f32, axis_size: f32) -> f32 {
        let d = dim(axis);
        let (min, max) = (self.st(n).resolved_min(d, axis_size), self.st(n).resolved_max(d, axis_size));
        if defined(max) && max >= 0.0 && defined(value) && value > max {
            return max;
        }
        if defined(min) && min >= 0.0 && defined(value) && value < min {
            return min;
        }
        value
    }

    fn bound_axis(&self, n: usize, axis: FlexDir, value: f32, axis_size: f32, width: f32) -> f32 {
        self.bound_within_min_max(n, axis, value, axis_size).max(self.st(n).padding_and_border_for_axis(axis, width))
    }

    fn constrain_max_size_for_mode(&self, n: usize, axis: FlexDir, owner_axis: f32, owner_w: f32, mode: &mut Mode, size: &mut f32) {
        let max = self.st(n).resolved_max(dim(axis), owner_axis) + self.st(n).margin_for_axis(axis, owner_w);
        match *mode {
            Mode::StretchFit | Mode::FitContent => {
                if defined(max) && !(*size < max) {
                    *size = max;
                }
            }
            Mode::MaxContent => {
                if defined(max) {
                    *mode = Mode::FitContent;
                    *size = max;
                }
            }
        }
    }

    // ───────────── Baseline.cpp ─────────────

    fn calculate_baseline(&self, n: usize, m: &mut dyn Measurer) -> f32 {
        if self.nodes[n].has_baseline {
            let l = &self.nodes[n].layout;
            return m.baseline(n, l.measured[0], l.measured[1]);
        }
        let mut chosen = None;
        for &c in &self.nodes[n].children {
            if self.nodes[c].layout.line > 0 {
                break;
            }
            if self.st(c).absolute {
                continue;
            }
            if resolve_child_alignment(self.st(n), self.st(c)) == Align::Baseline || self.nodes[c].reference_baseline {
                chosen = Some(c);
                break;
            }
            if chosen.is_none() {
                chosen = Some(c);
            }
        }
        match chosen {
            None => self.nodes[n].layout.measured[1],
            Some(c) => self.calculate_baseline(c, m) + self.nodes[c].layout.position[TOP],
        }
    }

    fn is_baseline_layout(&self, n: usize) -> bool {
        let s = self.st(n);
        if is_col(s.dir) {
            return false;
        }
        if s.align_items == Align::Baseline {
            return true;
        }
        self.nodes[n].children.iter().any(|&c| !self.st(c).absolute && self.st(c).align_self == Align::Baseline)
    }

    // ───────────── medidas ─────────────

    #[allow(clippy::too_many_arguments)]
    fn measure_with_func(&mut self, n: usize, mut aw: f32, mut ah: f32, wm: Mode, hm: Mode, owner_w: f32, owner_h: f32, m: &mut dyn Measurer) {
        if wm == Mode::MaxContent {
            aw = UNDEF;
        }
        if hm == Mode::MaxContent {
            ah = UNDEF;
        }
        let l = &self.nodes[n].layout;
        let pb_row = l.padding[LEFT] + l.padding[RIGHT] + l.border[LEFT] + l.border[RIGHT];
        let pb_col = l.padding[TOP] + l.padding[BOTTOM] + l.border[TOP] + l.border[BOTTOM];
        let inner_w = if aw.is_nan() { aw } else { (aw - pb_row).max(0.0) };
        let inner_h = if ah.is_nan() { ah } else { (ah - pb_col).max(0.0) };
        if wm == Mode::StretchFit && hm == Mode::StretchFit {
            let w = self.bound_axis(n, FlexDir::Row, aw, owner_w, owner_w);
            let h = self.bound_axis(n, FlexDir::Col, ah, owner_h, owner_w);
            self.lay(n).measured = [w, h];
        } else {
            let (mw, mh) = m.measure(n, inner_w, wm, inner_h, hm);
            let w = self.bound_axis(n, FlexDir::Row, if matches!(wm, Mode::MaxContent | Mode::FitContent) { mw + pb_row } else { aw }, owner_w, owner_w);
            let h = self.bound_axis(n, FlexDir::Col, if matches!(hm, Mode::MaxContent | Mode::FitContent) { mh + pb_col } else { ah }, owner_h, owner_w);
            self.lay(n).measured = [w, h];
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn measure_without_children(&mut self, n: usize, aw: f32, ah: f32, wm: Mode, hm: Mode, owner_w: f32, owner_h: f32) {
        let l = self.nodes[n].layout.clone();
        let w = if matches!(wm, Mode::MaxContent | Mode::FitContent) { l.padding[LEFT] + l.padding[RIGHT] + l.border[LEFT] + l.border[RIGHT] } else { aw };
        let h = if matches!(hm, Mode::MaxContent | Mode::FitContent) { l.padding[TOP] + l.padding[BOTTOM] + l.border[TOP] + l.border[BOTTOM] } else { ah };
        let w = self.bound_axis(n, FlexDir::Row, w, owner_w, owner_w);
        let h = self.bound_axis(n, FlexDir::Col, h, owner_h, owner_w);
        self.lay(n).measured = [w, h];
    }

    #[allow(clippy::too_many_arguments)]
    fn measure_with_fixed_size(&mut self, n: usize, aw: f32, ah: f32, wm: Mode, hm: Mode, owner_w: f32, owner_h: f32) -> bool {
        if (defined(aw) && wm == Mode::FitContent && aw <= 0.0) || (defined(ah) && hm == Mode::FitContent && ah <= 0.0) || (wm == Mode::StretchFit && hm == Mode::StretchFit) {
            let w = if aw.is_nan() || (wm == Mode::FitContent && aw < 0.0) { 0.0 } else { aw };
            let h = if ah.is_nan() || (hm == Mode::FitContent && ah < 0.0) { 0.0 } else { ah };
            let w = self.bound_axis(n, FlexDir::Row, w, owner_w, owner_w);
            let h = self.bound_axis(n, FlexDir::Col, h, owner_h, owner_w);
            self.lay(n).measured = [w, h];
            return true;
        }
        false
    }

    fn zero_out(&mut self, n: usize) {
        self.nodes[n].layout = Layout { dims: [0.0, 0.0], ..Layout::default() };
        let kids = self.nodes[n].children.clone();
        for c in kids {
            self.zero_out(c);
        }
    }

    fn available_inner_dimension(&self, n: usize, d: usize, available: f32, pb: f32, owner: f32) -> f32 {
        let mut inner = available - pb;
        if defined(inner) {
            let min = self.st(n).resolved_min(d, owner);
            let min_inner = if min.is_nan() { 0.0 } else { min - pb };
            let max = self.st(n).resolved_max(d, owner);
            let max_inner = if max.is_nan() { f32::MAX } else { max - pb };
            inner = inner.min(max_inner).max(min_inner);
        }
        inner
    }

    // ───────────── flex basis ─────────────

    #[allow(clippy::too_many_arguments)]
    fn compute_flex_basis_for_child(&mut self, n: usize, c: usize, width: f32, wm: Mode, height: f32, owner_w: f32, owner_h: f32, hm: Mode, m: &mut dyn Measurer) {
        let main = self.st(n).dir;
        let main_row = is_row(main);
        let main_size = if main_row { width } else { height };
        let main_owner = if main_row { owner_w } else { owner_h };
        let mut child_w = UNDEF;
        let mut child_h = UNDEF;
        let basis = self.resolve_flex_basis(c, main_owner);
        let row_defined = self.has_definite_length(c, 0, owner_w);
        let col_defined = self.has_definite_length(c, 1, owner_h);
        if defined(basis) && defined(main_size) {
            if self.nodes[c].layout.flex_basis.is_nan() {
                let pb = self.st(c).padding_and_border_for_axis(main, owner_w);
                self.lay(c).flex_basis = basis.max(pb);
            }
        } else if main_row && row_defined {
            let pb = self.st(c).padding_and_border_for_axis(FlexDir::Row, owner_w);
            let v = self.resolved_dimension(c, 0, owner_w).max(pb);
            self.lay(c).flex_basis = v;
        } else if !main_row && col_defined {
            let pb = self.st(c).padding_and_border_for_axis(FlexDir::Col, owner_w);
            let v = self.resolved_dimension(c, 1, owner_h).max(pb);
            self.lay(c).flex_basis = v;
        } else {
            let mut wmode = Mode::MaxContent;
            let mut hmode = Mode::MaxContent;
            let margin_row = self.st(c).margin_for_axis(FlexDir::Row, owner_w);
            let margin_col = self.st(c).margin_for_axis(FlexDir::Col, owner_w);
            if row_defined {
                child_w = self.resolved_dimension(c, 0, owner_w) + margin_row;
                wmode = Mode::StretchFit;
            }
            if col_defined {
                child_h = self.resolved_dimension(c, 1, owner_h) + margin_col;
                hmode = Mode::StretchFit;
            }
            // overflow sempre visible no pptsx: os dois eixos usam o disponível como teto.
            if child_w.is_nan() && defined(width) {
                child_w = width;
                wmode = Mode::FitContent;
            }
            if child_h.is_nan() && defined(height) {
                child_h = height;
                hmode = Mode::FitContent;
            }
            let aspect = self.st(c).aspect;
            if defined(aspect) {
                if !main_row && wmode == Mode::StretchFit {
                    child_h = margin_col + (child_w - margin_row) / aspect;
                    hmode = Mode::StretchFit;
                } else if main_row && hmode == Mode::StretchFit {
                    child_w = margin_row + (child_h - margin_col) * aspect;
                    wmode = Mode::StretchFit;
                }
            }
            let stretch = resolve_child_alignment(self.st(n), self.st(c)) == Align::Stretch;
            let exact_w = defined(width) && wm == Mode::StretchFit;
            if !main_row && !row_defined && exact_w && stretch && wmode != Mode::StretchFit {
                child_w = width;
                wmode = Mode::StretchFit;
                if defined(aspect) {
                    child_h = (child_w - margin_row) / aspect;
                    hmode = Mode::StretchFit;
                }
            }
            let exact_h = defined(height) && hm == Mode::StretchFit;
            if main_row && !col_defined && exact_h && stretch && hmode != Mode::StretchFit {
                child_h = height;
                hmode = Mode::StretchFit;
                if defined(aspect) {
                    child_w = (child_h - margin_col) * aspect;
                    wmode = Mode::StretchFit;
                }
            }
            self.constrain_max_size_for_mode(c, FlexDir::Row, owner_w, owner_w, &mut wmode, &mut child_w);
            self.constrain_max_size_for_mode(c, FlexDir::Col, owner_h, owner_w, &mut hmode, &mut child_h);
            self.layout_internal(c, child_w, child_h, wmode, hmode, owner_w, owner_h, false, m);
            let pb = self.st(c).padding_and_border_for_axis(main, owner_w);
            let v = self.nodes[c].layout.measured[dim(main)].max(pb);
            self.lay(c).flex_basis = v;
        }
        let now = self.generation;
        self.lay(c).flex_basis_gen = now;
    }

    #[allow(clippy::too_many_arguments)]
    fn compute_flex_basis_for_children(&mut self, n: usize, aiw: f32, aih: f32, wm: Mode, hm: Mode, main: FlexDir, perform: bool, m: &mut dyn Measurer) -> f32 {
        let mut total = 0.0;
        let children = self.nodes[n].children.clone();
        let main_mode = if is_row(main) { wm } else { hm };
        let mut single: Option<usize> = None;
        if main_mode == Mode::StretchFit {
            for &c in &children {
                if self.is_flexible(c) {
                    if single.is_some() || inexact_equals(self.resolve_flex_grow(c), 0.0) || inexact_equals(self.resolve_flex_shrink(c), 0.0) {
                        single = None;
                        break;
                    }
                    single = Some(c);
                }
            }
        }
        for &c in &children {
            self.process_dimensions(c);
            if self.st(c).display_none {
                self.zero_out(c);
                self.nodes[c].dirty = false;
                continue;
            }
            if perform {
                self.set_position(c, aiw, aih);
            }
            if self.st(c).absolute {
                continue;
            }
            if Some(c) == single {
                let now = self.generation;
                let l = self.lay(c);
                l.flex_basis_gen = now;
                l.flex_basis = 0.0;
            } else {
                self.compute_flex_basis_for_child(n, c, aiw, wm, aih, aiw, aih, hm, m);
            }
            total += self.nodes[c].layout.flex_basis + self.st(c).margin_for_axis(main, aiw);
        }
        total
    }

    // ───────────── FlexLine.cpp ─────────────

    fn calculate_flex_line(&mut self, n: usize, owner_w: f32, main_owner: f32, aiw: f32, aim: f32, start: &mut usize, line: usize) -> FlexLine {
        let main = self.st(n).dir;
        let wrap = self.st(n).wrap != Wrap::NoWrap;
        let gap = self.st(n).gap_for_axis(main, aim);
        let children = self.nodes[n].children.clone();
        let mut items = Vec::new();
        let (mut consumed, mut consumed_min, mut grow, mut shrink, mut autos) = (0.0f32, 0.0f32, 0.0f32, 0.0f32, 0usize);
        let mut first: Option<usize> = None;
        while *start < children.len() {
            let c = children[*start];
            if self.st(c).display_none || self.st(c).absolute {
                *start += 1;
                continue;
            }
            if first.is_none() {
                first = Some(c);
            }
            if self.st(c).flex_start_margin_is_auto(main) {
                autos += 1;
            }
            if self.st(c).flex_end_margin_is_auto(main) {
                autos += 1;
            }
            self.lay(c).line = line;
            let margin = self.st(c).margin_for_axis(main, aiw);
            let leading_gap = if Some(c) == first { 0.0 } else { gap };
            let basis = self.bound_within_min_max(c, main, self.nodes[c].layout.flex_basis, main_owner);
            if consumed_min + basis + margin + leading_gap > aim && wrap && !items.is_empty() {
                break;
            }
            consumed_min += basis + margin + leading_gap;
            consumed += basis + margin + leading_gap;
            if self.is_flexible(c) {
                grow += self.resolve_flex_grow(c);
                shrink += -self.resolve_flex_shrink(c) * self.nodes[c].layout.flex_basis;
            }
            items.push(c);
            *start += 1;
        }
        if grow > 0.0 && grow < 1.0 {
            grow = 1.0;
        }
        if shrink > 0.0 && shrink < 1.0 {
            shrink = 1.0;
        }
        let _ = owner_w;
        FlexLine { items, size_consumed: consumed, auto_margins: autos, total_grow: grow, total_shrink_scaled: shrink, remaining: 0.0, main_dim: 0.0, cross_dim: 0.0 }
    }

    // ───────────── resolveFlexibleLength ─────────────

    fn distribute_first_pass(&mut self, line: &mut FlexLine, main: FlexDir, main_owner: f32, aim: f32, aiw: f32) {
        let mut delta = 0.0;
        for &c in &line.items {
            let basis = self.bound_within_min_max(c, main, self.nodes[c].layout.flex_basis, main_owner);
            if line.remaining < 0.0 {
                let factor = -self.resolve_flex_shrink(c) * basis;
                if defined(factor) && factor != 0.0 {
                    let base = basis + line.remaining / line.total_shrink_scaled * factor;
                    let bound = self.bound_axis(c, main, base, aim, aiw);
                    if defined(base) && defined(bound) && base != bound {
                        delta += bound - basis;
                        line.total_shrink_scaled -= -self.resolve_flex_shrink(c) * self.nodes[c].layout.flex_basis;
                    }
                }
            } else if defined(line.remaining) && line.remaining > 0.0 {
                let grow = self.resolve_flex_grow(c);
                if defined(grow) && grow != 0.0 {
                    let base = basis + line.remaining / line.total_grow * grow;
                    let bound = self.bound_axis(c, main, base, aim, aiw);
                    if defined(base) && defined(bound) && base != bound {
                        delta += bound - basis;
                        line.total_grow -= grow;
                    }
                }
            }
        }
        line.remaining -= delta;
    }

    #[allow(clippy::too_many_arguments)]
    fn distribute_second_pass(&mut self, line: &mut FlexLine, n: usize, main: FlexDir, cross: FlexDir, main_owner: f32, aim: f32, aic: f32, aiw: f32, aih: f32, main_overflows: bool, cross_mode: Mode, perform: bool, m: &mut dyn Measurer) -> f32 {
        let main_row = is_row(main);
        let wrap = self.st(n).wrap != Wrap::NoWrap;
        let mut delta = 0.0;
        for i in 0..line.items.len() {
            let c = line.items[i];
            let basis = self.bound_within_min_max(c, main, self.nodes[c].layout.flex_basis, main_owner);
            let mut updated = basis;
            if defined(line.remaining) && line.remaining < 0.0 {
                let factor = -self.resolve_flex_shrink(c) * basis;
                if factor != 0.0 {
                    let size = if defined(line.total_shrink_scaled) && line.total_shrink_scaled == 0.0 { basis + factor } else { basis + (line.remaining / line.total_shrink_scaled) * factor };
                    updated = self.bound_axis(c, main, size, aim, aiw);
                }
            } else if defined(line.remaining) && line.remaining > 0.0 {
                let grow = self.resolve_flex_grow(c);
                if !grow.is_nan() && grow != 0.0 {
                    updated = self.bound_axis(c, main, basis + line.remaining / line.total_grow * grow, aim, aiw);
                }
            }
            delta += updated - basis;
            let margin_main = self.st(c).margin_for_axis(main, aiw);
            let margin_cross = self.st(c).margin_for_axis(cross, aiw);
            let mut child_cross;
            let mut child_main = updated + margin_main;
            let mut cross_mode_c;
            let mut main_mode_c = Mode::StretchFit;
            let aspect = self.st(c).aspect;
            let cs = self.st(c).clone();
            let stretch = resolve_child_alignment(self.st(n), &cs) == Align::Stretch;
            if defined(aspect) {
                child_cross = if main_row { (child_main - margin_main) / aspect } else { (child_main - margin_main) * aspect };
                cross_mode_c = Mode::StretchFit;
                child_cross += margin_cross;
            } else if !aic.is_nan() && !self.has_definite_length(c, dim(cross), aic) && cross_mode == Mode::StretchFit && !(wrap && main_overflows) && stretch && !cs.flex_start_margin_is_auto(cross) && !cs.flex_end_margin_is_auto(cross) {
                child_cross = aic;
                cross_mode_c = Mode::StretchFit;
            } else if !self.has_definite_length(c, dim(cross), aic) {
                child_cross = aic;
                cross_mode_c = if child_cross.is_nan() { Mode::MaxContent } else { Mode::FitContent };
            } else {
                child_cross = self.resolved_dimension(c, dim(cross), aic) + margin_cross;
                let loose_pct = matches!(self.nodes[c].processed[dim(cross)], Len::Pct(_)) && cross_mode != Mode::StretchFit;
                cross_mode_c = if child_cross.is_nan() || loose_pct { Mode::MaxContent } else { Mode::StretchFit };
            }
            self.constrain_max_size_for_mode(c, main, aim, aiw, &mut main_mode_c, &mut child_main);
            self.constrain_max_size_for_mode(c, cross, aic, aiw, &mut cross_mode_c, &mut child_cross);
            let requires_stretch = !self.has_definite_length(c, dim(cross), aic) && stretch && !cs.flex_start_margin_is_auto(cross) && !cs.flex_end_margin_is_auto(cross);
            let (cw, ch) = if main_row { (child_main, child_cross) } else { (child_cross, child_main) };
            let (wmode, hmode) = if main_row { (main_mode_c, cross_mode_c) } else { (cross_mode_c, main_mode_c) };
            let is_layout = perform && !requires_stretch;
            self.layout_internal(c, cw, ch, wmode, hmode, aiw, aih, is_layout, m);
        }
        delta
    }

    // ───────────── justifyMainAxis ─────────────

    #[allow(clippy::too_many_arguments)]
    fn justify_main_axis(&mut self, n: usize, line: &mut FlexLine, main: FlexDir, cross: FlexDir, main_mode: Mode, cross_mode: Mode, main_owner: f32, owner_w: f32, aim: f32, aic: f32, aiw: f32, perform: bool, m: &mut dyn Measurer) {
        let s = self.st(n).clone();
        let lead_pb = s.flex_start_pb(main, owner_w);
        let trail_pb = s.flex_end_pb(main, owner_w);
        let gap = s.gap_for_axis(main, aim);
        if main_mode == Mode::FitContent && line.remaining > 0.0 {
            let min = s.resolved_min(dim(main), main_owner);
            if s.min[dim(main)].is_defined() && defined(min) {
                let min_available = min - lead_pb - trail_pb;
                let occupied = aim - line.remaining;
                line.remaining = (min_available - occupied).max(0.0);
            } else {
                line.remaining = 0.0;
            }
        }
        let mut leading = 0.0;
        let mut between = gap;
        let justify = if line.remaining >= 0.0 { s.justify } else { fallback_justify(s.justify) };
        let count = line.items.len() as f32;
        if line.auto_margins == 0 {
            match justify {
                Justify::Center => leading = line.remaining / 2.0,
                Justify::FlexEnd => leading = line.remaining,
                Justify::SpaceBetween => {
                    if line.items.len() > 1 {
                        between += line.remaining / (count - 1.0);
                    }
                }
                Justify::SpaceEvenly => {
                    leading = line.remaining / (count + 1.0);
                    between += leading;
                }
                Justify::SpaceAround => {
                    leading = 0.5 * line.remaining / count;
                    between += leading * 2.0;
                }
                Justify::FlexStart => {}
            }
        }
        line.main_dim = lead_pb + leading;
        line.cross_dim = 0.0;
        let (mut max_ascent, mut max_descent) = (0.0f32, 0.0f32);
        let baseline_layout = self.is_baseline_layout(n);
        let last = line.items.last().copied();
        for i in 0..line.items.len() {
            let c = line.items[i];
            let cs = self.st(c).clone();
            if cs.flex_start_margin_is_auto(main) && line.remaining > 0.0 {
                line.main_dim += line.remaining / line.auto_margins as f32;
            }
            if perform {
                let edge = flex_start_edge(main);
                let v = self.nodes[c].layout.position[edge] + line.main_dim;
                self.lay(c).position[edge] = v;
            }
            if Some(c) != last {
                line.main_dim += between;
            }
            if cs.flex_end_margin_is_auto(main) && line.remaining > 0.0 {
                line.main_dim += line.remaining / line.auto_margins as f32;
            }
            let can_skip = !perform && cross_mode == Mode::StretchFit;
            if can_skip {
                line.main_dim += cs.margin_for_axis(main, aiw) + self.nodes[c].layout.flex_basis;
                line.cross_dim = aic;
            } else {
                line.main_dim += self.dimension_with_margin(c, main, aiw);
                if baseline_layout {
                    let ascent = self.calculate_baseline(c, m) + cs.flex_start_margin(FlexDir::Col, aiw);
                    let descent = self.nodes[c].layout.measured[1] + cs.margin_for_axis(FlexDir::Col, aiw) - ascent;
                    max_ascent = max_ascent.max(ascent);
                    max_descent = max_descent.max(descent);
                } else {
                    line.cross_dim = line.cross_dim.max(self.dimension_with_margin(c, cross, aiw));
                }
            }
        }
        line.main_dim += trail_pb;
        if baseline_layout {
            line.cross_dim = max_ascent + max_descent;
        }
    }

    // ───────────── calculateLayoutImpl ─────────────

    #[allow(clippy::too_many_arguments)]
    fn layout_impl(&mut self, n: usize, aw: f32, ah: f32, wm: Mode, hm: Mode, owner_w: f32, owner_h: f32, perform: bool, depth: u32, m: &mut dyn Measurer) {
        let s = self.st(n).clone();
        let row = FlexDir::Row;
        let col = FlexDir::Col;
        let margin = [s.inline_start_margin(row, owner_w), s.inline_start_margin(col, owner_w), s.inline_end_margin(row, owner_w), s.inline_end_margin(col, owner_w)];
        let border = [s.border_at(LEFT), s.border_at(TOP), s.border_at(RIGHT), s.border_at(BOTTOM)];
        let padding = [s.padding_at(LEFT, owner_w), s.padding_at(TOP, owner_w), s.padding_at(RIGHT, owner_w), s.padding_at(BOTTOM, owner_w)];
        {
            let l = self.lay(n);
            l.margin = margin;
            l.border = border;
            l.padding = padding;
        }
        let margin_row = margin[LEFT] + margin[RIGHT];
        let margin_col = margin[TOP] + margin[BOTTOM];
        if self.nodes[n].has_measure {
            self.measure_with_func(n, aw - margin_row, ah - margin_col, wm, hm, owner_w, owner_h, m);
            return;
        }
        if self.nodes[n].children.is_empty() {
            self.measure_without_children(n, aw - margin_row, ah - margin_col, wm, hm, owner_w, owner_h);
            return;
        }
        if !perform && self.measure_with_fixed_size(n, aw - margin_row, ah - margin_col, wm, hm, owner_w, owner_h) {
            return;
        }
        // STEP 1
        let main = s.dir;
        let cross = cross_of(main);
        let main_row = is_row(main);
        let wrap = s.wrap != Wrap::NoWrap;
        let main_owner = if main_row { owner_w } else { owner_h };
        let cross_owner = if main_row { owner_h } else { owner_w };
        let pb_main = s.padding_and_border_for_axis(main, owner_w);
        let pb_cross = s.padding_and_border_for_axis(cross, owner_w);
        let lead_pb_cross = s.flex_start_pb(cross, owner_w);
        let mut main_mode = if main_row { wm } else { hm };
        let cross_mode = if main_row { hm } else { wm };
        let pb_row = if main_row { pb_main } else { pb_cross };
        let pb_col = if main_row { pb_cross } else { pb_main };
        // STEP 2
        let aiw = self.available_inner_dimension(n, 0, aw - margin_row, pb_row, owner_w);
        let aih = self.available_inner_dimension(n, 1, ah - margin_col, pb_col, owner_h);
        let mut aim = if main_row { aiw } else { aih };
        let aic = if main_row { aih } else { aiw };
        // STEP 3
        let mut total_main = self.compute_flex_basis_for_children(n, aiw, aih, wm, hm, main, perform, m);
        let child_count = self.nodes[n].children.len();
        if child_count > 1 {
            total_main += s.gap_for_axis(main, aim) * (child_count - 1) as f32;
        }
        let main_overflows = main_mode != Mode::MaxContent && total_main > aim;
        if wrap && main_overflows && main_mode == Mode::FitContent {
            main_mode = Mode::StretchFit;
        }
        // STEP 4
        let mut start = 0;
        let mut line_count = 0usize;
        let mut total_line_cross = 0.0f32;
        let cross_gap = s.gap_for_axis(cross, aic);
        let mut max_line_main = 0.0f32;
        while start < child_count {
            let mut line = self.calculate_flex_line(n, owner_w, main_owner, aiw, aim, &mut start, line_count);
            let can_skip = !perform && cross_mode == Mode::StretchFit;
            // STEP 5
            let mut size_based_on_content = false;
            if main_mode != Mode::StretchFit {
                let min_w = s.resolved_min(0, owner_w) - pb_row;
                let max_w = s.resolved_max(0, owner_w) - pb_row;
                let min_h = s.resolved_min(1, owner_h) - pb_col;
                let max_h = s.resolved_max(1, owner_h) - pb_col;
                let min_main = if main_row { min_w } else { min_h };
                let max_main = if main_row { max_w } else { max_h };
                if defined(min_main) && line.size_consumed < min_main {
                    aim = min_main;
                } else if defined(max_main) && line.size_consumed > max_main {
                    aim = max_main;
                } else {
                    let node_grow = self.resolve_flex_grow(n);
                    if (defined(line.total_grow) && line.total_grow == 0.0) || (defined(node_grow) && node_grow == 0.0) {
                        aim = line.size_consumed;
                    }
                    size_based_on_content = true;
                }
            }
            if !size_based_on_content && defined(aim) {
                line.remaining = aim - line.size_consumed;
            } else if line.size_consumed < 0.0 {
                line.remaining = -line.size_consumed;
            }
            if !can_skip {
                let original = line.remaining;
                self.distribute_first_pass(&mut line, main, main_owner, aim, aiw);
                let distributed = self.distribute_second_pass(&mut line, n, main, cross, main_owner, aim, aic, aiw, aih, main_overflows, cross_mode, perform, m);
                line.remaining = original - distributed;
            }
            // STEP 6
            self.justify_main_axis(n, &mut line, main, cross, main_mode, cross_mode, main_owner, owner_w, aim, aic, aiw, perform, m);
            let mut container_cross = aic;
            if matches!(cross_mode, Mode::MaxContent | Mode::FitContent) {
                container_cross = self.bound_axis(n, cross, line.cross_dim + pb_cross, cross_owner, owner_w) - pb_cross;
            }
            if !wrap && cross_mode == Mode::StretchFit {
                line.cross_dim = aic;
            }
            if !wrap {
                line.cross_dim = self.bound_axis(n, cross, line.cross_dim + pb_cross, cross_owner, owner_w) - pb_cross;
            }
            // STEP 7
            if perform {
                for i in 0..line.items.len() {
                    let c = line.items[i];
                    let cs = self.st(c).clone();
                    let mut leading_cross = lead_pb_cross;
                    let align = resolve_child_alignment(&s, &cs);
                    if align == Align::Stretch && !cs.flex_start_margin_is_auto(cross) && !cs.flex_end_margin_is_auto(cross) {
                        if !self.has_definite_length(c, dim(cross), aic) {
                            let mut child_main = self.nodes[c].layout.measured[dim(main)];
                            let mut child_cross = if defined(cs.aspect) {
                                cs.margin_for_axis(cross, aiw) + if main_row { child_main / cs.aspect } else { child_main * cs.aspect }
                            } else {
                                line.cross_dim
                            };
                            child_main += cs.margin_for_axis(main, aiw);
                            let mut mm = Mode::StretchFit;
                            let mut cm = Mode::StretchFit;
                            self.constrain_max_size_for_mode(c, main, aim, aiw, &mut mm, &mut child_main);
                            self.constrain_max_size_for_mode(c, cross, aic, aiw, &mut cm, &mut child_cross);
                            let (cw, ch) = if main_row { (child_main, child_cross) } else { (child_cross, child_main) };
                            let cross_no_grow = s.align_content != Align::Stretch && wrap;
                            let wmode = if cw.is_nan() || (!main_row && cross_no_grow) { Mode::MaxContent } else { Mode::StretchFit };
                            let hmode = if ch.is_nan() || (main_row && cross_no_grow) { Mode::MaxContent } else { Mode::StretchFit };
                            self.layout_internal(c, cw, ch, wmode, hmode, aiw, aih, true, m);
                        }
                    } else {
                        let remaining_cross = container_cross - self.dimension_with_margin(c, cross, aiw);
                        if cs.flex_start_margin_is_auto(cross) && cs.flex_end_margin_is_auto(cross) {
                            leading_cross += (remaining_cross / 2.0).max(0.0);
                        } else if cs.flex_end_margin_is_auto(cross) {
                        } else if cs.flex_start_margin_is_auto(cross) {
                            leading_cross += remaining_cross.max(0.0);
                        } else if align == Align::FlexStart {
                        } else if align == Align::Center {
                            leading_cross += remaining_cross / 2.0;
                        } else {
                            leading_cross += remaining_cross;
                        }
                    }
                    let edge = flex_start_edge(cross);
                    let v = self.nodes[c].layout.position[edge] + total_line_cross + leading_cross;
                    self.lay(c).position[edge] = v;
                }
            }
            let applied_gap = if line_count != 0 { cross_gap } else { 0.0 };
            total_line_cross += line.cross_dim + applied_gap;
            max_line_main = max_line_main.max(line.main_dim);
            line_count += 1;
        }
        // STEP 8
        if perform && (wrap || self.is_baseline_layout(n)) {
            let mut lead_per_line = 0.0f32;
            let mut current_lead = lead_pb_cross;
            let mut extra_per_line = 0.0f32;
            let unclamped = if cross_mode == Mode::StretchFit {
                aic + pb_cross
            } else if self.has_definite_length(n, dim(cross), cross_owner) {
                self.resolved_dimension(n, dim(cross), cross_owner)
            } else {
                total_line_cross + pb_cross
            };
            let inner_cross = self.bound_axis(n, cross, unclamped, owner_h, owner_w) - pb_cross;
            let remaining = inner_cross - total_line_cross;
            let align_content = if remaining >= 0.0 { s.align_content } else { fallback_align(s.align_content) };
            let lines = line_count as f32;
            match align_content {
                Align::FlexEnd => current_lead += remaining,
                Align::Center => current_lead += remaining / 2.0,
                Align::Stretch => extra_per_line = remaining / lines,
                Align::SpaceAround => {
                    current_lead += remaining / (2.0 * lines);
                    lead_per_line = remaining / lines;
                }
                Align::SpaceEvenly => {
                    current_lead += remaining / (lines + 1.0);
                    lead_per_line = remaining / (lines + 1.0);
                }
                Align::SpaceBetween
                    if line_count > 1 => {
                        lead_per_line = remaining / (lines - 1.0);
                    }
                _ => {}
            }
            let children = self.nodes[n].children.clone();
            let mut end = 0usize;
            for i in 0..line_count {
                let start_i = end;
                let mut it = start_i;
                let (mut line_height, mut max_ascent, mut max_descent) = (0.0f32, 0.0f32, 0.0f32);
                while it < children.len() {
                    let c = children[it];
                    if self.st(c).display_none {
                        it += 1;
                        continue;
                    }
                    if !self.st(c).absolute {
                        if self.nodes[c].layout.line != i {
                            break;
                        }
                        if self.is_layout_dimension_defined(c, cross) {
                            line_height = line_height.max(self.nodes[c].layout.measured[dim(cross)] + self.st(c).margin_for_axis(cross, aiw));
                        }
                        if resolve_child_alignment(&s, self.st(c)) == Align::Baseline {
                            let ascent = self.calculate_baseline(c, m) + self.st(c).flex_start_margin(FlexDir::Col, aiw);
                            let descent = self.nodes[c].layout.measured[1] + self.st(c).margin_for_axis(FlexDir::Col, aiw) - ascent;
                            max_ascent = max_ascent.max(ascent);
                            max_descent = max_descent.max(descent);
                            line_height = line_height.max(max_ascent + max_descent);
                        }
                    }
                    it += 1;
                }
                end = it;
                current_lead += if i != 0 { cross_gap } else { 0.0 };
                line_height += extra_per_line;
                for &c in &children[start_i..end] {
                    if self.st(c).display_none || self.st(c).absolute {
                        continue;
                    }
                    let cs = self.st(c).clone();
                    let edge = flex_start_edge(cross);
                    match resolve_child_alignment(&s, &cs) {
                        Align::FlexStart => {
                            let v = current_lead + cs.position_at(flex_start_edge(cross), aiw);
                            self.lay(c).position[edge] = v;
                        }
                        Align::FlexEnd => {
                            let v = current_lead + line_height - cs.flex_end_margin(cross, aiw) - self.nodes[c].layout.measured[dim(cross)];
                            self.lay(c).position[edge] = v;
                        }
                        Align::Center => {
                            let h = self.nodes[c].layout.measured[dim(cross)];
                            self.lay(c).position[edge] = current_lead + (line_height - h) / 2.0;
                        }
                        Align::Stretch => {
                            self.lay(c).position[edge] = current_lead + cs.flex_start_margin(cross, aiw);
                            if !self.has_definite_length(c, dim(cross), aic) {
                                let cw = if main_row { self.nodes[c].layout.measured[0] + cs.margin_for_axis(main, aiw) } else { lead_per_line + line_height };
                                let ch = if !main_row { self.nodes[c].layout.measured[1] + cs.margin_for_axis(cross, aiw) } else { lead_per_line + line_height };
                                if !(inexact_equals(cw, self.nodes[c].layout.measured[0]) && inexact_equals(ch, self.nodes[c].layout.measured[1])) {
                                    self.layout_internal(c, cw, ch, Mode::StretchFit, Mode::StretchFit, aiw, aih, true, m);
                                }
                            }
                        }
                        Align::Baseline => {
                            let v = current_lead + max_ascent - self.calculate_baseline(c, m) + self.flex_start_position(c, FlexDir::Col, aic);
                            self.lay(c).position[TOP] = v;
                        }
                        _ => {}
                    }
                }
                current_lead = current_lead + lead_per_line + line_height;
            }
        }
        // STEP 9
        let w = self.bound_axis(n, FlexDir::Row, aw - margin_row, owner_w, owner_w);
        let h = self.bound_axis(n, FlexDir::Col, ah - margin_col, owner_h, owner_w);
        self.lay(n).measured = [w, h];
        if matches!(main_mode, Mode::MaxContent | Mode::FitContent) {
            let v = self.bound_axis(n, main, max_line_main, main_owner, owner_w);
            self.lay(n).measured[dim(main)] = v;
        }
        if matches!(cross_mode, Mode::MaxContent | Mode::FitContent) {
            let v = self.bound_axis(n, cross, total_line_cross + pb_cross, cross_owner, owner_w);
            self.lay(n).measured[dim(cross)] = v;
        }
        if perform && s.wrap == Wrap::WrapReverse {
            let children = self.nodes[n].children.clone();
            for c in children {
                if !self.st(c).absolute {
                    let edge = flex_start_edge(cross);
                    let v = self.nodes[n].layout.measured[dim(cross)] - self.nodes[c].layout.position[edge] - self.nodes[c].layout.measured[dim(cross)];
                    self.lay(c).position[edge] = v;
                }
            }
        }
        if perform {
            // STEP 10
            let needs_main = matches!(main, FlexDir::RowRev | FlexDir::ColRev);
            let needs_cross = matches!(cross, FlexDir::RowRev | FlexDir::ColRev);
            if needs_main || needs_cross {
                let children = self.nodes[n].children.clone();
                for c in children {
                    if self.st(c).display_none || self.st(c).absolute {
                        continue;
                    }
                    if needs_main {
                        self.set_child_trailing_position(n, c, main);
                    }
                    if needs_cross {
                        self.set_child_trailing_position(n, c, cross);
                    }
                }
            }
            // STEP 11: todo nó é relative no pptsx, então cada um posiciona os absolutos que contém.
            let mode = if main_row { main_mode } else { cross_mode };
            self.layout_absolute_descendants(n, n, mode, depth, 0.0, 0.0, aiw, aih, m);
        }
    }

    fn flex_start_position(&self, c: usize, axis: FlexDir, size: f32) -> f32 {
        self.st(c).position_at(flex_start_edge(axis), size)
    }

    fn opposite_edge_position(&self, position: f32, axis: FlexDir, container: usize, n: usize) -> f32 {
        self.nodes[container].layout.measured[dim(axis)] - self.nodes[n].layout.measured[dim(axis)] - position
    }

    fn set_child_trailing_position(&mut self, n: usize, c: usize, axis: FlexDir) {
        let v = self.opposite_edge_position(self.nodes[c].layout.position[flex_start_edge(axis)], axis, n, c);
        self.lay(c).position[flex_end_edge(axis)] = v;
    }

    // ───────────── AbsoluteLayout.cpp ─────────────

    fn set_flex_start_layout_position(&mut self, parent: usize, c: usize, axis: FlexDir, cb_width: f32) {
        let edge = flex_start_edge(axis);
        let v = self.st(c).flex_start_margin(axis, cb_width) + self.nodes[parent].layout.border[edge] + self.nodes[parent].layout.padding[edge];
        self.lay(c).position[edge] = v;
    }

    fn set_flex_end_layout_position(&mut self, parent: usize, c: usize, axis: FlexDir, cb_width: f32) {
        let end = flex_end_edge(axis);
        let flex_end = self.nodes[parent].layout.border[end] + self.st(c).flex_end_margin(axis, cb_width) + self.nodes[parent].layout.padding[end];
        let v = self.opposite_edge_position(flex_end, axis, parent, c);
        self.lay(c).position[flex_start_edge(axis)] = v;
    }

    fn set_center_layout_position(&mut self, parent: usize, c: usize, axis: FlexDir, cb_width: f32) {
        let (s, e) = (flex_start_edge(axis), flex_end_edge(axis));
        let pl = &self.nodes[parent].layout;
        let content = pl.measured[dim(axis)] - pl.border[s] - pl.border[e] - pl.padding[s] - pl.padding[e];
        let outer = self.nodes[c].layout.measured[dim(axis)] + self.st(c).margin_for_axis(axis, cb_width);
        let v = (content - outer) / 2.0 + pl.border[s] + self.st(c).flex_start_margin(axis, cb_width) + pl.padding[s];
        self.lay(c).position[s] = v;
    }

    fn justify_absolute_child(&mut self, parent: usize, c: usize, main: FlexDir, cb_width: f32) {
        match self.st(parent).justify {
            Justify::FlexStart | Justify::SpaceBetween => self.set_flex_start_layout_position(parent, c, main, cb_width),
            Justify::FlexEnd => self.set_flex_end_layout_position(parent, c, main, cb_width),
            Justify::Center | Justify::SpaceAround | Justify::SpaceEvenly => self.set_center_layout_position(parent, c, main, cb_width),
        }
    }

    fn align_absolute_child(&mut self, parent: usize, c: usize, cross: FlexDir, cb_width: f32) {
        let mut align = resolve_child_alignment(self.st(parent), self.st(c));
        if self.st(parent).wrap == Wrap::WrapReverse {
            if align == Align::FlexEnd {
                align = Align::FlexStart;
            } else if align != Align::Center {
                align = Align::FlexEnd;
            }
        }
        match align {
            Align::FlexEnd => self.set_flex_end_layout_position(parent, c, cross, cb_width),
            Align::Center => self.set_center_layout_position(parent, c, cross, cb_width),
            _ => self.set_flex_start_layout_position(parent, c, cross, cb_width),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn position_absolute_child(&mut self, containing: usize, parent: usize, c: usize, axis: FlexDir, is_main: bool, cb_w: f32, cb_h: f32) {
        let size = if is_row(axis) { cb_w } else { cb_h };
        let cs = self.st(c).clone();
        let (start, end) = (inline_start_edge(axis), inline_end_edge(axis));
        if cs.position_defined(start) && !cs.position_auto(start) {
            let rel = cs.position_at(start, size) + self.st(containing).border_at(start) + cs.inline_start_margin(axis, size);
            let v = if start != flex_start_edge(axis) { self.opposite_edge_position(rel, axis, containing, c) } else { rel };
            self.lay(c).position[flex_start_edge(axis)] = v;
        } else if cs.position_defined(end) && !cs.position_auto(end) {
            let rel = self.nodes[containing].layout.measured[dim(axis)] - self.nodes[c].layout.measured[dim(axis)] - self.st(containing).border_at(end) - cs.inline_end_margin(axis, size) - cs.position_at(end, size);
            let v = if start != flex_start_edge(axis) { self.opposite_edge_position(rel, axis, containing, c) } else { rel };
            self.lay(c).position[flex_start_edge(axis)] = v;
        } else if is_main {
            self.justify_absolute_child(parent, c, axis, cb_w);
        } else {
            self.align_absolute_child(parent, c, axis, cb_w);
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn layout_absolute_child(&mut self, containing: usize, n: usize, c: usize, cb_w: f32, cb_h: f32, width_mode: Mode, depth: u32, m: &mut dyn Measurer) {
        let main = self.st(n).dir;
        let cross = cross_of(main);
        let main_row = is_row(main);
        let mut cw = UNDEF;
        let mut ch = UNDEF;
        let cs = self.st(c).clone();
        let margin_row = cs.margin_for_axis(FlexDir::Row, cb_w);
        let margin_col = cs.margin_for_axis(FlexDir::Col, cb_w);
        self.process_dimensions(c);
        if self.has_definite_length(c, 0, cb_w) {
            cw = self.resolved_dimension(c, 0, cb_w) + margin_row;
        } else if cs.position_defined(LEFT) && cs.position_defined(RIGHT) && !cs.position_auto(LEFT) && !cs.position_auto(RIGHT) {
            let cn = self.st(containing);
            cw = self.nodes[containing].layout.measured[0] - (cn.border_at(LEFT) + cn.border_at(RIGHT)) - (cs.position_at(LEFT, cb_w) + cs.position_at(RIGHT, cb_w));
            cw = self.bound_axis(c, FlexDir::Row, cw, cb_w, cb_w);
        }
        if self.has_definite_length(c, 1, cb_h) {
            ch = self.resolved_dimension(c, 1, cb_h) + margin_col;
        } else if cs.position_defined(TOP) && cs.position_defined(BOTTOM) && !cs.position_auto(TOP) && !cs.position_auto(BOTTOM) {
            let cn = self.st(containing);
            ch = self.nodes[containing].layout.measured[1] - (cn.border_at(TOP) + cn.border_at(BOTTOM)) - (cs.position_at(TOP, cb_h) + cs.position_at(BOTTOM, cb_h));
            ch = self.bound_axis(c, FlexDir::Col, ch, cb_h, cb_w);
        }
        if cw.is_nan() != ch.is_nan() && defined(cs.aspect) {
            if cw.is_nan() {
                cw = margin_row + (ch - margin_col) * cs.aspect;
            } else {
                ch = margin_col + (cw - margin_row) / cs.aspect;
            }
        }
        if cw.is_nan() || ch.is_nan() {
            let mut wmode = if cw.is_nan() { Mode::MaxContent } else { Mode::StretchFit };
            let hmode = if ch.is_nan() { Mode::MaxContent } else { Mode::StretchFit };
            if !main_row && cw.is_nan() && width_mode != Mode::MaxContent && defined(cb_w) && cb_w > 0.0 {
                cw = cb_w;
                wmode = Mode::FitContent;
            }
            self.layout_internal(c, cw, ch, wmode, hmode, cb_w, cb_h, false, m);
            cw = self.nodes[c].layout.measured[0] + self.st(c).margin_for_axis(FlexDir::Row, cb_w);
            ch = self.nodes[c].layout.measured[1] + self.st(c).margin_for_axis(FlexDir::Col, cb_w);
        }
        let _ = depth;
        self.layout_internal(c, cw, ch, Mode::StretchFit, Mode::StretchFit, cb_w, cb_h, true, m);
        self.position_absolute_child(containing, n, c, main, true, cb_w, cb_h);
        self.position_absolute_child(containing, n, c, cross, false, cb_w, cb_h);
    }

    #[allow(clippy::too_many_arguments)]
    fn layout_absolute_descendants(&mut self, containing: usize, current: usize, width_mode: Mode, depth: u32, left_off: f32, top_off: f32, _aiw: f32, _aih: f32, m: &mut dyn Measurer) {
        let children = self.nodes[current].children.clone();
        for c in children {
            if self.st(c).display_none || !self.st(c).absolute {
                // Sem nós static no pptsx: só o pai direto contém os absolutos.
                continue;
            }
            let cl = &self.nodes[containing].layout;
            let cb_w = cl.measured[0] - self.st(containing).border_for_axis(FlexDir::Row);
            let cb_h = cl.measured[1] - self.st(containing).border_for_axis(FlexDir::Col);
            self.layout_absolute_child(containing, current, c, cb_w, cb_h, width_mode, depth, m);
            let parent_main = self.st(current).dir;
            let parent_cross = cross_of(parent_main);
            if matches!(parent_main, FlexDir::RowRev | FlexDir::ColRev) {
                let defined_insets = if is_row(parent_main) { self.st(c).horizontal_insets_defined() } else { self.st(c).vertical_insets_defined() };
                self.set_child_trailing_position(if defined_insets { containing } else { current }, c, parent_main);
            }
            if matches!(parent_cross, FlexDir::RowRev | FlexDir::ColRev) {
                let defined_insets = if is_row(parent_cross) { self.st(c).horizontal_insets_defined() } else { self.st(c).vertical_insets_defined() };
                self.set_child_trailing_position(if defined_insets { containing } else { current }, c, parent_cross);
            }
            let (l, t) = (self.nodes[c].layout.position[LEFT], self.nodes[c].layout.position[TOP]);
            let left = if self.st(c).horizontal_insets_defined() { l - left_off } else { l };
            let top = if self.st(c).vertical_insets_defined() { t - top_off } else { t };
            let lay = self.lay(c);
            lay.position[LEFT] = left;
            lay.position[TOP] = top;
        }
    }

    // ───────────── Cache.cpp + calculateLayoutInternal ─────────────

    #[allow(clippy::too_many_arguments)]
    fn can_use_cached(wm: Mode, aw: f32, hm: Mode, ah: f32, e: &Entry, margin_row: f32, margin_col: f32) -> bool {
        let (Some(lwm), Some(lhm)) = (e.wm, e.hm) else { return false };
        if (defined(e.ch) && e.ch < 0.0) || (defined(e.cw) && e.cw < 0.0) {
            return false;
        }
        let same_w = lwm == wm && inexact_equals(e.aw, aw);
        let same_h = lhm == hm && inexact_equals(e.ah, ah);
        let exact = |mode: Mode, size: f32, last: f32| mode == Mode::StretchFit && inexact_equals(size, last);
        let still_fits = |mode: Mode, size: f32, last_mode: Mode, last: f32| mode == Mode::FitContent && last_mode == Mode::MaxContent && (size >= last || inexact_equals(size, last));
        let stricter = |mode: Mode, size: f32, last_mode: Mode, last_size: f32, last: f32| {
            last_mode == Mode::FitContent && mode == Mode::FitContent && defined(last_size) && defined(size) && defined(last) && last_size > size && (last <= size || inexact_equals(size, last))
        };
        let w_ok = same_w || exact(wm, aw - margin_row, e.cw) || still_fits(wm, aw - margin_row, lwm, e.cw) || stricter(wm, aw - margin_row, lwm, e.aw, e.cw);
        let h_ok = same_h || exact(hm, ah - margin_col, e.ch) || still_fits(hm, ah - margin_col, lhm, e.ch) || stricter(hm, ah - margin_col, lhm, e.ah, e.ch);
        w_ok && h_ok
    }

    #[allow(clippy::too_many_arguments)]
    fn layout_internal(&mut self, n: usize, aw: f32, ah: f32, wm: Mode, hm: Mode, owner_w: f32, owner_h: f32, perform: bool, m: &mut dyn Measurer) -> bool {
        let now = self.generation;
        let need_visit = self.nodes[n].dirty && self.nodes[n].layout.generation != now;
        if need_visit {
            let l = self.lay(n);
            l.next_measure = 0;
            l.measures.clear();
            l.cached_layout = None;
        }
        let mut cached: Option<Entry> = None;
        let mut cached_is_layout = false;
        if self.nodes[n].has_measure {
            let mr = self.st(n).margin_for_axis(FlexDir::Row, owner_w);
            let mc = self.st(n).margin_for_axis(FlexDir::Col, owner_w);
            let l = &self.nodes[n].layout;
            if let Some(e) = l.cached_layout.filter(|e| Self::can_use_cached(wm, aw, hm, ah, e, mr, mc)) {
                cached = Some(e);
                cached_is_layout = true;
            } else {
                cached = l.measures.iter().take(l.next_measure.min(l.measures.len())).find(|e| Self::can_use_cached(wm, aw, hm, ah, e, mr, mc)).copied();
            }
        } else if perform {
            if let Some(e) = self.nodes[n].layout.cached_layout
                && inexact_equals(e.aw, aw) && inexact_equals(e.ah, ah) && e.wm == Some(wm) && e.hm == Some(hm) {
                    cached = Some(e);
                    cached_is_layout = true;
                }
        } else {
            let l = &self.nodes[n].layout;
            cached = l.measures.iter().take(l.next_measure.min(l.measures.len())).find(|e| inexact_equals(e.aw, aw) && inexact_equals(e.ah, ah) && e.wm == Some(wm) && e.hm == Some(hm)).copied();
        }
        let _ = cached_is_layout;
        if let Some(e) = cached.filter(|_| !need_visit) {
            self.lay(n).measured = [e.cw, e.ch];
        } else {
            self.layout_impl(n, aw, ah, wm, hm, owner_w, owner_h, perform, 0, m);
            if cached.is_none() {
                let measured = self.nodes[n].layout.measured;
                let entry = Entry { aw, ah, wm: Some(wm), hm: Some(hm), cw: measured[0], ch: measured[1] };
                let l = self.lay(n);
                if perform {
                    l.cached_layout = Some(entry);
                } else {
                    if l.next_measure == 8 {
                        l.next_measure = 0;
                    }
                    if l.next_measure < l.measures.len() {
                        l.measures[l.next_measure] = entry;
                    } else {
                        l.measures.push(entry);
                    }
                    l.next_measure += 1;
                }
            }
        }
        if perform {
            let measured = self.nodes[n].layout.measured;
            self.lay(n).dims = measured;
            self.nodes[n].dirty = false;
        }
        self.lay(n).generation = now;
        need_visit || cached.is_none()
    }

    /// calculateLayout: a raiz com o tamanho do slide (width/height do estilo dela), LTR.
    pub fn calculate(&mut self, root: usize, owner_w: f32, owner_h: f32, m: &mut dyn Measurer) {
        self.generation += 1;
        self.process_dimensions(root);
        let (w, wm) = if self.has_definite_length(root, 0, owner_w) {
            (self.resolved_dimension(root, 0, owner_w) + self.st(root).margin_for_axis(FlexDir::Row, owner_w), Mode::StretchFit)
        } else if defined(self.st(root).resolved_max(0, owner_w)) {
            (self.st(root).resolved_max(0, owner_w), Mode::FitContent)
        } else {
            (owner_w, if defined(owner_w) { Mode::StretchFit } else { Mode::MaxContent })
        };
        let (h, hm) = if self.has_definite_length(root, 1, owner_h) {
            (self.resolved_dimension(root, 1, owner_h) + self.st(root).margin_for_axis(FlexDir::Col, owner_w), Mode::StretchFit)
        } else if defined(self.st(root).resolved_max(1, owner_h)) {
            (self.st(root).resolved_max(1, owner_h), Mode::FitContent)
        } else {
            (owner_h, if defined(owner_h) { Mode::StretchFit } else { Mode::MaxContent })
        };
        if self.layout_internal(root, w, h, wm, hm, owner_w, owner_h, true, m) {
            self.set_position(root, owner_w, owner_h);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixed(Vec<f32>);

    impl Measurer for Fixed {
        fn measure(&mut self, n: usize, _w: f32, _wm: Mode, _h: f32, _hm: Mode) -> (f32, f32) {
            (self.0[n - 1], 12.0)
        }
        fn baseline(&mut self, _n: usize, _w: f32, h: f32) -> f32 {
            h
        }
    }

    /// Row com nowrap (minWidth = linha) que não cabe: o resíduo em f32 do total de shrink decide
    /// o resultado, inclusive o degenerado. Valores do yoga-layout 3.2.1 (wasm) com a mesma árvore.
    #[test]
    fn shrink_residual_matches_yoga() {
        let cases: [([f32; 3], [f32; 3]); 2] = [
            ([74.17998, 75.31411, 24.645618], [74.17999, 75.31411, 24.645618]),
            ([74.17998, 75.31411, 22.181057], [174529248.0, 177197616.0, 52187172.0]),
        ];
        for (widths, expected) in cases {
            let mut t = Tree::new();
            let root = t.add(Style { dim: [Len::Pt(196.7), Len::Pt(76.0)], align_items: Align::Center, gap: [Len::Pt(6.0), Len::Undef], padding: [Len::Pt(11.0), Len::Undef, Len::Pt(11.0), Len::Undef], ..Style::default() });
            for (i, w) in widths.iter().enumerate() {
                let mut s = Style { min: [Len::Pt(*w), Len::Undef], ..Style::default() };
                if i == 0 {
                    (s.grow, s.shrink, s.basis) = (1.0, 1.0, Len::Pt(0.0));
                }
                let c = t.add(s);
                t.nodes[c].has_measure = true;
                t.append(root, c);
            }
            t.calculate(root, f32::NAN, f32::NAN, &mut Fixed(widths.to_vec()));
            for (c, e) in expected.iter().enumerate() {
                let got = t.nodes[c + 1].layout.dims[0];
                assert!((got - e).abs() <= e.abs() * 1e-6, "filho {c}: {got} ≠ {e}");
            }
        }
    }
}
