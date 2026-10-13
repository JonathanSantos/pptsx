# M6-G — Validação visual: causa, agrupamento, busca binária, legibilidade, fonte ausente

**Veredito: PASSA COM RESSALVAS.**

O que funciona:
- O `demo.tsx` não regrediu: os PNGs são idênticos pixel a pixel ao build final do M5 e o XML dos slides é idêntico.
- O `overflow.tsx` mantém os mesmos códigos por slide, agora agrupados.
- O `cause.tsx` cumpre o critério do M6: `Text[1]` é a causa, há 2 derivados, 2 grupos com `count: 8` e `Text[2]` tem só `font-missing`.
- O `broken-original.tsx` sai como o esperado (44→28, `word-broken` em `KpiCard[0,1,2,4]`, rótulo "Disponibilidade" em 10 pt, `box-overflow` no slide 3).
- No Keynote, as quebras de linha e os tamanhos reduzidos batem em todos os slides conferidos.

As ressalvas são três bugs de diagnóstico, nenhum visual (ver "Bugs"):
1. O resumo da CLI não aninha o derivado quando a causa é um `Box`.
2. A causa é atribuída mesmo entre irmãos de altura fixa, que não se espremem.
3. O agrupamento de `text-shrunk` esconde tamanhos finais diferentes.

O AGENT_GUIDE §8 tem números desatualizados e um exemplo ainda sem agrupamento.

## Comandos

Saída em `<scratch>/m6visual/` (`<scratch>` = scratchpad da sessão).

```
node bin/tsx-slides.mjs build examples/demo.tsx --size 16x9,4x3,wide --out <scratch>/m6visual/demo          # exit 0, "Nenhum diagnóstico."
node bin/tsx-slides.mjs build examples/overflow.tsx --size 16x9,4x3 --out <scratch>/m6visual/overflow        # exit 1 (esperado)
node bin/tsx-slides.mjs build examples/overflow.tsx --size 16x9,4x3 --out <scratch>/m6visual/overflow-debug --debug
node bin/tsx-slides.mjs build examples/probe/cause.tsx --size 16x9 --out <scratch>/m6visual/cause            # exit 1 (esperado)
node bin/tsx-slides.mjs build examples/probe/cause.tsx --size 16x9 --out <scratch>/m6visual/cause-debug --debug
node bin/tsx-slides.mjs build examples/agent-test/broken-original.tsx --size 16x9,4x3 --out <scratch>/m6visual/broken   # exit 1 (esperado)
node bin/tsx-slides.mjs build examples/agent-test/broken-original.tsx --size 16x9,4x3 --out <scratch>/m6visual/broken-debug --debug
node bin/tsx-slides.mjs build examples/probe/cause.tsx --size 16x9 --out <scratch>/m6visual/cause-cli        # resumo abaixo
scripts/keynote-export.sh <scratch>/m6visual/cause/cause.16x9.pptx <scratch>/m6visual/keynote-cause
scripts/keynote-export.sh <scratch>/m6visual/broken/broken-original.16x9.pptx <scratch>/m6visual/keynote-broken-16x9
scripts/keynote-export.sh <scratch>/m6visual/broken/broken-original.4x3.pptx  <scratch>/m6visual/keynote-broken-4x3
scripts/keynote-export.sh <scratch>/m6visual/overflow/overflow.16x9.pptx <scratch>/m6visual/keynote-overflow-16x9
```

`npm test`: 43 arquivos, 790 testes passando. `npm run typecheck`: limpo.

Como comparei (scripts Python no scratchpad, em `tools/`):
- `pixdiff.py`: diferença média por pixel (0–255) e % de pixels com diferença > 64. O PNG do Keynote é reamostrado para 1 pt = 1 px.
- `lines.py` e `extent.py`: localizam cada linha de texto (faixa y) e a extensão horizontal dela. Se o x final de cada linha é igual, a quebra é a mesma.
- `sz.py`: extrai `sz`, frame e `<a:br/>` de cada `<p:sp>` do `.pptx`.

Também montei decks de sondagem extras em `<scratch>/probe/` (`fm.tsx`, `fixed.tsx`, `boxcause.tsx`, `misc.tsx`). Usei um `tsconfig.json` que estende o do repo e um `package.json` com `"type":"module"`.

## Por deck × tamanho

| Deck | Tamanho | Conferido | Resultado |
|---|---|---|---|
| demo | 16x9 / 4x3 / wide | 0 diagnósticos. Overview e os 15 PNGs de slide comparados com `dist/final/` (build final do M5, commit 0b2f6d9) | **Idêntico**: diferença média 0,000 e máximo 0 nos 18 PNGs. Os `slideN.xml` dos três `.pptx` são idênticos (só muda `docProps/core.xml`, a data). Contra `dist/demo/` (o build da época do M5-visual) a diferença é 4–5: são os ajustes de design feitos depois daquele relatório ("demo polido"), não regressão |
| overflow | 16x9 | Códigos por slide, agrupamento, overview, debug, Keynote | Slide 1 `text-shrunk` (info) em `Slide > Bullets > Box[0..3] > Text`, `count 4`, 20→19. Slide 2 `text-overflow` (error) com 1.2 pt / 0.5 % em 19 pt. Slide 3 `text-truncated` (warning). Slide 4: `truncated`, `overflow` em `Box[1]` (21.2 pt / 16.8 %) e `truncated` no rodapé. Slide 5 `box-overflow` (164 pt / 25.3 %). Os números são **iguais aos do M4** (`dist/m4`); só o agrupamento é novo. Nada cortado em silêncio: o vazamento dos slides 2 e 4 e o 3º retângulo do slide 5 têm selo vermelho |
| overflow | 4x3 | Idem | Slides 1 e 2 sem diagnóstico (cabem em 20 pt, o 4x3 tem 540 pt de altura). Confirmei no overview que o texto inteiro está dentro da caixa cinza. Slides 3–5 iguais ao 16x9. Selos corretos |
| cause | 16x9 | Causa, `causedBy`, grupos, `font-missing`, debug, Keynote | Ver seção própria abaixo. **OK** |
| broken-original | 16x9 | Tamanhos no XML, diagnósticos, overview, Keynote | Slide 1: 4 bullets 28→17, agrupadas (`Box[0..3]`). Slide 2: valores 44→28 em `KpiCard[0,1,2,4]`; `KpiCard[3]` ("182 ms") vai a **41 pt** (ver bug 3). `text-word-broken` em `KpiCard[0,1,2,4] > Text[1]` (`count 4`). Rótulos e deltas em 14 pt, exceto `KpiCard[2] > Text[0]` "Disponibilidade" em 10 pt (`text-shrunk` 14→10, sem `text-illegible`, porque 10 não é < 10). Slide 3: `box-overflow` 232 pt / 36.3 %, com o 4º cartão cortado pela borda do slide (é o erro proposital, com selo vermelho). Nenhum texto vaza dos cartões |
| broken-original | 4x3 | Idem | Slide 1: bullets 28→23 (cabem 4 linhas a mais). Slides 2 e 3 idênticos ao 16x9 (mesma largura de 720 pt). Overview sem vazamento |

### `examples/probe/cause.tsx` (16x9)

`cause.diagnostics.json` tem 5 itens (antes do M6 eram 12 error + 8 warning):

| path | code / severity | data | OK? |
|---|---|---|---|
| `Slide > Text[1]` | text-overflow / error | 131.9 pt, 73.9 %, 20→15, **sem** `causedBy` | causa ✔ |
| `Slide > Text[0]` | text-overflow / error | 10.7 pt, 73.9 %, 30→22, `causedBy: "Slide > Text[1]"` | derivado ✔ |
| `Slide > Box > Box[0..7] > Text` | text-overflow / error | 67.1 pt, 94.7 %, `causedBy: "Slide > Text[1]"`, `count 8`, `paths` com 8 | derivado + grupo ✔ |
| `Slide > Box > Box[0..7] > Text` | text-word-broken / warning | 24→24, `count 8`, `paths` com 8 | grupo ✔ |
| `Slide > Text[2]` | font-missing / error | — | só `font-missing` ✔ |

`overflowPct` é igual (73.9 %) em `Text[0]` e `Text[1]`. Não é bug: o flex-shrink do Yoga é proporcional à base, então os dois recebem a mesma fração do que pediam.

PPTX: título em 22 pt num frame de 14.5 pt, cartões em 24 pt, parágrafo em 15 pt num frame de 178.6 pt, `Text[2]` em 16 pt num frame de 11 pt com `typeface="Inter"`.

**Debug** (`cause-debug/cause.16x9/slide-01.png`): o vermelho aparece nos lugares certos.
- Título: faixa vermelha abaixo do frame de 14.5 pt.
- 8 cartões: contorno sólido no frame do texto e a parte de baixo ("dad / e N") em vermelho translúcido, fora da caixa cinza.
- Parágrafo: tudo abaixo de y ≈ 344 pt em vermelho até a borda do slide.

Os frames sem estouro ficam com contorno tracejado. Observação: o `Text[2]` (fonte ausente) também ganha contorno sólido de estouro no PNG, embora o JSON só tenha `font-missing`. É coerente com "medição estimada", mas o preview mostra um estouro que o diagnóstico suprime.

## Resumo da CLI (sem `--json`) — `cause.tsx`

```
Diagnósticos: 2 error (+2 derivados), 1 warning, 0 info
  ▲ [16x9 · slide 1] text-word-broken em Slide > Box > Box[0..7] > Text
    Palavra partida no meio por falta de largura: "Indisponibilidade" não cabe inteira numa linha de 51.3 pt em 24 pt. Encurte a palavra/valor (abrevie, ex.: "R$ 52,4 mi"), alargue a área (menos colunas, grow, width maior) ou reduza o size. (×8: mesmo problema em Box[0..7])
  ✖ [16x9 · slide 1] text-overflow em Slide > Text[1]
    Texto estourou 73.9% (131.9 pt) da altura disponível mesmo em 15 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize.
    ↳ ✖ [16x9 · slide 1] text-overflow em Slide > Text[0]
      Texto estourou 73.9% (10.7 pt) da altura disponível mesmo em 22 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize. Esse estouro é consequência: Slide > Text[1] pede 131.9 pt a mais do que a área tem; corrija Slide > Text[1] primeiro.
    ↳ ✖ [16x9 · slide 1] text-overflow em Slide > Box > Box[0..7] > Text
      Texto estourou 94.7% (67.1 pt) da altura disponível em 24 pt (fit="error" não ajusta); reduza o conteúdo, aumente a área ou troque para fit="shrink" ou fit="truncate". Esse estouro é consequência: Slide > Text[1] pede 131.9 pt a mais do que a área tem; corrija Slide > Text[1] primeiro. (×8: mesmo problema em Box[0..7])
  ✖ [16x9 · slide 1] font-missing em Slide > Text[2]
    Fonte "Inter regular" não está registrada; o texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a fonte em options.fonts ou use uma família registrada.
```

Exit 1. O `diagnostics.json` desse build é byte a byte igual ao do build `cause/`.

## Nativo × Keynote

| Deck · slide | Diferença média | Quebras | Tamanhos | Diferença ≥ 1 pt? |
|---|---|---|---|---|
| cause 16x9 · 1 | 24,5 | Iguais nas 13 linhas visíveis do parágrafo (x final de cada linha a ≤ 2 pt); cartões iguais ("Indi / spo / nibili / dad / e N") | Iguais (22 / 24 / 15 / 16) | Sim, na vertical: o passo do parágrafo é 17,25 pt no nativo e 17,0 no Keynote, e a 9ª linha fica ~2 pt mais alta. "Fonte não registrada" (Inter → substituída pelo Keynote) tem a mesma quebra (1 linha) |
| broken 16x9 · 1 | 6,1 | Iguais nas 10 linhas | 17 pt | Não (deriva ≤ 1 pt) |
| broken 4x3 · 1 | 7,4 | Iguais nas 12 linhas | 23 pt | Não (≤ 1 pt) |
| broken 16x9 / 4x3 · 2 | 2,1 / 1,6 | Iguais: "R$ / 52.4 / 00.0 / 00,0 / 0", "1.28 / 4.39 / 2", "99,9 / 5%", "182 / ms", "3.41 / 2"; deltas "+0,05 / p.p." | 28 / 41 / 14 / 10 iguais | Não |
| broken 16x9 / 4x3 · 3 | 0,9 / 0,7 | Iguais | Iguais | Não; o 4º cartão é cortado igual nos dois |
| overflow 16x9 · 1 | 13,7 | Iguais nas 10 linhas | 19 pt | Não (≤ 3 pt no fim da 2ª bullet longa) |
| overflow 16x9 · 2 | 28,5 | Iguais nas 12 linhas | 19 pt | **Sim**: passo de 21,85 pt no nativo e 21,0 no Keynote, deriva de 10 pt na 12ª linha. O Keynote mostra o texto mais compacto (vaza menos que o preview) |
| overflow 16x9 · 3 / 4 / 5 | 4,2 / 7,7 / 1,2 | Iguais (truncate 3 linhas; 6 + 8 linhas; rodapé 1 linha com "…") | Iguais | ≤ 3 pt na caixa `fit="error"` |

Todas as diferenças ≥ 1 pt são **verticais e cumulativas**. Vêm do achado conhecido do M3: o Keynote trunca `spcPts` para pt inteiro (2185 → 21, 1725 → 17). O Keynote nunca fica mais alto que o nativo, então o preview erra para o lado seguro. Nenhuma quebra de linha diverge e nenhum tamanho reduzido diverge.

## Bugs achados

1. **Resumo da CLI não aninha o derivado quando a causa é um `Box`** (`src/cli.ts`, `isCauseOf`). O aninhamento exige `causedBy === path` de um diagnóstico. Só que a causa costuma ser um contêiner, e o diagnóstico dela fica no `Text` de dentro.
   - Repro (`probe/boxcause.tsx`: título + `<Box><Text>parágrafo gigante</Text></Box>`). Saída:
     ```
     Diagnósticos: 1 error (+1 derivado), 0 warning, 0 info
       ✖ … text-overflow em Slide > Text        … corrija Slide > Box primeiro.
       ✖ … text-overflow em Slide > Box > Text
     ```
   - O derivado sai **antes** da causa, sem `↳`. Mesmo assim o cabeçalho conta "1 error", com duas linhas ✖ visíveis.
   - Esse é o caso comum nos layouts (`ContentLayout > Box[1]` é o corpo). O `cause.tsx` só passa porque lá a causa é um `Text` direto.
   - Sugestão: no `isCauseOf`, aceitar uma causa cujo path esteja **dentro** de `causedBy` (`isWithin(cause.path, derived.data.causedBy)`). Outra opção: em `src/fit/cause.ts`, descer a causa até o nó estourado mais profundo antes de gravar `causedBy`.
2. **Causa atribuída entre irmãos que não se espremem** (`src/fit/cause.ts`, `causesOf`/`causeOf`). A regra só olha a demanda; não confere se o contêiner ficou de fato sem espaço.
   - Repro (`probe/fixed.tsx`): dois `<Box height={20}>`, cada um com um Text que estoura sozinho, num slide com sobra. O resultado é `Slide > Box[1] > Text` com `causedBy: "Slide > Box[0]"` ("corrija Slide > Box[0] primeiro"), o que é falso: altura fixa não é espremida pelo irmão.
   - Pior, com fonte ausente (`probe/fm.tsx`): o Text com `font="Inter"` tem o estouro suprimido, mas a demanda dele continua contando. Ele vira a causa do estouro do irmão, que é real, e o agente é mandado corrigir um nó que não tem nenhum `text-overflow`.
   - Sugestões:
     - (a) demanda 0 para Text com `fontMissing`;
     - (b) só apontar causa num contêiner cujos filhos em fluxo foram de fato reduzidos (soma das bases > área, ou algum filho com frame menor que a base), ou ignorar filhos com `height` fixo no eixo.

   É lacuna do contrato (CONTRACTS §fit "Causa"), então a decisão é do orquestrador.
3. **O grupo de `text-shrunk` esconde tamanhos finais diferentes** (`src/fit/group.ts`).
   - No `broken-original` slide 2, o grupo `KpiCard[0..4] > Text[1]` diz "reduzido de 44 pt para 28 pt (×5)". No `.pptx`, `KpiCard[3]` ("182 ms") está em **41 pt** e é visivelmente maior que os outros valores no overview.
   - O contrato manda usar a mensagem e os números do pior, então a implementação está conforme, mas para o agente a informação é falsa. Ele não sabe que um dos cartões ficou 13 pt maior.
   - Sugestão: para `text-shrunk`/`text-illegible`, só agrupar quando `toSize` for igual, ou escrever a faixa na mensagem ("para 28–41 pt").
4. (menor) Um mesmo Text recebe `text-shrunk` (info) **e** `text-illegible` (warning) com o mesmo 11→8 (`probe/misc.tsx`, slide 1). Não está errado, mas é redundante. O guia podia dizer que os dois vêm juntos.
5. (menor) Debug: um Text com `font-missing` aparece com contorno e preenchimento de estouro, enquanto o JSON suprime o estouro (ver a seção do `cause.tsx`).

Confirmado sem bug (`probe/misc.tsx`):
- Piso de legibilidade: 11 pt sem `minSize` para em 10 (e dá `text-overflow` "mesmo em 10 pt (mínimo)").
- Com `minSize={8}`, chega a 8 e gera `text-illegible`.
- Título de 44 pt com `minSize={20}` numa Box de 30 pt: 44→26, o maior inteiro que cabe.

## Correções sugeridas para o AGENT_GUIDE §8 (não editei)

Comparei com a saída real dos builds acima:

1. **Mensagem real `Slide > Text[0]`**: o guia diz "72.3% (10.6 pt)" e "pede 130.2 pt". O real é **"73.9% (10.7 pt)"** e **"pede 131.9 pt"**.
2. **Mensagem real `Slide > Box > Box[0..7] > Text`**: o guia diz "92.4% (66.3 pt)". O real é **"94.7% (67.1 pt)"**. No `cause.tsx` essa mensagem real também leva o sufixo **"Esse estouro é consequência: Slide > Text[1] pede 131.9 pt a mais do que a área tem; corrija Slide > Text[1] primeiro."** antes de "(×8: …)". O guia mostra a mensagem sem o sufixo, o que contradiz o próprio exemplo de resumo logo abaixo, onde ela aparece como derivada.
3. **Mensagem real `text-shrunk`**: o guia mostra `Slide > Bullets > Box[0] > Text` sem agrupamento. O real (`overflow.tsx` slide 1) é **`Slide > Bullets > Box[0..3] > Text`** com o sufixo **" (×4: mesmo problema em Box[0..3])"**.
4. **Exemplo de resumo da CLI**: as duas ocorrências de "pede 130.2 pt" devem virar **"pede 131.9 pt"**. O resto bate: cabeçalho `2 error (+2 derivados), 1 warning, 0 info`, ordem das linhas, `↳` e indentação.
5. **Resumo com causa em `Box`**: o guia promete que os derivados aparecem "sob a causa, com `↳`". Hoje isso só vale quando a causa é um `Text` (bug 1). Se o bug não for corrigido antes do M6-H, avisar no guia: "se `causedBy` aponta um Box, procure o diagnóstico dentro dele".
6. **Agrupamento**: "`message` e números são os do pior" pode enganar em `text-shrunk` (bug 3). Se o bug ficar, acrescentar: "em `text-shrunk` agrupado, alguns irmãos podem ter ficado maiores; confira `paths` no `.pptx`/overview".
7. (§7/§8, menor) `--debug`: o guia diz "contornos vermelhos tracejados em toda Box/Text/Image". Na prática, o frame de um Text que estoura tem contorno **sólido** e a área estourada fica em vermelho translúcido. Vale citar o contorno sólido como sinal de estouro.

O que bate exatamente e não precisa mudar:
- JSON de exemplo (`Slide > Box > Text`, 0.5 % / 1.2 pt / 20→19);
- `Box[1] > Text` 16.8 % / 21.2 pt;
- `text-word-broken` em `KpiCard[0,1,2,4]` (texto, números e sufixo idênticos);
- `text-truncated` 3 de 8 / ~63 %;
- `box-overflow` 812/648/164 pt/25.3 %;
- `font-missing` (formato);
- os templates de `text-illegible` ("de 11 pt para 8 pt"), área 0 pt, `out-of-slide` e `image-upscaled` (conferidos em `src/fit/diagnostics.ts`; `text-illegible` também no build de sondagem).

Fora do guia: o `docs/work/milestones/M6.md` ainda descreve o sufixo como "Esse texto só estourou porque…". O CONTRACTS.md e a engine usam "Esse estouro é consequência: …", então só o M6.md está desatualizado.

## Artefatos

`<scratch>/m6visual/`:
- `demo/`, `overflow/`, `overflow-debug/`, `cause/`, `cause-debug/`, `cause-cli/`, `broken/`, `broken-debug/`;
- exports do Keynote: `keynote-cause/`, `keynote-broken-16x9/`, `keynote-broken-4x3/`, `keynote-overflow-16x9/`;
- pares empilhados (`pair-*.png`, nativo em cima e Keynote embaixo) e recortes do debug (`*-crop*.png`);
- builds de sondagem (`probe-fm/`, `probe-fixed/`, `probe-boxcause/`, `probe-misc/`).

## Adendo do orquestrador (gate do M6)

Os três bugs acima foram corrigidos na mesma onda, com contrato fechado em `CONTRACTS.md` e testes do tester (804 no total):
1. CLI: a âncora de um derivado é o primeiro diagnóstico não derivado com path igual a `causedBy` ou dentro dele.
2. Causa: demanda 0 para Text com fonte ausente e para Box/Text com `height` explícito; contêiner só tem causa quando sobrecarregado (Σ natural + gaps > conteúdo).
3. Agrupamento: identidade inclui `fromSize`/`toSize` (`KpiCard[3]` 44→41 sai separado do grupo 44→28).

Refinamento extra: palavra partida só dispara a busca enquanto o próprio Text está acima do mínimo, e o passo por palavra vale só para ele (vizinhos só descem pelo que a altura exigir). As correções do AGENT_GUIDE listadas acima foram aplicadas. Pendências menores (debug vermelho em Text com fonte ausente; `text-shrunk` + `text-illegible` no mesmo Text) foram para o backlog do BOARD.

Agente virgem (M6-H, `examples/agent-test/LOG-M6.md`): `broken-original.tsx` chegou a exit 0 sem error nem warning no **2º build** (meta: ≤ 3); 4 builds no total, os dois últimos só por polimento visual.
