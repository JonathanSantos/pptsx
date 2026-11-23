//! Diagnósticos de ponta a ponta: cada teste escreve um deck numa pasta temporária, roda `check --json`
//! no binário e lê a lista estruturada (o que agentes e o MCP consomem).

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use regex::Regex;
use serde_json::Value;

/// `check --json` de um deck com estes slides; devolve os diagnósticos e a saída para a mensagem de falha.
fn check(name: &str, slides: &str) -> (Vec<Value>, String) {
    check_with(name, slides, None)
}

/// O mesmo, com um `pptsx.config.ts` ao lado do deck.
fn check_with(name: &str, slides: &str, config: Option<&str>) -> (Vec<Value>, String) {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-diagnostics-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Deck, Image, Slide, Text, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
    if let Some(config) = config {
        fs::write(dir.join("pptsx.config.ts"), config).expect("pptsx.config.ts");
    }
    let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["check", &dir.join("deck.tsx").display().to_string(), "--json"]).output().expect("rodar o binário");
    let _ = fs::remove_dir_all(&dir);
    let stdout = String::from_utf8_lossy(&run.stdout).into_owned();
    let output = format!("{stdout}{}", String::from_utf8_lossy(&run.stderr));
    let diagnostics = serde_json::from_str::<Vec<Value>>(&stdout).unwrap_or_else(|e| panic!("check --json não deu uma lista JSON ({e}):\n{output}"));
    (diagnostics, output)
}

fn with_code<'a>(diagnostics: &'a [Value], code: &str) -> Vec<&'a Value> {
    diagnostics.iter().filter(|d| d["code"] == code).collect()
}

/// bac49fa: numa linha com um filho que não encolhe (nowrap), o flexbox degenera e o estouro sai na casa dos
/// bilhões de pt. A mensagem conta o que aconteceu e aponta a causa, sem o número.
#[test]
fn degenerate_row_overflow_explains_instead_of_printing_a_huge_number() {
    let (diagnostics, output) = check(
        "degenerate",
        r##"<Slide padding={40}><Box display="flex" gap={16}><Text nowrap fontSize={40}>Um texto muito longo que não pode quebrar de jeito nenhum nesta linha</Text><Box width={200} height={40} backgroundColor="#EEEEEE" /></Box></Slide>"##,
    );
    let boxes = with_code(&diagnostics, "box-overflow");
    assert_eq!(boxes.len(), 1, "{output}");
    let message = boxes[0]["message"].as_str().expect("mensagem");
    assert!(message.contains("não pode encolher"), "{message}");
    assert!(!Regex::new(r"\d{6,}").expect("regex fixa").is_match(message), "número degenerado na mensagem: {message}");
    assert_eq!(boxes[0]["data"]["causedBy"], "Slide > Box > Text", "{output}");
    // O número degenerado também não vai no `data`, que é o que agentes e o MCP leem.
    assert!(boxes[0]["data"].get("overflowPt").is_none() && boxes[0]["data"].get("overflowPct").is_none(), "{output}");
    assert_eq!(with_code(&diagnostics, "text-overflow").len(), 1, "{output}");
}

/// O caso comum continua com a conta: quanto os filhos somam, a área e o estouro.
#[test]
fn ordinary_column_overflow_keeps_the_numbers() {
    let (diagnostics, output) = check("ordinary", r#"<Slide padding={40}><Box height={100}><Box height={80} flexShrink={0} /><Box height={80} flexShrink={0} /></Box></Slide>"#);
    let boxes = with_code(&diagnostics, "box-overflow");
    assert_eq!(boxes.len(), 1, "{output}");
    let message = boxes[0]["message"].as_str().expect("mensagem");
    assert!(message.contains("somam 160 pt") && message.contains("estouro de 60 pt"), "{message}");
    assert_eq!(boxes[0]["data"]["overflowPt"], 60.0, "{output}");
}

/// Deck limpo: lista vazia e saída JSON válida (o MCP depende disso).
#[test]
fn clean_deck_has_an_empty_list() {
    let (diagnostics, output) = check("clean", r#"<Slide padding={40}><Text>Olá</Text></Slide>"#);
    assert!(diagnostics.is_empty(), "{output}");
}

/// Uma cor hex com caractere não ASCII derrubava o binário (fatia de bytes no meio do `é`), e com ele o
/// servidor MCP. Agora é um diagnóstico comum da prop, e o resto do deck segue.
#[test]
fn non_ascii_hex_color_is_a_diagnostic_not_a_crash() {
    for prop in [r##"border="1px solid #aéaaa""##, r##"backgroundImage="linear-gradient(#aéaaa, #000000)""##] {
        let (diagnostics, output) = check("non-ascii", &format!("<Slide padding={{40}}><Box {prop} padding={{10}}><Text>x</Text></Box></Slide>"));
        assert!(diagnostics.iter().any(|d| d["message"].as_str().is_some_and(|m| m.contains("#aéaaa"))), "{prop}: {output}");
    }
    let (diagnostics, output) = check_with("non-ascii-theme", r#"<Slide padding={40}><Text>x</Text></Slide>"#, Some("import { defineConfig } from 'pptsx';\nexport default defineConfig({ theme: { colors: { accent1: '#aéaaa' } } });\n"));
    assert!(diagnostics.is_empty(), "{output}");
    assert!(output.contains("theme.colors.accent1"), "a cor inválida do tema avisa: {output}");
}

/// Imagem que não existe é diagnóstico com código e path (antes só uma linha de aviso fora do JSON).
#[test]
fn missing_image_is_a_warning_with_path_and_resolved_file() {
    let (diagnostics, output) = check("missing-image", r#"<Slide padding={40}><Text>foto</Text><Image src="./fotos/nao-existe.jpg" height={150} /></Slide>"#);
    let missing = with_code(&diagnostics, "image-missing");
    assert_eq!(missing.len(), 1, "{output}");
    assert_eq!((missing[0]["severity"].as_str(), missing[0]["path"].as_str()), (Some("warning"), Some("Slide > Image")), "{output}");
    let message = missing[0]["message"].as_str().expect("mensagem");
    assert!(message.contains("nao-existe.jpg") && message.contains("não existe") && !message.contains("/./"), "{message}");
    let (diagnostics, output) = check("missing-background", r#"<Slide padding={40}><Box backgroundImage="url(./fundo.png)" height={100}><Text>x</Text></Box></Slide>"#);
    let missing = with_code(&diagnostics, "image-missing");
    assert_eq!(missing.len(), 1, "{output}");
    assert_eq!(missing[0]["path"], "Slide > Box", "{output}");
}

/// Pixels exatamente desta cor no overview de um build de 16x9 (o selo tem ~450 px sólidos).
fn overview_pixels(name: &str, slides: &str, rgb: (u8, u8, u8)) -> usize {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-overview-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Deck, Image, Slide, Text, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
    let out = dir.join("out");
    Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["build", &dir.join("deck.tsx").display().to_string(), "--size", "16x9", "--out", &out.display().to_string()]).output().expect("rodar o binário");
    let png = fs::read(out.join("deck.16x9.overview.png")).expect("overview gravado");
    let _ = fs::remove_dir_all(&dir);
    let pixmap = resvg::tiny_skia::Pixmap::decode_png(&png).expect("PNG válido");
    pixmap.pixels().iter().filter(|p| (p.red(), p.green(), p.blue()) == rgb && p.alpha() == 255).count()
}

/// O guia promete selo vermelho para error e amarelo para warning; o port só desenhava o vermelho.
#[test]
fn overview_badges_warning_in_yellow_and_error_in_red() {
    const YELLOW: (u8, u8, u8) = (0xF5, 0xB8, 0x00);
    const RED: (u8, u8, u8) = (0xE0, 0x24, 0x24);
    let warning = r#"<Slide padding={40}><Image src="./nao-existe.png" height={80} /></Slide>"#;
    assert!(overview_pixels("warning", warning, YELLOW) > 100, "warning sem selo amarelo");
    assert_eq!(overview_pixels("warning-red", warning, RED), 0, "warning não é vermelho");
    let error = r#"<Slide padding={40}><Box height={100}><Box height={80} flexShrink={0} /><Box height={80} flexShrink={0} /></Box></Slide>"#;
    assert!(overview_pixels("error", error, RED) > 100, "error sem selo vermelho");
    let clean = r#"<Slide padding={40}><Text>Olá</Text></Slide>"#;
    assert_eq!(overview_pixels("clean", clean, YELLOW) + overview_pixels("clean-red", clean, RED), 0, "slide limpo sem selo");
}
