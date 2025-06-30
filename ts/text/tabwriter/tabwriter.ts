
/*

The algorithm proceeds in three pure stages:

1. **parse**  – Tokenise the UTF‑8 string into *lines* of *cells* (segments
   ending in `\t`, `\v`, `\n` or `\f`).
2. **format** – Walk the matrix recursively, computing the width each column
   must ultimately occupy (Nick Gravgaard’s *elastic* rule).
3. **render** – Re‑emit the text, inserting padding so every column is at
   least as wide as its widest cell.

No I/O occurs here – the caller decides what to do with the result.
Escape‑sequence and HTML/entity handling from the Go original are omitted for
brevity; they can be re‑introduced by extending the *parser*.
*/

/** Options recognised by {@link elasticTabstops}. */
export interface Options {
  /** Minimum width (in runes) a column may shrink to **including** padding. */
  minWidth?: number;
  /** Logical width of a literal `\t` in the *rendered* output. */
  tabWidth?: number;
  /** Extra runes to add after each cell when computing its target width. */
  padding?: number;
  /** Padding rune.  Use `"\t"` to keep output in tab‑stops. */
  padChar?: string;

  /** Right‑align cell text rather than left.                */
  alignRight?: boolean;
  /** Discard columns that are empty/soft (`\v`) across all rows. */
  discardEmpty?: boolean;
  /** Use literal `\t` for leading indentation when columns are empty. */
  tabIndent?: boolean;
  /** Emit `|` between columns – handy while debugging.        */
  debug?: boolean;
}

/** Public entry‑point. */
export const elasticTabstops = (
  input: string,
  opts: Options = {},
): string => renderLines(format(parse(input), opts), opts);

/* ══════════════════ Internal implementation details ═════════════════════ */

type Cell = Readonly<{ text: string; width: number; htab: boolean }>;
type Line = ReadonlyArray<Cell>;
// One *block* carries fully–rendered rows plus the column‑width prefix used.
type RenderBlock = [string[], number[]];

type Parsed = Line[];

/* ───────────────────── 1. Parser ──────────────────────────────────────── */

/** Convert raw text to a 2‑D array of immutable Cells. */
const parse = (src: string): Parsed => {
  const lines: Cell[][] = [[]];
  let buf = "";

  const flush = (htab = false) => {
    const cell: Cell = { text: buf, width: runeCount(buf), htab };
    lines.at(-1)!.push(cell);
    buf = "";
  };

  for (const ch of src) {
    switch (ch) {
      case "\t": flush(true); break; // hard tab
      case "\v": flush(true); break; // soft tab
      case "\n": flush(false); lines.push([]); break;
      case "\f": flush(false); lines.push([]); break; // also flush‑block marker
      default: buf += ch;
    }
  }
  flush(false);
  return lines.filter(l => l.length); // drop trailing blank line
};

/**
 * Recursively compute the width of every column.
 * Returns a list of *RenderBlocks* (render‑ready row arrays + their prefix‑widths).
 */
const format = (
  lines: Line[],
  o: Options,
  col: number = 0,
  prefixWidths: number[] = [],
): RenderBlock[] => {
  // Last data column = largest (len‑2) across all rows (the final cell per row
  // is non‑elastic because it is not tab‑terminated).
  const lastDataCol = Math.max(...lines.map(l => l.length - 2), -1);
  if (col > lastDataCol) {
    // Base‑case: there are no elastic columns left in this block.
    return [[blockToLines(lines, prefixWidths, o), prefixWidths]];
  }

  // First row that contains a cell in this column.
  const firstRow = lines.findIndex(l => col < l.length - 1);
  if (firstRow === -1) {
    // No cells ⇒ examine next column.
    return format(lines, o, col + 1, prefixWidths);
  }

  // Measure a contiguous vertical block (rows until a gap appears).
  let width = o.minWidth ?? 0;
  let row = firstRow;
  let empty = true;

  while (row < lines.length && col < lines[row]!.length - 1) {
    const c = lines[row]![col]!;
    if (c.width || c.htab) empty = false;
    width = Math.max(width, c.width + (o.padding ?? 1));
    row++;
  }
  if (empty && o.discardEmpty) width = 0;

  // Recurse: left block | (this column + right block) | remainder.
  return [
    ...format(lines.slice(0, firstRow), o, col, prefixWidths),
    ...format(
      lines.slice(firstRow, row),
      o,
      col + 1,
      [...prefixWidths, width],
    ),
    ...format(lines.slice(row), o, col, prefixWidths),
  ];
};


/** Convert a fully‑measured block into concrete string rows. */
const blockToLines = (
  block: Line[],
  prefixWidths: number[],
  o: Options,
): string[] => {
  const colDelim = o.debug ? "|" : "";
  return block.map(line => {
    const cells = line.map((cell, idx) => {
      const colPad = idx < prefixWidths.length
        ? pad(cell.width, prefixWidths[idx]!, o)
        : "";
      return o.alignRight
        ? colPad + cell.text
        : cell.text + colPad;
    });
    return cells.join(colDelim);
  });
};

/** Flatten RenderBlocks back to a single aligned string. */
const renderLines = (blocks: RenderBlock[], _: Options): string =>
  blocks.flatMap(([rows]) => rows).join("\n");


/** Count Unicode code‑points (runes) in a string. */
const runeCount = (s: string): number => [...s].length;

/** Generate padding so a `textW` cell grows to `cellW`. */
const pad = (textW: number, cellW: number, o: Options): string => {
  if (cellW <= textW) return "";
  const { padChar = " ", tabWidth = 4, tabIndent = false } = o;

  if (padChar === "\t" || tabIndent) {
    if (!tabWidth) return ""; // undefined tab behaviour
    const target = Math.ceil(cellW / tabWidth) * tabWidth;
    const need = target - textW;
    return "\t".repeat(Math.ceil(need / tabWidth));
  }
  return padChar.repeat(cellW - textW);
};
