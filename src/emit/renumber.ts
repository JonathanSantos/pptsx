import JSZip from 'jszip';

/**
 * O pptxgenjs numera gráficos com um contador do MÓDULO (`_chartCounter`), que não
 * zera entre apresentações: o 2º .pptx do mesmo processo (ex.: `--size 16x9,4x3`)
 * sai com chart7.xml, Worksheet7.xlsx… Renumeramos para 1..n na ordem de criação
 * (= ordem dos slides), o que deixa a saída determinística e igual entre builds.
 */

const CHART_PART = /^ppt\/charts\/chart(\d+)\.xml$/;
/** Nomes de parte e referências que carregam o número do gráfico. */
const NUMBERED_NAME = /(charts\/(?:_rels\/)?chart|Microsoft_Excel_Worksheet)(\d+)(\.xml\.rels|\.xml|\.xlsx)/g;
const REFERENCING_PART = /(\.rels|^\[Content_Types\]\.xml)$/;

export type ChartRenumbering = ReadonlyMap<number, number>;

/** Números dos gráficos do pacote → 1..n, em ordem crescente do número original. */
export const chartRenumberingOf = (names: readonly string[]): ChartRenumbering => {
  const ids = names
    .map((name) => CHART_PART.exec(name)?.[1])
    .filter((id): id is string => id !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  return new Map(ids.map((id, index) => [id, index + 1]));
};

const isIdentity = (renumbering: ChartRenumbering): boolean =>
  [...renumbering].every(([from, to]) => from === to);

/** Troca o número em todo nome de parte/alvo de gráfico ou xlsx embutido do texto. */
export const renumberChartRefs = (text: string, renumbering: ChartRenumbering): string =>
  text.replace(NUMBERED_NAME, (match, prefix: string, id: string, suffix: string) => {
    const to = renumbering.get(Number(id));
    return to === undefined ? match : `${prefix}${to}${suffix}`;
  });

const renamedPartsOf = (names: readonly string[], renumbering: ChartRenumbering) =>
  names
    .map((name) => ({ from: name, to: renumberChartRefs(name, renumbering) }))
    .filter(({ from, to }) => from !== to);

/** Renomeia as partes e reescreve as referências (.rels e [Content_Types].xml) no zip. */
export const renumberCharts = async (zip: JSZip): Promise<void> => {
  const names = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
  const renumbering = chartRenumberingOf(names);
  if (isIdentity(renumbering)) return;
  const renamed = renamedPartsOf(names, renumbering);
  // Lê tudo antes de apagar: o nome novo de uma parte pode ser o antigo de outra.
  const contents = await Promise.all(renamed.map(({ from }) => zip.file(from)!.async('uint8array')));
  renamed.forEach(({ from }) => zip.remove(from));
  renamed.forEach(({ to }, index) => zip.file(to, contents[index]!));
  const referencing = Object.keys(zip.files).filter((name) => REFERENCING_PART.test(name) && !zip.files[name]?.dir);
  await Promise.all(
    referencing.map(async (name) => zip.file(name, renumberChartRefs(await zip.file(name)!.async('string'), renumbering))),
  );
};
