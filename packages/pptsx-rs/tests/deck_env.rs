//! O ambiente JS do deck de ponta a ponta: ler dados da pasta do deck, `URL` e URI. Cada teste grava um
//! projeto numa pasta temporária e roda `check --json` de OUTRA pasta (como o MCP ou um script fariam).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Pasta nova com os arquivos (caminho relativo → conteúdo); devolve a raiz.
fn project(name: &str, files: &[(&str, &str)]) -> PathBuf {
    let root = std::env::temp_dir().join(format!("pptsx-rs-env-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    for (path, content) in files {
        let file = root.join(path);
        fs::create_dir_all(file.parent().expect("arquivo com pasta")).expect("pasta");
        fs::write(file, content).expect("arquivo");
    }
    root
}

/// `check --json` do deck, com o diretório de trabalho em `cwd`: (sucesso, saída).
fn check_from(cwd: &Path, deck: &Path) -> (bool, String) {
    let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["check", &deck.display().to_string(), "--json"]).current_dir(cwd).output().expect("rodar o binário");
    (run.status.success(), format!("{}{}", String::from_utf8_lossy(&run.stdout), String::from_utf8_lossy(&run.stderr)))
}

/// O deck falha de propósito (throw) se o valor lido não for o esperado: o check só passa se tudo bateu.
const READS: &str = r#"import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { Deck, Slide, Text, defineDeck } from 'pptsx';
const csv = readFileSync('./dados/vendas.csv', 'utf8').trim();
if (csv !== 'regiao,receita\nSul,10') throw new Error(`csv lido errado: ${csv}`);
if (readdirSync('./dados').join(',') !== 'vendas.csv') throw new Error('readdirSync errado');
if (!existsSync('./dados/vendas.csv') || existsSync('./dados/nao.csv')) throw new Error('existsSync errado');
const url = new URL('./dados/vendas.csv', import.meta.url);
if (readFileSync(url.pathname, 'utf8').trim() !== csv) throw new Error(`pathname errado: ${url.pathname}`);
if (!url.href.startsWith('file://')) throw new Error(`href errado: ${url.href}`);
if (decodeURIComponent('Apresenta%C3%A7%C3%B5es%20Q3') !== 'Apresentações Q3') throw new Error('decodeURIComponent errado');
if (encodeURIComponent('a b') !== 'a%20b') throw new Error('encodeURIComponent errado');
export default defineDeck(() => (<Deck><Slide padding={40}><Text>{csv}</Text></Slide></Deck>));
"#;

/// Caminho relativo em `node:fs` vale a partir do arquivo do deck, não do diretório de onde o comando roda
/// (antes: "fora do alcance do deck" fora da pasta dele).
#[test]
fn deck_reads_its_data_relative_to_itself_from_any_working_directory() {
    let root = project("reads", &[("projeto/deck/deck.tsx", READS), ("projeto/deck/dados/vendas.csv", "regiao,receita\nSul,10\n")]);
    let deck = root.join("projeto/deck/deck.tsx");
    for cwd in [root.clone(), root.join("projeto"), deck.parent().expect("pasta do deck").to_path_buf()] {
        let (ok, output) = check_from(&cwd, &deck);
        assert!(ok && output.trim_start().starts_with('['), "cwd {}: {output}", cwd.display());
    }
    let _ = fs::remove_dir_all(&root);
}

/// O alcance continua: relativo que sobe para fora da pasta do deck segue barrado.
#[test]
fn relative_path_outside_the_deck_folder_is_still_refused() {
    let deck_src = "import { readFileSync } from 'node:fs';\nimport { Deck, Slide, Text, defineDeck } from 'pptsx';\nconst x = readFileSync('../segredo.txt', 'utf8');\nexport default defineDeck(() => (<Deck><Slide><Text>{x}</Text></Slide></Deck>));\n";
    let root = project("outside", &[("projeto/deck/deck.tsx", deck_src), ("projeto/segredo.txt", "não")]);
    let (ok, output) = check_from(&root, &root.join("projeto/deck/deck.tsx"));
    assert!(!ok && output.contains("fora do alcance do deck"), "{output}");
    let _ = fs::remove_dir_all(&root);
}

/// Num módulo de DS, o relativo vale a partir do próprio módulo (o guia ao lado dele), não do deck nem do cwd.
#[test]
fn ds_module_reads_relative_to_itself() {
    let ds = "import { readFileSync } from 'node:fs';\nexport const guia = readFileSync('./guia.md', 'utf8').trim();\n";
    let deck = "import { Deck, Slide, Text, defineDeck } from 'pptsx';\nimport { guia } from '../ds/index.ts';\nif (guia !== '# Guia do DS') throw new Error(`guia errado: ${guia}`);\nexport default defineDeck(() => (<Deck><Slide padding={40}><Text>{guia}</Text></Slide></Deck>));\n";
    let root = project("ds-relative", &[("ds/index.ts", ds), ("ds/guia.md", "# Guia do DS\n"), ("deck/deck.tsx", deck), ("deck/guia.md", "# outro guia\n")]);
    let (ok, output) = check_from(&root, &root.join("deck/deck.tsx"));
    let _ = fs::remove_dir_all(&root);
    assert!(ok && output.trim_start().starts_with('['), "{output}");
}
