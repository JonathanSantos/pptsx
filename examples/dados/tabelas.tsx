import { B, Deck, Slide, Span, Sup, Table, Text, defineDeck } from 'pptsx';
import type { TableCellContext, TableCellSpec } from 'pptsx';

// M14-3/4: tabelas nativas com cabeçalho de dois níveis mesclado, rowSpan, cor por valor
// (cell()), rich text e ícones nas células, e uma tabela longa que continua em outros slides.

const INK = '#1B2A4A';
const HEADER = { fill: '#1B2A4A', color: '#FFFFFF' };
const icon = (name: string) => `../assets/icons/${name}.svg`;

/** Δ formatado e colorido pelo valor: vermelho quando negativo, verde quando positivo. */
const byValue = ({ col, value, header }: TableCellContext): Partial<TableCellSpec> | undefined => {
  if (header || col !== 4 || typeof value !== 'number') return undefined;
  const text = percent(value);
  return value < 0 ? { text, color: '#B91C1C', fill: '#FEE2E2', fontWeight: 'bold' } : { text, color: '#047857' };
};

/** Número com vírgula decimal. */
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;

// Slide 4: 40 linhas de lançamentos (continua em outros slides com o cabeçalho repetido).
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'];
const LONG_ROWS = Array.from({ length: 40 }, (_, i) => [
  `${String(i + 1).padStart(2, '0')}/${MONTHS[i % MONTHS.length]}`,
  ['Fornecedor', 'Folha', 'Impostos', 'Serviços'][i % 4]!,
  `Lançamento ${i + 1} do período`,
  (((i * 37) % 900) + 100).toFixed(2).replace('.', ','),
]);

export default defineDeck(() => (
  <Deck>
    <Slide padding="28 36" gap={14} color={INK}>
      <Text fontSize={24} fontWeight="bold">Receita por região: 2025 × 2026</Text>
      <Table
        fontSize={13}
        header={HEADER}
        border="#CBD5E1"
        stripe="#F4F6FA"
        cellPadding={6}
        headerRows={[[{ text: 'Região', rowSpan: 2, valign: 'middle' }, { text: '2025', colSpan: 2, align: 'center' }, { text: '2026', colSpan: 2, align: 'center' }]]}
        columns={[
          { header: '' , width: '28%' },
          { header: 'R$ mi', align: 'right' },
          { header: 'part.', align: 'right' },
          { header: 'R$ mi', align: 'right' },
          { header: 'part.', align: 'right' },
        ]}
        rows={[
          ['Sudeste', '88,4', '42%', '96,1', '43%'],
          ['Sul', '42,1', '20%', '44,8', '20%'],
          ['Centro-Oeste', '31,7', '15%', '33,9', '15%'],
          ['Nordeste', '27,9', '13%', '29,3', '13%'],
          ['Norte', '12,3', '6%', '12,0', '5%'],
          [{ children: <B>Total</B> }, { children: <B>210,4</B> }, '100%', { children: <B>224,1</B> }, '100%'],
        ]}
      />
    </Slide>
    <Slide padding="28 36" gap={14} color={INK}>
      <Text fontSize={24} fontWeight="bold">Variação por produto (cor por valor)</Text>
      <Table
        fontSize={13}
        header={HEADER}
        border="#CBD5E1"
        cellPadding={6}
        valign="middle"
        cell={byValue}
        columns={[
          { header: 'Linha', width: '20%' },
          { header: 'Produto' },
          { header: '2025', align: 'right' },
          { header: '2026', align: 'right' },
          { header: 'Δ', align: 'right' },
        ]}
        rows={[
          [{ text: 'Grãos', rowSpan: 3, fill: '#EEF2FF', fontWeight: 'bold' }, 'Soja', decimal(41.2), decimal(44.0), 6.8],
          ['Milho', decimal(30.5), decimal(28.1), -7.9],
          ['Trigo', decimal(8.3), decimal(9.1), 9.6],
          [{ text: 'Café', rowSpan: 2, fill: '#FEF3C7', fontWeight: 'bold' }, 'Arábica', decimal(12.4), decimal(15.9), 28.2],
          ['Conilon', decimal(6.1), decimal(5.2), -14.8],
        ]}
      />
      <Text fontSize={11} color="#5B6680">Δ em vermelho quando negativo (função cell() da tabela); a 1ª coluna usa rowSpan.</Text>
    </Slide>
    <Slide padding="28 36" gap={14} color={INK}>
      <Text fontSize={24} fontWeight="bold">Status dos sistemas (ícones e rich text)</Text>
      <Table
        fontSize={14}
        header={HEADER}
        border="#CBD5E1"
        stripe="#F8FAFC"
        cellPadding={7}
        valign="middle"
        columns={[{ header: 'Sistema', width: '30%' }, { header: 'Situação' }, { header: 'Disponibilidade', align: 'right', width: '22%' }]}
        rows={[
          [{ text: 'Site', icon: { src: icon('globe'), color: '#2F6FED' } }, { children: <><B>Normal</B>, sem incidentes</> }, { children: <>99,98&nbsp;%<Sup>1</Sup></> }],
          [{ text: 'API', icon: { src: icon('server'), color: '#2F6FED' } }, { children: <><Span color="#B45309" fontWeight="bold">Degradado</Span>: latência alta no T3</> }, '99,71 %'],
          [{ text: 'Banco', icon: { src: icon('database'), color: '#2F6FED' } }, { children: <><B>Normal</B></> }, '100,00 %'],
          [{ text: 'Login', icon: { src: icon('lock'), color: '#B91C1C' } }, { children: <><Span color="#B91C1C" fontWeight="bold">Incidente</Span> em 12/set, resolvido em 40 min</> }, '99,52 %'],
        ]}
      />
      <Text fontSize={11} color="#5B6680"><Sup>1</Sup> Média móvel de 90 dias.</Text>
    </Slide>
    <Slide padding="28 36 32" gap={12} color={INK}>
      <Text fontSize={24} fontWeight="bold">Lançamentos do período</Text>
      <Table paginate flex={1} fontSize={12} header={HEADER} border="#CBD5E1" stripe="#F4F6FA" cellPadding={4}
        columns={[{ header: 'Data', width: '12%' }, { header: 'Categoria', width: '18%' }, { header: 'Descrição' }, { header: 'Valor (R$)', align: 'right', width: '16%' }]}
        rows={LONG_ROWS} />
    </Slide>
  </Deck>
));
