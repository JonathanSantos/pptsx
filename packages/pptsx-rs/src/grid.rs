//! Motor de grid puro, porta de `layout/grid.ts`: subconjunto do CSS Grid Level 1 (§7 tracks,
//! §8 placement, §11 track sizing). Não sabe nada de Yoga nem de texto: o tamanho de cada item
//! chega por contribuições já medidas. Fora do escopo: áreas nomeadas, subgrid, auto-fill/auto-fit,
//! dense, baseline e justify/align-content (a grade fica no início do contêiner). Os nomes e a
//! ordem das contas seguem o TS: a paridade com o pptsx depende de cada detalhe.

// ───────────────────────── tracks ─────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Breadth {
    Fixed(f32),
    Percent(f32),
    Auto,
    MinContent,
    MaxContent,
    Fr(f32),
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TrackSize {
    pub min: Breadth,
    pub max: Breadth,
}

pub const AUTO_TRACK: TrackSize = TrackSize { min: Breadth::Auto, max: Breadth::Auto };
const PERCENT_BASE: f32 = 100.0;

/// `1fr` = minmax(auto, 1fr) (CSS Grid §7.2.4); qualquer outro valor é min = max. O modelo já
/// entrega as trilhas assim (style.rs parse_tracks); aqui serve aos testes.
#[cfg(test)]
pub fn single_track(breadth: Breadth) -> TrackSize {
    match breadth {
        Breadth::Fr(_) => TrackSize { min: Breadth::Auto, max: breadth },
        other => TrackSize { min: other, max: other },
    }
}

// ───────────────────────── placement ─────────────────────────

/// Linhas 0-based: a área ocupa [row_start, row_end) × [column_start, column_end).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Area {
    pub row_start: usize,
    pub row_end: usize,
    pub column_start: usize,
    pub column_end: usize,
}

/// Uma linha do autor em `gridColumn`/`gridRow` (core/types GridLine).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LineSpec {
    Auto,
    /// 1-based; negativa conta do fim da grade explícita.
    Line(i32),
    Span(usize),
}

#[derive(Clone, Copy, Debug)]
pub struct PlacementInput {
    pub column: (LineSpec, LineSpec),
    pub row: (LineSpec, LineSpec),
}

#[derive(Clone, Copy, Debug)]
struct AxisPlacement {
    start: Option<usize>,
    span: usize,
}

/// Linha do autor (1-based; negativa conta do fim da grade explícita) → índice 0-based (pode ser negativo).
fn line_index(index: i32, explicit_tracks: usize) -> i64 {
    if index > 0 { i64::from(index) - 1 } else { explicit_tracks as i64 + 1 + i64::from(index) }
}

fn span_of(line: LineSpec) -> usize {
    match line {
        LineSpec::Span(count) => count,
        _ => 1,
    }
}

/// Uma dimensão de um item: início definido (ou não) e quantos tracks ocupa.
fn axis_of((start, end): (LineSpec, LineSpec), explicit_tracks: usize) -> AxisPlacement {
    match (start, end) {
        (LineSpec::Line(a), LineSpec::Line(b)) => {
            let (a, b) = (line_index(a, explicit_tracks), line_index(b, explicit_tracks));
            // Início depois do fim: o CSS troca os dois; iguais = span 1.
            AxisPlacement { start: Some(a.min(b).max(0) as usize), span: (b - a).unsigned_abs().max(1) as usize }
        }
        (LineSpec::Line(a), end) => AxisPlacement { start: Some(line_index(a, explicit_tracks).max(0) as usize), span: span_of(end) },
        (start, LineSpec::Line(b)) => {
            let span = span_of(start);
            AxisPlacement { start: Some((line_index(b, explicit_tracks) - span as i64).max(0) as usize), span }
        }
        (start, end) => AxisPlacement { start: None, span: span_of(start).max(span_of(end)) },
    }
}

struct Occupied(std::collections::HashSet<(usize, usize)>);

impl Occupied {
    fn fits(&self, row: usize, column: usize, row_span: usize, column_span: usize) -> bool {
        (row..row + row_span).all(|r| (column..column + column_span).all(|c| !self.0.contains(&(r, c))))
    }

    fn occupy(&mut self, area: Area) {
        for r in area.row_start..area.row_end {
            for c in area.column_start..area.column_end {
                self.0.insert((r, c));
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct Placed {
    pub areas: Vec<Area>,
    pub columns: usize,
    pub rows: usize,
}

fn area_of(row: usize, column: usize, row_span: usize, column_span: usize) -> Area {
    Area { row_start: row, row_end: row + row_span, column_start: column, column_end: column + column_span }
}

/// Placement (CSS Grid §8.5, fluxo `row`, sem `dense`): 1) itens com linha e coluna definidas;
/// 2) itens com linha definida, na 1ª coluna livre daquela linha; 3) o resto pelo cursor, que
/// só avança (sparse). O número de colunas é o explícito ou o que os itens exigirem.
pub fn place_items(items: &[PlacementInput], explicit_columns: usize, explicit_rows: usize) -> Placed {
    let axes: Vec<(AxisPlacement, AxisPlacement)> = items.iter().map(|item| (axis_of(item.column, explicit_columns), axis_of(item.row, explicit_rows))).collect();
    let columns = axes.iter().map(|(column, _)| column.start.unwrap_or(0) + column.span).fold(explicit_columns.max(1), usize::max);
    let mut occupied = Occupied(std::collections::HashSet::new());
    let mut areas: Vec<Option<Area>> = vec![None; items.len()];
    let mut place = |index: usize, area: Area, occupied: &mut Occupied| {
        areas[index] = Some(area);
        occupied.occupy(area);
    };

    for (index, (column, row)) in axes.iter().enumerate() {
        if let (Some(c), Some(r)) = (column.start, row.start) {
            place(index, area_of(r, c, row.span, column.span), &mut occupied);
        }
    }

    // Linha definida, coluna automática: cursor de coluna por linha (sparse).
    let mut row_cursors: std::collections::HashMap<usize, usize> = std::collections::HashMap::new();
    for (index, (column, row)) in axes.iter().enumerate() {
        let Some(r) = row.start else { continue };
        if column.start.is_some() {
            continue;
        }
        let mut col = row_cursors.get(&r).copied().unwrap_or(0);
        while col + column.span > columns || !occupied.fits(r, col, row.span, column.span) {
            col += 1;
            if col + column.span > columns {
                break;
            }
        }
        let start = col.min(columns.saturating_sub(column.span));
        place(index, area_of(r, start, row.span, column.span), &mut occupied);
        row_cursors.insert(r, start + column.span);
    }

    // Linha automática: o cursor percorre a grade em ordem de leitura.
    let mut cursor_row = 0;
    let mut cursor_column = 0;
    for (index, (column, row)) in axes.iter().enumerate() {
        if row.start.is_some() {
            continue;
        }
        if let Some(c) = column.start {
            if c < cursor_column {
                cursor_row += 1;
            }
            cursor_column = c;
            while !occupied.fits(cursor_row, cursor_column, row.span, column.span) {
                cursor_row += 1;
            }
            place(index, area_of(cursor_row, cursor_column, row.span, column.span), &mut occupied);
            continue;
        }
        let span = column.span.min(columns);
        loop {
            if cursor_column + span > columns {
                cursor_row += 1;
                cursor_column = 0;
                continue;
            }
            if occupied.fits(cursor_row, cursor_column, row.span, span) {
                break;
            }
            cursor_column += 1;
        }
        place(index, area_of(cursor_row, cursor_column, row.span, span), &mut occupied);
        cursor_column += span;
    }

    let placed: Vec<Area> = areas.into_iter().map(|a| a.expect("todo item recebe área")).collect();
    let rows = placed.iter().map(|a| a.row_end).fold(explicit_rows, usize::max);
    Placed { areas: placed, columns, rows }
}

// ───────────────────────── track sizing ─────────────────────────

/// Contribuições de um item num eixo (já com margens).
#[derive(Clone, Copy, Debug)]
pub struct Contribution {
    pub min: f32,
    pub max: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct SizingItem {
    pub start: usize,
    pub end: usize,
    pub contribution: Contribution,
}

#[derive(Clone, Copy, Debug)]
struct Track {
    size: TrackSize,
    base: f32,
    /// Infinito = sem limite (máximo intrínseco ainda não definido, ou fr).
    growth: f32,
}

fn is_intrinsic(breadth: Breadth) -> bool {
    matches!(breadth, Breadth::Auto | Breadth::MinContent | Breadth::MaxContent)
}

fn is_flexible(track: TrackSize) -> bool {
    matches!(track.max, Breadth::Fr(_))
}

fn resolve_breadth(breadth: Breadth, available: Option<f32>) -> Option<f32> {
    match (breadth, available) {
        (Breadth::Fixed(v), _) => Some(v),
        (Breadth::Percent(p), Some(a)) => Some(p / PERCENT_BASE * a),
        _ => None,
    }
}

/// §11.4: base pelo mínimo fixo (senão 0); limite pelo máximo fixo (senão infinito).
fn init_track(size: TrackSize, available: Option<f32>) -> Track {
    let min = resolve_breadth(size.min, available).unwrap_or(0.0);
    let growth = resolve_breadth(size.max, available).map_or(f32::INFINITY, |max| max.max(min));
    Track { size, base: min, growth }
}

fn sum(values: impl Iterator<Item = f32>) -> f32 {
    values.sum()
}

#[derive(Clone, Copy)]
enum Field {
    Base,
    Growth,
}

fn get(track: &Track, field: Field) -> f32 {
    match field {
        Field::Base => track.base,
        Field::Growth => track.growth,
    }
}

fn add(track: &mut Track, field: Field, amount: f32) {
    match field {
        Field::Base => track.base += amount,
        Field::Growth => track.growth += amount,
    }
}

/// Distribui `extra` igualmente entre os tracks (o que sobra de quem bate no teto vai aos outros).
/// `beyond_caps`: no dimensionamento intrínseco o item TEM que caber (o resto passa dos tetos,
/// §11.5.1); no maximizar, o que não cabe nos tetos continua livre.
fn distribute(tracks: &mut [Track], targets: &[usize], extra: f32, field: Field, cap: impl Fn(&Track) -> f32, beyond_caps: bool) {
    let mut remaining = extra;
    let mut open: Vec<usize> = targets.iter().copied().filter(|&i| cap(&tracks[i]) > get(&tracks[i], field)).collect();
    while remaining > 1e-9 && !open.is_empty() {
        let share = remaining / open.len() as f32;
        for &i in &open {
            let room = cap(&tracks[i]) - get(&tracks[i], field);
            let amount = share.min(room);
            add(&mut tracks[i], field, amount);
            remaining -= amount;
        }
        open.retain(|&i| cap(&tracks[i]) - get(&tracks[i], field) > 1e-9);
    }
    if beyond_caps && remaining > 1e-9 && !targets.is_empty() {
        let share = remaining / targets.len() as f32;
        for &i in targets {
            add(&mut tracks[i], field, share);
        }
    }
}

fn finite_growth(track: &Track) -> f32 {
    if track.growth.is_finite() { track.growth } else { track.base }
}

fn spanned(item: &SizingItem) -> std::ops::Range<usize> {
    item.start..item.end
}

/// §11.5 resolver tamanhos intrínsecos: itens de span 1 primeiro, depois os que atravessam
/// vários tracks (em ordem de span), e por último os que atravessam tracks flexíveis (só
/// aumentam a base dos fr, pelo mínimo). Em cada caso, o mínimo intrínseco recebe a contribuição
/// mínima e o máximo intrínseco a máxima.
fn resolve_intrinsic(tracks: &mut [Track], items: &[SizingItem], gap: f32) {
    let crosses_flex = |tracks: &[Track], item: &SizingItem| spanned(item).any(|i| is_flexible(tracks[i].size));
    let mut by_span: Vec<&SizingItem> = items.iter().filter(|item| !crosses_flex(tracks, item)).collect();
    by_span.sort_by_key(|item| item.end - item.start);

    for item in by_span {
        let targets: Vec<usize> = spanned(item).collect();
        let gaps = gap * (targets.len() as f32 - 1.0);
        let min_targets: Vec<usize> = targets.iter().copied().filter(|&i| is_intrinsic(tracks[i].size.min)).collect();
        let min_wanted = |track: &Track| if track.size.min == Breadth::MaxContent { item.contribution.max } else { item.contribution.min };
        if targets.len() == 1 && min_targets.len() == 1 {
            let i = min_targets[0];
            tracks[i].base = tracks[i].base.max(min_wanted(&tracks[i]));
        } else if !min_targets.is_empty() {
            let extra = (item.contribution.min - sum(targets.iter().map(|&i| tracks[i].base)) - gaps).max(0.0);
            distribute(tracks, &min_targets, extra, Field::Base, |_| f32::INFINITY, true);
        }
        for &i in &targets {
            if tracks[i].growth < tracks[i].base {
                tracks[i].growth = tracks[i].base;
            }
        }
        let max_targets: Vec<usize> = targets.iter().copied().filter(|&i| is_intrinsic(tracks[i].size.max)).collect();
        let max_wanted = |track: &Track| if track.size.max == Breadth::MinContent { item.contribution.min } else { item.contribution.max };
        if targets.len() == 1 && max_targets.len() == 1 {
            let i = max_targets[0];
            let current = if tracks[i].growth.is_finite() && tracks[i].growth > tracks[i].base { tracks[i].growth } else { tracks[i].base };
            tracks[i].growth = current.max(max_wanted(&tracks[i]));
        } else if !max_targets.is_empty() {
            for &i in &max_targets {
                if !tracks[i].growth.is_finite() {
                    tracks[i].growth = tracks[i].base;
                }
            }
            let extra = (item.contribution.max - sum(targets.iter().map(|&i| finite_growth(&tracks[i]))) - gaps).max(0.0);
            distribute(tracks, &max_targets, extra, Field::Growth, |_| f32::INFINITY, true);
        }
    }

    // §11.5 passo 4: só fr com mínimo intrínseco (o `1fr` = minmax(auto, 1fr)); minmax(0, 1fr) ignora o conteúdo.
    let flex_items: Vec<&SizingItem> = items.iter().filter(|item| crosses_flex(tracks, item)).collect();
    for item in flex_items {
        let targets: Vec<usize> = spanned(item).collect();
        let flex: Vec<usize> = targets.iter().copied().filter(|&i| is_flexible(tracks[i].size) && is_intrinsic(tracks[i].size.min)).collect();
        let extra = (item.contribution.min - sum(targets.iter().map(|&i| tracks[i].base)) - gap * (targets.len() as f32 - 1.0)).max(0.0);
        distribute(tracks, &flex, extra, Field::Base, |_| f32::INFINITY, true);
    }

    // Limite ainda infinito num máximo intrínseco sem item: fica igual à base (§11.5 passo 4).
    for track in tracks.iter_mut() {
        if !is_flexible(track.size) && !track.growth.is_finite() {
            track.growth = track.base;
        }
        if track.growth < track.base {
            track.growth = track.base;
        }
    }
}

/// §11.6 maximizar: o espaço livre sobe as bases até o limite (só com tamanho definido).
fn maximize(tracks: &mut [Track], free: f32) {
    let targets: Vec<usize> = (0..tracks.len()).filter(|&i| !is_flexible(tracks[i].size) && tracks[i].growth > tracks[i].base).collect();
    distribute(tracks, &targets, free, Field::Base, |track| track.growth, false);
}

fn flex_of(track: &Track) -> f32 {
    match track.size.max {
        Breadth::Fr(v) => v,
        _ => 0.0,
    }
}

/// §11.7.1 tamanho do fr: tracks cuja base passa do quinhão saem do rateio, iterativamente.
fn fr_size(tracks: &[Track], space: f32) -> f32 {
    let flex: Vec<usize> = (0..tracks.len()).filter(|&i| is_flexible(tracks[i].size)).collect();
    let mut inflexible: Vec<usize> = Vec::new();
    loop {
        let active: Vec<usize> = flex.iter().copied().filter(|i| !inflexible.contains(i)).collect();
        let leftover = space - sum((0..tracks.len()).filter(|i| !is_flexible(tracks[*i].size) || inflexible.contains(i)).map(|i| tracks[i].base));
        let factors = sum(active.iter().map(|&i| flex_of(&tracks[i])));
        let hypothetical = leftover / factors.max(1.0);
        let too_big: Vec<usize> = active.iter().copied().filter(|&i| tracks[i].base > hypothetical * flex_of(&tracks[i])).collect();
        if too_big.is_empty() {
            return hypothetical.max(0.0);
        }
        inflexible.extend(too_big);
    }
}

/// §11.7 expandir fr: com tamanho definido, rateio do espaço; sem, o maior "base / fator" dos itens.
fn expand_flexible(tracks: &mut [Track], items: &[SizingItem], available: Option<f32>, gap: f32) {
    let flex: Vec<usize> = (0..tracks.len()).filter(|&i| is_flexible(tracks[i].size)).collect();
    if flex.is_empty() {
        return;
    }
    let gaps = gap * (tracks.len() as f32 - 1.0).max(0.0);
    let unit = match available {
        Some(a) => fr_size(tracks, a - gaps),
        None => {
            let from_tracks = flex.iter().map(|&i| tracks[i].base / flex_of(&tracks[i]).max(1.0));
            let from_items = items.iter().filter(|item| spanned(item).any(|i| is_flexible(tracks[i].size))).map(|item| {
                let targets: Vec<usize> = spanned(item).collect();
                let fixed = sum(targets.iter().filter(|&&i| !is_flexible(tracks[i].size)).map(|&i| tracks[i].base)) + gap * (targets.len() as f32 - 1.0);
                let factors = sum(targets.iter().filter(|&&i| is_flexible(tracks[i].size)).map(|&i| flex_of(&tracks[i])));
                (item.contribution.max - fixed) / factors.max(1.0)
            });
            from_tracks.chain(from_items).fold(0.0, f32::max)
        }
    };
    for &i in &flex {
        tracks[i].base = tracks[i].base.max(unit * flex_of(&tracks[i]));
    }
}

/// §11.8 esticar tracks auto: com tamanho definido, o que sobra vai igual para os de máximo auto.
fn stretch_auto(tracks: &mut [Track], free: f32) {
    let autos: Vec<usize> = (0..tracks.len()).filter(|&i| tracks[i].size.max == Breadth::Auto).collect();
    if free <= 0.0 || autos.is_empty() {
        return;
    }
    let share = free / autos.len() as f32;
    for &i in &autos {
        tracks[i].base += share;
    }
}

/// Tamanhos dos tracks de um eixo. `available` = tamanho de conteúdo definido do contêiner nesse
/// eixo (None = indefinido: a grade fica com o tamanho do conteúdo).
pub fn size_tracks(sizes: &[TrackSize], items: &[SizingItem], available: Option<f32>, gap: f32) -> Vec<f32> {
    let mut tracks: Vec<Track> = sizes.iter().map(|&size| init_track(size, available)).collect();
    resolve_intrinsic(&mut tracks, items, gap);
    let gaps = gap * (tracks.len() as f32 - 1.0).max(0.0);
    if let Some(a) = available {
        let free = a - gaps - sum(tracks.iter().map(|t| t.base));
        maximize(&mut tracks, free);
    }
    expand_flexible(&mut tracks, items, available, gap);
    if let Some(a) = available {
        let free = a - gaps - sum(tracks.iter().map(|t| t.base));
        stretch_auto(&mut tracks, free);
    }
    tracks.iter().map(|t| t.base).collect()
}

/// Tracks explícitos + implícitos (gridAutoRows/Columns em ciclo) até `count`.
pub fn tracks_for(explicit: &[TrackSize], auto: &[TrackSize], count: usize) -> Vec<TrackSize> {
    let auto = if auto.is_empty() { &[AUTO_TRACK][..] } else { auto };
    (0..count.max(explicit.len())).map(|i| if i < explicit.len() { explicit[i] } else { auto[(i - explicit.len()) % auto.len()] }).collect()
}

/// Posições (início) de cada track a partir de 0.
pub fn offsets_of(sizes: &[f32], gap: f32) -> Vec<f32> {
    let mut out = Vec::with_capacity(sizes.len());
    let mut at = 0.0;
    for (i, size) in sizes.iter().enumerate() {
        if i > 0 {
            at += sizes[i - 1] + gap;
        }
        let _ = size;
        out.push(at);
    }
    out
}

/// Retângulo de uma área (relativo à origem da área de conteúdo): x, y, largura, altura.
pub fn area_rect(area: Area, columns: &[f32], rows: &[f32], column_gap: f32, row_gap: f32) -> (f32, f32, f32, f32) {
    let column_offsets = offsets_of(columns, column_gap);
    let row_offsets = offsets_of(rows, row_gap);
    let span = |sizes: &[f32], start: usize, end: usize, gap: f32| sum(sizes[start.min(sizes.len())..end.min(sizes.len())].iter().copied()) + gap * (end as f32 - start as f32 - 1.0).max(0.0);
    (
        column_offsets.get(area.column_start).copied().unwrap_or(0.0),
        row_offsets.get(area.row_start).copied().unwrap_or(0.0),
        span(columns, area.column_start, area.column_end, column_gap),
        span(rows, area.row_start, area.row_end, row_gap),
    )
}

pub fn total_of(sizes: &[f32], gap: f32) -> f32 {
    sum(sizes.iter().copied()) + gap * (sizes.len() as f32 - 1.0).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fr(v: f32) -> TrackSize {
        single_track(Breadth::Fr(v))
    }

    #[test]
    fn three_equal_columns_share_the_width() {
        let tracks = [fr(1.0), fr(1.0), fr(1.0)];
        let items = [0, 1, 2].map(|i| SizingItem { start: i, end: i + 1, contribution: Contribution { min: 10.0, max: 50.0 } });
        assert_eq!(size_tracks(&tracks, &items, Some(320.0), 10.0), vec![100.0, 100.0, 100.0]);
    }

    #[test]
    fn minmax_zero_ignores_content_but_auto_fr_does_not() {
        let items = [SizingItem { start: 0, end: 1, contribution: Contribution { min: 200.0, max: 300.0 } }, SizingItem { start: 1, end: 2, contribution: Contribution { min: 10.0, max: 20.0 } }];
        let zero = [TrackSize { min: Breadth::Fixed(0.0), max: Breadth::Fr(1.0) }, TrackSize { min: Breadth::Fixed(0.0), max: Breadth::Fr(1.0) }];
        assert_eq!(size_tracks(&zero, &items, Some(100.0), 0.0), vec![50.0, 50.0]);
        let auto = [fr(1.0), fr(1.0)];
        let sized = size_tracks(&auto, &items, Some(100.0), 0.0);
        assert!(sized[0] >= 200.0 && sized[1] >= 10.0, "{sized:?}");
    }

    #[test]
    fn sparse_placement_fills_rows_in_reading_order() {
        let auto = PlacementInput { column: (LineSpec::Auto, LineSpec::Auto), row: (LineSpec::Auto, LineSpec::Auto) };
        let wide = PlacementInput { column: (LineSpec::Span(2), LineSpec::Auto), row: (LineSpec::Auto, LineSpec::Auto) };
        let placed = place_items(&[auto, wide, auto], 2, 0);
        assert_eq!(placed.columns, 2);
        assert_eq!(placed.rows, 3);
        assert_eq!(placed.areas[1], Area { row_start: 1, row_end: 2, column_start: 0, column_end: 2 });
    }

    #[test]
    fn negative_lines_count_from_the_end() {
        let item = PlacementInput { column: (LineSpec::Line(1), LineSpec::Line(-1)), row: (LineSpec::Auto, LineSpec::Auto) };
        let placed = place_items(&[item], 3, 0);
        assert_eq!(placed.areas[0].column_end, 3);
    }
}
