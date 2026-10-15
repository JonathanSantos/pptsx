import { describe, expect, it } from 'vitest';
import { createVariants, defineComponent, slot, type Slots } from '@pptsx/ds-kit';
import { Box, Text } from 'pptsx';

// M18-1: variantes, slots e componentes tipados. Os `@ts-expect-error` são o teste (o typecheck do pacote
// falha se algum deixar de ser erro); o runtime só confirma que nada mudou no valor.

const card = createVariants({
  base: { padding: 12, borderRadius: 8 },
  variants: {
    tone: { neutral: { backgroundColor: '#EEEEEE' }, strong: { backgroundColor: '#E63946', color: '#FFFFFF' } },
    size: { md: { padding: 12 }, lg: { padding: 20 } },
  },
  defaults: { tone: 'neutral', size: 'md' },
});

describe('createVariants tipado', () => {
  it('o retorno tem só as props definidas, com o tipo da primitiva', () => {
    const props = card({ tone: 'strong', size: { base: 'md', tall: 'lg' } });
    const padding: typeof props.padding = props.padding;
    expect(padding).toEqual({ base: 12, tall: 20 });
    // @ts-expect-error gap não foi definida em lugar nenhum
    void props.gap;
    expect(<Box {...props} />).toBeDefined();
  });

  it('nome CSS errado, valor do tipo errado, opção e padrão inexistentes não compilam', () => {
    // @ts-expect-error "paddng" não é prop do Box
    createVariants({ variants: { size: { md: { paddng: 12 } } } });
    // @ts-expect-error borderRadius não aceita booleano
    createVariants({ base: { borderRadius: true }, variants: {} });
    // @ts-expect-error opção "xl" não existe em size (e em tempo de execução também é erro)
    expect(() => card({ size: 'xl' })).toThrow(/size="xl" não existe/);
    // @ts-expect-error padrão de uma variante inexistente
    createVariants({ variants: { size: { md: { padding: 1 } } }, defaults: { tone: 'x' } });
    expect(true).toBe(true);
  });

  it('for: "text" troca as props válidas (minSize é do Text, não do Box)', () => {
    const value = createVariants({ for: 'text', variants: { size: { sm: { fontSize: 22, minSize: 18 } } } });
    expect(<Text {...value({ size: 'sm' })}>x</Text>).toBeDefined();
    // @ts-expect-error minSize não é prop do Box
    createVariants({ variants: { size: { sm: { minSize: 18 } } } });
  });
});

describe('slots e defineComponent tipados', () => {
  interface Props extends Slots<'aside'> {
    readonly title: string;
  }
  const Panel = defineComponent({ name: 'Panel', catalog: [{ name: 'ok', props: { title: 'A' } }] }, ({ title, aside }: Props) => (
    <Box>
      <Text>{title}</Text>
      {slot(aside)}
    </Box>
  ), { title: 'padrão' });

  it('slot não declarado, padrão e caso de catálogo com prop desconhecida não compilam', () => {
    // @ts-expect-error "footer" não é slot do Panel
    expect(<Panel title="x" footer={<Text>f</Text>} />).toBeDefined();
    // @ts-expect-error padrão com prop que o componente não tem
    defineComponent('P2', ({ title }: Props) => <Text>{title}</Text>, { subtitle: 'x' });
    // @ts-expect-error caso de catálogo com prop desconhecida
    defineComponent({ name: 'P3', catalog: [{ name: 'x', props: { titulo: 'A' } }] }, ({ title }: Props) => <Text>{title}</Text>);
  });
});
