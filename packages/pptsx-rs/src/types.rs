//! Os `.d.ts` do pptsx embutidos no binário: `init` (e `pptsx-rs types`) gravam em
//! `.pptsx/types/pptsx/` e apontam o `tsconfig.json` para lá (`paths`), e o editor entende
//! `import … from 'pptsx'` e o JSX sem `npm install`. O `build.rs` copia os arquivos de
//! `packages/pptsx/dist` para `assets/pptsx-types/` e gera a lista.

use std::path::Path;

include!(concat!(env!("OUT_DIR"), "/pptsx_types.rs"));

/// Onde os tipos ficam, relativo à pasta do projeto.
pub const TYPES_DIR: &str = ".pptsx/types/pptsx";

/// `compilerOptions.paths` que apontam o pacote e o runtime JSX para a cópia local.
pub const PATHS: [(&str, &str); 3] = [
    ("pptsx", "./.pptsx/types/pptsx/index.d.ts"),
    ("pptsx/jsx-runtime", "./.pptsx/types/pptsx/jsx/jsx-runtime.d.ts"),
    ("pptsx/jsx-dev-runtime", "./.pptsx/types/pptsx/jsx/jsx-dev-runtime.d.ts"),
];

/// Grava os `.d.ts` em `<dir>/.pptsx/types/pptsx/`; devolve quantos arquivos.
pub fn write(dir: &Path) -> Result<usize, String> {
    let root = dir.join(TYPES_DIR);
    for (rel, content) in FILES {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
        }
        std::fs::write(&path, content).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    std::fs::write(root.join("README.md"), format!("Tipos do pptsx {} para o editor, gravados por `pptsx-rs init`/`types`. Não edite: `pptsx-rs types` regrava.\n", env!("CARGO_PKG_VERSION"))).map_err(|e| e.to_string())?;
    Ok(FILES.len())
}
