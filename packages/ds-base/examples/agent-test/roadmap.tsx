import { Box, Deck, Shape, Text, defineDeck } from 'pptsx';
import { tokens } from '@pptsx/ds-base';
import { ContentLayout } from '@pptsx/ds-base';

const { color, font, space } = tokens;

const phases = [
  { q: 'Q1', title: 'Fundação', items: ['Lakehouse em produção', 'Ingestão dos 5 sistemas core', 'Time de plataforma formado'] },
  { q: 'Q2', title: 'Governança', items: ['Catálogo com donos', 'Linhagem das tabelas críticas'] },
  { q: 'Q3', title: 'Self-service', items: ['Painéis padronizados', 'Treinamento das áreas', 'Métrica de adoção'] },
  { q: 'Q4', title: 'Escala', items: ['Desligar o legado', 'Custo por consulta −30%'] },
];

const PhaseColumn = ({ q, title, items, last, itemSize }: { q: string; title: string; items: string[]; last: boolean; itemSize: number }) => (
  <Box flex={1} gap={10}>
    <Box display="flex" alignItems="center" gap={6}>
      <Box width={40} height={22} flexShrink={0} backgroundColor={color.accent} borderRadius={11} alignItems="center" justifyContent="center">
        <Text fontSize={font.caption} fontWeight="bold" color={color.white} textAlign="center">{q}</Text>
      </Box>
      <Shape kind="rect" height={2} flex={1} fill={last ? color.white : color.accent} />
    </Box>
    <Box flex={1} backgroundColor={color.surface} borderRadius={8} padding={14} gap={8}>
      <Text fontSize={font.body} fontWeight="bold" color={color.ink}>{title}</Text>
      {items.map((item) => (
        <Box display="flex" gap={6} alignItems="flex-start">
          <Text fontSize={itemSize} color={color.accent} flexShrink={0}>•</Text>
          <Text fontSize={itemSize} minSize={11} color={color.muted} flex={1}>{item}</Text>
        </Box>
      ))}
    </Box>
  </Box>
);

const comparisons = [
  { aspect: 'Tempo de relatório', before: '5 dias úteis', after: 'Atualizado a cada hora' },
  { aspect: 'Custo de infraestrutura', before: 'R$ 1,2 mi / ano', after: 'R$ 0,8 mi / ano' },
  { aspect: 'Qualidade dos dados', before: 'Sem dono nem validação', after: 'Testes automáticos e dono por tabela' },
];

const CompareCard = ({ label, tone, field, compact }: { label: string; tone: 'before' | 'after'; field: 'before' | 'after'; compact: boolean }) => {
  const accent = tone === 'before' ? color.negative : color.positive;
  return (
    <Box flex={1} backgroundColor={tone === 'before' ? color.surface : color.accentSoft} borderRadius={8} padding={16} gap={12}>
      <Box display="flex" alignItems="center" gap={8}>
        <Shape kind="ellipse" width={12} height={12} flexShrink={0} fill={accent} />
        <Text fontSize={font.h2} fontWeight="bold" color={color.ink} flex={1}>{label}</Text>
      </Box>
      <Box gap={12}>
        {comparisons.map((c) => (
          <Box display="flex" flexDirection={compact ? 'row' : 'column'} alignItems={compact ? "center" : "stretch"} gap={compact ? 12 : 2}>
            <Text fontSize={font.caption} color={color.muted} width={compact ? 170 : undefined} flexShrink={0}>{c.aspect.toUpperCase()}</Text>
            <Text fontSize={18} minSize={13} fontWeight="bold" color={color.ink} flex={compact ? 1 : "0 1 auto"}>{c[field]}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default defineDeck((ctx) => (
  <Deck>
    <ContentLayout title="Roadmap da plataforma de dados 2027">
      <Box display="flex" gap={12} flex={1}>
        {phases.map((p, i) => (
          <PhaseColumn q={p.q} title={p.title} items={p.items} last={i === phases.length - 1} itemSize={ctx.aspect < 1.5 ? 18 : font.small} />
        ))}
      </Box>
    </ContentLayout>

    <ContentLayout title="Antes × Depois">
      <Box display="flex" flexDirection={ctx.aspect < 1.5 ? 'column' : 'row'} gap={space.gap} flex={1}>
        <CompareCard label="Antes" tone="before" field="before" compact={ctx.aspect < 1.5} />
        <CompareCard label="Depois (fim de 2027)" tone="after" field="after" compact={ctx.aspect < 1.5} />
      </Box>
    </ContentLayout>
  </Deck>
));
