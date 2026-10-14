import { Box, Deck, Slide, Text, defineDeck } from 'pptsx';

// Deck de sondagem do M6: provoca de propósito, num slide só, os três casos que
// os diagnósticos precisam distinguir (ver docs/work/milestones/M6.md).
//
// - Causa: o parágrafo gigante (Slide > Text[1]) pede muito mais altura do que o
//   slide tem e espreme os irmãos; o título (Text[0]) e a row de cartões estouram
//   só por consequência e devem sair com data.causedBy apontando para Text[1].
// - Agrupamento: os 8 cartões iguais (Box[0..7]) estouram da mesma forma
//   (fit="error" e palavra larga demais para 1/8 da largura); devem virar UM
//   text-overflow e UM text-word-broken com data.count = 8, não 8 + 8.
// - Fonte ausente: Text[2] usa "Inter", que não está registrada; deve gerar só
//   font-missing (a medição é estimada, então overflow/shrink dele são suprimidos).
const paragraph = 'Um parágrafo bem longo que repete bastante texto para forçar o estouro vertical. '.repeat(20);

export default defineDeck(() => (
  <Deck>
    <Slide padding={40} gap={10}>
      <Text fontSize={30} fontWeight="bold">Teste</Text>
      <Box display="flex" gap={10}>
        {Array.from({ length: 8 }, (_, i) => (
          <Box flex={1} backgroundColor="#EEEEEE" padding={10}>
            <Text fontSize={24} fit="error">Indisponibilidade {i}</Text>
          </Box>
        ))}
      </Box>
      <Text fontSize={20}>{paragraph}</Text>
      <Text fontSize={16} fontFamily="Inter">Fonte não registrada</Text>
    </Slide>
  </Deck>
));
