import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

// M3: grade de calibração da medição de texto. Rodar com --debug e comparar, amostra a
// amostra, número de linhas e ponto de quebra no preview nativo vs. Keynote/PowerPoint.
// Cada amostra tem largura fixa (pt) para a largura de quebra ser exata e conhecida.

type Weight = 'regular' | 'bold';
type Align = 'left' | 'center' | 'right';

export interface CalibrationSample {
  readonly id: string;
  readonly size: number;
  readonly width: number;
  readonly weight: Weight;
  readonly italic: boolean;
  readonly lineHeight: number;
  readonly align: Align;
  readonly text: string;
}

interface Placed extends CalibrationSample {
  /** Slide (1 = legenda) e linha dentro do slide; só organizam a grade. */
  readonly slide: number;
  readonly row: number;
}

type SampleInput = Pick<CalibrationSample, 'id' | 'size' | 'width' | 'text'> &
  Partial<Omit<CalibrationSample, 'id' | 'size' | 'width' | 'text'>> & { readonly slide: number; readonly row: number };

const sample = (s: SampleInput): Placed => ({
  weight: 'regular',
  italic: false,
  lineHeight: 1,
  align: 'left',
  ...s,
});

const ALIGN_TEXT = 'Planejamento integrado entre as áreas comercial, financeira e de operações.';
const LH_TEXT = 'Metas claras, execução disciplinada e foco no cliente.';

const placed: readonly Placed[] = [
  // ── Slide 2: corpo pequeno (8–14 pt)
  sample({ slide: 2, row: 1, id: 'C01', size: 8, width: 100,
    text: 'Nossa estratégia de crescimento combina eficiência operacional, inovação contínua e atendimento personalizado para clientes corporativos em todo o país.' }),
  sample({ slide: 2, row: 1, id: 'C02', size: 10, width: 180,
    text: 'A integração das plataformas reduziu o tempo médio de resposta em 37%, liberando as equipes para atividades de maior valor estratégico e relacionamento.' }),
  sample({ slide: 2, row: 1, id: 'C03', size: 12, width: 220, weight: 'bold',
    text: 'Resultados consolidados do terceiro trimestre superaram as projeções iniciais da diretoria.' }),
  sample({ slide: 2, row: 1, id: 'C04', size: 14, width: 120, italic: true,
    text: 'Transformação digital com responsabilidade.' }),
  sample({ slide: 2, row: 2, id: 'C05', size: 10, width: 600,
    text: 'Primeiro parágrafo: visão geral do projeto e dos principais marcos de entrega previstos para o próximo ciclo de planejamento anual da companhia.\n\nParágrafo após uma linha vazia, para conferir a altura do parágrafo em branco.\nÚltima linha curta.' }),
  sample({ slide: 2, row: 3, id: 'C06', size: 14, width: 320, lineHeight: 1.2,
    text: 'Ampliação da presença regional com foco em logística, distribuição e experiência do consumidor final.' }),
  sample({ slide: 2, row: 3, id: 'C07', size: 12, width: 330, lineHeight: 1.5, align: 'right',
    text: 'Indicadores de satisfação mantiveram-se acima da meta em todas as unidades de negócio avaliadas.' }),

  // ── Slide 3: subtítulos (18–24 pt)
  sample({ slide: 3, row: 1, id: 'C08', size: 18, width: 240, weight: 'bold',
    text: 'Excelência operacional e governança corporativa' }),
  sample({ slide: 3, row: 1, id: 'C09', size: 18, width: 400, align: 'center',
    text: 'Conectamos pessoas, dados e processos para acelerar decisões de negócio.' }),
  sample({ slide: 3, row: 2, id: 'C10', size: 24, width: 300,
    text: 'Crescimento sustentável com participação dos colaboradores' }),
  sample({ slide: 3, row: 2, id: 'C11', size: 24, width: 340, weight: 'bold', lineHeight: 1.2,
    text: 'Inovação em cada etapa da operação' }),
  sample({ slide: 3, row: 3, id: 'C12', size: 18, width: 600, lineHeight: 1.5, align: 'right',
    text: 'Receita líquida de R$ 4,7 bilhões em 2025, alta de 12,3% sobre o ano anterior e margem estável.' }),

  // ── Slide 4: títulos (32–44 pt)
  sample({ slide: 4, row: 1, id: 'C13', size: 32, width: 360, weight: 'bold',
    text: 'Visão 2030: liderança regional' }),
  sample({ slide: 4, row: 1, id: 'C14', size: 32, width: 280, italic: true,
    text: 'Pessoas em primeiro lugar' }),
  sample({ slide: 4, row: 2, id: 'C15', size: 44, width: 420,
    text: 'Transformação contínua' }),
  sample({ slide: 4, row: 2, id: 'C16', size: 44, width: 220, align: 'center',
    text: 'Gestão ágil' }),

  // ── Slide 5: display (60 pt) e linha única "justa"
  sample({ slide: 5, row: 1, id: 'C17', size: 60, width: 600, weight: 'bold',
    text: 'Força e propósito' }),
  sample({ slide: 5, row: 2, id: 'C18', size: 60, width: 300,
    text: 'Juntos' }),
  // Larguras de C19/C20 = largura real no Arial ÷ 0,97 (TEXT_SAFETY) + ~2 pt: cabem por pouco.
  // C19: 328,1 pt medidos (338,3 com safety); C20: 397,2 pt (409,5 com safety).
  sample({ slide: 5, row: 2, id: 'C19', size: 24, width: 341, weight: 'bold',
    text: 'Margem operacional recorde' }),
  sample({ slide: 5, row: 3, id: 'C20', size: 18, width: 412,
    text: 'Receita recorrente anual cresceu 18% no período' }),

  // ── Slide 6: casos especiais
  sample({ slide: 6, row: 1, id: 'C21', size: 12, width: 200,
    text: 'Acesse https://www.exemplo-corporativo.com.br/relatorios/sustentabilidade/2025/resumo-executivo-completo.pdf para detalhes.' }),
  sample({ slide: 6, row: 1, id: 'C22', size: 14, width: 260,
    text: 'Gestão, inovação e expansão: ênfase à experiência do usuário, à segurança e à cooperação; Müller e a equipe de Zürich também têm vez.' }),
  sample({ slide: 6, row: 1, id: 'C23', size: 10, width: 180,
    text: 'Q3/2025: receita de R$ 1.234.567,89 (+8,5% a/a); EBITDA 23,4%; NPS 72 — meta 2026 ≥ 75. Ver nota nº 4, item (ii).' }),
  sample({ slide: 6, row: 2, id: 'C24', size: 14, width: 300, italic: true, lineHeight: 1.5,
    text: 'Missão\nVisão\n\nValores: ética, transparência e colaboração em todas as relações.' }),
  sample({ slide: 6, row: 2, id: 'C25', size: 12, width: 340, align: 'center', lineHeight: 1.2,
    text: 'Compromisso com a diversidade, a equidade e a inclusão em todos os níveis hierárquicos da organização, com metas públicas e acompanhamento trimestral pelo comitê executivo.' }),

  // ── Slide 7: alinhamento, entrelinha e textos longos
  sample({ slide: 7, row: 1, id: 'C26', size: 14, width: 200, align: 'left', text: ALIGN_TEXT }),
  sample({ slide: 7, row: 1, id: 'C27', size: 14, width: 200, align: 'center', text: ALIGN_TEXT }),
  sample({ slide: 7, row: 1, id: 'C28', size: 14, width: 200, align: 'right', text: ALIGN_TEXT }),
  sample({ slide: 7, row: 2, id: 'C29', size: 18, width: 200, lineHeight: 1, text: LH_TEXT }),
  sample({ slide: 7, row: 2, id: 'C30', size: 18, width: 200, lineHeight: 1.2, text: LH_TEXT }),
  sample({ slide: 7, row: 2, id: 'C31', size: 18, width: 200, lineHeight: 1.5, text: LH_TEXT }),
  sample({ slide: 7, row: 3, id: 'C32', size: 10, width: 140, weight: 'bold',
    text: 'O programa de eficiência energética reduziu o consumo nas fábricas, ampliou o uso de fontes renováveis e gerou economia relevante, reinvestida em capacitação técnica.' }),
  sample({ slide: 7, row: 3, id: 'C33', size: 8, width: 160, italic: true,
    text: 'Nota metodológica: os valores apresentados consideram a consolidação das subsidiárias, excluídos efeitos não recorrentes, variações cambiais extraordinárias e ajustes contábeis de períodos anteriores, conforme as normas vigentes.' }),
  sample({ slide: 7, row: 3, id: 'C34', size: 12, width: 340,
    text: 'Próximos passos: validação com as áreas, aprovação orçamentária e início da implantação piloto em três regionais até o fim do semestre.' }),
];

/** Dados planos para o agente de calibração cruzar com o renderizador real. */
export const samples: readonly CalibrationSample[] = placed.map(({ slide: _s, row: _r, ...rest }) => rest);

const INK = '#1B2A4A';
const MUTED = '#5B6680';

const label = (s: CalibrationSample): string =>
  [
    s.id,
    `${s.size}pt`,
    `${s.width}pt`,
    s.weight === 'bold' ? 'B' : '',
    s.italic ? 'I' : '',
    s.lineHeight !== 1 ? `lh${s.lineHeight}` : '',
    s.align !== 'left' ? s.align : '',
  ]
    .filter(Boolean)
    .join(' · ');

const Sample = ({ s }: { s: CalibrationSample }) => (
  <Box width={s.width} gap={3}>
    <Text size={8} color={MUTED} fit="error">{label(s)}</Text>
    <Box width={s.width}>
      <Text size={s.size} weight={s.weight} italic={s.italic} lineHeight={s.lineHeight} align={s.align} color={INK} fit="error">
        {s.text}
      </Text>
    </Box>
  </Box>
);

const SECTION_TITLES: Readonly<Record<number, string>> = {
  2: 'Corpo pequeno · 8–14 pt',
  3: 'Subtítulos · 18–24 pt',
  4: 'Títulos · 32–44 pt',
  5: 'Display 60 pt e linha única justa (TEXT_SAFETY)',
  6: 'Casos especiais: URL longa, acentos, números, parágrafos',
  7: 'Alinhamento, entrelinha e blocos longos',
};

const rowsOf = (slide: number): readonly (readonly Placed[])[] => {
  const items = placed.filter((p) => p.slide === slide);
  const rowIds = [...new Set(items.map((p) => p.row))].sort((a, b) => a - b);
  return rowIds.map((r) => items.filter((p) => p.row === r));
};

const GridSlide = ({ slide }: { slide: number }) => (
  <Slide padding={24} gap={14} background="#FFFFFF">
    <Text size={12} weight="bold" color={INK} fit="error">{`${slide}/7 · ${SECTION_TITLES[slide]}`}</Text>
    {rowsOf(slide).map((row) => (
      <Box direction="row" gap={16} align="start">
        {row.map((s) => <Sample s={s} />)}
      </Box>
    ))}
  </Slide>
);

const LEGEND = [
  'Deck de calibração da medição de texto (M3). Cada amostra C01–C34 tem um rótulo de 8 pt e, abaixo, o texto numa caixa de largura fixa.',
  'Rótulo: id · tamanho · largura da caixa · B (negrito) · I (itálico) · lh (entrelinha, quando ≠ 1) · alinhamento (quando ≠ left).',
  'Gere com --debug: o contorno vermelho tracejado é a caixa calculada pela engine. No Keynote/PowerPoint o texto deve caber nele com o mesmo número de linhas e as mesmas palavras no fim de cada linha.',
  'Divergência = quebra em palavra diferente, linha a mais/a menos ou texto vazando do contorno. Anote o id. Os dados de cada amostra estão em `samples` (exportado).',
].join('\n\n');

export default defineDeck(() => (
  <Deck>
    <Slide padding={48} gap={20} background="#FFFFFF">
      <Text size={32} weight="bold" color={INK} fit="error">Calibração de texto</Text>
      <Box width={600}>
        <Text size={14} lineHeight={1.2} color={INK} fit="error">{LEGEND}</Text>
      </Box>
    </Slide>
    {[2, 3, 4, 5, 6, 7].map((n) => <GridSlide slide={n} />)}
  </Deck>
));
