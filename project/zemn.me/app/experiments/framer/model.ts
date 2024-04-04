export abstract class Measurement {
	abstract unitName: string;
	abstract shortUnitName: string;
	constructor(private readonly value: number) {}
	calc<T extends Measurement>(
		this: T,
		other: T,
		make: (n: number) => T,
		op: (a: T, b: T) => number
	): T {
		return make(op(this, other));
	}
}

export class MilliMeter extends Measurement {
	get unitName() {
		return 'millimeter';
	}
	get shortUnitName() {
		return 'mm';
	}
}

export class Inch extends Measurement {
	get unitName() {
		return 'inch';
	}
	get shortUnitName() {
		return 'in';
	}
}
