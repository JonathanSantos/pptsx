# LOG M12 — fluxograma de 5 nós usando só o `docs/AGENT_GUIDE.md`

Deck: `examples/agent-test/m12-fluxo.tsx` (1 slide, "Aprovação de uma proposta").

Nós (5, quatro formas): `inicio` (pill), `enviar` (parallelogram), `decisao` (diamond), `fim` (pill), `revisar` (roundRect).
Conectores: 4 retos com seta (`inicio→enviar`, `enviar→decisao`, `decisao→fim` com rótulo "sim", `decisao→revisar` com rótulo "não") e 1 em cotovelo (`revisar` left → `enviar` bottom, `route="elbow"`, vira um L).
Layout: grid `repeat(4, 1fr)` × `1fr 1fr` com `placeItems="center"` e `flex={1}` (receita §6.11), `revisar` em `gridColumn={3} gridRow={2}`.

## Comando

```
cd /Users/jovivo/Developer/projects/pptsx && npx tsx src/cli.ts build examples/agent-test/m12-fluxo.tsx --size 16x9,4x3 --out /private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/ad2b33e4-6b93-4d16-8522-0b9d8affb288/scratchpad/agent-m12 --json
```

## Builds: 1

### Build 1 — exit 0

| tamanho | severidade | code | path | resumo |
|---|---|---|---|---|
| — | — | — | — | `"diagnostics": []` (nenhum error/warning/info) |

Correções: nenhuma (primeiro build já limpo). Escolhas preventivas feitas a partir do guia:
- `fromSide`/`toSide` explícitos em todos os conectores (§3 "Diagramas" e §9: o conector não desvia de obstáculos).
- `padding` lateral maior no losango (`'0 24'`) e no paralelogramo (`'0 22'`) (§9: texto fica no retângulo do padding).
- `labelStyle.background` = fundo do slide para o rótulo "cortar" a linha (§6.11).
- `flexShrink={0}` nos nós de tamanho fixo (§3 "Regras de flex").

## O que vi nos PNGs

- **16x9** (`m12-fluxo.16x9/slide-01.png`): título no topo com barra; linha de cima Início → Enviar proposta → Orçamento ok? → (sim) → Aprovada; "não" desce reto do losango até "Revisar escopo"; o cotovelo sai da esquerda de "Revisar escopo" e sobe até a base do paralelogramo. Nenhuma seta atravessa nó; todo texto dentro das formas ("Enviar proposta" e "Orçamento ok?" em 2 linhas). Ponto fraco: o trecho entre o losango e "Aprovada" é curto (~30 pt), e o rótulo "sim" ocupa quase todo ele — a linha aparece só como dois tracinhos dos lados do rótulo. Legível, mas apertado.
- **4x3** (`m12-fluxo.4x3/slide-01.png`): mesmo desenho; as duas linhas do grid ficam mais altas (altura extra do 4:3), então "não" e o cotovelo ficam mais longos. Sobra um espaço vazio entre o título e o diagrama e entre o diagrama e a nota de rodapé, mas nada quebrado.

## Lacunas do guia

1. **§3 tabela "Por primitiva", linha `Connector` — `labelStyle`**: lista `{ fontSize, color, background, font }` sem tipos nem padrões. Não diz qual é o `fontSize` padrão do rótulo, se `color` herda a cor de texto do Slide, nem o que é `font` (família? objeto?). Passei `fontSize: 11` e `color` explícitos por segurança.
2. **§3 "Diagramas", `Connector` — posição do rótulo**: não diz onde o rótulo fica (meio do segmento? meio do caminho total num cotovelo?) nem quanto espaço mínimo de linha ele precisa. Só pelo PNG descobri que num vão de ~30 pt o "sim" engole a linha. Faltou uma regra tipo "deixe ≥ N pt entre nós com rótulo" ou um `columnGap` sugerido na receita §6.11 (a §6.12 menciona `columnGap` largo só para o cotovelo).
3. **§3 "Diagramas", `route="elbow"`**: descreve lados opostos (3 segmentos) e eixos diferentes (L), mas não o caso de **mesmo lado** (`bottom` → `bottom`, laço típico de "volta para a etapa anterior"). Evitei esse caso por não saber o que sai (U? reta? erro?). Também não diz se `route` padrão é `straight` (inferi pela tabela que sim, mas está implícito).
4. **§3 "Diagramas" — `Connector` como filho do `Slide` com `gap`**: diz que não ocupa espaço, mas não diz explicitamente se ele conta no `gap` do pai (um filho a mais em fluxo somaria um `gap`). Assumi que não conta; o PNG parece confirmar, mas o guia deveria dizer.
5. **§3 tabela de formas — `roundRect` "raio = `borderRadius`"**: não diz o raio padrão quando `borderRadius` é omitido num `<Box shape="roundRect">`, nem se `borderRadius={undefined}` (o que meu componente passa nas outras formas) é aceito sem aviso. Funcionou, mas foi palpite. Também não diz se `borderRadius` em `pill`/`diamond` gera `css-not-emitted` (diz só que "só vale em rect/roundRect").
6. **§6.11 receita de fluxograma**: usa `repeat(4, 1fr)` e larguras fixas de 130 pt sem explicar quanto vão sobra entre nós em 16:9 (640 pt de área → 160 pt por coluna → ~30 pt de vão). Seria útil explicitar a conta para o agente dimensionar nós e rótulos.
7. **§3 "Diagramas" — ponta de seta / `strokeWidth` padrão**: diz padrão `triangle` no fim e espessura 1,5, mas não diz a cor padrão do `stroke` (no PNG saiu cinza-escuro, não a `color` herdada `#1B2A4A`?). Não ficou claro se herda a cor de texto.
8. **§7 — saída do `--out`**: o guia mostra a árvore de arquivos, mas não diz se `--out` é criado se não existir (foi). Menor.
