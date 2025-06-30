import { describe, expect, it } from '@jest/globals';

import { elasticTabstops } from "#root/ts/text/tabwriter/tabwriter.js";

/*
 * These tests focus on the public contract:
 *   1. columns are aligned (left‑ or right‑)
 *   2. option flags influence spacing exactly as documented
 *   3. formatter is deterministic / idempotent
 */

describe("elasticTabstops (left‑aligned)", () => {
  it("aligns two simple columns", () => {
    const input = `a	b\naa	bb\n`;
    const expected = `a  b\naa bb\n`;
    expect(elasticTabstops(input, { tabWidth: 4, padding: 1 })).toBe(expected);
  });
});

describe("elasticTabstops (right‑aligned)", () => {
  it("right‑aligns numeric columns when alignRight flag is set", () => {
    const input = `1	10\n22	3\n`;
    const expected = `  110\n 223\n`;
    expect(
      elasticTabstops(input, {
        alignRight: true,
        tabWidth: 4,
        padding: 1,
      }),
    ).toBe(expected);
  });
});

describe("elasticTabstops (debug pipes)", () => {
  it("inserts | between columns when debug flag is true", () => {
    const input = `x	1\ny	22\n`;
    const expected = `x |1\ny |22\n`;
    expect(elasticTabstops(input, { debug: true })).toBe(expected);
  });
});

describe("elasticTabstops (determinism)", () => {
  it("formatting twice yields the same result", () => {
    const src = `foo	bar\nbaz	qux\n`;
    const once = elasticTabstops(src);
    const twice = elasticTabstops(once);
    expect(once).toBe(twice);
  });
});
