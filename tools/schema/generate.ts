/**
 * M16-3: gera src/mcp/schema.generated.ts (o `schema()` do servidor MCP) a partir dos tipos do autor
 * (`AuthorPropsMap` em src/core/types.ts) com a API do TypeScript. Rode `npm run schema:generate`
 * depois de mudar props; o teste tests/mcp/schema.test.ts falha se o arquivo estiver desatualizado.
 */
import ts from 'typescript-api';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = `${root}src/core/types.ts`;
export const OUTPUT = `${root}src/mcp/schema.generated.ts`;

interface PropSchema {
  readonly type: string;
  readonly description?: string;
}

interface PrimitiveSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, PropSchema>>;
  readonly required: readonly string[];
}

const FORMAT = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** Uniões de literais saem por extenso ('bar' | 'line' | …): o nome do alias não diz nada a quem lê o schema. */
const describeType = (checker: ts.TypeChecker, type: ts.Type): string => {
  if (!type.isUnion()) return checker.typeToString(type, undefined, FORMAT);
  const parts = type.types.map((member) => (member.isLiteral() || (member.flags & ts.TypeFlags.BooleanLiteral) !== 0 ? checker.typeToString(member) : checker.typeToString(member, undefined, FORMAT)));
  return [...new Set(parts)].join(' | ').replace('false | true', 'boolean');
};

export const generateSchema = (): Readonly<Record<string, PrimitiveSchema>> => {
  const program = ts.createProgram([TYPES], { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(TYPES)!;
  const map = source.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === 'AuthorPropsMap')!;
  const mapType = checker.getTypeAtLocation(map.name);
  return Object.fromEntries(
    checker.getPropertiesOfType(mapType).map((primitive) => {
      const propsType = checker.getTypeOfSymbolAtLocation(primitive, map);
      const props = checker.getPropertiesOfType(propsType).filter((prop) => prop.name !== 'children');
      const properties = Object.fromEntries(
        props
          .map((prop) => {
            const type = describeType(checker, checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, map))).replace(/\s+/g, ' ');
            const description = ts.displayPartsToString(prop.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
            return [prop.name, description === '' ? { type } : { type, description }] as const;
          })
          .sort(([a], [b]) => a.localeCompare(b)),
      );
      const required = props.filter((prop) => (prop.flags & ts.SymbolFlags.Optional) === 0).map((prop) => prop.name).sort();
      return [primitive.name, { type: 'object' as const, properties, required }];
    }),
  );
};

export const schemaSourceOf = (schema: Readonly<Record<string, PrimitiveSchema>>): string =>
  `// Gerado por tools/schema/generate.ts a partir de AuthorPropsMap (src/core/types.ts). Não edite à mão.\n` +
  `/* eslint-disable */\n` +
  `export interface PropSchema {\n  readonly type: string;\n  readonly description?: string;\n}\n\n` +
  `export interface PrimitiveSchema {\n  readonly type: 'object';\n  readonly properties: Readonly<Record<string, PropSchema>>;\n  readonly required: readonly string[];\n}\n\n` +
  // Tipo anotado (não `as const`): o .d.ts publicado fica pequeno.
  `export const PROPS_SCHEMA: Readonly<Record<string, PrimitiveSchema>> = ${JSON.stringify(schema, null, 2)};\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUTPUT, schemaSourceOf(generateSchema()));
  console.log(`gerado ${OUTPUT}`);
}
