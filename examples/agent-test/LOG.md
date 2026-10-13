# Diário — teste do agente com tsx-slides

Fonte única de documentação: `docs/AGENT_GUIDE.md`. Comandos rodados na raiz do projeto.

---

## Tarefa 1 — `roadmap.tsx` (novo)

Comando (todas as iterações):
`node bin/tsx-slides.mjs build examples/agent-test/roadmap.tsx --size 16x9,4x3 --out dist/agent-test/roadmap --json`

### Iteração 1 — exit 0
- Estrutura: `ContentLayout` + row de 4 `PhaseColumn` (pílula Q1–Q4 + conector `Shape rect` + cartão com título e itens); slide 2 com `ContentLayout` + Box com `direction={ctx.aspect < 1.5 ? 'column' : 'row'}` e dois `CompareCard`.
- Diagnósticos: só `text-shrunk` (info), 14 deles, todos em 4x3, slide 2, `ContentLayout > Box[1] > Box > CompareCard[0|1] > …` (24→23, 11→10, 18→17).
- Entendimento: no 4x3 empilhado faltou um pouco de altura; *todos* os Text de *ambos* os CompareCard encolheram juntos (inclusive o caption de 11 pt, que cabia), o que confere com "textos do mesmo componente encolhem juntos" — mas o guia não deixa claro que isso vale entre **instâncias diferentes** do componente.
- Visual: 16x9 ok; o conector entre fases ficou claro demais; as linhas do Antes/Depois não ficavam alinhadas (usava `justify="evenly"`).

### Iteração 2 — exit 0 (pior)
- Mudanças: conector em `accent`, itens maiores em 4x3 (16 pt), `gap` fixo nas linhas da comparação.
- Diagnósticos: 14 `text-shrunk` em 4x3 slide 2, agora 24→22, 11→**9**, 18→16.
- Entendimento: o gap maior roubou altura no modo empilhado; o caption em 9 pt fica ilegível. Ideia: no 4x3 colocar rótulo e valor na mesma linha (prop `compact`).

### Iteração 3 — exit 1
- Mudança: linha do aspecto vira `direction="row"` em 4x3 (rótulo `width={170} shrink={0}`, valor `grow={1}`).
- Diagnósticos (16x9, slide 2): 6× `text-overflow` (error) em `…CompareCard[0|1] > Box[1] > Box[0..2] > Text[1]` — "Texto estourou 100% (14.9 pt) da altura disponível mesmo em 13 pt (mínimo)"; mais `text-shrunk` 24→18 e 11→8 nos irmãos.
- Entendimento: "100% da altura disponível" = o Text recebeu altura 0. Causa: deixei `grow={1}` no Text do valor também no modo **coluna** (16x9); como `grow={1}` = `flex: 1` (base 0), numa coluna de altura pelo conteúdo o Text colapsou. O guia só fala de `grow={1}` em Text dentro de **row**; não avisa que em coluna o efeito é colapsar. A mensagem sugeria "reduza o conteúdo / aumente a área / baixe minSize", nenhuma das quais é a causa real.
- Correção: `grow={compact ? 1 : 0}`.

### Iteração 4 — exit 0, 0 diagnósticos
- Visual ok nas duas proporções; em 4x3 os cartões da timeline têm sobra vertical.

### Iteração 5 — exit 0, 0 diagnósticos (final)
- Itens da timeline 18 pt em 4x3 para usar a altura extra.

**Total Tarefa 1: 5 builds (1 com erro).**

---

## Tarefa 2 — `broken.tsx` (correção)

Comando (todas as iterações):
`node bin/tsx-slides.mjs build examples/agent-test/broken.tsx --size 16x9,4x3 --out dist/agent-test/broken --json`

### Iteração 1 — original, exit 1
Diagnósticos:
- 16x9 slide 1: 4× `text-shrunk` em `ContentLayout > Box[1] > Bullets > Box[0..3] > Text` (28→17). 4x3: 28→24.
- 16x9 slide 2: `text-overflow` (error) em `ContentLayout > Box[1] > KpiRow > KpiCard[0] > Text[1]` — "estourou 4.4% (7.8 pt) … em 32 pt: o ajuste parou após 12 passos, ainda acima do mínimo de 28 pt; … use um size inicial menor". Mais 11 `text-shrunk` nos labels/deltas (14→10/11) e valores (44→41).
- 16x9 e 4x3 slide 3: `box-overflow` (error) em `ContentLayout > Box[1] > Box` — "filhos somam 872 pt na horizontal (row), área de 640 pt: estouro de 232 pt".
- 4x3 slide 2: só 3 `text-shrunk`, **nenhum error**.

Entendimento / overview:
- Slide 1: bullets longos demais com size 28 → encolhem para 17 em 16x9.
- Slide 2: 5 KPIs com valores longos ("R$ 52.400.000,00", "1.284.392") — no overview os números quebram **no meio** ("1.2 / 84. / 392", "18 / 2 / ms"), em **ambas** as proporções. Em 4x3 isso acontece com exit 0 e sem nenhum diagnóstico.
- "Parou após 12 passos" não está documentado no guia (§4 só fala de reduzir 1 pt por vez até `minSize`). "Use um size inicial menor" não é acionável: `KpiCard` não tem prop `size`.
- Slide 3: 4 × `width={200} shrink={0}` + 3 × gap 24 = 872 > 640. Mensagem clara e com a conta certa. O `fit="error"` no texto não gerou nada (o texto em si cabia na altura).

### Iteração 2 — exit 0
- Mudanças: bullets reescritos mais curtos (mesmas 4 prioridades), `size={24}`; valores de KPI compactos ("R$ 52,4 mi", "1,28 mi"), mesmos 5 indicadores; fases com `grow={1}` em vez de `width={200} shrink={0}`, gap 16, sem `fit="error"`.
- Diagnósticos: 16x9 slide 1: 4× `text-shrunk` 24→22; slide 2: 12× `text-shrunk` (labels 14→10).
- Overview: exit 0, mas **feio**: valores ainda quebrados no meio ("R$ / 52, / 4 / mi", "99, / 95 / %"), label "Disponibilidad/e", e no slide 3 "Planejam/ento", "Desligam/ento". **Nenhum diagnóstico** para palavra partida.

### Iteração 3 — exit 1
- Mudança: dois `KpiRow` (3 + 2) numa coluna.
- Diagnósticos (16x9 slide 2): 9× `text-overflow` (error), ex. `ContentLayout > Box[1] > Box > KpiRow[0] > KpiCard[0] > Text[0]` "estourou 25.1% (2.3 pt) … mesmo em 10 pt (mínimo)" e `… > Text[1]` "o ajuste parou após 12 passos, ainda acima do mínimo de 28 pt".
- Entendimento: o `KpiCard` usa `display` (44 pt) para o valor; em duas linhas não há altura em 16:9. Sem prop de tamanho no componente, a única saída é primitivas.

### Iteração 4 — exit 0
- Mudança: componente próprio `Indicador` (primitivas: Box surface + label small + valor com `valueSize` + delta ▲/▼ colorido), grade 3 + 2, valor `h1` em 16x9 e `display` em 4x3.
- Diagnósticos: só 4× `text-shrunk` 24→22 nos bullets em 16x9.

### Iteração 5 — exit 0, 0 diagnósticos
- Bullets `size={ctx.aspect < 1.5 ? 24 : 22}` (zera os info); fases com rótulo "Fase N", texto 18 pt, padding 12, gap 12 → "Desligamento" inteiro.
- Overview 4x3: "R$ 52,4 / mi" quebrando em 2 linhas (sem diagnóstico).

### Iteração 6 — exit 0, 0 diagnósticos
- Valor 36 em 4x3: ainda quebra "R$ 52,4 / mi" (largura do cartão é a mesma do 16x9).

### Iteração 7 — exit 0, 0 diagnósticos (final)
- Valor `font.h1` (32) nas duas proporções; tudo em uma linha.

**Total Tarefa 2: 7 builds (2 com erro: original e iteração 3).**

---

## Avaliação da documentação e dos diagnósticos

### O que foi fácil
- O modelo mental (flex em coluna, sem coordenadas, `ctx.aspect` para empilhar) é claro; o deck novo passou com exit 0 no primeiro build.
- As receitas 6.2/6.3 e as tabelas de props bastam para montar cartões, timeline e comparação só com primitivas.
- O `path` com nomes de componentes (`CompareCard[1] > Box[1] > Box[2] > Text[1]`) é muito bom: com componentes nomeados, achar o nó é imediato.
- `box-overflow` é exemplar: traz a soma, a área, o estouro em pt e % e as correções certas (tirar `shrink={0}`, usar `grow`).
- O `--json` filtrável e o exit code tornam o loop rápido.

### Onde a documentação faltou ou confundiu
1. **Palavra partida no meio não é diagnosticada.** Números e palavras longas ("1.284.392", "Desligamento", "Disponibilidade") quebram por caractere quando não cabem na largura; o build sai com exit 0 e sem nenhum aviso (4x3 do original, iteração 2 inteira). O guia diz que "todo problema vira um diagnóstico", mas esse problema, o mais visível, só aparece no PNG. O `shrink` também parece reagir só à altura, não à largura de uma palavra.
2. **Limite de passos do shrink não documentado.** A mensagem "o ajuste parou após 12 passos, ainda acima do mínimo de 28 pt" contradiz o §4 ("reduz 1 pt por vez até caber ou chegar em minSize"). E a sugestão "use um size inicial menor" não serve para `KpiCard`/`KpiRow`, que não expõem `size`. O guia poderia dizer que componentes prontos fixam tamanhos e que a saída é recriar com primitivas.
3. **`grow={1}` em Text dentro de coluna faz o texto colapsar.** O guia descreve `grow={1}` como `flex: 1` e só recomenda em row; não avisa que numa coluna de altura pelo conteúdo o item vai para altura 0. O diagnóstico resultante ("estourou 100% … baixe minSize") aponta para conteúdo/minSize, não para o `grow`. Um diagnóstico do tipo "área disponível = 0 pt" ajudaria muito.
4. **Encolhimento conjunto vale entre instâncias.** Os textos de `CompareCard[0]` e `[1]`, e de vários `KpiCard`, encolhem juntos, inclusive captions que cabiam (11→8/9 pt). O guia fala em "mesmo componente"; não fica claro se é por tipo ou por instância, nem como desligar isso. Não há aviso de fonte abaixo de um piso legível: um caption de 8 pt é só `info`.
5. Detalhes menores: não há medidas internas dos componentes prontos (padding do `KpiCard`, tamanho do cabeçalho do `ContentLayout`), então calcular a largura útil de um cartão é tentativa e erro. Não há como evitar quebra entre "52,4" e "mi" (espaço inquebrável?). `trend` mistura direção com cor (Chamados +22% aparece "▼ +22%"), o que confunde.

### Mensagens de diagnóstico
- Claras: `box-overflow` (com números exatos), `text-shrunk` (de/para), `text-overflow` com mínimo.
- Pouco claras ou enganosas: `text-overflow` "100% da altura disponível" (causa real: altura 0 por `grow`); "parou após 12 passos … use um size inicial menor" (comportamento não documentado e conselho não aplicável a componentes prontos).
- Ausente: quebra de palavra no meio por falta de largura.
- O overview foi indispensável: os dois piores problemas visuais (números partidos, caption minúsculo) só apareceram nele.

### Iterações
- Tarefa 1: 5 builds (exit 0 já no 1º; 1 regressão com erro na 3ª, por causa do `grow` em coluna).
- Tarefa 2: 7 builds (o primeiro exit 0 veio na 2ª, mas visualmente ruim; o resultado limpo, com 0 diagnósticos e boa aparência, veio na 5ª–7ª).
