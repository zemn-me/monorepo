import { minute } from "#root/ts/time/time.js";


interface Cancel {
	(): void
}

/**
 * Calls a function as close to the given Date as possible.
 *
 * For resiliance against time-zone shifts, this function re-calculates
 * the target time every minute, so if the target time ends up suddenly
 * happening very soon or even in the past, the function will still fire
 * correctly.
 *
 * Returns {@link Cancel}.
 */
export function schedule(fn: () => unknown, next: (now: Date) => Date, tick: number = 1 * minute): Cancel {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
        const now = new Date();

        const delay = (+next(now)) - (+now)

        if (delay <= tick) {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                fn();
                schedule();
            }, delay);
        } else if (!intervalId) {
            intervalId = setInterval(schedule, tick);
        }
    };

    schedule();

    return () => {
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
    };
}
