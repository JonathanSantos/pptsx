import { Box, Deck, Slide, Text, defineDeck } from '../../index.ts';

const initiatives = [
  { name: 'Migração para nuvem', owner: 'Ana Souza', status: 'Em andamento', color: '#2F6FED' },
  { name: 'Novo app mobile', owner: 'Bruno Lima', status: 'Planejado', color: '#8B5CF6' },
  { name: 'Portal do cliente', owner: 'Carla Dias', status: 'Em andamento', color: '#2F6FED' },
  { name: 'Automação de testes', owner: 'Diego Melo', status: 'Concluído', color: '#16A34A' },
  { name: 'Data lake', owner: 'Elisa Prado', status: 'Em risco', color: '#DC2626' },
  { name: 'SSO corporativo', owner: 'Fábio Reis', status: 'Planejado', color: '#8B5CF6' },
];

const tags = [
  'Infraestrutura', 'Observabilidade', 'Segurança', 'Performance', 'Mobile',
  'Experiência do cliente', 'Dados', 'Automação', 'Custos', 'Compliance',
];

export default defineDeck(() => (
  <Deck>
    <Slide padding={32} fontFamily="Arial" color="#1B2A4A" backgroundColor="#FFFFFF">
      <Text fontSize={28} fontWeight="bold" marginBottom={16}>Roadmap do Q4</Text>
      <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={12}>
        {initiatives.map((it) => (
          <Box padding={10} backgroundColor="#F4F6FA" borderTop={`3px solid ${it.color}`}>
            <Text fontSize={14} fontWeight="bold" marginBottom={4}>{it.name}</Text>
            <Text fontSize={11} color="#4B5563">Responsável: {it.owner}</Text>
            <Text fontSize={11} color={it.color} fontWeight="bold" marginTop={2}>{it.status}</Text>
          </Box>
        ))}
      </Box>
      <Box display="flex" flexWrap="wrap" gap={8} marginTop={18}>
        {tags.map((t) => (
          <Text fontSize={12} padding="4 12" backgroundColor="#E0E7FF" color="#1E3A8A" borderRadius={10}>{t}</Text>
        ))}
      </Box>
      <Text marginTop="auto" fontSize={10} color="#6B7280">Fonte: PMO — planejamento trimestral, outubro de 2026</Text>
    </Slide>
  </Deck>
));
