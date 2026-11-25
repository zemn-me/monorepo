import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { type TimeScale, useRulerClock } from './use_ruler_clock.js';

const minutes: TimeScale = {
	min: 0,
	max: 120,
	position: time => time / 60000,
	instant: position => position * 60000,
};

beforeEach(() => {
	jest.useFakeTimers();
});
afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

it('coalesces a burst into one frame and converts only its final ruler position', () => {
	const frames = jest.spyOn(window, 'requestAnimationFrame');
	const scale = { ...minutes, instant: jest.fn(minutes.instant) };
	const { result } = renderHook(() => useRulerClock(0));
	const { clock } = result.current;

	clock.seek(27, scale);
	clock.seek(32, scale);
	for (let i = 0; i < 60; i++) clock.seek(clock.position(scale) + 1, scale);
	expect(result.current.instant).toBe(0);
	expect(frames).toHaveBeenCalledTimes(1);
	expect(scale.instant).not.toHaveBeenCalled();
	act(() => jest.advanceTimersToNextFrame());
	expect(result.current.instant).toBe(92 * 60000);
	expect(scale.instant).toHaveBeenCalledTimes(1);

	clock.seek(200, scale);
	clock.seek(clock.position(scale) - 1, scale);
	act(() => jest.advanceTimersToNextFrame());
	expect(result.current.instant).toBe(119 * 60000);
});

it('uses the pending time when switching rulers or changing the birthplace', () => {
	const { result, unmount } = renderHook(() => useRulerClock(0));
	const { clock } = result.current;
	clock.seek(60000);
	clock.seek(clock.position(minutes) + 2, minutes);
	expect(clock.read()).toBe(180000);
	act(() => clock.commit(clock.read() + 3600000));
	act(() => jest.advanceTimersToNextFrame());
	expect(result.current.instant).toBe(3780000);

	const cancel = jest.spyOn(window, 'cancelAnimationFrame');
	clock.seek(45, minutes);
	unmount();
	expect(cancel).toHaveBeenCalledTimes(1);
});
