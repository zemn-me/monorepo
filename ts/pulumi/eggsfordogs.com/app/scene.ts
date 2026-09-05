export const PACK = [
	{
		name: 'Biscuit',
		coat: 0xd9a35d,
		patch: 0xffefcf,
		collar: 0xde6650,
		personality: 'Head of egg inspection',
	},
	{
		name: 'Mochi',
		coat: 0xf5eedb,
		patch: 0xbf956f,
		collar: 0x93a4d0,
		personality: 'Small dog. Big feelings.',
	},
	{
		name: 'Pickles',
		coat: 0x655345,
		patch: 0xe3b879,
		collar: 0xf3ca51,
		personality: 'Has never read a rule',
	},
	{
		name: 'Clover',
		coat: 0xc1844a,
		patch: 0xf7ead7,
		collar: 0x75a58a,
		personality: 'Your new best friend',
	},
	{
		name: 'Waffles',
		coat: 0xefe1c2,
		patch: 0x735645,
		collar: 0xda8bad,
		personality: 'Thinking about breakfast',
	},
	{
		name: 'Bean',
		coat: 0x52535b,
		patch: 0xf3e7d3,
		collar: 0x6ea9b1,
		personality: 'Employee of the month',
	},
] as const;

export interface Dog {
	x: number;
	z: number;
	heading: number;
	joy: number;
	moving: boolean;
}

export interface Egg {
	id: number;
	x: number;
	z: number;
	age: number;
}

export interface Park {
	dogs: Dog[];
	eggs: Egg[];
	time: number;
	nextEgg: number;
	delivered: number;
	lastDog: number | null;
	callingUntil: number;
}

export function createPark(): Park {
	return {
		dogs: PACK.map((_, i) => ({
			x: Math.cos(i * 1.7) * 3.2,
			z: Math.sin(i * 1.7) * 3,
			heading: i * 1.7,
			joy: 0,
			moving: false,
		})),
		eggs: [],
		time: 0,
		nextEgg: 0,
		delivered: 0,
		lastDog: null,
		callingUntil: 0,
	};
}

/** Keep treats on the lawn and cap active objects even when someone clicks rapidly. */
export function tossEgg(park: Park, x: number, z: number): Park {
	if (park.eggs.length >= 12 || !Number.isFinite(x) || !Number.isFinite(z))
		return park;
	const radius = Math.hypot(x, z);
	const scale = radius > 5.8 ? 5.8 / radius : 1;
	return {
		...park,
		nextEgg: park.nextEgg + 1,
		eggs: [
			...park.eggs,
			{ id: park.nextEgg, x: x * scale, z: z * scale, age: 0 },
		],
	};
}

export function callPack(park: Park): Park {
	return { ...park, callingUntil: park.time + 7 };
}

export function stepPark(park: Park, delta: number): Park {
	const dt = Math.max(0, Math.min(delta, 0.05));
	const time = park.time + dt;
	let eggs = park.eggs.map(egg => ({ ...egg, age: egg.age + dt }));
	let delivered = park.delivered;
	let lastDog = park.lastDog;
	const dogs = park.dogs.map((dog, i) => {
		const targetEgg = eggs.reduce<Egg | undefined>(
			(nearest, egg) =>
				!nearest ||
				Math.hypot(egg.x - dog.x, egg.z - dog.z) <
					Math.hypot(nearest.x - dog.x, nearest.z - dog.z)
					? egg
					: nearest,
			undefined
		);
		const calling = park.callingUntil > time;
		const phase = (i * Math.PI * 2) / PACK.length;
		const tx =
			targetEgg?.x ??
			(calling
				? Math.cos(phase) * 1.6
				: Math.cos(time * 0.16 + phase) * 4.4);
		const tz =
			targetEgg?.z ??
			(calling
				? Math.sin(phase) * 1.6
				: Math.sin(time * 0.21 + phase) * 3.8);
		const distance = Math.hypot(tx - dog.x, tz - dog.z);
		const speed = targetEgg || calling ? 3.3 : 0.7;
		const moving = distance > 0.25;
		const step = Math.min(distance, dt * speed);
		let joy = Math.max(0, dog.joy - dt);
		if (targetEgg && targetEgg.age > 0.8 && distance < 0.55) {
			eggs = eggs.filter(egg => egg.id !== targetEgg.id);
			delivered++;
			lastDog = i;
			joy = 1.7;
		}
		const heading = moving
			? Math.atan2(tx - dog.x, tz - dog.z)
			: dog.heading;
		return {
			x: dog.x + (moving ? ((tx - dog.x) / distance) * step : 0),
			z: dog.z + (moving ? ((tz - dog.z) / distance) * step : 0),
			heading,
			joy,
			moving,
		};
	});
	return { ...park, time, dogs, eggs, delivered, lastDog };
}
