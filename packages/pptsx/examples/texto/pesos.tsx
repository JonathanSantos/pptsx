import { B, Box, Deck, Slide, Span, Text, defineDeck } from 'pptsx';

// M13-2: pesos numéricos. Cada peso usa a face registrada mais próxima (CSS Fonts §5.2); fora de
// 400/700 o PPTX recebe o nome da própria face ("Inter SemiBold"), que o PowerPoint/Keynote acham
// instalada ou embutida. Peso sem face a até 100 → font-weight-fallback (warning).

const INTER = [300, 400, 600, 700] as const;

export default defineDeck(() => (
  <Deck>
    <Slide padding="28 40" gap={10} fontFamily="Inter" color="#0F172A">
      <Text fontSize={26} fontWeight={700}>Inter em quatro pesos</Text>
      {INTER.map((weight) => (
        <Box display="flex" alignItems="baseline" gap={16}>
          <Text fontSize={12} color="#64748B" width={60}>{String(weight)}</Text>
          <Text fontSize={28} fontWeight={weight}>Relatório anual 2026</Text>
        </Box>
      ))}
      <Text fontSize={16} marginTop={8}>
        Um parágrafo regular com <Span fontWeight={600}>trecho em semibold</Span>, outro em <Span fontWeight={300}>light</Span> e um <B>bold</B> no meio.
      </Text>
    </Slide>
    <Slide padding="28 40" gap={10} color="#0F172A">
      <Text fontSize={26} fontWeight="bold">Quando falta a face</Text>
      <Text fontSize={18} fontFamily="Inter" fontWeight={500}>Inter 500 (sem face): usa a 400, sem aviso (a até 100)</Text>
      <Text fontSize={18} fontFamily="Inter" fontWeight={100}>Inter 100 (sem face): usa a 300 e avisa</Text>
      <Text fontSize={18} fontWeight={600}>Arial 600: usa a bold (700), sem aviso</Text>
      <Text fontSize={18} fontWeight={900}>Arial 900: usa a bold (700) e avisa</Text>
    </Slide>
  </Deck>
));
