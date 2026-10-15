# Changelog

Escrito a partir dos commits de gate de cada marco (`docs/work/milestones/`). Versões antes da 1.0 podem quebrar a API; o que quebra está em **Mudanças incompatíveis**.

**Política para a 1.0:** as props antigas (aliases do M11: `direction`, `align`/`justify` de contêiner, `grow`, `shrink`, `fill`/`stroke`/`radius` do Box, `background` do Slide, `size`/`weight`/`italic`/`font`/`align` do Text, `fit` da Image) **saem na 1.0**. Desde a 0.6.0 o `pptsx lint` avisa cada uma e o `pptsx lint --fix` reescreve o deck. A 1.0 sai depois da validação do dono no PowerPoint (gráficos, tema, layouts, notas).

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
