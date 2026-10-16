# Changelog

Escrito a partir dos commits de gate de cada marco (`docs/work/milestones/`). Versões antes da 1.0 podem quebrar a API; o que quebra está em **Mudanças incompatíveis**.

## Não lançado — M19: composição

### Novidades

- **`<Container>`**: Box cujo conteúdo é uma função do espaço medido (`{(box) => …}`), com `box.width/height`,
  `narrow`/`short` e `box.pick({ base, narrow, short, small })`. O tamanho vem do pai (contenção de tamanho); o
  motor mede numa passada de layout e resolve de novo. Novos diagnósticos `container-unsized` (warning) e
  `container-depth` (error). Slides sem Container saem idênticos.
- **Ids de conector com escopo de componente**: o mesmo `id` pode se repetir em instâncias diferentes de um
  componente (um diagrama com conectores repetido numa grade); antes o build abortava. Ids únicos saem iguais.
- `resolveDeck(root, ctx, env, containers?)` aceita medidas de Container (opcional).

### Mudanças de comportamento

- Item de grid com `minWidth` numérico (e sem `width` numérica): o `minWidth` passa a ser o mínimo da trilha, como
  `min-width` no CSS. `minWidth={0}` deixa uma trilha `1fr` encolher abaixo do conteúdo (antes era ignorado).
  Nenhum dos decks de exemplo do repositório mudou.
- Item de grid esticado com `aspectRatio` e `maxHeight`: mantém a proporção (antes virava elipse/retângulo).

## 1.0.2 — primeira publicação no npm

Mesmo motor da 1.0.1. Publica `pptsx`, `@pptsx/ds-kit` e `@pptsx/ds-base` no npm (a 1.0.1 saiu só como release do GitHub: o job do npm parou num aviso do CI antes de publicar).

## 1.0.1

Mesmo motor da 1.0.0 (a 1.0.0 saiu só como release do GitHub, com o núcleo ainda `private`).

### Correções

- Deck carregado como CommonJS no Node 20.19+ e 22.12+ (`require(esm)` ligado): o erro volta a dizer para pôr `"type": "module"` no `package.json`, em vez da mensagem crua do Node.
- Testes e CI passam no Windows (Node 20 e 22).

## 1.0.0 — M18: redondo antes de liberar

Versão do gate do M18. A publicação (tag `v1.0.0`) espera a lista do dono em `docs/work/VALIDACAO-DONO.md` (PowerPoint, Google Slides, CI em matriz, `repository` e `private`).

### Mudanças incompatíveis

- **As props da 0.x foram removidas** (os aliases do M11): `direction`, `align`/`justify` de contêiner, `grow`, `shrink`, `fill`/`stroke`/`strokeWidth`/`radius` do Box, `fill`/`direction`/`background={{ image }}` do Slide, `size`/`weight`/`italic`/`font`/`align` do Text e do SlideNumber, `weight`/`italic` do Span, `size`/`font` da Table, `fit` da Image e `showValues` do Chart. Cada uma vira `ResolveError` com a troca (`Prop "size" de <Text>: removida na 1.0; troque por fontSize…`); no `pptsx lint`, um achado `legacy-prop` (error). Os tipos de autor não as aceitam mais.
- `grow={n}` não existe mais, e com ele a regra de basis dele (0 só sem tamanho no eixo principal). `flex={n}` é o `1 1 0%` do CSS; `grow={0}` antigo equivale a `flexGrow={0}`.
- `<B>`/`<I>` passam `fontWeight`/`fontStyle` ao Span.
- `ResolveEnv.observe` saiu (só o lint o usava, para achar aliases).

### Como migrar

- **`pptsx lint --from 0.x <pasta>`** (novo) reescreve todos os `.ts`/`.tsx` da pasta: deck, componentes e layouts. `pptsx lint deck.tsx --fix` continua, só para o deck.
- O codemod agora cobre também `direction={expr}` → `display="flex" flexDirection={expr}`, `stroke={expr}` → `outline` em template literal, `justify`/`align` em ternário de literais, `grow` em ternário de números, `italic={false}` → `fontStyle="normal"` (antes o atributo sumia e o itálico herdado voltava) e `showValues` → `labels`. O que depende do valor fica, com aviso e linha.
- Prova: os decks congelados de `tests/examples/legacy/` passaram pelo `--from 0.x` (114 trocas; 3 trechos ambíguos à mão) e batem com as **mesmas fixtures** de paridade do motor pré-M11 (frames ±1 pt, XML dos slides).
- Guia do agente: apêndice "Migrando de 0.x" (comando e tabela).

### O que é estável na 1.0

Props CSS das primitivas e as props próprias de cada uma; códigos e formato dos diagnósticos; `render`/`renderFragment`/`fragmentSlide` e o resultado deles; a CLI (`build`, `init`, `preview`, `lint`) e suas flags; as ferramentas do MCP (`build`, `preview`, `diagnostics`, `init`, `guide`, `schema`, `lint`); os ganchos de DS (`defineComponent`, `LintRule`, `defineDs`/`DsManifest`, `ds`/`lint` na config).

### Novo

- `pptsx init --ds <pacote|caminho>`: deck inicial que importa os componentes do DS (props do 1º caso do catálogo) e config com o DS e o tema.
- MCP: ferramenta `lint`; `guide`/`schema` descobrem o DS pela config do deck; schema em JSON Schema 2020-12 (`$id` por fonte).
- `fragmentSlide` público (o slide do catálogo); `defineComponent` com `catalog` e `defaults` tipados pelas props.
- Pacote: `bin` sem `./` (o npm 11 removia os comandos na publicação), `sideEffects: false`, provenance, `THIRD_PARTY.md`; `--watch` sem `fs.watch` recursivo dá erro claro.

## 0.7.0 — M17: núcleo concreto e ganchos para design systems

- **Monorepo** (npm workspaces): o núcleo em `packages/pptsx`, mais `@pptsx/ds-kit` e `@pptsx/ds-base` (0.1.0, CHANGELOG próprio).
- **Ganchos para DS:** `defineComponent(meta, fn, defaults?)` (nome no path mesmo com HOC/anônimo; `meta` no nó resolvido em `component`), `LintRule` pública e `lint: { rules, disable }`/`ds` na config, `renderFragment(elemento, { size, fill? })` (componente isolado: frames, SVG, PNG), `DsManifest`/`defineDs`, MCP agregador (`guide`/`schema` com `source`; `pptsx-mcp --ds <pacote>`).
- **API pública para quem constrói em cima** (sem marca): `mapResponsive`/`isResponsive`/`pickResponsive`, `toHexColor`, `resolveTheme`, `lintDeck`, `buildOverview`, `defaultFontFaces`/`defaultFontFiles`, `createContext`/`resolveSize`, tipos da árvore resolvida e posicionada.
- **Núcleo sem marca:** tokens, tema pronto, layouts, componentes, a demo, a galeria e os decks de texto/dados/arquitetura/arquivo foram para o `@pptsx/ds-base` (mesmos frames ±1 pt; XML da demo idêntico). Os exemplos do núcleo são só de primitivas; o guia do agente explica como um DS se liga.
- **Mudanças incompatíveis:** `examples/tokens.ts`, `examples/theme.ts`, `examples/layouts/` e `examples/components/` não existem mais no núcleo — use `@pptsx/ds-base` (ou o seu DS). A fonte Inter saiu do pacote do núcleo (era só exemplo). `ResolvedNode.component` é campo novo na árvore.

## 0.6.0 — M16: dívidas do motor e DX

- **`pptsx-mcp`**: servidor MCP (stdio) com `build`, `diagnose`, `preview`, `init`, `guide` (seções do guia do agente) e `schema` (props por primitiva, gerado dos tipos). SDK do MCP e `zod` são dependências opcionais; `exports['./mcp']`.
- **`pptsx preview <deck> --serve`**: preview ao vivo no browser (SVG dos slides, diagnósticos ao lado, clique destaca o nó, seletor de tamanho, debug), recarregado por SSE a cada vez que o deck é salvo (< 1 s).
- **`pptsx lint`**: props antigas com a troca, CSS sem de/para, `lineHeight` numérico alto (Keynote), `fr` solto em grid, cores fora do tema, erros de estrutura; `--fix` reescreve os aliases para CSS sem mudar os frames.
- `--watch` não vaza mais memória (o motor era recarregado a cada build: +12 MB por rebuild, agora só o código do usuário).
- Deck fora do cwd compila com o tsconfig da própria pasta.
- `css-not-emitted` também para rotação herdada em gráfico/tabela.
- `scripts/keynote-export.sh` com trava de máquina e novas tentativas.
- `npm audit` limpo (`overrides` do `image-size` do pptxgenjs).
- CI no GitHub Actions (typecheck, lint do repo, testes, build, teste do pacote, audit; PNGs da galeria como artefato).
- **Mudanças incompatíveis:** a árvore resolvida/posicionada (`includePositioned`, `resolveDeck`) não repete a geometria em `props` (tamanho, posição, flex, padding, raio, fundo do slide): leia de `css`. `containerOf`/`edgesOf` saíram de `core/defaults`.

## 0.5.0 — M15: arquivo e tema

- Tema do arquivo (`theme` na config): paleta e fontes no `theme1.xml`; cores do deck iguais às do tema saem como cores do tema (trocar `accent1` no PowerPoint repinta o deck).
- `defineLayout` + `placeholder`: layouts do arquivo com placeholders e conteúdo fixo no master.
- Seções (`Deck sections`), slide oculto (`hidden`), notas com formatação, propriedades do documento (`document`).

## 0.4.0 — M14: gráficos e tabelas 2

- 12 tipos de gráfico nativo (barra horizontal, empilhados, 100 %, área, rosca, dispersão, combo com eixo secundário), eixos, legenda e rótulos configuráveis.
- Tabela: células como objeto (merges, estilo, rich text, ícone), `cell()`, cabeçalho de dois níveis, `Table paginate`.

## 0.3.0 — M13: texto

- Pesos numéricos (faces 100–900), sobrescrito/subscrito, links (`href`, `slide:N`), `Text paginate`, `SlideNumber` e `Deck footer`, corpo e família por trecho.

## 0.2.0 — M12: diagramas

- 24 formas, `Box shape`, `Path` (SVG `d`), `Icon` vetorial, `Connector` com roteamento reto/cotovelo e rótulo.

## 0.1.0 — M6 a M11: a engine em CSS

- M11: props em CSS (flex, grid, margens, bordas por lado, sombra, opacidade, rotação, `zIndex`), `css-not-emitted` para o que não tem de/para; props antigas viram aliases.
- M10: gráficos e tabelas nativos.
- M9: props responsivas por breakpoint e `Box paginate`.
- M8: rich text (`Span`/`B`/`I`), `nowrap`, fontes registradas e embutidas, baseline.
- M7: pacote publicável, `pptsx init`, `--watch`, `lineBreaks: 'auto'`.
- M6: diagnósticos para agentes (causa, agrupamento, overview com selos) e o guia do agente.
