import { Box, Deck, Slide, SlideNumber, Sup, Text, defineDeck } from 'pptsx';

// M13-8: as receitas §6.14–6.16 do guia (relatório corrido com rodapé numerado, nota de rodapé,
// índice com links), num deck só para conferir que saem sem diagnóstico.

const TEXTO_LONGO = Array.from({ length: 6 }, (_, i) =>
  `Seção ${i + 1}. A operação manteve o ritmo do trimestre anterior, com ganhos de eficiência nas unidades do interior e investimento contínuo em formação das equipes técnicas. Os indicadores de satisfação seguiram acima da meta em todas as regiões atendidas.`,
).join('\n');

const SECOES = [
  { titulo: 'O ano em resumo', slide: 2 },
  { titulo: 'Notas', slide: 3 },
];

const RODAPE = (
  <Box display="flex" justifyContent="space-between" padding="0 40 12" fontSize={10} color="#64748B">
    <Text>Relatório 2026</Text>
    <SlideNumber format="n / total" />
  </Box>
);

export default defineDeck(() => (
  <Deck footer={RODAPE}>
    <Slide padding="32 40 40" gap={12}>
      <Text fontSize={28} fontWeight="bold">Sumário</Text>
      <Box gap={10}>
        {SECOES.map((s) => <Text fontSize={20} href={`slide:${s.slide}`} color="#2F6FED">{s.titulo}</Text>)}
      </Box>
    </Slide>
    <Slide padding="32 40 40" gap={12}>
      <Text fontSize={24} fontWeight="bold">O ano em resumo</Text>
      <Text fontSize={18}>Receita recorde<Sup href="slide:3">1</Sup> no trimestre.</Text>
      <Text paginate flex={1} fontSize={16} lineHeight={1.4}>{TEXTO_LONGO}</Text>
    </Slide>
    <Slide padding="32 40 40" gap={12}>
      <Text fontSize={24} fontWeight="bold">Notas</Text>
      <Text fontSize={11} color="#64748B"><Sup>1</Sup> Fonte: balanço auditado de 2026.</Text>
    </Slide>
  </Deck>
));
