import type * as TS from 'typescript-api';
import { DEFAULTS } from '../core/defaults.ts';
import type { PrimitiveKind } from '../core/types.ts';
import { aliasRuleOf, type AliasRule } from './aliases.ts';

/**
 * M16-5: `pptsx lint --fix` — reescreve as props antigas em CSS no fonte TSX. Edições de texto nas
 * posições do AST (a formatação do autor fica); só em tags importadas de 'pptsx' (um componente com
 * `size` não é alias). Valor que não é literal só é migrado quando a troca é só de nome; o resto vira
 * aviso. A API do TypeScript entra injetada (o TS 7 não tem API em JS; ver loadTypeScriptApi).
 */

type Ts = typeof TS;

const PRIMITIVE_TAGS: Readonly<Record<string, PrimitiveKind>> = {
  Box: 'box', Slide: 'slide', Text: 'text', Image: 'image', Shape: 'shape', Span: 'span', Chart: 'chart',
  Table: 'table', Path: 'path', Icon: 'icon', SlideNumber: 'slideNumber',
};

export interface CodemodSkip {
  readonly line: number;
  readonly prop: string;
  readonly reason: string;
}

export interface CodemodResult {
  readonly source: string;
  readonly changes: number;
  readonly skipped: readonly CodemodSkip[];
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Nome local → primitiva, pelos imports de 'pptsx' (`import { Box, Text as T } from 'pptsx'`). */
const primitivesOf = (ts: Ts, file: TS.SourceFile): ReadonlyMap<string, PrimitiveKind> =>
  new Map(
    file.statements.flatMap((statement) => {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'pptsx') return [];
      const bindings = statement.importClause?.namedBindings;
      if (bindings === undefined || !ts.isNamedImports(bindings)) return [];
      return bindings.elements.flatMap((element) => {
        const kind = PRIMITIVE_TAGS[(element.propertyName ?? element.name).text];
        return kind === undefined ? [] : [[element.name.text, kind] as const];
      });
    }),
  );

type Literal = { readonly kind: 'string'; readonly value: string } | { readonly kind: 'number'; readonly value: number } | { readonly kind: 'boolean'; readonly value: boolean } | { readonly kind: 'object'; readonly value: Readonly<Record<string, Literal>> };

/** Valor literal do atributo (string, número, booleano ou objeto de literais); undefined = expressão. */
const literalOf = (ts: Ts, initializer: TS.JsxAttributeValue | undefined): Literal | undefined => {
  if (initializer === undefined) return { kind: 'boolean', value: true };
  if (ts.isStringLiteral(initializer)) return { kind: 'string', value: initializer.text };
  if (!ts.isJsxExpression(initializer) || initializer.expression === undefined) return undefined;
  return expressionLiteralOf(ts, initializer.expression);
};

const expressionLiteralOf = (ts: Ts, expression: TS.Expression): Literal | undefined => {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return { kind: 'string', value: expression.text };
  if (ts.isNumericLiteral(expression)) return { kind: 'number', value: Number(expression.text) };
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'boolean', value: true };
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'boolean', value: false };
  if (!ts.isObjectLiteralExpression(expression)) return undefined;
  const entries = expression.properties.map((property) => {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return undefined;
    const value = expressionLiteralOf(ts, property.initializer);
    return value === undefined ? undefined : ([property.name.text, value] as const);
  });
  if (entries.some((entry) => entry === undefined)) return undefined;
  return { kind: 'object', value: Object.fromEntries(entries as readonly (readonly [string, Literal])[]) };
};

const quoted = (value: string): string => JSON.stringify(value);

interface Attr {
  readonly node: TS.JsxAttribute;
  readonly name: string;
  readonly literal?: Literal;
}

const attrsOf = (ts: Ts, element: TS.JsxOpeningLikeElement): readonly Attr[] =>
  element.attributes.properties.flatMap((property) => {
    if (!ts.isJsxAttribute(property) || !ts.isIdentifier(property.name)) return [];
    const literal = literalOf(ts, property.initializer);
    return [{ node: property, name: property.name.text, ...(literal === undefined ? {} : { literal }) }];
  });

interface Context {
  readonly ts: Ts;
  readonly file: TS.SourceFile;
  readonly attrs: readonly Attr[];
}

const replaceAttr = (ctx: Context, attr: Attr, text: string): Edit => ({ start: attr.node.getStart(ctx.file), end: attr.node.end, text });
// Remover leva o espaço antes do atributo junto (pos inclui o trivia anterior).
const removeAttr = (attr: Attr): Edit => ({ start: attr.node.pos, end: attr.node.end, text: '' });
const renameAttr = (ctx: Context, attr: Attr, name: string): Edit => ({ start: attr.node.name.getStart(ctx.file), end: attr.node.name.end, text: name });

type Outcome = { readonly edits: readonly Edit[] } | { readonly skip: string };

const has = (ctx: Context, name: string): boolean => ctx.attrs.some((attr) => attr.name === name);

const strokeOutcome = (ctx: Context, attr: Attr): Outcome => {
  const stroke = ctx.attrs.find((item) => item.name === 'stroke');
  const width = ctx.attrs.find((item) => item.name === 'strokeWidth');
  // O par vira um outline só: quem chega primeiro escreve, o outro sai.
  const first = stroke ?? width!;
  if (attr !== first) return { edits: [removeAttr(attr)] };
  const color = stroke === undefined ? DEFAULTS.lineStroke : stroke.literal?.kind === 'string' ? stroke.literal.value : undefined;
  const size = width === undefined ? DEFAULTS.strokeWidth : width.literal?.kind === 'number' ? width.literal.value : undefined;
  if (color === undefined || size === undefined) return { skip: 'stroke/strokeWidth com expressão: escreva outline="<largura>px solid <cor>"' };
  if (has(ctx, 'outline')) return { skip: 'o elemento já tem outline' };
  return { edits: [replaceAttr(ctx, attr, `outline=${quoted(`${size}px solid ${color}`)}`)] };
};

const outcomeOf = (ctx: Context, attr: Attr, rule: AliasRule): Outcome => {
  const literal = attr.literal;
  switch (rule.special) {
    case 'stroke':
      return strokeOutcome(ctx, attr);
    case 'italic':
      if (literal?.kind !== 'boolean') return { skip: 'italic com expressão: use fontStyle={cond ? "italic" : "normal"}' };
      return { edits: [literal.value ? replaceAttr(ctx, attr, 'fontStyle="italic"') : removeAttr(attr)] };
    case 'direction-box':
      if (literal?.kind !== 'string') return { skip: 'direction com expressão (ou responsivo): troque por display/flexDirection à mão' };
      if (literal.value === 'row') return { edits: [replaceAttr(ctx, attr, has(ctx, 'display') ? 'flexDirection="row"' : 'display="flex"')] };
      return { edits: [replaceAttr(ctx, attr, 'flexDirection="column"')] };
    case 'background':
      if (literal?.kind === 'string') return { edits: [replaceAttr(ctx, attr, `backgroundColor=${quoted(literal.value)}`)] };
      if (literal?.kind === 'object' && literal.value.image?.kind === 'string') return { edits: [replaceAttr(ctx, attr, `backgroundImage=${quoted(`url(${literal.value.image.value})`)}`)] };
      return { skip: 'background com expressão: use backgroundColor ou backgroundImage="url(…)"' };
    default:
      break;
  }
  if (rule.values === undefined) return { edits: [renameAttr(ctx, attr, rule.css)] };
  if (literal?.kind !== 'string' || rule.values[literal.value] === undefined) return { skip: `${attr.name} com expressão: os valores mudam (${Object.entries(rule.values).map(([from, to]) => `${from}→${to}`).join(', ')})` };
  return { edits: [replaceAttr(ctx, attr, `${rule.css}=${quoted(rule.values[literal.value]!)}`)] };
};

/** Conflito: o elemento já tem a prop CSS que a troca criaria (o autor misturou as duas formas). */
const conflictOf = (ctx: Context, rule: AliasRule): string | undefined =>
  rule.special === undefined && has(ctx, rule.css) ? `o elemento já tem ${rule.css}; tire o ${rule.prop} à mão` : undefined;

export const migrateSource = (ts: Ts, fileName: string, source: string): CodemodResult => {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const primitives = primitivesOf(ts, file);
  const edits: Edit[] = [];
  const skipped: CodemodSkip[] = [];
  const visit = (node: TS.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      const kind = primitives.get(node.tagName.text);
      if (kind !== undefined) {
        const ctx: Context = { ts, file, attrs: attrsOf(ts, node) };
        ctx.attrs.forEach((attr) => {
          const rule = aliasRuleOf(kind, attr.name);
          if (rule === undefined) return;
          const line = file.getLineAndCharacterOfPosition(attr.node.getStart(file)).line + 1;
          const conflict = conflictOf(ctx, rule);
          const outcome: Outcome = conflict === undefined ? outcomeOf(ctx, attr, rule) : { skip: conflict };
          if ('skip' in outcome) skipped.push({ line, prop: attr.name, reason: outcome.skip });
          else edits.push(...outcome.edits);
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const output = [...edits].sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
  return { source: output, changes: edits.length, skipped };
};

/**
 * A API de compilador em JS: `typescript` até a 6 (o TS 7 é nativo e não a tem) ou o alias
 * `typescript-api` (deste repo). Sem nenhuma, erro com a instalação sugerida.
 */
export const loadTypeScriptApi = async (candidates: readonly string[] = ['typescript', 'typescript-api']): Promise<Ts> => {
  const [name, ...rest] = candidates;
  if (name === undefined) throw new Error('pptsx lint --fix precisa da API do TypeScript em JS (TypeScript 5 ou 6): npm install -D typescript-api@npm:typescript@6');
  try {
    const module = (await import(name)) as { default?: Ts } & Partial<Ts>;
    const api = (module.default ?? module) as Ts;
    if (typeof api.createSourceFile === 'function') return api;
  } catch {
    // não instalado: o próximo candidato
  }
  return loadTypeScriptApi(rest);
};
