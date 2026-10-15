# LOG M13 — relatório de texto corrido (agente sem contexto, só `docs/AGENT_GUIDE.md`)

Deck: `examples/agent-test/m13-relatorio.tsx` (capa + relatório paginado + slide de notas; fonte padrão Arial, sem config).

## Comando

```
cd /Users/jovivo/Developer/projects/pptsx && npx tsx src/cli.ts build examples/agent-test/m13-relatorio.tsx --size 16x9,4x3 --out /private/tmp/claude-503/-Users-jovivo-Developer-projects-pptsx/ad2b33e4-6b93-4d16-8522-0b9d8affb288/scratchpad/agent-m13 --json
```

## Número de builds: 2

### Build 1 — exit 0

| tamanho | severidade | code | path | resumo |
|---|---|---|---|---|
| 16x9 | info | slide-continued | Slide > Text[1] | slide 2 do autor virou 4 slides (10 + 10 + 10 + 5 de 35 linhas) |
| 4x3 | info | slide-continued | Slide > Text[1] | slide 2 do autor virou 2 slides (20 + 15 de 35 linhas) |

Nenhum error/warning. Já atendia à meta. Correção opcional para o build 2: em 16:9 cada parte deixava ~1/3 do slide vazio, porque o corte cai no fim de parágrafo (cabem ~14 linhas, os parágrafos têm 5 linhas, então só 2 parágrafos = 10 linhas por parte) e o relatório ocupava 4 slides. Usei `fontSize={{ base: 15, tall: 16 }}` e `lineHeight={{ base: 1.2, tall: 1.25 }}` (passo de 18 pt e 20 pt, inteiros, como o guia recomenda para o Keynote). O 4:3 não muda.

### Build 2 — exit 0 (inferido; ver nota)

| tamanho | severidade | code | path | resumo |
|---|---|---|---|---|
| 16x9 | info | slide-continued | Slide > Text[1] | slide 2 do autor virou 3 slides (13 + 14 + 5 de 32 linhas) |
| 4x3 | info | slide-continued | Slide > Text[1] | slide 2 do autor virou 2 slides (20 + 15 de 35 linhas) |

Nota: no build 2 encadeei a saída num `grep` e usei `${PIPESTATUS[0]}`, que não existe no zsh, então o exit code não foi impresso. Pela regra do guia (§7: exit 1 só com diagnóstico `error` ou falha), sem nenhum error e com todos os arquivos gerados, o exit é 0. Não rodei um 3º build só para confirmar, para respeitar o limite de 2.

## O que vi nos PNGs

- **16:9 (5 slides):** capa; relatório em 3 partes (2/5, 3/5, 4/5) com o mesmo título "O trimestre em resumo"; notas no 5/5. Texto em 15 pt legível. Todos os cortes caem em fim de parágrafo, sem frases cortadas de forma estranha. A última parte tem só 5 linhas (desequilibrada, mas aceitável).
- **4:3 (4 slides):** capa; relatório em 2 partes (20 e 15 linhas) bem cheias; notas no 4/4.
- **Rodapé e número:** "Relatório do 3º trimestre de 2026 · Aurora Alimentos" à esquerda e "n / total" à direita em **todos** os slides, inclusive capa e partes paginadas; o total conta as partes (5 em 16:9, 4 em 4:3). Rodapé não sobrepõe o corpo (padding inferior de 40 pt no Slide).
- **Notas:** sobrescritos ¹ e ² aparecem no texto, sublinhados no preview (sinal do link). O slide de notas tem as duas notas com sobrescrito. O link usa `slide:3` (3º `<Slide>` do Deck), que a engine traduz para o slide de notas de cada saída; nenhum `link-target-missing`. Não abri o .pptx para clicar no link.
- **Defeito visual:** não há espaço entre parágrafos no texto paginado (um parágrafo começa colado na última linha do anterior), o que dificulta ver onde cada um começa.

## Lacunas do guia

1. **§4 "Texto que continua" / §6.14 — espaço entre parágrafos:** o guia diz para usar `gap`/`margin` entre parágrafos (§4, nota de `lineHeight` no Keynote), mas isso só vale entre `Text` diferentes; dentro de um único `Text paginate` não há prop de espaçamento de parágrafo (tipo `paragraphSpacing`/`marginBottom` por parágrafo). Não diz se `'\n\n'` (parágrafo vazio) é suportado nem como interage com o corte de página (uma linha vazia no topo da continuação?). Fiquei sem separação visual.
2. **§4 "Texto que continua" — rich text com `\n`:** os exemplos só mostram `{textoLongo}` como string. Não diz explicitamente que `{'\n'}` entre trechos JSX mistos (texto + `Sup`) separa parágrafos dentro de um `Text paginate`. Funcionou, mas tive que adivinhar.
3. **§3 "Por primitiva" / §9 — componente dentro de `Text`:** a tabela diz que `Text` aceita "strings/números e `Span`/`B`/`I`/`Sup`/`Sub`". Não diz se um **componente próprio** que devolve `<Sup>` (meu `Nota`) é aceito como filho de `Text`. Funcionou, mas a armadilha da §9 ("Text só aceita strings, números e <Span>/<B>/<I>") sugere o contrário.
4. **§4 "Texto que continua" — prever o número de partes:** não explica como estimar quantas linhas cabem por parte, nem que a regra "corte no fim do parágrafo se a parte ficar ao menos meio cheia" pode deixar até metade do slide vazio com parágrafos longos. Só descobri pelo `slide-continued` e pelo PNG. Uma dica tipo "parágrafos curtos ou fontSize responsivo equilibram as partes" ajudaria (a §3 Box paginate tem isso; a do Text não).
5. **§4 "Número de slide e rodapé" — rodapé em fundo escuro:** a cor do `footer` é fixa para o deck inteiro; o guia não diz se dá para variar por slide (ex.: capa escura com `CoverLayout`) nem se o footer herda `color` do Slide. Por isso fiz a capa clara com primitivas em vez de `CoverLayout`.
6. **§4 "Número de slide e rodapé" — quanto padding inferior dar:** diz "deixe `padding` inferior no Slide", mas não dá a altura do rodapé de exemplo (padding 12 + linha de 10 pt ≈ 24 pt). Usei 40 pt por analogia à §6.14.
7. **§6.15 — link no `Sup` dentro de `Text paginate`:** não diz se o `href` sobrevive à paginação quando o trecho cai numa parte que não é a 1ª (a nota 2 caiu na parte 2/3). No PNG está sublinhado, mas não está documentado.
8. **§7 — exit code com `--json`:** nada a corrigir no guia, mas vale lembrar que o JSON não traz o exit code; quem encadeia num pipe perde o status (foi o meu caso, por erro meu no zsh).
