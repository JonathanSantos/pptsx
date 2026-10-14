import { Box, Deck, Table, defineDeck, type TableColumn } from 'pptsx';
import { tokens } from '../tokens.ts';
import { ContentLayout } from '../layouts/index.ts';

const { color, font } = tokens;

// Deck de sondagem do M10: os três desfechos do ajuste de uma Table que não cabe.
// As mesmas 13 linhas (cabeçalho + 12) num Box de altura fixa, para o resultado não
// depender do tamanho do slide:
// - 1º slide: shrink que dá certo → text-shrunk (info) no path da tabela.
// - 2º slide: Box baixo demais até no minSize → table-overflow (error), "N de 12 linhas".
// - 3º slide: fit="error" não encolhe → table-overflow (error) no size do autor.
// Por isso este deck sai com exit 1 de propósito; examples/charts.tsx fica limpo.
const columns: readonly TableColumn[] = [
  { header: 'Mês', width: '28%' },
  { header: 'Consultas (mil)', align: 'right' },
  { header: 'Custo (R$ mil)', align: 'right' },
  { header: 'Δ custo', align: 'right' },
];

const rows = [
  ['Out/2025', '812', '96,4', '—'],
  ['Nov/2025', '845', '98,1', '+1,8%'],
  ['Dez/2025', '790', '93,0', '−5,2%'],
  ['Jan/2026', '868', '99,7', '+7,2%'],
  ['Fev/2026', '901', '101,2', '+1,5%'],
  ['Mar/2026', '934', '102,8', '+1,6%'],
  ['Abr/2026', '958', '97,5', '−5,2%'],
  ['Mai/2026', '987', '91,3', '−6,4%'],
  ['Jun/2026', '1.012', '86,0', '−5,8%'],
  ['Jul/2026', '1.040', '81,9', '−4,8%'],
  ['Ago/2026', '1.066', '78,2', '−4,5%'],
  ['Set/2026', '1.093', '75,1', '−4,0%'],
];

const style = {
  header: { fill: color.brand, color: color.white },
  stripe: color.surface,
  border: color.muted,
  color: color.ink,
} as const;

export default defineDeck(() => (
  <Deck>
    <ContentLayout title="Tabela encolhida para caber">
      {/* 13 linhas × (16,1 + 2 × 2) pt passam de 240 pt em 14 pt; em 12 pt cabem. */}
      <Box height={240}>
        <Table columns={columns} rows={rows} size={font.small} cellPadding={2} {...style} />
      </Box>
    </ContentLayout>

    <ContentLayout title="Nem no mínimo cabe">
      <Box height={160}>
        <Table columns={columns} rows={rows} size={font.small} cellPadding={2} {...style} />
      </Box>
    </ContentLayout>

    <ContentLayout title="fit=error não ajusta">
      <Box height={240}>
        <Table columns={columns} rows={rows} size={font.small} fit="error" {...style} />
      </Box>
    </ContentLayout>
  </Deck>
));
