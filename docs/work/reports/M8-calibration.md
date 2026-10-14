# M8-H — Calibração do rich text: nativo × Keynote; baseline, fonte do sistema e embed

**Veredito: GO com ressalvas para o rich text.**

O critério "Pronto quando" está cumprido no Keynote para rich text, NBSP, baseline e fonte do sistema:

- **Quebras (forçadas, padrão):** **29/30 amostras** (R01–R30) saem com as mesmas linhas do preview nativo nas duas versões do deck (`--debug` e limpa). A exceção é **R20**, o caso de erro proposital (`nowrap` mais largo que a área, `text-overflow` esperado): o Keynote quebra o texto em 2 linhas, porque o emissor grava `wrap="square"` também para `nowrap` (bug 1).
- **Estilo por run:** em todas as 29 amostras, negrito, itálico e cor começam e terminam **no mesmo caractere** no Keynote. A conferência foi feita caractere a caractere, pela fonte (`Arial-BoldMT`, `Arial-ItalicMT`, `Arial-BoldItalicMT`, `ArialMT`) e pela cor que o PDF do Keynote registra. Vale também para runs no meio da palavra (R14: **Super**ávit, *sub*estimativa).
- **Largura das linhas com runs mistos:** 38 linhas, com erro máximo de **0,07 pt (0,04 %)** contra a soma por face que a engine calcula. Se tudo fosse medido com a face do Text, o erro chegaria a 16 pt (6 %).
- **NBSP:** segura as palavras também quando o **Keynote quebra sozinho** (`--line-breaks auto`): em R15 "R$ 52,4 mi" fica junto, enquanto no controle R16 o Keynote separa "R$" de "52,4".
- **Baseline:** fica dentro de 0,25 pt no Keynote para Shape + Text (R28) e Image + Text (R30). Para Text 40 pt + Text 12 pt (R29) o desvio é de **1,25 pt**. A causa é o deslocamento da 1ª baseline do Keynote, que muda com o tamanho da fonte (já medido no M3), e não o layout.
- **Fonte do sistema:** Helvetica `.ttc`, sem `file`. `fontsMissing` sai vazio, o nativo (resvg) e o Keynote quebram nas mesmas palavras (inclusive com `auto`) e a bold é medida como bold, com larguras iguais às do Keynote em ±0,01 pt.
- **Embed:**
  - Liberation Sans com `file` gera `ppt/fonts/font1.fntdata` e `font2.fntdata` (EOT), `<p:embeddedFontLst>` na posição certa, content type e relacionamentos. O Keynote abre normalmente e ignora o embed: renderiza em Helvetica, como no spike.
  - A Arial padrão não gera `ppt/fonts/`.
  - Helvetica `.ttc` gera `font-not-embeddable` (warning), e o arquivo abre.
- `npm run typecheck` passa. `npm test` passa: 62 arquivos (1 pulado), **1108 testes passando**, 5 pulados.

Ressalvas: o bug 1 (`nowrap` que estoura não sai em uma linha no renderizador), o desvio de baseline entre tamanhos muito diferentes (R29, cerca de 1 pt) e dois detalhes de mensagens de diagnóstico (bugs 2 e 3). Nada disso afeta as 29 amostras válidas.

## Ambiente

- macOS 26.6.2 (Darwin 25.6), Keynote 14.4, Node 24.17 + tsx. Medidor: fontkit com Liberation Sans, emitida como "Arial". No Keynote a Arial real é usada, como mostram os `/BaseFont` do PDF: `ArialMT`, `Arial-BoldMT`, `Arial-ItalicMT`, `Arial-BoldItalicMT`.
- Tudo em `S=<scratchpad>/m8h`.
- **Contenção do Keynote:** outra sessão (projeto skill-ppt) usava o Keynote ao mesmo tempo, com um alerta modal aberto ("kpi-forced.pptx não pode ser importado") e uma sequência de travamentos entre 23:19 e 23:25. Foram 26 relatórios `Keynote-*.ips` com `EXC_BREAKPOINT` em `NSAppleEventDescriptor _valueOfType` (AppleEvent malformado), nenhum vindo dos meus scripts. Minhas primeiras tentativas falharam assim:
  - `execution error: Keynote obteve um erro: Esgotou-se o tempo limite do AppleEvent. (-1712)`
  - `Não é possível transformar missing value em tipo document. (-1700)`
  - `A conexão não é válida. (-609)`

  A solução foi passar a usar a mesma trava de máquina do skill-ppt (`/tmp/pptx-ds-keynote.lock`, `mkdir` atômico + pid; ver `tools/klocked.sh`). Também respeitei o arquivo `pptx-ds-keynote.pause`, que o orquestrador removeu por estar órfão. A partir daí, **todas as exportações passaram na 1ª tentativa**. Nada ficou sem validação real.

## Método

1. Builds:
   ```
   node bin/pptsx.mjs build examples/calibration-rich.tsx --size 16x9 --debug --out $S/calib                  # exit 1 (R20, esperado)
   node bin/pptsx.mjs build examples/calibration-rich.tsx --size 16x9 --out $S/calib-clean --preview native   # exit 1 (R20)
   node bin/pptsx.mjs build examples/calibration-rich.tsx --size 16x9 --line-breaks auto --preview none --out $S/calib-auto   # extra
   ```
   Diagnósticos, iguais nos três builds e iguais aos esperados pela legenda do deck:
   - `text-shrunk` em R19 (18 → 14 pt);
   - `text-overflow` em R20 (`axis: 'width'`, "Texto com nowrap tem 238.2 pt de largura numa área de 130 pt mesmo em 14 pt (mínimo)…");
   - `text-truncated` em R24 e R25, agrupado (ver bug 2).
2. Árvore posicionada com `render(..., { includePositioned: true })` (`tools/dump.mts`). Por caixa de texto: frame, `lines`, `lineRuns`, `runs`, `ascent` e `lineHeight`. As amostras são identificadas pelo rótulo de 8 pt que vem antes de cada corpo.
3. **XML × engine** (`tools/xmlcheck.py`): reconstruí as linhas de cada `<p:sp>` a partir de `<a:r>`, `<a:br/>` e `</a:p>`, com `b`/`i`/cor por caractere, e comparei com `lineRuns`. Resultado: **38/38 caixas idênticas** no `--debug` e no limpo. NBSP preservado no XML: 2 em R15 e 1 em R17.
4. **Keynote → PDF** por AppleScript (`export … as PDF with properties {PDF image quality:Best}`) e também PNG (`keynote-export.sh`, equivalente com timeout longo). Um PDF por deck: calib, calib-clean, calib-auto, demo 16x9 e 4x3, sysfont, sysfont-auto, embed-lib, embed-helv e demo-embed.
5. **PDFKit** (`tools/pdfruns.swift`): `page.selection(for: frame + 1,6 linha).selectionsByLine()` dá as linhas como o Keynote quebrou. O `attributedString` de cada linha dá a **fonte e a cor de cada trecho**. `tools/analyze.py` compara linha a linha (texto normalizado, NBSP = espaço) e, quando as linhas batem, caractere a caractere (sem espaços): estilo B/I pela fonte e cor com tolerância de 8/255.
6. **Larguras** (`tools/widths.mts`): para cada linha, soma das larguras por run, cada uma com a face do run (Liberation), comparada com a largura da linha no PDFKit.
7. **Baseline**: rasterizei o PDF a 4 px/pt (CoreGraphics, `tools/raster`) e medi o fundo do Shape e da Image e a base dos glifos sem descendente, por coluna (`tools/base.py`). Inspeção visual dos recortes com Read.

## Resultados por amostra (16x9)

"Linhas" = engine/Keynote com quebra forçada (padrão). "Estilo" = fonte e cor por caractere iguais. "Δ largura" = maior |Keynote − soma por run| entre as linhas da amostra. "auto" = o Keynote quebrando sozinho (`--line-breaks auto`, só informativo: o padrão é `forced`). O `--debug` e o limpo deram **linhas e larguras idênticas** no Keynote em todas as caixas.

| id | size · largura | testa | linhas | quebras | estilo | Δ largura | auto | resultado |
|---|---|---|---|---|---|---|---|---|
| R01 | 12 · 200 | negrito no meio | 3/3 | iguais | ok | 0,01 | diverge ("no" sobe) | ok |
| R02 | 12 · 200 | itálico no meio | 3/3 | iguais | ok | 0,01 | igual | ok |
| R03 | 12 · 200 | negrito+itálico (`BoldItalicMT`) | 2/2 | iguais | ok | 0,01 | igual | ok |
| R04 | 18 · 300 | cor por run (verde/vermelho/azul) | 2/2 | iguais | ok (cores `1E9E6A`/`D64545`/`2F6FED` exatas) | 0,01 | diverge ("margem" sobe) | ok |
| R05 | 18 · 300 | negrito cruza a quebra | 4/4 | iguais | ok | 0,02 | diverge (4 → 3 linhas) | ok |
| R06 | 18 · 300 | itálico cruza a quebra | 3/3 | iguais | ok | 0,01 | igual | ok |
| R07 | 12 · 200 | Text bold, Span regular | 3/3 | iguais | ok | 0,01 | diverge (3 → 2) | ok |
| R08 | 12 · 140 | Text itálico, Span reto | 2/2 | iguais | ok | 0,01 | diverge ("de" sobe) | ok |
| R09 | 12 · 220 | 3 estilos numa linha | 2/2 | iguais | ok | 0,00 | igual | ok |
| R10 | 18 · 330 | idem em 18 | 2/2 | iguais | ok | 0,01 | igual | ok |
| R11 | 32 · 420 | idem em 32 | 3/3 | iguais | ok | 0,02 | igual | ok |
| R12 | 18 · 220 | lh 1.2 com runs | 3/3 | iguais | ok | 0,04 | igual | ok |
| R13 | 32 · 360 | negrito abre a 2ª linha | 2/2 | iguais | ok | 0,06 | igual | ok |
| R14 | 12 · 150 | run no meio da palavra | 2/2 | iguais | ok ("Super" bold, "ávit" regular; "sub" itálico; "2" vermelho) | 0,01 | igual | ok |
| R15 | 14 · 100 | NBSP (` `) | 3/3 | iguais | ok | 0,00 | **igual**: "R$ 52,4 mi no" junto | ok |
| R16 | 14 · 100 | controle: espaço comum | 3/3 | iguais | ok | 0,00 | igual ("Receita de R$" ∣ "52,4 mi no") | ok |
| R17 | 14 · 120 | `&nbsp;` + negrito | 3/3 | iguais | ok ("99,95 %" bold inteiro) | 0,01 | **igual** | ok |
| R18 | 18 · 120 | nowrap cabe | 1/1 | iguais | ok | 0,00 | igual | ok |
| R19 | 14 (de 18) · 130 | nowrap + shrink | 1/1 | iguais | ok | 0,02 | igual | ok (124,5 pt em 130) |
| R20 | 14 (de 18) · 130 | nowrap não cabe (erro esperado) | 1/**2** | **diverge** | — | — | diverge (1 → 2) | **divergência**: "Receita total do" ∣ "trimestre: R$ 52,4 mi". O nativo desenha 1 linha de 238 pt que vaza à direita; o Keynote quebra na largura da caixa e vaza para baixo (bug 1) |
| R21 | 14 · 200 | nowrap, 2 parágrafos com runs | 2/2 | iguais | ok | 0,02 | igual | ok |
| R22 | 14 · 260 | `\n` dentro de um Span | 4/4 | iguais | ok (o negrito continua no 2º parágrafo) | 0,00 | igual | ok |
| R23 | 14 · 260 | parágrafos, itálico em cada | 4/4 (+ vazia) | iguais | ok | 0,01 | diverge ("as" sobe) | ok |
| R24 | 14 · 220 | maxLines 2, reticência num Span | 2/2 | iguais | ok ("economia…" bold, reticência inclusive) | 0,03 | diverge ("o" sobe) | ok |
| R25 | 12 · 200 | maxLines 1, Span colorido cortado | 1/1 | iguais | ok ("atrasado por dependênc…" bold vermelho) | 0,00 | igual | ok |
| R26 | 12 · 220 | B com Span regular dentro | 2/2 | iguais | ok | 0,00 | igual | ok |
| R27 | 10 · 180 · center | center com runs | 3/3 | iguais | ok | 0,01 | diverge ("níveis" sobe) | ok |
| R28 | 18 · 230 | baseline Shape 8×8 + Text | 3/3 | iguais | ok | 0,07 | igual | ok (baseline: ver abaixo) |
| R29 | 40 + 12 · 200 | baseline Text 40 + Text 12 | 1/1 + 1/1 | iguais | ok ("▲ +14,2%" verde bold, " vs Q2" regular) | — | igual | ok, com **1,25 pt** de desvio de baseline no Keynote |
| R30 | 14 · 200 | baseline Image 24 pt + Text | 2/2 | iguais | ok | 0,00 | igual | ok |

**Forçado: 29/30 iguais, R20 diverge (erro esperado, bug 1). Auto: 21/30 iguais.** Nas 9 divergências do `auto` o Keynote encaixa **mais** texto por linha (é a margem de 3 % do `textSafety`, como no M7), e 2 delas perdem uma linha.

Os títulos de seção e a legenda também batem no forçado (7/7). No `auto`, a legenda quebra depois de "/" e "-", como no M7.

R29: o PDFKit junta "52,4" e "▲ +14,2% vs Q2" numa linha só, porque estão na mesma baseline. Extraí o texto de 12 pt com um retângulo próprio: 1 linha, com os estilos certos.

## Achados de métrica

- **Largura com runs mistos:** ver a tabela abaixo.

  | linhas | erro máximo (Keynote − engine) |
  |---|---|
  | 38 linhas com mais de uma face | 0,07 pt / 0,04 % |
  | 71 linhas no total | 0,07 pt (sem contar R29\*) |

  \* R29: o PDFKit inclui o "▲" vizinho no retângulo, mas no raster a linha mede o mesmo.

  O Keynote usa a face certa em cada run e **não faz kerning entre runs** de faces diferentes, ou faz e isso não aparece: o erro está na casa de 0,01 pt. A medição por run é necessária. Com tudo medido na face do Text, a linha erraria por até:
  - +16 pt em R05 L3 (254 contra 270 pt, 6 %);
  - +10,8 pt em R22 L3;
  - −4,7 pt em R07 L1 (Text bold com Span regular: a linha real é *mais estreita*).
- **NBSP:**
  - No forçado é trivialmente respeitado: a linha já vem decidida e o caractere chega ao XML como U+00A0.
  - O teste forte é o `auto`, em que o Keynote quebra sozinho. Ele trata U+00A0 como cola: R15 "Receita de" ∣ "R$ 52,4 mi no", contra o controle R16 "Receita de R$" ∣ "52,4 mi no". Em R17, "99,95 %" fica inteiro.
  - O NBSP tem a largura de um espaço no Keynote: as linhas de R15 batem em 0,00 pt.
- **nowrap:**
  - R18, R19 e R21 saem em 1 linha por parágrafo no Keynote, no forçado e no `auto`. Os runs de R19 e R21 ficam certos.
  - A linha mais justa é R19: 124,5 pt numa caixa de 130 (95,8 %).
  - O caso que estoura (R20) **não** sai em uma linha no Keynote (bug 1).
- **Baseline:** medida no raster de 4 px/pt, o que dá resolução de 0,25 pt.

  | amostra | engine (pt) | Keynote (pt) | diferença no Keynote |
  |---|---|---|---|
  | R28: Shape 8×8 (base) / Text 18 (1ª baseline) | 80,29 / 80,29 | 80,25 / 80,00 | 0,25 pt |
  | R29: Text 40 bold / Text 12 | 100,21 / 100,16 | 101,00 / 99,75 | **1,25 pt** |
  | R30: Image 24×15 (base) / Text 14 | 79,00 / 78,97 | 79,00 / 79,25 | 0,25 pt |

  - Na engine e no preview nativo as baselines coincidem em ≤ 0,05 pt.
  - O desvio de R29 no Keynote vem do deslocamento da 1ª baseline em `spcPts`, que já aparecia no M3 e depende do tamanho:
    - pelo PDFKit, **+0,60 pt em 40 pt** (passo de 46 pt) e **−0,46 pt em 12 pt** (passo de 13,8 truncado para 13);
    - a soma dá cerca de 1,1 pt, o que confere com o raster.
  - Dá para perceber com zoom: o "+14,2%" fica 1 pt acima da base do "52,4". Para Shape/Image junto de texto de corpo, o desvio fica abaixo da resolução da medida.
- **Passo e 1ª baseline** (igual ao M3, nada novo): o Keynote trunca `spcPts` (13,8 → 13, 20,7 → 20, 36,8 → 36). A 1ª baseline fica entre −0,46 e +0,13 pt da engine para 10–32 pt e +0,60 em 40 pt. Os runs em outra face não mudam a altura da linha, como no contrato.

## Demo (`examples/demo.tsx`, nativo × Keynote)

- 16x9 e 4x3: **27/27 caixas de texto** com as mesmas linhas e os mesmos estilos por caractere, em cada tamanho.
- Slide 4, nos dois tamanhos: "dedicado às áreas usuárias começa em **novembro**." O PDF do Keynote tem `ArialMT` ∣ `Arial-BoldMT` ("novembro") ∣ `ArialMT` (".") na 2ª linha, nas mesmas posições da engine.
- O rótulo "Receita (R$ mi)" do KPI sai em 1 linha nos dois tamanhos, com o NBSP no XML. Nessa largura (160 pt) o rótulo não chega perto de quebrar, então o NBSP fica sem efeito visível no demo. O efeito real está provado em R15 e R17.
- `demo` 16x9 `--embed-fonts`: nenhum `ppt/fonts/`, nenhum content type `fntdata`, e `presentation.xml` **idêntico** ao do build sem a flag. As 5 páginas do Keynote ficam **byte a byte iguais** ao build sem embed.

## Fonte do sistema (Helvetica, sem `file`)

Deck de prova em `examples/__probe/` (apagado no fim), com `pptsx.config.ts`:
```ts
fonts: [{ family: 'Helvetica', weight: 'regular' }, { family: 'Helvetica', weight: 'bold' }]
```
O deck tem o mesmo parágrafo em regular e todo em `<B>`, em caixas de 280 pt a 18 pt, e um parágrafo misto de 420 pt.

- `resolveFontFaces` acha `/System/Library/Fonts/Helvetica.ttc` com `postscriptName` `Helvetica`, `Helvetica-Bold` e `Helvetica-Oblique` (pedida à parte). A `.ttc` tem também `Helvetica-Light` (w300, `fsSelection.regular`), e o resolver **não** a confunde com a regular. `fontsMissing` vem vazio, sem diagnósticos. O XML sai com `typeface="Helvetica"`.
- Família inexistente (`Inter`) gera `fontsMissing: ["Inter regular","Inter bold"]`, a linha `▲ fontes não encontradas no sistema: Inter regular, Inter bold` e `font-missing` (error) no nó, com exit 1.
- **Bold medida como bold:**
  - regular "A receita recorrente cresceu" = 225,11 pt e bold = 242,48 pt (fontkit nas faces da `.ttc`);
  - a linha mais larga na árvore é 273,4 pt na regular e 272,2 na bold (as duas com a folga de 0,97);
  - a quebra muda por causa da bold: "puxada pelo varejo, pelo atacado" (regular) contra "puxada pelo varejo, pelo" ∣ "atacado e…" (bold).
- **Keynote** (`/BaseFont` `Helvetica` e `Helvetica-Bold`): 5/5, 5/5 e 3/3 linhas iguais no forçado e **também no `auto`**. Larguras por linha iguais à engine (225,12 contra 225,11; 242,49 contra 242,48). No parágrafo misto, os runs bold caem nas mesmas palavras. Passo de 18 pt nos dois (Helvetica: hhea 1577/−471/0, ou seja, linha = 1,0 × size).
- **Nativo (resvg)** usa a Helvetica da `.ttc`: o recorte do preview e o do Keynote ficam praticamente iguais, com as mesmas quebras e o mesmo desenho dos glifos.

## Embed (`--embed-fonts`)

| caso | resultado |
|---|---|
| demo (Arial padrão = Liberation sob "Arial") | sem `ppt/fonts/`, sem `embedTrueTypeFonts`, `presentation.xml` igual ao sem flag, sem diagnóstico ✔ |
| Liberation Sans com `file` (config em `examples/__probe/lib/`, deck com `font="Liberation Sans"` regular + `<B>`) | `ppt/fonts/font1.fntdata` (410 912 B = TTF de 410 712 + cabeçalho EOT; começa com EOTSize e Version `0x00020001`, nome "Liberation Sans" em UTF-16) e `font2.fntdata` (bold). `[Content_Types].xml` com `<Default Extension="fntdata" ContentType="application/x-fontdata"/>`. `rIdFont1`/`rIdFont2` do tipo `…/relationships/font`. `embedTrueTypeFonts="1"`. `<p:embeddedFontLst><p:embeddedFont><p:font typeface="Liberation Sans" pitchFamily="34" charset="0"/><p:regular r:id="rIdFont1"/><p:bold r:id="rIdFont2"/>` entre `<p:notesSz>` e `<p:defaultTextStyle>`. Todas as partes XML são bem formadas, e `notesMasterIdLst` vem antes de `sldIdLst` ✔ |
| ↳ no Keynote | abre e exporta normalmente, sem alerta. Renderiza em **Helvetica** (`/BaseFont Helvetica`, `Helvetica-Bold`; "R", "G", "ß" e "\|" com o desenho da Helvetica): ignora o embed, como no spike ✔ |
| Helvetica (`.ttc`) + `--embed-fonts` | 2 × `font-not-embeddable` warning ("A fonte \"Helvetica regular\" não é um TrueType de uma face só (.otf CFF ou coleção .ttc) e não foi embutida.", idem bold), exit 0, sem `ppt/fonts/`. O Keynote abre e renderiza igual ao build sem flag ✔ |

## Bugs

1. **`nowrap` não é emitido: o renderizador quebra a linha quando ela passa da caixa** (`src/emit/options.ts:124`, `wrap: true` fixo). Gravidade **baixa**: só acontece no caso que já é erro (`text-overflow` com `axis: 'width'`).
   - Repro: R20 do `calibration-rich.tsx`.
   - O nativo desenha 1 linha de 238 pt que vaza à direita do frame de 130 pt, com realce. O Keynote quebra em "Receita total do" ∣ "trimestre: R$ 52,4 mi" e vaza **para baixo**, o que pode encostar no que vem depois. Isso ocorre tanto no forçado quanto no `auto`.
   - Quando o nowrap cabe (R18, R19, R21), a linha já mede ≤ 97 % da caixa e não há diferença.
   - Sugestão: `wrap="none"` no `<a:bodyPr>` de Text com `nowrap` (pptxgenjs `wrap: false`). O PowerPoint e o Keynote passam a estender a linha para o lado, como o preview. Vale conferir que `algn` center/right continua relativo à caixa.
2. **(menor) Diagnóstico agrupado esconde a mensagem do 2º nó.** R24 e R25 viram um único `text-truncated` com a mensagem de R24 ("mostradas 2 de 5 linhas (~60% do conteúdo oculto)… (×2: mesmo problema em Sample[0..1])"). R25 mostra 1 linha de outro total. O "mesmo problema" vale para o código, não para os números. Sugestão: no agrupamento, omitir os números quando divergem, ou listar por path.
3. **(menor) Mensagem do `font-missing` para face do sistema não encontrada.**
   - Ela cita só a 1ª face ("Fonte \"Inter regular\" não está registrada"), embora o run bold também falte.
   - Ela manda "Registre a fonte em options.fonts", mas a face **foi** registrada e só não existe no sistema.
   - Sugestão: quando a família está em `fontsMissing`, dizer "não encontrada no sistema (procurado em …); instale a fonte ou informe `file`".

Conferido sem bug:
- XML × `lineRuns`: 38/38 caixas iguais, inclusive a reticência dentro do run bold (R24) e o `\n` dentro do Span (R22).
- NBSP preservado no XML.
- Runs adjacentes com o mesmo estilo saem fundidos.
- `--debug` não altera quebras nem larguras no Keynote.

## Sugestões para o AGENT_GUIDE / README

1. **Rich text:** dizer que `<B>`/`<I>`/`<Span>` são medidos com a face de cada trecho e que a quebra muda por isso (um trecho em negrito ocupa até 6–8 % a mais). Não é preciso deixar folga manual para negrito.
2. **NBSP:** recomendar ` ` (ou `&nbsp;` no JSX) entre número e unidade ("R$ 52,4 mi", "99,95&nbsp;%"). Também funciona com `lineBreaks: 'auto'`: o Keynote respeita.
3. **`nowrap`:** usar só em textos curtos que precisam ficar numa linha (valores, rótulos de KPI). Enquanto o bug 1 existir, avisar que um `nowrap` que estoura (`text-overflow` com `axis: 'width'`) **quebra em várias linhas no PowerPoint/Keynote**, diferente do preview, e precisa ser corrigido antes de entregar.
4. **`align="baseline"`:** funciona para marcador + texto e imagem + texto, com precisão abaixo de 0,3 pt no Keynote. Entre textos de tamanhos muito diferentes (40 pt ao lado de 12 pt), o renderizador pode deslocar cerca de 1 pt, o que não é visível em tamanho normal.
5. **Fontes do sistema:**
   - `fonts: [{ family: 'Helvetica', weight: 'regular' }, …]` sem `file` funciona, inclusive com `.ttc`.
   - Lembrar que `fonts` **substitui** o par Liberation→Arial: Text sem `font` passa a não ter face registrada.
   - Fontes como a Helvetica (hhea sem lineGap) dão linhas de 1,0 × size; considerar `lineHeight` 1,15–1,2 para corpo.
   - Fonte do sistema só renderiza igual numa máquina que a tenha.
6. **`embedFonts`:**
   - Só embute TrueType de uma face com licença que permite. `.ttc` e `.otf` CFF geram `font-not-embeddable`.
   - O Keynote ignora o embed e troca a fonte pela Helvetica.
   - O embed só ajuda no PowerPoint (EOT, conforme o spike).
   - A Arial padrão nunca é embutida.

## Artefatos (`<scratchpad>/m8h/`)

- Builds:
  - `calib/`, `calib-clean/`, `calib-auto/` (sem preview);
  - `demo/` (16x9 e 4x3), `demo-embed/`;
  - `sysfont/`, `sysfont-auto/`, `embed-lib/`, `embed-helv/`, `missing/`.
- Keynote: `kpdf-*.pdf` (um por deck); `kn-calib/`, `kn-calib-clean/`, `kn-demo-16x9/`, `kn-demo-4x3/` (PNGs em sRGB); `r-clean/`, `r-debug/` (calib em 4 px/pt).
- Dados:
  - `calib-tree.json` e `calib-recs.json` (engine);
  - `kruns-*.json` (linhas e estilo do Keynote);
  - `an-*.json` (comparação);
  - `widths.json` (largura por linha);
  - `demo-*`, `sysfont-*`.
- Recortes: `crop-r28-30.png`, `crop-r29-30.png`, `sys-native.png` × `sys-kn.png`, `embed-lib-cmp.png` (nativo em cima, Keynote embaixo).
- Ferramentas em `tools/`:
  - `dump.mts`: árvore posicionada;
  - `mkrecs.py`;
  - `xmlcheck.py`: XML × `lineRuns`;
  - `kexport.sh`: Keynote → PNG/PDF com timeout de 900 s;
  - `klocked.sh`: o mesmo, dentro da trava compartilhada;
  - `batch.sh`;
  - `pdfruns.swift`: linhas, fonte e cor por PDFKit;
  - `analyze.py`;
  - `widths.mts`;
  - `raster.swift`;
  - `base.py`: baselines no raster.
