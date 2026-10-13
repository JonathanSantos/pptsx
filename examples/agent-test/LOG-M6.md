# Diário — teste do agente M6 (correção de `broken-m6.tsx`)

Fonte única de documentação: `docs/AGENT_GUIDE.md` (sem ler `src/`, `tests/`, `docs/work/`). Não precisei abrir `examples/components/*` nem `examples/layouts/*`: as tabelas de props do guia bastaram. Comandos rodados na raiz do projeto.

Comando (todas as iterações; `$S` = scratchpad da sessão):
`node bin/tsx-slides.mjs build examples/agent-test/broken-m6.tsx --size 16x9,4x3 --out $S/m6agent --json`

---

### Iteração 1 — cópia do original, exit 1
Diagnósticos:
- 16x9 e 4x3, slide 3: `box-overflow` (error) em `ContentLayout > Box[1] > Box` — "Os filhos em fluxo somam 872 pt na horizontal (row), mas a área de conteúdo tem 640 pt: estouro de 232 pt (36.3%)…". Sem `causedBy` (é causa).
- 16x9 e 4x3, slide 2: `text-word-broken` (warning) agrupado em `…KpiRow > KpiCard[0,1,2,4] > Text[1]` — "\"52.400.000,00\" não cabe inteira numa linha de 72 pt mesmo reduzido de 44 pt para 28 pt…" (×4). Mais `text-shrunk` agrupado `KpiCard[0..4] > Text[1]` 44→28 e `KpiCard[2] > Text[0]` 14→10 (o label "Disponibilidade").
- Slide 1: `text-shrunk` agrupado `Bullets > Box[0..3] > Text`: 28→17 (16x9), 28→23 (4x3).

Entendimento / overview:
- Slide 3: 4 × `width={200} shrink={0}` + 3 × gap 24 = 872 > 640; o próprio overview mostra o 4º cartão cortado. Correção óbvia pela mensagem + §9 ("larguras fixas somadas"): `grow={1}`.
- Slide 2: o overview confirma "R$ / 52.4 / 00.0 / 00,0 / 0", "1.28 / 4.39 / 2", "99,9 / 5%", "3.41 / 2". Cartão útil = 72 pt (5 cartões `md`). O guia (§5) diz exatamente o que fazer: `size="sm"` e abreviar ("R$ 52,4 mi").
- Slide 1: sem erro, mas 17 pt em 16x9 com parágrafos de 3 linhas é texto demais. Encurtar mantendo as 4 prioridades.
- Notei que o original usa `trend: 'down'` em "Chamados +22%" e `trend: 'up'` em "Tempo de resposta −12 ms": pela tabela do `KpiCard`, a seta saía invertida em relação ao número. A intenção (cor) é ruim/bom, então troquei para `trend` = direção do número + `sentiment` = cor.

### Iteração 2 — exit 0
Mudanças: bullets encurtados (mesmas 4 prioridades), `size={22}`, `justify="center"`; KPIs `size="sm"` com valores "R$ 52,4 mi", "1,28 mi", "99,95%", "182 ms", "3.412" (mesmos números); fases em componente `PhaseCard` com `grow={1}` (sem `width`/`shrink={0}`/`fit="error"`), nome em `font.body`.
Diagnósticos (só info):
- slide 2: `text-shrunk` em `KpiCard[2] > Text[1]` 32→24 (só o "99,95%").
- slide 3: `text-shrunk` agrupado `ContentLayout > Box[1] > Box > PhaseCard[0,3] > Text[1]` 20→18 ("Planejamento", "Desligamento").
Entendimento / overview:
- Cumpre o critério formal (exit 0, 0 warning), mas visualmente fraco: valores quebram **entre palavras** em 3 linhas ("R$ / 52,4 / mi", "182 / ms") — não é palavra partida, então nenhum diagnóstico, mas fica feio; "99,95%" sozinho em 24 pt destoa dos outros (32 pt): o shrink conjunto não vale entre cartões diferentes.
- Slide 3: cartões pequenos, slide com muito vazio.

### Iteração 3 — exit 0, 0 diagnósticos
Mudanças:
- KPIs: unidade vai para o rótulo (padrão do exemplo do guia, `'Receita (R$ mi)'`, valor `'4,2'`): "52,4", "1,28", "99,95", "182", "3.412". Componente `Kpis`: 16:9 = uma `KpiRow size="sm"` com 5; 4:3 (`ctx.aspect < 1.5`) = `KpiRow md` de 3 + `KpiRow md` de 2 usando a altura extra.
- Linha do tempo: componente `Timeline` com 4 `PhaseStep` (círculo numerado 44×44 `shrink={0}`, "Etapa N", nome centralizado), linha conectora como `Shape position="absolute"` (decoração).
- Bullets `size` 24 em 4:3.
Overview: tudo legível, nada partido. Ajustes estéticos: conector `accentSoft` quase invisível; em 4:3 os KPIs ficaram colados no topo (deixei `grow={1}` no Box dos dois `KpiRow`, o que anula o `justify="center"` do `ContentLayout`).

### Iteração 4 — exit 0, 0 diagnósticos (final)
Mudanças: conector em `color.accent`; tirei `grow={1}` do Box dos KPIs em 4:3 (centraliza).
Overview: 16x9 e 4x3 bons. Detalhe cosmético restante: em 16:9 o rótulo "Chamados" tem 1 linha e os outros 2, então o valor "3.412" fica um pouco acima dos demais (cartões alinhados ao topo).

**Total: 4 builds (1 com erro). Exit 0 sem warning já na 2ª; as 3ª e 4ª foram por qualidade visual.**

---

## Avaliação do guia e dos diagnósticos

Fácil / funcionou bem:
- `box-overflow` do slide 3: mensagem com a conta (872 vs 640, 232 pt) + armadilha "larguras fixas somadas" na §9 → correção na hora.
- `text-word-broken` agora existe e já mostra o valor ofensor ("52.400.000,00"), a largura da linha (72 pt) e a sugestão concreta ("R$ 52,4 mi"); a §5 com a tabela de tamanhos do `KpiCard` ("Largura útil = largura − 2 × padding", "4+ cartões → `sm`") deixou a decisão trivial sem abrir o componente.
- A tabela `trend`/`sentiment` deixou claro que o original tinha setas trocadas.
- Os grupos `[a..b]` / `[0,1,2,4]`: ajudaram. `KpiCard[0,1,2,4]` diz de cara que o 4º cartão ("182 ms") é o único ok, e a ideia de "corrija uma vez no `.map`/componente" bate com o modo de pensar. Reduziu 4 linhas de ruído a 1 por tamanho.
- Componentes nomeados (`PhaseCard`, `Kpis`) aparecem no path: legível.

Faltou / confundiu (específico):
1. **Quebra feia entre palavras não é sinalizada.** "R$ 52,4 mi" em cartão de 84 pt úteis vira 3 linhas ("R$ / 52,4 / mi") com exit 0 e 0 warning. A própria mensagem de `text-word-broken` sugere "R$ 52,4 mi" como abreviação, que no cartão `sm` de 5 colunas continua ruim. Só o overview pegou. Sugestão: no `KpiCard`, um aviso/info quando o valor ocupa mais de 1 linha, ou o exemplo da mensagem sugerir "unidade no rótulo".
2. **Shrink conjunto não vale entre instâncias.** `text-shrunk` em `KpiCard[2] > Text[1]` 32→24 só no "99,95%": os outros valores ficam em 32 e a linha de cartões perde a uniformidade. O guia (§4) diz "textos do mesmo componente encolhem juntos (ex.: todos os itens de `Bullets`)", o que me fez esperar o mesmo para `KpiRow`; não é o caso (ou `KpiRow` não conta como "componente" para isso). Vale uma frase explícita.
3. **`justify="center"` do `ContentLayout` vs. `grow` no filho**: o guia não diz que um filho com `grow={1}` anula a centralização; descobri pelo overview (iteração 3). É dedutível de flexbox, mas uma linha na descrição do `ContentLayout` evitaria um build.
4. `position="absolute"`: o guia não diz em relação a quê `top/left` e `%` são resolvidos (pai ou slide). Funcionou relativo ao pai (Box da timeline), mas foi chute.
5. Menor: `text-shrunk` 14→10 no label "Disponibilidade" (iteração 1) ficou ao lado do `text-word-broken` do valor; não fica claro se o label também partiu (não partiu). Ok como info.

`causedBy` e resumo com `↳`: não apareceram nesta tarefa (nenhum erro derivado; o único erro, `box-overflow`, era causa). Também não usei o modo sem `--json`, então não vi o resumo com `↳`. Neutro: não ajudou nem atrapalhou; a regra do checklist ("primeiro os sem `causedBy`") ficou trivialmente satisfeita.
