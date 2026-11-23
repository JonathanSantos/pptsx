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

/// XML do 1º slide do build 16x9 de um deck com estes slides (imports de primitivas comuns).
fn slide_xml(name: &str, slides: &str) -> String {
    use std::io::Read;
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-xml-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Deck, Path, Slide, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
    let out = dir.join("out");
    Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["build", &dir.join("deck.tsx").display().to_string(), "--size", "16x9", "--out", &out.display().to_string(), "--preview", "none"]).output().expect("rodar o binário");
    let file = fs::File::open(out.join("deck.16x9.pptx")).expect("pptx gravado");
    let mut xml = String::new();
    zip::ZipArchive::new(file).expect("pptx é zip").by_name("ppt/slides/slide1.xml").expect("slide 1").read_to_string(&mut xml).expect("xml");
    let _ = fs::remove_dir_all(&dir);
    xml
}

/// `display="flex"` no Slide não vira linha, mas o aviso é do lint (um DS usa o flex do Slide como contêiner):
/// o build continua limpo.
#[test]
fn flex_display_on_slide_keeps_the_build_clean() {
    let (diagnostics, output) = check("slide-flex", r##"<Slide padding={40} display="flex"><Box height={40} /><Box height={40} /></Slide>"##);
    assert!(diagnostics.is_empty(), "{output}");
}

/// `viewBox` na forma do SVG ("x y w h") vale como moldura, igual a `[w, h]`; antes a string era ignorada e
/// o desenho esticava até a caixa do `d`.
#[test]
fn svg_style_view_box_frames_the_path_like_the_array_form() {
    let path = |vb: &str| format!(r##"<Slide padding={{40}}><Box width={{200}} height={{200}}><Path width={{200}} height={{200}} viewBox={vb} d="M40 40 L60 40 L60 60 L40 60 Z" fill="#CC0000" /></Box></Slide>"##);
    let array = slide_xml("vb-array", &path("{[100, 100]}"));
    let string = slide_xml("vb-string", &path("\"0 0 100 100\""));
    let stretched = slide_xml("vb-none", &path("{undefined}"));
    assert_eq!(array, string, "a string do SVG e o array dão o mesmo desenho");
    assert_ne!(array, stretched, "sem viewBox o d estica até a caixa");
    // viewBox inválido é prop inválida (erro do build, como uma cor inválida), com o formato esperado.
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-vb-bad-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    fs::write(dir.join("deck.tsx"), "import { Deck, Path, Slide, defineDeck } from 'pptsx';\nexport default defineDeck(() => (<Deck><Slide><Path width={100} height={100} viewBox=\"0 0 100\" d=\"M0 0 L10 10\" /></Slide></Deck>));\n").expect("deck");
    let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["check", &dir.join("deck.tsx").display().to_string()]).output().expect("rodar o binário");
    let _ = fs::remove_dir_all(&dir);
    let output = format!("{}{}", String::from_utf8_lossy(&run.stdout), String::from_utf8_lossy(&run.stderr));
    assert!(!run.status.success() && output.contains("viewBox") && output.contains("x y largura altura"), "{output}");
}

/// SVG num <Image> existe mas não é lido: a mensagem aponta o <Icon> (antes mandava "usar um arquivo que exista").
#[test]
fn svg_in_image_points_to_icon() {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-svg-image-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    fs::write(dir.join("logo.svg"), r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>"##).expect("svg");
    fs::write(dir.join("deck.tsx"), "import { Deck, Image, Slide, defineDeck } from 'pptsx';\nexport default defineDeck(() => (<Deck><Slide padding={40}><Image src=\"./logo.svg\" width={80} /></Slide></Deck>));\n").expect("deck");
    let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["check", &dir.join("deck.tsx").display().to_string(), "--json"]).output().expect("rodar o binário");
    let _ = fs::remove_dir_all(&dir);
    let diagnostics: Vec<Value> = serde_json::from_slice(&run.stdout).expect("lista JSON");
    let missing = with_code(&diagnostics, "image-missing");
    assert_eq!(missing.len(), 1, "{diagnostics:?}");
    let message = missing[0]["message"].as_str().expect("mensagem");
    assert!(message.contains("existe mas não pôde ser lida") && message.contains("<Icon") && !message.contains("Confira o caminho"), "{message}");
}

/// Caractere que a fonte não tem vira `glyph-missing` (info) no nó, com o código Unicode; antes o preview
/// mostrava um quadrado sem nenhum aviso. Acentos, travessão e seta (que a Liberation Sans tem) não contam.
#[test]
fn missing_glyphs_are_reported_with_their_code_points() {
    let (diagnostics, output) = check("glyphs", r#"<Slide padding={40}><Text>Ação — ok → feito ✓ ★</Text><Text>Só texto comum, ção.</Text></Slide>"#);
    let glyphs = with_code(&diagnostics, "glyph-missing");
    assert_eq!(glyphs.len(), 1, "{output}");
    assert_eq!(glyphs[0]["severity"], "info", "{output}");
    assert_eq!(glyphs[0]["path"], "Slide > Text[0]", "{output}");
    let message = glyphs[0]["message"].as_str().expect("mensagem");
    assert!(message.contains("U+2713") && message.contains("U+2605") && !message.contains("U+2192") && !message.contains("U+2014"), "{message}");
    assert!(message.contains("na fonte \"Arial\""), "a família do autor, não a Liberation da medida: {message}");
    // Irmãos com glifos diferentes não se agrupam num aviso que cita só o primeiro.
    let (diagnostics, output) = check("glyph-siblings", r#"<Slide padding={40}><Text>✓ feito</Text><Text>★ destaque</Text></Slide>"#);
    let glyphs = with_code(&diagnostics, "glyph-missing");
    let all: String = glyphs.iter().filter_map(|d| d["message"].as_str()).collect();
    assert!(glyphs.len() == 2 && all.contains("U+2713") && all.contains("U+2605"), "{output}");
}

/// Estouro de tracks do grid sugere minmax(0, 1fr) nos tracks, não flexShrink (que não vale no grid).
#[test]
fn grid_track_overflow_points_to_minmax_tracks() {
    let card = r#"<Box padding={16} gap={6}><Text fontSize={44} fontWeight="bold">R$ 52,4 mi</Text><Text fontSize={14}>Comentário mais longo, de duas ou três linhas, que explica o número e dá contexto.</Text></Box>"#;
    let slides = format!(r#"<Slide padding={{40}} gap={{16}}><Text fontSize={{32}}>Resultados</Text><Box display="grid" gridTemplateColumns="minmax(0, 1fr)" gap={{16}} flex={{1}}>{card}{card}{card}</Box></Slide>"#);
    let (diagnostics, output) = check("grid-tracks", &slides);
    let boxes: Vec<&str> = with_code(&diagnostics, "box-overflow").iter().filter_map(|d| d["message"].as_str()).collect();
    assert!(boxes.iter().any(|m| m.starts_with("Os tracks do grid") && m.contains("minmax(0, 1fr)") && !m.contains("flexShrink")), "{output}");
}

/// O PNG do 1º slide (1280 px) de um deck 16x9, decodificado.
fn slide_png(name: &str, slides: &str) -> resvg::tiny_skia::Pixmap {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-slide-png-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Chart, Deck, Slide, Text, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
    let out = dir.join("out");
    Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(["build", &dir.join("deck.tsx").display().to_string(), "--size", "16x9", "--out", &out.display().to_string()]).output().expect("rodar o binário");
    let png = fs::read(out.join("deck.16x9/slide-01.png")).expect("PNG do slide");
    let _ = fs::remove_dir_all(&dir);
    resvg::tiny_skia::Pixmap::decode_png(&png).expect("PNG válido")
}

/// Rosca no preview como no arquivo: o furo mostra o fundo do slide (era um círculo branco por cima) e a
/// legenda aparece (o preview só a desenhava nos gráficos de eixo).
#[test]
fn donut_preview_keeps_the_background_in_the_hole_and_draws_the_legend() {
    let slide = r##"<Slide padding={40} backgroundColor="#FBF7EE"><Chart kind="doughnut" legend="bottom" colors={['#1F4D2B', '#9BD15A', '#E4572E']} data={{ categories: ['Produto', 'Logística', 'Marketing'], series: [{ name: 'Uso', values: [40, 35, 25] }] }} flex={1} /></Slide>"##;
    let pixmap = slide_png("donut", slide);
    let (w, h) = (pixmap.width() as usize, pixmap.height() as usize);
    let at = |x: usize, y: usize| { let p = pixmap.pixels()[y * w + x]; (p.red(), p.green(), p.blue()) };
    let white = pixmap.pixels().iter().filter(|p| (p.red(), p.green(), p.blue()) == (255, 255, 255)).count();
    assert!(white < w * h / 100, "furo pintado de branco: {white} px brancos");
    // O centro da rosca é o fundo do slide.
    let center = (0..h).map(|y| at(w / 2, y)).filter(|c| *c == (0xFB, 0xF7, 0xEE)).count();
    assert!(center > h / 4, "o centro não mostra o fundo");
    // A legenda: a cor de 'Marketing' aparece também na faixa de baixo, onde não há fatia.
    let legend_rows = (h * 82 / 100)..(h * 92 / 100);
    let marketing = legend_rows.flat_map(|y| (0..w).map(move |x| (x, y))).filter(|(x, y)| at(*x, *y) == (0xE4, 0x57, 0x2E)).count();
    assert!(marketing > 20, "sem legenda: {marketing} px da cor de Marketing na faixa de baixo");
}
