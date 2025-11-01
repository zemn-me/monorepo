/**
 * @jest-environment node
 */

import { webcrypto } from "node:crypto";

import { describe, expect, it } from '@jest/globals';

import { fixedTimeStringEquals } from "#root/ts/crypto/fixed_time_string_comparison.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.crypto = webcrypto as any;


describe("fixedTimeStringEquals", () => {
  it("returns true for identical ASCII strings", async () => {
    await expect(fixedTimeStringEquals("hello", "hello")).resolves.toBe(true);
  });

  it("returns false for different ASCII strings", async () => {
    await expect(fixedTimeStringEquals("hello", "world")).resolves.toBe(false);
  });

  it("returns false for same prefix but different tail", async () => {
    await expect(fixedTimeStringEquals("token-abc123", "token-abc124")).resolves.toBe(false);
  });

  it("handles different lengths", async () => {
    await expect(fixedTimeStringEquals("short", "shorter")).resolves.toBe(false);
    await expect(fixedTimeStringEquals("longer", "long")).resolves.toBe(false);
  });

  it("works with multibyte (Unicode) strings", async () => {
    await expect(fixedTimeStringEquals("café", "café")).resolves.toBe(true);
    await expect(fixedTimeStringEquals("café", "cafe")).resolves.toBe(false);
  });

  it("distinguishes composed vs decomposed Unicode forms", async () => {
    const composed = "café";
    const decomposed = "cafe\u0301"; // visually identical
    await expect(fixedTimeStringEquals(composed, decomposed)).resolves.toBe(false);
  });

  it("is stable across repeated calls (memoised key)", async () => {
    const a = "repeat-me";
    const b = "repeat-me";
    const c = "repeat-you";
    await expect(fixedTimeStringEquals(a, b)).resolves.toBe(true);
    await expect(fixedTimeStringEquals(a, c)).resolves.toBe(false);
    await expect(fixedTimeStringEquals(a, b)).resolves.toBe(true);
  });
});
