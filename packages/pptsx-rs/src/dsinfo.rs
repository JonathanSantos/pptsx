//! Um design system visto pelo binário (`init --ds`, `skill --ds`): o manifesto que `createDs`/
//! `defineDs` exportam (`ds` nomeado ou default), lido pelo avaliador do módulo do DS. Espelha
//! `cli/init.ts loadDsSource` e `skill.ts dsMarkdown` do TS, sem o Node: o módulo pode ser um
//! pacote em `node_modules` ou um caminho `.ts`/`.tsx`.

use std::path::{Path, PathBuf};
use std::rc::Rc;

use crate::js::value::{Obj, Value, to_json};

pub struct DsComponent {
    pub name: String,
    pub display_name: Option<String>,
    pub guide: Option<String>,
    /// Props do 1º caso do catálogo (o exemplo do deck inicial e do ds.md).
    pub props: Option<Rc<Obj>>,
}

pub struct DsInfo {
    pub name: String,
    pub version: String,
    /// O especificador que o deck e a config importam (o pacote, ou um caminho relativo com extensão).
    pub import_from: String,
    /// `import { ds } from …` (nomeado) ou `import ds from …` (default).
    pub named: bool,
    pub has_theme: bool,
    /// `light1` e `dark1` do tema, para o fundo e o texto do deck inicial.
    pub background: Option<String>,
    pub ink: Option<String>,
    pub components: Vec<DsComponent>,
    pub rules: Vec<(String, String)>,
    pub guide: Option<String>,
    pub schema: Option<Value>,
    /// Pasta do DS relativa ao deck quando ele é um caminho `.ts`/`.tsx` fora da pasta (entra no `include`).
    pub ds_dir: Option<String>,
    /// `extends` do tsconfig quando o deck fica dentro do monorepo do pptsx.
    pub tsconfig_extends: Option<String>,
}

const DS_ENTRIES: [&str; 4] = ["index.ts", "index.tsx", "ds.ts", "index.js"];

fn get<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    match v {
        Value::Object(o) => o.get(key).filter(|v| !v.is_nullish()),
        _ => None,
    }
}

fn get_str(v: &Value, key: &str) -> Option<String> {
    get(v, key).map(Value::to_js_string).filter(|s| !s.is_empty())
}

/// Caminho relativo com `/`, começando por `./` ou `../`.
fn relative_import(from: &Path, to: &Path) -> String {
    let (from, to) = (std::fs::canonicalize(from).unwrap_or_else(|_| from.to_path_buf()), std::fs::canonicalize(to).unwrap_or_else(|_| to.to_path_buf()));
    let f: Vec<_> = from.components().collect();
    let t: Vec<_> = to.components().collect();
    let common = f.iter().zip(&t).take_while(|(a, b)| a == b).count();
    let mut parts: Vec<String> = (common..f.len()).map(|_| "..".to_string()).collect();
    parts.extend(t[common..].iter().map(|c| c.as_os_str().to_string_lossy().into_owned()));
    let rel = parts.join("/");
    if rel.starts_with("..") { rel } else { format!("./{rel}") }
}

fn is_path_spec(spec: &str, cwd: &Path) -> bool {
    spec.starts_with('.') || Path::new(spec).is_absolute() || cwd.join(spec).exists()
}

/// Caminho → o arquivo de entrada (pasta: index.ts, ds.ts…); pacote → resolvido como o deck resolveria.
fn entry_of(spec: &str, cwd: &Path) -> Result<(PathBuf, bool), String> {
    if !is_path_spec(spec, cwd) {
        let file = crate::js::resolve_import(cwd, spec).ok_or_else(|| format!("--ds {spec}: pacote não encontrado em node_modules a partir de {}", cwd.display()))?;
        return Ok((file, false));
    }
    let target = if Path::new(spec).is_absolute() { PathBuf::from(spec) } else { cwd.join(spec) };
    if target.is_dir() {
        let file = DS_ENTRIES.iter().map(|e| target.join(e)).find(|p| p.is_file()).ok_or_else(|| format!("--ds {spec}: a pasta não tem {}", DS_ENTRIES.join(", ")))?;
        return Ok((file, true));
    }
    if !target.is_file() {
        return Err(format!("--ds {spec}: arquivo não encontrado"));
    }
    Ok((target, true))
}

fn monorepo_tsconfig(deck_dir: &Path) -> Option<String> {
    let mut dir = std::fs::canonicalize(deck_dir).ok()?;
    loop {
        let candidate = dir.join("tsconfig.monorepo.json");
        if candidate.is_file() {
            return Some(relative_import(deck_dir, &candidate));
        }
        if !dir.pop() {
            return None;
        }
    }
}

fn components_of(manifest: &Value) -> Vec<DsComponent> {
    let Some(Value::Array(list)) = get(manifest, "components") else { return Vec::new() };
    list.borrow()
        .iter()
        .filter_map(|meta| {
            let name = get_str(meta, "name")?;
            let props = match get(meta, "catalog") {
                Some(Value::Array(cases)) => cases.borrow().first().and_then(|case| match get(case, "props") {
                    Some(Value::Object(p)) => Some(p.clone()),
                    _ => None,
                }),
                _ => None,
            };
            Some(DsComponent { name, display_name: get_str(meta, "displayName"), guide: get_str(meta, "guide"), props })
        })
        .collect()
}

fn rules_of(manifest: &Value) -> Vec<(String, String)> {
    let Some(Value::Array(list)) = get(manifest, "rules") else { return Vec::new() };
    list.borrow().iter().filter_map(|r| Some((get_str(r, "id")?, get_str(r, "severity").unwrap_or_else(|| "warning".into())))).collect()
}

/// Carrega o módulo do DS e lê o manifesto. `deck_dir` é a pasta do deck que vai importá-lo.
pub fn load(spec: &str, deck_dir: &Path, cwd: &Path) -> Result<DsInfo, String> {
    let (file, by_path) = entry_of(spec, cwd)?;
    let (_, exports) = crate::js::evaluate_exports(&file)?;
    let (manifest, named) = match exports.get("ds").filter(|v| get_str(v, "name").is_some()) {
        Some(v) => (v.clone(), true),
        None => match exports.get("default").filter(|v| get_str(v, "name").is_some()) {
            Some(v) => (v.clone(), false),
            None => return Err(format!("--ds {spec}: o módulo precisa exportar \"ds\" (ou default) um defineDs/createDs")),
        },
    };
    let is_ts = file.extension().is_some_and(|e| e == "ts" || e == "tsx");
    let import_from = if by_path { relative_import(deck_dir, &file) } else { spec.to_string() };
    let inside = std::fs::canonicalize(&file).ok().zip(std::fs::canonicalize(deck_dir).ok()).is_some_and(|(f, d)| f.starts_with(&d));
    let ds_dir = (by_path && is_ts && !inside).then(|| file.parent().map(|p| relative_import(deck_dir, p)).unwrap_or_else(|| ".".into()));
    let theme = get(&manifest, "theme").and_then(crate::config::theme_of);
    let color = |slot: &str| theme.as_ref().and_then(|t| t.colors.iter().find(|(k, _)| k == slot).map(|(_, hex)| format!("#{hex}")));
    Ok(DsInfo {
        name: get_str(&manifest, "name").unwrap_or_else(|| spec.to_string()),
        version: get_str(&manifest, "version").unwrap_or_else(|| "0.0.0".into()),
        import_from,
        named,
        has_theme: theme.is_some(),
        background: color("light1"),
        ink: color("dark1"),
        components: components_of(&manifest),
        rules: rules_of(&manifest),
        guide: get_str(&manifest, "guide"),
        schema: get(&manifest, "schema").cloned(),
        ds_dir,
        tsconfig_extends: monorepo_tsconfig(deck_dir),
    })
}

fn is_identifier(name: &str) -> bool {
    let mut chars = name.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$') && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

fn is_safe_string(s: &str) -> bool {
    !s.chars().any(|c| matches!(c, '"' | '{' | '}' | '<' | '>' | '\\' | '\n'))
}

/// O componente em JSX com as props de um caso do catálogo (ds-scaffold.ts componentUsageOf): um
/// elemento (slot) vira `{<Text>nome</Text>}` para o autor trocar.
pub fn usage_of(component: &DsComponent) -> String {
    let mut attrs: Vec<String> = Vec::new();
    if let Some(props) = &component.props {
        for (name, value) in props.iter() {
            if !is_identifier(name) {
                continue;
            }
            let attr = match value {
                Value::Undefined => continue,
                Value::Element(_) => format!("{name}={{<Text>{name}</Text>}}"),
                Value::Str(s) if is_safe_string(s) => format!("{name}=\"{s}\""),
                Value::Bool(true) => name.to_string(),
                other => {
                    let mut json = String::new();
                    to_json(other, &mut json);
                    format!("{name}={{{json}}}")
                }
            };
            attrs.push(attr);
        }
    }
    if attrs.is_empty() { format!("<{} />", component.name) } else { format!("<{} {} />", component.name, attrs.join(" ")) }
}

/// Deck inicial com o DS (ds-scaffold.ts dsDeckContent): um slide por componente com caso de catálogo.
pub fn deck_content(ds: &DsInfo) -> String {
    let mut slide_props = vec!["padding={40}".to_string(), "gap={16}".to_string()];
    if let Some(bg) = &ds.background {
        slide_props.push(format!("backgroundColor=\"{bg}\""));
    }
    if let Some(ink) = &ds.ink {
        slide_props.push(format!("color=\"{ink}\""));
    }
    let slide_props = slide_props.join(" ");
    let shown: Vec<&DsComponent> = ds.components.iter().filter(|c| c.props.is_some()).collect();
    let names: Vec<&str> = shown.iter().map(|c| c.name.as_str()).collect();
    let slides: Vec<String> = if shown.is_empty() {
        vec![format!("    <Slide {slide_props}>\n      <Text fontSize={{24}}>Nenhum componente do {} tem caso de catálogo.</Text>\n    </Slide>", ds.name)]
    } else {
        shown.iter().map(|c| format!("    <Slide {slide_props}>\n      <Text fontSize={{24}} fontWeight=\"bold\">{}</Text>\n      {}\n    </Slide>", c.name, usage_of(c))).collect()
    };
    let mut out = vec![
        format!("// Deck criado por `pptsx-rs init --ds`: um slide por componente do {}, com as props do catálogo.", ds.name),
        "//   pptsx-rs build deck.tsx --size 16x9,4x3".to_string(),
        "//   pptsx-rs lint deck.tsx   (regras do núcleo + as do DS registrado no pptsx.config.ts)".to_string(),
        "import { Deck, Slide, Text, defineDeck } from 'pptsx';".to_string(),
    ];
    if !names.is_empty() {
        out.push(format!("import {{ {} }} from '{}';", names.join(", "), ds.import_from));
    }
    out.push(String::new());
    out.push("export default defineDeck(() => (".into());
    out.push("  <Deck>".into());
    out.push(slides.join("\n\n"));
    out.push("  </Deck>".into());
    out.push("));".into());
    out.push(String::new());
    out.join("\n")
}

/// `pptsx.config.ts` que registra o DS (regras no lint, tema no arquivo).
pub fn config_content(ds: &DsInfo) -> String {
    let import_line = if ds.named { format!("import {{ ds }} from '{}';", ds.import_from) } else { format!("import ds from '{}';", ds.import_from) };
    let theme = if ds.has_theme { ", theme: ds.theme" } else { "" };
    format!(
        "import {{ defineConfig }} from 'pptsx';\n{import_line}\n\n// O {} no lint (regras) e no arquivo (tema). Outras opções: sizes, lang, fonts, textSafety, lineBreaks, embedFonts.\nexport default defineConfig({{ ds: [ds]{theme} }});\n",
        ds.name
    )
}

/// `references/ds.md` da skill (skill.ts dsMarkdown): import, componentes com exemplo, regras e guia.
pub fn markdown(ds: &DsInfo, props_md: impl Fn(&Value) -> String) -> String {
    let mut out = vec![format!("# {} {}", ds.name, ds.version), String::new()];
    let first: Vec<&str> = ds.components.iter().take(3).map(|c| c.name.as_str()).collect();
    out.push(format!(
        "Importe de `{}` (`import {{ {} }} from '{}';`) e registre o DS no `pptsx.config.ts` da pasta do deck (o arquivo pronto está em `references/pptsx.config.ts`).",
        ds.import_from,
        first.join(", "),
        ds.import_from
    ));
    out.push(String::new());
    out.push("## Componentes".into());
    out.push(String::new());
    for c in &ds.components {
        out.push(format!("### {}", c.display_name.as_deref().unwrap_or(&c.name)));
        out.push(String::new());
        if let Some(g) = &c.guide {
            out.push(g.trim().to_string());
            out.push(String::new());
        }
        if c.props.is_some() {
            out.push("```tsx".into());
            out.push(usage_of(c));
            out.push("```".into());
            out.push(String::new());
        }
    }
    if !ds.rules.is_empty() {
        out.push("## Regras de lint".into());
        out.push(String::new());
        out.push("O `lint` e o `build` apontam estas regras do DS, com o caminho do nó:".into());
        out.push(String::new());
        out.extend(ds.rules.iter().map(|(id, sev)| format!("- `{id}` ({sev})")));
        out.push(String::new());
    }
    if let Some(guide) = &ds.guide {
        out.push("## Guia do design system".into());
        out.push(String::new());
        let body = guide.strip_prefix('#').map_or(guide.as_str(), |rest| rest.split_once('\n').map_or("", |(_, b)| b));
        out.push(body.trim().to_string());
        out.push(String::new());
    }
    if let Some(schema) = &ds.schema {
        out.push(props_md(schema));
    }
    out.join("\n")
}
