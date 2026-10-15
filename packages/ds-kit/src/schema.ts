/**
 * Schema de props dos componentes de um DS, no formato do `schema` do núcleo (`{ type: 'object',
 * properties: { prop: { type, description } }, required }`), gerado dos tipos com a API do TypeScript
 * (como o `--fix` do núcleo: `typescript` ≤ 6 ou o alias `typescript-api`). Rode no build do DS e grave o
 * resultado; o `defineDs`/`createDs` recebe o objeto pronto.
 */

interface PropSchema {
  readonly type: string;
  readonly description?: string;
}

export interface ComponentSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, PropSchema>>;
  readonly required: readonly string[];
}

type Ts = typeof import('typescript-api');

const loadTs = async (candidates: readonly string[] = ['typescript', 'typescript-api']): Promise<Ts> => {
  const [name, ...rest] = candidates;
  if (name === undefined) throw new Error('schemaOf precisa da API do TypeScript em JS (5 ou 6): npm install -D typescript-api@npm:typescript@6');
  try {
    const module = (await import(name)) as { default?: Ts } & Partial<Ts>;
    const api = (module.default ?? module) as Ts;
    if (typeof api.createProgram === 'function') return api;
  } catch {
    // não instalado: o próximo
  }
  return loadTs(rest);
};

const FALLBACK = (ts: Ts): import('typescript-api').CompilerOptions => ({
  strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, jsxImportSource: 'pptsx', skipLibCheck: true,
});

/** As opções do tsconfig mais próximo do arquivo (paths do monorepo, jsx); sem tsconfig, um padrão. */
const compilerOptionsFor = (ts: Ts, file: string): import('typescript-api').CompilerOptions => {
  const config = ts.findConfigFile(file.replace(/[^/\\]+$/, ''), ts.sys.fileExists, 'tsconfig.json');
  if (config === undefined) return FALLBACK(ts);
  const read = ts.readConfigFile(config, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, config.replace(/[^/\\]+$/, ''));
  return { ...parsed.options, noEmit: true };
};

/**
 * Props de cada componente exportado de `file` (o tipo do 1º parâmetro), por nome de export.
 * `names` restringe; sem ele, todo export que é função de um parâmetro objeto.
 */
export const schemaOf = async (file: string, names?: readonly string[]): Promise<Readonly<Record<string, ComponentSchema>>> => {
  const ts = await loadTs();
  const program = ts.createProgram([file], compilerOptionsFor(ts, file));
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (source === undefined) throw new Error(`schemaOf: ${file} não encontrado`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exports = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
  const format = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  return Object.fromEntries(
    exports
      .filter((symbol) => names === undefined || names.includes(symbol.name))
      .flatMap((exported) => {
        // `export { X } from './x.ts'` chega como alias: o tipo é o do símbolo de origem.
        const symbol = (exported.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(exported) : exported;
        const type = checker.getTypeOfSymbolAtLocation(symbol, source);
        const [signature] = type.getCallSignatures();
        const [param] = signature?.getParameters() ?? [];
        if (param === undefined) return [];
        const propsType = checker.getTypeOfSymbolAtLocation(param, source);
        const props = checker.getPropertiesOfType(propsType);
        const properties = Object.fromEntries(
          props.map((prop) => {
            const text = checker.typeToString(checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, source)), undefined, format).replace(/\s+/g, ' ');
            const description = ts.displayPartsToString(prop.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
            return [prop.name, description === '' ? { type: text } : { type: text, description }];
          }),
        );
        const required = props.filter((prop) => (prop.flags & ts.SymbolFlags.Optional) === 0).map((prop) => prop.name).sort();
        return [[exported.name, { type: 'object' as const, properties, required }]];
      }),
  );
};
