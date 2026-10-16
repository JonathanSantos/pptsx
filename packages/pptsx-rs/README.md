<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../pptsx/docs/readme/brand/logo-dark.svg">
    <img src="../pptsx/docs/readme/brand/logo-light.svg" height="64" alt="pptsx">
  </picture>
</p>

<h1 align="center">pptsx-rs</h1>

<p align="center">
  <b>O núcleo do pptsx num binário só.</b> TSX entra, PPTX editável sai. Sem Node, sem <code>node_modules</code>, sem motor JS embutido.
</p>

<p align="center">
  <img alt="pptsx-rs 1.0.3" src="https://img.shields.io/badge/pptsx--rs-1.0.3-4F5BFF?style=flat-square&labelColor=0B1020">
  <img alt="mesma versão do pptsx" src="https://img.shields.io/badge/paridade-80%2F80%20decks-14B87F?style=flat-square&labelColor=0B1020">
  <img alt="binário de 6 MB" src="https://img.shields.io/badge/bin%C3%A1rio-6%20MB-C246D8?style=flat-square&labelColor=0B1020">
  <img alt="macOS, Linux e Windows" src="https://img.shields.io/badge/macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-5%20alvos-FF6A3D?style=flat-square&labelColor=0B1020">
  <img alt="Rust 2024" src="https://img.shields.io/badge/Rust-2024-8A93B8?style=flat-square&labelColor=0B1020&logo=rust&logoColor=white">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-8A93B8?style=flat-square&labelColor=0B1020">
</p>

<p align="center">
  <a href="#instalar"><b>Instalar</b></a> ·
  <a href="#em-30-segundos"><b>Começar</b></a> ·
  <a href="#com-ia-no-projeto"><b>Com IA</b></a> ·
  <a href="#design-systems"><b>Design systems</b></a> ·
  <a href="#a-cli"><b>CLI</b></a> ·
  <a href="#paridade-com-o-pptsx-em-ts"><b>Paridade</b></a> ·
  <a href="#como-funciona"><b>Por dentro</b></a> ·
  <a href="#o-que-falta"><b>O que falta</b></a>
</p>

<br>

O [pptsx](../pptsx/README.md) em TypeScript é a referência. Este pacote reproduz a saída dele, com a mesma versão: o mesmo XML, os mesmos diagnósticos e os mesmos achados de lint, comparados a cada commit em `cargo test` contra fixtures geradas pelo TS. O que muda é o custo de ter o pptsx num projeto: um arquivo executável, que sobe em milissegundos e serve o MCP para o agente sem nada instalado.

<table>
<tr>
<td width="33%" valign="top">
<img src="../pptsx/docs/readme/brand/icon-native.svg" width="44" alt=""><br>
<b>Um arquivo, zero runtime</b><br>
<sub>Baixe o binário do seu sistema e rode. O deck <code>.tsx</code> é interpretado por um avaliador próprio; o Node só é necessário para o <code>tsc</code> do editor e para instalar um design system.</sub>
</td>
<td width="33%" valign="top">
<img src="../pptsx/docs/readme/brand/icon-diagnostics.svg" width="44" alt=""><br>
<b>A mesma saída do pptsx</b><br>
<sub>Port do Yoga 3.2.1 e do motor de grid, mesmo emissor OOXML, mesmos diagnósticos com <code>path</code> e causa. 80 decks de exemplo saem idênticos; <code>cargo test</code> garante que continuem.</sub>
</td>
<td width="33%" valign="top">
<img src="../pptsx/docs/readme/brand/icon-agents.svg" width="44" alt=""><br>
<b>Feito para agentes</b><br>
<sub>Servidor MCP com <code>build</code>, <code>diagnose</code>, <code>preview</code>, <code>lint</code>, <code>guide</code> e <code>schema</code>. O <code>mcp.json</code> do Copilot ou do Claude Code aponta direto para o executável.</sub>
</td>
</tr>
</table>

## Instalar

Cada [release](https://github.com/JonathanSantos/pptsx/releases/latest) traz um pacote por plataforma e o `SHA256SUMS` (o mesmo arquivo que lista o `pptsx.mjs`). O pacote **é a skill**: uma pasta `pptsx/` com o `SKILL.md`, as referências para o agente, os `mcp.json` prontos e o binário em `bin/`. Descompactou, moveu para a pasta de skills, acabou.

| Sistema | Arquivo |
|---|---|
| macOS Apple Silicon | `pptsx-rs-aarch64-apple-darwin.tar.gz` |
| macOS Intel | `pptsx-rs-x86_64-apple-darwin.tar.gz` |
| Linux x86_64 | `pptsx-rs-x86_64-unknown-linux-gnu.tar.gz` |
| Linux arm64 | `pptsx-rs-aarch64-unknown-linux-gnu.tar.gz` |
| Windows x86_64 | `pptsx-rs-x86_64-pc-windows-msvc.zip` |

macOS e Linux, na raiz do repositório em que o agente vai trabalhar:

```bash
alvo=aarch64-apple-darwin   # ou x86_64-apple-darwin, x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu
base=https://github.com/JonathanSantos/pptsx/releases/latest/download
curl -LO "$base/pptsx-rs-$alvo.tar.gz" && curl -LO "$base/SHA256SUMS"
shasum -a 256 -c SHA256SUMS --ignore-missing          # confere o pacote baixado
mkdir -p .github/skills && tar -xzf "pptsx-rs-$alvo.tar.gz" -C .github/skills    # Copilot; Claude Code: .claude/skills
cp .github/skills/pptsx/mcp/vscode.mcp.json .vscode/mcp.json                     # Claude Code: mcp/claude.mcp.json → .mcp.json
.github/skills/pptsx/bin/pptsx-rs --version
```

Pronto: o agente lê `.github/skills/pptsx/SKILL.md`, sabe onde está o binário e como iniciar, construir e corrigir um deck. No Windows, extraia o `.zip` em `.github\skills\` e o binário é `bin\pptsx-rs.exe`. No macOS, um pacote baixado pelo navegador pode chegar com a quarentena do Gatekeeper; `xattr -d com.apple.quarantine .github/skills/pptsx/bin/pptsx-rs` libera.

A pasta da skill também sai do próprio binário, para quem compilou do código: `pptsx-rs skill --out pptsx` (gera `SKILL.md`, `references/`, `mcp/` e copia o binário para `bin/`).

Para compilar do código (Rust estável, 1.85+):

```bash
cargo build --release          # na raiz do monorepo (workspace) ou em packages/pptsx-rs
./target/release/pptsx-rs --version
```

## Em 30 segundos

```bash
bin=.github/skills/pptsx/bin/pptsx-rs
$bin init meu-deck                                 # deck.tsx, tsconfig.json, pptsx.config.ts, assets/ e os tipos do pptsx
$bin init meu-deck --ds @pptsx/ds-base             # o mesmo, com o deck já usando um design system
$bin build meu-deck/deck.tsx --size 16x9,4x3       # .pptx + PNG por slide + overview + diagnósticos
```

```text
dist/
├── deck.16x9.pptx              editável no PowerPoint e no Keynote
├── deck.16x9.overview.png      todos os slides numa grade, com selo vermelho onde há error
├── deck.16x9/slide-01.png      um PNG por slide, desenhado com o mesmo layout do arquivo
├── deck.4x3.pptx …             o mesmo deck no outro formato, sem mudar código
└── deck.diagnostics.json       código, severidade, slide, path do nó, mensagem e dados
```

O `init` grava os `.d.ts` do pptsx em `.pptsx/types/` como um pacote de tipos e põe `typeRoots` no `tsconfig.json`: o VS Code confere tipos e autocompleta as props **sem `npm install`** (o build nunca usou o Node). Se um dia o `pptsx` for instalado em `node_modules`, ele vence a cópia. Num projeto que já existe, `pptsx-rs types <pasta>` faz só isso. O build sai com código 1 quando há diagnóstico `error`, como o `pptsx build`.

Quando um nó estoura dentro de um componente, o diagnóstico diz **qual componente do autor e com que props** (`no componente <Risks items=[4 itens] status="warn" />`, e `data.component` no JSON): é ali que se mexe, não no path interno do DS. Um `console.warn` do deck ou do DS (um ícone com nome desconhecido, por exemplo) vira o diagnóstico `module-warning`, em vez de sumir.

## Com IA no projeto

O jeito principal de um agente usar o pptsx-rs é pelo **servidor MCP**: o agente lê o guia, escreve o deck, constrói, lê os diagnósticos e vê o PNG, tudo por ferramentas, sem shell. O binário é o servidor: nada de `npx`, nada de runtime.

### Ferramentas

| ferramenta | o que devolve | quando o agente usa |
|---|---|---|
| `guide` | o índice do guia de primitivas e receitas, ou uma seção (`"§6"`, `"grid"`); com um DS registrado, o guia do DS | antes de escrever o primeiro slide |
| `schema` | as props de cada primitiva (ou componente do DS) em JSON Schema, com o tipo TS | quando não sabe o nome ou o tipo de uma prop |
| `diagnose` | só os diagnósticos, sem gravar arquivo: o caminho rápido para iterar | a cada mudança no deck |
| `build` | grava `.pptx` e PNGs e devolve os diagnósticos e o **overview em PNG** de cada tamanho | quando o deck está sem `error` |
| `preview` | o PNG de um slide num tamanho | para conferir um slide que o diagnóstico apontou |
| `lint` | regras da engine e as do design system da config | antes de entregar |

`build`, `diagnose` e `lint` marcam `isError` quando o deck tem `error` (ou `warning`, no lint): a ferramenta funcionou, o deck é que precisa de correção. Cada diagnóstico diz o slide, o caminho do nó (`Slide > Box[1] > Text` é o `Text` do segundo `Box` do slide), o que aconteceu e o que fazer, e, num estouro, qual nó causou (`causedBy`).

### GitHub Copilot no VS Code

A skill em `.github/skills/pptsx/` já ensina o fluxo e as armadilhas ao agent mode. Para ele usar as ferramentas em vez do shell, `.vscode/mcp.json` na raiz do repositório (é o arquivo `mcp/vscode.mcp.json` da skill):

```json
{
  "servers": {
    "pptsx": {
      "type": "stdio",
      "command": "${workspaceFolder}/.github/skills/pptsx/bin/pptsx-rs",
      "args": ["mcp"]
    }
  }
}
```

Depois, no chat em agent mode: *"Crie um deck de 5 slides sobre o resultado do trimestre em `decks/q3.tsx` e gere o PPTX em 16:9 e 4:3"*. O agente lê o `SKILL.md`, chama `guide` se precisar, escreve o arquivo, chama `build`, lê os diagnósticos e corrige até sair limpo.

### Claude Code

A mesma pasta vai em `.claude/skills/pptsx/`; `.mcp.json` na raiz do repositório é o `mcp/claude.mcp.json` da skill:

```json
{
  "mcpServers": {
    "pptsx": {
      "command": ".claude/skills/pptsx/bin/pptsx-rs",
      "args": ["mcp"]
    }
  }
}
```

No Claude Desktop, a entrada é a mesma em `claude_desktop_config.json`, com o caminho absoluto do binário.

### Sem MCP: o agente na linha de comando

Um agente que só tem shell usa os mesmos comandos de uma pessoa, com `--json` para ler a saída por máquina:

```bash
$bin check deck.tsx --json          # diagnósticos em JSON, sem gravar nada
$bin build deck.tsx --size 16x9     # .pptx, PNGs e dist/deck.diagnostics.json
$bin lint deck.tsx --json           # regras da engine e do DS
```

O ciclo que funciona: `check --json` até zerar os `error`, `build`, abrir o `overview.png` e conferir. Em CI, `build` com código de saída 1 em `error` basta como gate.

### O que o agente recebe de volta

```json
{
  "size": "16x9",
  "slide": 2,
  "severity": "error",
  "code": "text-overflow",
  "path": "Slide > Box > Text",
  "message": "A área disponível para o texto é 0 pt: o contêiner não deu altura a ele (flexGrow={1} em coluna com altura pelo conteúdo…). Remova flexGrow do Text ou dê altura ao contêiner.",
  "data": { "overflowPt": 18.4, "causedBy": "Slide > Box" }
}
```

Mensagens em português, escritas para serem lidas por um modelo: dizem o que mudar. Irmãos com o mesmo problema viram um só item (`Box[0..3]`), com a lista em `data.paths`.

## Design systems

Um deck que usa um DS funciona igual: `import { KpiRow } from '@pptsx/ds-base'` resolve pelo `node_modules`, e o código do DS roda no avaliador (os `defineTokens`, `createVariants`, `slot` e `createDs` do `@pptsx/ds-kit` estão dentro do subconjunto). O `pptsx.config.ts` registra o DS:

```ts
import { defineConfig } from 'pptsx';
import { ds } from '@pptsx/ds-base';

export default defineConfig({ ds: [ds] });   // tema no arquivo, regras no lint, guia e schema no MCP
```

Com isso o `lint` aplica as regras de marca do DS, o `guide` do MCP ganha a fonte `ds-base` e o `schema` responde as props dos componentes dele. O servidor também aceita `pptsx-rs mcp --ds caminho/ds.ts` para um DS fora da config. Instalar o pacote do DS continua sendo `npm install`, porque ele é um pacote npm.

`pptsx-rs init <pasta> --ds @pptsx/ds-base` (ou um caminho, `--ds ../ds-orbit/src/index.ts`) cria o deck com um slide por componente do DS, a config que o registra e o tsconfig; `pptsx-rs skill --ds …` gera a skill com `references/ds.md` (componentes, exemplos, props, regras e o guia do DS) e `references/pptsx.config.ts`, para o agente usar a marca sem procurar. Achados `off-theme-color` de nível info dentro de componentes do DS são do DS, não do deck: o `lint` os resume numa linha (o `--json` lista todos).

**Criar** um DS continua no `@pptsx/ds-kit`, com Node: `pptsx-ds init` (scaffold), `pptsx-ds catalog` (o catálogo visual e o contrato de fixtures) e `pptsx-ds skill`. O binário é para quem **usa** um DS pronto.

## A CLI

```text
pptsx-rs build <deck.tsx> [--size 16x9,4x3] [--out dist/] [--lang pt-BR] [--line-breaks forced|auto]
               [--preview native|none] [--preview-width 1280] [--embed-fonts] [--watch] [--serve [--port 4173]]
pptsx-rs check <deck.tsx> [--size 16x9] [--debug] [--json]      diagnósticos (e frames em pt, com --debug)
pptsx-rs lint  <deck.tsx> [--size 16x9,4x3] [--json]            regras da engine e dos DS da config
pptsx-rs init  [pasta] [--ds <pacote|caminho>] [--force] [--json]
                                                                deck.tsx, tsconfig.json (+ typeRoots dos tipos), pptsx.config.ts,
                                                                assets/ e .pptsx/types; com --ds, o deck já usa o DS
pptsx-rs types [pasta]                                          (re)grava os tipos do pptsx e o typeRoots do tsconfig
pptsx-rs skill [--out pptsx] [--ds <pacote|caminho>] [--bin <binário> | --no-bin]
                                                                a pasta da skill (SKILL.md, references/, mcp/, bin/);
                                                                com --ds, references/ds.md e pptsx.config.ts do DS
pptsx-rs tree  <deck.tsx> [--size 16x9]                         a árvore avaliada
pptsx-rs mcp   [--ds <ds.ts>]...                                servidor MCP por stdio
```

| flag | o que faz |
|---|---|
| `--size` | `16x9`, `16x10`, `4x3`, `wide` ou `<L>x<A>in`; sem ela vale o `sizes` da config, senão `16x9` |
| `--line-breaks auto` | grava os parágrafos do autor e deixa o PowerPoint quebrar; o padrão `forced` grava uma quebra por linha calculada |
| `--preview none` | não rasteriza PNGs; `--preview-width` muda a largura (padrão 1280 px) |
| `--embed-fonts` | embute no arquivo as fontes do autor que o deck usa (EOT, como o PowerPoint exige); também `embedFonts: true` na config |
| `--watch` | refaz o build quando o deck, a config ou um módulo importado muda; cada build num processo filho, memória de volta a zero |
| `--serve` | o preview ao vivo do pptsx no navegador (slides em SVG, diagnósticos, clique destaca o nó, atualização por SSE); implica `--watch` |
| `--json` | em `check` e `lint`, só o JSON no stdout |

Os `.pptx` abrem e exportam no Keynote (`scripts/keynote-export.sh` do repositório): tabelas com mesclagem e ícones, gráficos de todos os tipos, `Path`, ícones, sombra, rotação, paginação, imagem de fundo, layouts com placeholders e conteúdo fixo. A validação no PowerPoint fica com o dono do projeto.

## Paridade com o pptsx em TS

Os **80 decks de exemplo do repositório** (`packages/*/examples`, incluindo os que usam `@pptsx/ds-base` e um DS grande com composição por `<Container>`) gerados nas duas engines e comparados caixa a caixa (texto com as quebras de linha e frame com tolerância de 1 pt):

| métrica | resultado |
|---|---|
| decks que geram nas duas engines | 80/80, com o mesmo número de slides em todos |
| caixas de texto idênticas | **8617/8617 (100%)** |
| decks 100% idênticos | **80/80** |
| geometrias livres (`custGeom`: Path, ícones, conectores) idênticas | **3496/3496** |
| diagnósticos do TS que o Rust dá no mesmo nó (código, slide, path) | **1704/1704**, sem nenhum a mais |
| … com a mensagem idêntica | 1702/1704 |
| achados do lint idênticos | **2074/2074** |
| fontes embutidas (`.fntdata` em EOT) | byte a byte iguais |

As duas mensagens que diferem dizem a causa de um estouro ("X pede 0 pt a mais"): o TS soma a altura do texto em f64 e o Yoga devolve f32, e essa diferença de 10⁻⁶ pt basta para ele apontar uma causa que o Rust não aponta.

<details>
<summary><b>Desempenho</b> (Mac arm64; Node 24 rodando o pptsx do repositório; Rust em release; processo inteiro)</summary>
<br>

| deck | Node | Rust | ganho | memória Node | memória Rust |
|---|---:|---:|---:|---:|---:|
| `hello` | 367 ms | 6,4 ms | 58× | 167 MB | 6,7 MB |
| `layout-test` | 381 ms | 8,9 ms | 43× | 169 MB | 7,2 MB |
| `calibration` | 448 ms | 19,4 ms | 23× | 175 MB | 8,7 MB |
| `ds-base/demo` | 681 ms | 14 ms | 48× | 229 MB | 10,7 MB |
| `ds-base/showcase` | 667 ms | 32,4 ms | 21× | 228 MB | 9,6 MB |
| `ds-orbit/compose` (9 slides, `Container`) | 870 ms | 73 ms | 12× | — | — |
| `ds-orbit/matrix-lists-a` (28 slides, 66 `Container`) | 1450 ms | 190 ms | 8× | — | — |

O Node aqui transpila o próprio código-fonte do pptsx a cada execução (`tsx`); a versão publicada (`dist/`) começa mais rápido, então o ganho real fica um pouco abaixo. Nos decks com `Container` o ganho é menor: o DS é grande (o avaliador leva ~40 ms só para carregá-lo) e cada `Container` roda a função dele depois da medida (uma vez por medida; o cache evita rodar os de fora de novo quando os de dentro são medidos). Com o preview PNG ligado, o `ds-base/demo` (6 slides) sai em ~80 ms.

Binário: **5,9 MB**: 1,6 MB são as quatro Liberation Sans embutidas, e o resto inclui o `regex` com tabelas Unicode, o `resvg` (ícones complexos viram PNG, como no TS) e o guia e o schema do pptsx (para o MCP).
</details>

<details>
<summary><b>Como a paridade é testada</b> (fixtures douradas)</summary>
<br>

`scripts/golden.sh` gera com o pptsx em TS a saída de referência dos decks de exemplo (`hello`, `layout-test`, `overflow`, `demo`, `charts`, `showcase`, `long-list`, em 16x9 e 4x3) e grava em `fixtures/`: o `diagnostics.json` e os `slideN.xml`/`chartN.xml` crus de cada `.pptx`. `cargo test` roda o binário nesses decks e compara, em `tests/golden.rs`, forma a forma: frames, caminhos e `srcRect` com tolerância de 2 EMU, texto com as quebras, corpo, peso e cor de cada trecho, preenchimento e contorno, células de tabela com bordas, e os gráficos (valores, título, estilo de texto, linhas dos eixos). Os diagnósticos comparam código, severidade, tamanho, slide, path e mensagem. O CI regenera as fixtures com o TS do commit e falha se diferirem: uma mudança no núcleo que o Rust não acompanhou aparece ali. O port do Yoga é fiel até no float: numa row com `nowrap` que não cabe, o resíduo em f32 do total de shrink pode sair positivo e as larguras explodem; o yoga-layout real faz o mesmo com os mesmos números (teste `shrink_residual_matches_yoga`), e o fit do pptsx contorna isso partindo do piso das palavras, que o Rust também segue.
</details>

## Como funciona

```text
deck.tsx ─oxc_parser─► AST ─avaliador do subconjunto─► árvore de elementos
         ─validação (props, CSS sem de/para)─► resolve (CSS, herança, responsivo)
         ─Container: layout mede o espaço, a função roda, resolve de novo (M19)
         ─paginate ─► layout (port do Yoga; grid próprio) + fit (shrink por escopo)─► frames
         ─diagnósticos (estouro, causa, agrupamento)
         ─emissor OOXML─► slides, tabelas, gráficos, notas, fontes ─zip─► .pptx
```

<details>
<summary><b>Os módulos</b> e o arquivo do TS que cada um porta</summary>
<br>

| etapa | arquivo | o quê |
|---|---|---|
| frontend | `src/js/` | `oxc` faz só o parse; um avaliador de AST executa o subconjunto (abaixo). `pptsx` é módulo nativo |
| config | `src/config.rs` | `pptsx.config.ts` (fontes, sizes, lang, theme, document, embedFonts), avaliado pelo mesmo avaliador |
| validação | `src/validate.rs` | as tabelas de handlers do `resolve/` do pptsx: prop da 0.x e valor inválido derrubam o build com a mesma mensagem; o resto vira `css-not-emitted` |
| resolve | `src/model/` (`mod`, `style`, `shape`, `resolve`, `data`, `connector`), `src/css.rs` | props → estilo + pintura; responsivo; herança de texto; paths dos nós como o pptsx (`Slide > Box[1] > Text`); footer do Deck; ids de conector com escopo de componente |
| Container | `src/containers.rs` | `containers.ts`: passadas de resolve + layout sem fit até nada pendente (no máximo 3 níveis); resultado de cada função em cache por (slide, path, medida) |
| texto | `src/text.rs` | porta de `src/text/*`: quebra gulosa, `textSafety` 0,97, hhea, shaping com kerning (rustybuzz), pesos numéricos, corpo por trecho |
| layout | `src/yoga.rs`, `src/yoga_layout.rs`, `src/grid.rs`, `src/layout.rs` | port do Yoga 3.2.1 com a configuração do pptsx; árvore montada como `layout/tree.ts`; grid: porta do `grid.ts` (placement §8.5 e track sizing §11 do CSS Grid, com as contribuições min/max-content do `intrinsic.ts`) e cada item numa árvore Yoga do tamanho da área, como `grid-layout.ts`; fit de `fit/search.ts`; paginate; conectores; ordem de pintura CSS |
| diagnósticos | `src/report.rs`, `src/diag.rs` | `fit/detect.ts`, `diagnostics.ts`, `policies.ts`, `table.ts`, `cause.ts` e `group.ts`: mesmos códigos, paths, mensagens e dados |
| vetor | `src/vector.rs` | `d` do SVG → M/L/C/Q/Z (arcos viram cúbicas); ícones SVG → custGeom, ou PNG pelo resvg |
| objetos | `src/objects.rs` | tabela (merges, rich text, ícones, colunas pelo conteúdo) e gráficos (planilha embutida) |
| emissão | `src/emit.rs`, `src/package.rs` | XML direto, sem pptxgenjs; tema, seções, notas, hyperlinks, layouts |
| embed | `src/embed.rs` | `fonts/eot.ts` e `emit/embed.ts`: faces do autor usadas no deck viram `ppt/fonts/fontN.fntdata` em EOT, `<p:embeddedFontLst>` e `embedTrueTypeFonts`; `font-not-embeddable` para .otf/.ttc e fsType restrito |
| preview | `src/preview.rs` | SVG por slide (texto em contorno, gráficos, imagens) → PNG pelo `resvg` |
| preview ao vivo | `src/serve.rs` | `--serve`: HTTP + SSE em `std::net`, a página do TS em `assets/preview.html`, estado gravado pelo build filho |
| init | `src/init.rs` | `cli/init.ts` e `scaffold.ts`: arquivos do projeto novo, mesclas de tsconfig/package/.gitignore |
| lint | `src/lint.rs` | regras da engine e as dos DS (funções JS da config, chamadas pelo avaliador) |
| MCP | `src/mcp.rs` | JSON-RPC por stdio; guia e schema do pptsx embutidos no binário (`build.rs` copia do núcleo) |
</details>

<details>
<summary><b>O subconjunto de TS/JSX</b> que o avaliador executa</summary>
<br>

Avaliado sem motor JS: `const`/`let`, funções e arrows (closures), desestruturação com padrão e rest, spread, template strings, `?.`/`??`, ternário, `if`/`for…of`/`for`/`while`/`switch`/`try`, JSX com componentes, imports ESM (relativos, pacotes em `node_modules`, JSON), **regex** (`test`, `exec`, `match`, `split`, `replace` com `$1`/função), arrays mutáveis (`push`, `sort`…), métodos de string e número, `Math`, `Object`, `Array`, `JSON`. Tipos do TS são ignorados (a checagem continua com o `tsc` no editor).

Fora do subconjunto, com erro em `arquivo:linha:coluna`: classes e `async` (definir pode, chamar é erro), `this` dentro de função, atribuição em propriedade de objeto, `Date`, `Math.random`. Um orçamento de passos garante que todo deck termina. Funções passadas em props (`<Table cell={fn}>`) rodam ainda no avaliador; a função filha de um `<Container>` roda depois do layout que mede o espaço, no mesmo avaliador.

Componentes são expandidos quando o JSX é avaliado (o pptsx expande no resolve), mas o elemento guarda o componente e as props de origem: `child.type` e `child.props` se comportam como no TS, e um DS pode recriar o filho com outra prop (`jsx(child.type, { ...child.props, size })`).

Concessão pragmática: `node:fs`, `node:path` e `node:url` existem **só para leitura**, porque os design systems leem guias `.md` e listam ícones ao carregar. Escrita, processos e rede não existem. A leitura (`readFileSync`, `readdirSync`) fica restrita à pasta do pacote de cada módulo carregado (o deck, a config, os DS importados: o ancestral mais próximo com `package.json`) e a qualquer `node_modules` acima deles; fora disso é erro com posição. `existsSync` é livre (não lê conteúdo; um DS sonda fontes do sistema com ele).
</details>

<details>
<summary><b>Tudo o que é suportado</b></summary>
<br>

- **Primitivas**: `Deck`, `Slide`, `Box`, `Text` (com `Span`/`B`/`I`/`Sup`/`Sub`, inclusive `fontSize`/`fontFamily` por trecho), `Shape` (as 24 formas), `Image` (`contain`/`cover`), `Path`, `Icon` (vetor ou PNG), `Connector` (reto/cotovelo, setas, rótulo), `Table`, `Chart` (`bar`, `barH`, `stackedBar`, `stackedBarH`, `stackedBar100`, `line`, `area`, `stackedArea`, `pie`, `doughnut`, `scatter`, `combo`), `SlideNumber` (campo `slidenum`), `Container` (o filho é uma função do espaço medido, com `width`/`height`/`aspect`, `narrow`/`short`, `box.pick({ base, narrow, short, small })` e `box.slide`; contenção de tamanho; aninhado até 3 níveis)
- **Layout**: flexbox e CSS Grid (`repeat`, `minmax`, `fr`, `gridColumn`/`gridRow`, `placeItems`), `position: absolute` relativo ao pai, `%`, `margin: auto`, `alignItems: baseline`, ordem de pintura CSS (camadas por `zIndex`, posição, opacidade e transform)
- **CSS do autor**: padding/margin/gap/inset em shorthand, `border` e bordas por lado, `borderRadius`, `opacity` (herdada), `boxShadow`, `rotate`/`transform` (rotate, translate), herança de texto, valores responsivos e `ctx.pick`
- **Fit**: `shrink` por escopo de componente (Text e Table), disparado só por texto/tabela que não cabe ou por palavra partida, em passos de 1 pt; `truncate` com o relayout do pptsx; `maxLines`; `nowrap`; fonte não registrada medida por estimativa
- **paginate**: `Box` (itens), `Text` (linhas, com corte em parágrafo/órfãs) e `Table` (linhas, com `repeatHeader`)
- **Tabela**: `colSpan`/`rowSpan`, cabeçalho de vários níveis, rich text, ícone na célula, `valign`, `cell={fn}`, listras, bordas, colunas pelo conteúdo
- **Deck**: `theme` (cores e fontes do tema do arquivo), `sections`, `footer`, notas com estilo, slides ocultos, hyperlinks, vários tamanhos num build, `backgroundImage`, `document` da config, `textSafety`, `lineBreaks`, `embedFonts`
- **Diagnósticos**: os do pptsx (`text-overflow`, `text-shrunk`, `text-illegible`, `text-truncated`, `text-word-broken`, `box-overflow` inclusive de célula de grid, `out-of-slide`, `table-overflow`, `font-missing`, `font-weight-fallback`, `font-not-embeddable`, `image-upscaled`, `icon-rasterized`, `slide-continued`, `placeholder-unused`, `css-not-emitted`, `container-unsized`, `container-depth`), a causa de cada estouro e o agrupamento de irmãos
- **Validação**: prop da 0.x, cor/id/href/placeholder inválidos e erros de estrutura derrubam o build com a mensagem do pptsx
- **Layouts** (`defineLayout`): cada layout vira um slideLayout do arquivo; nós com `placeholder` saem ligados ao `<p:ph>`, e o conteúdo `fixed` vai para o layout
- **Tema no arquivo**: cores declaradas viram `<a:schemeClr>` e as famílias `+mj-lt`/`+mn-lt`: trocar o tema no PowerPoint repinta o deck
- **lint**: as regras do `pptsx lint` (`legacy-prop`, `keynote-line-height`, `grid-fr`, `off-theme-color`, `structure`) e as dos DS da config, com o mesmo path, agrupamento e junção entre tamanhos
- **Fontes**: Liberation Sans embutida (Arial); fontes do autor pela config, inclusive `.ttc` pelo nome PostScript e busca no sistema; pesos numéricos; embed em EOT
</details>

## O que falta

- `lint --fix` e `lint --from 0.x`: o codemod usa a API do compilador do TypeScript e fica no TS.
- No MCP, `init` e o parâmetro `ds` do `lint` (os DS vêm da config ou do `--ds` do servidor).
- Criar um DS (`pptsx-ds init`, `catalog`, `skill`) é trabalho do `@pptsx/ds-kit`, com Node.
- O taffy ficou só como o tipo `Style` do modelo; trocá-lo por um `Style` próprio é limpeza, não comportamento.
