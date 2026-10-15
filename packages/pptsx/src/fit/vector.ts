import type { Diagnostic, PositionedNode } from '../core/types.ts';
import type { DiagnosticContext } from './diagnostics.ts';

/**
 * Diagnósticos de nós vetoriais (M12), decididos no resolve e reportados aqui com o slide de saída:
 * `path-invalid` (error, o Path não é desenhado) e `icon-rasterized` (info, o ícone virou imagem).
 */

/** Motivo gravado pelo resolve quando o autor força a imagem. */
const FORCED = 'render="image"';

const pathInvalid = (ctx: DiagnosticContext, path: string, problem: string): Diagnostic => ({
  severity: 'error',
  code: 'path-invalid',
  size: ctx.size,
  slide: ctx.slide,
  path,
  message: `O d do Path não foi entendido (${problem}) e o Path não foi desenhado. Use só os comandos M L H V C S Q T A Z do SVG, com números separados por espaço ou vírgula.`,
});

const iconRasterized = (ctx: DiagnosticContext, path: string, reason: string): Diagnostic => ({
  severity: 'info',
  code: 'icon-rasterized',
  size: ctx.size,
  slide: ctx.slide,
  path,
  message:
    reason === FORCED
      ? 'O ícone saiu como imagem porque render="image" foi pedido (não é editável como forma no PowerPoint).'
      : `O ícone saiu como imagem (não editável como forma): ${reason}. Para forma nativa, use um SVG só com path/rect/circle/ellipse/line/polygon/polyline, cores sólidas e sem transform/opacity.`,
});

export const vectorDiagnosticsOf = (nodes: readonly PositionedNode[], ctx: DiagnosticContext): readonly Diagnostic[] =>
  nodes.flatMap((node) => {
    if (node.kind === 'path' && node.problem !== undefined) return [pathInvalid(ctx, node.path, node.problem)];
    if (node.kind === 'icon' && 'raster' in node.content) return [iconRasterized(ctx, node.path, node.content.reason)];
    return [];
  });
