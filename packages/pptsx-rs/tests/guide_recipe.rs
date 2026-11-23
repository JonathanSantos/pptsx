//! A receita "um DS de marca do zero" do guia (§5) roda como está escrita: os blocos com `file=` saem do
//! `assets/agent-guide.md`, viram arquivos, e o fluxo inteiro (init --ds, check, lint, build, skill --ds e um
//! deck novo a partir da skill) passa sem diagnóstico. Se o guia mudar e quebrar, este teste diz onde.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

const LOGO: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#000000"/><rect x="30" y="2" width="4" height="10" fill="#000000"/><rect x="30" y="52" width="4" height="10" fill="#000000"/><rect x="2" y="30" width="10" height="4" fill="#000000"/><rect x="52" y="30" width="10" height="4" fill="#000000"/></svg>"##;

/// Os blocos de código do guia com `file=<caminho>` na linha de abertura.
fn recipe_files() -> Vec<(String, String)> {
    let guide = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/agent-guide.md")).expect("guia");
    let mut files = Vec::new();
    let mut lines = guide.lines();
    while let Some(line) = lines.next() {
        let Some(path) = line.strip_prefix("```").and_then(|info| info.split_whitespace().find_map(|w| w.strip_prefix("file="))) else { continue };
        let body: Vec<&str> = lines.by_ref().take_while(|l| !l.starts_with("```")).collect();
        files.push((path.to_string(), format!("{}\n", body.join("\n"))));
    }
    files
}

fn run(cwd: &Path, args: &[&str]) -> (bool, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(args).current_dir(cwd).output().expect("rodar o binário");
    (out.status.success(), format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)))
}

fn zip_text(pptx: &Path, part: &str) -> Option<String> {
    let mut archive = zip::ZipArchive::new(fs::File::open(pptx).ok()?).ok()?;
    let mut text = String::new();
    archive.by_name(part).ok()?.read_to_string(&mut text).ok()?;
    Some(text)
}

#[test]
fn brand_ds_recipe_from_the_guide_builds_clean_end_to_end() {
    let files = recipe_files();
    let names: Vec<&str> = files.iter().map(|(p, _)| p.as_str()).collect();
    assert_eq!(names, ["lumen/src/index.tsx", "lumen/starter.tsx", "lumen/skill/SKILL.md"], "blocos file= da receita");

    let root: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-guide-recipe-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    for (path, content) in &files {
        let file = root.join(path);
        fs::create_dir_all(file.parent().expect("pasta")).expect("pasta");
        fs::write(file, content).expect("arquivo da receita");
    }
    fs::create_dir_all(root.join("lumen/assets/fonts")).expect("assets");
    fs::write(root.join("lumen/assets/logo.svg"), LOGO).expect("logo");
    let fonts = Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/fonts");
    fs::copy(fonts.join("LiberationSans-Regular.ttf"), root.join("lumen/assets/fonts/Inter-Regular.ttf")).expect("fonte");
    fs::copy(fonts.join("LiberationSans-Bold.ttf"), root.join("lumen/assets/fonts/Inter-Bold.ttf")).expect("fonte");

    // init --ds: o deck sai do starter.tsx; check sem --size usa os tamanhos do DS.
    let (ok, out) = run(&root, &["init", "deck", "--ds", "lumen/src/index.tsx"]);
    assert!(ok, "{out}");
    let deck = fs::read_to_string(root.join("deck/deck.tsx")).expect("deck");
    assert!(deck.contains("<Abertura") && !deck.contains("{{ds}}"), "{deck}");
    let (ok, out) = run(&root, &["check", "deck/deck.tsx"]);
    assert!(ok && out.contains("deck 16x9") && out.contains("deck 4x3") && out.contains("Nenhum diagnóstico"), "{out}");
    let (ok, out) = run(&root, &["lint", "deck/deck.tsx"]);
    assert!(ok && out.contains("nada a apontar"), "{out}");

    // build: layouts do arquivo, fontes embutidas e quebras automáticas, sem nada na config.
    let (ok, out) = run(&root, &["build", "deck/deck.tsx", "--out", "out", "--preview", "none"]);
    assert!(ok, "{out}");
    let pptx = root.join("out/deck.16x9.pptx");
    let layouts: String = (1..=4).filter_map(|i| zip_text(&pptx, &format!("ppt/slideLayouts/slideLayout{i}.xml"))).collect();
    assert!(layouts.contains("name=\"Abertura\"") && layouts.contains("name=\"Página\""), "layouts do DS no arquivo");
    assert!(zip_text(&pptx, "ppt/presentation.xml").is_some_and(|p| p.contains("embeddedFont")), "fontes embutidas");
    assert!(zip_text(&pptx, "ppt/slides/slide2.xml").is_some_and(|s| !s.contains("<a:br")), "lineBreaks auto");

    // skill --ds: SKILL.md com os caminhos trocados, ds.md com slides inteiros e a regra descrita.
    let (ok, out) = run(&root, &["skill", "--ds", "lumen", "--name", "lumen-deck", "--out", "sk", "--no-bin"]);
    assert!(ok, "{out}");
    let skill = fs::read_to_string(root.join("sk/SKILL.md")).expect("SKILL.md");
    assert!(!skill.contains("{{") && skill.contains("ds/src/index.tsx"), "{skill}");
    let ds_md = fs::read_to_string(root.join("sk/references/ds.md")).expect("ds.md");
    for expected in ["## Como começar", "| `Abertura` | slide inteiro |", "| `Pagina` | slide inteiro |", "| `Indicador` | bloco |", "`lumen/cores` (warning): toda cor"] {
        assert!(ds_md.contains(expected), "ds.md sem {expected:?}:\n{ds_md}");
    }

    // Um projeto novo a partir da skill: fontes e logo vêm do DS empacotado.
    fs::create_dir_all(root.join("novo")).expect("pasta");
    let entry = root.join("sk/ds/src/index.tsx").display().to_string();
    let (ok, out) = run(&root.join("novo"), &["init", "deck", "--ds", &entry]);
    assert!(ok, "{out}");
    let (ok, out) = run(&root.join("novo"), &["check", "deck/deck.tsx"]);
    let _ = fs::remove_dir_all(&root);
    assert!(ok && out.contains("Nenhum diagnóstico") && !out.contains("font-missing"), "{out}");
}
