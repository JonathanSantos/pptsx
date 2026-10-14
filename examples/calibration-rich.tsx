import { B, Box, Deck, I, Image, Shape, Slide, Span, Text, defineDeck } from 'pptsx';
import type { SlideElement, TextChildren, TextProps } from 'pptsx';

// M8: grade de calibração do rich text (Span/B/I), NBSP, nowrap e align="baseline".
// O M8-H gera este deck em 16x9 com --debug e compara, amostra a amostra, o preview nativo
// com o Keynote (PDF vetorial, mesmo método do M3-F): mesmas palavras no fim de cada linha,
// mesma largura dos trechos em negrito/itálico (a medição soma as larguras por face, sem
// kerning entre runs), NBSP colando as palavras, nowrap numa linha só e baselines alinhadas.
// Cada amostra tem largura fixa (pt) para a largura de quebra ser exata e conhecida.

export interface RichCalibrationSample {
  readonly id: string;
  readonly size: number;
  readonly width: number;
  /** O que a amostra testa (vai no rótulo). */
  readonly note: string;
}

interface Placed extends RichCalibrationSample {
  /** Slide (1 = legenda) e linha dentro do slide; só organizam a grade. */
  readonly slide: number;
  readonly row: number;
  readonly body: SlideElement;
}

const INK = '#1B2A4A';
const MUTED = '#5B6680';
const GREEN = '#1E9E6A';
const RED = '#D64545';
const BLUE = '#2F6FED';

type TextOptions = Omit<TextProps, 'size' | 'children'>;

/** Text da amostra: fit="error" por padrão, como no calibration.tsx (a quebra não pode mudar o size). */
const text = (size: number, children: TextChildren, options: TextOptions = {}): SlideElement => (
  <Text size={size} color={INK} fit="error" {...options}>{children}</Text>
);

const placed: readonly Placed[] = [
  // ── Slide 2: estilo por run no meio da linha
  { slide: 2, row: 1, id: 'R01', size: 12, width: 200, note: 'negrito no meio',
    body: text(12, <>A receita <B>recorrente</B> cresceu 14% no trimestre, puxada pelo varejo e pelo atacado.</>) },
  { slide: 2, row: 1, id: 'R02', size: 12, width: 200, note: 'itálico no meio',
    body: text(12, <>Os dados <I>preliminares</I> indicam alta de 8% na margem operacional consolidada.</>) },
  { slide: 2, row: 1, id: 'R03', size: 12, width: 200, note: 'negrito+itálico',
    body: text(12, <>A meta <B><I>revisada pela diretoria</I></B> vale para o segundo semestre inteiro.</>) },
  { slide: 2, row: 2, id: 'R04', size: 18, width: 300, note: 'cor por run',
    body: text(18, <>Receita <Span color={GREEN}>+14%</Span>, custo <Span color={RED}>+3%</Span> e margem <Span color={BLUE}>estável</Span> no período.</>) },
  { slide: 2, row: 2, id: 'R05', size: 18, width: 300, note: 'negrito cruza a quebra',
    body: text(18, <>Os resultados mostram <B>crescimento consistente em todas as regiões atendidas</B> pela operação.</>) },
  { slide: 2, row: 3, id: 'R06', size: 18, width: 300, note: 'itálico cruza a quebra',
    body: text(18, <>Segundo o comitê, <I>a integração das plataformas reduziu o tempo de resposta</I> em 37%.</>) },
  { slide: 2, row: 3, id: 'R07', size: 12, width: 200, note: 'Text bold, Span regular',
    body: text(12, <>Resultado: <Span weight="regular">acima da meta em todas as unidades avaliadas no ciclo</Span>.</>, { weight: 'bold' }) },
  { slide: 2, row: 3, id: 'R08', size: 12, width: 140, note: 'Text itálico, Span reto',
    body: text(12, <>Fonte: <Span italic={false}>relatório interno</Span> de setembro de 2026.</>, { italic: true }) },

  // ── Slide 3: tamanhos (12/18/32 pt), entrelinha e fronteira de run dentro da palavra
  { slide: 3, row: 1, id: 'R09', size: 12, width: 220, note: '3 estilos numa linha',
    body: text(12, <>Receita <B>recorde</B>, custo <I>controlado</I> e <Span color={GREEN} weight="bold">margem</Span> em alta no ano.</>) },
  { slide: 3, row: 1, id: 'R10', size: 18, width: 330, note: 'mesmo texto em 18',
    body: text(18, <>Receita <B>recorde</B>, custo <I>controlado</I> e <Span color={GREEN} weight="bold">margem</Span> em alta no ano.</>) },
  { slide: 3, row: 2, id: 'R11', size: 32, width: 420, note: 'mesmo texto em 32',
    body: text(32, <>Receita <B>recorde</B>, custo <I>controlado</I> e <Span color={GREEN} weight="bold">margem</Span> em alta.</>) },
  { slide: 3, row: 2, id: 'R12', size: 18, width: 220, note: 'lh1.2 com runs',
    body: text(18, <>Ampliação da <B>presença regional</B> com foco em <I>logística e distribuição</I>.</>, { lineHeight: 1.2 }) },
  { slide: 3, row: 3, id: 'R13', size: 32, width: 360, note: 'negrito abre a 2ª linha',
    body: text(32, <>Visão 2030: <B>liderança regional</B></>) },
  { slide: 3, row: 3, id: 'R14', size: 12, width: 150, note: 'run no meio da palavra',
    body: text(12, <><B>Super</B>ávit de <B>R$</B>4,7 bi e <I>sub</I>estimativa de <Span color={RED}>2</Span>,3%.</>) },

  // ── Slide 4: NBSP e nowrap
  { slide: 4, row: 1, id: 'R15', size: 14, width: 100, note: 'NBSP (\\u00A0)',
    body: text(14, 'Receita de R$\u00A052,4\u00A0mi no trimestre.') },
  { slide: 4, row: 1, id: 'R16', size: 14, width: 100, note: 'controle: espaço comum',
    body: text(14, 'Receita de R$ 52,4 mi no trimestre.') },
  { slide: 4, row: 1, id: 'R17', size: 14, width: 120, note: 'NBSP (&nbsp;) + negrito',
    body: text(14, <>Disponibilidade de <B>99,95&nbsp;%</B> no período.</>) },
  { slide: 4, row: 1, id: 'R18', size: 18, width: 120, note: 'nowrap cabe',
    body: text(18, 'R$ 52,4 mi', { nowrap: true }) },
  { slide: 4, row: 2, id: 'R19', size: 18, width: 130, note: 'nowrap encolhe (shrink, min 12)',
    body: text(18, <>Receita: <B>R$ 52,4 mi</B></>, { nowrap: true, fit: 'shrink', minSize: 12 }) },
  { slide: 4, row: 2, id: 'R21', size: 14, width: 200, note: 'nowrap, 2 parágrafos com runs',
    body: text(14, <>Receita: <B>R$ 52,4 mi</B>{'\n'}Custo: <I>R$ 12,1 mi</I></>, { nowrap: true }) },
  { slide: 4, row: 2, id: 'R20', size: 18, width: 130, note: 'nowrap não cabe (shrink, min 14): text-overflow esperado',
    body: text(18, 'Receita total do trimestre: R$ 52,4 mi', { nowrap: true, fit: 'shrink', minSize: 14 }) },

  // ── Slide 5: parágrafos e reticência com runs
  { slide: 5, row: 1, id: 'R22', size: 14, width: 260, note: '\\n dentro de um Span',
    body: text(14, <>Primeiro parágrafo com <B>negrito que continua{'\n'}no segundo parágrafo</B> e termina normal.</>) },
  { slide: 5, row: 1, id: 'R23', size: 14, width: 260, note: 'parágrafos, itálico em cada',
    body: text(14, <><I>Missão:</I> servir bem.{'\n'}<I>Visão:</I> liderar a região.{'\n\n'}<I>Valores:</I> ética e colaboração em todas as relações.</>) },
  { slide: 5, row: 2, id: 'R24', size: 14, width: 220, note: 'maxLines 2, reticência num Span: text-truncated esperado',
    body: text(14, <>O programa de eficiência reduziu o consumo e <B>gerou economia relevante, reinvestida em capacitação técnica das equipes</B>.</>, { maxLines: 2, fit: 'truncate' }) },
  { slide: 5, row: 2, id: 'R25', size: 12, width: 200, note: 'maxLines 1, Span colorido cortado: text-truncated esperado',
    body: text(12, <>Status: <Span color={RED} weight="bold">atrasado por dependência de fornecedor externo</Span></>, { maxLines: 1, fit: 'truncate' }) },
  { slide: 5, row: 3, id: 'R26', size: 12, width: 220, note: 'B com Span regular dentro',
    body: text(12, <><B>Negrito, <Span weight="regular">regular no meio do negrito</Span> e negrito de novo</B> até o fim.</>) },
  { slide: 5, row: 3, id: 'R27', size: 10, width: 180, note: 'center com runs',
    body: text(10, <>Compromisso com <B>diversidade</B>, <I>equidade</I> e <Span color={BLUE}>inclusão</Span> em todos os níveis da organização.</>, { align: 'center' }) },

  // ── Slide 6: align="baseline" (só em row; Text sem grow/width, que encolhe pelo conteúdo)
  { slide: 6, row: 1, id: 'R28', size: 18, width: 230, note: 'baseline: Shape 8×8 + Text',
    body: (
      <Box direction="row" align="baseline" gap={10}>
        <Shape kind="ellipse" width={8} height={8} shrink={0} fill={BLUE} />
        {text(18, <>Marcador assentado na <B>baseline</B> da 1ª linha do texto.</>)}
      </Box>
    ) },
  { slide: 6, row: 1, id: 'R29', size: 40, width: 200, note: 'baseline: Text 40 + Text 12',
    body: (
      <Box direction="row" align="baseline" gap={8}>
        {text(40, '52,4', { weight: 'bold' })}
        {text(12, <><Span color={GREEN} weight="bold">▲ +14,2%</Span> vs Q2</>)}
      </Box>
    ) },
  { slide: 6, row: 1, id: 'R30', size: 14, width: 200, note: 'baseline: Image 24 pt + Text',
    body: (
      <Box direction="row" align="baseline" gap={8}>
        <Image src="./assets/chart.png" width={24} shrink={0} />
        {text(14, <>Gráfico com base na <I>baseline</I> do texto.</>)}
      </Box>
    ) },
];

/** Metadados planos para o agente de calibração cruzar com o renderizador real. */
export const samples: readonly RichCalibrationSample[] = placed.map(({ id, size, width, note }) => ({ id, size, width, note }));

const label = (s: RichCalibrationSample): string => [s.id, `${s.size}pt`, `${s.width}pt`, s.note].join(' · ');

const Sample = ({ s }: { s: Placed }) => (
  <Box width={s.width} gap={3}>
    <Text size={8} color={MUTED} fit="error">{label(s)}</Text>
    <Box width={s.width}>{s.body}</Box>
  </Box>
);

const SECTION_TITLES: Readonly<Record<number, string>> = {
  2: 'Estilo por run: negrito, itálico e cor no meio da linha',
  3: 'Tamanhos 12/18/32 pt, entrelinha e run dentro da palavra',
  4: 'NBSP e nowrap',
  5: 'Parágrafos, reticência e herança de estilo',
  6: 'align="baseline"',
};

const SLIDES = Object.keys(SECTION_TITLES).map(Number);

const rowsOf = (slide: number): readonly (readonly Placed[])[] => {
  const items = placed.filter((p) => p.slide === slide);
  const rowIds = [...new Set(items.map((p) => p.row))].sort((a, b) => a - b);
  return rowIds.map((r) => items.filter((p) => p.row === r));
};

const GridSlide = ({ slide }: { slide: number }) => (
  <Slide padding={24} gap={14} background="#FFFFFF">
    <Text size={12} weight="bold" color={INK} fit="error">{`${slide}/${SLIDES.length + 1} · ${SECTION_TITLES[slide]}`}</Text>
    {rowsOf(slide).map((row) => (
      <Box direction="row" gap={16} align="start">
        {row.map((s) => <Sample s={s} />)}
      </Box>
    ))}
  </Slide>
);

const LEGEND = [
  'Deck de calibração do rich text (M8). Cada amostra R01–R30 tem um rótulo de 8 pt e, abaixo, o conteúdo numa caixa de largura fixa.',
  'Rótulo: id · tamanho · largura da caixa · o que a amostra testa.',
  'Gere com --debug: o contorno vermelho tracejado é a caixa calculada pela engine. No Keynote/PowerPoint o texto deve caber nele com o mesmo número de linhas, as mesmas palavras no fim de cada linha e os trechos em negrito/itálico/cor nos mesmos lugares.',
  'Diagnósticos esperados: R20 (text-overflow por largura, nowrap de propósito), R24 e R25 (text-truncated) e R19 (text-shrunk). Qualquer outro é divergência.',
].join('\n\n');

export default defineDeck(() => (
  <Deck>
    <Slide padding={48} gap={20} background="#FFFFFF">
      <Text size={32} weight="bold" color={INK} fit="error">Calibração de rich text</Text>
      <Box width={600}>
        <Text size={14} lineHeight={1.2} color={INK} fit="error">{LEGEND}</Text>
      </Box>
    </Slide>
    {SLIDES.map((n) => <GridSlide slide={n} />)}
  </Deck>
));
