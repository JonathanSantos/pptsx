//! Paridade com o pptsx em TS: o binário gera cada deck de `fixtures/` (saída do TS gravada por
//! `scripts/golden.sh`) e compara, slide a slide, a geometria (±TOLERANCE EMU), o texto com as
//! quebras, cores e tamanhos, os gráficos e os diagnósticos (código, severidade, tamanho, slide,
//! path e mensagem). Falha com um diff legível. Sem fixtures: `scripts/golden.sh`.

use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use regex::Regex;

/// Arredondamento f32 × f64 entre os motores: 1 EMU = 1/12700 pt.
const TOLERANCE: i64 = 2;
const SIZES: &str = "16x9,4x3";

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().and_then(Path::parent).expect("packages/pptsx-rs fica dentro do repo").to_path_buf()
}

// ───────────── extração semântica ─────────────

/// Uma forma do slide: chaves exatas (tipo, geometria, texto, cores) e números com tolerância.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Shape {
    keys: Vec<String>,
    nums: Vec<i64>,
}

fn re(p: &str) -> Regex {
    Regex::new(p).expect("regex fixa")
}

fn attr(xml: &str, name: &str) -> Option<String> {
    re(&format!(r#"\b{name}="([^"]*)""#)).captures(xml).map(|c| c[1].to_string())
}

fn nums_of(xml: &str, pattern: &str) -> Vec<i64> {
    re(pattern).captures_iter(xml).flat_map(|c| (1..c.len()).filter_map(|i| c.get(i).and_then(|m| m.as_str().parse::<i64>().ok())).collect::<Vec<_>>()).collect()
}

/// Parágrafos de um txBody: por `<a:p>`, alinhamento, quebras e os trechos (texto, sz, b, i, u, cor).
fn paragraphs_of(xml: &str) -> Vec<String> {
    let para = re(r"(?s)<a:p>(.*?)</a:p>");
    let run = re(r#"(?s)<a:(?:r|fld)\b[^>]*>(.*?)</a:(?:r|fld)>"#);
    let text = re(r"(?s)<a:t>(.*?)</a:t>");
    para.captures_iter(xml)
        .map(|p| {
            let body = &p[1];
            let algn = re(r#"<a:pPr[^>]*\balgn="(\w+)""#).captures(body).map_or("l".to_string(), |c| c[1].to_string());
            let breaks = body.matches("<a:br").count();
            let runs: Vec<String> = run
                .captures_iter(body)
                .map(|r| {
                    let inner = &r[1];
                    let rpr = re(r"(?s)<a:rPr\b([^>]*)(?:/>|>(.*?)</a:rPr>)").captures(inner);
                    let (attrs, rest) = rpr.as_ref().map_or(("", ""), |c| (c.get(1).map_or("", |m| m.as_str()), c.get(2).map_or("", |m| m.as_str())));
                    let color = attr(rest, "val").unwrap_or_default();
                    let t: String = text.captures_iter(inner).map(|c| c[1].to_string()).collect();
                    format!(
                        "{t}|sz={}|b={}|i={}|u={}|#{color}",
                        attr(attrs, "sz").unwrap_or_default(),
                        attr(attrs, "b").unwrap_or_else(|| "0".into()),
                        attr(attrs, "i").unwrap_or_else(|| "0".into()),
                        attr(attrs, "u").unwrap_or_else(|| "none".into())
                    )
                })
                .collect();
            format!("algn={algn} br={breaks} [{}]", runs.join(" ‖ "))
        })
        .collect()
}

/// Pintura do spPr: preenchimento e contorno (cor, espessura, tracejado), ignorando a verbosidade
/// do pptxgenjs (prstDash solid, round, headEnd/tailEnd none).
fn paint_of(sppr: &str) -> String {
    let ln = re(r"(?s)<a:ln\b([^>]*)>(.*?)</a:ln>").captures(sppr);
    let line = match ln {
        None => "ln=none".to_string(),
        Some(c) => {
            let body = &c[2];
            let w = attr(&c[1], "w").unwrap_or_default();
            // `<a:ln></a:ln>` do pptxgenjs (sem preenchimento declarado) e o `<a:noFill/>` explícito do
            // Rust desenham o mesmo: nenhum contorno.
            let color = if body.contains("<a:noFill/>") || body.trim().is_empty() { "noFill".to_string() } else { re(r#"<a:srgbClr val="(\w+)""#).captures(body).map_or("auto".into(), |m| m[1].to_string()) };
            let dash = re(r#"<a:prstDash val="(\w+)""#).captures(body).map_or("solid".to_string(), |m| m[1].to_string());
            let arrows: Vec<String> = re(r#"<a:(headEnd|tailEnd) type="(\w+)""#).captures_iter(body).filter(|m| &m[2] != "none").map(|m| format!("{}={}", &m[1], &m[2])).collect();
            format!("ln={color}/{w}/{dash}/{}", arrows.join(","))
        }
    };
    // Bordas por lado da célula (lnL/lnR/lnT/lnB): cor e espessura.
    let borders: Vec<String> = re(r#"(?s)<a:ln([LRTB]) w="(\d+)"[^>]*>(.*?)</a:ln[LRTB]>"#)
        .captures_iter(sppr)
        .map(|c| format!("{}:{}/{}", &c[1], re(r#"<a:srgbClr val="(\w+)""#).captures(&c[3]).map_or("noFill".into(), |m| m[1].to_string()), &c[2]))
        .collect();
    let without_ln = re(r"(?s)<a:ln[LRTB]?\b.*?</a:ln[LRTB]?>").replace_all(sppr, "");
    // Sem elemento de preenchimento (pptxgenjs) e `<a:noFill/>` explícito (Rust) pintam o mesmo.
    let fill = re(r#"<a:srgbClr val="(\w+)"(?:\s*/>|>(?:<a:alpha val="(\d+)"/>)?)"#)
        .captures(&without_ln)
        .map_or("noFill".into(), |m| format!("{}{}", &m[1], m.get(2).map_or(String::new(), |a| format!("@{}", a.as_str()))));
    let borders = if borders.is_empty() { String::new() } else { format!(" borders={}", borders.join(",")) };
    format!("fill={fill} {line}{borders}")
}

fn shapes_of(slide_xml: &str) -> Vec<Shape> {
    let shape = re(r"(?s)<p:(sp|pic|graphicFrame|cxnSp)>(.*?)</p:(?:sp|pic|graphicFrame|cxnSp)>");
    shape
        .captures_iter(slide_xml)
        .map(|c| {
            let kind = c[1].to_string();
            let body = &c[2];
            let mut keys = vec![kind.clone()];
            let mut nums = Vec::new();
            nums.extend(nums_of(body, r#"<a:off x="(-?\d+)" y="(-?\d+)"/>"#));
            nums.extend(nums_of(body, r#"<a:ext cx="(\d+)" cy="(\d+)"/>"#));
            keys.push(format!("rot={}", re(r#"<a:xfrm[^>]*\brot="(-?\d+)""#).captures(body).map_or("0".into(), |m| m[1].to_string())));
            keys.push(format!("flip={}{}", u8::from(body.contains("flipH=\"1\"")), u8::from(body.contains("flipV=\"1\""))));
            if let Some(m) = re(r#"<a:prstGeom prst="(\w+)">(.*?)</a:prstGeom>"#).captures(body) {
                let adj: Vec<String> = re(r#"<a:gd name="(\w+)" fmla="([^"]*)""#).captures_iter(&m[2]).map(|g| format!("{}={}", &g[1], &g[2])).collect();
                keys.push(format!("prst={} {}", &m[1], adj.join(",")));
            }
            if let Some(m) = re(r"(?s)<a:custGeom>(.*?)</a:custGeom>").captures(body) {
                let cmds: Vec<&str> = re(r"<a:(moveTo|lnTo|cubicBezTo|quadBezTo|arcTo|close)\b").captures_iter(&m[1]).map(|g| g.get(1).map_or("", |x| x.as_str())).collect();
                keys.push(format!("cust={}", cmds.join(",")));
                nums.extend(nums_of(&m[1], r#"<a:path w="(\d+)" h="(\d+)""#));
                nums.extend(nums_of(&m[1], r#"<a:pt x="(-?\d+)" y="(-?\d+)"/>"#));
            }
            if let Some(m) = re(r"(?s)<p:spPr>(.*?)</p:spPr>").captures(body) {
                keys.push(paint_of(&m[1]));
            }
            if let Some(m) = re(r"(?s)<p:txBody>(.*?)</p:txBody>").captures(body) {
                keys.push(format!("anchor={}", re(r#"<a:bodyPr[^>]*\banchor="(\w+)""#).captures(&m[1]).map_or("t".into(), |a| a[1].to_string())));
                keys.extend(paragraphs_of(&m[1]));
            }
            if body.contains("<a:tbl>") {
                nums.extend(nums_of(body, r#"<a:gridCol w="(\d+)"/>"#));
                nums.extend(nums_of(body, r#"<a:tr h="(\d+)">"#));
                let cells: Vec<String> = re(r"(?s)<a:tc\b([^>]*)>(.*?)</a:tc>")
                    .captures_iter(body)
                    .map(|t| {
                        let span = format!("{}{}", attr(&t[1], "gridSpan").map_or(String::new(), |s| format!(" gs={s}")), attr(&t[1], "rowSpan").map_or(String::new(), |s| format!(" rs={s}")));
                        let merged = format!("{}{}", u8::from(t[1].contains("hMerge=\"1\"")), u8::from(t[1].contains("vMerge=\"1\"")));
                        let tcpr = re(r"(?s)<a:tcPr\b[^>]*>(.*?)</a:tcPr>").captures(&t[2]).map_or(String::new(), |p| paint_of(&p[1]));
                        format!("tc{span} m={merged} {tcpr} {}", paragraphs_of(&t[2]).join(" / "))
                    })
                    .collect();
                keys.extend(cells);
            }
            if body.contains("<a:blip ") {
                // srcRect em milésimos de %: arredondamento f32 × f64 dá 1 unidade de diferença.
                let rect = re(r"<a:srcRect[^>]*/>").find(body).map_or("", |m| m.as_str());
                keys.push("pic".into());
                nums.extend(["l", "t", "r", "b"].iter().map(|k| attr(rect, k).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0)));
            }
            if body.contains("<c:chart ") {
                keys.push("chart".into());
            }
            Shape { keys, nums }
        })
        .collect()
}

/// Resumo de um `chartN.xml`: valores, categorias, título e o estilo de texto/linhas (como conjuntos).
fn chart_summary(xml: &str) -> Vec<String> {
    let mut out = Vec::new();
    out.push(format!("series={}", xml.matches("<c:ser>").count()));
    let values: Vec<String> = re(r"<c:v>([^<]*)</c:v>").captures_iter(xml).map(|c| c[1].parse::<f64>().map_or(c[1].to_string(), |n| format!("{n}"))).collect();
    out.push(format!("v=[{}]", values.join(",")));
    if let Some(t) = re(r"(?s)<c:title>(.*?)</c:title>").captures(xml) {
        let text: String = re(r"<a:t>([^<]*)</a:t>").captures_iter(&t[1]).map(|c| c[1].to_string()).collect();
        let rpr = re(r"(?s)<a:rPr\b([^>]*)>(.*?)</a:rPr>").captures(&t[1]);
        let (sz, b, color) = rpr.map_or((String::new(), String::new(), String::new()), |c| (attr(&c[1], "sz").unwrap_or_default(), attr(&c[1], "b").unwrap_or_default(), attr(&c[2], "val").unwrap_or_default()));
        out.push(format!("title={text}|sz={sz}|b={b}|#{color}"));
    }
    // Só o que está dentro de <c:chart>: o txPr padrão que o pptxgenjs põe no chartSpace (18 pt
    // preto) não estiliza nada visível.
    let chart = re(r"(?s)<c:chart>(.*?)</c:chart>").captures(xml).map_or(String::new(), |c| c[1].to_string());
    // Rótulos: quando cada ponto tem o seu <c:dLbl>, o txPr do <c:dLbls> da série (18 pt preto no
    // pptxgenjs) não aparece; fica só o dos pontos.
    let chart = re(r"(?s)<c:dLbls>(.*?)</c:dLbls>")
        .replace_all(&chart, |c: &regex::Captures| {
            let inner = &c[1];
            if inner.contains("<c:dLbl>") { re(r"(?s)<c:dLbl>.*?</c:dLbl>").find_iter(inner).map(|m| m.as_str()).collect::<String>() } else { c[0].to_string() }
        })
        .into_owned();
    let mut styles: Vec<String> = re(r"(?s)<c:txPr>(.*?)</c:txPr>")
        .captures_iter(&chart)
        .map(|c| {
            let d = re(r"(?s)<a:defRPr\b([^>]*)>(.*?)</a:defRPr>").captures(&c[1]);
            d.map_or("defRPr=∅".into(), |d| format!("sz={} b={} #{}", attr(&d[1], "sz").unwrap_or_default(), attr(&d[1], "b").unwrap_or_else(|| "0".into()), attr(&d[2], "val").unwrap_or_default()))
        })
        .collect();
    styles.sort();
    styles.dedup();
    out.push(format!("txPr={{{}}}", styles.join("; ")));
    // Linhas dos eixos e da grade (e a borda das fatias na pizza/rosca), como conjunto.
    let line_re = re(r#"(?s)<a:ln w="(\d+)"[^>]*>\s*<a:solidFill>\s*<a:srgbClr val="(\w+)"/>"#);
    let axes: String = re(r"(?s)<c:(?:catAx|valAx|dateAx|serAx)>.*?</c:(?:catAx|valAx|dateAx|serAx)>").find_iter(&chart).map(|m| m.as_str()).collect();
    let mut lines: Vec<String> = line_re.captures_iter(&axes).map(|c| format!("{}/{}", &c[2], &c[1])).collect();
    if chart.contains("<c:pieChart>") || chart.contains("<c:doughnutChart>") {
        let series: String = re(r"(?s)<c:ser>.*?</c:ser>").find_iter(&chart).map(|m| m.as_str()).collect();
        lines.extend(line_re.captures_iter(&series).map(|c| format!("slice {}/{}", &c[2], &c[1])));
    }
    lines.sort();
    lines.dedup();
    out.push(format!("lines={{{}}}", lines.join("; ")));
    out
}

// ───────────── comparação ─────────────

fn compare_shapes(label: &str, expected: &[Shape], actual: &[Shape], errors: &mut Vec<String>) {
    if expected.len() != actual.len() {
        errors.push(format!("{label}: {} formas no TS, {} no Rust", expected.len(), actual.len()));
    }
    for (i, (e, a)) in expected.iter().zip(actual).enumerate() {
        if e.keys != a.keys {
            let diff: Vec<String> = e.keys.iter().zip(&a.keys).filter(|(x, y)| x != y).map(|(x, y)| format!("    ts: {x}\n    rs: {y}")).collect();
            let extra = if e.keys.len() != a.keys.len() { format!("\n    ({} chaves no TS, {} no Rust)", e.keys.len(), a.keys.len()) } else { String::new() };
            errors.push(format!("{label} forma {i} ({}):\n{}{extra}", e.keys.first().map_or("", String::as_str), diff.join("\n")));
            continue;
        }
        if e.nums.len() != a.nums.len() || e.nums.iter().zip(&a.nums).any(|(x, y)| (x - y).abs() > TOLERANCE) {
            errors.push(format!("{label} forma {i} ({}): geometria\n    ts: {:?}\n    rs: {:?}", e.keys.first().map_or("", String::as_str), e.nums, a.nums));
        }
    }
}

type DiagKey = (String, String, String, u64, String, String);

fn diag_keys(json: &str) -> BTreeMap<DiagKey, usize> {
    let list: Vec<serde_json::Value> = serde_json::from_str(json).expect("diagnostics.json válido");
    let s = |v: &serde_json::Value, k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
    let mut out = BTreeMap::new();
    for d in list {
        let key = (s(&d, "code"), s(&d, "severity"), s(&d, "size"), d.get("slide").and_then(|x| x.as_u64()).unwrap_or(0), s(&d, "path"), s(&d, "message"));
        *out.entry(key).or_insert(0) += 1;
    }
    out
}

fn compare_diagnostics(expected: &str, actual: &str, errors: &mut Vec<String>) {
    let (e, a) = (diag_keys(expected), diag_keys(actual));
    for (k, n) in &e {
        if a.get(k) != Some(n) {
            errors.push(format!("diagnóstico só no TS (ou em outra quantidade): {k:?}"));
        }
    }
    for (k, n) in &a {
        if e.get(k) != Some(n) {
            errors.push(format!("diagnóstico só no Rust (ou em outra quantidade): {k:?}"));
        }
    }
}

fn read_part(archive: &mut zip::ZipArchive<fs::File>, name: &str) -> Option<String> {
    let mut file = archive.by_name(name).ok()?;
    let mut s = String::new();
    file.read_to_string(&mut s).ok()?;
    Some(s)
}

fn run_golden(name: &str) {
    let dir = fixtures().join(name);
    assert!(dir.join("deck.txt").is_file(), "sem fixture em {}: rode scripts/golden.sh", dir.display());
    let deck = repo().join(fs::read_to_string(dir.join("deck.txt")).expect("deck.txt").trim());
    let out = std::env::temp_dir().join(format!("pptsx-rs-golden-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&out);
    let status = Command::new(env!("CARGO_BIN_EXE_pptsx-rs"))
        .args(["build", &deck.display().to_string(), "--size", SIZES, "--out", &out.display().to_string(), "--preview", "none"])
        .output()
        .expect("rodar o binário");
    // Sai 1 com diagnóstico error (overflow.tsx); o que importa é o .pptx existir.
    let mut errors = Vec::new();
    for size in SIZES.split(',') {
        let pptx = out.join(format!("{name}.{size}.pptx"));
        let Ok(file) = fs::File::open(&pptx) else {
            errors.push(format!("{size}: o binário não gravou {} (saída: {})", pptx.display(), String::from_utf8_lossy(&status.stderr)));
            continue;
        };
        let mut archive = zip::ZipArchive::new(file).expect("pptx é um zip");
        let mut parts: Vec<PathBuf> = fs::read_dir(dir.join(size)).expect("pasta do tamanho").flatten().map(|e| e.path()).collect();
        parts.sort();
        for part in parts {
            let file_name = part.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            let expected = fs::read_to_string(&part).expect("fixture legível");
            let is_chart = file_name.starts_with("chart");
            let inner = if is_chart { format!("ppt/charts/{file_name}") } else { format!("ppt/slides/{file_name}") };
            let Some(actual) = read_part(&mut archive, &inner) else {
                errors.push(format!("{size}/{file_name}: parte ausente no .pptx do Rust"));
                continue;
            };
            let label = format!("{size}/{file_name}");
            if is_chart {
                let (e, a) = (chart_summary(&expected), chart_summary(&actual));
                if e != a {
                    let diff: Vec<String> = e.iter().zip(&a).filter(|(x, y)| x != y).map(|(x, y)| format!("    ts: {x}\n    rs: {y}")).collect();
                    errors.push(format!("{label}:\n{}", diff.join("\n")));
                }
            } else {
                compare_shapes(&label, &shapes_of(&expected), &shapes_of(&actual), &mut errors);
            }
        }
        let extra = (1..).map(|i| format!("ppt/slides/slide{i}.xml")).take_while(|n| archive.by_name(n).is_ok()).count();
        let expected_slides = fs::read_dir(dir.join(size)).expect("pasta").flatten().filter(|e| e.file_name().to_string_lossy().starts_with("slide")).count();
        if extra != expected_slides {
            errors.push(format!("{size}: {expected_slides} slides no TS, {extra} no Rust"));
        }
    }
    let expected = fs::read_to_string(dir.join("diagnostics.json")).expect("diagnostics.json da fixture");
    match fs::read_to_string(out.join(format!("{name}.diagnostics.json"))) {
        Ok(actual) => compare_diagnostics(&expected, &actual, &mut errors),
        Err(e) => errors.push(format!("sem diagnostics.json do Rust: {e}")),
    }
    let _ = fs::remove_dir_all(&out);
    assert!(errors.is_empty(), "\n{name}: {} diferença(s) com o pptsx em TS\n\n{}\n", errors.len(), errors.join("\n\n"));
}

macro_rules! golden {
    ($($name:ident),* $(,)?) => {
        $(
            #[test]
            fn $name() {
                run_golden(&stringify!($name).replace('_', "-"));
            }
        )*
    };
}

golden!(hello, layout_test, overflow, demo, charts, showcase, long_list);
