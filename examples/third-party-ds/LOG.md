# LOG M17 — DS de terceiro só com o guia do ds-kit

Única documentação lida: `packages/ds-kit/README.md`. Nada de `packages/*/src`, `docs/`, `ds-base`.

## Arquivos criados (todos em `examples/third-party-ds/`)

- `tsconfig.json` — copiado do README (§Montagem) + `include`.
- `tokens.ts` — `defineTokens` (cores ink/paper/aurora/glow/violet/mist/up/down; fontes hero/title/stat/body/small; espaços page/gap/inner), `theme` com `themeOf`, `themeWarnings = checkTheme(theme)`.
- `components.tsx` — `Hero` (tone night|day, `fill: true` no catálogo), `StatCard` (label, value, delta opcional; tone neutral|brand|accent; size md|lg responsivo), `Quote` (text, author; tone brand|accent; slot `avatar`). Todos com `createVariants` e `meta.catalog` (2, 3 e 3 casos).
- `rules.ts` — `colorsFromTokens('aurora-ds/cores', tokens)` e `defineRule('aurora-ds/hero-so-na-capa', 'error', …)` (Hero fora do slide 1).
- `ds.ts` — `createDs` (name `aurora-ds`, 3 componentes, tema, regras, guia com uma seção por componente), export default.
- `pptsx.config.ts` — `defineConfig({ ds: [ds], theme })`.
- `deck.tsx` — 4 slides: Hero / 3 StatCards / Quote / encerramento.
- `fixtures/Hero.json`, `fixtures/StatCard.json`, `fixtures/Quote.json` — gravadas pelo catálogo.

Contraste: a primeira paleta tinha accent1 `#2EC4B6`; `checkTheme` avisou "2.17:1, abaixo do WCAG AA (3:1)". Troquei accent1 por `#0E7C73` e mantive `#2EC4B6` como `glow` (decorativo, accent5). Depois `checkTheme` → `[]`.

## Builds: 2

Rodados de dentro de `examples/third-party-ds/` (o README diz que a config é lida da pasta de onde roda): `node ../../packages/pptsx/bin/pptsx.mjs build deck.tsx --size 16x9,4x3 --out …/scratchpad/agent-m17 --json`.

| # | exit | diagnósticos |
|---|------|--------------|
| 1 | 1 | Nenhum diagnóstico — erro fatal: `deck.tsx precisa exportar default defineDeck(...)` (eu exportava `<Deck>` direto; o README não diz como o deck é exportado). Corrigido para `export default defineDeck(() => (<Deck>…</Deck>))`. |
| 2 | 0 | Nenhum diagnóstico (`"diagnostics": []`). |

Antes do build 2, o `pptsx lint` apontou 3 `info` `off-theme-color` (glow, up, down fora do tema); resolvi pondo-os em accent3/4/5 do tema.

Depois do build 2 (sem build restante), mudei dois componentes por causa do que vi nos PNGs/catálogo (ver abaixo): `StatCard` `flex={1}` → `flexGrow={1}` e a barra do `Quote` virou uma `Box`. O deck com essas mudanças foi conferido por `tsc` e `pptsx lint` (nada a apontar) e os componentes pelo catálogo, mas **não** por um terceiro build.

## Catálogo

- Gravação: `catálogo de aurora-ds: 3 componentes, 16 renderizações.` exit 0 — PNG por caso × 16x9/4x3, `Hero/StatCard/Quote.overview.png`, `fixtures/*.json`.
- `--check`: `catálogo de aurora-ds: 16 renderizações batem com as fixtures.` exit 0.
- Na 1ª gravação o StatCard (com `flex={1}`, sem `fill`) saiu **achatado**: a caixa com ~24 pt de altura e os textos sobrepostos. O README diz que sem `fill` o componente fica no tamanho natural e "um `flex={1}` não estica" — mas na prática ele *encolhe*. Com `flexGrow={1}` o card ficou certo; regravei e o `--check` passou.

## Lint

- Deck (rodando em `examples/third-party-ds/`): `Lint: nada a apontar.` exit 0.
- Cópia errada temporária (`deck-errado.tsx`, Hero no slide 4 + `color="#FF00AA"`), apagada depois:
  - `✖ [slide 4] aurora-ds/hero-so-na-capa em Slide > Hero — Hero só no slide 1 (encontrado no slide 4).`
  - `▲ [slide 4] aurora-ds/cores em Slide > Text[0] — Cor fora dos tokens: #FF00AA.`
  - `• [slide 4] off-theme-color` (regra do núcleo). Exit 1.
- A mesma cópia errada linteada **da raiz do repo**: `Lint: nada a apontar.`, exit 0 — a config não é encontrada e as regras do DS somem em silêncio (nem o Hero fora do slide 1 aparece).

## MCP

`npx tsx packages/pptsx/tools/mcp/call.ts guide '{"source":"aurora-ds"}' … --ds ./examples/third-party-ds/ds.ts` → `isError: false`, lista as seções `Hero`, `StatCard`, `Quote`, mas com o cabeçalho **"Seções do docs/AGENT_GUIDE.md"** (rótulo do guia do núcleo, não do aurora-ds). `guide({source, section: "StatCard"})` devolve o markdown da seção certo. `schema({ source: 'aurora-ds' })` → `isError: true`, "O DS "aurora-ds" não registrou schema."

## O que vi nos PNGs

- Build 2, 16x9 e 4x3: slide 1 Hero escuro com barra glow, título e subtítulo brancos, bem legível; slide 2 três StatCards (dois mist, NPS em aurora), delta verde/vermelho; slide 3 citação itálica com autor em violeta; slide 4 fundo mist, "Obrigado", texto e barra.
- Problemas: (a) a barra lateral do Quote (`borderLeftWidth`/`borderLeftColor`) **não aparece** — sem erro de tipo nem diagnóstico; corrigido depois com uma `Box` de 6 pt (visto no catálogo). (b) "R$ 52,4 mi" quebra em duas linhas no card de 16x9 e 4x3 (largura do card; aceitável, mas um caso de catálogo mais largo não pegaria isso). (c) A variante responsiva `size={{ base: 'md', tall: 'lg' }}` não mostrou diferença visível no 4x3 (não sei se `tall` vale para 4x3 — o README não define os breakpoints). (d) texto `small` (13 pt) do label fica bem pequeno no overview, ok no PNG de slide.
- Catálogo: Hero preenche o slide (fill), Quote com barra e avatar (slot) corretos, StatCard em tamanho natural depois do ajuste.

## Lacunas do guia do ds-kit

1. **Como o deck é exportado** não aparece: o build exige `export default defineDeck(...)`; descobri pelo erro do build 1. Também falta a assinatura (aceitei `defineDeck(() => <Deck>…)` porque o `tsc` passou).
2. **Props de `Deck`/`Slide`/`Box`/`Text`** não são listadas (usei `backgroundColor`, `padding`, `gap`, `justifyContent`, `fontStyle` por chute + `tsc`). `borderLeftWidth/Color` passa no tipo (props de variantes parecem não tipadas) mas é ignorado no render, sem diagnóstico.
3. **`flex={1}` em componente sem `fill` encolhe** no catálogo (altura colapsa e textos se sobrepõem), contrariando "um `flex={1}` não estica". O guia deveria dizer: use `flexGrow` para dividir uma linha, ou marque `fill`.
4. **Config depende do cwd**: da raiz, `pptsx lint`/`build` ignoram `pptsx.config.ts` em silêncio — regras do DS somem e um deck errado sai "nada a apontar". O §5 diz "rode na pasta da config", mas o comando do Deck no mesmo §5 roda da raiz; falta uma flag `--config` documentada (ou um aviso).
5. **Schema no manifesto**: o README cita `schemaOf(...)` e `schema({ source })` no MCP, mas não diz como ligar o schema no `createDs` (qual campo; caminho relativo a quê). Resultado: `schema` retorna erro.
6. **MCP `guide` com rótulo errado**: lista as seções do DS sob "Seções do docs/AGENT_GUIDE.md".
7. **`checkTheme`** só avisou do accent1; accent5 `#2EC4B6` (2,17:1 sobre branco) passou sem aviso. Não está claro quais slots são verificados, nem os nomes de slot válidos (usei accent3–5 por chute).
8. **Breakpoints responsivos** (`base`, `tall`, …) não são definidos no README.
9. **Mensagem de `defineRule`** — o README não diz se `path` aparece sozinho ou se o retorno aceita outros campos (`severity` por diagnóstico, sugestão); funcionou só com `message`.
10. Scripts `tsx` fora de pasta com `"type": "module"` quebram com top-level await do yoga (detalhe de ambiente; só afetou meu script de conferência no scratchpad).
