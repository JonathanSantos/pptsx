# LOG M9 — deck responsivo escrito só com `docs/AGENT_GUIDE.md`

Deck: `examples/agent-test/m9-deck.tsx` (4 slides do autor: capa, KPIs, duas colunas, plano de ação com 12 itens).
Comando: `npx tsx src/cli.ts build examples/agent-test/m9-deck.tsx --size 16x9,4x3,wide --out …/scratchpad/m9f/dist`.
Fontes consultadas: só o guia; dos exemplos, usei `tokens`, `layouts` e `components` como caixas-pretas (sem abrir o código). Listei `examples/assets/` para escolher a imagem (o guia cita `../assets/chart.png`).

## Resultado

**3 builds.** O 1º já saiu com exit 0 e sem error/warning; os builds 2 e 3 foram só de aparência (overview).

| requisito | onde no deck |
|---|---|
| props responsivas (≥ 3 props diferentes) | `size` (Bullets, Text, KpiRow), `gap` (Bullets, Box do slide de KPIs), `direction` (TwoColumn) |
| sem ternário/`if` sobre `ctx` | `grep -E 'ctx\.(aspect\|scale\|name)\|\?'` não encontra nada; `ctx` só vai para `CoverLayout ctx={ctx}` e para `ctx.pick` |
| `ctx.pick` | subtítulo da capa (texto mais longo em `wide`), quantidade de KPIs (`kpis.slice(0, ctx.pick({ base: 3, wide: 4 }))`), título do slide da lista |
| lista longa paginada | `Bullets paginate` com 12 itens de 1–2 linhas → 2 slides em 16x9 (6+6), 4x3 (7+5) e wide (7+5) |
| duas colunas que empilham em 4:3 | `TwoColumn direction={{ base: 'row', tall: 'column' }}` (bullets + `chart.png`) |

## Builds

### Build 1 — exit 0
Diagnósticos (3 info, 0 warning, 0 error):
- `slide-continued` · 16x9 · `ContentLayout > Box[1] > Bullets` · 4º slide virou 2 (6 + 6 itens).
- `slide-continued` · 4x3 · mesmo path · virou 2 (**9 + 3**).
- `slide-continued` · wide · mesmo path · virou 2 (**10 + 2**).

Overview:
- 4x3 e wide: a 2ª parte da lista ficou com 3 e 2 itens e o slide quase vazio (parte "órfã").
- Slide de KPIs: em todos os tamanhos, cartões pequenos no meio de muito espaço vazio (só a `KpiRow` no `ContentLayout justify="center"`).

Correção:
- Lista: `size` e `gap` responsivos no `Bullets` (`size={{ base: 20, tall: 22, wide: 26 }}`, `gap={{ base: 14, tall: 22, wide: 22 }}`) para usar a altura extra do 4:3/wide e equilibrar as partes. O guia não diz como equilibrar; foi tentativa (ver lacunas).
- KPIs: envolvi `KpiRow` + um `Text` de conclusão num `Box` com `gap={{ base: 20, tall: 40 }}` (sem `grow`, para o `justify="center"` continuar valendo, como manda a §9).

### Build 2 — exit 0
Diagnósticos: os mesmos 3 `slide-continued` (info), agora 16x9 6+6, 4x3 **7+5**, wide **7+5**.
Overview: partes equilibradas; slide de KPIs mais cheio. No wide, o espaço entre os cartões e a frase ficou com o `gap` base (20), um pouco apertado em relação ao slide maior.
Correção: `gap={{ base: 20, tall: 40, wide: 30 }}` no Box dos KPIs.

### Build 3 — exit 0 (final)
Diagnósticos: iguais ao build 2 (3 `slide-continued` info). Overview dos 3 tamanhos conferido: nenhum selo, nenhum texto cortado; 4:3 empilha bullets em cima e gráfico embaixo; wide mostra 4 KPIs e o subtítulo longo da capa. `tsc --noEmit` sem erro no arquivo.

## `diagnostics.json` final (resumo)

| size | slide | severity | code | path | resumo |
|---|---|---|---|---|---|
| 16x9 | 4 | info | slide-continued | `ContentLayout > Box[1] > Bullets` | 2 partes: 6 + 6 itens (`data.parts: 2`, `sourceSlide: 4`) |
| 4x3 | 4 | info | slide-continued | idem | 2 partes: 7 + 5 |
| wide | 4 | info | slide-continued | idem | 2 partes: 7 + 5 |

0 error, 0 warning em todos os tamanhos.

## O que o guia explicou bem

- **§2 "Breakpoints"**: a tabela `tall`/`wide`/nome exato com ✓ por preset e a precedência resolveram tudo de primeira. Saber que `wide` **não** é `tall` e que 4:3 tem a mesma largura que 16:9 guiou as escolhas (empilhar em `tall`, tipografia maior em `wide`).
- **`ctx.pick`** com exemplos concretos (quantidade de itens e texto alternativo): usei os dois casos sem dúvida.
- **"Aceitam valor responsivo"** na §5: lista exata de quais props dos componentes aceitam (`Bullets.size/gap`, `TwoColumn.direction`, `KpiRow.size`). Evitou tentar `ratio` responsivo.
- **Receita 6.2** (TwoColumn que empilha) funcionou copiando e colando.
- **§3 "Paginação"** + receita 6.7: `paginate` no `Bullets` é uma prop, sem precisar montar o Box; a mensagem do `slide-continued` traz a contagem por parte, o que permite avaliar o equilíbrio sem abrir o PNG.
- **§9 "`grow={1}` num filho anula o `justify`"**: me fez não pôr `grow` no Box que envolve os KPIs.

## O que faltou ou confundiu

1. **Equilíbrio entre as partes da paginação** (§3 "Paginação" / §6.7). O guia diz como a lista é dividida (a 1ª parte leva o que cabe), mas não avisa que isso pode deixar uma última parte com 2–3 itens (aconteceu: 10+2 no wide, 9+3 no 4x3), nem como corrigir. A mensagem do `slide-continued` só sugere "reduza o size para caber em menos slides" — o caminho oposto. Tive que deduzir que `size`/`gap` responsivos maiores em `tall`/`wide` redistribuem os itens.
2. **Números da receita 6.7 parecem regra geral** (§6.7). "Em 16:9 vira 3 slides (4 itens cada), em 4:3 vira 2 (6 cada)" é específico dos itens do `long-list.tsx` (que eu não pude ver); com 12 itens de 1–2 linhas obtive 6+6 em 16x9. Sem dizer o comprimento dos itens, o leitor cria uma expectativa errada.
3. **Tipagem de dados de componente fora do JSX** (§5, `KpiRow`). Os exemplos passam `items` inline; ao declarar o array numa `const` separada, `trend: 'up'` vira `string` e pode não bater com `'up' | 'down'`. Usei `as const` por precaução; o guia não diz se `KpiCardProps` é exportado de `'../components/index.ts'` (ele aparece como tipo na tabela de `KpiRow`, mas sem import).
4. **Comando da CLI** (§7). O guia usa `node bin/pptsx.mjs build …`; a tarefa usa `npx tsx src/cli.ts build …`. Os dois parecem equivalentes, mas o guia não menciona o segundo nem diz se são iguais. Também o checklist (§8 passo 1) e §7 dizem "gere os dois tamanhos `16x9,4x3`" e não citam `wide`, que tem breakpoint próprio e mudou o resultado (4 KPIs, subtítulo longo, outra paginação).
5. **`KpiCard size="lg"` com 4 cartões** (§5, tabela de tamanhos). A tabela diz `lg` = "3 cartões com área sobrando (wide, 4:3)". Com `ctx.pick` mostrando 4 cartões no wide, não fica claro se `lg` ainda serve (serviu, sem diagnóstico). Uma linha sobre largura útil no wide (corpo 880 pt) ajudaria a decidir sem build.
6. **Image empilhada fica pequena em 4:3** (§6.2). Na coluna empilhada, o gráfico ocupou só ~⅓ da largura (limitado pela altura que sobra). O texto da receita explica isso, mas não sugere o que fazer se o autor quiser a imagem maior (ex.: menos bullets em `tall` via `ctx.pick`, ou `size` menor dos bullets em `tall`).

## Sugestões de texto para o guia

- **§3 "Paginação", novo item:**
  > - **Partes desequilibradas:** a divisão é gulosa (cada parte leva o máximo que cabe), então 12 itens podem virar 10 + 2. Para equilibrar, aumente `size`/`gap` dos itens no breakpoint que sobrou espaço (`size={{ base: 20, tall: 22, wide: 26 }}`, `gap={{ base: 14, tall: 22, wide: 22 }}`) e confira a contagem no `slide-continued` ("7 de 12 itens no 1º, 5 no 2º"). Se tudo couber num slide em algum tamanho, também é aceitável: só 16:9 precisa paginar.
- **Mensagem do `slide-continued`** (§8, tabela de códigos, coluna "correção típica"): acrescentar "Última parte com poucos itens: aumente `size`/`gap` (responsivo) para redistribuir."
- **§6.7**, trocar a frase dos números por:
  > Com os 12 itens de `examples/long-list.tsx` (2 linhas cada), 16:9 vira 3 slides de 4 itens e 4:3 vira 2 de 6; itens de 1 linha cabem mais por parte. Leia `data.parts` e a mensagem do `slide-continued` para saber a divisão real.
- **§5, abaixo da tabela de componentes:**
  > Tipos das props são exportados de `'../components/index.ts'` (`KpiCardProps`, …). Para declarar dados fora do JSX: `const kpis: readonly KpiCardProps[] = [...]` (ou `as const` nos literais `trend`/`sentiment`).
  (Ajustar conforme o que realmente é exportado.)
- **§7 (a)**: "`npx tsx src/cli.ts build …` é equivalente a `node bin/pptsx.mjs build …`." e, no §8 checklist passo 1: "`--size 16x9,4x3` (mais `wide` se o deck usa o breakpoint `wide` ou `ctx.pick` com `wide`)".
- **§5, tabela de tamanhos do `KpiCard`**: "Larguras do corpo com `ContentLayout`: 640 pt em 16:9 e 4:3, 880 pt em wide (4 cartões `lg` cabem)."
