import { defaultFontFaces, defineConfig } from 'pptsx';

// Os decks de texto usam a Inter (OFL, em packages/ds-base/fonts/inter) além da Arial padrão do núcleo.
export default defineConfig({
  fonts: [
    ...defaultFontFaces(),
    { family: 'Inter', weight: 'regular', file: '../../fonts/inter/Inter-Regular.ttf' },
    { family: 'Inter', weight: 300, file: '../../fonts/inter/Inter-Light.ttf' },
    { family: 'Inter', weight: 600, file: '../../fonts/inter/Inter-SemiBold.ttf' },
    { family: 'Inter', weight: 'bold', file: '../../fonts/inter/Inter-Bold.ttf' },
  ],
});
