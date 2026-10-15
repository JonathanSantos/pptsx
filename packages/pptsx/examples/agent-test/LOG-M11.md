# LOG M11-H — agente virgem com o guia CSS

Deck: `examples/agent-test/m11-deck.tsx` (4 slides do autor → 5 no 16:9 por paginação, 4 no 4:3).
Única documentação lida: `docs/AGENT_GUIDE.md` (mais `examples/tokens.ts`, só para confirmar os valores que a §5 já lista; nenhum componente/layout foi usado — tudo em primitivas, para não depender de props de componente chamadas `size`/`justify`).

Comando: `npx tsx src/cli.ts build examples/agent-test/m11-deck.tsx --size 16x9,4x3 --out <scratchpad>/m11h/dist --json`

## Requisitos cobertos

| requisito | onde |
|---|---|
| `display="grid"` 3 col → 2 em 4:3 (valor responsivo) | slide 2: `gridTemplateColumns={{ base: 'repeat(3, minmax(0, 1fr))', tall: 'repeat(2, minmax(0, 1fr))' }}` |
| `boxShadow` / `borderTop` nos cartões | slide 2: os dois (`borderTop` colorido por tom + `boxShadow`) |
| herança de fonte e cor | `fontFamily="Arial"` e `color` em cada `Slide`; cartões definem `fontSize={12} color={muted}` no `Box`; os `Text` só trocam o que muda |
| `marginTop="auto"` no rodapé + margem por lado | rodapé dos slides 2–4; `marginBottom` (capa), `marginRight={120}` (tags), `marginLeft={20}` (subtítulo do slide 4), `marginTop` numérico nos cartões |
| `flexWrap="wrap"` + `zIndex` negativo | capa: 8 pílulas em wrap; elipse `position="absolute" zIndex={-1}` |
| lista longa paginada / Table | slide 3: 12 itens em `<Box paginate>`; slide 4: `<Table>` nativa |
| sem props antigas e sem ternário sobre `ctx` | conferido por grep; `ctx` só aparece em `{ctx.name}` dentro de um `Text` |

## Builds: 3

### Build 1 — exit 0

| tamanho | sev | code | path | mensagem (resumo) |
|---|---|---|---|---|
| 16x9 | warning | `css-not-emitted` | `Slide > Box > Box[0..5]` (×6) | `borderRadius: 10` não sai: com bordas diferentes por lado, as linhas saem retas (o fundo continua arredondado) |
| 4x3 | warning | `css-not-emitted` | `Slide > Box > Box[0..5]` (×6) | idem |
| 16x9 | info | `slide-continued` | `Slide > Box` | slide 3 virou 2 slides, **8 de 12 no 1º, 4 no 2º** |

Overview: tudo legível, sem selo vermelho; selo amarelo no slide 2 dos dois tamanhos. Partes desequilibradas no 16:9 (8 + 4). No 4:3 os 12 itens couberam num slide só (sem `slide-continued`). Cartões de KPI ocupavam só ~60% da altura no 16:9, com faixa vazia abaixo.

Correções:
- Tirei `borderRadius` dos cartões (mantive `borderTop` + `boxShadow`). O guia não avisa que `borderRadius` + borda só num lado não é emitido (ver lacuna 1).
- Paginação: `gap={{ base: 16, tall: 10 }}` e `fontSize={{ base: 20, tall: 18 }}` no Box paginado — exatamente a dica da §3 "Partes desequilibradas".
- Grid com `flex={1}` + `gridAutoRows="minmax(0, 1fr)"` e `justifyContent="center"` nos cartões, para ocupar a altura do slide.

### Build 2 — exit 0

| tamanho | sev | code | path | mensagem |
|---|---|---|---|---|
| 16x9 | info | `slide-continued` | `Slide > Box` | 2 slides, **6 de 12 no 1º, 6 no 2º** |

Overview limpo nos dois tamanhos. Ajustes só estéticos: valor do KPI pequeno demais para o cartão alto do 4:3; tabela do slide 4 deixava meio slide vazio.

Correções: valor do KPI `fontSize={{ base: 28, tall: 34 }}`; tabela `fontSize={{ base: 16, tall: 18 }}` + `cellPadding={6}`.

### Build 3 — exit 0 (final)

Mesmo único diagnóstico (info `slide-continued`, 6 + 6). Overview conferido nos dois tamanhos (e PNGs individuais dos slides 1, 2 e 5 do 16:9 e 2 do 4:3): capa com elipse atrás do título e pílulas em duas linhas, grid 3×2 / 2×3 preenchendo o slide, lista 6+6 no 16:9 e 12 num slide no 4:3, tabela legível; rodapé sempre no fim.

## `diagnostics.json` final (resumo)

```json
[
  { "size": "16x9", "slide": 3, "severity": "info", "code": "slide-continued", "path": "Slide > Box",
    "message": "Slide 3 do autor virou 2 slides (6 de 12 itens no 1º, 6 no 2º)…", "data": { "parts": 2, "sourceSlide": 3 } }
]
```

0 error, 0 warning, 1 info. 4x3: nenhum diagnóstico.

## O que o guia explicou bem

- **§1/§3 "A regra que mais importa"** (`Box` sem display = coluna, `display="flex"` = row): acertei a estrutura de primeira.
- **Receitas 6.2, 6.4, 6.5, 6.6** praticamente cobrem a tarefa: grid responsivo com `minmax(0, 1fr)`, pílulas em wrap, rodapé com `marginTop="auto"`, decoração com `zIndex={-1}`. Copiar e adaptar funcionou sem erro de estrutura.
- **Herança** (§2): curta e clara; definir `color`/`fontSize` no `Box` do cartão e só sobrescrever no valor funcionou como descrito.
- **Paginação** (§3): a dica de partes desequilibradas ("aumente `fontSize`/`gap` no breakpoint em que sobrou espaço" + ler a contagem na mensagem) resolveu 8+4 → 6+6 numa iteração.
- **Valores responsivos** (§2 Breakpoints): tabela de chaves + precedência sem ambiguidade; `tall` foi o que precisei.
- A mensagem do `css-not-emitted` é autoexplicativa (diz por que não sai e o que acontece no PPTX).

## O que faltou ou confundiu

1. **`borderRadius` + borda só num lado** (`borderTop`) gera `css-not-emitted` — não está no guia. A tabela da §8 lista "raio por canto", mas não "raio com bordas diferentes por lado"; a §3 (linha "Caixa") e a receita 6.2 (que tem `borderRadius={10}` e sugere `boxShadow`) não avisam que trocar para `borderTop` quebra. Como a tarefa pede "`boxShadow` ou `borderTop`", é a combinação mais provável de um agente tentar. Deveria estar em §3 (Caixa/Pintura), na lista do `css-not-emitted` (§8) e em §9.
2. **Grid ocupando a altura do slide.** O guia diz "Linhas `auto` por padrão" (6.2) e mostra `gridTemplateRows` com `minmax(0, 1fr)` só em 6.3 (número fixo de linhas). Para N cartões com quantidade de linhas variável por breakpoint (2 linhas em 16:9, 3 em 4:3), não diz que `gridAutoRows="minmax(0, 1fr)"` + `flex={1}` funciona; usei por analogia com CSS. Deveria estar em §3 "Regras de flex e grid" ("Grid que ocupa o resto: `flex={1}` + `gridAutoRows="minmax(0, 1fr)"`").
3. **Escopo do "sem props antigas" vs. props de componente/primitiva com o mesmo nome.** `Bullets.size`, `KpiCard.size`, `ContentLayout.justify`, `Chart.size`, `Shape.radius/stroke`, `Table.header.fill` são APIs **atuais** (§3/§5), mas têm o mesmo nome das props antigas do apêndice. O §9 ("Props antigas … vão sair") não deixa claro que essas continuam válidas; evitei os componentes prontos por isso. Deveria estar no topo do Apêndice: "Estas props de componente/primitiva **não** são aliases e continuam: …".
4. **Paginação + `flex={1}` no Box paginado + rodapé `marginTop="auto"`**: o guia não diz se o `Box paginate` deve ter `flex={1}` para a engine saber a altura disponível, nem se o rodapé fixo depois dele entra no clone. Funcionou (rodapé repetido nas duas partes), mas foi tentativa. Deveria estar em §3 "Paginação" com um exemplo de primitivas (o único exemplo, 6.7, usa `Bullets paginate` dentro de `ContentLayout`).
5. **Onde fica o rodapé quando há `marginTop="auto"` em dois lugares** (capa: título empurrado + rodapé): o guia não diz como dois `auto` dividem a sobra (CSS: igualmente). Menor; em §3 "Regras de flex" uma linha bastaria.
6. **`fontFamily="Arial"` explícito**: como Arial é o padrão, ficou ambíguo se repetir no Slide é necessário/recomendado para "herança de fonte". Menor.

## Sugestões de texto

- §3, tabela "Caixa", nota: «`borderRadius` só sai com borda **igual** nos quatro lados (ou sem borda). Com `borderTop`/`borderLeft` isolado, o fundo sai arredondado mas a linha sai reta → `css-not-emitted`. Cartão com faixa colorida: `borderTop` **sem** `borderRadius`, ou `borderRadius` + `boxShadow` sem borda lateral.»
- §8, linha `css-not-emitted`, acrescentar à lista: «raio com bordas diferentes por lado».
- §6.2, depois de "Linhas `auto` por padrão": «Para os cartões ocuparem a altura que sobra: `flex={1}` no grid + `gridAutoRows="minmax(0, 1fr)"` (linhas iguais, qualquer quantidade), e `justifyContent="center"` no cartão.»
- Apêndice, primeira linha: «Não são aliases (continuam válidas): `size` de `Bullets`/`KpiCard`/`KpiRow`/`Chart`, `justify` de `ContentLayout`, `radius`/`stroke`/`strokeWidth` de `Shape`, `fill` em `Table.header`, `fit` de `Text`.»
- §3 "Paginação", exemplo mínimo com primitivas: `<Slide …><Text>Título</Text><Box paginate flex={1} gap={…}>{itens}</Box><Text marginTop="auto">Rodapé</Text></Slide>` + «Título e rodapé (irmãos do Box) se repetem em cada parte.»
