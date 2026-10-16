import { defaultFontFaces, defineConfig } from 'pptsx';

const INTER = '../../../packages/ds-base/fonts/inter';
const CASLON = '/System/Library/Fonts/Supplemental/BigCaslon.ttf';

// A Big Caslon só tem uma face (Medium): ela responde por regular e bold.
export default defineConfig({
  fonts: [
    ...defaultFontFaces(),
    { family: 'Inter', weight: 'regular', file: `${INTER}/Inter-Regular.ttf` },
    { family: 'Inter', weight: 600, file: `${INTER}/Inter-SemiBold.ttf` },
    { family: 'Inter', weight: 'bold', file: `${INTER}/Inter-Bold.ttf` },
    { family: 'Big Caslon', weight: 'regular', file: CASLON },
    { family: 'Big Caslon', weight: 'bold', file: CASLON },
  ],
});
