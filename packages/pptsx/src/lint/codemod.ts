import type * as TS from 'typescript-api';
import { DEFAULTS } from '../core/defaults.ts';
import type { PrimitiveKind } from '../core/types.ts';
import { aliasRuleOf, type AliasRule } from '../resolve/removed-props.ts';

/**
 * M16-5: `pptsx lint --fix` — reescreve as props antigas em CSS no fonte TSX. Edições de texto nas
 * posições do AST (a formatação do autor fica); só em tags importadas de 'pptsx' (um componente com
 * `size` não é alias). Valor que não é literal só é migrado quando a troca é só de nome; o resto vira
 * aviso. A API do TypeScript entra injetada (o TS 7 não tem API em JS; ver loadTypeScriptApi).
 */

type Ts = typeof TS;

const PRIMITIVE_TAGS: Readonly<Record<string, PrimitiveKind>> = {
  Box: 'box', Slide: 'slide', Text: 'text', Image: 'image', Shape: 'shape', Span: 'span', Chart: 'chart',
  Table: 'table', Path: 'path', Icon: 'icon', SlideNumber: 'slideNumber', Container: 'container',
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

export interface CodemodOptions {
  /** De onde vêm as primitivas; padrão: só o pacote 'pptsx' (no repo, os testes importam de src/). */
  readonly isPptsxModule?: (specifier: string) => boolean;
}

const isPackage = (specifier: string): boolean => specifier === 'pptsx';

/** Nome local → primitiva, pelos imports de 'pptsx' (`import { Box, Text as T } from 'pptsx'`). */
const primitivesOf = (ts: Ts, file: TS.SourceFile, isPptsxModule: (specifier: string) => boolean): ReadonlyMap<string, PrimitiveKind> =>
  new Map(
    file.statements.flatMap((statement) => {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !isPptsxModule(statement.moduleSpecifier.text)) return [];
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

/** Código da expressão do atributo (`{expr}`), ou undefined sem expressão. */
const expressionTextOf = (ctx: Context, attr: Attr): string | undefined => {
  const initializer = attr.node.initializer;
  return initializer !== undefined && ctx.ts.isJsxExpression(initializer) && initializer.expression !== undefined ? initializer.expression.getText(ctx.file) : undefined;
};

/** Parte de um template literal: o literal como texto, a expressão como `${…}`. */
const templatePartOf = (ctx: Context, attr: Attr | undefined, fallback: string | number, kind: 'string' | 'number'): string | undefined => {
  if (attr === undefined) return String(fallback);
  if (attr.literal?.kind === kind) return String(attr.literal.value);
  const expression = expressionTextOf(ctx, attr);
  return expression === undefined ? undefined : `\${${expression}}`;
};

const strokeOutcome = (ctx: Context, attr: Attr): Outcome => {
  const stroke = ctx.attrs.find((item) => item.name === 'stroke');
  const width = ctx.attrs.find((item) => item.name === 'strokeWidth');
  // O par vira um outline só: quem chega primeiro escreve, o outro sai.
  const first = stroke ?? width!;
  if (attr !== first) return { edits: [removeAttr(attr)] };
  if (has(ctx, 'outline')) return { skip: 'o elemento já tem outline' };
  const color = templatePartOf(ctx, stroke, DEFAULTS.lineStroke, 'string');
  const size = templatePartOf(ctx, width, DEFAULTS.strokeWidth, 'number');
  if (color === undefined || size === undefined) return { skip: 'stroke/strokeWidth sem valor: escreva outline="<largura>px solid <cor>"' };
  const value = `${size}px solid ${color}`;
  // Com expressão, um template literal: `outline={`1px solid ${palette.muted}`}`.
  return { edits: [replaceAttr(ctx, attr, value.includes('${') ? `outline={\`${value}\`}` : `outline=${quoted(value)}`)] };
};

/** Ternário de literais (`cond ? 'between' : 'end'`): troca cada ramo; outra expressão, undefined. */
const mappedExpressionOf = (ctx: Context, expression: TS.Expression, values: Readonly<Record<string, string>>): string | undefined => {
  const { ts } = ctx;
  if (ts.isParenthesizedExpression(expression)) return mappedExpressionOf(ctx, expression.expression, values);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return values[expression.text] === undefined ? undefined : quoted(values[expression.text]!);
  if (!ts.isConditionalExpression(expression)) return undefined;
  const whenTrue = mappedExpressionOf(ctx, expression.whenTrue, values);
  const whenFalse = mappedExpressionOf(ctx, expression.whenFalse, values);
  return whenTrue === undefined || whenFalse === undefined ? undefined : `${expression.condition.getText(ctx.file)} ? ${whenTrue} : ${whenFalse}`;
};

/** grow em ternário de números: n > 0 fica n (flex: n), 0 vira "0 1 auto" (o basis auto do grow antigo). */
const growExpressionOf = (ctx: Context, expression: TS.Expression): string | undefined => {
  const { ts } = ctx;
  if (ts.isParenthesizedExpression(expression)) return growExpressionOf(ctx, expression.expression);
  if (ts.isNumericLiteral(expression)) return Number(expression.text) === 0 ? quoted('0 1 auto') : expression.text;
  if (!ts.isConditionalExpression(expression)) return undefined;
  const whenTrue = growExpressionOf(ctx, expression.whenTrue);
  const whenFalse = growExpressionOf(ctx, expression.whenFalse);
  return whenTrue === undefined || whenFalse === undefined ? undefined : `${expression.condition.getText(ctx.file)} ? ${whenTrue} : ${whenFalse}`;
};

const mappedOutcomeOf = (ctx: Context, attr: Attr, rule: AliasRule & { readonly values: Readonly<Record<string, string>> }): Outcome => {
  const initializer = attr.node.initializer;
  const expression = initializer !== undefined && ctx.ts.isJsxExpression(initializer) ? initializer.expression : undefined;
  const mapped = expression === undefined ? undefined : mappedExpressionOf(ctx, expression, rule.values);
  if (mapped === undefined) return { skip: `${attr.name} com expressão: os valores mudam (${Object.entries(rule.values).map(([from, to]) => `${from}→${to}`).join(', ')})` };
  return { edits: [replaceAttr(ctx, attr, `${rule.css}={${mapped}}`)] };
};

const outcomeOf = (ctx: Context, attr: Attr, rule: AliasRule): Outcome => {
  const literal = attr.literal;
  switch (rule.special) {
    case 'stroke':
      return strokeOutcome(ctx, attr);
    case 'italic':
      if (literal?.kind !== 'boolean') return { skip: 'italic com expressão: use fontStyle={cond ? "italic" : "normal"}' };
      // italic={false} desliga o itálico herdado (do Slide, do Text): vira fontStyle="normal", não some.
      return { edits: [replaceAttr(ctx, attr, literal.value ? 'fontStyle="italic"' : 'fontStyle="normal"')] };
    case 'direction-box': {
      if (literal?.kind === 'string') {
        if (literal.value === 'row') return { edits: [replaceAttr(ctx, attr, has(ctx, 'display') ? 'flexDirection="row"' : 'display="flex"')] };
        return { edits: [replaceAttr(ctx, attr, 'flexDirection="column"')] };
      }
      // row/column são os mesmos no CSS: a expressão (responsiva inclusive) passa intacta.
      const expression = expressionTextOf(ctx, attr);
      if (expression === undefined) return { skip: 'direction sem valor: troque por display/flexDirection à mão' };
      return { edits: [replaceAttr(ctx, attr, `${has(ctx, 'display') ? '' : 'display="flex" '}flexDirection={${expression}}`)] };
    }
    case 'grow': {
      if (literal?.kind === 'number') return { edits: [literal.value === 0 ? replaceAttr(ctx, attr, 'flexGrow={0}') : renameAttr(ctx, attr, 'flex')] };
      // Ternário de números (`compact ? 1 : 0`): cada ramo vira o flex equivalente.
      const initializer = attr.node.initializer;
      const expression = initializer !== undefined && ctx.ts.isJsxExpression(initializer) ? initializer.expression : undefined;
      const mapped = expression === undefined ? undefined : growExpressionOf(ctx, expression);
      if (mapped === undefined) return { skip: 'grow com expressão: flex={n} quando n > 0, mas flex="0 1 auto" quando 0 (flex={0} do CSS zera o item)' };
      return { edits: [replaceAttr(ctx, attr, `flex={${mapped}}`)] };
    }
    case 'background':
      if (literal?.kind === 'string') return { edits: [replaceAttr(ctx, attr, `backgroundColor=${quoted(literal.value)}`)] };
      if (literal?.kind === 'object' && literal.value.image?.kind === 'string') return { edits: [replaceAttr(ctx, attr, `backgroundImage=${quoted(`url(${literal.value.image.value})`)}`)] };
      // Expressão: o `background` CSS aceita a cor; só a forma { image } saiu, e o build aponta a troca.
      return { edits: [] };
    default:
      break;
  }
  if (rule.values === undefined) return { edits: [renameAttr(ctx, attr, rule.css)] };
  if (literal?.kind !== 'string') return mappedOutcomeOf(ctx, attr, { ...rule, values: rule.values });
  if (rule.values[literal.value] === undefined) return { skip: `${attr.name}="${literal.value}": valor sem troca (${Object.keys(rule.values).join(', ')})` };
  return { edits: [replaceAttr(ctx, attr, `${rule.css}=${quoted(rule.values[literal.value]!)}`)] };
};

/** Conflito: o elemento já tem a prop CSS que a troca criaria (o autor misturou as duas formas). */
const conflictOf = (ctx: Context, rule: AliasRule): string | undefined =>
  rule.special === undefined && has(ctx, rule.css) ? `o elemento já tem ${rule.css}; tire o ${rule.prop} à mão` : undefined;

export const migrateSource = (ts: Ts, fileName: string, source: string, options: CodemodOptions = {}): CodemodResult => {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const primitives = primitivesOf(ts, file, options.isPptsxModule ?? isPackage);
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
