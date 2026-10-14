import { Box, Deck, Shape, Slide, Text, defineDeck } from 'pptsx';

const items = [
  'Migrar os três pipelines legados de faturamento.',
  'Revisar o contrato de armazenamento (+38% de volume).',
  'Treinar crédito e logística no catálogo de dados.',
  'Definir donos para 42 conjuntos sem responsável.',
  'Automatizar o alerta de atraso das cargas noturnas.',
  'Publicar o SLA de disponibilidade por domínio.',
  'Encerrar as planilhas locais dos relatórios oficiais.',
  'Padronizar colunas de data e moeda entre as áreas.',
  'Arquivar painéis que ninguém abre há 90 dias.',
];

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={18} color="#1B2A4A">
      <Text fontSize={28} fontWeight="bold"
        borderLeft="6px solid #2F6FED" paddingLeft={14}>
        Pontos de atenção para o Q4
      </Text>
      <Box paginate flex={1} gap={14}>
        {items.map((item) => (
          <Box display="flex" gap={12} alignItems="flex-start">
            <Shape kind="ellipse" width={9} height={9} flexShrink={0}
              marginTop={8} backgroundColor="#2F6FED" />
            <Text fontSize={22} flex={1}>{item}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={11} color="#5B6680" marginTop="auto">
        Título e rodapé se repetem em cada parte.
      </Text>
    </Slide>
  </Deck>
));
