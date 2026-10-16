import { defaultFontFaces, defineConfig } from 'pptsx';

const INTER = '../../../packages/ds-base/fonts/inter';
const DIN = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf';

// A DIN Condensed só tem a face bold: ela responde pelos dois pesos.
export default defineConfig({
  fonts: [
    ...defaultFontFaces(),
    { family: 'Inter', weight: 'regular', file: `${INTER}/Inter-Regular.ttf` },
    { family: 'Inter', weight: 600, file: `${INTER}/Inter-SemiBold.ttf` },
    { family: 'Inter', weight: 'bold', file: `${INTER}/Inter-Bold.ttf` },
    { family: 'DIN Condensed', weight: 'regular', file: DIN },
    { family: 'DIN Condensed', weight: 'bold', file: DIN },
  ],
});
