//! O MCP embute o guia e o schema do núcleo (`include_str!` em assets/). Dentro do monorepo, este
//! build copia os originais de packages/pptsx para assets/ quando mudam, para a cópia nunca ficar
//! velha (o CI confere com `git diff`); fora dele, a cópia versionada basta e o crate compila sozinho.
use std::fs;
use std::path::Path;

fn sync(source: &str, target: &str) {
    println!("cargo:rerun-if-changed={source}");
    println!("cargo:rerun-if-changed={target}");
    let (source, target) = (Path::new(source), Path::new(target));
    if !source.is_file() {
        assert!(target.is_file(), "falta {} e não há {} para copiar", target.display(), source.display());
        return;
    }
    let fresh = fs::read(source).expect("leitura do original");
    if fs::read(target).ok().as_deref() != Some(fresh.as_slice()) {
        fs::write(target, fresh).expect("escrita da cópia em assets/");
    }
}

/// Os `.d.ts` de packages/pptsx/dist (saída de `npm run build`) → assets/pptsx-types/, e a lista
/// `FILES` com `include_str!` de cada um, para o `init` gravar os tipos no projeto sem npm.
fn sync_types() {
    let source = Path::new("../pptsx/dist");
    let target = Path::new("assets/pptsx-types");
    println!("cargo:rerun-if-changed=../pptsx/dist");
    println!("cargo:rerun-if-changed=assets/pptsx-types");
    if source.is_dir() {
        let fresh = collect(source, source);
        if !fresh.is_empty() {
            let _ = fs::remove_dir_all(target);
            for rel in &fresh {
                let to = target.join(rel);
                fs::create_dir_all(to.parent().expect("pasta")).expect("pasta dos tipos");
                fs::copy(source.join(rel), &to).expect("cópia do .d.ts");
            }
        }
    }
    let mut files = collect(target, target);
    files.sort();
    assert!(!files.is_empty(), "sem .d.ts em assets/pptsx-types (rode `npm run build` no monorepo)");
    let manifest = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let entries: Vec<String> = files
        .iter()
        .map(|rel| format!("    ({:?}, include_str!({:?})),", rel, format!("{manifest}/assets/pptsx-types/{rel}")))
        .collect();
    let out = Path::new(&std::env::var("OUT_DIR").expect("OUT_DIR")).join("pptsx_types.rs");
    fs::write(out, format!("/// (caminho relativo, conteúdo) de cada .d.ts do pptsx.\npub static FILES: &[(&str, &str)] = &[\n{}\n];\n", entries.join("\n"))).expect("pptsx_types.rs");
}

/// Caminhos relativos (com `/`) de todo `.d.ts` abaixo de `dir`.
fn collect(dir: &Path, root: &Path) -> Vec<String> {
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else { return out };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            out.extend(collect(&path, root));
        } else if path.to_string_lossy().ends_with(".d.ts") {
            out.push(path.strip_prefix(root).expect("dentro da raiz").to_string_lossy().replace('\\', "/"));
        }
    }
    out
}

fn main() {
    sync("../pptsx/docs/AGENT_GUIDE.md", "assets/agent-guide.md");
    sync("../pptsx/src/mcp/schema.generated.ts", "assets/schema.generated.ts");
    sync_types();
}
