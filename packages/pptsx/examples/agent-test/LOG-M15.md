# LOG M15 — tema, seções, oculto e notas num deck existente (agente sem contexto, só `docs/AGENT_GUIDE.md`)

Arquivos: `examples/agent-test/m15/deck.tsx` (cópia de `examples/demo.tsx` com imports `../../…`) e `examples/agent-test/m15/pptsx.config.ts`.

Mudanças no deck:
- `sections`: Abertura (1), Resultados (2), Encerramento (6), Reserva (7).
- Slide 7 novo, `<Slide hidden>` "Reserva: metodologia", feito com primitivas (mesma aparência do `ContentLayout`).
- Notas formatadas nesse slide 7: `<B>` + `{'\n'}` (parágrafo) + `<I>`.

Config: tema com `dark1 = ink/brand (#1B2A4A, mesmo hex: um slot só)`, `light1 = white`, `dark2 = brandDark`, `light2 = surface`, `accent1 = accent`, `accent2 = positive`, `accent3 = negative`, `accent4 = muted`, `accent5 = accentSoft`; fontes do tema Arial/Arial; `document` com author, company, subject e keywords.

## Comando

```
cd examples/agent-test/m15 && npx tsx ../../../src/cli.ts build deck.tsx --size 16x9,4x3 --out <scratchpad>/agent-m15 --json; echo "exit $?"
```

## Número de builds: 1

### Build 1 — exit 0

Nenhum diagnóstico (nem `info`), nos dois tamanhos. Nada a mudar; não houve 2º build.

## O que conferi no .pptx

Conferido em `deck.16x9.pptx` e `deck.4x3.pptx` (resultados iguais):

| verificação | resultado |
|---|---|
| cores do tema em `ppt/theme/theme1.xml` | OK: `<a:clrScheme name="Plataforma de Dados">` com dk1 1B2A4A, lt1 FFFFFF, dk2 101B33, lt2 F4F6FA, accent1 2F6FED, accent2 1E9E6A, accent3 D64545, accent4 5B6680, accent5 E8EEFC; accent6 ficou o do Office (70AD47), como o guia diz. `majorFont`/`minorFont` = Arial |
| slides usam `<a:schemeClr` | OK: os 7 slides têm **zero** `<a:srgbClr`; tudo é `tx1`/`bg1`/`tx2`/`bg2`/`accent1..5` (dk1 sai como `tx1`, lt1 como `bg1` etc.). Texto com `typeface="+mn-lt"`. No gráfico (`ppt/charts/chart1.xml`) a série é `accent1` e o texto `tx1`, mas eixo/grade saem fixos `888888`/`DDDDDD` (cores da engine, não do deck: esperado) |
| seções em `ppt/presentation.xml` | OK: 4 `<p14:section>` — Abertura {256}, Resultados {257–260}, Encerramento {261}, Reserva {262} |
| slide oculto com `show="0"` | OK: só `slide7.xml` tem `<p:sld … show="0">` |
| notas com `b="1"` | OK: `notesSlide7.xml` tem 2 parágrafos `<a:p>`; o 1º com o trecho "só se perguntarem" em `b="1"`, o 2º com "preliminares" em `i="1"`. Os outros notesSlides não têm `b="1"` |
| `docProps/core.xml` com autor e palavras-chave | OK: `dc:creator` = "Time da Plataforma de Dados", `cp:keywords` = "resultados, q3-2026, plataforma de dados", `dc:subject` presente; `docProps/app.xml` tem `<Company>Empresa S.A.</Company>`. `dc:title` = "deck" (nome do arquivo, porque não dei `document.title`, conforme o guia) |

## O que vi nos PNGs

- Overview 16:9 e 4:3: sem selos. Nome da seção sob o 1º slide de cada uma ("1 · Abertura", "2 · Resultados", "6 · Encerramento", "7 · Reserva · oculto"); o slide 7 sai esmaecido com "oculto", como o guia descreve.
- Slides 1–6 idênticos ao demo (o tema não muda o layout). Em 4:3 o slide 3 empilha lista e gráfico.
- Slide 7 (PNG individual): título com barra, cartão `surface` com as duas definições e a fonte no rodapé do cartão. Em 4:3 o cartão tem bastante área vazia (é slide de reserva; aceitável, mas daria para usar `justifyContent` ou fonte maior no `tall`).

## Lacunas do guia

1. **§9 "Cor do tema só com hex exato" cita `theme: themeOf(tokens)`**, mas `themeOf` não aparece em nenhum outro lugar do guia: não diz de onde importar (`pptsx`? `examples/tokens.ts`? não existe em `tokens.ts`), nem qual slot recebe cada token. Montei o tema à mão.
2. **Tokens com o mesmo hex (§2 "Arquivo para editar")**: o guia não diz o que acontece se dois slots do tema tiverem o mesmo hex (qual `schemeClr` o slide recebe). `brand` e `ink` são ambos `#1B2A4A`; evitei a ambiguidade usando um slot só, mas a regra deveria estar escrita. Também não diz que `dark1`/`light1` saem como `tx1`/`bg1` (e `dark2`/`light2` como `tx2`/`bg2`), o que confunde quem procura `dk1` no slide.
3. **`hidden` e `notes` rich num layout (§2 "Slide oculto"/"Notas formatadas" e §5)**: o guia diz "`hidden` num layout", mas `CoverLayout`/`ContentLayout`/`ClosingLayout` de `examples/layouts/` não aceitam `hidden`, e o `notes` do `ContentLayout` é tipado `string` (a tabela da §5 só diz `notes?`). Para notas com negrito ou slide oculto num slide de layout pronto é preciso escrever o `<Slide>` à mão (foi o que fiz) ou um layout próprio; o guia deveria dizer isso.
4. **Config lida da pasta do build (§7, §9)**: claro, mas não diz como os imports de `pptsx.config.ts` resolvem caminhos (importei `../../tokens.ts` relativo à config e funcionou) nem se `fonts.heading`/`fonts.body` precisam ser famílias registradas em `fonts`.
5. **`document.title`**: o guia diz que sem ele a CLI usa o nome do arquivo; com o deck chamado `deck.tsx` o título fica "deck". Uma dica "dê `title` quando o arquivo se chama `deck.tsx`" ajudaria.
