# M4-E — Validação visual: overflow e diagnósticos

**Veredito: PASSA.** Nenhum texto some sem um diagnóstico correspondente. Cada slide lotado termina de um destes jeitos: com a fonte reduzida (info), com reticências (warning) ou com o estouro visível e reportado (error). O preview nativo e o Keynote mostram as mesmas linhas. Os selos do overview estão corretos e legíveis. Os problemas encontrados são menores: lacunas no exemplo e detalhes nas mensagens.

## Comandos

```
node bin/tsx-slides.mjs build examples/overflow.tsx --out dist/m4v --debug        # exit 1 (esperado)
node bin/tsx-slides.mjs build examples/overflow.tsx --out dist/m4v-clean          # exit 1 (esperado)
scripts/keynote-export.sh dist/m4v-clean/overflow.16x9.pptx dist/m4v-clean/keynote
scripts/keynote-export.sh dist/m4v/overflow.16x9.pptx dist/m4v/keynote
# extra (deck no scratchpad, cobre o que o exemplo não cobre: shrink no mínimo + slide só com warning)
(cd <scratchpad> && node <repo>/bin/tsx-slides.mjs build m4e/extra.tsx --out <repo>/dist/m4v-extra --debug)
scripts/keynote-export.sh dist/m4v-extra/extra.16x9.pptx dist/m4v-extra/keynote
```

Resumo do overflow.tsx: 3 error, 2 warning, 5 info, com o mesmo resultado em debug e no build limpo.

## Por slide (16x9)

| Slide | Esperado | Nativo | Keynote | Status |
|---|---|---|---|---|
| 1 | Bullets encolhem juntas, título intacto, info | As 4 bullets passam de 20 para 19 pt (`spcPts` 2185 nas 4). Título em 26 pt (2990). Tudo cabe. 4× `text-shrunk` | Mesmas 11 linhas e mesmas quebras. Tudo cabe | OK |
| 2 | Texto reduzido (info) e cabe | 20 → 18 pt, 12 linhas dentro da caixa cinza | Mesmas 12 linhas, dentro da caixa | OK |
| 3 | truncate com "…"; `fit="error"` vaza e é reportado; maxLines=1 com "…" | Caixa esquerda: 6 linhas terminando em "mantendo a…". Caixa direita: 8 linhas, e a última ("todo o trimestre.") passa da caixa rosa. No debug a área estourada aparece em vermelho. Rodapé: 1 linha com "migramos os…" | Igual: as mesmas linhas e o mesmo vazamento da última linha | OK |
| 4 | `box-overflow` + `out-of-slide`; elipse absoluta sem diagnóstico | O 3º retângulo sai 128 pt pela direita (cortado pelo slide). No debug ele fica destacado em vermelho. A elipse não gera diagnóstico | Idêntico | OK (o corte pelo slide está reportado) |
| extra 1 | shrink no mínimo e ainda estoura → error | 20 → 18 pt (minSize). Error com 49.4 pt / 18.9 %. A última linha encosta na borda do slide | Mesmas quebras. Por causa da entrelinha truncada (abaixo), cabe ≈ 1 linha a mais | OK |
| extra 2 | só warning → selo amarelo | 3 linhas com "…" | Igual | OK |

**Texto escondido sem diagnóstico:** nenhum caso. No XML do slide 3, o conteúdo truncado termina em "…" e não sobra run oculto. O caso de `fit="error"` mantém o texto inteiro.

**Quebras de linha:** são idênticas entre nativo e Keynote em todos os slides. Já a entrelinha do Keynote fica de 0,7 a 1 pt menor por linha, porque ele trunca `spcPts` para pt inteiro (achado conhecido do M3). Na prática:
- o Keynote nunca fica mais alto que o preview, então o lado seguro está garantido;
- o vazamento de um `fit="error"` aparece um pouco menor no Keynote (≈ 4 pt em 8 linhas).

**Slide 1, 4ª bullet:** termina em "e re" porque o próprio exemplo usa `long.slice(0, 140)`. A engine não corta nada ali, mas para quem revisa parece exatamente um corte silencioso.

## Overview

- Slides 3 e 4 (error) mostram o selo **vermelho**. Os slides 1 e 2 (só info) ficam sem selo. Extra 2 (só warning) mostra o selo **amarelo**.
- Os selos ficam no canto superior direito, com ≈ 20 px, e são legíveis. No debug, a faixa vermelha do estouro também aparece na miniatura.
- O `overflow.tsx` não tem nenhum slide só com warning, por isso o amarelo só foi validado no deck extra.

## Mensagens (lidas como um LLM que só tem o diagnostics.json + overview)

Em geral elas dizem o que aconteceu, quanto e o que fazer, e o path aponta para o nó certo nos 10 + 2 casos. Simulei a correção de cada error:

- **Slide 3, `text-overflow` (`Slide > Box > Box[1] > Text`, 21.2 pt):** bastou. Dá para trocar para `fit="shrink"` ou subir `height` de 150 para ≈ 172.
- **Extra 1 (49.4 pt, 18.9 %, "mesmo em 18 pt (mínimo)"):** bastou. Dá para cortar ≈ 20 % do texto ou baixar `minSize`.
- **Slide 4, `box-overflow` (164 pt, 25.3 %):** bastou, mas com inferência. A mensagem não diz o **eixo** (horizontal) nem a soma × disponível (812 × 648 pt). Tive que ler `direction="row"` no fonte para calcular `width ≤ 205`.
- **Slide 4, `out-of-slide` (`Shape[2]`, 128 pt):**
  - A causa é a mesma do `box-overflow`, mas a mensagem não diz isso, então o deck mostra 2 errors para um único problema.
  - A sugestão "Se for decoração intencional, use position="absolute"" pode levar um agente a silenciar o erro em vez de corrigir.
  - Também não informa o lado (direita).
- **`text-truncated`:** não diz quanto ficou de fora (quantas linhas ou palavras), então o agente não sabe se o corte é aceitável.
- **4× `text-shrunk` idênticos no slide 1:** são verbosos, mas estão corretos. Poderiam ser agrupados por escopo (`Bullets`).

## Problemas

| # | Severidade | Problema | Sugestão (módulo) |
|---|---|---|---|
| 1 | média | O `overflow.tsx` não exercita o caminho "shrink no mínimo e ainda estoura" (o comentário do slide 2 diz error, mas sai info 20 → 18) nem um slide só com warning. Os dois foram validados só no deck extra | Slide 2 com `minSize={19}` (ou mais texto) e um slide só com truncate (`examples/`) |
| 2 | baixa | `box-overflow` não informa o eixo nem os tamanhos (soma × disponível) | Incluir `axis` em `data` e no texto (`src/fit/`, diagnósticos) |
| 3 | baixa | `out-of-slide` duplica o `box-overflow` da mesma causa e sugere `position="absolute"` sem ressalva | Suprimir ou ligar ao box-overflow do pai, dizer o lado e tirar ou condicionar a dica de absolute (`src/fit/`) |
| 4 | baixa | `text-truncated` não quantifica o conteúdo perdido | `data.hiddenLines`/`hiddenChars` e o número na mensagem (`src/fit/`) |
| 5 | baixa | `long.slice(0, 140)` no slide 1 corta no meio da palavra ("e re") e parece um corte silencioso | Cortar em fim de palavra (`examples/overflow.tsx`) |
| 6 | info | O Keynote usa entrelinha 0–1 pt menor (trunca `spcPts`), então o vazamento de error aparece um pouco menor que no preview | Conhecido (M3). Nenhuma ação |

## Artefatos

- `dist/m4v/` (debug) e `dist/m4v-clean/` (limpo): pptx, PNGs nativos, overview, diagnostics.json e `keynote/`.
- `dist/m4v-extra/`: deck extra (shrink no mínimo → error; só warning → selo amarelo) com o Keynote.
