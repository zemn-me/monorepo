export interface Machine {
	speed: number;
	modules?: number;
	type?: string;
	usage?: number;
	fuelCategories?: string[];
	drain?: number;
	pollution?: number;
	size: number[];
	silo?: {
		parts: number;
		launch: number;
	};
	disallowedEffects?: string[];
}

export interface Beacon {
	effectivity: number;
	modules: number;
	range: number;
	type: string;
	usage: number;
	disallowedEffects: string[];
	size: number[];
}

export interface Fuel {
	category: string;
	value: number;
	result?: string;
}

export interface Module {
	pollution?: number;
	consumption?: number;
	speed?: number;
	productivity?: number;
	limitation?: string;
}

export interface Belt {
	speed: number;
}

export interface CargoWagon {
	size: number;
}

export interface FluidWagon {
	capacity: number;
}

export interface Recipe {
	belt?: Belt;
	id: string;
	name: string;
	isMining?: boolean;
	beacon?: Beacon;
	category: string;
	row: number;
	cargoWagon?: CargoWagon;
	fluidWagon?: FluidWagon;
	time: number;
	out: Record<string, number>;
	part?: string;
	producers: string[];
	machine?: Machine;
	in: Record<string, number>;
	isTechnology?: boolean;
	icon?: string;
	/**
	 * This appears to be a number encoded as a UTF8 string
	 * for some reason
	 */
	iconText?: string;
	cost?: number;
	unlockedBy?: string;
	isBurn?: boolean;
	catalyst?: Record<string, number>;
}

export interface Item {
	cargoWagon?: CargoWagon;
	fluidWagon?: FluidWagon;
	belt?: Belt;
	beacon?: Beacon;
	id: string;
	name: string;
	category?: string;
	fuel?: Fuel;
	machine?: Machine;
	module?: Module;
	iconText?: string;
	icon?: string;
	stack?: number;
	pollution?: number;
	/**
	 * I believe this is in the menu view in the game.
	 */
	row: number;
	technology?: { prerequisites?: string[] };
}

export interface Icon {
	id: string;
	position: string;
	color: string;
}

export interface Category {
	id: string;
	name: string;
	icon?: string;
}

export interface FactorioVersionData {
	version: {
		base: string;
	};

	categories: Category[];
	/**
	 * FactorioLab specific data
	 */
	defaults: unknown;

	/**
	 * Every icon in Factorio of every prototype.
	 *
	 * The icon positions are relative to a spritesheet from the repo.
	 */
	icons: Icon[];
	items: Item[];

	limitations: unknown;
	recipes: Recipe[];
}
