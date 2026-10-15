import { B, Deck, I, Slide, Span, Text, defineDeck } from 'pptsx';

export default defineDeck(() => (
  <Deck>
    <Slide padding={56} gap={24} justifyContent="center" color="#1B2A4A">
      <Text fontSize={30} lineHeight={1.3}>
        A receita <B>subiu 14%</B> em <Span color="#2F6FED" fontStyle="italic">todas</Span> as
        regiões, <I>exceto</I> no Norte, e fechou o trimestre em
        R$&nbsp;52,4&nbsp;mi (<Span textDecoration="line-through" color="#5B6680">meta antiga</Span>{' '}
        <Span color="#1E9E6A" fontWeight="bold">meta batida</Span>).
      </Text>
      <Text fontSize={14} color="#5B6680">
        Um run por trecho no .pptx; o NBSP mantém “R$ 52,4 mi” numa linha só.
      </Text>
    </Slide>
  </Deck>
));
