import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../../src/core/types.ts';
import { Box, Slide, Text } from '../../src/primitives/index.ts';
import { allMemberPaths } from '../helpers/diagnostics.ts';
import { atPath, byCode, fit, layoutOnly, lazy, nodeAt, textAt, textDemand, texts } from '../helpers/fit-env.tsx';
import type { PositionedNode, PositionedSlide } from '../../src/core/types.ts';

/**
 * CONTRACTS §fit "Causa (M6)", "Fonte ausente (M6)" e "Agrupamento (M6)" aplicados
 * ao deck de sondagem de docs/work/milestones/M6.md (examples/probe/cause.tsx).
 */

const PARAGRAPH = 'Um parágrafo bem longo que repete bastante texto para forçar o estouro vertical. '.repeat(20);

const probe = () => (
  <Slide padding={40} gap={10}>
    <Text fontSize={30} fontWeight="bold">
      Teste
    </Text>
    <Box display="flex" gap={10}>
      {Array.from({ length: 8 }, (_, i) => (
        <Box flex={1} backgroundColor="#EEEEEE" padding={10}>
          <Text fontSize={24} fit="error">
            Indisponibilidade {i}
          </Text>
        </Box>
      ))}
    </Box>
    <Text fontSize={20}>{PARAGRAPH}</Text>
    <Text fontSize={16} fontFamily="Inter">
      Fonte não registrada
    </Text>
  </Slide>
);

const CAUSE = 'Slide > Text[1]';
const CARD_TEXT = 'Slide > Box > Box[0..7] > Text';
const CARD_PATHS = Array.from({ length: 8 }, (_, i) => `Slide > Box > Box[${i}] > Text`);

const isOverflow = (d: Diagnostic) => d.code === 'text-overflow' || d.code === 'box-overflow';

describe('cause.tsx — the cause is the paragraph', () => {
  const result = lazy(() => fit(probe()));

  it('Slide > Text[1] has a text-overflow error and no causedBy (it is the cause)', () => {
    const r = result();
    const own = atPath(r, CAUSE).filter(isOverflow);
    expect(own).toHaveLength(1);
    expect(own[0]!.severity).toBe('error');
    expect(own[0]!.data?.causedBy).toBeUndefined();
  });

  it('the title Slide > Text[0] is a consequence: causedBy = Slide > Text[1]', () => {
    const r = result();
    const title = atPath(r, 'Slide > Text[0]').filter(isOverflow);
    expect(title.length).toBeGreaterThan(0);
    for (const d of title) {
      expect(d.data?.causedBy).toBe(CAUSE);
      expect(d.severity).toBe('error'); // severidade não muda
      expect(d.message).toContain(CAUSE);
      expect(d.message).toContain(`corrija ${CAUSE} primeiro`);
    }
  });

  it('the row Slide > Box is a consequence: its overflow diagnostics have causedBy = Slide > Text[1]', () => {
    const r = result();
    const row = r.diagnostics.filter((d) => isOverflow(d) && d.path.startsWith('Slide > Box'));
    expect(row.length).toBeGreaterThan(0);
    for (const d of row) expect(d.data?.causedBy, d.path).toBe(CAUSE);
  });

  it('no diagnostic is caused by itself or by a path inside the cause', () => {
    const r = result();
    for (const d of r.diagnostics) {
      if (d.data?.causedBy === undefined) continue;
      expect(d.path).not.toBe(d.data.causedBy);
      expect(d.path.startsWith(`${d.data.causedBy} > `)).toBe(false);
    }
  });

  it('causedBy only appears on text-overflow / box-overflow', () => {
    const r = result();
    for (const d of r.diagnostics.filter((x) => x.data?.causedBy !== undefined)) expect(isOverflow(d), d.code).toBe(true);
  });
});

describe('cause.tsx — the 8 cards are grouped', () => {
  const result = lazy(() => fit(probe()));

  it.each(['text-overflow', 'text-word-broken'] as const)('one %s for the 8 cards, count 8, 8 paths in order', (code) => {
    const r = result();
    const cards = byCode(r, code).filter((d) => d.path.startsWith('Slide > Box'));
    expect(cards).toHaveLength(1);
    const [group] = cards;
    expect(group!.path).toBe(CARD_TEXT);
    expect(group!.data?.count).toBe(8);
    expect(group!.data?.paths).toHaveLength(8);
    expect(group!.data?.paths).toEqual(CARD_PATHS);
    expect(group!.message).toContain('(×8: mesmo problema em Box[0..7])');
  });

  it('no individual card path is left as its own diagnostic', () => {
    const r = result();
    for (const path of CARD_PATHS) expect(atPath(r, path)).toEqual([]);
  });

  it('M6 count: 4 errors in total (title, cards group, paragraph, font-missing) + 1 word-broken warning', () => {
    const r = result();
    const errors = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((d) => `${d.code} ${d.path}`).sort()).toEqual(
      [
        `font-missing Slide > Text[2]`,
        `text-overflow ${CARD_TEXT}`,
        `text-overflow Slide > Text[0]`,
        `text-overflow ${CAUSE}`,
      ].sort(),
    );
    expect(r.diagnostics.filter((d) => d.severity === 'warning').map((d) => `${d.code} ${d.path}`)).toEqual([
      `text-word-broken ${CARD_TEXT}`,
    ]);
  });
});

describe('cause.tsx — missing font', () => {
  const result = lazy(() => fit(probe()));

  it('Slide > Text[2] has only font-missing', () => {
    const r = result();
    expect(atPath(r, 'Slide > Text[2]').map((d) => d.code)).toEqual(['font-missing']);
  });

  it('it is not the cause of anything', () => {
    const r = result();
    expect(r.diagnostics.some((d) => d.data?.causedBy === 'Slide > Text[2]')).toBe(false);
  });
});

describe('fit — missing font that also overflows (M6)', () => {
  const Pair = () => (
    <Box height={60}>
      <Text fontSize={18} flexShrink={0}>
        curto
      </Text>
      <Text fontSize={24} fontFamily="Inter">
        {PARAGRAPH}
      </Text>
    </Box>
  );
  const pairSlide = () => (
    <Slide padding={40}>
      <Pair />
    </Slide>
  );
  const result = lazy(() => fit(pairSlide()));
  const missing = 'Slide > Pair > Text[1]';

  it('precondition: the estimated text really overflows its area', () => {
    const t = textAt(layoutOnly(pairSlide()), missing);
    expect(t.text.fontMissing).toBe(true);
    expect(t.text.height).toBeGreaterThan(t.frame.height + 0.5);
  });

  it('only font-missing on that Text (no text-overflow, text-shrunk, text-word-broken, text-illegible)', () => {
    const r = result();
    expect(atPath(r, missing).map((d) => d.code)).toEqual(['font-missing']);
  });

  it('it does not trigger the shrink: it keeps its size and its scope neighbour does not shrink', () => {
    const r = result();
    expect(textAt(r.slide, missing).text.fontSize).toBe(24);
    expect(textAt(r.slide, 'Slide > Pair > Text[0]').text.fontSize).toBe(18);
    expect(byCode(r, 'text-shrunk')).toEqual([]);
  });
});

// ───────────── demanda: row = maior, column = soma ─────────────

const boxAt = (slide: PositionedSlide, path: string): PositionedNode => nodeAt(slide, path);
const lines = (n: number) => Array.from({ length: n }, (_, i) => `linha ${i + 1}`).join('\n');
const demandsUnder = (slide: PositionedSlide, prefix: string): number[] =>
  texts(slide)
    .filter((t) => t.path.startsWith(`${prefix} > `))
    .map(textDemand);

/**
 * Testemunha: Text direto do Slide, espremido junto com os dois Box (todos com altura
 * pelo conteúdo, sem height explícito: altura fixa tem demanda 0). O seu causedBy revela
 * qual filho do Slide é a causa.
 */
const WITNESS = 'Slide > Text';

describe('cause — demand of a row is the largest child demand', () => {
  // Box[0]: coluna com um Text que pede ~X. Box[1]: row com duas células (Box aninhado)
  // que pedem a e b, com max(a, b) < X < a + b.
  const slide = () => (
    <Slide padding={40}>
      <Text fontSize={20} fit="error">
        Testemunha
      </Text>
      <Box>
        <Text fontSize={20} fit="error">
          {lines(10)}
        </Text>
      </Box>
      <Box display="flex" gap={10}>
        <Box flex={1}>
          <Text fontSize={20} fit="error">
            {lines(9)}
          </Text>
        </Box>
        <Box flex={1}>
          <Text fontSize={20} fit="error">
            {lines(9)}
          </Text>
        </Box>
      </Box>
    </Slide>
  );
  const result = lazy(() => fit(slide()));

  it('precondition: max(row cells) < column demand < sum(row cells)', () => {
    const laid = layoutOnly(slide());
    const column = demandsUnder(laid, 'Slide > Box[0]').reduce((a, b) => a + b, 0);
    const cells = demandsUnder(laid, 'Slide > Box[1]');
    expect(cells).toHaveLength(2);
    expect(Math.max(...cells)).toBeGreaterThan(0);
    expect(Math.max(...cells)).toBeLessThan(column);
    expect(cells[0]! + cells[1]!).toBeGreaterThan(column);
    expect(boxAt(laid, 'Slide > Box[1]').kind).toBe('box');
    expect(textDemand(textAt(laid, WITNESS))).toBeLessThan(Math.max(...cells));
  });

  it('the witness overflows and its cause is the column Box[0] (row counts the max, not the sum)', () => {
    const r = result();
    const w = atPath(r, WITNESS).filter(isOverflow);
    expect(w).toHaveLength(1);
    expect(w[0]!.data?.causedBy).toBe('Slide > Box[0]');
  });
});

describe('cause — demand of a column is the sum of child demands', () => {
  // Box[0]: coluna com dois filhos (um dentro de um Box aninhado) que pedem a e b.
  // Box[1]: um Text só que pede X, com max(a, b) < X < a + b.
  const slide = () => (
    <Slide padding={40}>
      <Text fontSize={20} fit="error">
        Testemunha
      </Text>
      <Box>
        <Text fontSize={20} fit="error">
          {lines(6)}
        </Text>
        <Box>
          <Text fontSize={20} fit="error">
            {lines(6)}
          </Text>
        </Box>
      </Box>
      <Box>
        <Text fontSize={20} fit="error">
          {lines(10)}
        </Text>
      </Box>
    </Slide>
  );
  const result = lazy(() => fit(slide()));

  it('precondition: max(column children) < single demand < sum(column children)', () => {
    const laid = layoutOnly(slide());
    const parts = demandsUnder(laid, 'Slide > Box[0]');
    const single = demandsUnder(laid, 'Slide > Box[1]').reduce((a, b) => a + b, 0);
    expect(textDemand(textAt(laid, WITNESS))).toBeLessThan(Math.max(...parts));
    expect(parts).toHaveLength(2);
    expect(Math.max(...parts)).toBeLessThan(single);
    expect(parts[0]! + parts[1]!).toBeGreaterThan(single);
  });

  it('the witness overflows and its cause is the column Box[0] (column counts the sum)', () => {
    const r = result();
    const w = atPath(r, WITNESS).filter(isOverflow);
    expect(w).toHaveLength(1);
    expect(w[0]!.data?.causedBy).toBe('Slide > Box[0]');
  });
});

describe('cause — no cause when the maximum demand is 0', () => {
  it('fixed sizes + gap that do not fit: box-overflow without causedBy', () => {
    const r = fit(
      <Slide padding={40}>
        <Box height={100} gap={10}>
          <Box height={60} flexShrink={0} />
          <Box height={60} flexShrink={0} />
        </Box>
      </Slide>,
    );
    const boxes = byCode(r, 'box-overflow');
    expect(boxes.length).toBeGreaterThan(0);
    for (const d of boxes) expect(d.data?.causedBy).toBeUndefined();
  });
});

// ───────────── quem não é causa (validação visual M6) ─────────────

describe('cause — a Text with a missing font has demand 0 and is never a cause', () => {
  const slide = () => (
    <Slide padding={40}>
      <Text fontSize={20} fontFamily="Inter">
        {PARAGRAPH}
      </Text>
      <Text fontSize={20} fit="error">
        {lines(4)}
      </Text>
    </Slide>
  );
  const result = lazy(() => fit(slide()));

  it('precondition: both are squeezed and the sibling really overflows', () => {
    const laid = layoutOnly(slide());
    expect(textDemand(textAt(laid, 'Slide > Text[0]'))).toBeGreaterThan(textDemand(textAt(laid, 'Slide > Text[1]')));
    expect(textDemand(textAt(laid, 'Slide > Text[1]'))).toBeGreaterThan(0.5);
  });

  it('the overflowing sibling has no causedBy and nothing points at the font-missing Text', () => {
    const r = result();
    const sibling = atPath(r, 'Slide > Text[1]').filter(isOverflow);
    expect(sibling).toHaveLength(1);
    expect(sibling[0]!.data?.causedBy).toBeUndefined();
    expect(r.diagnostics.some((d) => d.data?.causedBy === 'Slide > Text[0]')).toBe(false);
    expect(atPath(r, 'Slide > Text[0]').map((d) => d.code)).toEqual(['font-missing']);
  });
});

describe('cause — explicit height has demand 0', () => {
  it('two Box height={20} in a column, each overflowing inside → no causedBy', () => {
    const r = fit(
      <Slide padding={40} gap={10}>
        <Box height={20}>
          <Text fontSize={20} fit="error">
            {lines(3)}
          </Text>
        </Box>
        <Box height={20}>
          <Text fontSize={20} fit="error">
            {lines(2)}
          </Text>
        </Box>
      </Slide>,
    );
    const overflows = byCode(r, 'text-overflow');
    // Sem causedBy, os dois irmãos podem sair agrupados (Box[0..1]); o que importa são os membros.
    expect(allMemberPaths(overflows).sort()).toEqual(['Slide > Box[0] > Text', 'Slide > Box[1] > Text']);
    for (const d of overflows) {
      expect(d.data?.causedBy, d.path).toBeUndefined();
      expect(d.message).not.toMatch(/consequência|corrija Slide/);
    }
  });

  it('a Text with explicit height that overflows is not the cause of its squeezed sibling', () => {
    const r = fit(
      <Slide padding={40}>
        <Text fontSize={20} fit="error" height={300} flexShrink={0}>
          {lines(20)}
        </Text>
        <Text fontSize={20} fit="error">
          {lines(3)}
        </Text>
      </Slide>,
    );
    expect(r.diagnostics.some((d) => d.data?.causedBy === 'Slide > Text[0]')).toBe(false);
  });
});

describe('cause — a container only has a cause when it is overloaded', () => {
  it('fixed-height boxes that fit (sum + gap < content), each with an internal overflow → no causedBy', () => {
    // 2 × 60 + 10 = 130 pt numa área de 325 pt.
    const r = fit(
      <Slide padding={40} gap={10}>
        <Box height={60}>
          <Text fontSize={20} fit="error">
            {lines(5)}
          </Text>
        </Box>
        <Box height={60}>
          <Text fontSize={20} fit="error">
            {lines(4)}
          </Text>
        </Box>
      </Slide>,
    );
    const overflows = byCode(r, 'text-overflow');
    expect(allMemberPaths(overflows).sort()).toEqual(['Slide > Box[0] > Text', 'Slide > Box[1] > Text']);
    for (const d of overflows) expect(d.data?.causedBy, d.path).toBeUndefined();
  });

  it('texts limited by maxHeight in a column with room to spare → no causedBy', () => {
    // Demanda > 0 em cada um, mas Σ(frame + demanda) + gap cabe na área: ninguém tirou altura de ninguém.
    const slide = () => (
      <Slide padding={40} gap={10}>
        <Text fontSize={20} fit="error" maxHeight={30}>
          {lines(4)}
        </Text>
        <Text fontSize={20} fit="error" maxHeight={30}>
          {lines(3)}
        </Text>
      </Slide>
    );
    const laid = layoutOnly(slide());
    const children = [textAt(laid, 'Slide > Text[0]'), textAt(laid, 'Slide > Text[1]')];
    const wanted = children.reduce((sum, t) => sum + t.frame.height + textDemand(t), 0) + 10;
    expect(wanted).toBeLessThan(405 - 80);
    const r = fit(slide());
    for (const d of r.diagnostics.filter(isOverflow)) expect(d.data?.causedBy, d.path).toBeUndefined();
  });
});
