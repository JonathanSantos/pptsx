import Yoga from 'yoga-layout';

/** Config própria por árvore Yoga: padrões do CSS e frações exatas (a unidade é pt, sem arredondar a pixel). */
export const createConfig = () => {
  const config = Yoga.Config.create();
  config.setPointScaleFactor(0);
  config.setUseWebDefaults(true);
  return config;
};
