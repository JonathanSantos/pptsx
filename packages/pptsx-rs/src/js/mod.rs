//! Frontend: TSX → árvore de elementos, sem motor JS.
//!
//! O `oxc` só faz o parse; quem executa é um avaliador de AST de um **subconjunto** do
//! TS/JSX (funções puras, `const`/`let`, desestruturação, spread, JSX, métodos de array e
//! string). Fora do subconjunto (classes, async, `this`, mutação de objetos, IO) é erro com
//! arquivo:linha:coluna. Um orçamento de passos garante que todo deck termina.

mod builtins;
mod interp;
mod jsx;
mod module;
mod node;
mod regex;
pub mod value;

use std::path::Path;

pub use builtins::parse_json;
pub use interp::Interp;
pub use value::{Element, Kind, Value};

/// Erro do avaliador com posição (módulo + offset em bytes) quando conhecida.
pub struct JsError {
    pub msg: String,
    pub at: Option<(usize, u32)>,
}

pub enum Throw {
    Error(JsError),
    /// Curto-circuito de `?.`: sobe até a ChainExpression mais próxima.
    Short,
}

pub type R<T> = Result<T, Throw>;

pub fn fail<T>(msg: impl Into<String>) -> R<T> {
    Err(Throw::Error(JsError { msg: msg.into(), at: None }))
}

/// Contexto do tamanho do slide passado a `defineDeck(ctx => …)`.
#[derive(Clone)]
pub struct DeckCtx {
    pub name: String,
    pub width: f64,
    pub height: f64,
}

impl DeckCtx {
    pub fn aspect(&self) -> f64 {
        self.width / self.height
    }

    pub fn scale(&self) -> f64 {
        (self.width / 720.0).min(self.height / 405.0)
    }
}

/// Resolve um valor responsivo (`{ base, tall, wide, <preset> }`) para o tamanho.
pub fn value_pick(v: &Value, ctx: &DeckCtx) -> Value {
    builtins::pick_responsive(v, &ctx.name, ctx.aspect(), ctx.scale())
}

/// `<Table cell={fn}>` (M14): a função do autor roda aqui, ainda no avaliador, e o resultado
/// (Partial<TableCellSpec>) é mesclado em cada célula. Depois disso a árvore não tem mais JS.
fn apply_cell_callbacks(it: &mut Interp, v: &Value) -> R<Value> {
    use std::rc::Rc;
    let Value::Element(e) = v else { return Ok(v.clone()) };
    let mut changed = false;
    let mut children = Vec::with_capacity(e.children.len());
    for c in &e.children {
        let n = apply_cell_callbacks(it, c)?;
        changed |= !value::strict_eq(&n, c);
        children.push(n);
    }
    let mut props = (*e.props).clone();
    if e.kind == Kind::Table
        && let Some(f @ Value::Func(_)) = props.shift_remove("cell") {
            let merge = |it: &mut Interp, cell: &Value, row: usize, col: usize, header: bool| -> R<Value> {
                let mut ctx = value::Obj::new();
                ctx.insert(Rc::from("row"), Value::Num(row as f64));
                ctx.insert(Rc::from("col"), Value::Num(col as f64));
                ctx.insert(Rc::from("value"), cell.clone());
                ctx.insert(Rc::from("header"), Value::Bool(header));
                let Value::Object(patch) = it.call(&f, vec![value::obj_val(ctx)])? else { return Ok(cell.clone()) };
                let mut out = match cell {
                    Value::Object(o) => (**o).clone(),
                    Value::Undefined | Value::Null => value::Obj::new(),
                    other => {
                        let mut o = value::Obj::new();
                        o.insert(Rc::from("text"), other.clone());
                        o
                    }
                };
                for (k, v) in patch.iter() {
                    out.insert(k.clone(), v.clone());
                }
                Ok(value::obj_val(out))
            };
            let mut header_index = 0;
            if let Some(Value::Array(rows)) = props.get("headerRows").cloned() {
                let mapped = rows.borrow().iter().map(|r| match r {
                    Value::Array(cells) => {
                        let out = cells.borrow().iter().enumerate().map(|(c, v)| merge(it, v, header_index, c, true)).collect::<R<Vec<_>>>()?;
                        header_index += 1;
                        Ok(value::arr_val(out))
                    }
                    other => Ok(other.clone()),
                }).collect::<R<Vec<_>>>()?;
                props.insert(Rc::from("headerRows"), value::arr_val(mapped));
            }
            if !matches!(props.get("header"), Some(Value::Bool(false)))
                && let Some(Value::Array(cols)) = props.get("columns").cloned() {
                    let mapped = cols.borrow().iter().enumerate().map(|(c, col)| match col {
                        Value::Object(o) => {
                            let mut o = (**o).clone();
                            let h = o.get("header").cloned().unwrap_or(Value::Undefined);
                            o.insert(Rc::from("header"), merge(it, &h, header_index, c, true)?);
                            Ok(value::obj_val(o))
                        }
                        other => Ok(other.clone()),
                    }).collect::<R<Vec<_>>>()?;
                    props.insert(Rc::from("columns"), value::arr_val(mapped));
                }
            if let Some(Value::Array(rows)) = props.get("rows").cloned() {
                // `col` é a coluna da grade: pula as cobertas por rowSpan de linhas de cima.
                let mut covered: Vec<usize> = Vec::new();
                let span_of = |v: &Value, key: &str| match v {
                    Value::Object(o) => o.get(key).map_or(1, |n| n.to_num().max(1.0) as usize),
                    _ => 1,
                };
                let mut mapped = Vec::new();
                for (r, row) in rows.borrow().iter().enumerate() {
                    let Value::Array(cells) = row else {
                        mapped.push(row.clone());
                        continue;
                    };
                    let mut col = 0;
                    let mut out = Vec::new();
                    for v in cells.borrow().iter() {
                        while covered.get(col).is_some_and(|&n| n > 0) {
                            col += 1;
                        }
                        out.push(merge(it, v, r, col, false)?);
                        let (cs, rs) = (span_of(v, "colSpan"), span_of(v, "rowSpan"));
                        if covered.len() < col + cs {
                            covered.resize(col + cs, 0);
                        }
                        covered[col..col + cs].iter_mut().for_each(|n| *n = rs);
                        col += cs;
                    }
                    covered.iter_mut().for_each(|n| *n = n.saturating_sub(1));
                    mapped.push(value::arr_val(out));
                }
                props.insert(Rc::from("rows"), value::arr_val(mapped));
            }
            changed = true;
        }
    if !changed {
        return Ok(v.clone());
    }
    Ok(Value::Element(Rc::new(Element { kind: e.kind, props: Rc::new(props), children, component: e.component, source: e.source.clone() })))
}

/// M19: chama a função de um `<Container>` com o espaço medido e devolve os filhos achatados
/// (com os `cell` de Table já aplicados, como no resto da árvore).
pub fn call_container(interp: &mut Interp, f: &Value, width: f64, height: f64, ctx: &DeckCtx) -> Result<Vec<Value>, String> {
    interp.refuel();
    let run = |it: &mut Interp| -> R<Vec<Value>> {
        let out = it.call(f, vec![builtins::container_box(width, height, ctx)])?;
        let mut flat = Vec::new();
        jsx::normalize_children(vec![out], &mut flat)?;
        flat.iter().map(|v| apply_cell_callbacks(it, v)).collect()
    };
    run(interp).map_err(|t| interp.describe(t))
}

impl Interp {
    /// Leitura de arquivo pelo deck (`node:fs`): só dentro da pasta de um módulo já carregado (o
    /// deck, a config, os módulos e DS que eles importaram) ou de um `node_modules` acima de um
    /// deles. Qualquer outro caminho é erro: um deck não lê o disco de quem o compila.
    pub fn allows(&self, path: &Path) -> bool {
        let canonical = match std::fs::canonicalize(path) {
            Ok(p) => p,
            // Ainda não existe (existsSync): decide pela pasta mais próxima que existe.
            Err(_) => match path.parent().and_then(|p| std::fs::canonicalize(p).ok()) {
                Some(parent) => parent.join(path.file_name().unwrap_or_default()),
                None => return false,
            },
        };
        self.modules.iter().filter_map(|m| m.path.parent()).any(|dir| {
            // A pasta do pacote (o ancestral mais próximo com package.json: um DS lê guide/ ao lado
            // de dist/), senão a do próprio módulo.
            let root = dir.ancestors().find(|a| a.join("package.json").is_file()).unwrap_or(dir);
            if canonical.starts_with(root) {
                return true;
            }
            dir.ancestors().any(|a| canonical.starts_with(a.join("node_modules")))
        })
    }
}

/// Avalia um módulo (ex.: pptsx.config.ts) e devolve o export default.
pub fn evaluate_default(path: &Path) -> Result<Value, String> {
    let mut interp = Interp::new();
    let exports = interp.load_entry(path).map_err(|t| interp.describe(t))?;
    Ok(exports.get("default").cloned().unwrap_or(Value::Undefined))
}

/// Como `evaluate_default`, mas devolve também o avaliador: as funções do módulo (regras de
/// lint da config e dos DS) só podem ser chamadas pelo avaliador que as criou.
pub fn evaluate_module(path: &Path) -> Result<(Interp, Value), String> {
    let mut interp = Interp::new();
    let exports = interp.load_entry(path).map_err(|t| interp.describe(t))?;
    let default = exports.get("default").cloned().unwrap_or(Value::Undefined);
    Ok((interp, default))
}

/// Resolve um especificador de import (`./ds/src/index.ts`, `@marca/ds`) a partir de uma pasta,
/// como o deck resolveria (relativo, ou pacote em node_modules subindo as pastas).
pub fn resolve_import(from_dir: &Path, spec: &str) -> Option<std::path::PathBuf> {
    module::resolve(from_dir, spec)
}

/// Avalia um módulo e devolve o avaliador e todos os exports (`ds` nomeado ou `default`).
pub fn evaluate_exports(path: &Path) -> Result<(Interp, std::rc::Rc<value::Obj>), String> {
    let mut interp = Interp::new();
    let exports = interp.load_entry(path).map_err(|t| interp.describe(t))?;
    Ok((interp, exports))
}

/// Chama uma função JS (regra de lint) com mensagem de erro legível.
pub fn call_function(interp: &mut Interp, f: &Value, args: Vec<Value>) -> Result<Value, String> {
    interp.refuel();
    interp.call(f, args).map_err(|t| interp.describe(t))
}

pub use module::THEME_DEFAULTS;

/// Achata filhos (arrays, fragments) como o JSX faz; para o footer do Deck.
pub fn normalize(values: Vec<Value>, out: &mut Vec<Value>) -> R<()> {
    jsx::normalize_children(values, out)
}

/// Carrega o deck e devolve o elemento `<Deck>` avaliado para cada contexto, mais o avaliador:
/// as funções dos `<Container>` (M19) rodam depois do layout, no avaliador que as criou. `deps`
/// recebe os arquivos que a avaliação leu (deck e módulos importados), mesmo quando ela falha: é
/// o que o `--watch` observa.
pub fn evaluate_deck_with(path: &Path, ctxs: &[DeckCtx], deps: &mut Vec<std::path::PathBuf>) -> Result<(Interp, Vec<std::rc::Rc<Element>>), String> {
    let mut interp = Interp::new();
    let loaded = interp.load_entry(path);
    deps.extend(interp.modules.iter().map(|m| m.path.clone()));
    let exports = loaded.map_err(|t| interp.describe(t))?;
    let default = exports.get("default").cloned().unwrap_or(Value::Undefined);
    ctxs.iter()
        .map(|ctx| {
            let deck = interp.instantiate_deck(&default, ctx).map_err(|t| interp.describe(t))?;
            let deck = apply_cell_callbacks(&mut interp, &deck).map_err(|t| interp.describe(t))?;
            match deck {
                Value::Element(e) if e.kind == Kind::Deck => Ok(e),
                _ => Err("o export default do deck precisa ser defineDeck(() => <Deck>…</Deck>)".to_string()),
            }
        })
        .collect::<Result<Vec<_>, String>>()
        .map(|decks| (interp, decks))
}
