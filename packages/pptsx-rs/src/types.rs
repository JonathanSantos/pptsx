//! Os `.d.ts` do pptsx embutidos no binário: `init` (e `pptsx-rs types`) gravam em
//! `.pptsx/types/pptsx/` como um pacote de tipos num `typeRoots` do `tsconfig.json`, e o editor
//! entende `import … from 'pptsx'` e o JSX sem `npm install`. Os `.d.ts` do `@pptsx/ds-kit` embutido
//! vão para `.pptsx/types/@pptsx/ds-kit/`, pelo mesmo `typeRoots`. Os originais ficam em
//! `assets/pptsx-types/` e `assets/ds-kit/`; o `build.rs` só gera as listas.
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

/// Os tipos do núcleo vistos de um `declare module` (que não aceita import relativo).
const CORE_TYPES_MODULE: &str = "'pptsx/core/types.ts'";

/// A pasta do escopo `@pptsx` dentro do `typeRoots`, relativa à pasta do projeto.
pub const DS_KIT_SCOPE_DIR: &str = ".pptsx/types/@pptsx";
const DS_KIT_PACKAGE: &str = "{ \"name\": \"@pptsx/ds-kit\", \"types\": \"./index.d.ts\" }\n";
const SCOPE_PACKAGE: &str = "{ \"typings\": null }\n";

fn indent(text: &str) -> String {
    text.trim().lines().map(|l| if l.trim().is_empty() { l.to_string() } else { format!("  {l}") }).collect::<Vec<_>>().join("\n")
}

fn embedded(rel: &str) -> &'static str {
    FILES.iter().find(|(r, _)| *r == rel).map(|(_, c)| *c).unwrap_or("")
}

/// Os dois módulos do JSX como `declare module`, importando do próprio `pptsx` o que importavam por caminho relativo (cli/types.ts jsxShimOf).
pub fn jsx_shim() -> String {
    // Pelo subcaminho do pacote e não por `'pptsx'`: a entrada do pacote não exporta `Primitive` nem
    // `ElementType`, e com eles sem resolver o `JSX.ElementType` vira erro (escondido pelo
    // skipLibCheck) e todo componente que devolve `Child` deixa de ser aceito como tag.
    let runtime = embedded("jsx/jsx-runtime.d.ts").replace("'../core/types.ts'", CORE_TYPES_MODULE).replace("export {};", "");
    let dev = embedded("jsx/jsx-dev-runtime.d.ts").replace("'./jsx-runtime.ts'", "'pptsx/jsx-runtime'");
    format!(
        "// Gerado por `pptsx-rs types`: o typeRoots resolve só o nome do pacote; os módulos do JSX entram como declarações ambientes.\ndeclare module 'pptsx/jsx-runtime' {{\n{}\n}}\ndeclare module 'pptsx/jsx-dev-runtime' {{\n{}\n}}\n",
        indent(&runtime),
        indent(&dev)
    )
}

/// Os `.d.ts` do `@pptsx/ds-kit` embutido (assets/ds-kit), com o caminho relativo.
fn ds_kit_types() -> impl Iterator<Item = (&'static str, &'static str)> {
    crate::js::DS_KIT_FILES.iter().filter(|(rel, _)| rel.ends_with(".d.ts")).copied()
}

fn write_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    std::fs::write(path, content).map_err(|e| format!("{}: {e}", path.display()))
}

/// Grava os `.d.ts` do kit em `<dir>/.pptsx/types/@pptsx/ds-kit/`: o editor resolve
/// `import … from '@pptsx/ds-kit'` pelo mesmo `typeRoots`, sem npm.
fn write_ds_kit(dir: &Path) -> Result<usize, String> {
    let scope = dir.join(DS_KIT_SCOPE_DIR);
    let root = scope.join("ds-kit");
    for (rel, content) in ds_kit_types() {
        write_file(&root.join(rel), content)?;
    }
    write_file(&root.join("package.json"), DS_KIT_PACKAGE)?;
    // O TypeScript trata cada pasta do typeRoots como um pacote de tipos e reclama (TS2688) de uma
    // sem entrada: `typings: null` diz que a pasta do escopo não é um pacote.
    write_file(&scope.join("package.json"), SCOPE_PACKAGE)?;
    Ok(ds_kit_types().count())
}

/// Grava os `.d.ts` do pptsx em `<dir>/.pptsx/types/pptsx/` e os do kit em
/// `<dir>/.pptsx/types/@pptsx/ds-kit/`; devolve quantos arquivos.
pub fn write(dir: &Path) -> Result<usize, String> {
    let root = dir.join(TYPES_DIR);
    for (rel, content) in FILES {
        write_file(&root.join(rel), content)?;
    }
    let extra = [
        ("jsx-shim.d.ts", jsx_shim()),
        ("entry.d.ts", ENTRY.to_string()),
        ("package.json", PACKAGE.to_string()),
        ("README.md", format!("Tipos do pptsx {} para o editor (typeRoots do tsconfig.json), gravados por `pptsx-rs init`/`types`. Com o pptsx instalado em node_modules, o editor usa o pacote; esta cópia vale quando ele não está. Não edite: `pptsx-rs types` regrava.\n", env!("CARGO_PKG_VERSION"))),
    ];
    for (name, content) in extra {
        write_file(&root.join(name), &content)?;
    }
    Ok(FILES.len() + write_ds_kit(dir)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jsx_shim_imports_the_core_types_by_package_subpath() {
        let shim = jsx_shim();
        assert!(shim.contains("import type { Child, ElementType, Primitive, SlideElement } from 'pptsx/core/types.ts';"), "{shim}");
        assert!(!shim.contains("'../core/types.ts'"));
        assert!(FILES.iter().any(|(rel, _)| *rel == "core/types.d.ts"));
    }

    #[test]
    fn writes_the_kit_types_next_to_the_core_types() {
        let dir = std::env::temp_dir().join(format!("pptsx-rs-types-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let written = write(&dir).expect("tipos gravados");
        assert!(written > FILES.len());
        let kit = dir.join(DS_KIT_SCOPE_DIR).join("ds-kit");
        assert!(kit.join("index.d.ts").is_file());
        assert!(kit.join("package.json").is_file());
        assert!(std::fs::read_to_string(dir.join(DS_KIT_SCOPE_DIR).join("package.json")).is_ok_and(|s| s.contains("\"typings\": null")));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
