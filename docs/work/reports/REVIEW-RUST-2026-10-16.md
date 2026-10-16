# Avaliação do pptsx-rs frente ao pptsx em TypeScript

> Escrito quando o Rust vivia em `pptsx-rs/` fora do git; hoje é `packages/pptsx-rs/`. Os caminhos abaixo são os da época.

16 de out. de 2026 · revisão feita sobre `pptsx-rs/` (18.110 linhas de Rust, binário release de 6,1 MB) comparado com `packages/pptsx` (25.909 linhas de TS, 64 arquivos de teste, 2.087 testes).

## Nota

| Dimensão | Nota | Base |
|---|:-:|---|
| Paridade de saída (geometria, texto, diagnósticos) | 9,5 | 11 decks reconstruídos aqui nas duas engines: frames iguais a ±1 EMU, quebras de linha iguais, diagnósticos idênticos até na mensagem |
| Desempenho | 10 | 20× a 60× mais rápido que o Node, 10× a 25× menos memória, preview incluso |
| Completude frente ao TS | 7,5 | `Container` (M19) portado e conferido; falta `init`, `skill`, `preview --serve`, `lint --fix`/`--from`, `embedFonts`; gráficos nativos divergem no estilo |
| Qualidade de código e engenharia | 5,5 | 3 testes unitários, 6 avisos do compilador, estado global, regex compilada por prop, `model.rs` com 2.300 linhas, build preso ao monorepo |
| Robustez do avaliador TSX | 8,5 | Todos os casos fora do subconjunto caem com `arquivo:linha:coluna`; laço infinito e recursão têm teto; `node:fs` lê qualquer caminho |
| Sustentabilidade | 5 | Port manual de 18 mil linhas acompanhando um motor de 26 mil linhas que ainda muda; a única rede de regressão é a comparação contra o TS, e ela não está no repositório |

**Nota geral: 7,5 / 10.** Como prova de conceito, é excepcional: a paridade é real e o ganho de desempenho é de outra ordem. Como produto para distribuir num binário a terceiros, ainda não: a qualidade da saída depende de uma verificação externa que o projeto não carrega, e metade da superfície da CLI que a skill do pptsx promete não existe.

## O que foi verificado

Cinco decks construídos nas duas engines em 16x9 e 4x3 (`hello`, `demo`, `charts`, `showcase`, `long-list`), mais `overflow`, `arquivo`, `graficos`, `tabelas`, `pesos` e três decks da galeria (`nebula`, `gazeta`, `forma`).

| Métrica | Resultado |
|---|---|
| Formas com `off`, `ext`, `prstGeom`, texto, `<a:br>` e `sz` idênticos | 323 de 367 |
| Formas restantes | Diferem em 1 EMU (1/12700 pt) por arredondamento f32 × f64 |
| Diagnósticos (código, severidade, slide, path, mensagem) | Idênticos em todos os 13 decks |
| Partes XML do Rust bem formadas | 258 de 258 |
| Preview PNG do `demo` (pixels diferentes acima do limiar) | 5 slides abaixo de 0,02 %; slide 3 com 5,5 % (eixo do gráfico, ver abaixo) |

Tempo de processo inteiro (sem preview, `--size 16x9,4x3`, mediana informal de uma execução cada):

| Deck | Node | Rust |
|---|---:|---:|
| hello | 0,61 s | 0,27 s (primeira execução, cache frio) |
| demo | 0,76 s | 0,03 s |
| charts | 0,69 s | 0,01 s |
| showcase | 0,74 s | 0,05 s |
| demo com preview PNG | 0,92 s | 0,08 s |

### Não verificado nesta sessão

- Abertura dos `.pptx` do Rust no Keynote ou PowerPoint. Só a boa formação do XML foi checada. O README diz que foi feito, mas não há evidência no repositório.
- Memória do `--watch`. Cada módulo avaliado é vazado com `Box::leak` (`src/js/module.rs:36-48`), então cada rebuild soma a memória do anterior. O MCP não sofre disso porque roda um subprocesso por chamada (`run_self`).
- Build em Linux e Windows. Só arm64 macOS.
- A tabela de paridade do README (68 decks, 4.673 caixas). O script que a produziu não está em `pptsx-rs/`, então ela não é reproduzível a partir do projeto.

## Divergências encontradas

1. **Gráficos nativos ignoram a cor herdada do texto.** `src/model.rs:2136` usa `#333333` quando o `<Chart>` não tem `color` próprio. O TS herda a cor do Slide (`emit/chart.ts` passa `text.color` a rótulos, eixos e legenda). No `charts.tsx` o TS grava `1B2A4A` e o Rust `333333`. O título do gráfico também sai em negrito no Rust (`objects.rs:751`, `b="1"`) e regular no TS. O arquivo abre, mas a cor e o peso diferem do deck.
2. **Eixo do gráfico no preview.** O preview do Rust escolhe o máximo do eixo como 100 em passos de 25 onde o TS escolhe 60 em passos de 20. O gráfico nativo no arquivo é correto (o PowerPoint calcula o eixo), mas o PNG do Rust mostra algo que o PowerPoint não vai mostrar, e o preview do TS foi calibrado contra o Keynote nos marcos M10 e M14.
3. **Notas vazias.** O TS grava um `notesSlide` para todo slide; o Rust só para quem tem notas. Não é defeito, mas é uma diferença estrutural do pacote.
4. **Atributos de texto.** O Rust não grava `altLang`, `pitchFamily` e `charset` nas fontes, grava `<a:noAutofit/>` e `<a:noFill/>` explícitos e omite `name` em `<p:cSld>`. Cosmético; vale conferir no PowerPoint se o `charset` ausente muda o fallback de fonte para texto em CJK.
5. **`node:fs` lê qualquer caminho.** Um deck com `readFileSync('/etc/hosts')` compila e embute o conteúdo no slide. O TS tem a mesma exposição por rodar Node de verdade, então não é regressão, mas contradiz o "sem IO" do README e pesa mais quando o deck vem num PR que o Copilot constrói.

## O que eu otimizaria, por alavancagem

1. **Fixtures douradas no `cargo test`.** Gerar com o TS o XML normalizado dos slides e o `diagnostics.json` dos decks de exemplo, gravar em `pptsx-rs/fixtures/` e comparar em testes. Isso transforma a tabela do README numa rede de regressão e dá ao projeto uma forma de perceber quando o TS mudar. Hoje são 3 testes, todos de parse de path SVG.
2. **Tirar o estado global.** `text.rs` guarda `textSafety` e `lineBreaks` em atômicos (`set_safety`, `set_auto_breaks`) e `layout_slide` lê `std::env::var` dentro do loop de fit (`PPTSX_RS_NOFIT`, `PPTSX_RS_DEBUGFIT`, `PPTSX_RS_ENGINE`). Isso quebra a regra do CLAUDE.md de etapas puras e impede dois decks com configs diferentes no mesmo processo. Um `struct LayoutOptions` passado por valor resolve.
3. **Compilar regex uma vez.** `validate.rs` chama `Regex::new` em cada prop de cada nó (linhas 77 a 506). Com `LazyLock` o custo some; é o maior ganho fácil de desempenho que sobrou.
4. **Corrigir os gráficos.** Herdar `color` e `fontFamily` do Slide no `ChartSpec`, título sem negrito, e portar o algoritmo de ticks do preview do TS (`preview/chart.ts`).
5. **Decidir o destino do `Box::leak`.** Ou o `Interp` passa a ser dono do arena e dos fontes (vida `'a` em vez de `'static`), ou o `--watch` passa a reiniciar o processo como o MCP já faz. A segunda é uma tarde de trabalho; a primeira é uma refatoração grande.
6. **Higiene.** `rustup component add clippy`, `#![deny(warnings)]` depois de zerar os 6 avisos (dois são código morto: `evaluate_deck`, campo `cell`), dividir `model.rs` em `resolve/{style,paint,text,shape,table,chart}.rs` como o TS faz, e remover o motor antigo em taffy (`PPTSX_RS_ENGINE=taffy`) ou movê-lo para uma feature.
7. **Desprender do monorepo.** `mcp.rs` faz `include_str!("../../packages/pptsx/docs/AGENT_GUIDE.md")` e do `schema.generated.ts`. Fora da árvore do pptsx o crate não compila. Copiar esses dois arquivos para `pptsx-rs/assets/` num passo de build (`build.rs` que falha com mensagem clara se faltar) resolve.
8. **Sandbox do `node:fs`.** Restringir leitura à pasta do deck, à da config e a `node_modules`. Qualquer outro caminho vira erro com posição, como o resto do subconjunto.

## Skill e binário para o Copilot

O que o TS já tem: `pptsx skill` gera `.github/skills/pptsx/SKILL.md`, `references/` (essentials, guide, props) e `scripts/pptsx.mjs`, mais `.vscode/mcp.json` e `.mcp.json`. O script acha o runtime nesta ordem: `PPTSX_BUNDLE`, cache em `~/.cache/pptsx/<versão>/`, download da release com SHA256 conferido, `npx pptsx@<versão>`.

O que o binário Rust muda de verdade: o `.vscode/mcp.json` pode apontar direto para o executável. Zero Node, zero npx, zero `node_modules` no repositório do usuário. É o argumento mais forte para a versão Rust nesse cenário.

O que recomendo:

- **Não versionar o binário no repositório do usuário.** São 6 MB por plataforma; em cinco plataformas, 30 MB a cada versão, para sempre no histórico. Publicar como asset de release (`pptsx-rs-<versão>-<alvo>.tar.gz` mais `SHA256SUMS`) e manter no repositório do usuário só a skill e um lançador pequeno. Se a equipe insistir num binário dentro do repo, Git LFS com um alvo só.
- **Lançador.** Um `scripts/pptsx` (sh) e `scripts/pptsx.cmd` que detectam `uname -sm`, procuram o binário no cache, baixam da release e conferem o SHA256, no mesmo desenho do `script.ts`. A skill chama o lançador; o `mcp.json` também.
- **Adicionar `pptsx-rs skill` ao binário.** O guia e o schema já estão embutidos para o MCP, e o `skill.ts` do TS define o formato. Assim a skill gerada carrega a mesma versão do binário que a produziu, sem depender do pacote npm.
- **Matriz de release.** darwin-arm64, darwin-x64, linux-x64, linux-arm64 e windows-x64 exigem CI (GitHub Actions com `cross` ou runners nativos). Não dá para prometer o Windows a partir deste Mac.
- **Antes de distribuir:** fechar os itens 1, 4 e 8 acima e abrir no PowerPoint um deck de cada família (texto, tabela, gráfico, layouts) gerado pelo Rust. Os dois critérios de aceite do pptsx que mais importam para o Copilot são "abre sem reparar" e "o PNG mostra o que o PowerPoint mostra"; o primeiro não foi provado aqui e o segundo falha nos gráficos.

## Adendo: `Container` (M19), conferido às 12h40

A versão com `Container` não muda a nota. A paridade continua, a completude sobe um pouco (o último gancho do núcleo foi portado) e os problemas de engenharia são os mesmos: `cargo test` passou de 3 para 4 testes e os avisos do compilador de 6 para 7.

O que foi verificado:

| Deck | Diagnósticos | Formas idênticas (±1 EMU) |
|---|---|---|
| Sonda própria (3 breakpoints, aninhado, sem tamanho, 16x9 e 4x3) | Idênticos, com a mesma medida impressa no texto (`247 × 193 pt`, `656 × 0`) | 38 de 38 |
| Sonda com `Container` dentro de `Box paginate` | Mesmo `ResolveError` nas duas engines | — |
| `ds-orbit/compose` (9 slides) | 2 de 2 idênticos | 322 de 323 |
| `ds-orbit/matrix-lists-a` (24 slides, 112 diagnósticos) | 112 de 112 idênticos, incluindo derivados | 1198 de 1211 |

O port de `containers.rs` segue `containers.ts` passo a passo: passadas de resolve e layout sem fit até nada ficar pendente, `UNSIZED_PT` 0,5, `container-depth` em 3 níveis, lint vendo o conteúdo que a função devolveu (`filled_deck`).

Desempenho com `Container` (processo inteiro, 16x9, binário já em cache):

| Deck | Node | Rust |
|---|---:|---:|
| compose, sem preview | 0,88 s | 0,11 s |
| compose, com preview | 1,27 s | 0,21 s |
| matrix-lists-a, sem preview | 1,42 s | 0,28 s |

O ganho cai de 30× para 5× a 8×, como o README admite: cada `Container` roda a função do autor de novo no avaliador tree-walking, e o `ds-orbit` leva ~35 ms só para carregar. Isso reforça o item 2 da lista de otimizações: o custo do avaliador começa a aparecer, e um cache do deck já avaliado entre passadas (as funções filhas são puras por contrato) cortaria a maior parte.

Dois detalhes vistos de passagem: a primeira execução de um binário recém-compilado leva ~0,5 s a mais no macOS (verificação de assinatura), o que distorce qualquer medição de um build único; e `size-matrix.tsx` no `ds-orbit` não é um deck (não tem `defineDeck`), então sai do contador de "80 decks".

## Adendo: itens 1 a 4 feitos (16/10, à tarde)

- **Fixtures douradas:** `scripts/golden.sh` + `tests/golden.rs`; 7 decks em 16x9 e 4x3, comparação semântica em Rust (frames ±2 EMU, texto, cores, tabelas, gráficos, diagnósticos). Os 7 testes passam; uma fixture mutada em 500 EMU faz o teste falhar com o diff.
- **Gráficos:** a cor do texto é a `color` do Chart, ou a herdada da cascata, ou `#333333` (igual ao `chartLabelStyleOf` do TS); título regular; grade `DDDDDD` 0,5 pt, eixo `888888` 1 pt e borda da fatia `F9F9F9` 0,75 pt como o pptxgenjs. O preview usa a escala do TS (`niceScaleOf`, `scaleOf`, `ticksOf`) e os formatos de eixo; o `demo` slide 3 caiu de 5,5 % para 3,2 % de pixels diferentes (o resto é o corpo dos rótulos, 0,8× no Rust e 1× no TS).
- **Estado global:** `text::TextOptions { safety, auto_breaks, legacy_taffy }` em `Fonts`, montado uma vez em `main` e passado por valor; os atômicos e as leituras de `std::env::var` no pipeline saíram.
- **Regex:** todas em `LazyLock`; o `demo` passou de ~29 ms para ~18 a 20 ms no processo inteiro.
- Avisos do compilador: 7 antes, 7 depois (todos em `yoga.rs` e `js/mod.rs`, pré-existentes).

## Adendo: itens 4 a 8 (16/10, fim da tarde)

- **4. Sandbox do `node:fs`:** `readFileSync` e `readdirSync` só na pasta do pacote de cada módulo carregado (ancestral com `package.json`) e em `node_modules` acima; `existsSync` livre (o `ds-orbit` sonda fontes do sistema com ele). `readFileSync('/etc/hosts')` agora é erro com posição.
- **5. Cache do `Container`:** resultado por (slide, path, medida) em `ContainerRun`; `compose` 107 → 73 ms, `matrix-lists-a` 280 → 190 ms, diagnósticos idênticos (112/112). O que resta é o avaliador tree-walking em si (carregar o `ds-orbit` leva ~37 ms).
- **6. `--watch`:** cada build roda num processo filho (`--deps-out` devolve os arquivos a observar); a memória volta a zero a cada rebuild. Testado: muda o deck, o filho reconstrói.
- **7. Higiene:** clippy instalado; 112 avisos zerados (98 automáticos, o resto corrigido ou com `allow` justificado no `yoga.rs`, que segue o C++ de propósito, e no `NodeKind`); `cargo build` e `cargo clippy` sem nenhum aviso; `model.rs` (2.330 linhas) virou `src/model/{mod,style,shape,resolve,data,connector}.rs`; o motor antigo em taffy foi removido (o taffy fica só nas faixas do grid); o estado global e o `PPTSX_RS_ENGINE` saíram.
- **8. Divergências e completude:** rótulos do gráfico no preview no corpo do TS (1×); `init [pasta] [--force] [--json]` portado com as mesclas de `tsconfig`, `package.json` e `.gitignore` (sem `--ds`); `build --serve [--port]` portado: HTTP + SSE em `std::net`, a página do TS, estado gravado pelo filho, erro do deck na página mantendo o resultado anterior. Testado de ponta a ponta (página, `state.json`, SVG, evento `update` na mudança, deck quebrado).
- **Fora:** o port do `grid.ts` (476 linhas puras + 289 do `grid-layout.ts`; CSS Grid §11 com `minmax`, `fr` e intrinsic sizing) e o `embedFonts`. O grid continua pelo taffy; `cargo test` cobre os exemplos, mas um caso que taffy e `grid.ts` resolvam diferente passaria despercebido até entrar numa fixture.
- `cargo test`: 11 testes (4 unitários + 7 golden) verdes depois de tudo.

## Nota revisada (16/10, noite)

| Dimensão | Antes | Agora | Base |
|---|:-:|:-:|---|
| Paridade de saída | 9,5 | 9,5 | Grid próprio (porta do `grid.ts`) com as mesmas formas e diagnósticos em `demo`, `showcase`, galeria, `ds-orbit` e sonda de Container; EOT byte a byte igual ao TS. Keynote/PowerPoint continuam sem teste |
| Desempenho | 10 | 10 | `demo` 14 ms, `matrix-lists-a` 190 ms; sem regressão com o grid próprio |
| Completude frente ao TS | 7,5 | 9 | `init`, `build --serve`, `embedFonts`, grid próprio; faltam `lint --fix`/`--from` (compilador TS), `init --ds` e `init` no MCP |
| Qualidade de código e engenharia | 5,5 | 8 | 15 testes (8 unitários + 7 dourados), clippy e build sem avisos, sem estado global, `model/` dividido, motor antigo fora; fixtures só de 7 decks, crate ainda preso ao monorepo |
| Robustez do avaliador TSX | 8,5 | 9 | Sandbox do `node:fs` por pacote; `--watch` sem vazamento |
| Sustentabilidade | 5 | 7 | A rede de regressão existe e acusa mutação; o risco "taffy ≠ grid.ts" acabou; segue um port manual, sem CI e sem descoberta automática dos decks |

**Nota geral: 8,5 / 10** (era 7,5). O que separa de 9 é o que nenhum teste local prova: abrir no PowerPoint e no Keynote, o build fora do monorepo e a matriz de release.

## Adendo: o que tinha ficado de fora (16/10, noite)

- **Grid próprio:** `src/grid.rs` porta o `grid.ts` (476 linhas: placement sparse, `minmax`, `fr`, `repeat`, §11.5 a §11.8) com 4 testes unitários; `yoga_layout.rs` porta o `grid-layout.ts` e o `intrinsic.ts` (min-content por tipo de nó, max-content e altura numa largura em árvores Yoga isoladas, `placeInArea`, `placeAbsolute`). O taffy saiu do layout (ficou só como tipo do `Style`). Conferido: `demo` 100/100 formas, `showcase` 163/165, galeria 4 decks, `ds-orbit` `compose`/`matrix-lists-a`/`matrix-numbers` com diagnósticos idênticos e formas a ±1 EMU; os 7 testes dourados verdes.
- **embedFonts:** `src/embed.rs` porta o `eot.ts` e o `embed.ts`; `embedFonts` na config ou `--embed-fonts`. Com as quatro Liberation registradas como "Liberation Sans", os `.fntdata` saem **byte a byte iguais** aos do TS, com o mesmo `<p:embeddedFontLst>`, rels e content type. `.otf`/`.ttc` e fsType restrito viram `font-not-embeddable` (caminho não exercitado com arquivo real).

## Adendo: usabilidade com um design system (16/10, noite, 1.0.5)

Os quatro atritos levantados no uso do binário com o `ds-orbit`, e a tipagem para o editor:

- **Diagnóstico aponta o componente do autor.** `Node.source` guarda `<Nome prop=valor …>` de cada raiz de componente do autor; `report.rs` sobe do nó estourado ao componente mais próximo e grava `data.component`; o resumo imprime `no componente <StatusBoard items=[3 itens] />`. Path e mensagem não mudam (paridade com o TS mantida; as fixtures douradas continuam verdes). No `project.tsx` em 16x9, 77/77 diagnósticos saem com o componente.
- **Falha silenciosa do DS vira diagnóstico.** `console.warn`/`console.error` de qualquer módulo avaliado são recolhidos (`Interp.notes`) e saem como `module-warning` (warning, slide 0, deduplicado); `console.log` continua no stderr. O `ds-orbit` passou a avisar quando um ícone é desconhecido e cai no `star`.
- **Ruído do lint.** Achados de nível info dentro de componentes de DS (`off-theme-color` da própria marca) saem numa linha só no texto: "N info dentro de componentes de design system (códigos): são do DS, não do deck"; `--json` lista todos. No `assistente-ia.tsx`, 59 linhas viraram 1.
- **Agente e DS.** `dsinfo.rs` carrega o manifesto do DS pelo avaliador (pacote em `node_modules` ou caminho), e `init --ds <pacote|caminho>` gera deck (um slide por componente, com as props do catálogo), `pptsx.config.ts` e `tsconfig.json` idênticos aos do `pptsx init --ds` (conferido por `diff`; o deck gerado dá os mesmos 55 erros nos dois, em `wide,4x3`, porque as peças do Orbit foram feitas para os layouts dele e o scaffold do TS as põe num `Slide` genérico). `skill --ds` acrescenta `references/ds.md` (componentes, exemplos, props do schema, regras, guia) e `references/pptsx.config.ts`, e o `SKILL.md` ganha a seção do DS.
- **Tipos sem npm.** `build.rs` copia os 160 `.d.ts` de `packages/pptsx/dist` para `assets/pptsx-types/` (744 KB; o CI acusa drift) e os embute; `init` (e `pptsx-rs types <pasta>`) grava em `.pptsx/types/pptsx/` como um pacote de tipos e põe `typeRoots` no `tsconfig.json` (o `paths` da primeira versão quebrava o `pptsx` em Node, porque o tsx o segue; trocado antes da tag), mesclando num tsconfig existente. Conferido com o `tsc` numa pasta fora do monorepo e sem `node_modules`: `pptsx` e o JSX resolvem; os únicos erros que sobram vêm do próprio `ds-orbit` importado por caminho (`node:fs` sem `@types/node`), que não existem quando o DS é um pacote instalado.

| Dimensão (uso do binário com um DS) | Antes | Agora |
|---|:-:|:-:|
| Diagnóstico leva ao lugar certo | 6 | 9 |
| Falhas do DS aparecem | 5 | 8,5 (depende de o DS avisar; o Orbit avisa) |
| Lint útil, sem ruído | 6 | 9 |
| Agente começa sozinho (`init --ds`, skill com o DS) | 6 | 9 |
| Editor entende o deck sem instalar nada | 5 | 9 |

**Usabilidade com DS: 9 / 10** (era 7). O que falta para mais: o scaffold do `init --ds` montar os componentes nos layouts do próprio DS (hoje segue o TS e põe cada um num `Slide` genérico, o que dá erros no Orbit), e um DS por caminho precisar de `@types/node` para o `tsc` ficar limpo.

## Observações sobre o código

Pontos fortes: sem `unsafe`; o port do Yoga 3.2.1 segue o C++ nome a nome e explica por quê no cabeçalho; erros do avaliador sempre com posição; mensagens em português iguais às do TS; `MCP` via subprocesso evita o vazamento do arena; `--json` e código de saída coerentes com a CLI original.

Pontos fracos além dos listados: `layout_slide` tem 120 linhas com quatro níveis de aninhamento e um bloco de depuração inline; `resolve_slide` constrói `Node` com 20 campos posicionais em vez de um `Default`; `Placed.cell` nunca é lido; os números mágicos dos presets (`shape_preset`, `CHART_PALETTE`, `0x3F78_51EC` para 0,97) estão espalhados, enquanto o TS os centraliza em `core/defaults.ts`.
