

export const church = <T extends unknown[]>(...args: T): <R>(selector: (...args: T) => R) => R => selector => selector(...args);
