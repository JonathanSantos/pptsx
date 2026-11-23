# Sessões simuladas, versões e testes do pptsx-rs 1.1.3

23 de nov. de 2026 · `main` em `93ed666` (tag `v1.1.3`). Quatro sessões com um agente Sonnet usando só a skill gerada por `pptsx-rs skill` (sem ler o repositório), cada uma numa pasta isolada; a pessoa foi simulada pelo orquestrador, que conferiu os PNGs e mandou uma segunda rodada de pedidos em três delas. Todo bug abaixo foi reproduzido à parte, com o binário de release, antes de entrar aqui.

## Sessões

| Sessão | Pedido da pessoa | Builds até entregar | Resultado |
|---|---|:-:|---|
| 1. Deck sem DS | 6 slides de investidores, 16:9 e 4:3; depois equipe com iniciais, gráfico de linha | 3 + 2 | Entregue limpo (3 `text-shrunk` info). Dois builds a mais pelo grid do modelo do `SKILL.md` estourando no 4:3 |
| 2. Com o DS da empresa (`@pptsx/ds-base`) | Relatório do trimestre, 14 projetos, gráfico, lint; depois gráfico ao lado dos KPIs e status colorido | 1 + 1 | Entregue limpo. O lint deixou passar cores fora dos tokens dentro da `Table` |
| 3. Criar um DS de marca | DS "Nébula Studio" (3 componentes), deck de 3 slides e a skill para o time | 3 | DS, deck e skill gerados. Sobrou `font-missing` (Inter não instalada, sem `.ttf`) |
| 4. MCP por stdio, pasta com espaço e acento | Proposta de 3 slides com logo e foto que não existia; depois servidor subindo de outra pasta | 1 + 1 | Entregue. Imagem ausente não vira diagnóstico estruturado |

O que funcionou bem nas quatro: `essentials.md` bastou para o primeiro deck; `init --ds` com o caminho relativo certo; `data.component` nos diagnósticos; breakpoint `tall`; `Chart`/`Table` nativos; MCP com mensagens claras em português (deck inexistente, erro de sintaxe com linha e coluna, slide fora da faixa); caminhos com espaço e acento em todas as ferramentas; build abaixo de 100 ms.

## Versões

Tudo em **1.1.3**: `packages/pptsx-rs/Cargo.toml`, `Cargo.lock`, os badges dos dois READMEs, `site/index.html`, `pptsx-rs --version`, o `serverInfo` do MCP, o cabeçalho do `SKILL.md` gerado e os tipos gravados pelo `init`. A tag `v1.1.3` é o `HEAD` e a release tem os 5 pacotes e o `SHA256SUMS`.

- A tag `v1.1.0` não tem release no GitHub (o run da Release parou no gate em 10 s). A 1.1.1 saiu logo depois; nada a fazer além de saber.
- Não há `CHANGELOG` do pptsx-rs: o único é o de `packages/pptsx`, que para na 1.0.5. As notas da 1.1.x estão só nos commits.
- O CI agora confere sozinho `Cargo.toml` × `Cargo.lock` × badges × `--version` × `serverInfo` × `SKILL.md` (ver "CI").

## Bugs reproduzidos

| # | O quê | Reprodução | Efeito |
|---|---|---|---|
| B1 | Cor hex com caractere não ASCII derruba o binário | `<Box border="1px solid #aéaaa">`, `backgroundImage="linear-gradient(#aéaaa, #000)"` ou o mesmo valor numa cor do `theme` do `pptsx.config.ts` | `panic` em `css.rs:126` (fatia de bytes no meio do `é`), exit 134. O conteúdo do deck basta: no `mcp`, o servidor morre. `backgroundColor`, `color` e `Chart colors` passam pelo `validate` e viram erro normal |
| B2 | `border` com `rgba(…)` espaçado sai preto, sem aviso | `<Box border="2px solid rgba(255, 0, 0, 0.5)">` | `parse_border` quebra por espaço; a cor some e vale o preto padrão |
| B3 | Imagem que não existe não é diagnóstico | `<Image src="./fotos/nao-existe.jpg" />` + `check --json` | Só uma linha `aviso` no stderr; `[]` no `--json`, no `diagnostics.json` e no MCP, e o resumo diz "Nenhum diagnóstico." É de propósito (`note` fica fora do contrato do pptsx, `main.rs`) e o legado em TS também não tinha diagnóstico: é lacuna de projeto, não regressão. Um código novo (`image-not-found`) não mexe nos decks dourados, que não têm imagem ausente |
| B4 | O lint não vê as cores de dentro da `Table` e do `Chart` | `header={{ fill }}`, célula `{ text, color, fill }`, `Chart colors` | `off-theme-color` e as regras do DS (`colors-from-tokens`) não disparam; `painted_colors` lê só `color`/`fill`/`stroke`/fundo/borda do nó |
| B5 | O fix do `bac49fa` ficou pela metade | `<Box display="flex"><Text nowrap fontSize={40}>…longo…</Text><Box width={200} /></Box>` | A mensagem ficou boa, mas `data.overflowPt` = 7188900224 e `overflowPct` = 1123265660 seguem no JSON que agentes e o MCP leem |
| B6 | `types --help` cria uma pasta chamada `--help` | `pptsx-rs types --help` | Grava 179 arquivos em `./--help/` e sai 0 |
| B7 | `--help` dos subcomandos não mostra ajuda | `build`, `check`, `lint`, `init`, `skill`, `tree` com `--help`; `mcp --help` | Os seis saem 2 com "opção desconhecida"; o `mcp --help` sobe o servidor calado. Agentes tentam `--help` primeiro |
| B8 | O guia promete selo amarelo no overview | `agent-guide.md` §"O overview PNG" | `preview::overview_svg` só desenha o vermelho (error) |

## Atritos de documentação e mensagem

| # | O quê | Quem tropeçou |
|---|---|---|
| D1 | O `SKILL.md` diz `overview.png`, `slide-NN.png` e `diagnostics.json`; os nomes reais são `deck.16x9.overview.png`, `deck.16x9/slide-NN.png`, `deck.diagnostics.json` (o guia já está certo) | Sessões 1 e 2 |
| D2 | Estouro de tracks do grid sugere `flexShrink`, que não existe em grid. O conserto é `gridTemplateRows` com `minmax(0, 1fr)`, e o modelo do `SKILL.md` (3 colunas → 1 no `tall`) não traz isso: cartões altos estouram no 4:3 | Sessões 1 e 3 |
| D3 | `{{ds}}` no `skill/SKILL.md` de um DS vira o **arquivo de entrada** do DS, não a pasta; o guia diz só "viram os caminhos" | Sessão 3 |
| D4 | `skill --ds packages/ds-base` copia `tests/`, `fixtures/`, `examples/agent-test/` e os `vitest*.config.ts` para dentro da skill (98 arquivos) | Visto ao gerar a skill |
| D5 | MCP: o schema diz "relativo ao diretório do servidor" e os `mcp/*.json` não fixam `cwd`; vale recomendar caminho absoluto | Sessão 4 |
| D6 | `check` sem `--size` avalia só o 16x9 (vem da config ou do padrão) e o `SKILL.md` não diz | Sessão 2 |

## Sugestões de produto (não são bugs)

Os dois primeiros itens vieram só da sessão 3 e não foram reproduzidos à parte.

- Um DS não declara as próprias fontes, e `skill --ds` não leva o `.ttf` da marca: quem cria um DS com Inter sem a fonte instalada fica com `font-missing` (error, por contrato). Sugestão: `createDs({ fonts })` e a skill copiando os arquivos.
- `init --ds` de um DS escuro escreveu um deck de fundo claro com texto claro (ilegível), e não há regra de contraste no lint, embora o kit calcule `contrastOf`.
- Slide muito vazio passa sem diagnóstico (só o PNG mostra); um `info` de área ociosa ajudaria quem não olha a imagem.
- O `@pptsx/ds-base` não tem cor de alerta (só `positive`/`negative`), então "status amarelo" sai do tema; e o `init --ds` gera um catálogo, não um esqueleto capa/conteúdo/fechamento.

## Testes novos

Os módulos sem nenhum `#[test]` eram 29 de 43. Entraram testes nos de lógica pura onde um erro passaria pelos decks dourados:

| Arquivo | Testes | O que seguram |
|---|:-:|---|
| `src/css.rs` | 12 | comprimentos, shorthand de 1 a 4 valores, cores (hex curto/longo/alfa, nomes, `rgb()` com vírgula, espaço, `%` e `/`), bordas |
| `src/diag.rs` | 5 | `round` igual ao `Math.round` do JS (inclusive negativos), `fmt` sem `.0`, deduplicação, `note` sem path |
| `src/init.rs` | 12 | nome de pacote a partir da pasta (acentos), `.gitignore`, JSONC, mescla do `tsconfig` e do `package.json`, arquivos do scaffold |
| `src/js/regex.rs` | 8 | flags, `\/`, lookahead recusado com mensagem, `$1`/`$&`/`$$`, `split` com grupos e casos vazios do JS, índice em caracteres |
| `tests/diagnostics.rs` | 3 | o caso degenerado do `bac49fa` (mensagem sem número, `causedBy`), o estouro comum com as contas, deck limpo |

Ficaram de fora de propósito: os casos que hoje estão errados (B1, B2, B5) ganham teste junto com a correção. Seguem sem teste unitário `text.rs`, `validate.rs`, `report.rs` (só pelo teste de ponta a ponta), `package.rs`, `embed.rs`, `mcp.rs` e o interpretador (`js/interp.rs`, `js/builtins.rs`), cobertos hoje só pelos decks dourados.

`cargo test`: 104 unitários (eram 67), 3 de diagnósticos, 8 de `fitGroup`, 7 dourados. `cargo clippy --release --all-targets -- -D warnings` limpo.

## CI

`.github/workflows/ci.yml` passa a rodar em `ubuntu-latest`, `windows-latest` e `macos-latest` (`fail-fast: false`), com o mesmo script em bash nos três:

- build, clippy e `cargo test` em cada sistema (antes só Linux; a Release já publicava para Windows e macOS sem testar neles);
- o deck do README em `$RUNNER_TEMP` (antes `/tmp`, que não existe no Windows);
- versões: `Cargo.lock` e badges (no Linux), `--version`, `serverInfo` do MCP e `SKILL.md` gerado (nos três);
- o caminho de quem baixa a release: `skill` → `init` → `build` 16:9 e 4:3 numa pasta `Apresentações Clientes/proposta café`, e `init --ds packages/ds-base` → `build` → `lint`.

O workflow continua chamado `CI`, que é o nome que o gate da Release procura; um sistema vermelho agora bloqueia a Release. O roteiro de fumaça foi rodado localmente no macOS; no Windows e no Linux só vale depois do primeiro run.
