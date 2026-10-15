import { defineConfig } from 'pptsx';

// M13: Inter em 4 pesos (OFL, fonts/inter) + a Arial padrão (Liberation, métricas iguais).
// `fonts` substitui as padrão, então a Arial entra de novo aqui.
const liberation = (file: string) => `../../fonts/${file}`;

export default defineConfig({
  fonts: [
    { family: 'Arial', weight: 'regular', file: liberation('LiberationSans-Regular.ttf') },
    { family: 'Arial', weight: 'bold', file: liberation('LiberationSans-Bold.ttf') },
    { family: 'Arial', weight: 'regular', italic: true, file: liberation('LiberationSans-Italic.ttf') },
    { family: 'Arial', weight: 'bold', italic: true, file: liberation('LiberationSans-BoldItalic.ttf') },
    { family: 'Inter', weight: 'regular', file: '../../fonts/inter/Inter-Regular.ttf' },
    { family: 'Inter', weight: 300, file: '../../fonts/inter/Inter-Light.ttf' },
    { family: 'Inter', weight: 600, file: '../../fonts/inter/Inter-SemiBold.ttf' },
    { family: 'Inter', weight: 'bold', file: '../../fonts/inter/Inter-Bold.ttf' },
  ],
});
