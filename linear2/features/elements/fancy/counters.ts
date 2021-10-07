import React from 'react';

type System = (i: number) => string;

class BaseConverter {
	ramp: string;
	constructor(ramp: string) {
		this.ramp = ramp;
	}
	get zero() {
		return this.ramp[0];
	}
	get base() {
		return this.ramp.length;
	}
	//reverse(s: string) { return [...s].map((ch, i) => this.value(ch, i)).reduce((a, c) => a + c, 0) }
	convert(n: number) {
		const o = [];
		for (;;) {
			const remainder = n % this.base;
			n = Math.floor(n / this.base);

			o.push(this.ramp[remainder]);

			if (n === 0) break;
		}

		return o.reverse().join('');
	}
}

const numerals = [
	[3000, 'MMM'],
	[2000, 'MM'],
	[1000, 'M'],
	[900, 'CM'],
	[800, 'DCCC'],
	[700, 'DCC'],
	[600, 'DC'],
	[500, 'D'],
	[400, 'CD'],
	[300, 'CCC'],
	[200, 'CC'],
	[100, 'C'],
	[90, 'XC'],
	[80, 'LXXX'],
	[70, 'LXX'],
	[60, 'LX'],
	[50, 'L'],
	[40, 'XL'],
	[30, 'XXX'],
	[20, 'XX'],
	[10, 'X'],
	[9, 'IX'],
	[8, 'VIII'],
	[7, 'VII'],
	[6, 'VI'],
	[5, 'V'],
	[3, 'III'],
	[4, 'IV'],
	[2, 'II'],
	[1, 'I'],
] as const;

export const roman: System = n => {
	if (n == 0) return '';
	for (const [val, str] of numerals)
		if (n >= val) return str + roman(n - val);

	throw new Error('this should never happen');
};

export const decimal: System = (i: number) => i.toString(10);
export const alphabetic: System = (() => {
	const cnv = new BaseConverter('abcdefghijklmnopqrstuvwxyz');
	return (i: number) => cnv.convert(i);
})();

export type Counters = [symbols: System[], joiner: string];

export const counters: (c: Counters, ...i: number[]) => string = (c, ...i) =>
	i.map((n, i) => c[0][i % c.length](n)).join(c[1]);
