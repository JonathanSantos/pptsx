import { Box, Deck, Slide, SlideNumber, Sup, Text, defineDeck } from 'pptsx';

const NOME = 'Relatório do 3º trimestre de 2026 · Aurora Alimentos';
const NOTAS_SLIDE = 3; // 3º <Slide> do Deck (capa, relatório, notas)

const RODAPE = (
  <Box display="flex" justifyContent="space-between" padding="0 40 12" fontSize={10} color="#64748B">
    <Text>{NOME}</Text>
    <SlideNumber format="n / total" />
  </Box>
);

const Nota = ({ n }: { n: number }) => <Sup href={`slide:${NOTAS_SLIDE}`}>{n}</Sup>;

export default defineDeck(() => (
  <Deck footer={RODAPE}>
    <Slide padding="48 48 56" justifyContent="center" gap={14} backgroundColor="#F4F6FA" color="#1B2A4A">
      <Text fontSize={14} fontWeight="bold" color="#2F6FED" letterSpacing={2} textTransform="uppercase">
        Aurora Alimentos S.A.
      </Text>
      <Text fontSize={{ base: 38, tall: 44 }} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={16}>
        Relatório do 3º trimestre de 2026
      </Text>
      <Text fontSize={18} color="#5B6680">Resultados, operações e perspectivas · outubro de 2026</Text>
    </Slide>

    <Slide padding="32 40 40" gap={12} backgroundColor="#FFFFFF" color="#1B2A4A">
      <Text fontSize={24} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={12}>O trimestre em resumo</Text>
      <Text paginate flex={1} fontSize={{ base: 15, tall: 16 }} lineHeight={{ base: 1.2, tall: 1.25 }}>
        O terceiro trimestre de 2026 foi o melhor da história da Aurora Alimentos. A receita líquida chegou a R$&nbsp;412&nbsp;milhões, alta de 17% sobre o mesmo período do ano anterior. O crescimento veio tanto do volume vendido quanto da melhora do mix, com mais produtos de maior valor agregado. A margem bruta subiu 2,3 pontos percentuais, para 34,8%.<Nota n={1} />
        {'\n'}
        A divisão de laticínios continuou como o principal motor do resultado. As vendas de iogurtes funcionais cresceram 29%, puxadas pelo lançamento da linha sem lactose em julho. Os queijos especiais mantiveram participação estável, mesmo com a pressão de preço do leite cru no período de entressafra. Para o quarto trimestre, a expectativa é de normalização do custo da matéria-prima.
        {'\n'}
        Em bebidas vegetais, a empresa ampliou a distribuição para 3.200 novos pontos de venda. A categoria ainda representa uma fatia pequena da receita, mas cresce a um ritmo de três dígitos. A nova fábrica de Uberlândia operou com 71% da capacidade ao fim de setembro. A meta é atingir 85% até março, o que diluirá os custos fixos da unidade.
        {'\n'}
        As despesas operacionais ficaram em linha com o orçamento. Os gastos com marketing cresceram acima da receita por causa da campanha nacional da linha sem lactose. Em compensação, as despesas administrativas caíram 4% com a conclusão da migração para o novo sistema de gestão. O resultado operacional antes de depreciação e amortização somou R$&nbsp;68&nbsp;milhões.
        {'\n'}
        A geração de caixa operacional foi de R$&nbsp;51&nbsp;milhões no trimestre. Parte desse valor foi usada para amortizar antecipadamente uma dívida de custo elevado contratada em 2023. Com isso, a alavancagem caiu para 1,4 vez o resultado operacional dos últimos doze meses.<Nota n={2} /> A empresa encerrou setembro com R$&nbsp;190&nbsp;milhões em caixa e aplicações.
        {'\n'}
        No campo da sustentabilidade, a Aurora reduziu em 12% o consumo de água por litro processado. Todas as embalagens da linha de iogurtes passaram a ser recicláveis, um trimestre antes do previsto. O programa de apoio a pequenos produtores ganhou 140 novas propriedades parceiras. Essas iniciativas reforçam a posição da marca junto a consumidores e varejistas.
        {'\n'}
        Para o quarto trimestre, a diretoria mantém a projeção de crescimento de receita entre 14% e 16% no ano. O período de festas costuma concentrar vendas de queijos especiais e sobremesas, categorias de margem mais alta. Os principais riscos seguem sendo o preço do leite e a confiança do consumidor. A empresa seguirá priorizando eficiência, inovação e disciplina de capital.
      </Text>
    </Slide>

    <Slide padding="32 40 40" gap={12} backgroundColor="#FFFFFF" color="#1B2A4A">
      <Text fontSize={24} fontWeight="bold" borderLeft="6px solid #2F6FED" paddingLeft={12}>Notas</Text>
      <Box gap={10} fontSize={13} color="#5B6680">
        <Text><Sup>1</Sup> Margem bruta calculada sobre a receita líquida, excluídos efeitos não recorrentes de reestruturação logística.</Text>
        <Text><Sup>2</Sup> Alavancagem medida como dívida líquida dividida pelo resultado operacional antes de depreciação e amortização dos últimos doze meses.</Text>
      </Box>
    </Slide>
  </Deck>
));
