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
	[4, 'IV'],
	[3, 'III'],
	[2, 'II'],
	[1, 'I'],
] as const;

export function romanize(n: number): string {
	const parts: string[] = [];
	while (n > 0) {
		for (const [value, symbol] of numerals) {
			if (n < value) continue;
			parts.push(symbol);
			n -= value;
			break;
		}
	}

	return parts.join('');
}
