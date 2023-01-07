
function head<T, F>(t: Iterator<T>, n: number, f: F): [ value: (T|F)[], eof: boolean, eofAt?: number ] {
    let o: (T|F)[] = [];
    let eof = false;
    let eofAt: undefined | number;

    for (let i = 0; i < n; i++ ) {
        const v = t.next();
        if (v.done) {
            eof = v.done;
            eofAt = i;
        }
        o.push(v.done?f:v.value)
    }

    return [ o, eof ];
}

function* subdivideG<T, F>(cells: Iterable<T>, width: number, newCellWidth: number, newCellHeight: number, f: F): Iterable<(T|F)[]> {
    const it = cells[Symbol.iterator]();

    const chunkSize = newCellHeight * width;
    const cellsPerChunk = Math.ceil(width / newCellWidth);
    const oldCellsInNewCell = newCellWidth * newCellHeight;
    const wc = newCellWidth;
    const w = width;

    for (;;) {
        const [ chunk, eof, eofAt ] = head(it, chunkSize, f);

        // if there's nothing at all valid in this chunk, that's it.
        if (eof && eofAt == 0) break
        console.log(eofAt);

        for (let ic = 0; ic < cellsPerChunk; ic++) {
            let newCell: (T|F)[] = [];

            for (let nc = 0; nc < oldCellsInNewCell; nc++) {
                newCell[nc] = chunk[(ic * wc + (nc%wc)) + w * (
                    (nc - (nc %wc)) / wc
                )];
            }

            yield newCell;
        }


        if (eof) break;
    }
}

function subdivide<T, F>(cells: Iterable<T>, width: number, newCellWidth: number, newCellHeight: number, f: F): [ cells: Iterable<(T|F)[]>, width: number ] {
    return [ subdivideG(cells, width, newCellWidth, newCellHeight, f), Math.ceil(width / newCellWidth) ]
}

function eights<T, F>(cells: Iterable<1|0>, width: number): [ cells: Iterable<(1|0)[]>, width: number] {
   return subdivide(cells, width, 2, 4, 0 as const)
}

/**
 * Encodes a single braille codepoint, in unicode-canonical order (which is kind of weird).
 * It's this order:
 * ```
 *    1 4
 *    2 5
 *    3 6
 *    7 8
 * ```
 */
function encodeBrailleCanon(a: 1|0=0, b: 1|0=0, c: 1|0=0, d: 1|0=0, e: 1|0=0, f: 1|0=0 , g: 1|0=0, h: 1|0=0): number{
    return 0x2800
        + (
              a << 0 
            | b << 1
            | c << 2
            | d << 3
            | e << 4
            | f << 5
            | g << 6
            | h << 7
        
    )
}

/**
 * encodes braille codepoint in a more reasonable canonical order:
 * ```
 *    1 2
 *    3 4
 *    5 6
 *    7 8
 * ```
 */
function encodeBraille(a: 1|0=0, b: 1|0=0, c: 1|0=0, d: 1|0=0, e: 1|0=0, f: 1|0=0 , g: 1|0=0, h: 1|0=0): number {
    return encodeBrailleCanon(a, c, e, b, d, f,g, h)
}

function* splice<T, V>(it: Iterable<T>, count: number, V: V) {
    let i = 0;
    for (const v of it) {
        yield v;
        if (i > 0 && i%count == 0) yield V;
        i++;
    }
}

function* map<I, O>(it: Iterable<I>, f: (v: I) => O) {
    for (const v of it) yield f(v);
}

const nl = "\n".charCodeAt(0);

/**
 * Encode a coordinate space as some braille characters
 */
export function plot(v: Iterable<1|0>, width: number): string {
    const [x, nw] = eights(v, width);

    return String.fromCharCode(
        ...splice(
            map(
                x, ([a,b,c,d,e,f,g,h]) => encodeBraille(a,b,c,d,e,f,g,h)
            ),
            nw,
            nl
        )
    )
}

