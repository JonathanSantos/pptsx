//! `fitGroup`: os Text do slide com o mesmo nome encolhem pela mesma escala. Cada teste escreve um
//! deck, roda o binário e lê os corpos no XML do slide (`sz`, em centésimos de pt) e os diagnósticos.

use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::Command;

use regex::Regex;
use serde_json::Value;

struct Built {
    slides: Vec<String>,
    diagnostics: Vec<Value>,
    stderr: String,
}

impl Built {
    /// Corpos (pt) dos trechos do slide, na ordem do XML.
    fn sizes(&self, slide: usize) -> Vec<f64> {
        let re = Regex::new(r#"<a:rPr[^>]*\bsz="(\d+)""#).expect("regex fixa");
        re.captures_iter(&self.slides[slide]).map(|c| c[1].parse::<f64>().expect("sz numérico") / 100.0).collect()
    }

    fn codes(&self, severity: &str) -> Vec<String> {
        self.diagnostics.iter().filter(|d| d["severity"] == severity).map(|d| d["code"].as_str().unwrap_or("").to_string()).collect()
    }
}

fn build(name: &str, slides: &str) -> Built {
    let dir: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-fit-group-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("pasta temporária");
    let deck = format!("import {{ Box, Container, Deck, Slide, Text, defineDeck }} from 'pptsx';\nexport default defineDeck(() => (<Deck>{slides}</Deck>));\n");
    fs::write(dir.join("deck.tsx"), deck).expect("deck.tsx");
    let out = dir.join("out");
    let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs"))
        .args(["build", &dir.join("deck.tsx").display().to_string(), "--size", "16x9", "--out", &out.display().to_string(), "--preview", "none"])
        .output()
        .expect("rodar o binário");
    let stderr = format!("{}{}", String::from_utf8_lossy(&run.stdout), String::from_utf8_lossy(&run.stderr));
    let mut slides = Vec::new();
    if let Ok(file) = fs::File::open(out.join("deck.16x9.pptx")) {
        let mut archive = zip::ZipArchive::new(file).expect("pptx é um zip");
        for i in 1.. {
            let Ok(mut part) = archive.by_name(&format!("ppt/slides/slide{i}.xml")) else { break };
            let mut xml = String::new();
            part.read_to_string(&mut xml).expect("slide legível");
            slides.push(xml);
        }
    }
    let diagnostics = fs::read_to_string(out.join("deck.diagnostics.json")).ok().and_then(|s| serde_json::from_str::<Vec<Value>>(&s).ok()).unwrap_or_default();
    let _ = fs::remove_dir_all(&dir);
    Built { slides, diagnostics, stderr }
}

const VALUES: [&str; 4] = ["R$ 52,4 mi", "128 mil", "62", "+18,7 p.p."];

/// Fileira de 4 cartões em grid com um valor nowrap de 36 pt em cada.
fn stat_row(props: &str) -> String {
    let cards: String = VALUES.iter().map(|v| format!("<Box padding={{14}}><Text fontSize={{36}} fontWeight=\"bold\" nowrap minSize={{14}} {props}>{v}</Text></Box>")).collect();
    format!("<Box display=\"grid\" gridTemplateColumns=\"repeat(4, minmax(0, 1fr))\" gap={{12}}>{cards}</Box>")
}

fn all_equal(sizes: &[f64]) -> bool {
    sizes.windows(2).all(|w| (w[0] - w[1]).abs() < 0.011)
}

#[test]
fn nowrap_row_ends_at_one_size() {
    let alone = build("alone", &format!("<Slide padding={{36}}>{}</Slide>", stat_row("")));
    let grouped = build("grouped", &format!("<Slide padding={{36}}>{}</Slide>", stat_row("fitGroup=\"stats\"")));
    let (alone_sizes, grouped_sizes) = (alone.sizes(0), grouped.sizes(0));
    assert_eq!(alone_sizes.len(), 4, "{}", alone.stderr);
    assert!(!all_equal(&alone_sizes), "sem fitGroup cada nowrap encolhe sozinho: {alone_sizes:?}");
    // O grupo fica no menor corpo a que algum membro precisou chegar, e ninguém estoura.
    let smallest = alone_sizes.iter().copied().fold(f64::INFINITY, f64::min);
    assert_eq!(grouped_sizes, vec![smallest; 4], "{}", grouped.stderr);
    assert!(grouped.codes("error").is_empty(), "{}", grouped.stderr);
    // Um text-shrunk só, agrupado, com o corpo final e o nome do grupo.
    let shrunk: Vec<&Value> = grouped.diagnostics.iter().filter(|d| d["code"] == "text-shrunk").collect();
    assert_eq!(shrunk.len(), 1, "{}", grouped.stderr);
    assert_eq!(shrunk[0]["data"]["count"], 4);
    assert_eq!(shrunk[0]["data"]["toSize"].as_f64(), Some(smallest));
    assert_eq!(shrunk[0]["data"]["fitGroup"], "stats");
}

#[test]
fn group_is_inherited_from_a_box_and_scoped_by_name() {
    let row = stat_row("");
    let slide = format!("<Slide padding={{36}} gap={{10}}><Box fitGroup=\"a\">{row}</Box>{}</Slide>", stat_row("fitGroup=\"b\" fontFamily=\"Arial\"").replace("R$ 52,4 mi", "R$ 52"));
    let built = build("inherit", &slide);
    let sizes = built.sizes(0);
    assert_eq!(sizes.len(), 8, "{}", built.stderr);
    assert!(all_equal(&sizes[..4]) && all_equal(&sizes[4..]), "{sizes:?}");
    // Grupos diferentes não se igualam: o segundo tem valores mais curtos.
    assert!(sizes[4] > sizes[0], "{sizes:?}");
}

#[test]
fn height_and_width_drivers_share_one_scale_and_keep_the_hierarchy() {
    let slide = "<Slide padding={36}><Box flexDirection=\"row\" gap={12} alignItems=\"flex-start\" fitGroup=\"mix\">\
        <Box width={200} height={90} padding={8}><Text fontSize={30} minSize={10}>Este parágrafo estoura a altura da caixa e precisa encolher bastante.</Text></Box>\
        <Box width={150} padding={8}><Text fontSize={30} minSize={10} nowrap>R$ 1.234,5 mi</Text></Box>\
        <Box width={150} padding={8}><Text fontSize={30} minSize={10}>Curto</Text><Text fontSize={15} minSize={5}>legenda</Text></Box>\
        </Box></Slide>";
    let built = build("mix", slide);
    let sizes = built.sizes(0);
    // O parágrafo quebrado sai com um trecho por linha: a legenda é o último, o resto é o corpo de 30 pt.
    let Some((caption, body)) = sizes.split_last() else { panic!("{}", built.stderr) };
    assert!(body.len() >= 3 && body[0] < 30.0 && all_equal(body), "{sizes:?}");
    // Corpo de partida pela metade termina pela metade: o grupo iguala a escala.
    assert!((caption - body[0] / 2.0).abs() < 0.011, "{sizes:?}");
    assert!(built.codes("error").is_empty(), "{}", built.stderr);
}

#[test]
fn group_stops_at_the_floor_of_the_least_shrinkable_member() {
    // "62" só pode ir a 30 pt: o grupo para ali e quem não coube estoura com o diagnóstico de sempre.
    let cards = "<Box padding={14}><Text fontSize={36} nowrap minSize={14} fitGroup=\"s\">R$ 52,4 milhões</Text></Box>\
        <Box padding={14}><Text fontSize={36} nowrap minSize={30} fitGroup=\"s\">62</Text></Box>";
    let built = build("floor", &format!("<Slide padding={{36}}><Box display=\"grid\" gridTemplateColumns=\"repeat(4, minmax(0, 1fr))\" gap={{12}}>{cards}</Box></Slide>"));
    assert_eq!(built.sizes(0), vec![30.0, 30.0], "{}", built.stderr);
    let errors: Vec<&Value> = built.diagnostics.iter().filter(|d| d["severity"] == "error").collect();
    assert_eq!(errors.len(), 1, "{}", built.stderr);
    assert_eq!(errors[0]["code"], "text-overflow");
    assert_eq!(errors[0]["data"]["axis"], "width");
    assert!(errors[0]["message"].as_str().is_some_and(|m| m.contains("30 pt (mínimo)")), "{}", built.stderr);
}

#[test]
fn members_that_do_not_shrink_stay_out_of_the_group() {
    // fit="error" não encolhe: fica no corpo do autor e não segura os outros.
    let slide = format!("<Slide padding={{36}} gap={{10}}>{}<Text fontSize={{36}} fit=\"error\" fitGroup=\"stats\">fixo</Text></Slide>", stat_row("fitGroup=\"stats\""));
    let built = build("error-member", &slide);
    let sizes = built.sizes(0);
    assert_eq!(sizes.len(), 5, "{}", built.stderr);
    assert!(all_equal(&sizes[..4]) && sizes[0] < 36.0, "{sizes:?}");
    assert_eq!(sizes[4], 36.0);
}

#[test]
fn group_works_inside_a_container() {
    let slide = format!("<Slide padding={{36}}><Container height={{120}}>{{(box) => (<Box width={{box.width}} fitGroup=\"inside\">{}</Box>)}}</Container></Slide>", stat_row(""));
    let built = build("container", &slide);
    let sizes = built.sizes(0);
    assert_eq!(sizes.len(), 4, "{}", built.stderr);
    assert!(all_equal(&sizes) && sizes[0] < 36.0, "{sizes:?}");
    assert!(built.codes("error").is_empty(), "{}", built.stderr);
}

#[test]
fn group_is_per_page_under_paginate() {
    // 6 itens de 70 pt: 4 no primeiro slide, 2 no segundo; só o segundo tem o valor comprido.
    let items: String = (0..6)
        .map(|i| {
            let value = if i == 4 { "R$ 9.876,5 mi".to_string() } else { format!("{}0", i + 1) };
            format!("<Box flexDirection=\"row\" gap={{12}} height={{70}} alignItems=\"center\"><Box width={{120}}><Text fontSize={{32}} nowrap minSize={{12}} fitGroup=\"pag\">{value}</Text></Box></Box>")
        })
        .collect();
    let built = build("paginate", &format!("<Slide padding={{36}}><Box paginate gap={{10}} flexGrow={{1}}>{items}</Box></Slide>"));
    assert_eq!(built.slides.len(), 2, "{}", built.stderr);
    let (first, second) = (built.sizes(0), built.sizes(1));
    assert!(first.iter().all(|s| *s == 32.0), "{first:?}");
    assert_eq!(second.len(), 2, "{}", built.stderr);
    assert!(all_equal(&second) && second[0] < 32.0, "{second:?}");
}

#[test]
fn empty_group_name_is_rejected() {
    let built = build("invalid", "<Slide><Text fitGroup=\"\">a</Text></Slide>");
    assert!(built.stderr.contains("fitGroup") && built.stderr.contains("inválido"), "{}", built.stderr);
}
