import { Box, Deck, Image, Shape, Text, defineDeck } from 'pptsx';
import { tokens } from './tokens.ts';
import { ClosingLayout, ContentLayout, CoverLayout } from './layouts/index.ts';
import { Bullets, KpiRow, TwoColumn } from './components/index.ts';

const { color, font, space } = tokens;

// Mesmo código para 16x9, 4x3 e wide: o flexbox redistribui o espaço e ctx só
// entra onde a estrutura muda (colunas empilhadas em telas mais "quadradas") ou
// onde sobra área para tipografia maior.
export default defineDeck((ctx) => {
  const stacked = ctx.aspect < 1.5;
  // wide é maior nos dois eixos: com largura sobrando, o texto cresce.
  const wide = ctx.scale > 1.2;
  // 4:3 tem a largura do 16:9 mas é mais alto: a altura extra vai para espaçamento e cartões maiores.
  const tall = stacked;
  return (
    <Deck>
      <CoverLayout
        ctx={ctx}
        caption="Revisão trimestral · outubro de 2026"
        title="Resultados Q3 2026"
        subtitle="Plataforma interna de dados"
      />

      <ContentLayout title="Destaques do trimestre" justify="center">
        <Bullets
          size={wide ? font.h2 + 6 : tall ? font.h2 + 4 : font.h2}
          gap={tall || wide ? space.gap * 1.25 : space.gap * 0.8}
          items={[
            'Receita recorrente cresceu 14% sobre o Q2.',
            'Pipelines legados migrados antes do prazo.',
            'Custo por consulta caiu 22% com novo cache.',
            'Três novas áreas passaram a usar o catálogo.',
            'Disponibilidade de 99,95% (meta: 99,9%).',
          ]}
        />
      </ContentLayout>

      <ContentLayout title="Receita recorrente em alta">
        <TwoColumn
          stacked={stacked}
          ratio={0.45}
          left={
            <Bullets
              size={wide ? font.body + 2 : font.body - 2}
              items={[
                'Quarto trimestre seguido de crescimento.',
                'Varejo responde por 61% da receita nova.',
                'Churn de clientes caiu para 1,8%.',
              ]}
            />
          }
          // Lado a lado o gráfico ocupa a largura da coluna (topo alinhado ao texto);
          // empilhado, ocupa a altura que sobra e encosta à esquerda, alinhado às bullets.
          right={
            stacked
              ? <Image src="./assets/revenue-chart.png" height="100%" alignSelf="start" />
              : <Image src="./assets/revenue-chart.png" width="100%" />
          }
        />
      </ContentLayout>

      <ContentLayout title="Indicadores-chave">
        <Box gap={space.gap * 1.5}>
          <KpiRow
            size={wide || tall ? 'lg' : 'md'}
            items={[
              { label: 'Receita (R$ mi)', value: '52,4', delta: '+14,2% vs Q2', trend: 'up' },
              { label: 'Custo por consulta', value: '−22%', delta: 'menor do ano', trend: 'down', sentiment: 'positive' },
              { label: 'NPS interno', value: '62', delta: '−4 pts vs Q2', trend: 'down' },
            ]}
          />
          <Box direction="row" gap={space.tight + 4} maxWidth="80%">
            <Shape kind="rect" width={4} fill={color.accent} shrink={0} />
            <Text size={wide || tall ? font.body - 2 : font.small + 2} color={color.ink} grow={1}>
              O NPS caiu na migração dos pipelines; um time de suporte dedicado às áreas usuárias começa em novembro.
            </Text>
          </Box>
        </Box>
      </ContentLayout>

      <ClosingLayout
        ctx={ctx}
        title="Obrigado"
        subtitle="Próximo passo: abrir o catálogo de dados para as áreas de crédito e logística no Q4."
        contact="dados-plataforma@empresa.com.br"
      />
    </Deck>
  );
});
