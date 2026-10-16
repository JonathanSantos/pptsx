//! Os `.d.ts` do pptsx embutidos no binário: `init` (e `pptsx-rs types`) gravam em
//! `.pptsx/types/pptsx/` como um pacote de tipos num `typeRoots` do `tsconfig.json`, e o editor
//! entende `import … from 'pptsx'` e o JSX sem `npm install`. O `build.rs` copia os arquivos de
//! `packages/pptsx/dist` para `assets/pptsx-types/` e gera a lista.
//!
//! `typeRoots` e não `paths` (cli/types.ts do TS): o tsx segue o `paths` e carregaria o `.d.ts` no
//! lugar do pacote se alguém rodasse o `pptsx` em Node nesta pasta; o `typeRoots` só o TypeScript lê e
//! um `node_modules/pptsx` instalado vence. Como ele resolve só o nome do pacote, o `pptsx/jsx-runtime`
//! e o `pptsx/jsx-dev-runtime` saem como declarações ambientes (`jsx-shim.d.ts`) gerados dos próprios
//! `.d.ts`, referenciados pela entrada do pacote (`entry.d.ts`).

use std::path::Path;

include!(concat!(env!("OUT_DIR"), "/pptsx_types.rs"));

/// Onde os tipos ficam, relativo à pasta do projeto.
pub const TYPES_DIR: &str = ".pptsx/types/pptsx";

/// Onde o pacote de tipos fica (o `typeRoots`), relativo à pasta do projeto.
pub const TYPES_ROOT: &str = ".pptsx/types";

/// `compilerOptions.typeRoots` do scaffold: a cópia local e o padrão do TypeScript (que some quando a opção é definida).
pub const TYPE_ROOTS: [&str; 2] = ["./.pptsx/types", "./node_modules/@types"];

const ENTRY: &str = "/// <reference path=\"./jsx-shim.d.ts\" />\nexport * from './index.ts';\n";
const PACKAGE: &str = "{ \"name\": \"pptsx\", \"types\": \"./entry.d.ts\" }\n";

fn indent(text: &str) -> String {
    text.trim().lines().map(|l| if l.trim().is_empty() { l.to_string() } else { format!("  {l}") }).collect::<Vec<_>>().join("\n")
}

fn embedded(rel: &str) -> &'static str {
    FILES.iter().find(|(r, _)| *r == rel).map(|(_, c)| *c).unwrap_or("")
}

/// Os dois módulos do JSX como `declare module`, importando do próprio `pptsx` o que importavam por caminho relativo (cli/types.ts jsxShimOf).
pub fn jsx_shim() -> String {
    let runtime = embedded("jsx/jsx-runtime.d.ts").replace("'../core/types.ts'", "'pptsx'").replace("export {};", "");
    let dev = embedded("jsx/jsx-dev-runtime.d.ts").replace("'./jsx-runtime.ts'", "'pptsx/jsx-runtime'");
    format!(
        "// Gerado por `pptsx-rs types`: o typeRoots resolve só o nome do pacote; os módulos do JSX entram como declarações ambientes.\ndeclare module 'pptsx/jsx-runtime' {{\n{}\n}}\ndeclare module 'pptsx/jsx-dev-runtime' {{\n{}\n}}\n",
        indent(&runtime),
        indent(&dev)
    )
}

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
    let extra = [
        ("jsx-shim.d.ts", jsx_shim()),
        ("entry.d.ts", ENTRY.to_string()),
        ("package.json", PACKAGE.to_string()),
        ("README.md", format!("Tipos do pptsx {} para o editor (typeRoots do tsconfig.json), gravados por `pptsx-rs init`/`types`. Com o pptsx instalado em node_modules, o editor usa o pacote; esta cópia vale quando ele não está. Não edite: `pptsx-rs types` regrava.\n", env!("CARGO_PKG_VERSION"))),
    ];
    for (name, content) in extra {
        std::fs::write(root.join(name), content).map_err(|e| format!("{name}: {e}"))?;
    }
    Ok(FILES.len())
}
