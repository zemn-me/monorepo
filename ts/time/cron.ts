import { minute } from "#root/ts/time/time.js";

export interface Cancel {
	(): void
}


const tick = 1 * minute;

/**
 * Schedules a function to be called when a month begins.
 * This function recalculates the next execution time every minute to stay accurate,
 * especially if the user changes time zones.
 * @param fn - The function to execute at the start of the month.
 * @param month - Optional. Specific month (0-11) when the function should be called.
 * @returns A {@link Cancel} function to cancel the scheduled execution.
 */
export function onMonth(fn: () => unknown, month?: number): Cancel {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const nextMonthStart = month !== undefined
            ? new Date(currentYear + (currentMonth >= month ? 1 : 0), month, 1)
            : new Date(currentYear, currentMonth + 1, 1);

        const delay = nextMonthStart.getTime() - now.getTime();

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
