import { Deck, defineDeck } from 'pptsx';
import { tokens } from './tokens.ts';
import { ClosingLayout, ContentLayout } from './layouts/index.ts';
import { Bullets } from './components/index.ts';

const { font } = tokens;

// Lista longa demais para um slide: com paginate os itens mantêm o size do autor e o
// que não cabe continua num clone do slide (mesmo título). O encerramento vem depois
// para mostrar que os índices de saída andam (o diagnóstico traz data.sourceSlide).
export default defineDeck((ctx) => (
  <Deck>
    <ContentLayout title="Doze pontos de atenção para o Q4" notes="Lista paginada: as notas repetem em todas as partes.">
      <Bullets
        paginate
        size={font.body}
        items={[
          'Migrar os últimos três pipelines legados de faturamento antes do congelamento de dezembro.',
          'Revisar o contrato de armazenamento: o volume histórico cresceu 38% e o custo acompanha.',
          'Treinar as áreas de crédito e logística no catálogo de dados antes de abrir o acesso.',
          'Definir donos para os 42 conjuntos de dados que ainda aparecem como “sem responsável”.',
          'Automatizar o alerta de atraso das cargas noturnas, hoje acompanhado manualmente.',
          'Reduzir para menos de 1% a taxa de consultas que estouram o tempo limite no painel.',
          'Publicar o SLA de disponibilidade por domínio, e não só o número médio da plataforma.',
          'Encerrar as cópias locais de planilhas que alimentam relatórios oficiais da diretoria.',
          'Padronizar os nomes de colunas de data e moeda nas tabelas compartilhadas entre áreas.',
          'Medir o uso real de cada painel e arquivar os que ninguém abre há mais de 90 dias.',
          'Rever as permissões de acesso a dados pessoais com o time jurídico e a segurança.',
          'Planejar a capacidade do cluster para o pico de fim de ano com 30% de folga.',
        ]}
      />
    </ContentLayout>

    <ClosingLayout
      ctx={ctx}
      title="Obrigado"
      subtitle="Dúvidas e sugestões sobre as prioridades do Q4 são bem-vindas."
      contact="dados-plataforma@empresa.com.br"
    />
  </Deck>
));
