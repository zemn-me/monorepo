import { describe, expect, it, jest } from '@jest/globals';

import {and_then,
  Err,
  flatten,
  is_err,
  is_ok,
  Ok,
  result_and,
  result_collect,
  result_promise_transpose,
  unwrap,
  unwrap_err,
  unwrap_or,
  unwrap_or_else,
  zip} from '#root/ts/result/result.js';

describe('Result Utilities', () => {
  describe('is_ok', () => {
    it('returns true for an Ok result', () => {
      expect(is_ok(Ok('Success'))).toBe(true);
    });
    it('returns false for an Err result', () => {
      expect(is_ok(Err('Failure'))).toBe(false);
    });

	it('it does not get confused by undefined', () => {
		  expect(is_err(Err(undefined))).toBe(true);
	})
  });

  describe('is_err', () => {
    it('returns true for an Err result', () => {
      expect(is_err(Err('Failure'))).toBe(true);
    });
    it('returns false for an Ok result', () => {
      expect(is_err(Ok('Success'))).toBe(false);
    });
	it('it does not get confused by undefined', () => {
		  expect(is_ok(Ok(undefined))).toBe(true);
	})
  });

  describe('unwrap', () => {
    it('returns the inner value for Ok', () => {
      const value = 'Hello';
      expect(unwrap(Ok(value))).toBe(value);
    });
    it('throws the inner error for Err', () => {
      const error = 'Something went wrong';
      expect(() => unwrap(Err(error))).toThrow(error);
    });
  });

  describe('unwrap_err', () => {
    it('returns the error for Err', () => {
      const error = 'Oops';
      expect(unwrap_err(Err(error))).toBe(error);
    });
    it('throws when called on Ok', () => {
      expect(() => unwrap_err(Ok('Success'))).toThrow('Not in error.');
    });
  });

  describe('unwrap_or', () => {
    it('returns the inner value when Ok', () => {
      const value = 10;
      expect(unwrap_or(Ok(value), 20)).toBe(value);
    });
    it('returns the fallback value when Err', () => {
      expect(unwrap_or(Err('error'), 20)).toBe(20);
    });
  });

  describe('unwrap_or_else', () => {
    it('returns the inner value for Ok without calling the fallback', () => {
      const value = 'Direct';
      const fallbackFn = jest.fn(() => 'Fallback');
      expect(unwrap_or_else(Ok(value), fallbackFn)).toBe(value);
      expect(fallbackFn).not.toHaveBeenCalled();
    });
    it('calls the fallback and returns its result for Err', () => {
      const fallbackFn = jest.fn(() => 'Fallback');
      expect(unwrap_or_else(Err('error'), fallbackFn)).toBe('Fallback');
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('and_then', () => {
    it('applies the function and returns Ok with the new value when input is Ok', () => {
      const result = and_then(Ok(2), (v: number) => v * 3);
      expect(is_ok(result)).toBe(true);
      expect(unwrap(result)).toBe(6);
    });
    it('returns the original Err if input is Err', () => {
      const error = 'fail';
      const result = and_then(Err(error), (v: number) => v * 3);
      expect(is_err(result)).toBe(true);
      expect(result).toEqual(Err(error));
    });
  });

  describe('flatten', () => {
    it('unwraps nested Ok(Ok(value)) to Ok(value)', () => {
      const nested = Ok(Ok('Nested'));
      expect(flatten(nested)).toEqual(Ok('Nested'));
    });
    it('throws the inner error if the nested result is Err', () => {
      const innerError = 'inner error';
      const nested = Ok(Err(innerError));
      expect(() => unwrap(flatten(nested))).toThrow(innerError);
    });
  });

  describe('zip', () => {
    it('returns Ok with a tuple if both results are Ok', () => {
      const a = Ok('A');
      const b = Ok('B');
      const zipped = zip(a, b);
      expect(is_ok(zipped)).toBe(true);
      expect(zipped).toEqual(Ok(['A', 'B']));
    });
    it('returns the first Err if the first result is Err', () => {
      const error = 'first error';
      expect(zip(Err(error), Ok('B'))).toEqual(Err(error));
    });
    it('returns the second Err if the first is Ok and second is Err', () => {
      const error = 'second error';
      expect(zip(Ok('A'), Err(error))).toEqual(Err(error));
    });
  });

  describe('result_promise_transpose', () => {
    it('resolves to Ok with the promise value if input is Ok', async () => {
      const promiseResult = Ok(Promise.resolve(5));
      const result = await result_promise_transpose(promiseResult);
      expect(result).toEqual(Ok(5));
    });
    it('returns Err immediately if input is Err', async () => {
      const error = 'promise error';
      const result = await result_promise_transpose(Err(error));
      expect(result).toEqual(Err(error));
    });
  });

  describe('result_collect', () => {
    it('collects values into an Ok array when all results are Ok', () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      expect(result_collect(results)).toEqual(Ok([1, 2, 3]));
    });
    it('returns the first Err encountered', () => {
      const error = 'collect error';
      const results = [Ok(1), Err(error), Ok(3)];
      expect(result_collect(results)).toEqual(Err(error));
    });
  });

  describe('result_and', () => {
    it('swaps the inner value with the provided value when Ok', () => {
      expect(result_and(Ok('original'), 'new')).toEqual(Ok('new'));
    });
    it('returns the Err unchanged when input is Err', () => {
      const error = 'error present';
      expect(result_and(Err(error), 'new')).toEqual(Err(error));
    });
  });
});
