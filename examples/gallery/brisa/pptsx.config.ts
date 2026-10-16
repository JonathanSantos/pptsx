import { defaultFontFaces, defineConfig } from 'pptsx';

const INTER = '../../../packages/ds-base/fonts/inter';

export default defineConfig({
  fonts: [
    ...defaultFontFaces(),
    { family: 'Inter', weight: 'regular', file: `${INTER}/Inter-Regular.ttf` },
    { family: 'Inter', weight: 300, file: `${INTER}/Inter-Light.ttf` },
    { family: 'Inter', weight: 600, file: `${INTER}/Inter-SemiBold.ttf` },
    { family: 'Inter', weight: 'bold', file: `${INTER}/Inter-Bold.ttf` },
  ],
});
