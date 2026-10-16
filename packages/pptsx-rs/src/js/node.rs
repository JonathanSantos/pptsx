//! Shims somente leitura de `node:fs`, `node:path` e `node:url`: design systems leem guias e
//! listam ícones ao carregar. Escrever, executar processos ou acessar a rede continua fora.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::rc::Rc;

use super::builtins::native;
use super::value::*;
use super::{R, fail};

fn arg_str(a: &[Value], i: usize) -> String {
    a.get(i).map(Value::to_js_string).unwrap_or_default()
}

/// Aceita caminho ou URL `file://` (o resultado de `new URL(...)` aqui já é caminho).
fn to_path(s: &str) -> PathBuf {
    PathBuf::from(s.strip_prefix("file://").unwrap_or(s))
}

fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn path_str(p: &Path) -> Value {
    str_val(&p.display().to_string())
}

fn module(entries: &[(&'static str, NativeFn)]) -> Obj {
    let mut o = Obj::new();
    for (name, f) in entries {
        o.insert(Rc::from(*name), native(name, *f, Value::Undefined));
    }
    o
}

fn read_only(_: &mut super::Interp, _: &Value, _: &[Value]) -> R<Value> {
    fail("decks só podem LER arquivos (escrita e processos não existem aqui)")
}

/// Caminho que o deck pode ler (ver `Interp::allows`); fora dele, erro com o caminho.
fn allowed(it: &super::Interp, path: &Path) -> R<()> {
    if it.allows(path) {
        return Ok(());
    }
    fail(format!("{}: fora do alcance do deck (leitura só na pasta do deck, da config, dos módulos importados e em node_modules)", path.display()))
}

pub fn node_module(spec: &str) -> Option<Obj> {
    let name = spec.strip_prefix("node:").unwrap_or(spec);
    Some(match name {
        "fs" | "fs/promises" => {
            let mut m = module(&[
                ("readFileSync", |it, _, a| {
                    let path = to_path(&arg_str(a, 0));
                    allowed(it, &path)?;
                    fs::read_to_string(&path).map(|s| str_val(&s)).or_else(|e| fail(format!("{}: {e}", path.display())))
                }),
                // existsSync não lê conteúdo: um DS sonda fontes do sistema com ele
                // (ds-orbit/src/fonts.ts), então fica livre; readFileSync e readdirSync não.
                ("existsSync", |_, _, a| Ok(Value::Bool(to_path(&arg_str(a, 0)).exists()))),
                ("readdirSync", |it, _, a| {
                    let path = to_path(&arg_str(a, 0));
                    allowed(it, &path)?;
                    let mut names: Vec<String> = match fs::read_dir(&path) {
                        Ok(entries) => entries.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().into_owned()).collect(),
                        Err(e) => return fail(format!("{}: {e}", path.display())),
                    };
                    names.sort();
                    Ok(arr_val(names.iter().map(|n| str_val(n)).collect()))
                }),
            ]);
            for name in ["writeFileSync", "mkdirSync", "rmSync", "unlinkSync", "appendFileSync", "copyFileSync", "renameSync"] {
                m.insert(Rc::from(name), native(name, read_only, Value::Undefined));
            }
            m
        }
        "path" => {
            let mut m = module(&[
                ("join", |_, _, a| Ok(path_str(&normalize(&a.iter().fold(PathBuf::new(), |acc, p| acc.join(p.to_js_string())))))),
                ("resolve", |_, _, a| {
                    let base = std::env::current_dir().unwrap_or_default();
                    Ok(path_str(&normalize(&a.iter().fold(base, |acc, p| acc.join(p.to_js_string())))))
                }),
                ("dirname", |_, _, a| Ok(path_str(to_path(&arg_str(a, 0)).parent().unwrap_or(Path::new("."))))),
                ("basename", |_, _, a| {
                    let p = to_path(&arg_str(a, 0));
                    let base = p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
                    let ext = arg_str(a, 1);
                    Ok(str_val(base.strip_suffix(ext.as_str()).filter(|_| !ext.is_empty()).unwrap_or(&base)))
                }),
                ("extname", |_, _, a| Ok(str_val(&to_path(&arg_str(a, 0)).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default()))),
                ("relative", |_, _, a| {
                    let (from, to) = (normalize(&to_path(&arg_str(a, 0))), normalize(&to_path(&arg_str(a, 1))));
                    Ok(path_str(to.strip_prefix(&from).unwrap_or(&to)))
                }),
                ("isAbsolute", |_, _, a| Ok(Value::Bool(to_path(&arg_str(a, 0)).is_absolute()))),
            ]);
            m.insert(Rc::from("sep"), str_val("/"));
            m
        }
        "url" => module(&[
            ("fileURLToPath", |_, _, a| Ok(path_str(&to_path(&arg_str(a, 0))))),
            ("pathToFileURL", |_, _, a| Ok(str_val(&format!("file://{}", arg_str(a, 0))))),
        ]),
        "module" | "os" | "process" | "child_process" | "crypto" | "http" | "https" | "net" => Obj::new(),
        _ => return None,
    })
}
