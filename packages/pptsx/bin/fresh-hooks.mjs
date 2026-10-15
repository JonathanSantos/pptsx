// Hooks de módulo do --watch (M16): cada rebuild importa o deck com `?pptsx-fresh=N` e a versão é
// propagada só para os arquivos do usuário. O motor (src/ e dist/ do pacote, node_modules) mantém a
// mesma URL e é carregado uma vez: módulos ESM nunca saem da memória, e recarregar o motor a cada
// rebuild (Yoga, fontkit, pptxgenjs) custava ~12 MB por build.
const PARAM = 'pptsx-fresh';
let engineRoots = [];

export async function initialize(data) {
  engineRoots = data?.engineRoots ?? [];
}

const versionOf = (url) => {
  if (!url) return undefined;
  try {
    return new URL(url).searchParams.get(PARAM) ?? undefined;
  } catch {
    return undefined;
  }
};

const isUserFile = (url) =>
  url.protocol === 'file:' && !url.pathname.includes('/node_modules/') && !engineRoots.some((root) => url.href.startsWith(root));

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  const version = versionOf(context.parentURL);
  if (version === undefined) return result;
  const url = new URL(result.url);
  if (!isUserFile(url) || url.searchParams.has(PARAM)) return result;
  url.searchParams.set(PARAM, version);
  return { ...result, url: url.href };
}
