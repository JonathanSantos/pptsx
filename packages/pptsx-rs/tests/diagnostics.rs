//! Diagnósticos de ponta a ponta: cada teste escreve um deck numa pasta temporária, roda `check --json`
//! no binário e lê a lista estruturada (o que agentes e o MCP consomem).

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use regex::Regex;
use serde_json::Value;

/// `check --json` de um deck com estes slides; devolve os diagnósticos e a saída para a mensagem de falha.
fn check(name: &str, slides: &str) -> (Vec<Value>, String) {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-diagnostics-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Deck, Slide, Text, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
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
