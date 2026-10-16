//! `pptsx.config.ts` (src/config.ts do pptsx): a da pasta do deck ou a mais próxima acima.
//! Avaliada pelo mesmo interpretador; daqui saem fontes, tamanhos, idioma, tema e título.

use std::path::{Path, PathBuf};

use crate::js::Value;
use crate::js::value::Obj;
use crate::text::FontFile;

pub const CONFIG_FILE: &str = "pptsx.config.ts";

#[derive(Clone, Default)]
pub struct Theme {
    pub name: Option<String>,
    /// (slot do tema, hex sem '#'), só os declarados.
    pub colors: Vec<(String, String)>,
    pub heading: Option<String>,
    pub body: Option<String>,
}

#[derive(Clone, Default)]
pub struct Document {
    pub author: Option<String>,
    pub company: Option<String>,
    pub subject: Option<String>,
    /// Lista juntada com ", " (emit/document.ts keywordsOf).
    pub keywords: Option<String>,
}

#[derive(Default)]
pub struct Config {
    pub path: Option<PathBuf>,
    pub fonts: Vec<FontFile>,
    pub sizes: Vec<String>,
    pub lang: Option<String>,
    pub theme: Option<Theme>,
    pub title: Option<String>,
    /// `document` da config: autor, empresa, assunto e palavras-chave do arquivo.
    pub document: Document,
    /// DEFAULTS.textSafety (largura de quebra = disponível × isto).
    pub text_safety: Option<f32>,
    /// "forced" (padrão) ou "auto".
    pub line_breaks: Option<String>,
    /// M8: embute no .pptx as faces do autor que o deck usa (EOT); a flag --embed-fonts vence.
    pub embed_fonts: bool,
    pub warnings: Vec<String>,
}

fn find(deck: &Path) -> Option<PathBuf> {
    let mut dir = std::fs::canonicalize(deck).ok()?.parent()?.to_path_buf();
    loop {
        let candidate = dir.join(CONFIG_FILE);
        if candidate.is_file() {
            return Some(candidate);
        }
        if !dir.pop() {
            return None;
        }
    }
}

fn get<'a>(o: &'a Obj, k: &str) -> Option<&'a Value> {
    o.get(k).filter(|v| !v.is_nullish())
}

fn string(o: &Obj, k: &str) -> Option<String> {
    get(o, k).map(Value::to_js_string)
}

/// Tema (M15): `{ name, colors: { accent1: '#…' }, fonts: { heading, body } }`.
pub fn theme_of(v: &Value) -> Option<Theme> {
    let Value::Object(o) = v else { return None };
    let mut theme = Theme { name: string(o, "name"), ..Theme::default() };
    if let Some(Value::Object(colors)) = get(o, "colors") {
        for (k, v) in colors.iter() {
            if let Some(c) = crate::css::parse_color(&v.to_js_string()) {
                theme.colors.push((k.to_string(), c.hex()));
            }
        }
    }
    if let Some(Value::Object(fonts)) = get(o, "fonts") {
        theme.heading = string(fonts, "heading");
        theme.body = string(fonts, "body");
    }
    Some(theme)
}

pub fn load(deck: &Path) -> Result<Config, String> {
    let Some(path) = find(deck) else { return Ok(Config::default()) };
    let value = crate::js::evaluate_default(&path)?;
    let Value::Object(o) = value else {
        return Err(format!("{} precisa exportar default defineConfig({{ ... }})", path.display()));
    };
    let dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    let mut config = Config { path: Some(path.clone()), ..Config::default() };
    if let Some(Value::Array(sizes)) = get(&o, "sizes") {
        config.sizes = sizes
            .borrow().iter()
            .map(|s| match s {
                // { width, height } em polegadas vira o token "<L>x<A>in".
                Value::Object(wh) => format!("{}x{}in", wh.get("width").map(Value::to_js_string).unwrap_or_default(), wh.get("height").map(Value::to_js_string).unwrap_or_default()),
                other => other.to_js_string(),
            })
            .collect();
    }
    config.lang = string(&o, "lang");
    config.text_safety = match get(&o, "textSafety") {
        Some(Value::Num(n)) if *n > 0.0 && *n <= 1.0 => Some(*n as f32),
        _ => None,
    };
    config.line_breaks = string(&o, "lineBreaks");
    config.embed_fonts = matches!(get(&o, "embedFonts"), Some(Value::Bool(true)));
    config.theme = get(&o, "theme").and_then(theme_of);
    if let Some(Value::Object(doc)) = get(&o, "document") {
        config.title = string(doc, "title");
        config.document = Document {
            author: string(doc, "author"),
            company: string(doc, "company"),
            subject: string(doc, "subject"),
            keywords: match get(doc, "keywords") {
                Some(Value::Array(list)) => Some(list.borrow().iter().map(Value::to_js_string).collect::<Vec<_>>().join(", ")),
                Some(other) => Some(other.to_js_string()),
                None => None,
            },
        };
    }
    if let Some(Value::Array(fonts)) = get(&o, "fonts") {
        let mut system: Option<Vec<SystemFace>> = None;
        for f in fonts.borrow().iter() {
            let Value::Object(face) = f else { continue };
            let family = string(face, "family").unwrap_or_default();
            let weight: u16 = match get(face, "weight") {
                Some(Value::Num(n)) => n.clamp(1.0, 1000.0) as u16,
                Some(Value::Str(s)) if &**s == "bold" => 700,
                Some(Value::Str(s)) => s.parse::<f64>().map_or(400, |n| n.clamp(1.0, 1000.0) as u16),
                _ => 400,
            };
            let italic = matches!(get(face, "italic"), Some(Value::Bool(true)));
            let postscript = string(face, "postscriptName");
            let file = match string(face, "file") {
                Some(file) => {
                    let p = PathBuf::from(&file);
                    if p.is_absolute() { p } else { dir.join(p) }
                }
                None => {
                    // M8: sem `file`, procura a face nas pastas de fontes do sistema.
                    let list = system.get_or_insert_with(system_faces);
                    match list.iter().filter(|s| s.family.eq_ignore_ascii_case(&family) && s.italic == italic).min_by_key(|s| s.weight.abs_diff(weight)) {
                        Some(found) => {
                            config.fonts.push(FontFile { family, weight, italic, path: found.path.clone(), postscript: Some(found.postscript.clone()) });
                            continue;
                        }
                        None => {
                            config.warnings.push(format!("fonte \"{family}\" não encontrada no sistema"));
                            continue;
                        }
                    }
                }
            };
            config.fonts.push(FontFile { family, weight, italic, path: file, postscript });
        }
    }
    Ok(config)
}

struct SystemFace {
    family: String,
    weight: u16,
    italic: bool,
    path: PathBuf,
    postscript: String,
}

fn font_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![PathBuf::from("/System/Library/Fonts"), PathBuf::from("/Library/Fonts"), PathBuf::from("/usr/share/fonts"), PathBuf::from("/usr/local/share/fonts")];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(&home).join("Library/Fonts"));
        dirs.push(PathBuf::from(&home).join(".fonts"));
        dirs.push(PathBuf::from(&home).join(".local/share/fonts"));
    }
    if let Some(windir) = std::env::var_os("WINDIR") {
        dirs.push(PathBuf::from(windir).join("Fonts"));
    }
    dirs
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() && depth < 4 {
            walk(&p, out, depth + 1);
        } else if p.extension().and_then(|x| x.to_str()).is_some_and(|x| matches!(x.to_ascii_lowercase().as_str(), "ttf" | "otf" | "ttc")) {
            out.push(p);
        }
    }
}

fn system_faces() -> Vec<SystemFace> {
    use rustybuzz::ttf_parser::{Face, fonts_in_collection, name_id};

    let mut files = Vec::new();
    for d in font_dirs() {
        walk(&d, &mut files, 0);
    }
    let mut out = Vec::new();
    for path in files {
        let Ok(data) = std::fs::read(&path) else { continue };
        for i in 0..fonts_in_collection(&data).unwrap_or(1) {
            let Ok(face) = Face::parse(&data, i) else { continue };
            let name = |id: u16| crate::text::font_name(&face, id);
            let Some(family) = name(name_id::TYPOGRAPHIC_FAMILY).or_else(|| name(name_id::FAMILY)) else { continue };
            out.push(SystemFace { family, weight: face.weight().to_number(), italic: face.is_italic(), path: path.clone(), postscript: name(name_id::POST_SCRIPT_NAME).unwrap_or_default() });
        }
    }
    out
}
