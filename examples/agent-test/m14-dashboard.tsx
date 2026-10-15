import { B, Box, Chart, Deck, Shape, Slide, Table, Text, defineDeck } from 'pptsx';
import type { TableCellContext, TableCellSpec } from 'pptsx';

// Paleta local (sem tokens de examples/): o deck usa só primitivas.
const COR = {
  marca: '#14213D',
  marcaEscura: '#0B1428',
  destaque: '#FCA311',
  tinta: '#1B2A4A',
  apagado: '#5B6680',
  superficie: '#F4F6FA',
  grade: '#CBD5E1',
  branco: '#FFFFFF',
  canalLoja: '#9DB4E6',
  canalOnline: '#2F6FED',
  canalParceiros: '#FCA311',
};

const PRODUTOS: readonly (readonly [string, string, string, number])[] = [
  ['Cafeteira Aurora', '12,4', '15,1', 21.8],
  ['Moedor Bruma', '8,9', '7,6', -14.6],
  ['Chaleira Brisa', '6,2', '6,9', 11.3],
  ['Prensa Garoa', '5,1', '4,8', -5.9],
  ['Kit Barista', '3,7', '4,6', 24.3],
];

// O Δ entra como número na linha; o cell() formata com vírgula e escolhe a cor pelo sinal.
const corDelta = ({ col, value, header }: TableCellContext): Partial<TableCellSpec> | undefined => {
  if (header || col !== 3 || typeof value !== 'number') return undefined;
  const text = `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
  if (value < 0) return { text, color: '#B91C1C', fill: '#FEE2E2', fontWeight: 'bold' };
  return { text, color: '#047857', fill: '#DCFCE7', fontWeight: 'bold' };
};

export default defineDeck((ctx) => (
  <Deck>
    {/* 1. Capa */}
    <Slide padding={48} justifyContent="center" backgroundColor={COR.marca} color={COR.branco}>
      <Shape kind="ellipse" position="absolute" right={-ctx.height * 0.4} top={-ctx.height * 0.4}
        width={ctx.height * 0.9} height={ctx.height * 0.9} backgroundColor={COR.marcaEscura} zIndex={-1} />
      <Box position="absolute" left={0} bottom={0} width="100%" height={8} backgroundColor={COR.destaque} />
      <Text fontSize={13} letterSpacing={2} textTransform="uppercase" color={COR.destaque} fontWeight="bold">
        Cafés Serra Alta · Comercial
      </Text>
      <Text fontSize={{ base: 42, tall: 46 }} fontWeight="bold" marginTop={10}>Dashboard de vendas 2026</Text>
      <Text fontSize={20} color="#C9D2E3" marginTop={8}>Canais, trimestres e produtos em destaque</Text>
    </Slide>

    {/* 2. Dashboard: empilhado + tabela colorida pelo Δ */}
    <Slide padding="28 36" gap={14} backgroundColor={COR.branco} color={COR.tinta}>
      <Text fontSize={24} fontWeight="bold" borderLeft={`6px solid ${COR.destaque}`} paddingLeft={12}>
        Vendas por canal e por produto
      </Text>
      <Box display="grid" flex={1} gap={20}
        gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', tall: 'minmax(0, 1fr)' }}
        gridTemplateRows={{ base: 'minmax(0, 1fr)', tall: 'minmax(0, 1fr) auto' }}>
        <Chart kind="stackedBar" legend={{ position: 'top' }} yAxis={{ title: 'R$ mi', min: 0 }}
          labels={{ position: 'center' }}
          colors={[COR.canalLoja, COR.canalOnline, COR.canalParceiros]}
          data={{
            categories: ['T1', 'T2', 'T3', 'T4'],
            series: [
              { name: 'Lojas', values: [14, 15, 16, 18] },
              { name: 'Online', values: [7, 9, 10, 13] },
              { name: 'Parceiros', values: [4, 4, 5, 6] },
            ],
          }} />
        <Box gap={8} justifyContent="center">
          <Text fontSize={14} fontWeight="bold" color={COR.apagado}>Produtos (R$ mi)</Text>
          <Table fontSize={13} header={{ fill: COR.marca, color: COR.branco }} border={COR.grade}
            stripe={COR.superficie} valign="middle" cell={corDelta}
            columns={[
              { header: 'Produto' },
              { header: '2025', align: 'right' },
              { header: '2026', align: 'right' },
              { header: 'Δ %', align: 'right' },
            ]}
            rows={PRODUTOS.map((p) => [...p])} />
        </Box>
      </Box>
      <Text fontSize={11} color={COR.apagado}>Fonte: ERP comercial, fechamento de 2026 (dados fictícios).</Text>
    </Slide>

    {/* 3. Tabela com cabeçalho de dois níveis */}
    <Slide padding="28 36" gap={14} backgroundColor={COR.branco} color={COR.tinta}>
      <Text fontSize={24} fontWeight="bold" borderLeft={`6px solid ${COR.destaque}`} paddingLeft={12}>
        Receita por região e canal
      </Text>
      <Table fontSize={{ base: 15, tall: 17 }} cellPadding={6} header={{ fill: COR.marca, color: COR.branco }} border={COR.grade}
        stripe={COR.superficie} valign="middle"
        headerRows={[[
          { text: 'Região', rowSpan: 2, valign: 'middle' },
          { text: '2025', colSpan: 3, align: 'center' },
          { text: '2026', colSpan: 3, align: 'center' },
        ]]}
        columns={[
          { header: '', width: '22%' },
          { header: 'Lojas', align: 'right' },
          { header: 'Online', align: 'right' },
          { header: 'Parceiros', align: 'right' },
          { header: 'Lojas', align: 'right' },
          { header: 'Online', align: 'right' },
          { header: 'Parceiros', align: 'right' },
        ]}
        rows={[
          ['Sudeste', '24,1', '11,8', '6,0', '27,3', '16,2', '7,4'],
          ['Sul', '12,6', '6,1', '3,2', '13,9', '8,4', '3,9'],
          ['Nordeste', '9,8', '4,0', '2,1', '10,4', '5,9', '2,6'],
          ['Centro-Oeste', '5,9', '2,7', '1,4', '6,6', '3,8', '1,7'],
          [{ children: <B>Total</B> }, { children: <B>52,4</B> }, { children: <B>24,6</B> }, { children: <B>12,7</B> },
            { children: <B>58,2</B> }, { children: <B>34,3</B> }, { children: <B>15,6</B> }],
        ]} />
      <Text fontSize={11} color={COR.apagado} marginTop="auto">Valores em R$ mi. Dados fictícios.</Text>
    </Slide>
  </Deck>
));
