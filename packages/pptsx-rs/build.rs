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

fn main() {
    sync("../pptsx/docs/AGENT_GUIDE.md", "assets/agent-guide.md");
    sync("../pptsx/src/mcp/schema.generated.ts", "assets/schema.generated.ts");
}
