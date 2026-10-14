/**
 * Suíte H4: casos CSS como dados, para o mesmo caso ir ao Chromium (oracle/generate.ts, só em
 * dev) e ao motor da PoC (tests/h4-oracle.test.tsx). Estilos em camelCase; números = px = pt.
 * Nó com `text` vira <Text> na PoC e <div> com texto no HTML; os demais viram <Box>/<div>.
 * Todo contêiner declara `display` (o padrão do <div> é block e o do <Box>, flex column).
 * Regras para o caso ser comparável: nada de palavra maior que a linha (o CSS deixa vazar,
 * a engine quebra por caractere) e nada que dependa de `min-width: auto` de item flex (o Yoga
 * não implementa; a divergência está documentada no relatório).
 */

export interface CaseNode {
  readonly id: string;
  readonly style?: Readonly<Record<string, string | number>>;
  readonly text?: string;
  readonly children?: readonly CaseNode[];
}

export interface CssCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly root: CaseNode;
}

type Style = Readonly<Record<string, string | number>>;

const box = (id: string, style: Style, children: readonly CaseNode[] = []): CaseNode => ({ id, style, children });
const text = (id: string, content: string, style: Style = {}): CaseNode => ({ id, style, text: content });
const boxes = (prefix: string, count: number, style: Style): readonly CaseNode[] =>
  Array.from({ length: count }, (_, index) => box(`${prefix}${index + 1}`, style));

const W = 600;
const H = 400;

const grid = (name: string, style: Style, children: readonly CaseNode[], size: { width?: number; height?: number } = {}): CssCase => ({
  name,
  width: size.width ?? W,
  height: size.height ?? H,
  root: box('grid', { display: 'grid', ...style }, children),
});

const flex = (name: string, style: Style, children: readonly CaseNode[]): CssCase => ({
  name,
  width: W,
  height: H,
  root: box('root', { display: 'flex', ...style }, children),
});

const LOREM_SHORT = 'Receita cresceu no trimestre';
const LOREM_LONG = 'Pipelines legados migrados antes do prazo com custo menor por consulta';

export const CASES: readonly CssCase[] = [
  // ───────────── grid: tracks ─────────────
  grid('G01 três colunas 1fr com gap', { gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }, boxes('i', 6, { height: 40 })),
  grid('G02 coluna fixa + 1fr', { gridTemplateColumns: '200px 1fr', columnGap: 16 }, boxes('i', 4, { height: 30 })),
  grid('G03 fixa, auto e 1fr', { gridTemplateColumns: '100px auto 1fr', gap: 8 }, [
    box('a', { height: 20 }),
    box('b', { width: 120, height: 20 }),
    box('c', { height: 20 }),
  ]),
  grid('G04 percentuais', { gridTemplateColumns: '25% 75%' }, boxes('i', 2, { height: 50 })),
  grid('G05 2fr 1fr', { gridTemplateColumns: '2fr 1fr', gap: 12 }, boxes('i', 2, { height: 50 })),
  grid('G06 minmax com mínimo maior que o espaço', { gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', width: 250 }, boxes('i', 3, { height: 20 })),
  grid('G07 minmax(0, 1fr) ignora o conteúdo', { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', width: 300 }, [
    box('a', { width: 250, height: 20 }),
    box('b', { height: 20 }),
  ]),
  grid('G08 1fr não encolhe abaixo do min-content', { gridTemplateColumns: '1fr 1fr', width: 500 }, [
    box('a', { width: 400, height: 20 }),
    box('b', { height: 20 }),
  ]),
  grid('G09 auto auto: esticam igualmente', { gridTemplateColumns: 'auto auto', width: 500, alignItems: 'start' }, [
    text('a', 'Curto'),
    text('b', 'Um texto bem mais comprido'),
  ]),
  grid('G10 linhas fixa e 1fr com altura definida', { gridTemplateRows: '50px 1fr', height: 300 }, boxes('i', 2, {})),
  grid('G11 gridAutoRows fixo', { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '60px', gap: 4 }, boxes('i', 5, {})),
  grid('G12 linhas auto pela maior altura', { gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 10, rowGap: 6 }, [
    box('a', { height: 30 }),
    box('b', { height: 70 }),
    box('c', { height: 50 }),
    box('d', { height: 10 }),
  ]),
  grid('G13 min-content e max-content', { gridTemplateColumns: 'min-content max-content 1fr', columnGap: 6, alignItems: 'start' }, [
    text('a', 'palavra outra'),
    text('b', 'sem quebrar nunca'),
    box('c', { height: 10 }),
  ]),
  // ───────────── grid: placement ─────────────
  grid('G14 placement explícito', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '40px' }, [
    box('a', { gridColumn: '1 / 3', gridRow: 2 }),
    box('b', { gridColumn: 3, gridRow: 1 }),
    box('c', {}),
  ]),
  grid('G15 span no auto-placement', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '30px', gap: 5 }, [
    box('a', {}),
    box('b', { gridColumn: 'span 2' }),
    box('c', { gridColumn: 'span 2' }),
    box('d', {}),
    box('e', {}),
  ]),
  grid('G16 1 / -1 ocupa a linha toda', { gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }, [
    box('header', { gridColumn: '1 / -1', height: 30 }),
    ...boxes('i', 3, { height: 40 }),
  ]),
  grid('G17 linha definida, coluna automática', { gridTemplateColumns: 'repeat(3, 100px)', gridAutoRows: '20px' }, [
    box('a', {}),
    box('b', { gridRow: 1 }),
    box('c', { gridRow: 2 }),
    box('d', {}),
  ]),
  grid('G18 span de linhas', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '30px', gap: 4 }, [
    box('tall', { gridRow: 'span 2' }),
    ...boxes('i', 4, {}),
  ]),
  grid('G19 sparse: o cursor não volta', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '20px' }, [
    box('a', {}),
    box('wide', { gridColumn: 'span 3' }),
    box('b', {}),
  ]),
  grid('G20 coluna definida, linha automática', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '20px' }, [
    box('a', {}),
    box('b', {}),
    box('c', { gridColumn: 1 }),
  ]),
  // ───────────── grid: alinhamento e caixa do item ─────────────
  grid('G21 justifySelf/alignSelf', { gridTemplateColumns: 'repeat(3, 100px)', gridAutoRows: '100px' }, [
    box('start', { width: 40, height: 40, justifySelf: 'start', alignSelf: 'start' }),
    box('center', { width: 40, height: 40, justifySelf: 'center', alignSelf: 'center' }),
    box('end', { width: 40, height: 40, justifySelf: 'end', alignSelf: 'end' }),
  ]),
  grid('G22 margin auto centraliza na célula', { gridTemplateColumns: '200px', gridAutoRows: '100px' }, [box('a', { width: 50, height: 30, margin: 'auto' })]),
  grid('G23 margens do item com stretch', { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '80px' }, [
    box('a', { margin: 10 }),
    box('b', { marginLeft: 20, marginTop: 5 }),
  ]),
  grid('G24 justifyItems start: largura pelo conteúdo', { gridTemplateColumns: '300px', justifyItems: 'start' }, [text('a', LOREM_SHORT)]),
  grid('G25 padding e borda no contêiner', { gridTemplateColumns: 'repeat(2, 1fr)', padding: 20, border: '5px solid #000', gap: 10, width: 400 }, boxes('i', 2, { height: 30 })),
  grid('G26 grid aninhado', { gridTemplateColumns: '1fr 2fr', gap: 10 }, [
    box('left', { height: 50 }),
    box('inner', { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }, boxes('n', 4, { height: 20 })),
  ]),
  grid('G27 texto quebra na largura da coluna', { gridTemplateColumns: '150px 150px 150px', columnGap: 10, rowGap: 8 }, [
    text('a', LOREM_SHORT),
    text('b', LOREM_LONG),
    text('c', 'Curto'),
    text('d', 'Outra linha'),
  ]),
  grid('G28 dashboard 3×2 (fr e auto)', { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'auto', gap: 16, padding: 16 }, [
    ...['Receita', 'Custo', 'NPS', 'Churn', 'Uptime', 'Áreas'].map((label, index) =>
      box(`card${index + 1}`, { display: 'flex', flexDirection: 'column', padding: 12, gap: 4 }, [
        text(`label${index + 1}`, label, { fontSize: 14 }),
        text(`value${index + 1}`, `${(index + 1) * 11},${index}`, { fontSize: 32 }),
      ]),
    ),
  ]),
  // ───────────── flex ─────────────
  flex('F01 wrap com gap', { flexWrap: 'wrap', gap: 10, width: 300, alignItems: 'flex-start' }, boxes('i', 5, { width: 100, height: 20 })),
  flex('F02 wrap com margens', { flexWrap: 'wrap', width: 300, alignItems: 'flex-start' }, boxes('i', 4, { width: 120, height: 20, margin: 5 })),
  flex('F03 margin auto empurra para a direita', { height: 30 }, [box('a', { width: 50 }), box('b', { width: 50, marginLeft: 'auto' })]),
  flex('F04 margin auto centraliza nos dois eixos', { height: 200, width: 300 }, [box('a', { width: 60, height: 40, margin: 'auto' })]),
  flex('F05 flex 1, 2 e basis fixa', { width: 300, height: 10 }, [box('a', { flex: 1 }), box('b', { flex: 2 }), box('c', { flexBasis: 60, flexShrink: 0 })]),
  flex('F06 order', { height: 10 }, [box('a', { width: 10 }), box('b', { width: 20, order: -1 }), box('c', { width: 30, order: 1 }), box('d', { width: 40 })]),
  flex('F07 alignContent center com wrap', { flexWrap: 'wrap', width: 200, height: 200, alignContent: 'center' }, boxes('i', 3, { width: 90, height: 30 })),
  flex('F08 space-between e center', { justifyContent: 'space-between', alignItems: 'center', height: 100 }, [box('a', { width: 40, height: 20 }), box('b', { width: 40, height: 60 }), box('c', { width: 40, height: 40 })]),
  flex('F09 row-reverse', { flexDirection: 'row-reverse', height: 20, width: 300 }, [box('a', { width: 50 }), box('b', { width: 70 })]),
  flex('F10 rodapé com marginTop auto', { flexDirection: 'column', height: 300, padding: 20 }, [text('title', 'Título', { fontSize: 24 }), text('foot', 'Fonte: plataforma', { fontSize: 12, marginTop: 'auto' })]),
  // ───────────── block ─────────────
  { name: 'B01 margens de irmãos colapsam', width: W, height: H, root: box('root', { display: 'block' }, [box('a', { height: 20, marginBottom: 20 }), box('b', { height: 20, marginTop: 30 })]) },
  { name: 'B02 margem negativa no colapso', width: W, height: H, root: box('root', { display: 'block' }, [box('a', { height: 20, marginBottom: 20 }), box('b', { height: 20, marginTop: -5 })]) },
  { name: 'B03 filhos esticam na largura de conteúdo', width: W, height: H, root: box('root', { display: 'block', padding: '10px 30px', width: 400 }, [box('a', { height: 20 }), box('b', { height: 20, marginLeft: 15 })]) },
  { name: 'B04 margin 0 auto centraliza', width: W, height: H, root: box('root', { display: 'block', width: 400 }, [box('a', { height: 20, width: 100, margin: '0 auto' })]) },
  // ───────────── caixa, posição e herança ─────────────
  { name: 'X01 border-box: borda e padding dentro da largura', width: W, height: H, root: box('root', { display: 'flex', flexDirection: 'column', width: 200, border: '5px solid #000', padding: 10 }, [box('a', { height: 20 })]) },
  { name: 'X02 bordas por lado ocupam espaço', width: W, height: H, root: box('root', { display: 'flex', flexDirection: 'column', width: 200, borderLeft: '8px solid #000', borderTop: '3px solid #000' }, [box('a', { height: 20 })]) },
  { name: 'X03 relative desloca sem mexer nos irmãos', width: W, height: H, root: box('root', { display: 'flex', flexDirection: 'column' }, [box('a', { height: 20, position: 'relative', top: 7, left: 11 }), box('b', { height: 20 })]) },
  { name: 'X04 absolute com right/bottom', width: W, height: H, root: box('root', { display: 'flex', position: 'relative', width: 300, height: 200 }, [box('a', { position: 'absolute', right: 10, bottom: 20, width: 50, height: 40 })]) },
  { name: 'I01 fontSize herdado define a altura da linha', width: W, height: H, root: box('root', { display: 'flex', flexDirection: 'column', fontSize: 30 }, [text('a', 'Herdado')]) },
  { name: 'I02 letterSpacing e textTransform herdados', width: W, height: H, root: box('root', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', letterSpacing: 2, textTransform: 'uppercase', fontSize: 16 }, [text('a', 'espaçado')]) },
];
