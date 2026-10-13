# Guia do agente — tsx-slides

Este é o único documento de que você precisa para (1) escrever slides novos e (2) corrigir erros lendo `diagnostics.json` e o overview PNG. Não é preciso ler `src/`.

## 1. Modelo mental

1. Você descreve **estrutura**, não posição: não existem coordenadas x/y. A engine calcula tudo.
2. O layout é **flexbox**, como em CSS, com uma diferença: a direção padrão é **`column`** (filhos empilhados).
3. A engine **mede o texto** com a fonte real, quebra as linhas e, se não couber, **reduz a fonte** (até um mínimo), corta com reticências ou reporta erro.
4. O mesmo arquivo gera vários tamanhos (16:9, 4:3…). Use `ctx` para decidir a estrutura por proporção.
5. Todo problema vira um **diagnóstico** com `path` até o nó e uma `message` que diz o que fazer. Exit code 0 = sem `error`.

## 2. Esqueleto de um deck

Arquivo em `examples/agent-test/<nome>.tsx`. Imports de `tsx-slides` (primitivas) e, se quiser, dos exemplos prontos:

```tsx
import { Box, Deck, Slide, Text, defineDeck } from 'tsx-slides';
import { tokens } from '../tokens.ts';
import { ContentLayout, CoverLayout } from '../layouts/index.ts';
import { Bullets } from '../components/index.ts';

const { color, font, space } = tokens;

export default defineDeck((ctx) => (
  <Deck>
    <CoverLayout title="Resultados do trimestre" subtitle="Diretoria · outubro" />
    <ContentLayout title="Destaques">
      <Bullets items={['Receita cresceu 18%', 'Churn caiu para 2,1%', 'Dois mercados novos']} />
    </ContentLayout>
    <Slide padding={space.page} gap={space.gap} background={color.surface}>
      <Text size={font.h1} weight="bold" color={color.ink}>Slide só com primitivas</Text>
      <Box grow={1} fill={color.white} radius={8} padding={space.gap}>
        <Text size={font.body} color={color.muted}>Gerado em {ctx.name}.</Text>
      </Box>
    </Slide>
  </Deck>
));
```

Regras: `export default defineDeck((ctx) => <Deck>…</Deck>)`; filhos do `Deck` são só `Slide` (direto ou via layout que devolve `Slide`). Componentes são funções puras `(props) => elemento` (sem hooks, sem estado). `.map` em listas não precisa de `key`.

`ctx` (um por tamanho renderizado; todos os números em pt, 1 pol = 72 pt):

| campo | 16x9 | 16x10 | 4x3 | wide |
|---|---|---|---|---|
| `ctx.name` | `'16x9'` | `'16x10'` | `'4x3'` | `'wide'` |
| `ctx.width × ctx.height` | 720 × 405 | 720 × 450 | 720 × 540 | 960 × 540 |
| `ctx.aspect` (w/h) | 1.78 | 1.6 | 1.33 | 1.78 |
| `ctx.scale` = min(w/720, h/405) | 1 | 1 | 1 | 1.33 |

Note: 16:9 e 4:3 têm a **mesma largura**; o 4:3 é **mais alto**. Por isso em 4:3 vale empilhar (`ctx.aspect < 1.5`) e usar a altura extra. Tamanho custom: `--size 10x7.5in` (nome `custom-10x7.5`).

## 3. Primitivas

Unidades: número = **pt**; string `'50%'` = percentual do pai (só em width/height/min/max/top/right/bottom/left). `padding` e `gap` só em pt. Cores `'#RRGGBB'`.

### Contêiner (`Slide` e `Box`)

| prop | tipo | padrão | nota |
|---|---|---|---|
| `direction` | `'row' \| 'column'` | `'column'` | |
| `gap` | pt | 0 | espaço entre filhos |
| `padding` | pt ou `{ top, right, bottom, left }` | 0 | |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` | eixo cruzado (align-items) |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | eixo principal |

### Item flex (`Box`, `Text`, `Image`, `Shape`)

| prop | tipo | padrão | nota |
|---|---|---|---|
| `width`, `height` | pt ou `'%'` | conteúdo | |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | pt ou `'%'` | — | |
| `grow` | número | 0 | `grow={1}` = `flex: 1`: ocupa o espaço que sobra; irmãos com o mesmo grow ficam **iguais** |
| `shrink` | número | **1** | encolhe se faltar espaço (inclusive tamanhos fixos!). `shrink={0}` = tamanho rígido |
| `alignSelf` | como `align` | — | sobrescreve o `align` do pai |
| `position` | `'relative' \| 'absolute'` | `'relative'` | `absolute` só para **decoração** (sai do fluxo, nunca gera diagnóstico de caixa) |
| `top`, `right`, `bottom`, `left` | pt ou `'%'` | — | com `absolute`; valores negativos saem do slide sem erro |

### Específicas

| primitiva | props próprias (além das acima) | filhos |
|---|---|---|
| `Deck` | — | só `Slide` |
| `Slide` | contêiner + `background?: '#hex' \| { image: 'caminho.png' }`, `notes?: string` | primitivas/componentes |
| `Box` | contêiner + `fill?`, `stroke?`, `strokeWidth?` (1 pt se `stroke`), `radius?` (pt) | primitivas/componentes |
| `Text` | ver §4 | **só strings/números** |
| `Image` | `src: string` (obrigatório; relativo ao arquivo do deck), `fit?: 'contain' \| 'cover'` (padrão `'contain'`) | nenhum |
| `Shape` | `kind: 'rect' \| 'roundRect' \| 'ellipse' \| 'line'` (obrigatório), `fill?`, `stroke?`, `strokeWidth?`, `radius?` (roundRect) | nenhum |

- `Slide` ocupa o slide inteiro e é um contêiner flex (coluna por padrão).
- `Box` sem `fill`/`stroke` é invisível (só agrupa). Com eles vira um retângulo (arredondado se `radius > 0`).
- `Shape` sem tamanho tem 0 no eixo principal e estica no cruzado (com `align='stretch'`). Ex.: numa coluna, `<Shape kind="rect" height={4} fill=… />` é uma barra de largura total.
- `line` vai do canto superior esquerdo ao inferior direito do frame; sem `stroke` é preta. Divisória horizontal: `<Shape kind="line" height={0} stroke="#CCCCCC" />` numa coluna.
- `Image` com só `width` (ou só `height`) mantém a proporção. Com `grow={1}` e sem tamanho, ocupa a área toda e `fit` decide (`contain` mostra tudo, `cover` preenche e recorta). Sem tamanho nem grow: tamanho natural (px × 0.75 pt).
- Ordem de desenho = ordem no código: decoração **antes** do conteúdo fica por trás.

### Regras de flex que mais importam

- Para colunas iguais numa row: `grow={1}` em cada uma (não use `width="50%"` + gap, que soma mais de 100%).
- Proporção 2:1: `grow={2}` e `grow={1}`.
- Para preencher o resto da altura de um slide: `grow={1}` no Box do corpo.
- Text dentro de `direction="row"`: dê `grow={1}` para ele ocupar a largura que sobra e quebrar linha nela.
- Tamanho fixo que **não pode** encolher (ícone, marcador, barra): `shrink={0}`.

## 4. Texto

| prop | tipo | padrão | nota |
|---|---|---|---|
| `size` | pt | 18 | |
| `weight` | `'regular' \| 'bold'` | `'regular'` | |
| `italic` | boolean | false | |
| `color` | `'#hex'` | `'#000000'` | |
| `font` | string | `'Arial'` | **só Arial** está registrada; outra família = erro `font-missing` |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | alinhamento horizontal das linhas (não confundir com `align` de Box) |
| `lineHeight` | número | 1 | multiplicador da altura natural da linha |
| `fit` | `'shrink' \| 'truncate' \| 'error'` | `'shrink'` | o que fazer se não couber |
| `minSize` | pt | `floor(size × 0.75)` | piso do `shrink` |
| `maxLines` | número | — | corta com `…` após N linhas |

- **Quebra de linha é automática**, pela largura do frame. Não use `\n` para quebrar linha; use `\n` só para separar **parágrafos**: `<Text>{'Primeiro parágrafo.\nSegundo.'}</Text>`.
- Filhos são concatenados sem separador: `<Text>Gerado em {ctx.name}.</Text>` funciona; `{a}{b}` cola as strings.
- Sem rich text: um `Text` tem um só estilo. Para trechos com estilos diferentes, use vários `Text` numa `Box direction="row"`.
- Políticas de `fit`:
  - `shrink` (padrão): reduz 1 pt por vez até caber ou chegar em `minSize`. Textos do mesmo componente (ex.: todos os itens de `Bullets`) encolhem **juntos**, mantendo a hierarquia; o título fora dele não muda. Coube → `text-shrunk` (info). Não coube no mínimo → `text-overflow` (error).
  - `truncate`: corta a última linha visível com `…` → `text-truncated` (warning).
  - `error`: não ajusta; se estourar → `text-overflow` (error).

## 5. Tokens, layouts e componentes prontos

`examples/tokens.ts` → `import { tokens } from '../tokens.ts'`:

| grupo | valores |
|---|---|
| `tokens.color` | `brand #1B2A4A`, `brandDark #101B33`, `accent #2F6FED`, `accentSoft #E8EEFC`, `ink #1B2A4A`, `muted #5B6680`, `surface #F4F6FA`, `white #FFFFFF`, `positive #1E9E6A`, `negative #D64545` |
| `tokens.font` | `display 44`, `h1 32`, `h2 24`, `body 20`, `small 14`, `caption 11` |
| `tokens.space` | `page 40`, `gap 20`, `tight 10` |

Layouts (`'../layouts/index.ts'`) — cada um **devolve um `<Slide>`**, então é filho direto de `<Deck>`:

| layout | props | o que faz |
|---|---|---|
| `CoverLayout` | `title: string; subtitle?: string` | fundo `brand`, elipse decorativa, Box central com título `display` bold branco (shrink, minSize 32), subtítulo `h2` (truncate, maxLines 2) |
| `ContentLayout` | `title: string; children` | fundo branco, padding `page`, cabeçalho (barra `accent` + título `h1` bold), corpo `Box grow={1}` com os children (coluna) |
| `ClosingLayout` | `title: string; subtitle?: string; contact?: string` | fundo `brand`, texto centralizado |

Componentes (`'../components/index.ts'`):

| componente | props | o que faz |
|---|---|---|
| `Bullets` | `items: readonly string[]; size?: number` (padrão `font.body`) | coluna de itens: marcador elipse 8×8 + Text grow (shrink, minSize 14) |
| `TwoColumn` | `left; right` (qualquer elemento); `stacked?: boolean`; `ratio?: number` (fração da largura da esquerda, padrão 0.5; só vale lado a lado) | row com gap, colunas por `grow`; `stacked` vira coluna: `left` com a altura do conteúdo em cima, `right` ocupa o resto (bom para imagem com `grow`) |
| `KpiCard` | `label: string; value: string; delta?: string; trend?: 'up' \| 'down'` | cartão `surface` arredondado, `grow={1}`: label `small` muted, valor `display` bold (minSize 28), delta com ▲ verde (`up`) / ▼ vermelho (`down`) |
| `KpiRow` | `items: readonly KpiCardProps[]` | row com gap; cada card `grow={1}` (larguras iguais) |

```tsx
<CoverLayout title="Plano 2027" subtitle="Proposta para o conselho" />
```

```tsx
<ContentLayout title="Prioridades">
  <Bullets items={['Expandir para o Sul', 'Reduzir custo de aquisição', 'Lançar o app']} size={22} />
</ContentLayout>
```

```tsx
<ContentLayout title="Indicadores">
  <KpiRow
    items={[
      { label: 'Receita', value: 'R$ 4,2 mi', delta: '+18%', trend: 'up' },
      { label: 'Churn', value: '2,1%', delta: '-0,4 pp', trend: 'down' },
      { label: 'NPS', value: '64' },
    ]}
  />
</ContentLayout>
```

```tsx
<KpiCard label="Clientes ativos" value="12.430" delta="+6%" trend="up" />
```

```tsx
<ClosingLayout title="Obrigado" subtitle="Perguntas?" contact="time@empresa.com" />
```

`TwoColumn` está na receita 6.2.

## 6. Receitas

Os trechos abaixo são filhos de `<Deck>` dentro de `defineDeck((ctx) => …)`, com os imports da §2 (mais `Image`, `Shape` de `'tsx-slides'` e `TwoColumn`, `KpiCard` de `'../components/index.ts'` quando usados).

### 6.1 Conteúdo com bullets, só primitivas

```tsx
<Slide padding={40} gap={20} background="#FFFFFF">
  <Box direction="row" align="center" gap={12}>
    <Shape kind="rect" width={6} height={30} shrink={0} fill="#2F6FED" />
    <Text size={28} weight="bold" color="#1B2A4A" grow={1}>Por que agora</Text>
  </Box>
  <Box gap={10} grow={1}>
    {['Mercado cresce 30% ao ano', 'Concorrentes ainda sem produto móvel', 'Time pronto para executar'].map((item) => (
      <Box direction="row" gap={10} align="start">
        <Shape kind="ellipse" width={8} height={8} shrink={0} fill="#2F6FED" />
        <Text size={20} minSize={14} grow={1} color="#1B2A4A">{item}</Text>
      </Box>
    ))}
  </Box>
</Slide>
```

### 6.2 Duas colunas que empilham em 4:3

```tsx
<ContentLayout title="Receita por região">
  <TwoColumn
    stacked={ctx.aspect < 1.5}
    ratio={0.45}
    left={<Bullets items={['Sudeste lidera com 52%', 'Sul cresceu 31%', 'Nordeste estável']} />}
    right={<Image src="../assets/chart.png" grow={1} />}
  />
</ContentLayout>
```

Sem o componente, a mesma ideia: `<Box direction={ctx.aspect < 1.5 ? 'column' : 'row'} gap={20} grow={1}>` com dois filhos `grow={1}`.

### 6.3 Linha de cards

```tsx
<Slide padding={40} gap={20}>
  <Text size={28} weight="bold" color="#1B2A4A">Três frentes</Text>
  <Box direction="row" gap={16} grow={1}>
    {[
      ['Produto', 'Lançar o app e a API pública.'],
      ['Vendas', 'Dobrar o time no Sul e no Nordeste.'],
      ['Operação', 'Automatizar o onboarding de clientes.'],
    ].map(([title, body]) => (
      <Box grow={1} fill="#F4F6FA" radius={8} padding={16} gap={8}>
        <Text size={20} weight="bold" color="#1B2A4A">{title}</Text>
        <Text size={16} color="#5B6680">{body}</Text>
      </Box>
    ))}
  </Box>
</Slide>
```

### 6.4 Imagem que preenche a área

```tsx
<Slide padding={40} gap={16}>
  <Text size={28} weight="bold" color="#1B2A4A">Evolução mensal</Text>
  <Image src="../assets/revenue-chart.png" grow={1} fit="contain" />
  <Text size={11} color="#5B6680">Fonte: dados internos.</Text>
</Slide>
```

`fit="cover"` preenche tudo e recorta as bordas. Foto de fundo inteira: `<Slide background={{ image: '../assets/foto.png' }}>`.

### 6.5 Decoração de fundo

```tsx
<Slide padding={40} justify="center" background="#1B2A4A">
  <Shape kind="ellipse" position="absolute" right={-120} top={-120} width={360} height={360} fill="#101B33" />
  <Shape kind="rect" position="absolute" left={0} bottom={0} width="100%" height={8} fill="#2F6FED" />
  <Text size={44} weight="bold" color="#FFFFFF">Nova fase</Text>
</Slide>
```

Decoração vem **antes** do conteúdo (fica por trás) e usa `position="absolute"`; pode sair do slide sem gerar erro.

## 7. CLI e fluxo de trabalho

Rode na raiz do projeto:

```
node bin/tsx-slides.mjs build examples/agent-test/meu-deck.tsx --size 16x9,4x3 --out dist/agent-test --json
```

Flags: `--size` (lista: `16x9`, `16x10`, `4x3`, `wide`, ou `10x7.5in`; padrão `16x9`), `--out` (padrão `dist/`), `--debug` (contornos vermelhos tracejados em toda Box/Text/Image e estouro de texto em vermelho no PNG), `--json`, `--preview native|none`, `--preview-width 1280`.

Arquivos gerados (`<deck>` = nome do arquivo sem extensão):

```
dist/agent-test/
├── meu-deck.16x9.pptx
├── meu-deck.16x9.overview.png     ← grade com todos os slides + selos
├── meu-deck.16x9/slide-01.png …   ← um PNG por slide
├── meu-deck.4x3.pptx / .overview.png / meu-deck.4x3/…
└── meu-deck.diagnostics.json      ← todos os diagnósticos, todos os tamanhos
```

- Com `--json`, stdout tem **só** `{ "files": [...], "diagnostics": [...] }`. Se o deck nem rodar (erro de sintaxe, texto fora de `<Text>`…), stdout tem `{ "error": "mensagem" }`.
- **Exit code**: `1` se houver qualquer diagnóstico `error` ou falha; `0` caso contrário. `warning`/`info` não falham.
- Sempre gere **os dois tamanhos** (`16x9,4x3`): o que cabe em um pode não caber no outro.
- `files` lista o `.pptx`, cada PNG de slide, o overview e o `diagnostics.json` — leia os caminhos dali.
- Config opcional `tsx-slides.config.ts` no diretório atual (`export default defineConfig({ fonts?, sizes?, lang?, textSafety? })`, `import { defineConfig } from 'tsx-slides'`); flags vencem a config. Você normalmente **não** precisa dela; se definir `fonts`, elas substituem a Arial padrão.

## 8. Diagnósticos

Formato (cada item de `diagnostics.json` / `diagnostics` do `--json`):

```json
{
  "size": "16x9",
  "slide": 2,
  "severity": "error",
  "code": "text-overflow",
  "path": "Slide > Box > Text",
  "message": "Texto estourou 0.5% (1.2 pt) da altura disponível mesmo em 19 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize.",
  "data": { "overflowPt": 1.2, "overflowPct": 0.5, "fromSize": 20, "toSize": 19 }
}
```

`slide` começa em 1 (ordem no `<Deck>`). `severity`: `error` (precisa corrigir), `warning` (aceitável se intencional), `info` (só aviso).

### Como ler o `path`

- Segmentos separados por ` > `, do slide até o nó. O `Deck` não aparece.
- Segmento = nome da primitiva (`Slide`, `Box`, `Text`, `Image`, `Shape`) **ou o nome do componente** que devolveu aquele nó (`CoverLayout`, `Bullets`, ou o seu `MeuCard`). O primeiro segmento é `Slide` ou o layout que devolveu o slide.
- `[i]` aparece quando o pai tem mais de um filho com o mesmo segmento: é o índice **entre esses irmãos homônimos**, começando em 0.
- Exemplo: `ContentLayout > Box[1] > Bullets > Box[2] > Text` = no slide do ContentLayout, segundo `Box` filho do slide (o corpo), dentro dele o `Bullets`, o terceiro item, o Text do item.
- Dica: dê nomes a componentes seus (`const Agenda = () => …`): o path fica legível. Funções anônimas viram `Anonymous`.

### Códigos

| code | severity | causa | correção típica |
|---|---|---|---|
| `text-shrunk` | info | o texto foi reduzido e coube | nada; se a fonte ficou pequena, encurte o texto ou dê mais área |
| `text-overflow` | error | `shrink` chegou em `minSize` e ainda não cabe, ou `fit="error"` estourou | encurte o texto; dê área (`grow={1}` no contêiner, menos padding/gap, menos irmãos); baixe `minSize`; divida em dois slides; ou use `fit="truncate"` |
| `text-truncated` | warning | `truncate`/`maxLines` cortou com `…` | se não era a intenção: encurte, aumente a área ou `maxLines` |
| `box-overflow` | error | tamanhos fixos (com `shrink={0}`), gap e padding somam mais que o contêiner | reduza `width`/`height` fixos ou gap/padding; troque fixos por `grow`/`%`; tire `shrink={0}`; empilhe em 4:3 |
| `out-of-slide` | error | nó **em fluxo** fora dos limites do slide | reduza o tamanho; use `%`/`grow`; se for decoração, `position="absolute"` |
| `image-upscaled` | info | imagem ampliada acima de 96 dpi (pode borrar) | arquivo com mais resolução ou área menor |
| `font-missing` | error | `font` com família não registrada | remova `font` (padrão Arial) |

Mensagens reais:

```
✖ text-overflow em Slide > Box > Text
  Texto estourou 0.5% (1.2 pt) da altura disponível mesmo em 19 pt (mínimo); reduza o conteúdo, aumente a área ou baixe minSize.
✖ text-overflow em Slide > Box > Box[1] > Text
  Texto estourou 16.8% (21.2 pt) da altura disponível em 16 pt (fit="error" não ajusta); reduza o conteúdo, aumente a área ou troque para fit="shrink" ou fit="truncate".
• text-shrunk em Slide > Bullets > Box[0] > Text
  Texto reduzido de 20 pt para 19 pt para caber na área. Se a redução incomodar, encurte o conteúdo ou aumente a área.
▲ text-truncated em Slide > Text
  Texto cortado com reticências: mostradas 3 de 8 linhas (~63% do conteúdo oculto). Encurte o conteúdo, aumente a área, aumente maxLines ou use fit="shrink".
✖ box-overflow em Slide > Box
  Os filhos em fluxo somam 812 pt na horizontal (row), mas a área de conteúdo tem 648 pt: estouro de 164 pt (25.3%). Reduza width/height fixos ou gap/padding, permita shrink nos filhos (shrink={0} impede), ou aumente o contêiner.
✖ out-of-slide em Slide > Image
  O elemento sai do slide: 20 pt pela direita. Reduza o tamanho dele ou o conteúdo ao redor, ou ajuste top/left. Só se for decoração intencional fora do fluxo, use position="absolute".
• image-upscaled em Slide > Image
  Imagem desenhada com 700 pt de largura, acima do natural (800 px = 600 pt a 96 dpi); pode sair borrada. Use um arquivo com mais resolução ou reduza a área da imagem.
✖ font-missing em Slide > Text
  Fonte "Helvetica Neue regular" não está registrada; o texto foi medido por estimativa e a quebra de linha pode não bater com o PowerPoint. Registre a fonte em options.fonts ou use uma família registrada.
```

Erros de estrutura (o deck não chega a ser medido; exit 1, sem `diagnostics.json` novo):

```
Texto "Olá" fora de <Text>; envolva o conteúdo em <Text> (em Slide > Box)
<Text> só aceita strings e números como filhos; elementos não são permitidos (em Slide > Text)
```

Também: `Filhos de <Deck> têm que ser <Slide>…`, `<Image> não aceita filhos`.

Sem duplicatas: um texto estourado é reportado no `Text`, não na Box pai; algo que sai do slide no nível do `Slide` vira `out-of-slide`, não `box-overflow`.

### O overview PNG

`<deck>.<size>.overview.png`: miniaturas numeradas (o número = `slide`). **Selo vermelho** "!" no canto = o slide tem `error`; **selo amarelo** = `warning`; sem selo = ok (ou só `info`). Use o overview para conferir visualmente (texto pequeno demais, área vazia, imagem deslocada) e para achar o slide; use `diagnostics.json` para saber o quê e onde. Com `--debug`, cada caixa tem contorno vermelho tracejado e o texto que estoura fica em vermelho translúcido.

### Checklist de correção

1. Rode o build com `--size 16x9,4x3 --json` e leia o exit code.
2. Se houver `{ "error": … }`: é erro de estrutura/sintaxe; a mensagem traz o path entre parênteses. Corrija e rode de novo.
3. Filtre `severity: "error"`. Para cada um: ache o slide (`slide`), siga o `path` no seu código segmento por segmento (contando `[i]` entre irmãos do mesmo tipo/nome).
   Vários `error` no mesmo slide costumam ter **uma causa só** (um texto enorme espreme os irmãos, que também estouram): corrija o maior estouro primeiro e rode de novo.
4. Aplique a correção que a `message` sugere (tabela acima). Prefira mudar estrutura (`grow`, menos texto, empilhar com `ctx.aspect`) a mexer em números mágicos.
5. Veja o overview do tamanho afetado para confirmar que ficou bom.
6. Repita até **exit 0**. Depois revise `warning` (truncamento intencional?) e `info` (fonte reduzida demais?).

## 9. Armadilhas comuns

```jsx
// ERRADO: texto solto fora de <Text>  → erro "fora de <Text>"
<Box>Olá</Box>
// ERRADO: elemento dentro de <Text>   → erro "só aceita strings e números"
<Text>Receita <Text weight="bold">subiu</Text></Text>
```

- **Texto sempre dentro de `<Text>`**, e `<Text>` só com strings/números. (o TypeScript já acusa elemento dentro de `<Text>`.) Negrito parcial = dois `Text` numa row.
- **Shape/Box com tamanho fixo encolhe** (`shrink` padrão é 1, como no CSS): um marcador `width={8}` numa row apertada vira uma elipse achatada; uma barra some. Use `shrink={0}` em tudo que tem tamanho que deve ser respeitado. Mas `shrink={0}` em itens grandes gera `box-overflow` se não couberem.
- **Esquecer `grow`**: Text numa row sem `grow={1}` fica estreito; cards sem `grow={1}` ficam com larguras diferentes; corpo do slide sem `grow={1}` não ocupa a altura e o texto não tem área.
- **`width="50%"` + `gap`** numa row soma mais que 100%: use `grow={1}`.
- **Larguras fixas somadas**: três itens `width={260}` + gaps passam dos 640 pt úteis de um slide 720 com `padding={40}`. Prefira `grow`.
- **Padding grande**: `padding={80}` tira 160 pt de cada eixo; em 16:9 sobram só 245 pt de altura. Use `tokens.space.page` (40).
- **Duas colunas de texto longo** ficam apertadas; em 4:3 há altura sobrando: empilhe com `stacked={ctx.aspect < 1.5}` (ou `direction` condicional). Nunca escreva um arquivo por tamanho.
- **`\n` para quebrar linha**: não precisa (a quebra é automática); `\n` cria parágrafo novo.
- **Fonte diferente de Arial** → `font-missing` (error). Omita `font`.
- **`position="absolute"` para posicionar conteúdo**: não faça; absoluto é só decoração (não participa do layout nem dos diagnósticos de caixa). Conteúdo vai em fluxo.
- **`fit="error"`** só se você quer ser avisado em vez de ajuste; o padrão `shrink` é o mais seguro.
- **Caminhos de imagem** são relativos ao arquivo do deck: de `examples/agent-test/`, use `'../assets/chart.png'`.
