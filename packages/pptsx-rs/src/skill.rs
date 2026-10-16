//! `pptsx-rs skill [--out <pasta>] [--bin <binário> | --no-bin]`: a skill do pptsx para agentes (formato
//! Agent Skills: `SKILL.md`, `references/`), gerada do guia e do schema embutidos, com o próprio binário
//! em `bin/`. É o que a release empacota: descompactou em `.github/skills/` (Copilot) ou
//! `.claude/skills/` (Claude Code), o agente se vira. O `SKILL.md` é curto de propósito (economia de
//! tokens): o essencial fica em `references/essentials.md` e o guia inteiro, com índice de linhas, em
//! `references/guide.md`. Espelha `src/skill/skill.ts` do TS, trocando o script em Node pelo binário.

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use crate::js::value::{Value, to_json};

/// Nome da pasta e da skill: o mesmo da skill do TS (uma substitui a outra).
pub const NAME: &str = "pptsx";
const BIN: &str = "<pasta-desta-skill>/bin/pptsx-rs";

const MODEL_DECK: &str = r##"```tsx
import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={16} backgroundColor="#FFFFFF" color="#1F2933">
      <Text fontSize={32} fontWeight="bold">Resultados do trimestre</Text>
      <Box display="grid" gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }} gap={16} flex={1}>
        <Box backgroundColor="#EEF2FF" borderRadius={8} padding={16} gap={6}>
          <Text fontSize={14} color="#52606D">Receita</Text>
          <Text fontSize={28} fontWeight="bold">R$ 52,4 mi</Text>
        </Box>
      </Box>
      <Text fontSize={11} color="#52606D" marginTop="auto">Fonte: relatório trimestral</Text>
    </Slide>
  </Deck>
));
```"##;

fn skill_md(version: &str) -> String {
    format!(
        r#"---
name: {NAME}
description: Cria apresentações PowerPoint (.pptx) editáveis escrevendo os slides em TSX com layout automático (CSS como props, flexbox e grid), com PNG de cada slide para conferir. Use quando pedirem apresentação, slides, deck, pptx, PowerPoint, Keynote ou Google Slides.
---

# pptsx {version}: apresentações em TSX

Você descreve a **estrutura** dos slides num `.tsx`; o pptsx calcula o layout, mede o texto com a fonte real e grava um `.pptx` editável, os PNGs de cada slide e os diagnósticos. Não existem coordenadas x/y.

O motor é o binário desta skill, sem Node nem instalação: `{BIN}` (Windows: `bin\pptsx-rs.exe`). Se o servidor MCP `pptsx` estiver conectado, prefira as ferramentas dele (`diagnose`, `build`, `preview`, `lint`, `guide`, `schema`) ao shell; é o mesmo binário (`bin/pptsx-rs mcp`; os `mcp/*.json` prontos estão nesta pasta).

## Fluxo (meta: entregar em até 2 builds)

1. **Pasta do deck:** `{BIN} init <pasta>` cria `deck.tsx` de exemplo, `tsconfig.json` e `pptsx.config.ts`. Ou escreva só o `deck.tsx` como no modelo abaixo (a config só é precisa para fontes próprias, tema ou um design system).
2. **Escreva os slides** seguindo as regras abaixo. Antes do primeiro deck, leia `references/essentials.md` (≈ 350 linhas: primitivas, texto, paginação, diagnósticos e armadilhas). O resto está em `references/guide.md` (o índice no topo dá a linha de cada seção; §6 receitas) e `references/props.md` (todas as props, com o tipo).
3. **Itere com** `{BIN} check <pasta>/deck.tsx --json` (só diagnósticos, sem gravar) até zerar os `error`.
4. **Compile:** `{BIN} build <pasta>/deck.tsx --size 16x9,4x3` (`--size 16x9` se pedirem um formato só). Sai em `dist/`: `.pptx` por tamanho, `overview.png` (todos os slides numa grade, selo vermelho onde há error), `slide-NN.png` e `diagnostics.json`.
5. **Leia os diagnósticos:** cada um tem o slide, o caminho do nó (`Slide > Box[1] > Text` é o Text do 2º Box do slide), a mensagem com o conserto e, num estouro, `causedBy`. Abra o overview PNG para ver o layout.
6. **Entregue** o `.pptx` e conte o que sobrou de diagnóstico. Código de saída 1 = ainda há `error`.

## Modelo

{MODEL_DECK}

## Regras que evitam o segundo build

- `export default defineDeck((ctx) => <Deck>…</Deck>)`; os filhos do `Deck` são só `Slide`.
- **Todo texto dentro de `<Text>`** (string solta num Box é erro). Negrito e itálico no meio do texto: `<B>`, `<I>`, `<Span color=…>` dentro do Text.
- O layout é **CSS em camelCase** como props: `padding`, `gap`, `margin`, `width`, `height`, `flex`, `alignItems`, `justifyContent`, `backgroundColor`, `border`, `borderRadius`, `fontSize`, `fontWeight`, `color`, `textAlign`, `lineHeight`. Números são pt (o slide 16:9 tem 720 × 405 pt; o 4:3, 720 × 540).
- `Box` sem `display` é **coluna**; `display="flex"` é **linha**. Colunas iguais: `display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))"` (sempre `minmax(0, 1fr)`, nunca `1fr` solto) ou `flex={{1}}` em cada filho de uma linha.
- Ocupar a altura que sobra: `flex={{1}}`. Rodapé no fim: `marginTop="auto"` no último filho.
- Fonte e cor declaradas no `Slide` ou num `Box` **descem** para os `Text` de dentro: defina uma vez e escreva só o que muda.
- O 4:3 é mais **alto** que o 16:9 (mesma largura). Valor por formato: `{{ base: …, tall: … }}` (`tall` = 4:3; o 16:10 cai no `base`), nunca `if` sobre o formato.
- Lista ou tabela longa: `<Box paginate flex={{1}}>` (ou `Table paginate`) divide o conteúdo em vários slides. Texto que não cabe encolhe até um mínimo e, depois disso, vira `error` com o conserto.
- Gráfico nativo: `<Chart kind="bar" data={{{{ categories: [...], series: [{{ name, values: [...] }}] }}}} labels flex={{1}} />` (precisa de altura: `flex={{1}}` ou `height`). Tabela: `<Table columns={{[{{ header: "Área" }}, {{ header: "Q3", align: "right" }}]}} rows={{[["Varejo", "22,6"]]}} />` (números como texto mantêm a vírgula).
- Imagem: `<Image src="./logo.png" width={{120}} />`, com o caminho relativo ao deck.
- O que o PPTX não tem (gradiente, `overflow: hidden`…) vira o aviso `css-not-emitted`: troque por algo que exista. Não invente props; na dúvida, `references/props.md`.
- Design system instalado no projeto (`npm install @pptsx/ds-base`, por exemplo): importe os componentes dele, registre no `pptsx.config.ts` (`defineConfig({{ ds: [ds] }})`) e prefira-os às primitivas; `{BIN} lint deck.tsx` aplica as regras dele.

## Referências

- `references/essentials.md`: o essencial do guia; leia inteiro antes do primeiro deck.
- `references/guide.md`: o guia completo (primitivas, texto, receitas, diagnósticos, armadilhas), com índice de linhas.
- `references/props.md`: as props de cada primitiva, com o tipo.
- `mcp/vscode.mcp.json` e `mcp/claude.mcp.json`: a entrada do servidor MCP para copiar em `.vscode/mcp.json` ou `.mcp.json`.
"#
    )
}

const GUIDE_PREFACE: &str = "> **Na skill:** este é o guia do repositório do pptsx. Caminhos `packages/…` e o DS de exemplo `@pptsx/ds-base` (`ContentLayout`, `Bullets`, `tokens`) **não existem no seu projeto**, a menos que ele instale um DS: nas receitas, troque esses componentes por primitivas (`Slide`, `Box`, `Text`…). Os comandos `npx pptsx …` viram `<pasta-desta-skill>/bin/pptsx-rs …`; o servidor `pptsx-mcp` é `bin/pptsx-rs mcp`. `lint --fix` e `lint --from 0.x` não existem no binário.\n";

/// O guia com o aviso de contexto e um índice com a linha de cada seção: ele é longo demais para uma
/// leitura só, e o índice deixa ler só a seção que importa.
fn guide_reference(guide: &str) -> String {
    let lines: Vec<&str> = guide.split('\n').collect();
    let headings: Vec<(usize, &str)> = lines.iter().enumerate().filter(|(_, l)| l.starts_with("## ") || l.starts_with("### ")).map(|(i, l)| (i, *l)).collect();
    let header = |offset: usize| -> Vec<String> {
        let mut h = vec![GUIDE_PREFACE.to_string(), String::new(), "**Índice** (linha de cada seção neste arquivo; leia só a que precisar):".into(), String::new()];
        h.extend(headings.iter().map(|(i, l)| format!("- linha {}: {}", i + 1 + offset, l.trim_start_matches('#').trim_start())));
        h.push(String::new());
        h
    };
    let offset = header(0).len();
    let mut out = header(offset);
    out.extend(lines.iter().map(|l| (*l).to_string()));
    out.join("\n")
}

/// Seções do guia que entram no essencial: a `##` e quais `###` dela (None = todas; vazio = só a introdução).
const ESSENTIAL_SECTIONS: [(&str, Option<&[&str]>); 6] = [
    ("## 1.", None),
    ("## 2.", Some(&["### Breakpoints"])),
    ("## 3.", Some(&["### Por primitiva", "### Paginação", "### Regras de flex e grid"])),
    ("## 4.", Some(&["### Rich text", "### NBSP"])),
    ("## 8.", Some(&["### Como ler o `path`", "### Códigos", "### Checklist"])),
    ("## 9.", None),
];

/// O essencial: as seções acima, na ordem do guia. Um `###` entra se a sua `##` pede todas ou se bate
/// com um dos prefixos; a introdução da `##` (antes do 1º `###`) entra sempre.
fn essentials(guide: &str) -> String {
    let mut out = vec![
        "# pptsx: o essencial".to_string(),
        String::new(),
        "> Gerado do guia completo (`references/guide.md`): só o que um agente precisa antes do primeiro deck. Receitas (§6), gráficos, tabelas, diagramas, texto rico avançado, tema do arquivo e design systems ficam no guia; o índice no topo dele dá a linha de cada seção.".into(),
        String::new(),
        GUIDE_PREFACE.to_string(),
    ];
    let mut rule: Option<Option<&[&str]>> = None;
    let mut keep = false;
    for line in guide.split('\n') {
        if line.starts_with("## ") {
            rule = ESSENTIAL_SECTIONS.iter().find(|(prefix, _)| line.starts_with(prefix)).map(|(_, subs)| *subs);
            keep = rule.is_some();
        } else if line.starts_with("### ") {
            keep = match rule {
                None => false,
                Some(None) => true,
                Some(Some(subs)) => subs.iter().any(|s| line.starts_with(s)),
            };
        }
        if keep {
            out.push(line.to_string());
        }
    }
    let text = out.join("\n");
    // Sem três quebras seguidas (as seções puladas deixam linhas vazias).
    let mut compact = String::with_capacity(text.len());
    let mut blank = 0;
    for l in text.split('\n') {
        if l.trim().is_empty() {
            blank += 1;
            if blank > 1 {
                continue;
            }
        } else {
            blank = 0;
        }
        compact.push_str(l);
        compact.push('\n');
    }
    compact
}

const PRIMITIVE_TITLES: [(&str, &str); 14] = [
    ("deck", "Deck"),
    ("slide", "Slide"),
    ("box", "Box"),
    ("text", "Text"),
    ("span", "Span (B, I, Sup, Sub)"),
    ("image", "Image"),
    ("shape", "Shape"),
    ("chart", "Chart"),
    ("table", "Table"),
    ("path", "Path"),
    ("icon", "Icon"),
    ("connector", "Connector"),
    ("slideNumber", "SlideNumber"),
    ("container", "Container"),
];

const MAX_TYPE: usize = 140;

fn str_of(v: &Value, key: &str) -> Option<String> {
    match v {
        Value::Object(o) => match o.get(key) {
            Some(Value::Str(s)) => Some(s.to_string()),
            _ => None,
        },
        _ => None,
    }
}

/// O responsivo vale para toda prop e repete o tipo inteiro: a tabela mostra só o valor fixo.
fn short_type(ty: &str) -> String {
    let fixed = ty.find("| ResponsiveValue<").map_or(ty, |i| &ty[..i]);
    let fixed: String = fixed.split_whitespace().collect::<Vec<_>>().join(" ");
    if fixed.chars().count() <= MAX_TYPE { fixed } else { format!("{}…", fixed.chars().take(MAX_TYPE - 1).collect::<String>()) }
}

fn cell(text: &str) -> String {
    text.replace('|', "\\|").split('\n').filter(|l| !l.is_empty()).collect::<Vec<_>>().join(" ")
}

/// A 1ª frase basta na tabela; o guia tem o resto.
fn first_sentence(text: &str) -> String {
    let t = text.trim();
    let mut end = None;
    for (i, c) in t.char_indices() {
        if matches!(c, '.' | '!' | '?') {
            let next = t[i + c.len_utf8()..].chars().next();
            if next.is_none_or(char::is_whitespace) {
                end = Some(i + c.len_utf8());
                break;
            }
        }
    }
    end.map_or(t.to_string(), |e| t[..e].trim().to_string())
}

fn props_section(title: &str, schema: &Value) -> String {
    let Value::Object(o) = schema else { return String::new() };
    let required: Vec<String> = match o.get("required") {
        Some(Value::Array(a)) => a.borrow().iter().map(Value::to_js_string).collect(),
        _ => Vec::new(),
    };
    let mut props: Vec<(String, Value)> = match o.get("properties") {
        Some(Value::Object(p)) => p.iter().map(|(k, v)| (k.to_string(), v.clone())).collect(),
        _ => Vec::new(),
    };
    props.sort_by(|a, b| a.0.cmp(&b.0));
    let mut out = format!("## {title}\n\n| prop | tipo | nota |\n|---|---|---|\n");
    for (name, prop) in props {
        let examples = match &prop {
            Value::Object(p) => match p.get("examples") {
                Some(Value::Array(a)) if !a.borrow().is_empty() => {
                    let items: Vec<String> = a
                        .borrow()
                        .iter()
                        .map(|v| {
                            let mut s = String::new();
                            to_json(v, &mut s);
                            format!("`{s}`")
                        })
                        .collect();
                    format!(" Ex.: {}.", items.join(", "))
                }
                _ => String::new(),
            },
            _ => String::new(),
        };
        let note = format!("{}{examples}", str_of(&prop, "description").map(|d| first_sentence(&d)).unwrap_or_default()).trim().to_string();
        let star = if required.contains(&name) { " *" } else { "" };
        out.push_str(&format!("| `{name}`{star} | `{}` | {} |\n", cell(&short_type(&str_of(&prop, "type").unwrap_or_else(|| "unknown".into()))), cell(&note)));
    }
    out.push('\n');
    out
}

/// `references/props.md`, gerado do schema embutido (o mesmo do `schema()` do MCP), nunca à mão.
fn props_md(schema: &Value) -> String {
    let mut out = String::from("# Props das primitivas do pptsx\n\nGerado do schema do pptsx (o mesmo do `schema()` no MCP). `*` = obrigatória. Toda prop aceita também um valor por breakpoint, `{ base, tall, wide }` (guia §2).\n\n");
    if let Value::Object(o) = schema {
        for (key, value) in o.iter() {
            let title = PRIMITIVE_TITLES.iter().find(|(k, _)| *k == &**key).map_or(key.to_string(), |(_, t)| (*t).to_string());
            out.push_str(&props_section(&title, value));
        }
    }
    out
}

fn mcp_json(bin: &str, vscode: bool) -> String {
    if vscode {
        format!("{{\n  \"servers\": {{\n    \"{NAME}\": {{\n      \"type\": \"stdio\",\n      \"command\": \"${{workspaceFolder}}/{bin}\",\n      \"args\": [\"mcp\"]\n    }}\n  }}\n}}\n")
    } else {
        format!("{{\n  \"mcpServers\": {{\n    \"{NAME}\": {{\n      \"command\": \"{bin}\",\n      \"args\": [\"mcp\"]\n    }}\n  }}\n}}\n")
    }
}

fn readme(version: &str) -> String {
    format!(
        r#"# Skill pptsx {version} (pptsx-rs)

A skill do pptsx para agentes, com o motor dentro (`bin/pptsx-rs`): nada de Node, nada para instalar.

1. Mova esta pasta inteira para a pasta de skills do repositório em que o agente vai trabalhar:
   - **GitHub Copilot no VS Code (agent mode):** `.github/skills/pptsx/`
   - **Claude Code:** `.claude/skills/pptsx/` (ou `~/.claude/skills/pptsx/` para todos os projetos)
2. Para o agente usar as ferramentas MCP em vez do shell, copie `mcp/vscode.mcp.json` para `.vscode/mcp.json` ou `mcp/claude.mcp.json` para `.mcp.json` na raiz do repositório (o caminho já aponta para o `bin/` desta pasta).
3. Peça o deck. O agente lê o `SKILL.md`, escreve o `.tsx`, compila e corrige pelos diagnósticos.

No macOS, se o sistema bloquear o binário baixado: `xattr -d com.apple.quarantine bin/pptsx-rs`. Para o editor conferir os tipos do deck, `npm install pptsx` na pasta do deck (só tipos; o build não usa o Node).
"#
    )
}

struct Args {
    out: PathBuf,
    bin: Option<PathBuf>,
    no_bin: bool,
}

fn parse(argv: &[String]) -> Result<Args, String> {
    let mut out = None;
    let mut bin = None;
    let mut no_bin = false;
    let mut it = argv.iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--out" => out = Some(PathBuf::from(it.next().ok_or("--out precisa de uma pasta")?)),
            "--bin" => bin = Some(PathBuf::from(it.next().ok_or("--bin precisa de um arquivo")?)),
            "--no-bin" => no_bin = true,
            other => return Err(format!("opção desconhecida: {other}\nuso: pptsx-rs skill [--out <pasta>] [--bin <binário> | --no-bin]")),
        }
    }
    Ok(Args { out: out.unwrap_or_else(|| PathBuf::from(NAME)), bin, no_bin })
}

fn write(root: &Path, rel: &str, content: &str) -> Result<(), String> {
    let path = root.join(rel);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    std::fs::write(&path, content).map_err(|e| format!("{}: {e}", path.display()))
}

fn copy_bin(root: &Path, source: &Path) -> Result<String, String> {
    let name = if source.extension().is_some_and(|e| e == "exe") { "pptsx-rs.exe" } else { "pptsx-rs" };
    let target = root.join("bin").join(name);
    std::fs::create_dir_all(root.join("bin")).map_err(|e| e.to_string())?;
    std::fs::copy(source, &target).map_err(|e| format!("{} → {}: {e}", source.display(), target.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o755));
    }
    Ok(format!("bin/{name}"))
}

pub fn run(argv: &[String]) -> ExitCode {
    let args = match parse(argv) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            return ExitCode::from(2);
        }
    };
    let version = env!("CARGO_PKG_VERSION");
    let Some(schema) = crate::mcp::core_schema() else {
        eprintln!("\x1b[31merro\x1b[0m o schema embutido não pôde ser lido");
        return ExitCode::from(1);
    };
    let bin_vscode = format!(".github/skills/{NAME}/bin/pptsx-rs");
    let bin_claude = format!(".claude/skills/{NAME}/bin/pptsx-rs");
    let files = [
        ("SKILL.md", skill_md(version)),
        ("references/essentials.md", essentials(crate::mcp::GUIDE)),
        ("references/guide.md", guide_reference(crate::mcp::GUIDE)),
        ("references/props.md", props_md(&schema)),
        ("mcp/vscode.mcp.json", mcp_json(&bin_vscode, true)),
        ("mcp/claude.mcp.json", mcp_json(&bin_claude, false)),
        ("README.md", readme(version)),
    ];
    let mut written: Vec<String> = Vec::new();
    for (rel, content) in &files {
        if let Err(e) = write(&args.out, rel, content) {
            eprintln!("\x1b[31merro\x1b[0m {e}");
            return ExitCode::from(1);
        }
        written.push((*rel).to_string());
    }
    if !args.no_bin {
        let source = match &args.bin {
            Some(b) => b.clone(),
            None => match std::env::current_exe() {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("\x1b[31merro\x1b[0m não achei o próprio binário: {e} (use --bin ou --no-bin)");
                    return ExitCode::from(1);
                }
            },
        };
        match copy_bin(&args.out, &source) {
            Ok(rel) => written.push(rel),
            Err(e) => {
                eprintln!("\x1b[31merro\x1b[0m {e}");
                return ExitCode::from(1);
            }
        }
    }
    println!("Skill {NAME} {version} em {}:", args.out.display());
    for w in written {
        println!("  {w}");
    }
    println!("\nMova a pasta para .github/skills/ (Copilot) ou .claude/skills/ (Claude Code); mcp/ tem a entrada do servidor MCP.");
    ExitCode::SUCCESS
}
