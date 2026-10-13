# M1-F — Validação visual (Keynote)

**Veredito: PASSA.** Todos os elementos de `examples/hello.tsx` aparecem no Keynote na posição, cor e tamanho esperados (erro ≤ 1 px a 1 px/pt). Há só observações de severidade baixa.

## Ambiente

- macOS 26.6.2 (25G83), Keynote 14.4, Node do projeto.
- PNG exportado tem 720×405 px, então 1 px = 1 pt e nenhuma conversão é necessária.

## Comandos

```
node bin/tsx-slides.mjs build examples/hello.tsx --out dist
node bin/tsx-slides.mjs build examples/hello.tsx --out dist/debug --debug
scripts/keynote-export.sh dist/hello.16x9.pptx dist/keynote/hello
scripts/keynote-export.sh dist/debug/hello.16x9.pptx dist/keynote/hello-debug
```

O script de exportação rodou sem erro e sem diálogos.

PNGs gerados:
- `dist/keynote/hello/hello.001.png`
- `dist/keynote/hello-debug/hello-debug.001.png`
- `dist/keynote/zoom-texto.png` (recorte ampliado 4× dos textos, para conferir acentos)

## Resultado por elemento

Medição: bbox dos pixels por cor, com PIL. Esperado = pt de hello.tsx.

| Elemento | Esperado (x0,y0,x1,y1) | Medido | Status |
|---|---|---|---|
| Barra azul #2F6FED | 0,0,12,405 | 0,0,12,405 | OK |
| Título bold #1B2A4A, 40 pt | caixa 48,40,672,88 | tinta 51,46,351,81 | OK. Inclui o bearing do "H" e o espaço acima das maiúsculas. Sem cortes. |
| Parágrafo #44506A, 18 pt, largura 300 | caixa 48,110,348,174.8 | tinta 48,113,344,151 (2 linhas) | OK. Cabe na largura, sem cortes. |
| Círculo laranja #F2A541 | 48,220,128,300 | 48,220,128,300 | OK (80×80, redondo) |
| RoundRect #E8EEFC com contorno 2 pt #2F6FED, raio 12 | 150,220,310,300 | 149,219,311,301 | OK. ±1 px é o traço centralizado na borda; adj=15000 → raio 12 pt correto. |
| Linha #1B2A4A, 2 pt | y=330, x 48→310 | 48,329,310,331 | OK |
| Box #F4F6FA, raio 8 | 380,110,680,300 | 380,110,680,300 | OK (adj 4211 → 8 pt) |
| Imagem contain, frame 390,120,670,290 | conteúdo 272×170 centralizado em x 394→666 | ver abaixo | OK |

**(a) Imagem contain com srcRect negativo.** O XML tem `l="-1471" r="-1471"`. A imagem é 800×500 (1,6) num frame de 280×170 (1,647), então sobra 4 pt de cada lado: 4/272 = 1,471%, valor correto. Mapeando pontos do chart.png com escala 0,34 e origem (394,120):
- eixo: x 60→740 / y 448 vira 414,4→645,6 / 272,3. Medido: 415→645 / 272.
- bolinha laranja: (650,40)–(710,100) vira 615–635,4 / 133,6–154. Medido: 615–635 / 134–154. Ela continua um círculo 20×20.

Portanto o Keynote desenha a imagem centralizada e sem distorção, com erro < 1 px.

**(b) Fonte e cortes.** A fonte declarada é Arial (latin/ea/cs) e o render é compatível com Arial (o "t" tem o topo chanfrado). Nenhum texto foi cortado.

**(c) Acentuação.** "à", "mão" e "emissão" aparecem corretos (ver `zoom-texto.png`). O XML também está em UTF-8 correto.

**Debug.** Os contornos vermelhos tracejados de 0,5 pt coincidem com os frames do título, do parágrafo, do Box e da Image. Shapes não recebem contorno, o que segue o contrato ("Box/Text/Image").

## Problemas / observações

| # | Severidade | Problema | Sugestão |
|---|---|---|---|
| 1 | Baixa | A altura do parágrafo é estimada em 3 linhas (64,8 pt), mas o Keynote usa 2. No debug, o contorno sobra embaixo. | Esperado com o medidor trivial do M1; o M2 traz métricas reais. Revalidar no M2 com `calibration.tsx`. |
| 2 | Baixa | O fundo do `chart.png` (#F4F6FA, opaco) é igual ao fill do Box, então as faixas do contain ficam invisíveis. A validação de (a) foi feita por geometria, não visualmente. | Em exemplos e testes futuros, usar um asset de teste com fundo contrastante (ou borda) para expor letterbox e cover. |
| 3 | Baixa | `descr` do `<p:pic>` grava o caminho absoluto local (`/Users/.../chart.png`). Vaza a estrutura de diretórios e prejudica a acessibilidade (alt text). | Em `src/emit/`, passar `altText` vazio, o `alt` do nó ou só o basename. |
| 4 | Baixa | Os runs saem com `lang="en-US"` num texto em português (afeta o corretor ortográfico). | Futuro: prop de idioma no Deck. Não bloqueia. |
| 5 | Info | A exportação do Keynote sai em 720×405 (1 px/pt), resolução limitada para inspeção fina. | Opcional: no script, depois de exportar, rodar `sips -Z` não ajuda (é upscale). Uma saída melhor é exportar em PDF (`export theDoc to … as PDF`) e rasterizar em escala maior. Não editei o script. |

Nenhum problema de severidade média ou alta.
