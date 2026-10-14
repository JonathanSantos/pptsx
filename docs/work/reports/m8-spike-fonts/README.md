# Kit do spike M8-S — fonte embutida no .pptx

Relatório completo: [`../M8-spike-fonts.md`](../M8-spike-fonts.md).

## Rodada 2 (testar agora): F e G, família renomeada

A rodada 1 no PowerPoint para a web teve este resultado:
- B, C1 e C2 foram recusados ("We can't open this presentation because one or more embedded fonts can't be installed").
- A e E abriram, **idênticos** e com glifos parecidos com os da Liberation.

O PowerPoint web provavelmente trocou "Liberation Sans" por uma fonte equivalente da nuvem (Arimo, que tem o mesmo desenho). Assim não dá para saber se o E usou a fonte embutida. A rodada 2 tira essa ambiguidade com um nome de família que **não existe em lugar nenhum**: `PptsxProbe Sans`.

| arquivo | `typeface` no slide | `ppt/fonts/` | o que esperar se o embed funcionar |
|---|---|---|---|
| `F-eot-renomeada.pptx` | `PptsxProbe Sans` | EOT (formato do E) de um TTF da Liberation renomeado para `PptsxProbe Sans` (tabela `name`, cabeçalho EOT e `<p:embeddedFont>`), checksums recalculados | glifos **da Liberation**, iguais a `reference.png` |
| `G-controle-renomeada.pptx` | `PptsxProbe Sans` | nada | substituta genérica (Arial, Calibri ou outra), **diferente** de `reference.png` |

Como testar (PowerPoint web e, se puder, PowerPoint desktop):
1. Abra **G** primeiro e anote a fonte substituta: o nome na caixa de fonte e o desenho de `ß`, `@`, `R`, `G` e `Q`.
2. Abra **F** e compare com G e com `reference.png`, com zoom de 200 % ou mais.
   - **F = G** → o embed foi ignorado (ou a fonte foi recusada em silêncio).
   - **F = reference.png e F ≠ G** → o PowerPoint usou a fonte embutida, e o formato EOT está provado.
   - **F recusado** com "embedded fonts can't be installed" → anote o texto. É o mesmo sintoma de B/C, então algo no EOT renomeado incomodou o validador.
3. Anote se abriu sem reparo e se apareceu algum aviso de fonte.

Atenção ao critério visual: na Liberation Sans (`reference.png`) o **`1` não tem pé** (base horizontal). Se algum render mostrar `1` com pé, a fonte **não** é a Liberation nem a Arimo. Compare sempre com a imagem, não com descrições de memória.

---

## Rodada 1 (A–E)

Os cinco arquivos A–E têm o mesmo slide: duas caixas de texto com `1 I l | Q G R a g @ & % 7 Æ ß` a 60 pt na fonte **Liberation Sans**, a de cima regular e a de baixo bold. O slide pede `typeface="Liberation Sans"`. A diferença entre os arquivos é só a fonte embutida (ou a falta dela).

**Antes de testar, confira que a Liberation Sans NÃO está instalada na máquina.** Se estiver, o teste não vale. No Windows, procure em Configurações > Personalização > Fontes. No Mac, use o Catálogo de Fontes.

## Arquivos

| arquivo | o que tem dentro de `ppt/fonts/` | formato |
|---|---|---|
| `A-sem-embed.pptx` | nada | controle: mostra como fica a fonte substituta |
| `B-ttf-cru.pptx` | `font1.fntdata` (regular), `font2.fntdata` (bold) | bytes do `.ttf` sem nenhuma alteração |
| `C1-ofuscado-invertido.pptx` | `<GUID>.fntdata` ×2 | TTF com os 32 primeiros bytes em XOR com o GUID do nome do arquivo, bytes do GUID **de trás para a frente** (convenção do `.odttf` do Word/XPS) |
| `C2-ofuscado-direto.pptx` | `<GUID>.fntdata` ×2 | igual ao C1, com os bytes do GUID **na ordem da string** |
| `E-eot.pptx` | `font1.fntdata`, `font2.fntdata` | **EOT** (Embedded OpenType v2.1, sem compressão nem XOR): cabeçalho EOT seguido do TTF inteiro. É o formato que o LibreOffice espera ao importar `.fntdata` de pptx, então é o candidato mais provável para o PowerPoint |

Os quatro arquivos com embed têm também `embedTrueTypeFonts="1"` em `<p:presentation>`, `<p:embeddedFontLst>` em `presentation.xml`, relacionamentos do tipo `.../relationships/font` e `<Default Extension="fntdata" ContentType="application/x-fontdata"/>`.

## Como saber se a fonte embutida foi usada

Abra `reference-vs-substituta.png`. Em cima está a Liberation Sans de verdade (render do próprio projeto). Embaixo está a substituta que o Keynote usou (Helvetica). `reference.png` é só a parte de cima.

As larguras da Liberation são iguais às da Arial, então **as quebras de linha não servem para distinguir**. Olhe a forma dos glifos:

- `|`: na Liberation é longo e desce abaixo da linha de base. Na Helvetica tem a altura do `I`.
- `@`, `ß`, `&`: o desenho muda bastante entre as fontes.
- `R`: a perna da Liberation é uma diagonal reta. A Helvetica tem a perna quase vertical.
- `G` e `Q`: o esporão do `G` e a cauda do `Q`.

No PowerPoint para Windows a substituta provável é a **Arial**, que é bem mais parecida com a Liberation. Nesse caso compare principalmente `@`, `ß`, `G`, `Q` e `R` com a imagem de referência, com zoom de 200 % ou mais.

## PowerPoint (Windows ou Mac)

Para cada arquivo, nesta ordem: A, B, C1, C2, E.

1. Abra o arquivo com duplo clique.
2. Se aparecer "O PowerPoint encontrou um problema no conteúdo… Reparar?", anote **"pediu reparo"**, aceite e continue. Se o **A** também pedir reparo, a causa não é o embed: o `presentation.xml` do pptxgenjs tem `<p:sldIdLst>` antes de `<p:notesMasterIdLst>`, fora da ordem do schema. Nesse caso anote e siga.
3. Se aparecer um aviso de fonte ausente ou de "fontes incorporadas não podem ser usadas/editadas", anote o texto.
4. Compare os glifos com `reference.png`.
5. Confira os indícios de fonte incorporada:
   - **Windows:** Arquivo > Opções > Salvar > "Inserir fontes no arquivo" deve aparecer marcado nos arquivos com embed. Página Inicial > Substituir > Substituir Fontes lista as fontes do arquivo.
   - **Mac:** PowerPoint > Preferências > Salvar > "Inserir fontes no arquivo". Formatar > Substituir Fontes.
   - Clique no texto: a caixa de fonte deve mostrar "Liberation Sans". Se o nome vier em itálico ou com aviso de ausente, a fonte não carregou.
6. Feche sem salvar.

**Passo extra, o mais valioso se houver tempo:** instale a Liberation Sans temporariamente (os `.ttf` estão em `fonts/` do repo). Abra o `A-sem-embed.pptx`, marque "Inserir fontes no arquivo" (todas as fontes, não só os caracteres usados) e salve como `D-powerpoint-nativo.pptx`. Depois desinstale a fonte e me devolva o arquivo. Com ele dá para comparar byte a byte o `.fntdata` que o PowerPoint gera com B, C e E, sem adivinhar o formato.

## Google Slides

1. Faça upload dos cinco arquivos no Google Drive.
2. Abra cada um com "Abrir com > Apresentações Google". Isso converte o arquivo; abrir só na pré-visualização do Drive não converte.
3. Compare os glifos com `reference.png`. O Slides costuma trocar fontes que não estão no catálogo do Google Fonts, e a Liberation Sans não está.
4. Clique no texto e anote o nome que aparece na caixa de fonte.
5. (Opcional) Arquivo > Fazer download > Microsoft PowerPoint e veja se `ppt/fonts/` sobreviveu (`unzip -l arquivo.pptx | grep fonts`).

## Tabela para preencher

"Abriu sem reparo?": sim / pediu reparo / não abriu. "Usou a fonte embutida?": sim / não (substituta: qual?).

| aplicativo (versão, SO) | variante | abriu sem reparo? | aviso de fonte? | usou a fonte embutida? | observações |
|---|---|---|---|---|---|
| **PowerPoint web** | G-controle-renomeada |  |  | (esperado: não) | substituta: ___ |
| **PowerPoint web** | F-eot-renomeada |  |  | F = G? F = reference? | rodada 2: decide |
| PowerPoint desktop ___ | G-controle-renomeada |  |  | (esperado: não) |  |
| PowerPoint desktop ___ | F-eot-renomeada |  |  |  |  |
| PowerPoint web | A-sem-embed | sim | — | inconclusivo | glifos parecidos com Liberation (rodada 1) |
| PowerPoint web | B-ttf-cru | **não abriu** | "one or more embedded fonts can't be installed" | — | rodada 1 |
| PowerPoint web | C1-ofuscado-invertido | **não abriu** | idem | — | rodada 1 |
| PowerPoint web | C2-ofuscado-direto | **não abriu** | idem | — | rodada 1 |
| PowerPoint web | E-eot | sim | — | inconclusivo | idêntico ao A (rodada 1) |
| PowerPoint desktop ___ | A-sem-embed |  |  | (esperado: não) |  |
| PowerPoint desktop ___ | B-ttf-cru |  |  |  |  |
| PowerPoint desktop ___ | C1-ofuscado-invertido |  |  |  |  |
| PowerPoint desktop ___ | C2-ofuscado-direto |  |  |  |  |
| PowerPoint desktop ___ | E-eot |  |  |  |  |
| Google Slides | A-sem-embed |  |  | (esperado: não) |  |
| Google Slides | B-ttf-cru |  |  |  |  |
| Google Slides | C1-ofuscado-invertido |  |  |  |  |
| Google Slides | C2-ofuscado-direto |  |  |  |  |
| Google Slides | E-eot |  |  |  |  |
| Google Slides | G-controle-renomeada |  |  | (esperado: não) |  |
| Google Slides | F-eot-renomeada |  |  |  |  |
| Keynote 14.4 (macOS 26) | A–G, todas | sim | não observável (sem acesso à UI) | **não**: Helvetica em todas (F = G = A byte a byte) | resultado do spike |

`build.mts` (rodada 1) e `build2.mts` (rodada 2) são os scripts que geraram os arquivos. Rode da raiz do repo com `npx tsx <script> <pasta-saída>`. Os GUIDs de C1/C2 são aleatórios a cada execução.

## Resultado (dono, PowerPoint web, 13/10/2026)

| Arquivo | Abriu | Fonte embutida usada |
|---|---|---|
| A-sem-embed | sim | — (substituta com `1` de pé) |
| B-ttf-cru | **não** ("embedded fonts can't be installed") | — |
| C1-ofuscado-invertido | **não** | — |
| C2-ofuscado-direto | **não** | — |
| E-eot | sim | indeterminado (igual ao A) |
| F-eot-renomeada | sim | **sim** (glifos da Liberation) |
| G-controle-renomeada | sim | não (substituta com `1` de pé, igual ao A) |

Conclusão: formato = EOT v2.1 sem compressão/XOR; o PowerPoint web usa a fonte embutida (F ≠ G, F = Liberation).
