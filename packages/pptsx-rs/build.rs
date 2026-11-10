//! O binário embute o que está em `assets/`: o guia do agente, o schema das primitivas, os `.d.ts` do pptsx
//! (para o `init`/`types`) e o `@pptsx/ds-kit` (JS que o avaliador serve e `.d.ts` para o editor). Os arquivos
//! de `assets/` são os originais: este build só gera as listas com `include_str!` de cada um, sem copiar
//! nada de fora do crate.
use std::fs;
use std::path::Path;

/// Caminhos relativos (com `/`) de todo arquivo abaixo de `dir` que `keep` aceita.
fn collect(dir: &Path, root: &Path, keep: &dyn Fn(&str) -> bool) -> Vec<String> {
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else { return out };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            out.extend(collect(&path, root, keep));
            continue;
        }
        let rel = path.strip_prefix(root).expect("dentro da raiz").to_string_lossy().replace('\\', "/");
        if keep(&rel) {
            out.push(rel);
        }
    }
    out
}

/// Gera `<OUT_DIR>/<out_name>` com `pub static <name>: &[(&str, &str)]` (caminho relativo, conteúdo).
fn embed(folder: &str, out_name: &str, name: &str, doc: &str, keep: &dyn Fn(&str) -> bool) {
    println!("cargo:rerun-if-changed=assets/{folder}");
    let root = Path::new("assets").join(folder);
    let mut files = collect(&root, &root, keep);
    files.sort();
    assert!(!files.is_empty(), "assets/{folder} está vazio");
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let entries: Vec<String> = files.iter().map(|rel| format!("    ({:?}, include_str!({:?})),", rel, format!("{manifest}/assets/{folder}/{rel}"))).collect();
    let out = Path::new(&std::env::var("OUT_DIR").expect("OUT_DIR")).join(out_name);
    fs::write(out, format!("/// {doc}\npub static {name}: &[(&str, &str)] = &[\n{}\n];\n", entries.join("\n"))).expect("lista de assets");
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    embed("pptsx-types", "pptsx_types.rs", "FILES", "(caminho relativo, conteúdo) de cada .d.ts do pptsx.", &|rel| rel.ends_with(".d.ts"));
    embed("ds-kit", "ds_kit.rs", "DS_KIT_FILES", "(caminho relativo, conteúdo) de cada arquivo do @pptsx/ds-kit embutido (.js e .d.ts).", &|rel| rel.ends_with(".js") || rel.ends_with(".d.ts"));
}
