import { B, Box, Deck, Slide, SlideNumber, Span, Sup, Text, defineDeck } from 'pptsx';

// M13: relatório de texto corrido. O corpo é um único <Text paginate>: o que não cabe continua
// num clone do slide (mesmo título), cortando em fim de parágrafo quando dá e sem deixar menos
// de 2 linhas de um parágrafo sozinhas. Notas de rodapé em sobrescrito apontam (href) para o
// slide de notas; pesos 300/600 da Inter (examples/texto/pptsx.config.ts). O rodapé do Deck se
// repete em todo slide (inclusive nas partes) com o número "n / total" como campo nativo.

const INK = '#0F172A';
const MUTED = '#475569';
const ACCENT = '#2F6FED';

const Note = ({ n }: { n: number }) => <Sup href="slide:3" color={ACCENT}>{String(n)}</Sup>;

const BODY = (
  <>
    <Span fontWeight={600}>Contexto.</Span> Em 2026 a cooperativa atendeu 4.800 famílias em 31 municípios, com uma rede de 12 armazéns e 2 centrais de distribuição. A safra foi marcada por um início de ano seco e por chuvas acima da média a partir de abril, o que deslocou a colheita em quase três semanas e exigiu replanejar o transporte de grãos para os portos.<Note n={1} />
    {'\n'}
    <Span fontWeight={600}>Produção.</Span> A produção total chegou a 1,92 milhão de toneladas, alta de 6,4% sobre 2025. O milho segunda safra respondeu pela maior parte do ganho, enquanto a soja ficou estável por causa da estiagem de fevereiro. O café arábica, ainda pequeno no portfólio, dobrou de volume com a entrada das primeiras lavouras irrigadas no norte da região.
    {'\n'}
    <Span fontWeight={600}>Armazenagem.</Span> Os armazéns operaram com ocupação média de 87%, contra 79% no ano anterior. O novo silo de Rio Verde, inaugurado em junho, acrescentou 120 mil toneladas de capacidade e reduziu as filas de caminhões na colheita. A meta para 2027 é chegar a 92% de ocupação sem perder a capacidade de reserva para a safra de inverno.<Note n={2} />
    {'\n'}
    <Span fontWeight={600}>Pessoas.</Span> A equipe passou de 1.140 para 1.236 colaboradores, com 64% das vagas novas preenchidas por moradores dos próprios municípios atendidos. O programa de formação técnica completou o terceiro ano com 412 participantes e uma taxa de conclusão de 91%, a maior desde a criação do programa.
    {'\n'}
    <Span fontWeight={600}>Finanças.</Span> As sobras somaram R$ 214 milhões, 11% acima do orçamento. Metade foi distribuída aos cooperados na proporção da produção entregue; a outra metade foi para o fundo de investimento, que financia armazéns, máquinas compartilhadas e a assistência técnica gratuita. O endividamento caiu para 1,8 vez a geração de caixa.<Note n={3} />
    {'\n'}
    <Span fontWeight={600}>Clima e solo.</Span> O monitoramento de carbono no solo cobriu 38 mil hectares em 2026, com aumento médio de 0,3 ponto percentual de matéria orgânica nas áreas em plantio direto há mais de cinco anos. As áreas com integração lavoura-pecuária tiveram as menores perdas na estiagem, o que reforça a recomendação técnica para os próximos ciclos.
    {'\n'}
    <Span fontWeight={600}>Próximos passos.</Span> Para 2027 o plano prevê dois armazéns novos, a ampliação da irrigação no café e um sistema de rastreabilidade por lote que acompanha o grão do talhão ao porto. O conselho também aprovou a criação de um comitê de clima, com representantes dos cooperados e da área técnica, para revisar as metas de carbono a cada safra.
  </>
);

const FOOTER = (
  <Box display="flex" justifyContent="space-between" alignItems="baseline" padding="0 56 14" fontFamily="Inter" fontSize={10} color={MUTED}>
    <Text fontWeight={300}>Cooperativa Safra · Relatório anual 2026</Text>
    <SlideNumber format="n / total" fontWeight={600} />
  </Box>
);

export default defineDeck(() => (
  <Deck footer={FOOTER}>
    <Slide padding="48 56" gap={12} fontFamily="Inter" color={INK} justifyContent="center" backgroundColor="#F8FAFC">
      <Text fontSize={14} fontWeight={600} color={ACCENT} letterSpacing={2} textTransform="uppercase">Relatório anual</Text>
      <Text fontSize={44} fontWeight={700}>Safra 2026</Text>
      <Text fontSize={20} fontWeight={300} color={MUTED}>Produção, armazenagem, pessoas e clima numa cooperativa de 4.800 famílias.</Text>
    </Slide>
    <Slide padding="32 56 36" gap={14} fontFamily="Inter" color={INK}>
      <Text fontSize={24} fontWeight={600} borderBottom={`2px solid ${ACCENT}`} paddingBottom={6}>O ano em resumo</Text>
      <Text paginate flex={1} fontSize={16} lineHeight={1.45}>{BODY}</Text>
    </Slide>
    <Slide padding="32 56 36" gap={10} fontFamily="Inter" color={INK}>
      <Text fontSize={24} fontWeight={600} borderBottom={`2px solid ${ACCENT}`} paddingBottom={6}>Notas</Text>
      <Text fontSize={13} fontWeight={300} lineHeight={1.4}>
        <Sup>1</Sup> Calendário de colheita: <Span href="https://www.gov.br/agricultura" color={ACCENT}>Ministério da Agricultura</Span>, boletim de julho.{'\n'}
        <Sup>2</Sup> Ocupação = toneladas armazenadas / capacidade estática, média mensal.{'\n'}
        <Sup>3</Sup> Geração de caixa medida pelo EBITDA ajustado; ver <B>demonstrações financeiras</B>.{'\n'}
        <Span href="slide:2" color={ACCENT}>Voltar ao resumo</Span>
      </Text>
    </Slide>
  </Deck>
));
