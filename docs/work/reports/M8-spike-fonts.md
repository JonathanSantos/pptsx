# M8-S — Spike: fonte embutida no .pptx (Keynote, PowerPoint, Google Slides)

**Veredito no Keynote: IGNORA o embed.** Testei quatro formatos de `.fntdata`: TTF cru, TTF ofuscado (ECMA-376) com chave invertida, o mesmo com chave direta, e EOT. Em todos o Keynote 14.4 abriu o arquivo e renderizou com **Helvetica** no lugar da Liberation Sans. As PNGs exportadas são **idênticas byte a byte** às do controle sem embed. O Keynote também **descarta** as fontes quando reexporta para .pptx.

**PowerPoint para a web (rodada 1, testado pelo dono):** recusa B, C1 e C2 com "We can't open this presentation because one or more embedded fonts can't be installed". Abre A e E. **Conclusão parcial: o formato que o PowerPoint aceita é EOT.** Falta provar que ele *usa* a fonte. A e E saíram idênticos, com desenho parecido com o da Liberation, provavelmente porque o PowerPoint web troca "Liberation Sans" pela Arimo da nuvem. A **rodada 2** (F e G, família renomeada para `PptsxProbe Sans`) existe para tirar essa dúvida. No Keynote, F e G também saem em Helvetica e idênticos byte a byte ao A.

**Google Slides e o resultado da rodada 2 ficam pendentes.** O kit para o dono testar está em [`m8-spike-fonts/`](m8-spike-fonts/README.md).

**Recomendação para o M8-D:** implementar o embed **em EOT** só se F ≠ G no PowerPoint, ou seja, se ele usar a fonte embutida. O embed não traz nada para o Keynote e provavelmente nada para o Google Slides. Se houver vencedor, ele entra como pós-processamento do zip (`src/emit/embed.ts`, no mesmo molde do `sanitize.ts`) e desligado por padrão. Detalhes no fim.

## Objetivo

Responder com evidência se um `.pptx` com fonte embutida é respeitado por Keynote, PowerPoint e Google Slides, e em qual formato de `.fntdata`. Em discussão: TTF cru, TTF ofuscado conforme ECMA-376 ou EOT.

## Ambiente

- macOS 26.6.2, Keynote 14.4, Node 24.17 + tsx. Não há PowerPoint, Google Slides nem validador OOXML.
- Fonte de teste: Liberation Sans Regular e Bold de `fonts/`, **não instalada no sistema**. Conferi `~/Library/Fonts`, `/Library/Fonts` e `system_profiler SPFontsDataType`. A licença é SIL OFL 1.1. `OS/2.fsType` = 0 (instalável), então nenhuma flag da fonte proíbe o embed.
- A Liberation tem as mesmas métricas da Arial e larguras próximas das da Helvetica, então a detecção é feita **pelo desenho dos glifos**, com o texto `1 I l | Q G R a g @ & % 7 Æ ß` a 60 pt.

## Método

Script `build.mts` no scratchpad (`<scratchpad>/m8s/`, rodado com `npx tsx`):

1. **Deck base** pelo próprio projeto: `render()` de `src/render.ts` com 1 slide 16x9 e dois `Text` absolutos (680 pt de largura, 60 pt, `font: 'Liberation Sans'`, regular e bold), `options.fonts` = `[{ family: 'Liberation Sans', weight: 'regular'|'bold', file: fonts/LiberationSans-*.ttf }]` e `preview: { mode: 'native', width: 1440 }`. O resultado:
   - o `.pptx` sai com `typeface="Liberation Sans"` em todos os runs;
   - zero diagnósticos;
   - o PNG do resvg serve de **referência** com a Liberation real.
2. **Variantes** por pós-processamento do zip com jszip, mesma técnica do `sanitize.ts`. O controle **A** é o buffer do `render` sem alteração. Em B, C1, C2 e E:
   - `[Content_Types].xml`: `<Default Extension="fntdata" ContentType="application/x-fontdata"/>`.
   - `ppt/_rels/presentation.xml.rels`: um relacionamento por face.
     ```xml
     <Relationship Id="rIdFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>
     <Relationship Id="rIdFont2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font2.fntdata"/>
     ```
   - `ppt/presentation.xml`: `embedTrueTypeFonts="1"` no elemento raiz (o pptxgenjs já escreve `saveSubsetFonts="1"`) e a lista logo depois de `<p:notesSz>`, antes de `<p:defaultTextStyle>`, como pede o `CT_Presentation`:
     ```xml
     <p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="5143500" cy="9144000"/>
     <p:embeddedFontLst><p:embeddedFont>
       <p:font typeface="Liberation Sans" pitchFamily="34" charset="0"/>
       <p:regular r:id="rIdFont1"/><p:bold r:id="rIdFont2"/>
     </p:embeddedFont></p:embeddedFontLst>
     <p:defaultTextStyle>…
     ```
3. **Conteúdo do `.fntdata`** por variante:

| variante | parte | bytes |
|---|---|---|
| A — controle | — | — |
| B — TTF cru | `ppt/fonts/font1.fntdata`, `font2.fntdata` | `.ttf` sem alteração (começa com `00 01 00 00`) |
| C1 — ofuscado, chave invertida | `ppt/fonts/<GUID>.fntdata` | XOR dos 32 primeiros bytes: `byte[i] ^= key[i mod 16]`. `key` = os 16 bytes da string do GUID (sem `-`) **lidos de trás para a frente** (convenção do `w:fontKey`/`.odttf` do Word e do LibreOffice) |
| C2 — ofuscado, chave direta | idem | idem, com `key` na ordem da string |
| E — EOT (extra, fora do pedido) | `ppt/fonts/font1.fntdata`, `font2.fntdata` | cabeçalho EOT v2.1 (`0x00020001`), `Flags = 0` (sem subset, MTX ou XOR), seguido do TTF inteiro |

O GUID vai no nome **sem chaves**, por exemplo `B5D0C95A-92EE-4D8A-B4BE-474FFDFB8B0F.fntdata`. `{` e `}` não são válidos em part names OPC, e o XPS também usa o GUID puro. A chave sai dos 32 dígitos hexadecimais do mesmo jeito.

Conferi as variantes ofuscadas de volta: desofuscar C1 e C2 com a regra de cada uma devolve o TTF original byte a byte.

**Por que a variante E:** no PresentationML, `<p:regular>` só tem `r:id`. Não existe `fontKey` como no WordprocessingML, então a ofuscação com GUID não tem respaldo explícito no schema do pptx. O importador de pptx do LibreOffice (`oox`, `EmbeddedFontsHelper::addEmbeddedFont(..., bEot = true)`) trata o `.fntdata` como **EOT**. Isso indica que o PowerPoint grava EOT. Não verifiquei aqui, porque não há PowerPoint nem `.pptx` nativo com fonte embutida na máquina: varri os 673 `.pptx` que o Spotlight acha e nenhum tem `ppt/fonts/`. Por isso incluí E no kit.

Montagem do cabeçalho EOT, em little-endian:
- 80 bytes fixos: `EOTSize`, `FontDataSize`, `Version`, `Flags`, PANOSE (do OS/2), `Charset=1`, `Italic`, `Weight`, `fsType`, `MagicNumber=0x504C`, `UnicodeRange1-4`, `CodePageRange1-2`, `head.checkSumAdjustment` e quatro `Reserved` zerados;
- depois, quatro pares padding/tamanho/UTF-16LE para FamilyName ("Liberation Sans"), StyleName ("Regular"/"Bold"), VersionName e FullName;
- RootString vazio;
- `FontData`.

### Teste no Keynote

- PNG: `scripts/keynote-export.sh` para cada variante.
- PDF: script equivalente com `export … as PDF`. O PDF registra o nome da fonte que o Keynote **realmente** usou (`/BaseFont`).
- Fonte reportada: AppleScript `font of object text of text item i of slide 1`, depois de abrir o arquivo.
- Comparação por pixel: PDF rasterizado a 1440 px (`sips`) contra a referência do resvg e contra o controle A, com Python/PIL. Inspeção visual com Read de `1 I l | Q G R @ ß`.
- Round-trip: abrir B no Keynote e exportar como PowerPoint.

**Validação do XML:** todas as partes `.xml`/`.rels` dos cinco arquivos passam no `xml.dom.minidom`. Os alvos dos relacionamentos de fonte existem e o content type está presente.

**Achado lateral (já existia, não vem do embed):** o pptxgenjs escreve `<p:sldIdLst>` **antes** de `<p:notesMasterIdLst>`, fora da ordem do `CT_Presentation`, inclusive no controle A. O Keynote ignora. Se o PowerPoint pedir "reparar" no A, a causa é essa. A instrução está no README do kit.

## Resultados no Keynote 14.4

| variante | abriu? | reparo/erro? | `/BaseFont` no PDF exportado | fonte reportada (AppleScript) | PNG × controle A | PDF × referência Liberation | glifos |
|---|---|---|---|---|---|---|---|
| A — sem embed | sim | não | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | — | 69 % da tinta difere | Helvetica |
| B — TTF cru | sim | não | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | **idêntico byte a byte** | 69 % (igual A) | Helvetica |
| C1 — ofuscado invertido | sim | não | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | **idêntico byte a byte** | 69 % (igual A) | Helvetica |
| C2 — ofuscado direto | sim | não | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | **idêntico byte a byte** | 69 % (igual A) | Helvetica |
| E — EOT | sim | não | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | **idêntico byte a byte** | 69 % (igual A) | Helvetica |

"Tinta difere" = pixels com diferença > 32 níveis de cinza, sobre os pixels escuros da referência. Entre as cinco variantes, a diferença é 0 pixel.

- **Glifos:** em todas as variantes, `|` fica curto (na Liberation desce abaixo da linha de base), `@` e `ß` têm o desenho da Helvetica e o `R` tem a perna vertical. Ver `m8-spike-fonts/reference-vs-substituta.png`.
- **Aviso de "fonte ausente":** não deu para observar. O AppleScript não tem permissão de acessibilidade (System Events), então não li a UI do Keynote. O comportamento é o mesmo do controle A: o Keynote troca a fonte na importação e já reporta "Helvetica" no modelo do documento.
- **Round-trip:** o Keynote exporta o `.pptx` com `typeface="Liberation Sans"` preservado nos runs, mas **sem** `ppt/fonts/`, sem `<p:embeddedFontLst>` e sem `embedTrueTypeFonts`. O Keynote não lê nem grava fonte embutida em pptx. Por isso a variante "D" (fntdata gerado pelo Keynote) não existe.

## Rodada 1 no PowerPoint para a web (resultado do dono)

| variante | abriu? | mensagem | glifos |
|---|---|---|---|
| A — sem embed | sim | — | parecidos com os da Liberation |
| B — TTF cru | **não** | "We can't open this presentation because one or more embedded fonts can't be installed" | — |
| C1 — ofuscado invertido | **não** | idem | — |
| C2 — ofuscado direto | **não** | idem | — |
| E — EOT | sim | — | idênticos aos do A |

- **Formato = EOT** (conclusão parcial). O PowerPoint web lê o `.fntdata` e valida a fonte. TTF cru e TTF ofuscado com GUID não passam. O EOT v2.1 sem compressão nem XOR passa.
- **Uso não provado.** Com "Liberation Sans" sem embed (A), o PowerPoint web já mostra glifos parecidos com os da Liberation. A explicação provável é a substituição pela Arimo, o desenho original da Liberation, pelas fontes de nuvem do Office. Então E = A não separa "usou a embutida" de "substituiu bem".
- Observação sobre o critério visual: na referência do resvg (`reference.png`) o `1` da Liberation Sans 2.1.5 **não tem pé**. Se o dono viu `1` com pé em A/E, a fonte exibida não era nem a Liberation nem a Arimo. Vale comparar de novo com a imagem na rodada 2.

## Rodada 2: família renomeada (`PptsxProbe Sans`)

**Ideia:** dar à fonte um nome que nenhum catálogo conhece. Sem embed (G), o PowerPoint é obrigado a usar uma substituta genérica. Com embed (F), só aparecem glifos da Liberation se a fonte embutida for usada.

**Patch do TTF** (`build2.mts`):
- Substituição de bytes de mesmo comprimento, em ASCII e em UTF-16BE: `Liberation Sans` → `PptsxProbe Sans` (15) e `LiberationSans` → `PptsxProbeSans` (14). Por arquivo foram 3 + 3 ocorrências do nome com espaço e 1 + 1 sem espaço.
- O fontkit confirma o resultado. Regular: `familyName` "PptsxProbe Sans", `postscriptName` "PptsxProbeSans", `fullName` "PptsxProbe Sans". Bold: `PptsxProbeSans-Bold`, "PptsxProbe Sans Bold". O `uniqueSubfamily` vira "Ascender - PptsxProbe Sans".
- Ficam intactos os textos de copyright e trademark ("Liberation is a trademark…"). O OFL proíbe o nome reservado em versão modificada, então renomear é o que a licença pede. Esse arquivo serve só para teste.
- **Checksums recalculados**, um desvio do pedido ("registre e siga"). A troca deixou divergente só o checksum da tabela `name` (`0xdb3272ff` → `0xc084b9f1`) e, com ele, o `head.checkSumAdjustment`. Recalculei os dois, cerca de 15 linhas, porque o PowerPoint web já mostrou que valida a fonte ("can't be installed"). Assim uma recusa por checksum não custa outra rodada ao dono. Um verificador independente em Python confirma: nenhuma tabela divergente e `checkSumAdjustment` correto nos dois TTFs renomeados (e também no original).

**Arquivos:**
- **F-eot-renomeada.pptx:**
  - `typeface="PptsxProbe Sans"` nos 12 `<a:latin>`/`<a:ea>`/`<a:cs>` do slide e no `<p:font>` do `<p:embeddedFont>`;
  - `ppt/fonts/font1.fntdata` e `font2.fntdata` em EOT, gerados do TTF renomeado. FamilyName do cabeçalho EOT = "PptsxProbe Sans"; FullName = "PptsxProbe Sans" e "PptsxProbe Sans Bold";
  - o resto é igual ao E: rels, content type, `embedTrueTypeFonts="1"`.
- **G-controle-renomeada.pptx:** mesmo slide, sem embed.
- O render de referência do resvg com a fonte renomeada é **idêntico pixel a pixel** ao `reference.png` da rodada 1 (`getbbox()` da diferença = `None`). A referência continua valendo.

**Keynote 14.4:**

| variante | abriu? | `/BaseFont` no PDF | fonte reportada (AppleScript) | PNG |
|---|---|---|---|---|
| F — EOT renomeada | sim, sem erro | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | idêntico byte a byte ao G e ao A |
| G — controle renomeada | sim, sem erro | `Helvetica`, `Helvetica-Bold` | Helvetica / Helvetica-Bold | idêntico byte a byte ao A |

Como esperado, o Keynote ignora o embed também com o nome inédito. Validação: todas as partes XML de F e G estão bem formadas; os alvos dos relacionamentos de fonte existem; o content type `fntdata` está presente. A ordem `sldIdLst`/`notesMasterIdLst` vem do pptxgenjs, como antes.

## Pendente para o dono

Kit em `docs/work/reports/m8-spike-fonts/`:
- rodada 2: `F-eot-renomeada.pptx` e `G-controle-renomeada.pptx`;
- rodada 1: `A-sem-embed.pptx`, `B-ttf-cru.pptx`, `C1-ofuscado-invertido.pptx`, `C2-ofuscado-direto.pptx`, `E-eot.pptx`;
- `reference.png` (Liberation real, 37 KB) e `reference-vs-substituta.png` (Liberation × Helvetica, 81 KB);
- scripts `build.mts` e `build2.mts`;
- `README.md` com os passos e a tabela, já preenchida com a rodada 1 do PowerPoint web.

1. **Rodada 2 no PowerPoint web (decisiva):** abrir G, anotar a substituta, abrir F e comparar com G e com `reference.png`.
   - F = Liberation e F ≠ G → o EOT funciona e o M8-D implementa.
   - F = G → o PowerPoint web aceita o EOT mas não usa a fonte.
   - F recusado → algo no EOT renomeado (anotar a mensagem).
2. **PowerPoint desktop (Windows/Mac), se houver:** repetir F/G. O desktop instala fontes embutidas de forma diferente do web, e o resultado pode divergir.
3. **Passo extra opcional:** com a fonte instalada, salvar um pptx com "Inserir fontes no arquivo" no PowerPoint desktop e devolver. O cabeçalho do `.fntdata` nativo mostra se o PowerPoint grava EOT com MTX/XOR ou sem compressão. Isso afina o formato, mas a rodada 1 já mostrou que o EOT sem compressão é aceito.
4. **Google Slides:** importar F e G (e, se quiser, A–E) e anotar a fonte exibida. A expectativa é substituição em todos.

## Recomendação para o M8-D

1. **Formato: EOT v2.1 sem compressão (MTX) e sem XOR**, como em E/F: cabeçalho de 80 bytes + nomes em UTF-16LE + TTF inteiro. TTF cru e TTF ofuscado com GUID estão **descartados**, porque o PowerPoint web recusa os dois. A implementação fica condicionada à rodada 2:
   - **F ≠ G** (o PowerPoint usa a fonte embutida) → implementar `embedFonts` em EOT.
   - **F = G** → o embed só "passa no validador" e não muda o render. O M8 fecha o critério com "o spike conclui que não vale, com evidência" e o `embedFonts` não entra. Ou entra só se o PowerPoint desktop mostrar diferença.

   O Keynote ignora o embed em todos os formatos e não serve de base para a escolha.
2. **Onde no pipeline.** `src/emit/embed.ts`, como pós-processamento do buffer (`JSZip.loadAsync` → partes → `generateAsync`), encadeado depois do `sanitizePptx`. Ele recebe as faces usadas, já resolvidas, por injeção a partir do `render.ts`. A leitura dos `.ttf` (IO) fica na borda e as funções de montagem de XML e de bytes ficam puras:
   - `toEot(ttf, names)`, com os nomes lidos da tabela `name` via fontkit
   - `embeddedFontListXml(faces)`
   - `fontRelationshipsXml(faces)`
   - `insertAfterNotesSz(presXml, fragment)`

   O código do spike (`build.mts`/`build2.mts`) cobre tudo isso em cerca de 100 linhas.
3. **Cuidados:**
   - **Uma família por `<p:embeddedFont>`** com até quatro faces (`regular`, `bold`, `italic`, `boldItalic`). `typeface` igual ao do `<a:latin>` dos runs, que é a família lógica do deck. Atenção: com os `DEFAULT_FONTS` o pptx sai como "Arial" e embutir Liberation com o nome "Arial" seria errado. Só embutir faces cuja família emitida é o nome interno real da fonte.
   - **Ordem do schema:** `<p:embeddedFontLst>` depois de `<p:notesSz>` (ou `<p:smartTags>`) e antes de `<p:custShowLst>`/`<p:defaultTextStyle>`. Marcar `embedTrueTypeFonts="1"`. Avaliar se mantém `saveSubsetFonts="1"` do pptxgenjs, que faz o PowerPoint regravar só um subconjunto da fonte quando o usuário salva.
   - **Licença:** respeitar `OS/2.fsType`. Bit 1 (restricted) → não embutir e emitir diagnóstico. Bits 2/3 (preview & print / editable) → embutir é permitido, mas o PowerPoint pode abrir somente leitura. OFL (Liberation, Inter etc.) permite.
   - **Tamanho:** cerca de 410 KB por face da Liberation. Quatro faces somam cerca de 1,6 MB num deck de 15 KB. Subset (só os glifos usados) reduz muito, mas exige reescrever o TTF (fontkit `createSubset`) e muda o checksum. Fica para depois. O EOT tem flag de subset (`TTEMBED_SUBSET`).
   - **Padrão desligado** (`embedFonts: false`), com documentação explicando que Keynote ignora, e o Google Slides provavelmente também.
   - **Validação do PowerPoint:** ele recusa o arquivo inteiro (não só a fonte) quando não consegue instalar uma fonte embutida. Gerar o EOT com os campos do cabeçalho tirados do próprio TTF (PANOSE, pesos, ranges, `checkSumAdjustment`) e nunca embutir um TTF com checksums inválidos. Se o M8-D algum dia fizer subset, recalcular os checksums como no `build2.mts`.

## Resultado do dono — rodada 2 no PowerPoint para a web (13/10/2026)

**F-eot-renomeada.pptx abriu e renderizou com os glifos da Liberation** (`1` sem pé, `R` de perna reta, `Q` de cauda diagonal, `@` de cauda longa), diferente da substituta que o PowerPoint usou no A/E (`1` com pé). Como a família "PptsxProbe Sans" não existe em nenhum sistema nem na nuvem, os glifos só podem ter vindo do EOT embutido.

**Veredito final:** o PowerPoint (web) respeita fontes embutidas em **EOT v2.1 sem compressão e sem XOR**; recusa o arquivo inteiro com TTF cru e com as duas ofuscações. O Keynote ignora qualquer embed. Google Slides não testado (provável que ignore).

**Decisão para o M8-D/E:** implementar o embed como opção desligada por padrão (`embedFonts: true`), pós-processamento do zip depois do sanitize, só com faces usadas no deck, nunca a Liberation sob o nome Arial, respeitando `OS/2.fsType` (bit restrito → `font-not-embeddable`). Já contratado em CONTRACTS.md §M8.

**G-controle-renomeada.pptx** (dono, PowerPoint web): substituta com `1` de pé e `@` de cauda curta, igual ao A. **F ≠ G e F = Liberation: prova completa.**
