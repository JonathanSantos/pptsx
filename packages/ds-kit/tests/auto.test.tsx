import { describe, expect, it } from 'vitest';
import { Box, Text } from 'pptsx';
import { createDs, defineComponent } from '@pptsx/ds-kit';

// M18-2: createDs sem `schema`/`guide` monta os dois a partir dos metas dos componentes.
const Tag = defineComponent(
  { name: 'Tag', guide: 'Uma etiqueta curta.', catalog: [{ name: 'a', props: { label: 'Novo', tone: 'brand' } }, { name: 'b', props: { label: 'Velho' } }] },
  ({ label, tone }: { label: string; tone?: 'brand' | 'quiet'; size?: number }) => <Box padding={4}><Text>{label}{tone}</Text></Box>,
  { size: 12 },
);

describe('createDs com padrões automáticos', () => {
  const ds = createDs({ name: 'auto-ds', version: '0.0.1', components: [Tag] });

  it('schema pelos casos do catálogo e pelos defaults', () => {
    expect(ds.schema).toEqual({
      Tag: {
        type: 'object',
        properties: {
          label: { type: 'string', examples: ['Novo', 'Velho'] },
          tone: { type: 'string', examples: ['brand'] },
          size: { type: 'number', examples: [12] },
        },
        required: ['label'],
        'x-source': expect.stringContaining('catálogo'),
      },
    });
  });

  it('guia pelos meta.guide, uma seção por componente', () => {
    expect(ds.guide).toBe('# auto-ds\n\n## Tag\n\nUma etiqueta curta.\n');
  });

  it('schema e guide explícitos vencem', () => {
    const own = createDs({ name: 'x', version: '1', components: [Tag], schema: { Tag: { type: 'object' } }, guide: '# meu guia' });
    expect(own.schema).toEqual({ Tag: { type: 'object' } });
    expect(own.guide).toBe('# meu guia');
  });
});
