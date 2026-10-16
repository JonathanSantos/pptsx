//! `pptsx-rs init [pasta] [--force] [--json]`: os mesmos arquivos do `pptsx init` do TS
//! (cli/scaffold.ts, cli/init.ts, cli/tsconfig.ts): deck.tsx de exemplo, tsconfig.json com o JSX
//! do pptsx, pptsx.config.ts, assets/.gitkeep, .gitignore e package.json. Sem `--force` um
//! deck.tsx existente aborta; .gitignore, package.json e tsconfig.json existentes são mesclados,
//! nunca apagados. Não porta o `--ds` (ele carrega o módulo do DS pelo Node para montar o deck).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::rc::Rc;

use crate::js::value::{Obj, Value, arr_val, obj_val, str_val};

const DECK_FILE: &str = "deck.tsx";
const TSCONFIG_FILE: &str = "tsconfig.json";
const GITIGNORE_FILE: &str = ".gitignore";
const PACKAGE_FILE: &str = "package.json";
const GITIGNORE_ENTRY: &str = "dist/";
const NEXT_COMMAND: &str = "pptsx-rs build deck.tsx --size 16x9,4x3";

const DECK_TEMPLATE: &str = r##"// Deck criado por `pptsx-rs init`. Para gerar dist/deck.16x9.pptx, dist/deck.4x3.pptx e as prévias em PNG:
//   pptsx-rs build deck.tsx --size 16x9,4x3
// Durante a edição, `--watch` refaz o build a cada mudança salva.
import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

// O mesmo código serve para todos os tamanhos: valores responsivos ({ base, tall, wide })
// trocam o layout por breakpoint, sem ler ctx. Fonte e cor definidas no Slide descem para os Text.
export default defineDeck(() => (
  <Deck>
    <Slide backgroundColor="#1B2A4A" padding={48} justifyContent="flex-end" gap={16} color="#FFFFFF">
      <Shape kind="rect" width={56} height={6} fill="#F2A541" />
      <Text fontSize={44} fontWeight="bold">
        Meu primeiro deck
      </Text>
      <Text fontSize={20} color="#C9D3E8">
        TSX entra, PPTX editável sai.
      </Text>
    </Slide>

    <Slide backgroundColor="#FFFFFF" padding={48} gap={24} color="#44506A">
      <Text fontSize={32} fontWeight="bold" color="#1B2A4A">
        Como funciona
      </Text>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }} gap={24} flex={1}>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20} gap={8}>
          <Text fontSize={20} fontWeight="bold" color="#2F6FED">
            Layout em CSS
          </Text>
          <Text fontSize={16}>
            Box, Slide e Text usam box model, flexbox e grid: posições e tamanhos são calculados para cada formato.
          </Text>
        </Box>
        <Box backgroundColor="#F4F6FA" borderRadius={8} padding={20} gap={8}>
          <Text fontSize={20} fontWeight="bold" color="#2F6FED">
            Texto que cabe
          </Text>
          <Text fontSize={16}>
            Se o texto não couber, a fonte encolhe; o que não tiver jeito vira diagnóstico com o caminho até o nó.
          </Text>
        </Box>
      </Box>
      <Text fontSize={12} marginTop="auto" color="#8A94A8">
        Rodapé no fim do slide com marginTop="auto".
      </Text>
    </Slide>
  </Deck>
));
"##;

const TSCONFIG_TEMPLATE: &str = r#"{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "pptsx",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["dist"]
}
"#;

const CONFIG_TEMPLATE: &str = r#"import { defineConfig } from 'pptsx';

// Opções (todas opcionais; flags da CLI vencem a config):
//   sizes: ['16x9', '4x3']            tamanhos gerados quando --size não é passado
//   lang: 'pt-BR'                     idioma do texto (corretor ortográfico do PowerPoint)
//   fonts: [{ family, weight, file }] fontes próprias, caminhos relativos a este arquivo
//   textSafety: 0.97                  folga da quebra de linha (largura usada = disponível * fator)
//   lineBreaks: 'forced' | 'auto'     forced = linhas exatas do layout; auto = o PowerPoint requebra
export default defineConfig({});
"#;

const REQUIRED_JSX: &str = "react-jsx";
const REQUIRED_JSX_IMPORT_SOURCE: &str = "pptsx";

struct Args {
    dir: PathBuf,
    force: bool,
    json: bool,
}

fn parse(argv: &[String]) -> Result<Args, String> {
    let mut dir = None;
    let mut force = false;
    let mut json = false;
    for a in argv {
        match a.as_str() {
            "--force" => force = true,
            "--json" => json = true,
            "--ds" => return Err("pptsx-rs init não tem --ds: use `pptsx init --ds` (o deck inicial de um design system vem do módulo dele, pelo Node)".into()),
            other if other.starts_with('-') => return Err(format!("opção desconhecida: {other}\nuso: pptsx-rs init [pasta] [--force] [--json]")),
            other if dir.is_none() => dir = Some(PathBuf::from(other)),
            _ => return Err("uso: pptsx-rs init [pasta] [--force] [--json]".into()),
        }
    }
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let dir = dir.map_or(cwd.clone(), |d| if d.is_absolute() { d } else { cwd.join(d) });
    Ok(Args { dir, force, json })
}

struct Plan {
    writes: Vec<(String, String)>,
    kept: Vec<String>,
    warnings: Vec<String>,
    updated: Vec<String>,
}

// ───────────── mesclas (scaffold.ts, tsconfig.ts) ─────────────

fn gitignore_content(existing: Option<&str>) -> String {
    let Some(existing) = existing else { return format!("{GITIGNORE_ENTRY}\n") };
    if existing.lines().any(|l| l.trim() == GITIGNORE_ENTRY || l.trim() == "dist") {
        return existing.to_string();
    }
    let separator = if existing.is_empty() || existing.ends_with('\n') { "" } else { "\n" };
    format!("{existing}{separator}{GITIGNORE_ENTRY}\n")
}

/// Nome de pacote npm válido a partir do nome da pasta (minúsculas, sem espaços nem símbolos).
fn package_name_of(dir_name: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in dir_name.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
            out.push(c);
            dash = false;
        } else if !dash {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_start_matches(['.', '_', '-']).trim_end_matches('-');
    if trimmed.is_empty() { "pptsx-deck".into() } else { trimmed.to_string() }
}

fn package_json_content(dir_name: &str) -> String {
    let mut o = Obj::new();
    o.insert(Rc::from("name"), str_val(&package_name_of(dir_name)));
    o.insert(Rc::from("private"), Value::Bool(true));
    o.insert(Rc::from("type"), str_val("module"));
    format!("{}\n", crate::mcp::pretty_json(&obj_val(o)))
}

enum Merge {
    Write { content: String, warning: Option<String> },
    Keep,
    Warn(String),
}

fn parse_object(raw: &str) -> Option<Obj> {
    match crate::js::parse_json(raw)? {
        Value::Object(o) => Some((*o).clone()),
        _ => None,
    }
}

/// Sem `type` ou com "commonjs" vira "module" (o deck é ESM), preservando o resto; um `type`
/// desconhecido só avisa.
fn merge_package_json(existing: Option<&str>, dir_name: &str) -> Merge {
    let Some(existing) = existing else { return Merge::Write { content: package_json_content(dir_name), warning: None } };
    let Some(mut pkg) = parse_object(existing) else {
        return Merge::Warn("package.json não é um JSON válido; mantido como está. Adicione \"type\": \"module\" à mão.".into());
    };
    let ty = pkg.get("type").cloned();
    match &ty {
        Some(Value::Str(s)) if &**s == "module" => return Merge::Keep,
        Some(Value::Str(s)) if &**s == "commonjs" => {}
        None | Some(Value::Undefined) => {}
        Some(other) => {
            let mut s = String::new();
            crate::js::value::to_json(other, &mut s);
            return Merge::Warn(format!("package.json tem \"type\": {s}; o deck precisa de \"type\": \"module\". Mantido como está: ajuste à mão."));
        }
    }
    let switched = matches!(&ty, Some(Value::Str(s)) if &**s == "commonjs");
    pkg.insert(Rc::from("type"), str_val("module"));
    let content = format!("{}\n", crate::mcp::pretty_json(&obj_val(pkg)));
    let warning = switched.then(|| "package.json: \"type\" trocado de \"commonjs\" para \"module\" (o deck é ESM). Se este pacote tem código CommonJS, deixe o deck numa pasta própria com o seu package.json.".to_string());
    Merge::Write { content, warning }
}

/// tsconfig é JSONC: tira comentários e vírgulas finais, ciente de strings.
fn strip_jsonc(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied();
        if c == '"' {
            let mut end = i + 1;
            while end < chars.len() && chars[end] != '"' {
                end += if chars[end] == '\\' { 2 } else { 1 };
            }
            out.extend(&chars[i..(end + 1).min(chars.len())]);
            i = end + 1;
        } else if c == '/' && next == Some('/') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
        } else if c == '/' && next == Some('*') {
            i += 2;
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i = (i + 2).min(chars.len());
        } else if c == ',' && chars[i + 1..].iter().find(|ch| !ch.is_whitespace()).is_some_and(|ch| matches!(ch, '}' | ']')) {
            i += 1;
        } else {
            out.push(c);
            i += 1;
        }
    }
    out
}

/// tsconfig existente: completa jsx/jsxImportSource ausentes; valores diferentes ficam e avisam.
fn merge_tsconfig(existing: &str) -> Merge {
    let hint = format!("O deck precisa de compilerOptions.jsx = \"{REQUIRED_JSX}\" e jsxImportSource = \"{REQUIRED_JSX_IMPORT_SOURCE}\".");
    let Some(mut tsconfig) = parse_object(&strip_jsonc(existing)) else {
        return Merge::Warn(format!("tsconfig.json não é um JSON válido; mantido como está. {hint}"));
    };
    let mut options = match tsconfig.get("compilerOptions") {
        Some(Value::Object(o)) => (**o).clone(),
        _ => Obj::new(),
    };
    let required: BTreeMap<&str, &str> = [("jsx", REQUIRED_JSX), ("jsxImportSource", REQUIRED_JSX_IMPORT_SOURCE)].into_iter().collect();
    let conflicts: Vec<String> = required
        .iter()
        .filter_map(|(k, v)| match options.get(*k) {
            None | Some(Value::Undefined) => None,
            Some(Value::Str(s)) if &**s == *v => None,
            Some(other) => {
                let mut s = String::new();
                crate::js::value::to_json(other, &mut s);
                Some(format!("{k} = {s}"))
            }
        })
        .collect();
    if !conflicts.is_empty() {
        return Merge::Warn(format!("tsconfig.json tem compilerOptions.{}; mantido como está. {hint}", conflicts.join(", ")));
    }
    let missing: Vec<(&str, &str)> = required.iter().filter(|(k, _)| matches!(options.get(**k), None | Some(Value::Undefined))).map(|(k, v)| (*k, *v)).collect();
    if missing.is_empty() {
        return Merge::Keep;
    }
    for (k, v) in &missing {
        options.insert(Rc::from(*k), str_val(v));
    }
    tsconfig.insert(Rc::from("compilerOptions"), obj_val(options));
    let added: Vec<String> = missing.iter().map(|(k, v)| format!("{k} = \"{v}\"")).collect();
    Merge::Write {
        content: format!("{}\n", crate::mcp::pretty_json(&obj_val(tsconfig))),
        warning: Some(format!("tsconfig.json: adicionado compilerOptions.{} (o deck compila o JSX contra o pptsx).", added.join(" e "))),
    }
}

// ───────────── plano e IO (init.ts) ─────────────

fn scaffold_files(dir_name: &str) -> Vec<(String, String)> {
    vec![
        (DECK_FILE.into(), DECK_TEMPLATE.into()),
        (TSCONFIG_FILE.into(), TSCONFIG_TEMPLATE.into()),
        ("pptsx.config.ts".into(), CONFIG_TEMPLATE.into()),
        ("assets/.gitkeep".into(), String::new()),
        (GITIGNORE_FILE.into(), gitignore_content(None)),
        (PACKAGE_FILE.into(), package_json_content(dir_name)),
    ]
}

/// .gitignore e package.json são sempre mesclados (--force não apaga o que o usuário tinha);
/// tsconfig.json existente só ganha as chaves de JSX que faltam (--force o substitui).
fn plan(dir: &Path, force: bool) -> Result<Plan, String> {
    let dir_name = dir.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "pptsx-deck".into());
    let files = scaffold_files(&dir_name);
    let existing: BTreeMap<String, String> = files.iter().filter_map(|(p, _)| std::fs::read_to_string(dir.join(p)).ok().map(|c| (p.clone(), c))).collect();
    if existing.contains_key(DECK_FILE) && !force {
        return Err(format!("{} já existe; use --force para sobrescrever (pptsx-rs init <pasta> --force)", dir.join(DECK_FILE).display()));
    }
    let mut out = Plan { writes: Vec::new(), kept: Vec::new(), warnings: Vec::new(), updated: Vec::new() };
    for (path, content) in files {
        let current = existing.get(&path).map(String::as_str);
        let merge = match path.as_str() {
            GITIGNORE_FILE => {
                let merged = gitignore_content(current);
                if current == Some(merged.as_str()) && !force { Merge::Keep } else { Merge::Write { content: merged, warning: None } }
            }
            PACKAGE_FILE => merge_package_json(current, &dir_name),
            _ if current.is_none() || force => Merge::Write { content, warning: None },
            TSCONFIG_FILE => merge_tsconfig(current.unwrap_or_default()),
            _ => Merge::Keep,
        };
        match merge {
            Merge::Write { content, warning } => {
                if existing.contains_key(&path) {
                    out.updated.push(path.clone());
                }
                out.writes.push((path, content));
                out.warnings.extend(warning);
            }
            Merge::Keep => out.kept.push(path),
            Merge::Warn(w) => {
                out.kept.push(path);
                out.warnings.push(w);
            }
        }
    }
    Ok(out)
}

fn summary(dir: &Path, p: &Plan) -> String {
    let cwd = std::env::current_dir().unwrap_or_default();
    let target = dir.strip_prefix(&cwd).map(|r| r.display().to_string()).unwrap_or_else(|_| dir.display().to_string());
    let mut lines = vec![format!("Projeto pptsx em {}:", dir.display())];
    lines.extend(p.writes.iter().map(|(path, _)| format!("  {} {path}", if p.updated.contains(path) { "atualizado" } else { "criado    " })));
    lines.extend(p.kept.iter().map(|path| format!("  mantido    {path}")));
    lines.extend(p.warnings.iter().map(|w| format!("\n▲ {w}")));
    lines.push(String::new());
    lines.push("Próximos passos:".into());
    if !target.is_empty() {
        lines.push(format!("  cd {target}"));
    }
    lines.push(format!("  {NEXT_COMMAND}"));
    lines.push(format!("  {NEXT_COMMAND} --watch"));
    lines.join("\n")
}

pub fn run(argv: &[String]) -> ExitCode {
    let args = match parse(argv) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            return ExitCode::from(2);
        }
    };
    let plan = match plan(&args.dir, args.force) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("\x1b[31merro\x1b[0m {e}");
            return ExitCode::from(1);
        }
    };
    for (path, content) in &plan.writes {
        let file = args.dir.join(path);
        if let Some(parent) = file.parent()
            && let Err(e) = std::fs::create_dir_all(parent) {
                eprintln!("\x1b[31merro\x1b[0m não foi possível criar {}: {e}", parent.display());
                return ExitCode::from(1);
            }
        if let Err(e) = std::fs::write(&file, content) {
            eprintln!("\x1b[31merro\x1b[0m não foi possível gravar {}: {e}", file.display());
            return ExitCode::from(1);
        }
    }
    if args.json {
        // No --json o stdout é só o JSON; os avisos vão para stderr para não se perder.
        for w in &plan.warnings {
            eprintln!("▲ {w}");
        }
        let files: Vec<Value> = plan.writes.iter().map(|(p, _)| str_val(&args.dir.join(p).display().to_string())).collect();
        let mut o = Obj::new();
        o.insert(Rc::from("files"), arr_val(files));
        println!("{}", crate::mcp::pretty_json(&obj_val(o)));
    } else {
        println!("{}", summary(&args.dir, &plan));
    }
    ExitCode::SUCCESS
}
