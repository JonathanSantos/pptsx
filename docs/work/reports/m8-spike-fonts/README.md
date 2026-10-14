# Kit do spike M8-S — fonte embutida no .pptx

Relatório completo: [`../M8-spike-fonts.md`](../M8-spike-fonts.md).

Os cinco arquivos têm o mesmo slide: duas caixas de texto com `1 I l | Q G R a g @ & % 7 Æ ß` a 60 pt na fonte **Liberation Sans**, a de cima regular e a de baixo bold. O slide pede `typeface="Liberation Sans"`. A diferença entre os arquivos é só a fonte embutida (ou a falta dela).

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
| PowerPoint ___ | A-sem-embed |  |  | (esperado: não) |  |
| PowerPoint ___ | B-ttf-cru |  |  |  |  |
| PowerPoint ___ | C1-ofuscado-invertido |  |  |  |  |
| PowerPoint ___ | C2-ofuscado-direto |  |  |  |  |
| PowerPoint ___ | E-eot |  |  |  |  |
| Google Slides | A-sem-embed |  |  | (esperado: não) |  |
| Google Slides | B-ttf-cru |  |  |  |  |
| Google Slides | C1-ofuscado-invertido |  |  |  |  |
| Google Slides | C2-ofuscado-direto |  |  |  |  |
| Google Slides | E-eot |  |  |  |  |
| Keynote 14.4 (macOS 26) | todas | sim | não observável (sem acesso à UI) | **não**: Helvetica em todas | resultado do spike |
