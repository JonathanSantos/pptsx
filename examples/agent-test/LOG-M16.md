# LOG M16 — broken.tsx corrigido só pelo pptsx-mcp (agente sem shell)

## Chamadas

1. `guide` `{}` — índice das seções do AGENT_GUIDE (§1–§9 + Apêndice).
2. `diagnose` `{deck: broken.tsx, sizes: [16x9, 4x3]}` — 2 error (box-overflow slide 3, ambos tamanhos), 2 warning (text-word-broken slide 2), 8 info (text-shrunk slides 1 e 2).
3. `guide` `{section: "§8"}` — formato dos diagnósticos, tabela de códigos, overview e checklist.
4. `guide` `{section: "Apêndice"}` — tabela de migração props antigas → CSS (`direction`, `shrink`, `fill`, `radius`, `size`, `weight`).
5. `schema` `{primitive: "Text"}` — erro: "Primitiva \"Text\" não existe"; lista os nomes em minúsculas.
6. `schema` `{primitive: "text"}` — props do Text (CSS + aliases antigos + `fit`/`minSize`/`maxLines`/`nowrap`).
7. `diagnose` `{deck, sizes: [16x9, 4x3]}` — 0 error, 2 warning (text-word-broken "Planejamento" em 127 pt a 20 pt, slide 3), 3 info.
8. `diagnose` `{deck, sizes: [16x9, 4x3]}` — 0 error, 0 warning, 3 info.
9. `preview` `{deck, size: 16x9, slide: 2}` — 1 info; imagem mostrou "R$ 52,4 mi" e "1,28 mi" quebrando em 2–3 linhas nos cartões.
10. `preview` `{deck, size: 4x3, slide: 2}` — 1 info; valores numa linha só, unidades no label.
11. `build` `{deck, sizes: [16x9, 4x3], out: …/agent-m16-out}` — 0 error, 0 warning, 3 info; 2 .pptx, 2 overviews, 6 PNG por slide, diagnostics.json. (Uma tentativa anterior idêntica foi barrada pelo classificador de permissões do ambiente antes de executar; não chegou ao servidor.)

## Número de builds: 1

Nenhum diagnóstico de error/warning.

Restaram 3 `info` (`text-shrunk`): slide 1 em 16x9 (bullets 24 → 22 pt) e slide 2 em 16x9/4x3 (valor "99,95%" 32 → 24 pt).

## O que mudou no deck

- **Slide 1 — Prioridades do próximo trimestre:** os 4 bullets foram encurtados mantendo as 4 prioridades e os pontos principais (migração dos legados com relatórios regulatórios/painéis/integrações; corte de 30% do custo por consulta via nuvem e clusters; catálogo com dono, qualidade e linhagem; treinamento self-service com adoção semanal por área). `size` de 28 para `font.h2` (24). Antes encolhia para 17 pt em 16x9; agora 22 pt.
- **Slide 2 — Indicadores:** `KpiRow size="sm"` (o guia indica `sm` para 4+ cartões) e valores abreviados, com a unidade no label: "Receita (R$ mi)" 52,4; "Clientes (mi)" 1,28; "Uptime" 99,95%; "Resposta (ms)" 182; "Chamados" 3.412. Deltas e trends iguais. Assim somem as palavras partidas ("52.400.000,00"). Uma primeira tentativa com "R$ 52,4 mi" no valor passou sem warning, mas no preview quebrava em 3 linhas.
- **Slide 3 — Linha do tempo:** cartões com `width={200} shrink={0}` passaram a `flex={1}` (as 4 fases dividem os 640 pt), gap 24 → 12 e padding 16 → 10. Props antigas migradas para CSS (`display="flex"`, `backgroundColor`, `borderRadius`, `fontSize`, `fontWeight`). O nome da fase caiu de `font.h2` (24) para `font.body - 2` (18) para "Planejamento"/"Desligamento" caberem inteiros. `fit="error"` foi mantido.

## O que vi nos overviews

- Nenhum selo vermelho ou amarelo nos 3 slides dos dois tamanhos.
- Slide 1: 4 bullets de 2 linhas, legíveis; em 4:3 sobra espaço embaixo.
- Slide 2: 5 cartões numa linha. Valores grandes legíveis, mas labels e deltas ficam minúsculos na miniatura, e "Receita (R$ mi)" quebra em 2 linhas. Os cartões ocupam só o topo, com mais da metade do slide vazia (pior em 4:3).
- Slide 3: 4 cartões baixos no topo e o resto do slide vazio. Funciona, mas lembra pouco uma "linha do tempo" (sem setas). A receita §6.13 seria a reestruturação natural, fora do escopo de "zerar warnings".

## Lacunas do servidor/guia

1. `schema` diferencia maiúsculas: `{primitive: "Text"}` falha, embora no JSX seja `<Text>`; só aceita `text`. Deveria aceitar os dois ou ao menos dizer "use minúsculas".
2. `schema` lista os aliases antigos (`size`, `weight`, `shrink`, `grow`, `align`, `font`, `italic`) lado a lado com as props CSS, sem marcá-los como obsoletos; o Apêndice diz que vão sair. Os tipos vêm como strings TypeScript (`"ResponsiveValue<…>"`, `CssLengthInput`), não como JSON Schema de verdade.
3. A mensagem de `text-word-broken` sempre sugere `abrevie, ex.: "R$ 52,4 mi"`, mesmo quando a palavra é "Planejamento". O exemplo é fixo e não tem relação com o caso.
4. A mensagem de `box-overflow` fala em `flexShrink={0}`, mas o deck usava o alias `shrink={0}`. Dá para entender, mas não cita a prop que está no código.
5. Os diagnósticos não pegam texto que quebra feio sem partir palavra (valor "R$ 52,4 mi" em 3 linhas num cartão de KPI): sai 0 warning e só o `preview` mostra o problema. Também não há aviso de área muito vazia (slides 2 e 3 em 4:3).
6. `diagnose` devolve `isError: true` quando há diagnósticos `error`, mas o resultado é válido. Um agente pode confundir com falha da ferramenta.
7. Escalar para 5 cartões não tem receita própria no guia: a §6.2 cobre 3 colunas; a dica `size="sm"` está só na tabela da §8 e na doc do componente.
