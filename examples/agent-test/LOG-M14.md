# LOG M14 — dashboard com empilhado e tabela por valor (agente sem contexto, só `docs/AGENT_GUIDE.md`)

Deck `examples/agent-test/m14-dashboard.tsx`, da empresa fictícia "Cafés Serra Alta", só com primitivas importadas de `'pptsx'` (sem tokens, layouts nem componentes de `examples/`):

1. **Capa**: fundo azul-marinho, elipse decorativa absoluta com `zIndex={-1}` dimensionada por `ctx.height`, faixa laranja na base, sobretítulo em caixa alta com `letterSpacing`, título e subtítulo.
2. **Dashboard**: grid de 2 colunas `minmax(0, 1fr)` (1 coluna em `tall`) com um `Chart kind="stackedBar"` (3 canais × 4 trimestres, legenda no topo, rótulos no centro, eixo Y com título) ao lado de uma `Table` nativa de 5 produtos. A coluna Δ % recebe **números** nas linhas (`21.8`, `-14.6`…) e uma função `cell()` formata com vírgula e sinal e pinta vermelho (fundo `#FEE2E2`) para negativo e verde (fundo `#DCFCE7`) para positivo.
3. **Tabela com cabeçalho de dois níveis**: `headerRows` com "Região" (`rowSpan: 2`) e "2025"/"2026" (`colSpan: 3`), subtítulos Lojas/Online/Parceiros em `columns`, zebra, linha de total em negrito com `children: <B>…</B>`.

## Comando

```
cd /Users/jovivo/Developer/projects/pptsx && npx tsx src/cli.ts build examples/agent-test/m14-dashboard.tsx --size 16x9,4x3 --out /private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/ad2b33e4-6b93-4d16-8522-0b9d8affb288/scratchpad/agent-m14 --json
```

(No build 2 o JSON passou por `grep` antes do `echo`; o exit mostrado é o do `tsx`, lido com `${pipestatus[1]}` do zsh.) Também rodei `npm run typecheck` (o `tsconfig` inclui `examples/`): sem erro, então `TableCellContext`/`TableCellSpec` são de fato exportados de `'pptsx'`.

## Número de builds: 2

### Build 1 — exit 0

Nenhum diagnóstico.

Os PNGs mostraram dois problemas que não geram diagnóstico:
- No empilhado, a série "Lojas" (`#14213D`, quase a cor do texto) tinha rótulos de valor em `#1B2A4A` (herdados do `color` do Slide): os números 14/15/16/18 ficavam **invisíveis** dentro das barras, nos dois tamanhos.
- Slide 3 com tabela pequena (13 pt) e quase metade do slide vazia.

Alterações: cor de "Lojas" trocada para `#9DB4E6` (azul claro, rótulo escuro legível); tabela do slide 3 com `fontSize={{ base: 15, tall: 17 }}` e `cellPadding={6}`; elipse da capa um pouco mais deslocada para fora (`-0.4 × altura`) para encostar menos no título.

### Build 2 — exit 0

Nenhum diagnóstico.

## O que vi nos PNGs

**16x9**
- Capa: título "Dashboard de vendas 2026" branco, sobretítulo laranja, subtítulo cinza-azulado, centralizados na vertical; a elipse escura no canto superior direito ainda alcança levemente a área à direita do título, sem cobrir texto (está atrás). Faixa laranja na base. Sem defeitos.
- Dashboard: gráfico à esquerda (legenda no topo, eixo 0–40, título "R$ mi" vertical, barras empilhadas com rótulos 14/7/4 … 18/13/6 legíveis); tabela à direita com cabeçalho azul-marinho, zebra e Δ % colorido: +21,8 %, +11,3 %, +24,3 % em verde com fundo verde-claro; −14,6 % e −5,9 % em vermelho com fundo rosa. A tabela fica centralizada na vertical com ~1/4 da altura vazia abaixo dela (aceitável). O rótulo escuro sobre a série "Online" (`#2F6FED`) tem contraste apenas razoável.
- Tabela de dois níveis: cabeçalho mesclado correto ("Região" ocupando as duas linhas, "2025" e "2026" sobre 3 colunas cada), números alinhados à direita, total em negrito. Ocupa ~45 % da altura; o resto até o rodapé fica vazio (defeito estético leve: slide com área ociosa).

**4x3**
- Capa: igual, com mais respiro vertical; título não quebra.
- Dashboard: empilhou (gráfico em cima, tabela embaixo), como pedido pelo breakpoint `tall`. A tabela ocupa a largura toda; como as colunas sem `width` seguem o conteúdo, "Produto" ficou muito larga e "Δ %" larga com os valores colados à direita — legível, mas desequilibrado.
- Tabela de dois níveis: 17 pt, bem legível; ainda sobra ~40 % do slide vazio abaixo da tabela.

Nenhum texto cortado, sobreposto ou fora do slide em nenhum tamanho.

## Lacunas do guia

1. **§3 "Gráficos" / §2 "Herança"**: não há como definir a cor dos rótulos de dados (`labels`) de um `Chart`; o guia só diz que o Chart herda família e cor. Consequência: com uma série escura e o `color` do Slide escuro, os rótulos `position: 'center'` ficam invisíveis, sem diagnóstico. Faltou um aviso (em §9) ou uma prop (`labels.color`, ou cor de rótulo por série).
2. **§6.17**: a receita usa os tipos `TableCellContext` e `TableCellSpec` mas não mostra o import nem diz de onde vêm (descobri que `import type { … } from 'pptsx'` funciona só porque o typecheck passou). A §6 lista os imports extras de `'pptsx'` e não cita esses tipos.
3. **§3 "Tabelas"**: não diz se o `align` da coluna vale também para a célula de cabeçalho (vale: "2025", "Δ %" saíram alinhados à direita) nem como alinhar o cabeçalho diferente dos dados sem `headerRows`.
4. **§3 "Por primitiva" / `Table`**: não há forma documentada de a tabela ocupar a altura disponível (linhas esticando) — a altura é sempre a soma das linhas, o que deixa slides de tabela curta com muito espaço vazio; o guia não sugere o que fazer (aumentar `fontSize`/`cellPadding` por breakpoint foi o que usei).
5. **§3 `Table` `rows`**: não diz se aceita arrays `readonly` (tuplas tipadas); converti com `[...p]` por precaução.
6. **§7 / §8**: o guia diz que o exit code é o do último programa num pipe, mas não lembra que no zsh `${pipestatus[1]}` recupera o do build — detalhe menor.
