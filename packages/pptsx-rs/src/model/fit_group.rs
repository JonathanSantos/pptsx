//! Grupo de fit (`fitGroup`): os Text do slide com o mesmo nome terminam na mesma escala. Aqui só
//! o piso; quem iguala os corpos é o laço de ajuste (`layout.rs`).

use std::collections::HashMap;

use super::{Fit, Node, NodeKind, TextSpec};

/// O grupo de um Text que pode encolher; None = não participa (sem `fitGroup`, `fit` que não
/// encolhe ou SlideNumber).
pub fn group_of(t: &TextSpec) -> Option<&str> {
    if t.fit != Fit::Shrink || t.sample.is_some() {
        return None;
    }
    t.fit_group.as_deref()
}

/// Menor escala a que o grupo pode chegar: a do membro que menos pode encolher (o maior
/// minSize/fontSize). Com corpos de partida iguais, é o maior `minSize` do grupo.
pub(crate) fn floor_ratio(members: impl Iterator<Item = (f32, f32)>) -> f32 {
    members.map(|(size, min)| if size > 0.0 { (min / size).min(1.0) } else { 1.0 }).fold(0.0, f32::max)
}

fn collect<'n>(node: &'n mut Node, out: &mut Vec<&'n mut TextSpec>) {
    if let NodeKind::Text(t) = &mut node.kind
        && group_of(t).is_some()
    {
        out.push(t);
    }
    for child in &mut node.children {
        collect(child, out);
    }
}

/// Sobe o `min_size` de cada membro ao piso do grupo: ninguém desce abaixo da escala em que o
/// grupo para, então quem não coube ali cai nos diagnósticos de sempre (text-overflow no mínimo).
pub fn share_floors(root: &mut Node) {
    let mut texts = Vec::new();
    collect(root, &mut texts);
    if texts.is_empty() {
        return;
    }
    let mut floors: HashMap<String, f32> = HashMap::new();
    for t in &texts {
        let Some(name) = group_of(t) else { continue };
        let own = floor_ratio(std::iter::once((t.size, t.min_size)));
        floors.entry(name.to_string()).and_modify(|f| *f = f.max(own)).or_insert(own);
    }
    for t in texts {
        let Some(floor) = group_of(t).and_then(|name| floors.get(name)) else { continue };
        t.min_size = t.min_size.max(t.size * floor).min(t.size);
    }
}

#[cfg(test)]
mod tests {
    use super::floor_ratio;

    #[test]
    fn floor_is_the_least_shrinkable_member() {
        // 36 → 27 (0,75) e 36 → 18 (0,5): o grupo para em 0,75.
        let r = floor_ratio([(36.0, 27.0), (36.0, 18.0)].into_iter());
        assert!((r - 0.75).abs() < 1e-6);
    }

    #[test]
    fn floor_compares_scales_not_points() {
        // 40 → 20 (0,5) e 20 → 16 (0,8): vale a escala, não o maior minSize em pt.
        let r = floor_ratio([(40.0, 20.0), (20.0, 16.0)].into_iter());
        assert!((r - 0.8).abs() < 1e-6);
    }

    #[test]
    fn member_that_cannot_shrink_pins_the_group() {
        let r = floor_ratio([(36.0, 36.0), (36.0, 10.0)].into_iter());
        assert!((r - 1.0).abs() < 1e-6);
        assert!(floor_ratio(std::iter::empty()).abs() < 1e-6);
    }
}
