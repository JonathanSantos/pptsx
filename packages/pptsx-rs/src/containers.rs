//! M19 (containers.ts): resolve com `<Container>`. Cada passada resolve o deck com as medidas que
//! já existem, faz o layout só dos slides que ainda têm Container sem medida, mede o espaço de
//! cada um e resolve de novo. Sem Container a 1ª passada já é a final (custo e saída de antes).

use std::cell::RefCell;
use std::path::Path;
use std::rc::Rc;

use crate::diag::{Diag, Diags, Level};
use crate::js::value::LAYOUT_KEY;
use crate::js::{DeckCtx, Element, Kind, Value};
use crate::model::{ContainerRun, DeckSpec};
use crate::text::Fonts;
use crate::validate::Fatal;

/// DEFAULTS.containerQuery.maxDepth: níveis de Container aninhado (uma passada a mais por nível).
const MAX_DEPTH: usize = 3;

/// Menor que isto o espaço é "sem tamanho": o pai depende do conteúdo, que o Container não dá.
const UNSIZED_PT: f64 = 0.5;

const UNSIZED: &str = "O Container recebeu largura ou altura 0: o tamanho dele vem do pai (contenção de tamanho), não do conteúdo. Dê flex, width/height ou ponha-o numa célula de grid com tamanho.";

/// O deck resolvido com os Containers medidos e os diagnósticos do resolve (os de Container
/// primeiro, como no pptsx). Erro do resolve (ResolveError) para o build.
pub fn resolve(deck: &Element, ctx: &DeckCtx, deck_path: &Path, fonts: &Fonts, run: &RefCell<ContainerRun>) -> Result<(DeckSpec, Diags), Fatal> {
    run.borrow_mut().measures.clear();
    let mut own: Vec<Diag> = Vec::new();
    let mut pass = 0;
    loop {
        run.borrow_mut().reset();
        let diags = Diags::default();
        let spec = crate::model::resolve_deck(deck, ctx, deck_path, &diags, Some(run));
        if let Some(f) = spec.fatal.clone() {
            return Err(f);
        }
        let pending = run.borrow().pending.clone();
        if pending.is_empty() {
            return Ok((spec, with_first(own, diags)));
        }
        if pass >= MAX_DEPTH {
            own.extend(pending.iter().map(|(slide, path)| {
                Diag::new(Level::Error, "container-depth", slide + 1, path.clone(), format!("Containers aninhados além de {MAX_DEPTH} níveis: este ficou vazio. Achate a composição ou meça uma vez só no nível de fora."))
            }));
            return Ok((spec, with_first(own, diags)));
        }
        let mut slides: Vec<usize> = pending.iter().map(|(s, _)| *s).collect();
        slides.dedup();
        for slide in slides {
            let paths: Vec<String> = pending.iter().filter(|(s, _)| *s == slide).map(|(_, p)| p.clone()).collect();
            for (path, measure) in crate::layout::container_measures(&spec.slides[slide], fonts, &paths) {
                if measure.content.0 < UNSIZED_PT || measure.content.1 < UNSIZED_PT {
                    own.push(Diag::new(Level::Warn, "container-unsized", slide + 1, path.clone(), UNSIZED));
                }
                run.borrow_mut().measures.insert((slide, path), measure);
            }
        }
        pass += 1;
    }
}

fn with_first(first: Vec<Diag>, rest: Diags) -> Diags {
    let out = Diags::default();
    out.extend(first);
    out.extend(rest.into_vec());
    out
}

/// O deck com o conteúdo que cada função de Container devolveu no lugar da função (para o lint,
/// que anda nos elementos). Containers sem medida (ou no Fixed/Footer) ficam vazios.
pub fn filled_deck(deck: &Element, run: &ContainerRun) -> Rc<Element> {
    let footer = deck.props.get("footer").is_some_and(|f| !matches!(f, Value::Undefined | Value::Null | Value::Bool(false)));
    let mut index = 0;
    let children = deck
        .children
        .iter()
        .map(|c| match c {
            Value::Element(slide) if slide.kind == Kind::Slide => {
                let path = crate::model::segment_of(slide);
                let fixed = matches!(slide.props.get(LAYOUT_KEY), Some(Value::Object(o)) if o.get("fixed").is_some_and(|v| !matches!(v, Value::Undefined | Value::Null | Value::Bool(false))));
                let extra: Vec<&str> = [fixed.then_some("Fixed"), footer.then_some("Footer")].into_iter().flatten().collect();
                let filled = fill(slide, &path, &extra, index, run);
                index += 1;
                Value::Element(filled)
            }
            other => other.clone(),
        })
        .collect();
    Rc::new(Element { kind: deck.kind, props: deck.props.clone(), children, component: deck.component, source: deck.source.clone() })
}

fn fill(el: &Rc<Element>, path: &str, extra: &[&str], slide: usize, run: &ContainerRun) -> Rc<Element> {
    let children: Vec<Value> = if el.kind == Kind::Container {
        run.filled.get(&(slide, path.to_string())).cloned().unwrap_or_default()
    } else {
        el.children.clone()
    };
    if !matches!(el.kind, Kind::Slide | Kind::Box | Kind::Container) {
        return el.clone();
    }
    let (paths, _) = crate::model::child_paths(path, &children, extra);
    let mut k = 0;
    let children = children
        .iter()
        .map(|c| match c {
            Value::Element(e) => {
                k += 1;
                Value::Element(fill(e, &paths[k - 1], &[], slide, run))
            }
            other => other.clone(),
        })
        .collect();
    Rc::new(Element { kind: el.kind, props: el.props.clone(), children, component: el.component, source: el.source.clone() })
}
