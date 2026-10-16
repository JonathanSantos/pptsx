//! Layout (port do Yoga em `yoga_layout.rs`, grid em `grid.rs`) + loop de ajuste: se o slide
//! transborda, todo texto com `fit="shrink"` encolhe junto (mesma escala, piso em `minSize`) por
//! busca binária.

use crate::diag::Diags;
use crate::model::{Fit, Node, NodeKind, SlideSpec, TextSpec};
use crate::text::{Fonts, Laid, RunInput, TextInput, layout_text};

/// Tolerância (pt) na detecção de overflow (DEFAULTS.fit.epsilon).
const EPSILON: f32 = 0.5;
/// Rodadas da busca binária da escala do shrink (DEFAULTS.maxFitIterations).
const FIT_ROUNDS: usize = 12;

#[derive(Clone, Copy, Debug, Default)]
pub struct Frame {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Frame {
    pub fn right(&self) -> f32 {
        self.x + self.w
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.h
    }
}

pub struct TextOut {
    pub laid: Laid,
    pub size: f32,
    /// SlideNumber "n / total": larguras do número (campo) e do resto, em caixas separadas como no pptsx.
    pub split: Option<(f32, f32)>,
    /// Por trecho: nome da face no PPTX (peso fora de 400/700) e flag de negrito.
    pub faces: Vec<(Option<String>, bool)>,
    /// Alguma família não registrada: medido por estimativa.
    pub missing: bool,
}

pub fn faces_of(t: &TextSpec, fonts: &Fonts) -> Vec<(Option<String>, bool)> {
    t.runs
        .iter()
        .map(|r| {
            let m = fonts.matching(r.family.as_deref().unwrap_or(&t.family), r.weight, r.italic);
            (m.typeface, m.bold)
        })
        .collect()
}

pub struct Placed<'a> {
    pub node: &'a Node,
    pub frame: Frame,
    /// padding + borda por lado (top, right, bottom, left): o inset do texto.
    pub inset: [f32; 4],
    /// Margens resolvidas (top, right, bottom, left): a caixa de margem conta no estouro do pai.
    pub margin: [f32; 4],
    /// Frame e célula de grid (as faixas que o item ocupa) somados em f64, como o pptsx (JavaScript) faz: o relatório conta com eles.
    pub exact: [f64; 4],
    pub exact_cell: Option<[f64; 4]>,
    pub text: Option<TextOut>,
    pub table: Option<crate::objects::TableLayout>,
    /// Pintura herdada: opacidade efetiva, rotações (pivô x, y, graus; do ancestral mais
    /// externo ao próprio nó) e translação acumulada.
    pub effects: Effects,
    /// Índice do pai na pré-ordem (o slide aponta para si mesmo).
    pub parent: usize,
}

#[derive(Clone, Debug, Default)]
pub struct Effects {
    pub opacity: f32,
    pub rotations: Vec<(f32, f32, f32)>,
    pub shift: (f32, f32),
}

pub struct SlideLayout<'a> {
    pub placed: Vec<Placed<'a>>,
    pub connectors: Vec<Routed<'a>>,
}

pub struct Routed<'a> {
    pub spec: &'a crate::model::ConnectorSpec,
    pub points: Vec<(f32, f32)>,
    /// Frame do texto do rótulo e as linhas medidas.
    pub label: Option<(Frame, TextOut)>,
}

// ───────────── conectores (fit/connectors.ts) ─────────────

const SIDES: [&str; 4] = ["top", "right", "bottom", "left"];
/// Lado igual nas duas pontas: a dobra sai para fora dos nós (DEFAULTS.connector.elbowOffset).
const ELBOW_OFFSET: f32 = 16.0;
const NOISE: f32 = 1e-6;

fn anchor(f: Frame, side: &str) -> (f32, f32) {
    let (cx, cy) = (f.x + f.w / 2.0, f.y + f.h / 2.0);
    match side {
        "top" => (cx, f.y),
        "right" => (f.right(), cy),
        "bottom" => (cx, f.bottom()),
        _ => (f.x, cy),
    }
}

fn dist(a: (f32, f32), b: (f32, f32)) -> f32 {
    (a.0 - b.0).hypot(a.1 - b.1)
}

fn horizontal(side: &str) -> bool {
    side == "left" || side == "right"
}

fn route(spec: &crate::model::ConnectorSpec, from: Frame, to: Frame) -> Vec<(f32, f32)> {
    fn candidates(s: &Option<String>) -> Vec<&str> {
        s.as_deref().map_or(SIDES.to_vec(), |x| vec![x])
    }
    let mut best: Option<(&str, &str, f32)> = None;
    for a in candidates(&spec.from_side) {
        for b in candidates(&spec.to_side) {
            let d = dist(anchor(from, a), anchor(to, b));
            if best.is_none_or(|(_, _, bd)| d < bd) {
                best = Some((a, b, d));
            }
        }
    }
    let (fs, ts, _) = best.unwrap_or(("right", "left", 0.0));
    let (a, b) = (anchor(from, fs), anchor(to, ts));
    let points = if !spec.elbow {
        vec![a, b]
    } else if horizontal(fs) != horizontal(ts) {
        if horizontal(fs) { vec![a, (b.0, a.1), b] } else { vec![a, (a.0, b.1), b] }
    } else if horizontal(fs) {
        let x = if fs != ts { (a.0 + b.0) / 2.0 } else if fs == "right" { a.0.max(b.0) + ELBOW_OFFSET } else { a.0.min(b.0) - ELBOW_OFFSET };
        vec![a, (x, a.1), (x, b.1), b]
    } else {
        let y = if fs != ts { (a.1 + b.1) / 2.0 } else if fs == "bottom" { a.1.max(b.1) + ELBOW_OFFSET } else { a.1.min(b.1) - ELBOW_OFFSET };
        vec![a, (a.0, y), (b.0, y), b]
    };
    // Sem pontos repetidos nem do meio de trechos colineares (cotovelo alinhado vira reta).
    let mut unique: Vec<(f32, f32)> = Vec::new();
    for p in points {
        if unique.last().is_none_or(|l| dist(*l, p) > NOISE) {
            unique.push(p);
        }
    }
    let mut out = Vec::new();
    for (i, p) in unique.iter().enumerate() {
        if i == 0 || i == unique.len() - 1 {
            out.push(*p);
            continue;
        }
        let (b, n) = (unique[i - 1], unique[i + 1]);
        let cross = (p.0 - b.0) * (n.1 - p.1) - (p.1 - b.1) * (n.0 - p.0);
        if cross.abs() > NOISE {
            out.push(*p);
        }
    }
    out
}

fn route_all<'a>(slide: &'a SlideSpec, placed: &[Placed<'a>], fonts: &Fonts) -> Vec<Routed<'a>> {
    let frame_of = |id: &str| placed.iter().find(|p| p.node.id.as_deref() == Some(id)).map(|p| p.frame);
    slide
        .connectors
        .iter()
        .filter_map(|spec| {
            let points = route(spec, frame_of(&spec.from)?, frame_of(&spec.to)?);
            // Rótulo no meio do segmento mais longo.
            let label = spec.label.as_ref().map(|t| {
                let runs = runs_of(t, fonts, 1.0);
                let laid = layout_text(fonts, &text_input(t, &runs, t.size, None), f32::INFINITY);
                let (s, e) = points.windows(2).map(|w| (w[0], w[1])).fold((points[0], points[0]), |best, seg| if dist(seg.0, seg.1) > dist(best.0, best.1) { seg } else { best });
                let (cx, cy) = ((s.0 + e.0) / 2.0, (s.1 + e.1) / 2.0);
                (Frame { x: cx - laid.width / 2.0, y: cy - laid.height / 2.0, w: laid.width, h: laid.height }, TextOut { laid, size: t.size, split: None, faces: faces_of(t, fonts), missing: false })
            });
            Some(Routed { spec, points, label })
        })
        .collect()
}


/// Corpo de cada texto encolhido (índice na pré-ordem); ausente = o do autor.
pub(crate) type Scales = std::collections::HashMap<usize, f32>;

/// Chave do `maxLines` do settle do truncate (fit/policies.ts) no mesmo mapa das escalas.
pub(crate) const LINES_KEY: usize = 1 << 40;

/// maxLines efetivo do Text: o do truncate (depois do ajuste) ou o do autor.
pub(crate) fn max_lines_of(t: &TextSpec, scales: &Scales, index: usize) -> Option<usize> {
    scales.get(&(index | LINES_KEY)).map(|v| *v as usize).or(t.max_lines)
}

/// A tabela no corpo do shrink (como uma unidade: todas as células com o mesmo corpo).
pub(crate) fn scaled_table(t: &crate::objects::TableSpec, size: Option<f32>) -> std::borrow::Cow<'_, crate::objects::TableSpec> {
    match size {
        Some(s) if t.fit == Fit::Shrink => {
            let mut owned = t.clone();
            owned.size = s.max(t.min_size).min(t.author_size);
            std::borrow::Cow::Owned(owned)
        }
        _ => std::borrow::Cow::Borrowed(t),
    }
}

/// Corpo efetivo: o do shrink (só com fit="shrink"), nunca abaixo do mínimo nem acima do autor.
pub fn effective_size(t: &TextSpec, size: Option<f32>) -> f32 {
    match size {
        Some(s) if t.fit == Fit::Shrink => s.max(t.min_size).min(t.size),
        _ => t.size,
    }
}

/// Trechos para o medidor; `ratio` = escala do shrink, aplicada também aos corpos próprios.
pub fn runs_of(t: &TextSpec, fonts: &Fonts, ratio: f32) -> Vec<RunInput> {
    t.runs
        .iter()
        .map(|r| RunInput {
            text: r.text.clone(),
            face: fonts.face_for(r.family.as_deref().unwrap_or(&t.family), r.weight, r.italic),
            size: r.size.map(|s| s * ratio),
            shifted: r.baseline.is_some(),
            own_metrics: r.size.is_some() || r.family.is_some(),
            missing: !fonts.has_family(r.family.as_deref().unwrap_or(&t.family)),
        })
        .collect()
}

pub fn text_input<'a>(t: &TextSpec, runs: &'a [RunInput], size: f32, max_lines: Option<usize>) -> TextInput<'a> {
    TextInput { runs, size, line_height: t.line_height, letter_spacing: t.letter_spacing, nowrap: t.nowrap, max_lines }
}


/// Uma passada de layout com as escalas de shrink dadas. Saída em pré-ordem.
/// Caixa de um nó depois do layout, relativa ao pai (o motor que a calculou não importa).
#[derive(Clone, Copy, Debug, Default)]
pub struct NodeBox {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// top, right, bottom, left
    pub padding: [f32; 4],
    pub border: [f32; 4],
    pub margin: [f32; 4],
    /// Item de grid: a célula, relativa ao pai.
    pub cell: Option<Frame>,
}

/// Uma passada de layout com as escalas de shrink dadas. Saída em pré-ordem.
fn run<'a>(slide: &'a SlideSpec, fonts: &Fonts, scales: &Scales) -> Vec<Placed<'a>> {
    // Port do Yoga, como o pptsx; o taffy fica só nas faixas do grid (yoga_layout::boxes).
    let boxes = crate::yoga_layout::boxes(slide, fonts, scales);
    let mut placed = Vec::new();
    let base = Effects { opacity: 1.0, ..Effects::default() };
    collect(&boxes, &slide.root, 0, 0.0, 0.0, &base, fonts, scales, &mut placed);
    placed
}

#[allow(clippy::too_many_arguments)]
fn collect<'a>(boxes: &[NodeBox], node: &'a Node, parent: usize, ox: f64, oy: f64, inherited: &Effects, fonts: &Fonts, scales: &Scales, out: &mut Vec<Placed<'a>>) {
    let index = out.len();
    let layout = boxes[index];
    let exact = [ox + f64::from(layout.x), oy + f64::from(layout.y), f64::from(layout.w), f64::from(layout.h)];
    let exact_cell = layout.cell.map(|c| [ox + f64::from(c.x), oy + f64::from(c.y), f64::from(c.w), f64::from(c.h)]);
    let frame = Frame { x: exact[0] as f32, y: exact[1] as f32, w: layout.w, h: layout.h };
    let pad = layout.padding;
    let border = layout.border;
    let inset = [pad[0] + border[0], pad[1] + border[1], pad[2] + border[2], pad[3] + border[3]];
    let mut effects = inherited.clone();
    effects.opacity *= node.paint.opacity;
    effects.shift = (effects.shift.0 + node.paint.translate.0, effects.shift.1 + node.paint.translate.1);
    if node.paint.rotate != 0.0 {
        effects.rotations.push((frame.x + frame.w / 2.0 + effects.shift.0, frame.y + frame.h / 2.0 + effects.shift.1, node.paint.rotate));
    }
    let text = match &node.kind {
        NodeKind::Text(t) => {
            let size = effective_size(t, scales.get(&index).copied());
            let runs = runs_of(t, fonts, size / t.size.max(1e-3));
            let width = (frame.w - inset[1] - inset[3]).max(0.0);
            // truncate: o settle do ajuste já pôs o maxLines das linhas que cabem (relayout).
            let laid = layout_text(fonts, &text_input(t, &runs, size, max_lines_of(t, scales, index)), width);
            let split = node.slide_number.as_ref().filter(|f| f.as_str() == "n / total").and_then(|_| {
                let text: String = t.runs.first()?.text.clone();
                let digits: String = text.chars().take_while(char::is_ascii_digit).collect();
                let face = runs.first().map_or(0, |r| r.face);
                // Largura natural do número (sem a folga de quebra); o resto fica com o que sobra da caixa.
                let number = layout_text(fonts, &text_input(t, &[RunInput::plain(digits, face)], size, None), f32::INFINITY).width * fonts.options.safety;
                Some((number, (frame.w - inset[1] - inset[3] - number).max(0.0)))
            });
            let missing = runs.iter().any(|r| r.missing);
            Some(TextOut { laid, size, split, faces: faces_of(t, fonts), missing })
        }
        _ => None,
    };
    let table = match &node.kind {
        NodeKind::Table(t) => Some(crate::objects::layout_table(&scaled_table(t, scales.get(&index).copied()), fonts, (frame.w - inset[1] - inset[3]).max(0.0))),
        _ => None,
    };
    let margin = layout.margin;
    out.push(Placed { node, frame, inset, margin, exact, exact_cell, text, table, effects: effects.clone(), parent });
    if matches!(node.kind, NodeKind::Container | NodeKind::Shape(_)) {
        for child in &node.children {
            collect(boxes, child, index, exact[0], exact[1], &effects, fonts, scales, out);
        }
    }
}

/// Área de conteúdo de um nó (frame − padding − borda).
fn content_of(p: &Placed) -> Frame {
    let [t, r, b, l] = p.inset;
    Frame { x: p.frame.x + l, y: p.frame.y + t, w: (p.frame.w - l - r).max(0.0), h: (p.frame.h - t - b).max(0.0) }
}

fn subtree_end(placed: &[Placed], index: usize) -> usize {
    let mut end = index + 1;
    while end < placed.len() && is_descendant(placed, end, index) {
        end += 1;
    }
    end
}

fn is_descendant(placed: &[Placed], mut i: usize, ancestor: usize) -> bool {
    while i != 0 {
        i = placed[i].parent;
        if i == ancestor {
            return true;
        }
    }
    ancestor == 0
}

/// fit/scope.ts: raiz de componente mais próxima (o próprio nó conta), sem o slide; sem
/// nenhuma, o filho de primeiro nível do slide.
fn scope_of(placed: &[Placed], index: usize) -> usize {
    let mut i = index;
    let mut top = index;
    while i != 0 {
        if placed[i].node.component {
            return i;
        }
        top = i;
        i = placed[i].parent;
    }
    top
}

/// O que pode encolher (fit/pass.ts ShrinkPlan): Text e Table com fit="shrink" acima do mínimo.
#[derive(Clone, Copy)]
struct Plan {
    from: f32,
    min: f32,
}

fn plan_of(p: &Placed) -> Option<Plan> {
    match &p.node.kind {
        NodeKind::Text(t) if t.fit == Fit::Shrink && t.size > t.min_size && t.sample.is_none() => Some(Plan { from: t.size, min: t.min_size }),
        NodeKind::Table(t) if t.fit == Fit::Shrink && t.author_size > t.min_size => Some(Plan { from: t.author_size, min: t.min_size }),
        _ => None,
    }
}

/// Corpo neste layout.
fn current_of(p: &Placed, plan: Plan) -> f32 {
    p.text.as_ref().map(|t| t.size).or(p.table.as_ref().map(|t| t.size)).unwrap_or(plan.from)
}

/// Células com palavra partida: (maior segmento, largura de quebra da coluna).
fn broken_cells(p: &Placed, safety: f32) -> Vec<(f32, f32)> {
    let (NodeKind::Table(spec), Some(t)) = (&p.node.kind, &p.table) else { return Vec::new() };
    let mut out = Vec::new();
    for (r, row) in t.grid.iter().enumerate() {
        for (c, slot) in row.iter().enumerate() {
            let crate::objects::Slot::Cell(k) = slot else { continue };
            let (Some(cell), Some(laid)) = (spec.rows[r].cells.get(*k), t.cells.get(r).and_then(|l| l.get(*k))) else { continue };
            if !laid.word_broken {
                continue;
            }
            let span = cell.span.max(1);
            let width = (t.widths[c..(c + span).min(t.widths.len())].iter().sum::<f32>() - 2.0 * spec.padding).max(0.0);
            out.push((laid.widest_segment, width * safety));
        }
    }
    out
}

/// Gatilhos do shrink (fit/search.ts): Text/Table que pode encolher com estouro de altura, ou com
/// palavra partida / linha nowrap larga enquanto ainda está acima do mínimo.
fn triggers(placed: &[Placed], safety: f32) -> Vec<usize> {
    let over = crate::report::detect(placed);
    let mut out = Vec::new();
    for (i, p) in placed.iter().enumerate() {
        let Some(plan) = plan_of(p) else { continue };
        // Fonte ausente não dispara: a medição é estimada (search.ts canTrigger).
        if p.text.as_ref().is_some_and(|t| t.missing) {
            continue;
        }
        let size = current_of(p, plan);
        let height = over.iter().any(|o| o.index == i && matches!(o.kind, crate::report::Kind::Text | crate::report::Kind::Table) && !o.width);
        let broken = p.text.as_ref().is_some_and(|t| t.laid.word_broken) || !broken_cells(p, safety).is_empty();
        let width = size > plan.min + 1e-3 && (broken || over.iter().any(|o| o.index == i && o.width));
        if height || width {
            out.push(i);
        }
    }
    out
}

fn triggered_in(placed: &[Placed], scope: usize, safety: f32) -> bool {
    let end = subtree_end(placed, scope);
    triggers(placed, safety).iter().any(|&i| i >= scope && i < end)
}

fn depth_of(placed: &[Placed], mut i: usize) -> usize {
    let mut d = 0;
    while i != 0 {
        i = placed[i].parent;
        d += 1;
    }
    d
}

/// search.ts wordDeltaOf: o maior entre o piso da palavra partida (regra de três sobre a largura
/// de quebra) e o da linha nowrap contra a área que ela estoura; None = o Text não tem falta de
/// largura.
fn text_word_delta(p: &Placed, i: usize, plan: Plan, over: &[crate::report::Overflow], safety: f32) -> Option<f32> {
    let t = p.text.as_ref()?;
    let step = |fitting: f64| ((f64::from(plan.from) - fitting) - 1e-9).ceil();
    let width = content_of(p).w * safety;
    let segment = (t.laid.word_broken && t.laid.widest_segment > 0.0).then(|| step(f64::from(t.size) * f64::from(width) / f64::from(t.laid.widest_segment)));
    let line = over.iter().find(|o| o.index == i && o.width).filter(|_| t.laid.width > 0.0).map(|o| {
        let area = f64::from(t.laid.width) - o.pt + f64::from(EPSILON);
        step(f64::from(t.size) * area / f64::from(t.laid.width))
    });
    if segment.is_none() && line.is_none() {
        return None;
    }
    Some(segment.unwrap_or(0.0).max(line.unwrap_or(0.0)).max(0.0) as f32)
}

/// Passos de 1 pt a partir do corpo do autor (DEFAULTS.fit.shrinkStep); nunca sobe.
fn with_delta(sizes: &Scales, placed: &[Placed], participants: &[usize], delta: f32) -> Scales {
    let mut out = sizes.clone();
    for &i in participants {
        if let Some(plan) = plan_of(&placed[i]) {
            let current = sizes.get(&i).copied().unwrap_or(plan.from);
            out.insert(i, current.min((plan.from - delta).max(plan.min)));
        }
    }
    out
}

/// M19 (containers.ts): o espaço de cada `<Container>` pendente numa passada de layout sem fit
/// (o tamanho do Container vem do pai, não do conteúdo): frame e content box por path.
pub fn container_measures(slide: &SlideSpec, fonts: &Fonts, paths: &[String]) -> Vec<(String, crate::model::Measure)> {
    let placed = run(slide, fonts, &Scales::new());
    paths
        .iter()
        .filter_map(|path| {
            let p = placed.iter().find(|p| &p.node.label == path)?;
            let (w, h) = (p.exact[2], p.exact[3]);
            let [t, r, b, l] = p.inset.map(f64::from);
            Some((path.clone(), crate::model::Measure { frame: (w, h), content: ((w - l - r).max(0.0), (h - t - b).max(0.0)) }))
        })
        .collect()
}

// O índice vale por si: é a chave de `sizes` e dos estouros, não só o acesso a `placed[i]`.
#[allow(clippy::needless_range_loop)]
pub fn layout_slide<'a>(slide: &'a SlideSpec, fonts: &Fonts, index: usize, diags: &Diags) -> SlideLayout<'a> {
    let mut sizes = Scales::new();
    let mut placed = run(slide, fonts, &sizes);
    for _ in 0..FIT_ROUNDS {
        let before = sizes.clone();
        let mut scopes: Vec<usize> = triggers(&placed, fonts.options.safety).into_iter().map(|i| scope_of(&placed, i)).collect();
        scopes.sort_by_key(|&s| std::cmp::Reverse(depth_of(&placed, s)));
        scopes.dedup();
        for scope in scopes {
            if !triggered_in(&placed, scope, fonts.options.safety) {
                continue;
            }
            let end = subtree_end(&placed, scope);
            // Palavras partidas e linhas nowrap: cada texto vai sozinho ao corpo em que cabe
            // (regra de três sobre a largura); os vizinhos não alargam a linha dele.
            let mut words = sizes.clone();
            let over = crate::report::detect(&placed);
            for i in scope..end {
                let Some(plan) = plan_of(&placed[i]) else { continue };
                let current = current_of(&placed[i], plan);
                if current <= plan.min + 1e-3 {
                    continue;
                }
                let delta = if matches!(placed[i].node.kind, NodeKind::Text(_)) {
                    let Some(delta) = text_word_delta(&placed[i], i, plan, &over, fonts.options.safety) else { continue };
                    delta
                } else {
                    // Tabela: cada célula partida pede o seu piso; vale o maior (search.ts segmentDeltaOf).
                    let cells = broken_cells(&placed[i], fonts.options.safety);
                    if cells.is_empty() {
                        continue;
                    }
                    cells.iter().filter(|(w, _)| *w > 0.0).map(|(widest, width)| (plan.from - current * width / widest - 1e-9).ceil()).fold(0.0, f32::max)
                };
                let size = (plan.from - delta).max(plan.min).min(current);
                if size < current {
                    words.insert(i, size);
                }
            }
            if words != sizes {
                sizes = words;
                placed = run(slide, fonts, &sizes);
                if !triggered_in(&placed, scope, fonts.options.safety) {
                    continue;
                }
            }
            // Delta comum do escopo: primeiro o máximo (se nem no mínimo cabe, para ali).
            let participants: Vec<usize> = (scope..end).filter(|&i| plan_of(&placed[i]).is_some_and(|p| sizes.get(&i).copied().unwrap_or(p.from) > p.min)).collect();
            if participants.is_empty() {
                continue;
            }
            let high = participants.iter().filter_map(|&i| plan_of(&placed[i])).map(|p| (p.from - p.min).ceil()).fold(0.0, f32::max);
            let at_min = with_delta(&sizes, &placed, &participants, high);
            let floor = run(slide, fonts, &at_min);
            if triggered_in(&floor, scope, fonts.options.safety) {
                sizes = at_min;
                placed = floor;
                continue;
            }
            let untouched = participants
                .iter()
                .filter_map(|&i| plan_of(&placed[i]).map(|p| (p.from - sizes.get(&i).copied().unwrap_or(p.from)).floor()))
                .fold(f32::INFINITY, f32::min);
            // search.ts bisectScope: a busca começa no piso das palavras/linhas que ainda estouram
            // (wordFloorOf): um delta menor ainda as deixaria sem largura.
            let over = crate::report::detect(&placed);
            let triggered = triggers(&placed, fonts.options.safety);
            let floor_delta = triggered
                .iter()
                .filter(|&&i| i >= scope && i < end && matches!(placed[i].node.kind, NodeKind::Text(_)))
                .filter_map(|&i| plan_of(&placed[i]).and_then(|plan| (current_of(&placed[i], plan) > plan.min + 1e-3).then_some(plan)).and_then(|plan| text_word_delta(&placed[i], i, plan, &over, fonts.options.safety)))
                .fold(0.0, f32::max);
            let (mut lo, mut hi) = ((untouched + 1.0).max(floor_delta).min(high), high);
            while lo < hi {
                let mid = ((lo + hi) / 2.0).floor();
                if triggered_in(&run(slide, fonts, &with_delta(&sizes, &placed, &participants, mid)), scope, fonts.options.safety) {
                    lo = mid + 1.0;
                } else {
                    hi = mid;
                }
            }
            sizes = with_delta(&sizes, &placed, &participants, hi);
            placed = run(slide, fonts, &sizes);
        }
        if sizes == before {
            break;
        }
    }
    // fit/policies.ts truncate.settle: Text com estouro de altura fica com as linhas inteiras que
    // cabem (pelo menos uma; nunca mais que o maxLines do autor) e o slide é refeito.
    let mut settled = sizes.clone();
    for o in crate::report::detect(&placed).iter().filter(|o| o.kind == crate::report::Kind::Text && !o.width) {
        let (NodeKind::Text(t), Some(out)) = (&placed[o.index].node.kind, &placed[o.index].text) else { continue };
        if t.fit != Fit::Truncate || out.laid.line.height <= 0.0 {
            continue;
        }
        let fit = (((f64::from(out.laid.height) - o.pt) / f64::from(out.laid.line.height)).floor().max(1.0)) as usize;
        let lines = t.max_lines.map_or(fit, |m| fit.min(m));
        settled.insert(o.index | LINES_KEY, lines as f32);
    }
    if settled != sizes {
        sizes = settled;
        placed = run(slide, fonts, &sizes);
    }
    // fit/fit.ts: diagnósticos do estado final (estouros, shrink, palavra partida, causa, grupos).
    diags.extend(crate::report::slide_diagnostics(&placed, index, fonts));
    let connectors = route_all(slide, &placed, fonts);
    finish(placed, connectors)
}

/// Ordem de pintura CSS (emit/paint.ts): o fluxo na ordem da árvore; quem sobe de camada pinta
/// com a subárvore no contexto mais próximo — z negativo antes do fluxo, z ≥ 0 depois (estável).
fn paint_order(placed: &[Placed]) -> Vec<usize> {
    let mut children: Vec<Vec<usize>> = vec![Vec::new(); placed.len()];
    for (i, p) in placed.iter().enumerate().skip(1) {
        children[p.parent].push(i);
    }
    fn collect(i: usize, placed: &[Placed], children: &[Vec<usize>], flow: &mut Vec<usize>, layers: &mut Vec<usize>) {
        for &c in &children[i] {
            if placed[c].node.layered {
                layers.push(c);
            } else {
                flow.push(c);
                collect(c, placed, children, flow, layers);
            }
        }
    }
    fn context(i: usize, placed: &[Placed], children: &[Vec<usize>], out: &mut Vec<usize>) {
        let (mut flow, mut layers) = (Vec::new(), Vec::new());
        collect(i, placed, children, &mut flow, &mut layers);
        let z = |c: &usize| placed[*c].node.z.unwrap_or(0.0);
        layers.sort_by(|a, b| z(a).partial_cmp(&z(b)).unwrap_or(std::cmp::Ordering::Equal));
        for &l in layers.iter().filter(|l| z(l) < 0.0) {
            out.push(l);
            context(l, placed, children, out);
        }
        out.extend(flow);
        for &l in layers.iter().filter(|l| z(l) >= 0.0) {
            out.push(l);
            context(l, placed, children, out);
        }
    }
    let mut out = vec![0];
    context(0, placed, &children, &mut out);
    out
}

fn finish<'a>(placed: Vec<Placed<'a>>, connectors: Vec<Routed<'a>>) -> SlideLayout<'a> {
    let order = paint_order(&placed);
    let mut slots: Vec<Option<Placed<'a>>> = placed.into_iter().map(Some).collect();
    let placed = order.into_iter().filter_map(|i| slots[i].take()).collect();
    SlideLayout { placed, connectors }
}

// ───────────── paginate (fit/paginate.ts) ─────────────

/// Máximo de partes de um slide paginado (DEFAULTS.paginate.maxParts).
const MAX_PARTS: usize = 10;

fn node_at<'n>(root: &'n mut Node, path: &[usize]) -> &'n mut Node {
    path.iter().fold(root, |n, &i| &mut n.children[i])
}

/// Clone do slide com os filhos absolutos de P (decoração vai em todas as partes) e os itens [start, end).
fn part_of(slide: &SlideSpec, path: &[usize], flow: &[usize], start: usize, end: usize) -> SlideSpec {
    let mut part = slide.clone();
    let p = node_at(&mut part.root, path);
    let keep: Vec<usize> = flow[start..end].to_vec();
    p.children = std::mem::take(&mut p.children).into_iter().enumerate().filter(|(i, c)| c.absolute || keep.contains(i)).map(|(_, c)| c).collect();
    part
}

/// A parte cabe se nada estoura dentro de P (os textos de P não encolhem enquanto pagina).
fn part_fits(part: &SlideSpec, fonts: &Fonts, path: &[usize]) -> bool {
    let placed = run(part, fonts, &Scales::new());
    // Índice de P na pré-ordem: anda pelo caminho contando as subárvores anteriores.
    let mut index = 0;
    let mut node = &part.root;
    for &i in path {
        index += 1 + node.children[..i].iter().map(count_nodes).sum::<usize>();
        node = &node.children[i];
    }
    let end = index + count_nodes(node);
    // Estouro de Box mora no contêiner (P conta: um filho passou dele); o resto, no próprio nó.
    crate::report::detect(&placed).iter().all(|o| {
        let inside = if o.kind == crate::report::Kind::Box { o.index >= index && o.index < end } else { o.index > index && o.index < end };
        !inside
    }) && placed.get(index).is_some()
}

fn count_nodes(node: &Node) -> usize {
    let own = 1;
    if matches!(node.kind, NodeKind::Container | NodeKind::Shape(_)) { own + node.children.iter().map(count_nodes).sum::<usize>() } else { own }
}

fn preorder_index(root: &Node, path: &[usize]) -> usize {
    let mut index = 0;
    let mut node = root;
    for &i in path {
        index += 1 + node.children[..i].iter().map(count_nodes).sum::<usize>();
        node = &node.children[i];
    }
    index
}

/// Text/Table paginate cabem se nenhum estouro mora neles ou num ancestral (o nó que cresce
/// empurra o pai): TEXT_BREAKS / TABLE_BREAKS de fit/paginate.ts.
fn node_fits<'a>(part: &'a SlideSpec, fonts: &Fonts, path: &[usize]) -> (bool, Vec<Placed<'a>>) {
    let placed = run(part, fonts, &Scales::new());
    let target = preorder_index(&part.root, path);
    let mut chain = vec![target];
    let mut i = target;
    while i != 0 {
        i = placed[i].parent;
        chain.push(i);
    }
    let ok = crate::report::detect(&placed).iter().all(|o| o.kind == crate::report::Kind::Slide || !chain.contains(&o.index));
    (ok, placed)
}

fn with_text_runs(slide: &SlideSpec, path: &[usize], runs: Vec<crate::model::StyledRun>) -> SlideSpec {
    let mut part = slide.clone();
    if let NodeKind::Text(t) = &mut node_at(&mut part.root, path).kind {
        t.runs = runs;
    }
    part
}

/// Divide os trechos no caractere `offset` (do conteúdo); o espaço/quebra da fronteira some dos dois lados.
fn split_runs(runs: &[crate::model::StyledRun], offset: usize) -> (Vec<crate::model::StyledRun>, Vec<crate::model::StyledRun>) {
    let is_break = |c: char| c.is_whitespace() && c != '\u{a0}';
    let (mut head, mut tail) = (Vec::new(), Vec::new());
    let mut at = 0;
    for r in runs {
        let chars: Vec<char> = r.text.chars().collect();
        let cut = offset.saturating_sub(at).min(chars.len());
        if cut > 0 {
            head.push(crate::model::StyledRun { text: chars[..cut].iter().collect(), ..r.clone() });
        }
        if cut < chars.len() {
            tail.push(crate::model::StyledRun { text: chars[cut..].iter().collect(), ..r.clone() });
        }
        at += chars.len();
    }
    while let Some(last) = head.last_mut() {
        let trimmed: String = last.text.trim_end_matches(is_break).to_string();
        if trimmed.is_empty() {
            head.pop();
        } else {
            last.text = trimmed;
            break;
        }
    }
    while let Some(first) = tail.first_mut() {
        let trimmed: String = first.text.trim_start_matches(is_break).to_string();
        if trimmed.is_empty() {
            tail.remove(0);
        } else {
            first.text = trimmed;
            break;
        }
    }
    (head, tail)
}

/// text-split.ts offsetAfterLines: as linhas perdem espaços de quebra; alinha pelos visíveis.
fn offset_after_lines(content: &[char], lines: &[String], count: usize) -> usize {
    let is_break = |c: char| c.is_whitespace() && c != '\u{a0}';
    let mut cursor = 0;
    for line in lines.iter().take(count) {
        for ch in line.chars().filter(|c| !is_break(*c)) {
            while cursor < content.len() && is_break(content[cursor]) {
                cursor += 1;
            }
            if cursor < content.len() && content[cursor] == ch {
                cursor += 1;
            }
        }
    }
    cursor
}

/// text-split.ts cutLineOf: fim de parágrafo se a parte não ficar com menos da metade; senão
/// dentro do parágrafo com pelo menos 2 linhas (órfãs) de cada lado.
fn cut_line(paragraph_lines: &[usize], fitting: usize) -> usize {
    const ORPHANS: usize = 2;
    let mut ends = Vec::new();
    let mut total = 0;
    for n in paragraph_lines {
        total += n;
        ends.push(total);
    }
    if fitting >= total {
        return total;
    }
    if let Some(&at) = ends.iter().rev().find(|&&e| e <= fitting)
        && at >= fitting.div_ceil(2) {
            return at;
        }
    let Some(pos) = ends.iter().position(|&e| e > fitting) else { return fitting.max(1) };
    let end = ends[pos];
    let start = if pos == 0 { 1 } else { ends[pos - 1] + 1 };
    let keep_after = fitting.min(end.saturating_sub(ORPHANS));
    if keep_after + 1 >= start + ORPHANS && keep_after >= start {
        return keep_after;
    }
    if start > 1 { start - 1 } else { fitting.max(1) }
}

fn paginate_text(slide: &SlideSpec, fonts: &Fonts, path: &[usize]) -> Option<Vec<(SlideSpec, usize)>> {
    let NodeKind::Text(text) = &node_at(&mut slide.clone().root, path).kind.clone() else { return None };
    let mut runs = text.runs.clone();
    let mut parts = Vec::new();
    loop {
        let whole = with_text_runs(slide, path, runs.clone());
        let (fits, placed) = node_fits(&whole, fonts, path);
        let index = preorder_index(&whole.root, path);
        let laid = &placed[index].text.as_ref()?.laid;
        let lines: Vec<String> = laid.paragraphs.iter().flatten().map(|l| l.iter().map(|p| p.text.as_str()).collect()).collect();
        let per_paragraph: Vec<usize> = laid.paragraphs.iter().map(Vec::len).collect();
        drop(placed);
        if fits || parts.len() + 1 >= MAX_PARTS || lines.len() <= 1 {
            parts.push((whole, lines.len()));
            break;
        }
        // Maior k cujas k primeiras linhas cabem, com o Text no corpo do autor.
        let content: Vec<char> = runs.iter().flat_map(|r| r.text.chars()).collect();
        let (mut lo, mut hi, mut best) = (1usize, lines.len() - 1, 0usize);
        while lo <= hi {
            let mid = (lo + hi).div_ceil(2);
            let (head, _) = split_runs(&runs, offset_after_lines(&content, &lines, mid));
            if node_fits(&with_text_runs(slide, path, head), fonts, path).0 {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if best == 0 {
            parts.push((whole, lines.len()));
            break;
        }
        let cut = cut_line(&per_paragraph, best);
        let (head, tail) = split_runs(&runs, offset_after_lines(&content, &lines, cut));
        parts.push((with_text_runs(slide, path, head), cut));
        if tail.is_empty() {
            break;
        }
        runs = tail;
    }
    (parts.len() > 1).then_some(parts)
}

fn with_table_rows(slide: &SlideSpec, path: &[usize], from: usize, to: usize, header: bool) -> SlideSpec {
    let mut part = slide.clone();
    if let NodeKind::Table(t) = &mut node_at(&mut part.root, path).kind {
        let mut rows: Vec<_> = if header { t.rows[..t.header_count].to_vec() } else { Vec::new() };
        rows.extend(t.rows[t.header_count + from..t.header_count + to].iter().cloned());
        t.header_count = if header { t.header_count } else { 0 };
        t.rows = rows;
    }
    part
}

fn paginate_table(slide: &SlideSpec, fonts: &Fonts, path: &[usize]) -> Option<Vec<(SlideSpec, usize)>> {
    let NodeKind::Table(table) = &node_at(&mut slide.clone().root, path).kind.clone() else { return None };
    let total = table.rows.len() - table.header_count;
    let mut parts = Vec::new();
    let mut from = 0;
    while from < total {
        let header = parts.is_empty() || table.repeat_header;
        let whole = with_table_rows(slide, path, from, total, header);
        if node_fits(&whole, fonts, path).0 || parts.len() + 1 >= MAX_PARTS {
            parts.push((whole, total - from));
            break;
        }
        let (mut lo, mut hi, mut best) = (from + 1, total - 1, 0);
        while lo <= hi {
            let mid = (lo + hi).div_ceil(2);
            if node_fits(&with_table_rows(slide, path, from, mid, header), fonts, path).0 {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if best == 0 {
            parts.push((whole, total - from));
            break;
        }
        parts.push((with_table_rows(slide, path, from, best, header), best - from));
        from = best;
    }
    (parts.len() > 1).then_some(parts)
}

fn paginated_of(node: &Node, kind: fn(&NodeKind) -> bool, path: &mut Vec<usize>) -> bool {
    if node.paginate && kind(&node.kind) {
        return true;
    }
    for (i, c) in node.children.iter().enumerate() {
        path.push(i);
        if paginated_of(c, kind, path) {
            return true;
        }
        path.pop();
    }
    false
}

/// Divide um slide com nó paginate que não cabe (Text: linhas; Table: linhas de dados; Box:
/// itens). None = sem paginate ou coube inteiro. Prioridade e regras de fit/paginate.ts.
/// O que pagina no slide (como `paginate` escolhe): o tipo ("text", "table", "box") e o path do nó.
pub fn paginate_target(slide: &SlideSpec) -> Option<(&'static str, String)> {
    let kinds: [(&'static str, fn(&NodeKind) -> bool); 3] = [
        ("text", |k| matches!(k, NodeKind::Text(_))),
        ("table", |k| matches!(k, NodeKind::Table(_))),
        ("box", |k| matches!(k, NodeKind::Container | NodeKind::Shape(_))),
    ];
    for (name, pred) in kinds {
        let mut path = Vec::new();
        if paginated_of(&slide.root, pred, &mut path) {
            let mut node = &slide.root;
            for &i in &path {
                node = &node.children[i];
            }
            return Some((name, node.label.clone()));
        }
    }
    None
}

pub fn paginate(slide: &SlideSpec, fonts: &Fonts) -> Option<Vec<(SlideSpec, usize)>> {
    let mut path = Vec::new();
    if paginated_of(&slide.root, |k| matches!(k, NodeKind::Text(_)), &mut path) {
        return paginate_text(slide, fonts, &path);
    }
    path.clear();
    if paginated_of(&slide.root, |k| matches!(k, NodeKind::Table(_)), &mut path) {
        return paginate_table(slide, fonts, &path);
    }
    path.clear();
    if !paginated_of(&slide.root, |k| matches!(k, NodeKind::Container | NodeKind::Shape(_)), &mut path) {
        return None;
    }
    paginate_box(slide, fonts, &path)
}

fn paginate_box(slide: &SlideSpec, fonts: &Fonts, path: &[usize]) -> Option<Vec<(SlideSpec, usize)>> {
    let path = path.to_vec();
    let mut probe = slide.clone();
    let flow: Vec<usize> = node_at(&mut probe.root, &path).children.iter().enumerate().filter(|(_, c)| !c.absolute).map(|(i, _)| i).collect();
    let mut parts = Vec::new();
    let mut start = 0;
    while start < flow.len() {
        let whole = part_of(slide, &path, &flow, start, flow.len());
        if part_fits(&whole, fonts, &path) || parts.len() + 1 >= MAX_PARTS {
            parts.push((whole, flow.len() - start));
            break;
        }
        // Maior k que cabe (busca binária); nenhum = tudo numa parte, com shrink.
        let (mut lo, mut hi, mut best) = (1, flow.len() - start - 1, 0);
        while lo <= hi {
            let mid = (lo + hi).div_ceil(2);
            if part_fits(&part_of(slide, &path, &flow, start, start + mid), fonts, &path) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if best == 0 {
            parts.push((whole, flow.len() - start));
            break;
        }
        parts.push((part_of(slide, &path, &flow, start, start + best), best));
        start += best;
    }
    (parts.len() > 1).then_some(parts)
}
