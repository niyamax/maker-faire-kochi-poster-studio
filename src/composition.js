import { glyphMetrics } from './flex-glyphs.js';

/**
 * Deterministic, space-sharing typography. Every letter owns a non-overlapping
 * rectangle; enlarging its weight redistributes the same finite row width.
 *
 * `layout`: one of LAYOUT_IDS. Only explicit newlines create rows; spaces stay
 * within a row. Centered uses a shaped centred rag; Offset alternates open edges.
 * `weights[row][col]` and `rowWeights[row]` are positive multipliers. Missing or
 * invalid multipliers are 1. Focus uses zero-based, fractional row/col indices;
 * its amount is -1…1 (negative contracts, positive expands).
 *
 * Returns `{ cells, width, height, rows }`. `rows` contains row metadata and its
 * cells. Space characters occupy intentional gaps but do not become cells.
 * `index` is a stable, contiguous index among visible letters; `col` is local
 * to its row. Angles are zero: deformation comes from the letter construction,
 * and keeping cells upright guarantees their bounds remain honest.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const unit = (value, fallback) => clamp(finite(value, fallback), 0, 1);
const dimension = (value, fallback) => Math.max(1, finite(value, fallback));
const multiplier = value => clamp(finite(value, 1), .08, 12);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const sum = values => values.reduce((a, b) => a + b, 0);
const bump = (distance, radius) => Math.exp(-Math.pow(distance / radius, 2));

const WIDTH_RHYTHM = [1.12, .78, .92, 1.52, .73, 1.28, .84];
const FLEX_ROWS = [1.08, .82, 1.1];
const AIR_ROWS = [1.02, .96, 1.02];

/** Public IDs are also safe values for saved projects and select controls. */
export const LAYOUT_PRESETS = Object.freeze([
  { id: 'stack', label: 'Stack', description: 'Shared edges, full frame.' },
  { id: 'offset', label: 'Offset', description: 'Alternating open edges.' },
  { id: 'centered', label: 'Centered', description: 'A sculpted, centred rag.' },
].map(preset => Object.freeze(preset)));
export const LAYOUT_IDS = Object.freeze(LAYOUT_PRESETS.map(preset => preset.id));

function textRows(text) {
  const source = String(text ?? 'MAKER\nFAIRE\nKOCHI').replace(/\r\n?/g, '\n');
  if (!source.trim()) return [];
  return source.split('\n').map(line => line.replace(/[^\S\n]/g, ' ')).filter(line => line.trim().length > 0);
}

export function layoutComposition(text, options = {}) {
  const width = dimension(options.width, 1080);
  const height = dimension(options.height, 1080);
  const mode = options.mode === 'air' ? 'air' : 'flex';
  const layout = LAYOUT_IDS.includes(options.layout) ? options.layout : 'stack';
  const spread = unit(options.spread, mode === 'air' ? .14 : .28);
  const pressure = unit(options.pressure, mode === 'air' ? .7 : .4);
  const variation = unit(options.variation, .7);
  const metric = char => { const value = typeof options.metrics === 'function' ? options.metrics(char) : glyphMetrics(char); return Math.max(.18, finite(value, glyphMetrics(char))); };
  const lines = textRows(text);
  const cells = [], rows = [];
  if (!lines.length) return { cells, width, height, rows };

  const shortSide = Math.min(width, height);
  const margin = shortSide * (mode === 'air' ? .026 : .042);
  const contentWidth = width - margin * 2, contentHeight = height - margin * 2;
  const desiredRowGap = shortSide * (mode === 'air' ? .008 + spread * .022 : .018 + spread * .04)
    * (1 - pressure * .45);
  const rowGap = Math.min(desiredRowGap, contentHeight / (lines.length * 4));
  const rowSpace = contentHeight - rowGap * (lines.length - 1);
  const focus = options.focus || {};
  const focusRow = finite(focus.row, 0), focusCol = finite(focus.col, 0);
  const focusAmount = clamp(finite(focus.amount, 0), -1, 1);
  const rhythm = mode === 'air' ? AIR_ROWS : FLEX_ROWS;
  const rowScores = lines.map((_, row) => multiplier(options.rowWeights?.[row])
    * mix(1, rhythm[row % rhythm.length], variation)
    * Math.max(.2, 1 + focusAmount * .14 * bump(row - focusRow, .75)));
  const rowScoreTotal = sum(rowScores);
  const measureLine = line => sum(Array.from(line).map(char => char === ' ' ? .36 : metric(char)));
  const lineMeasures = lines.map(measureLine), longestLine = Math.max(...lineMeasures);
  let y = margin;

  for (let row = 0; row < lines.length; row++) {
    let rowHeight = rowSpace * rowScores[row] / rowScoreTotal;
    let leftInset = 0, rightInset = 0;
    if (layout === 'offset') {
      const positions = [[0, .14], [.14, 0], [.035, .065]];
      [leftInset, rightInset] = positions[row % positions.length].map(value => value * (.6 + variation * .4));
    } else if (layout === 'centered') {
      const profile = [1, .74, .88, .8][row % 4];
      const relative = .62 + .38 * Math.pow(lineMeasures[row] / longestLine, .8);
      const lineWidth = (lines.length === 1 ? .84 : profile) * relative;
      leftInset = rightInset = (1 - lineWidth) / 2;
    } else if (mode === 'flex' && lines.length > 1) {
      // A small open edge in the middle line, balanced by the larger outer rows.
      rightInset = row % 3 === 1 ? .055 * variation : 0;
    }
    let rowX = margin + contentWidth * leftInset;
    let rowWidth = contentWidth * (1 - leftInset - rightInset);
    const characters = Array.from(lines[row]);
    const visibleCount = characters.filter(char => char !== ' ').length;
    const desiredGap = shortSide * (mode === 'air' ? .004 + spread * .016 : .012 + spread * .028)
      * (1 - pressure * .55);
    // Even thousands of characters retain positive area on a very small board.
    const gap = Math.min(desiredGap, rowWidth / Math.max(4, visibleCount * 4));
    const letterSpace = rowWidth - gap * Math.max(0, visibleCount - 1);
    let col = 0;
    const tokens = characters.map(char => {
      if (char === ' ') return { char, score: .36 * (mode === 'air' ? .7 : 1.2) };
      const localCol = col++;
      const baseWidth = metric(char);
      const rhythmValue = WIDTH_RHYTHM[(localCol + row * 2) % WIDTH_RHYTHM.length];
      const expression = mix(1, rhythmValue, variation * (mode === 'air' ? .42 : 1));
      const influence = bump(row - focusRow, .7) * bump(localCol - focusCol, .72);
      const reaction = Math.max(.12, 1 + focusAmount * 2.4 * influence);
      return { char, col: localCol, score: baseWidth * expression * reaction * multiplier(options.weights?.[row]?.[localCol]) };
    });
    const scoreTotal = sum(tokens.map(token => token.score));
    const rowCells = [];
    let x = rowX, seen = 0;
    for (const token of tokens) {
      const w = letterSpace * token.score / scoreTotal;
      if (token.char === ' ') { x += w; continue; }
      if (seen++) x += gap;
      // Occasional short forms make quiet areas inside the Flex composition.
      // Air keeps almost all of the height so silhouettes meet across small gaps.
      const small = mode === 'flex' && (token.col + row * 3) % 7 === 3;
      const h = rowHeight * (small ? 1 - variation * .46 : 1);
      const alignTop = (token.col + row) % 2 === 0;
      const cellY = y + (alignTop ? 0 : rowHeight - h);
      const cell = { char: token.char, index: cells.length, row, col: token.col, x, y: cellY, w, h, angle: 0 };
      cells.push(cell); rowCells.push(cell); x += w;
    }
    rows.push({ index: row, text: lines[row], x: rowX, y, w: rowWidth, h: rowHeight, cells: rowCells });
    y += rowHeight + rowGap;
  }
  return { cells, width, height, rows };
}
