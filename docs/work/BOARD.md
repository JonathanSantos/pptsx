# Board

Legenda: ⬜ a fazer · 🔄 em andamento · ✅ feito · ⛔ bloqueado

| Marco | ID | Tarefa | Status |
|---|---|---|---|
| M1 | M1-0 | Scaffold, contratos, docs | ✅ |
| M1 | M1-A | JSX + primitivas + resolve | ✅ |
| M1 | M1-B | sizes + layout absoluto | ✅ |
| M1 | M1-C | emit pptx | ✅ |
| M1 | M1-D | testes M1 | ✅ |
| M1 | M1-E | integração + hello.tsx | ✅ |
| M1 | M1-F | validação visual (Keynote: passa, erro ≤ 1 px) | ✅ |
| M2 | M2-A | layout Yoga + medidor estimado | ✅ |
| M2 | M2-B | preview SVG/PNG/overview | ✅ |
| M2 | M2-C | testes M2 (358 testes) | ✅ |
| M2 | M2-D | integração + layout-test.tsx | ✅ |
| M2 | M2-E | validação visual (nativo × Keynote ≤ 1 pt) | ✅ |
| M3 | M3-A | registro de fontes + medidor fontkit | ✅ |
| M3 | M3-B | emissão neutra com estratégia de espaçamento | ✅ |
| M3 | M3-C | calibration.tsx (34 amostras) | ✅ |
| M3 | M3-D | testes M3 (421 testes) | ✅ |
| M3 | M3-E | integração do medidor real | ✅ |
| M3 | M3-F | calibração nativo × Keynote: 'exact' + safety 0.97 | ✅ |
| M3 | M3-G | quebra forçada (<a:br/>) + quebra após - e / | ✅ |
| M3 | M3-H | testes quebra forçada (455 testes) | ✅ |
| M3 | gate | GO no Keynote (quebras idênticas); PowerPoint pendente com o dono | ✅ |
| M4 | M4-A | fit: detecção, loop, políticas, diagnósticos | 🔄 |
| M4 | M4-B | preview: estouro de texto no debug | 🔄 |
| M4 | M4-C | testes M4 | 🔄 |
| M4 | M4-D | integração + overflow.tsx | ⬜ |
| M4 | M4-E | validação visual | ⬜ |
| M5 | M5-A..F | CLI, demo, guia de agente, teste de agente | ⬜ |

## Backlog / observações

| Origem | Item | Destino |
|---|---|---|
| M1-F | Texto sai com `lang="en-US"`; expor idioma (padrão pt-BR) | M5 (opção de render) |
| M1-F | `chart.png` tem fundo igual ao da caixa; criar asset de teste com fundo contrastante | M2-D |
| M1-B | Layout provisório ignora altura medida de Text em fluxo | M2-A (Yoga substitui) |
| M1-C | `Shape kind="line"` sem `stroke` fica invisível; definir cor padrão? | decidir no M2 |
| M1-F | Alt text da imagem vazava o caminho absoluto | ✅ corrigido (basename) |
| M2-A | Decidido: shrink padrão 1; grow={n} = flex: n (basis 0) | ✅ core/defaults + contrato |
| M2-D | Image com grow não trava proporção (contain ≠ cover) | ✅ corrigido; falta teste do eixo cruzado → M3-D |
| M1-C | Line sem stroke usa preto (`DEFAULTS.lineStroke`) | ✅ |
| M2-E | Keynote exporta em Display P3; converter para sRGB no script de export | M3 (antes da calibração) |
| M2-E | Debug: marcar linha de texto que passa do frame | M4-B |
| M3 | Decisão do dono: quebra forçada (linhas calculadas emitidas com <a:br/>) | ✅ |
| M3-G | pptxgenjs repete <a:pPr> após <a:br/> (inválido no schema) → `src/emit/sanitize.ts` pós-processa | ✅; falta teste unitário → M4-C |
| M3-F | Validar no PowerPoint e Google Slides (dono): dist/calib/final2/calibration.16x9.pptx | dono |
