# MVP tsx-slides — relatório final

13/10/2026 · 5 marcos concluídos · 685 testes · typecheck limpo

## Hipóteses

| # | Hipótese | Resultado | Evidência |
|---|---|---|---|
| 1 | Layout automático (Yoga) vira posições corretas no PowerPoint | ✅ confirmada | M2: nativo × Keynote ≤ 1 pt em caixas, shapes, imagens e fundos ([M2-visual](M2-visual.md)) |
| 2 | Texto medido bate com o renderizador | ✅ confirmada (Keynote) · ⏳ PowerPoint com o dono | M3: larguras < 0,1 % de erro; com quebra forçada, 34/34 amostras com quebras idênticas ([M3-calibration](M3-calibration.md)) |
| 3 | Responsividade real | ✅ confirmada | demo.tsx gera 16x9, 4x3 e wide sem mudar código e com 0 diagnósticos ([M5-visual](M5-visual.md)) |
| 4 | API boa para agentes | ✅ confirmada, com achados | agente "virgem" só com o AGENT_GUIDE escreveu 2 slides e corrigiu o deck quebrado até exit 0 (5 e 7 builds) ([LOG](../../../examples/agent-test/LOG.md)); os 2 bugs de engine que ele achou foram corrigidos |

## Critérios de sucesso da spec

- [x] demo.tsx gera 16:9 e 4:3 sem nenhuma alteração no código do deck
- [x] PNG por slide e overview por tamanho; dá para revisar o deck só pelo overview
- [x] Preview nativo bate visualmente com o renderizador real (Keynote; diferença média 1–3/255 por pixel, quebras idênticas)
- [x] Nenhum texto cortado, vazando ou com quebra diferente da calculada (Keynote)
- [x] Todo texto e shape editável nativamente (`<p:sp>` + `<a:t>`, `prstGeom`; só imagens reais são `<p:pic>`)
- [x] Slide lotado → fonte reduzida (info) ou error com path correto, e selo no overview ([M4-visual](M4-visual.md))
- [~] Abre no Google Slides e Keynote — Keynote ✅; Google Slides e PowerPoint pendentes com o dono
- [x] Testes cobrem quebra de linha, conversão de unidades, mapeamento Yoga, loop de ajuste e SVG de preview
- [x] Um agente, só com primitivas e componentes, escreve um slide novo sem error e corrige errors pelo diagnostics.json + overview

## Decisões tomadas no caminho

| Marco | Decisão | Quem |
|---|---|---|
| M1 | Sem modo office/LibreOffice; validação real pelo Keynote | dono |
| M2 | `shrink` padrão 1; `grow={n}` = `flex: n`; imagem com grow preenche e o fit cuida da proporção | orquestrador |
| M3 | Espaçamento de linha exato (`spcPts`); TEXT_SAFETY 0,97 | calibração |
| M3 | **Quebra forçada** (linhas calculadas emitidas com `<a:br/>`) | dono |
| M3 | Pós-processamento do XML (pptxgenjs repete `<a:pPr>`) | orquestrador |
| M4 | Escopo do shrink = componente mais próximo; mensagens com eixo, lado e linhas ocultas | orquestrador |
| M5 | Palavra partida por caractere dispara shrink e vira `text-word-broken`; Text com grow em column mantém altura | orquestrador (achado do agente) |
| M5 | Caixa de texto por conteúdo inclui folga do safety; tolerância float32 na quebra | orquestrador (bugs achados no demo) |

## Em aberto (para o dono)

1. **Validar no PowerPoint e Google Slides**: `dist/calib/final2/calibration.16x9.pptx` (debug) e `dist/final/demo.*.pptx`.
2. **Limite do shrink**: 12 passos de 1 pt ⇒ um título de 44 pt nunca desce abaixo de 32 pt, mesmo com minSize menor. Opções: passo proporcional (ex.: 5 % do size) ou busca binária entre size e minSize — muda a spec.
3. **Quebra forçada × edição**: quem editar o texto no PowerPoint herda as quebras manuais.
4. **Nome do pacote** (`tsx-slides` confunde com o runner `tsx`).
5. Fora do MVP, como previsto: animações, masters, rich text, tabelas/gráficos nativos, slide de continuação, embed de fontes.
