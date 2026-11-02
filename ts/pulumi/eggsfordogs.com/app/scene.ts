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

export function dogScale(index: number): number {
	return index === 5 ? 0.78 : index === 1 ? 0.88 : 1;
}

/** Encloses the animated mesh in the ground plane, including the nose and tail. */
export function dogCollisionRadius(index: number): number {
	return 1.1 * dogScale(index);
}

const dogCenterLimit = 6.2;
const gatheringRadius = 2.4;

export function createPark(): Park {
	return {
		dogs: PACK.map((_, i) => ({
			x: Math.cos((i * Math.PI * 2) / PACK.length) * 3.2,
			z: Math.sin((i * Math.PI * 2) / PACK.length) * 3,
			heading: (i * Math.PI * 2) / PACK.length,
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

/** Reserve one retriever per nearby group of treats so a crowd cannot block pickup. */
function eggTargets(
	dogs: readonly Dog[],
	eggs: readonly Egg[]
): Map<number, Egg> {
	const targets = new Map<number, Egg>();
	let available = [...eggs];
	while (available.length && targets.size < dogs.length) {
		let nearest = Infinity,
			dogIndex = -1;
		let target: Egg | undefined;
		for (const egg of available)
			for (let i = 0; i < dogs.length; i++) {
				if (targets.has(i)) continue;
				const dog = dogs[i]!;
				const distance = (dog.x - egg.x) ** 2 + (dog.z - egg.z) ** 2;
				if (distance < nearest) {
					nearest = distance;
					dogIndex = i;
					target = egg;
				}
			}
		if (!target) break;
		targets.set(dogIndex, target);
		const reserved = target;
		available = available.filter(
			egg => Math.hypot(egg.x - reserved.x, egg.z - reserved.z) >= 2.2
		);
	}
	return targets;
}

/** Project proposed positions out of one another; only the newly created dogs mutate. */
function separateDogs(dogs: Dog[]): void {
	for (let pass = 0; pass < 32; pass++) {
		let correction = 0;
		for (let i = 0; i < dogs.length; i++)
			for (let j = i + 1; j < dogs.length; j++) {
				const a = dogs[i]!,
					b = dogs[j]!;
				const dx = b.x - a.x,
					dz = b.z - a.z;
				const distance = Math.hypot(dx, dz);
				const overlap =
					dogCollisionRadius(i) + dogCollisionRadius(j) - distance;
				if (overlap <= 0) continue;
				// A deterministic normal also separates exactly coincident centers.
				const angle = i + j * 2.399963229728653;
				const nx = distance > 1e-9 ? dx / distance : Math.cos(angle);
				const nz = distance > 1e-9 ? dz / distance : Math.sin(angle);
				const push = (overlap + 1e-6) / 2;
				a.x -= nx * push;
				a.z -= nz * push;
				b.x += nx * push;
				b.z += nz * push;
				correction = Math.max(correction, overlap);
			}
		for (const dog of dogs) {
			const distance = Math.hypot(dog.x, dog.z);
			if (distance > dogCenterLimit) {
				dog.x *= dogCenterLimit / distance;
				dog.z *= dogCenterLimit / distance;
				correction = Math.max(correction, distance - dogCenterLimit);
			}
		}
		if (correction < 1e-5) break;
	}
}

export function stepPark(park: Park, delta: number): Park {
	const dt = Math.max(0, Math.min(delta, 0.05));
	if (dt === 0) return park;
	const time = park.time + dt;
	let eggs = park.eggs.map(egg => ({ ...egg, age: egg.age + dt }));
	let delivered = park.delivered;
	let lastDog = park.lastDog;
	const targets = eggTargets(park.dogs, eggs);
	const dogs = park.dogs.map((dog, i) => {
		const targetEgg = targets.get(i);
		const calling = park.callingUntil > time;
		const phase = (i * Math.PI * 2) / PACK.length;
		const tx =
			targetEgg?.x ??
			(calling
				? Math.cos(phase) * gatheringRadius
				: Math.cos(time * 0.16 + phase) * 4.4);
		const tz =
			targetEgg?.z ??
			(calling
				? Math.sin(phase) * gatheringRadius
				: Math.sin(time * 0.21 + phase) * 3.8);
		const distance = Math.hypot(tx - dog.x, tz - dog.z);
		const speed = targetEgg || calling ? 3.3 : 0.7;
		const moving = distance > 0.25;
		let vx = moving ? (tx - dog.x) / distance : 0;
		let vz = moving ? (tz - dog.z) / distance : 0;
		if (moving) {
			for (let j = 0; j < park.dogs.length; j++) {
				if (j === i) continue;
				const other = park.dogs[j]!;
				const dx = other.x - dog.x,
					dz = other.z - dog.z;
				const gap = Math.hypot(dx, dz);
				const clearance =
					dogCollisionRadius(i) + dogCollisionRadius(j) + 0.6;
				if (gap < 1e-9 || gap >= clearance || vx * dx + vz * dz <= 0)
					continue;
				// Pass on the right instead of repeatedly walking into a blocked path.
				const weight = (1 - gap / clearance) * 2;
				vx += ((dz - dx * 0.5) / gap) * weight;
				vz += ((-dx - dz * 0.5) / gap) * weight;
			}
		}
		const length = Math.hypot(vx, vz);
		const step = Math.min(distance, dt * speed);
		return {
			x: dog.x + (length > 0 ? (vx / length) * step : 0),
			z: dog.z + (length > 0 ? (vz / length) * step : 0),
			heading: length > 0 ? Math.atan2(vx, vz) : dog.heading,
			joy: Math.max(0, dog.joy - dt),
			moving,
		};
	});
	separateDogs(dogs);
	for (let i = 0; i < dogs.length; i++) {
		const dog = dogs[i]!,
			target = targets.get(i);
		const previous = park.dogs[i]!;
		dog.moving = Math.hypot(dog.x - previous.x, dog.z - previous.z) > 1e-5;
		if (
			target &&
			target.age > 0.8 &&
			Math.hypot(target.x - dog.x, target.z - dog.z) < 0.55
		) {
			eggs = eggs.filter(egg => egg.id !== target.id);
			delivered++;
			lastDog = i;
			dog.joy = 1.7;
		}
	}
	return { ...park, time, dogs, eggs, delivered, lastDog };
}
