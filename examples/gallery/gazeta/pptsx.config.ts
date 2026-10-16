import { defaultFontFaces, defineConfig } from 'pptsx';

const INTER = '../../../packages/ds-base/fonts/inter';
const SUP = '/System/Library/Fonts/Supplemental';

export default defineConfig({
  fonts: [
    ...defaultFontFaces(),
    { family: 'Inter', weight: 'regular', file: `${INTER}/Inter-Regular.ttf` },
    { family: 'Inter', weight: 600, file: `${INTER}/Inter-SemiBold.ttf` },
    { family: 'Inter', weight: 'bold', file: `${INTER}/Inter-Bold.ttf` },
    { family: 'Georgia', weight: 'regular', file: `${SUP}/Georgia.ttf` },
    { family: 'Georgia', weight: 'regular', italic: true, file: `${SUP}/Georgia Italic.ttf` },
    { family: 'Georgia', weight: 'bold', file: `${SUP}/Georgia Bold.ttf` },
  ],
});
