import {
	Bio,
	type Event,
	eventHasStarted,
} from '#root/project/me/zemn/bio/bio.js';
import type { GameCampaign } from '#root/project/tiberian_sun/web/launcher.js';
import { text } from '#root/ts/react/lang/index.js';

export interface BioMission {
	readonly title: string;
	readonly years: string;
	readonly act: number;
	readonly operation: 'raid' | 'defend' | 'siege';
	readonly briefing: string;
	readonly events: readonly Event[];
	readonly transmissions: readonly Event[];
	readonly scenario: string;
}

// Keep historical chapters stable when new entries are published. Each chapter's
// mechanics interpret real work as campaign fiction; the records remain verbatim.
const chapters = [
	{
		through: 2013,
		name: 'Night Shift',
		operation: 'raid',
		briefing:
			'Watford, after dark. Your first job is to get the network working. Send an engineer into the Grove hotel (west of your troops) to provision the evacuation route. Destroy the Nod relay, then cover the hospital civilians as they walk back to the hotel. The power plant feeds the lasers above the escarpment. Assault the northern ramp or flank along the southern approach. Save the patients: no evacuation, no victory.',
	},
	{
		through: 2017,
		name: 'Hack Fortress',
		operation: 'defend',
		briefing:
			'Two games, one team. Hold your uplink for three minutes AND capture the field terminal beside the southern settlement with an engineer. The hacking team unlocks two Titans for the battlefield team. Destroying the Nod relay cuts off their waves. Your uplink sits on the western bluff. Hold the ramp mouths while your hacking team works below.',
	},
	{
		through: 2019,
		name: 'Full Steam Ahead',
		operation: 'siege',
		briefing:
			'A rail yard carries a very literal payload. Destroy the Nod relay to sever remote control, which releases the evidence train toward the eastern signal. Escort it through the low railway cutting. Clear the northern ridge before releasing it; enemies on the banks overlook the train. Clear the laser batteries before moving: the train is valuable evidence, not a tank. Inspired by the Steam remote-code-execution research.',
	},
	{
		through: 2022,
		name: 'Westbound',
		operation: 'raid',
		briefing:
			'London to San Francisco, through the wrong kind of green belt. Use your armored reinforcements to clear the northern ramp and ridge, then reach the lit waystation south of the woods to release the civilian convoy. Escort it to your landing zone and destroy the Nod relay. The convoy must descend the eastern ridge through the southern pass. Cover the ramp mouth; fiends own the Tiberium groves. Cut the eastern power plant to get armored support.',
	},
	{
		through: 2024,
		name: 'Trust Issues',
		operation: 'defend',
		briefing:
			'An apparently harmless workspace has crossed the perimeter. Capture the southern quarantine terminal with an engineer, then keep your uplink alive for three minutes. Seize the control plane intact: shelling the terminal loses the mission. Capturing it turns the hostile laser defenses against the attackers. Your uplink overlooks the valley from the western bluff. The terminal below is exposed: protect both the ramp and your engineer.',
	},
	{
		through: Infinity,
		name: 'Lockdown',
		operation: 'siege',
		briefing:
			'The city is an agent with too many permissions. Capture BOTH perimeter terminals with engineers to close its outbound routes, then destroy the central relay. Cutting a power supply is useful; razing the whole city is not. Keep civilians out of the crossfire. The eastern gateway and relay occupy the high district. Use the narrow northern ramp or take the longer southern flank.',
	},
] as const;

export function bioMissions(now = new Date()): BioMission[] {
	const published = Bio.timeline
		.filter(event => eventHasStarted(event, now))
		.toSorted((a, b) => a.date.getTime() - b.date.getTime());
	return chapters.flatMap((chapter, index) => {
		const records = published.filter(
			event =>
				event.date.getUTCFullYear() >
					(chapters[index - 1]?.through ?? -Infinity) &&
				event.date.getUTCFullYear() <= chapter.through
		);
		if (!records.length) return [];
		const years = `${records[0]?.date.getUTCFullYear()}–${records.at(-1)?.date.getUTCFullYear()}`;
		return [
			{
				title: `${chapter.name}: ${years}`,
				years,
				act: index + 1,
				operation: chapter.operation,
				briefing: chapter.briefing,
				events: records,
				transmissions: records,
				scenario: `BIO${String(index + 1).padStart(2, '0')}.INI`,
			},
		];
	});
}

interface CampaignCell {
	readonly x: number;
	readonly y: number;
	readonly tile: number;
	readonly subTile: number;
	readonly height: number;
	readonly ramp: number;
	readonly blocked: boolean;
}

// Temperate theater's native cliff/ramp pieces. These are footprint metadata,
// not artwork: the existing game assets supply rendering and movement rules.
// Entries are [sub-tile, elevation, ramp, impassable] in row-major order.
const rampPieces: Readonly<
	Record<
		number,
		{
			width: number;
			cells: readonly (readonly [number, number, number, boolean])[];
		}
	>
> = {
	405: {
		width: 4,
		cells: [
			[0, 3, 3, false],
			[1, 2, 3, false],
			[2, 1, 3, false],
			[3, 0, 3, false],
			[4, 3, 10, false],
			[5, 3, 2, true],
			[6, 0, 4, true],
			[7, 0, 7, false],
			[9, 4, 0, true],
			[10, 0, 0, true],
		],
	},
	406: {
		width: 4,
		cells: [
			[1, 4, 0, true],
			[2, 0, 0, true],
			[4, 3, 11, false],
			[5, 3, 4, true],
			[6, 0, 2, true],
			[7, 0, 6, false],
			[8, 3, 3, false],
			[9, 2, 3, false],
			[10, 1, 3, false],
			[11, 0, 3, false],
		],
	},
	410: {
		width: 4,
		cells: [
			[1, 0, 0, true],
			[2, 4, 0, true],
			[4, 0, 5, false],
			[5, 0, 0, true],
			[6, 3, 4, true],
			[7, 3, 12, false],
			[8, 0, 1, false],
			[9, 1, 1, false],
			[10, 2, 1, false],
			[11, 3, 1, false],
		],
	},
	411: {
		width: 4,
		cells: [
			[0, 0, 1, false],
			[1, 1, 1, false],
			[2, 2, 1, false],
			[3, 3, 1, false],
			[4, 0, 8, false],
			[5, 0, 4, true],
			[9, 0, 0, true],
		],
	},
	412: {
		width: 2,
		cells: [
			[0, 3, 2, true],
			[1, 3, 9, false],
			[2, 4, 0, true],
		],
	},
};

export function campaignTerrain(act: number): Map<string, CampaignCell> {
	const cells = new Map<string, CampaignCell>();
	const put = (
		x: number,
		y: number,
		tile: number,
		height: number,
		subTile = 0,
		ramp = 0,
		blocked = false
	) => {
		cells.set(`${x},${y}`, { x, y, tile, subTile, height, ramp, blocked });
	};
	const defense = act === 2 || act === 5;
	const edge = defense ? 20 : 37;
	const bank = (x: number, y: number) =>
		Math.max(0, Math.min(4, x - 36, Math.max(43 - y, y - 45)));
	// Corner ordering and ramp numbers match the engine's deformation grid:
	// NW, NE, SE, SW. Shared corner heights prevent cracks between hill tiles.
	const slopes = [0, 7, 8, 4, 5, 18, 1, 12, 6, 3, 17, 11, 2, 10, 9, 0];
	for (let y = 1; y < 80; y++)
		for (let x = 1; x < 80; x++) {
			if (x + y <= 40 || x + y > 120 || Math.abs(x - y) >= 40) continue;
			const road =
				act === 4
					? x >= 30 && x <= 32 && y >= 25 && y <= 45
					: (y >= 31 && y <= 33 && x >= 21 && x <= 51) ||
						(x >= 32 && x <= 34 && y >= 23 && y <= 46);
			const garden =
				(x - 22) ** 2 + (y - 25) ** 2 < 38 ||
				(x - 27) ** 2 + (y - 47) ** 2 < 35;
			const waste = (x - 40) ** 2 + (y - 48) ** 2 < 65;
			let height = defense ? (x <= edge ? 4 : 0) : x >= edge ? 4 : 0;
			let ramp = 0;
			if (act === 3) {
				const corners = [
					bank(x, y),
					bank(x + 1, y),
					bank(x + 1, y + 1),
					bank(x, y + 1),
				];
				height = Math.min(...corners);
				const mask = corners.reduce(
					(mask, corner, i) =>
						mask | ((corner > height ? 1 : 0) << i),
					0
				);
				ramp = slopes[mask] ?? 0;
			}
			put(
				x,
				y,
				ramp ? 39 + ramp : road ? 671 : garden ? 626 : waste ? 150 : 0,
				height,
				0,
				ramp
			);
		}
	if (act === 3) return cells;
	const stamp = (tile: number, x: number, y: number) => {
		const piece = rampPieces[tile];
		if (!piece) throw new Error(`Unknown ramp piece ${tile}`);
		for (const [subTile, height, ramp, blocked] of piece.cells)
			put(
				x + (subTile % piece.width),
				y + Math.floor(subTile / piece.width),
				tile,
				height,
				subTile,
				ramp,
				blocked
			);
	};
	// A real four-level cliff stops ground movement. Two separated ramps let
	// players choose a direct assault or a longer flank, and defend either mouth.
	for (let y = 1; y < 80; y++) {
		if (defense) {
			put(edge, y, 77, 4, 0, 0, true); // CLIFF18: high western rim.
			put(edge + 1, y, 77, 0, 1, 0, true);
		} else put(edge, y, 97, 4, 0, 0, true); // CLIFF38: high eastern rim.
	}
	const passes = defense
		? [
				[28, 35],
				[37, 45],
			]
		: act === 6
			? [
					[30, 37],
					[43, 51],
				]
			: [
					[30, 38],
					[42, 50],
				];
	for (const [start, end] of passes) {
		if (start === undefined || end === undefined) continue;
		// Remove the wall across the complete ramp footprint before stamping
		// its asymmetric native end caps and four-cell sloping carriageway.
		for (let y = start; y <= end; y++)
			for (let x = edge - 2; x <= edge + 2; x++)
				put(x, y, 0, defense ? (x <= edge ? 4 : 0) : x >= edge ? 4 : 0);
		if (defense) {
			stamp(406, edge - 1, start);
			stamp(405, edge - 1, end - 2);
			for (let y = start + 3; y < end - 2; y++)
				for (let i = 0; i < 4; i++)
					put(edge - 1 + i, y, 42, 3 - i, 0, 3);
		} else {
			stamp(410, edge - 2, start);
			stamp(411, edge - 2, end - 2);
			stamp(412, edge, end - 1);
			for (let y = start + 3; y < end - 2; y++)
				for (let i = 0; i < 4; i++) put(edge - 2 + i, y, 40, i, 0, 1);
		}
	}
	return cells;
}

const section = (name: string, lines: readonly string[]) =>
	`[${name}]\n${lines.join('\n')}\n`;
// Native INI values cannot contain line breaks or comment delimiters. The
// original game's bitmap font also needs a plain ASCII field transmission.
const fieldText = (value: string) =>
	value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\x20-\x7e]/g, ' ')
		.replace(/[;=]/g, ':')
		.replace(/\s+/g, ' ')
		.trim();
function recordText(event: Event): string {
	return fieldText(
		`${event.date.toISOString().slice(0, 10)}: ${text(event.title)}`
	);
}
const action = (kind: number, value: number, waypoint = 'A') =>
	`${kind},0,${value},0,0,0,0,${waypoint}`;
const actions = (...values: string[]) => `${values.length},${values.join(',')}`;
const teamAction = (
	team: string,
	waypoint = team === 'SUPPORT' ? 'F' : team === 'EAST' ? 'D' : 'E'
) => `80,1,${team},0,0,0,0,${waypoint}`;
const packedLines = (bytes: Iterable<number>) =>
	(
		btoa(
			Array.from(bytes, byte => String.fromCharCode(byte)).join('')
		).match(/.{1,70}/g) ?? []
	).map((line, i) => `${i + 1}=${line}`);

// Westwood's overlay stream is a sequence of 8192-byte Format80 blocks.
// A run-only encoder keeps generated resource fields small and deterministic.
export function overlayPack(values: Uint8Array): string[] {
	const bytes: number[] = [];
	for (let start = 0; start < values.length; start += 8192) {
		const end = Math.min(start + 8192, values.length);
		const block: number[] = [];
		for (let i = start; i < end; ) {
			let j = i + 1;
			while (j < end && values[j] === values[i]) j++;
			const count = j - i;
			block.push(0xfe, count & 255, count >> 8, values[i] ?? 0);
			i = j;
		}
		block.push(0x80);
		const length = end - start;
		bytes.push(
			block.length & 255,
			block.length >> 8,
			length & 255,
			length >> 8,
			...block
		);
	}
	return packedLines(bytes);
}

export function missionINI(mission: BioMission, next?: BioMission): string {
	const raid = mission.operation === 'raid';
	const defense = mission.operation === 'defend';
	const evacuation = mission.act === 1 || mission.act === 4;
	const capture = mission.act === 2 || mission.act === 5 || mission.act === 6;
	const rail = mission.act === 3;
	// Keep rail geometry axis-aligned; each chapter gets a different settlement,
	// road network, vegetation and lighting rather than rotating one empty arena.
	const position = (x: number, y: number): readonly [number, number] => [
		x,
		y,
	];
	const cell = (x: number, y: number) => {
		const [a, b] = position(x, y);
		return b * 1000 + a;
	};
	const triggers: string[] = [];
	const tags: string[] = [];
	const events: string[] = [];
	const orders: string[] = [];
	const addTrigger = (
		id: string,
		condition: string,
		commands: string[],
		house = 'GDI',
		linked = '<none>',
		disabled = false,
		persistence = 0
	) => {
		triggers.push(
			`${id}=${house},${linked},${id},${disabled ? 1 : 0},1,1,1,0`
		);
		tags.push(`${id}_TAG=${persistence},${id},${id}`);
		events.push(`${id}=${condition}`);
		orders.push(`${id}=${actions(...commands)}`);
	};
	const cellTags: string[] = [];
	const messages = [
		`99=${
			[
				'Send an engineer into the western hotel. Escort the hospital evacuees home and destroy the Nod relay. Power plant: optional blackout.',
				'Capture the southern terminal with an engineer AND defend your uplink for 3:00. Hacking unlocks Titans. Relay stops waves.',
				'Destroy the Nod relay to release the evidence train. Escort it to the eastern signal. Do not lose the locomotive.',
				'Clear the northern ramp with your reinforced armor, then contact the southern waystation. Cover the convoy as it descends.',
				'Capture the southern quarantine terminal intact to reclaim the laser defenses. Hold your uplink for 3:00.',
				'Capture both perimeter terminals with engineers. Destroy the relay to finish Lockdown.',
			][mission.act - 1]
		}`,
		'90=POWER CUT. Lasers offline. Two Titans arriving at your landing zone.',
		rail
			? '91=REMOTE LINK SEVERED. Evidence train departing for the eastern signal. Escort it!'
			: '91=REMOTE LINK SEVERED. Enemy reinforcements stopped. Complete the civilian or capture objective.',
		'92=CONTACT: raiders entering the eastern approach!',
		'93=CONTACT: armor entering the southern approach!',
		'94=NETWORK PROVISIONED. Hospital evacuation authorized. Cover the lit road back to the hotel!',
		mission.act === 5
			? '95=TRUST RESET. The hostile laser defenses now answer to you. Hold the uplink!'
			: '95=TERMINAL CAPTURED. Exploit delivered: two Titans released to your battlefield team.',
		'96=EVACUATION COMPLETE. Survivors have reached your landing zone.',
		'97=TRAIN AT THE EASTERN SIGNAL. Evidence recovered. Sever the Nod relay to finish.',
		'98=GATEWAY SEALED. Seal both outbound paths, then destroy the relay.',
	];
	addTrigger('BOOT', '1,13,0,1', [
		action(11, 99),
		action(17, 1),
		action(17, 2),
		action(17, 6),
		action(17, 7),
		...(mission.act === 6 ? [action(17, 11)] : []),
		...(defense ? [action(27, 180)] : []),
	]);
	addTrigger('LOSE', '1,11,0,0', [action(2, 0)]);
	addTrigger('POWER', '1,7,0,0', [
		action(56, 3),
		action(11, 90),
		teamAction('SUPPORT'),
	]);
	addTrigger('RELAY', '1,7,0,0', [
		action(56, 0),
		action(11, 91),
		...(rail ? ['4,1,RAIL,0,0,0,0,K'] : []),
	]);
	if (evacuation) {
		// Shared semipersistent tags fire only when the last attached engineer dies.
		if (mission.act === 1)
			addTrigger(
				'ENGINEERSLOST',
				'2,48,0,0,37,0,1',
				[action(2, 0)],
				'GDI',
				'<none>',
				false,
				1
			);
		addTrigger('RESCUE', '1,1,0,0', [
			action(56, 1),
			action(11, 94),
			teamAction('EVAC', 'G'),
		]);
		if (mission.act === 4) {
			for (let x = 29; x <= 33; x++)
				for (let y = 40; y <= 44; y++)
					cellTags.push(`${cell(x, y)}=RESCUE_TAG`);
		}
		addTrigger('EVACUATED', '1,36,0,2', [action(11, 96)]);
		addTrigger('CIVILIANSLOST', '2,36,0,1,9,0,4', [action(2, 0)]);
		addTrigger('DONE', '2,36,0,0,36,0,2', [action(1, 0)]);
	} else if (rail) {
		addTrigger('TRAINLOST', '1,48,0,0', [action(2, 0)]);
		addTrigger(
			'TRAINHOME',
			'1,34,0,7',
			[action(56, 2), action(11, 97)],
			'GDI',
			'TRAINLOST'
		);
		addTrigger('DONE', '2,36,0,0,36,0,2', [action(1, 0)]);
	} else if (capture) {
		addTrigger('TERMINALLOST', '1,48,0,0', [action(2, 0)]);
		addTrigger(
			'CAPTURE',
			'1,1,0,0',
			[
				action(56, 1),
				action(11, 95),
				...(mission.act === 5 ? [] : [teamAction('SUPPORT')]),
			],
			'GDI',
			'TERMINALLOST'
		);
		if (mission.act === 5)
			addTrigger('RECLAIM', '1,36,0,1', [action(14, 0)]);
		if (mission.act === 6) {
			addTrigger('SECONDLOST', '1,48,0,0', [action(2, 0)]);
			addTrigger(
				'SECOND',
				'1,1,0,0',
				[action(56, 2), action(11, 98)],
				'GDI',
				'SECONDLOST'
			);
			addTrigger('DONE', '3,36,0,0,36,0,1,36,0,2', [action(1, 0)]);
		} else {
			addTrigger('UPLINK', '1,7,0,0', [action(2, 0)]);
			addTrigger('DONE', '2,14,0,0,36,0,1', [action(1, 0)]);
		}
	}
	// Records unlock at actual mission milestones, rather than playing a lecture
	// on a clock. Brief radio bursts follow each capture, rescue or sabotage.
	const unlocks: string[][] = [[], [], []];
	mission.transmissions.forEach((event, i) => {
		const gate = i % 3;
		const commands = unlocks[gate];
		commands?.push(`53,2,INTEL${i},0,0,0,0,A`);
		addTrigger(
			`INTEL${i}`,
			`1,13,0,${8 + Math.floor(i / 3) * 10}`,
			[action(11, 100 + i)],
			'GDI',
			'<none>',
			true
		);
		messages.push(`${100 + i}=${recordText(event)}`);
	});
	unlocks.forEach((commands, gate) =>
		addTrigger(
			`DOSSIER${gate}`,
			gate === 0
				? '1,13,0,1'
				: `1,36,0,${gate === 1 ? 3 : evacuation || capture ? 1 : 0}`,
			commands
		)
	);

	const waves = defense ? [20, 50, 80, 110, 140, 165] : [45, 90, 150, 210];
	waves.forEach((time, i) =>
		addTrigger(`WAVE${i}`, `2,13,0,${time},37,0,0`, [
			action(11, i % 2 ? 93 : 92),
			teamAction(i % 2 ? 'WEST' : 'EAST'),
		])
	);
	const landscape = campaignTerrain(mission.act);
	const structures: string[] = [];
	const units: string[] = [];
	const infantry: string[] = [];
	const building = (
		owner: string,
		type: string,
		x: number,
		y: number,
		tag = 'None'
	) => {
		if (owner === 'Neutral') {
			const height = landscape.get(`${x},${y}`)?.height;
			for (let dy = 0; dy < 3; dy++)
				for (let dx = 0; dx < 3; dx++) {
					const ground = landscape.get(`${x + dx},${y + dy}`);
					if (
						!ground ||
						ground.blocked ||
						ground.ramp ||
						ground.height !== height
					)
						return;
				}
		}
		structures.push(
			`${structures.length}=${owner},${type},256,${position(x, y).join(',')},0,${tag},1,0,1,${type === 'GACTWR' ? 1 : 0},0,${type === 'GACTWR' ? 'GAVULC' : 'None'},None,None,0,0`
		);
	};
	const unit = (
		owner: string,
		type: string,
		x: number,
		y: number,
		order = 'Guard',
		tag = 'None',
		follower = -1
	) =>
		units.push(
			`${units.length}=${owner},${type},256,${position(x, y).join(',')},${type === 'LOCOMOTIVE' || type === 'TRAINCAR' || type === 'CARGOCAR' ? 64 : 0},${order},${tag},0,-1,0,${follower},1,1`
		);
	const soldier = (
		owner: string,
		type: string,
		x: number,
		y: number,
		order = 'Guard',
		tag = 'None'
	) =>
		infantry.push(
			`${infantry.length}=${owner},${type},256,${position(x, y).join(',')},0,${order},0,${tag},0,-1,0,1,1`
		);
	building('Nod', 'NAPOWR', 34, 28, 'POWER_TAG');
	building('Nod', 'NARADR', 44, rail ? 36 : 40, 'RELAY_TAG');
	building(
		'Nod',
		'NALASR',
		rail ? 40 : 39,
		35,
		mission.act === 5 ? 'RECLAIM_TAG' : 'None'
	);
	building(
		'Nod',
		'NALASR',
		43,
		35,
		mission.act === 5 ? 'RECLAIM_TAG' : 'None'
	);
	if (!raid) {
		building('Nod', 'NAHAND', 46, rail ? 51 : 43);
		building('GDI', 'GACNST', 23, 26);
		building('GDI', 'GAPOWR', defense ? 23 : 22, defense ? 31 : 29);
		building('GDI', 'GAPOWR', defense ? 17 : 18, defense ? 41 : 31);
		building('GDI', 'GAPILE', 27, 29);
		building('GDI', 'PROC', defense ? 25 : 22, defense ? 35 : 34);
		building('GDI', 'GAWEAP', 29, 34);
		building(
			'GDI',
			'GARADR',
			defense ? 17 : 18,
			defense ? 38 : 34,
			defense ? 'UPLINK_TAG' : 'None'
		);
		unit('GDI', 'HARV', defense ? 28 : 26, defense ? 38 : 36, 'Harvest');
		building('GDI', 'GACTWR', 32, 29);
		if (defense) {
			building('GDI', 'GACTWR', 18, 40);
			// The exposed bluff and reclaimed lasers need a reserve under fire.
			building('GDI', 'GAPOWR', 29, 31);
		}
	}
	unit('GDI', 'MMCH', 28, 26);
	if (!defense) unit('GDI', 'MMCH', 29, 27);
	if (raid) unit('GDI', 'MMCH', 27, 27);
	unit('GDI', 'SMECH', 28, 28);
	for (let i = 0; i < 6; i++)
		soldier(
			'GDI',
			i < 4 ? 'E1' : 'E3',
			(raid ? 26 : 30) + (i % 3),
			(raid ? 29 : 26) + Math.floor(i / 3)
		);
	soldier('GDI', 'MEDIC', 25, 29);
	for (let i = 0; i < 4; i++)
		soldier('Nod', 'E1', 32 + (i % 2), 28 + Math.floor(i / 2));
	unit('Nod', 'BGGY', 40, 38);
	unit('Nod', 'BIKE', 45, 37);
	if (mission.operation === 'siege') {
		unit('Nod', 'TTNK', 42, 42);
		unit('Nod', 'TTNK', 47, 38);
	}
	// Civilian architecture creates streets, courtyards and collateral to avoid.
	// These are scenario-local names, so the original campaigns keep their rules.
	if (mission.act === 1) {
		building('Nod', 'CITY02', 22, 27, 'RESCUE_TAG');
		building('Neutral', 'CAHOSP', 29, 37);
	} else if (mission.act === 4) building('Neutral', 'CA0004', 29, 38);
	else building('Neutral', 'CA0001', 25, rail ? 39 : 41);
	if (capture) {
		building('Nod', 'CA0007', 30, 40, 'CAPTURE_TAG');
		if (mission.act === 6) building('Nod', 'CA0017', 42, 31, 'SECOND_TAG');
	}
	for (const [x, y, type] of (mission.act === 4
		? [
				[19, 36, 'GAOLDCC1'],
				[39, 44, 'CA0003'],
				[45, 29, 'CA0006'],
			]
		: [
				[23, 39, 'CA0003'],
				[28, 45, 'CA0005'],
				[39, 28, 'CITY03'],
				[42, 28, 'CITY12'],
				[47, 32, 'CITY01'],
				[41, rail ? 51 : 45, 'CITY11'],
				[48, rail ? 51 : 47, 'CITY04'],
				[20, 44, 'CA0013'],
			]) as readonly (readonly [number, number, string])[])
		building('Neutral', type, x, y);
	for (const [x, y] of [
		[25, 24],
		[30, 33],
		[32, 41],
		[41, 33],
		[45, 44],
	]) {
		if (x === undefined || y === undefined) continue;
		building('Neutral', 'GALITE', x, y);
		soldier('Neutral', 'CIV1', x + 1, y + 1, 'Area Guard');
	}
	building('Nod', 'REDLAMP', 40, 34);
	building('Neutral', 'INGRNLMP', 42, 50);
	if (mission.act === 1 || capture) {
		soldier(
			'GDI',
			'ENGINEER',
			raid ? 24 : 26,
			raid ? 26 : 27,
			'Guard',
			mission.act === 1 ? 'ENGINEERSLOST_TAG' : 'None'
		);
		soldier(
			'GDI',
			'ENGINEER',
			raid ? 24 : 26,
			raid ? 27 : 28,
			'Guard',
			mission.act === 1 ? 'ENGINEERSLOST_TAG' : 'None'
		);
	}
	if (rail) {
		const engine = units.length;
		unit('GDI', 'LOCOMOTIVE', 33, 43, 'Guard', 'TRAINHOME_TAG', engine + 1);
		unit('GDI', 'TRAINCAR', 31, 43, 'Guard', 'None', engine + 2);
		unit('GDI', 'CARGOCAR', 29, 43);
		building('Neutral', 'CA0004', 31, 39);
		unit('GDI', 'MMCH', 33, 40);
		soldier('GDI', 'E3', 31, 42);
		soldier('GDI', 'E3', 32, 42);
	}

	const terrain: string[] = [];
	for (let y = 31; y < 44; y++) {
		if (y === 36 || y === 37 || (rail && y === 43)) continue;
		terrain.push(`${cell(35, y)}=TREE0${(y % 3) + 1}`);
		if (y % 2) terrain.push(`${cell(36, y)}=TREE02`);
	}
	terrain.push(`${cell(42, 50)}=TIBTRE01`);
	for (let x = 17; x < 31; x += 2)
		terrain.push(`${cell(x, 46 + (x % 3))}=TREE0${(x % 3) + 1}`);
	if (mission.act === 4 || mission.act === 6) {
		soldier('Special', 'DOGGIE', 40, 47, 'Area Guard');
		soldier('Special', 'DOGGIE', 40, 49, 'Area Guard');
		unit('Special', 'VISC_SML', 44, 49, 'Area Guard');
		unit('Special', 'VISC_SML', 46, 50, 'Area Guard');
	}
	// Trees and ambient props must never obstruct the cliff ramps.
	const openGround = (x: number, y: number) => {
		const ground = landscape.get(`${x},${y}`);
		return ground !== undefined && ground.ramp === 0 && !ground.blocked;
	};
	const tiles: number[] = [];
	for (const { x, y, tile, subTile, height } of landscape.values())
		tiles.push(x, 0, y, 0, tile & 255, tile >> 8, 0, 0, subTile, height);
	tiles.push(0, 0, 0, 0);

	// The starting field is safe; a larger reserve beyond the woods rewards
	// expansion rather than leaving the entire economy on a fixed allowance.
	const overlays = new Uint8Array(512 * 512).fill(255);
	const density = new Uint8Array(512 * 512);
	for (const [cx, cy, radius] of [
		[20, 39, 4],
		[38, 48, 6],
	]) {
		if (cx === undefined || cy === undefined || radius === undefined)
			continue;
		for (let y = cy - radius; y <= cy + radius; y++)
			for (let x = cx - radius; x <= cx + radius; x++)
				if (
					(x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 &&
					openGround(x, y)
				) {
					const [a, b] = position(x, y);
					overlays[b * 512 + a] = 105; // Engine OVERLAY_TIBERIUM01 (green Tiberium).
					density[b * 512 + a] = 11;
				}
	}
	if (rail)
		for (let x = 15; x <= 55; x++) {
			overlays[43 * 512 + x] = 39; // TRACKS01, the NW/SE straight in the shipped type list.
			density[43 * 512 + x] = 0;
		}
	const teams = ['EAST', 'WEST', 'SUPPORT', ...(evacuation ? ['EVAC'] : [])];
	return [
		section('Basic', [
			`Name=${fieldText(`Bio: ${mission.title}`)}`,
			'NewINIFormat=4',
			'Player=GDI',
			'HomeCell=0',
			'AltHomeCell=0',
			'SkipMapSelect=yes',
			'SkipScore=yes',
			'IgnoreGlobalAITriggers=yes',
			'FreeRadar=yes',
			'TiberiumGrowthEnabled=yes',
			`EndOfGame=${next ? 'no' : 'yes'}`,
			...(next ? [`NextScenario=${next.scenario}`] : []),
		]),
		section('Map', [
			'Theater=TEMPERATE',
			'Size=0,0,40,40',
			'LocalSize=2,4,36,32',
			'Level=0',
			'Fill=Clear',
		]),
		section('Houses', [
			'0=GDI',
			'1=Nod',
			'2=Neutral',
			'3=Special',
			'4=Evacuees',
		]),
		section('GDI', [
			'PlayerControl=yes',
			'TechLevel=7',
			`Credits=${raid ? 0 : 80}`,
			'IQ=0',
			'Allies=Neutral,Evacuees',
			'Color=Gold',
		]),
		section('Nod', ['TechLevel=7', 'Credits=0', 'IQ=0', 'Color=DarkRed']),
		section('Neutral', ['Allies=GDI,Evacuees', 'IQ=0']),
		section('Evacuees', ['Allies=GDI,Neutral', 'IQ=0', 'Color=LightGrey']),
		section('Special', ['IQ=0']),
		section('General', [
			'MessageDelay=0.10',
			'EngineerCaptureLevel=1.0',
			'EngineerDamage=0.0',
		]),
		section('CITY02', [
			'Name=The Grove - provisioning terminal',
			'Capturable=yes',
			'Immune=yes',
			'LegalTarget=no',
			'Selectable=yes',
		]),
		section('CAHOSP', ['Name=Royal Free - evacuation ward']),
		section('CA0007', [
			'Name=Capture: security terminal',
			'Capturable=yes',
			'Insignificant=no',
			'Strength=1200',
		]),
		section('CA0017', [
			'Name=Capture: outbound gateway',
			'Capturable=yes',
			'Insignificant=no',
			'Strength=1200',
		]),
		section('LOCOMOTIVE', [
			'Name=Evidence train',
			'Strength=900',
			'Speed=4',
			'Sight=8',
		]),
		section('TRAINCAR', ['Strength=700']),
		section('CARGOCAR', ['Strength=700']),
		// Insignificant civilians are excluded from native house survival counts.
		section('CIV1', ['Strength=150', 'Speed=4', 'Insignificant=no']),
		section('GALITE', [
			'LightVisibility=1600',
			'LightIntensity=0.4',
			'LightRedTint=0.8',
			'LightGreenTint=0.6',
			'LightBlueTint=0.25',
		]),
		section('REDLAMP', ['LightVisibility=1800', 'LightIntensity=0.15']),
		section('INGRNLMP', ['LightVisibility=1800', 'LightIntensity=0.1']),
		// Leave capacity for the two laser towers reclaimed in Trust Issues.
		section('GAPOWR', ['Power=150']),
		section('NAPOWR', ['Power=500']),
		section('NALASR', ['Powered=yes']),
		section('Structures', structures),
		section('Units', units),
		section('Infantry', infantry),
		section(
			'Terrain',
			terrain.filter(line => {
				const cell = Number(line.split('=')[0]);
				return openGround(cell % 1000, Math.floor(cell / 1000));
			})
		),
		section('IsoMapPack3', packedLines(tiles)),
		section('CellTags', cellTags),
		section('OverlayPack', overlayPack(overlays)),
		section('OverlayDataPack', overlayPack(density)),
		section(
			'Waypoints',
			[
				[26, 26],
				[34, 28],
				[44, rail ? 36 : 40],
				[52, 29],
				[24, 48],
				[23, 24],
				[mission.act === 4 ? 42 : 33, mission.act === 4 ? 44 : 41],
				rail ? [53, 43] : [30, 40],
				[26, 26],
				[33, 32],
				[33, 43],
				[42, 31],
			].map(([x, y], i) => `${i}=${cell(x ?? 0, y ?? 0)}`)
		),
		section('VariableNames', [
			'0=Remote link severed,0',
			'1=Access restored,0',
			'2=Payload delivered,0',
			'3=Power breached,0',
		]),
		section('TaskForces', [
			'0=RAIDERS',
			'1=ARMOR',
			'2=BACKUP',
			'3=PATIENTS',
			'4=ENGINE',
		]),
		section('RAIDERS', [
			'Name=Eastern raiders',
			`0=${mission.act > 3 ? 7 : 4},E1`,
			'1=2,E3',
			'Group=-1',
		]),
		section('ARMOR', [
			'Name=Western armor',
			`0=${mission.act > 3 ? 3 : 2},${raid ? 'BIKE' : 'TTNK'}`,
			'1=1,BGGY',
			'Group=-1',
		]),
		section('BACKUP', ['Name=Breach reward', '0=2,MMCH', 'Group=-1']),
		section('PATIENTS', ['Name=Hospital evacuees', '0=4,CIV1', 'Group=-1']),
		section('ENGINE', [
			'Name=Evidence train crew',
			'0=1,LOCOMOTIVE',
			'Group=-1',
		]),
		section('ScriptTypes', [
			'0=ASSAULT',
			'1=ARRIVE',
			'2=ESCAPE',
			'3=TRAINRUN',
		]),
		section('TRAINRUN', [
			'Name=Deliver evidence to the east signal',
			'0=3,7',
			'1=5,30',
		]),
		section('ESCAPE', [
			'Name=Evacuate along the lit road',
			'0=3,9',
			'1=3,8',
			'2=39,2',
			'3=5,30',
		]),
		section('ASSAULT', ['Name=Assault player base', '0=0,1']),
		section('ARRIVE', ['Name=Player reinforcements', '0=3,0', '1=5,2']),
		section(
			'TeamTypes',
			[...teams, ...(rail ? ['RAIL'] : [])].map((id, i) => `${i}=${id}`)
		),
		...teams.map((id, i) =>
			section(id, [
				`Name=${id}`,
				`House=${i === 3 ? 'Evacuees' : i === 2 ? 'GDI' : 'Nod'}`,
				`TaskForce=${['RAIDERS', 'ARMOR', 'BACKUP', 'PATIENTS'][i]}`,
				`Script=${i === 3 ? 'ESCAPE' : i === 2 ? 'ARRIVE' : 'ASSAULT'}`,
				`Waypoint=${['D', 'E', 'F', 'G'][i]}`,
				'Max=10',
				'Full=yes',
				'Autocreate=no',
				'Recruiter=no',
				'VeteranLevel=1',
				`Aggressive=${i === 3 ? 'no' : 'yes'}`,
				...(i === 3 ? ['AvoidThreats=no', 'Suicide=yes'] : []),
			])
		),
		...(rail
			? [
					section('RAIL', [
						'Name=Evidence train',
						'House=GDI',
						'TaskForce=ENGINE',
						'Script=TRAINRUN',
						'Waypoint=K',
						'Max=1',
						'Full=yes',
						'Recruiter=yes',
						'Prebuild=yes',
						'Autocreate=no',
						'Suicide=yes',
						'AvoidThreats=no',
					]),
				]
			: []),
		section('Triggers', triggers),
		section('Tags', tags),
		section('Events', events),
		section('Actions', orders),
		section('Tutorial', messages),
		section('Briefing', [
			`1=${fieldText(mission.title)}`,
			`2=${fieldText(mission.briefing)}`,
			'3=Drag-select troops. Left-click to move or attack. Use the radar to scout. Right-click cancels selection. Escape opens this briefing.',
			`4=Timeline: ${mission.events.length} dated transmissions, beginning with ${fieldText(mission.events[0] ? text(mission.events[0].title) : '')}. Combat operations are fiction: the intercepted bio records are real.`,
		]),
		section('Lighting', [
			`Ambient=${[0.54, 0.72, 0.62, 0.68, 0.5, 0.58][mission.act - 1]}`,
			`Red=${[0.8, 1.0, 1.08, 0.88, 0.75, 0.92][mission.act - 1]}`,
			`Green=${[0.86, 0.9, 0.88, 1.0, 0.85, 0.8][mission.act - 1]}`,
			`Blue=${[1.0, 0.76, 0.72, 0.7, 1.0, 1.0][mission.act - 1]}`,
		]),
	].join('\n');
}

export function createBioCampaign(
	missions: readonly BioMission[] = bioMissions()
): GameCampaign {
	if (!missions.length)
		throw new Error('The bio campaign has no published records');
	return {
		files: {
			'BATTLEWEB.INI':
				section('Battles', ['0=BIO']) +
				'\n' +
				section('BIO', [
					'Description=Thomas Shadwell: Bio',
					'Scenario=' + missions[0]?.scenario,
					'CD=-1',
					'RequiredAddon=0',
				]),
			'MAPSELBIO.INI': [
				section(
					'GDI',
					missions.map(
						(item, i) => `${i + 1}=${item.scenario.slice(0, -4)}`
					)
				),
				...missions.map((item, i) =>
					section(item.scenario.slice(0, -4), [
						`Scenario=${item.scenario}`,
						...(missions[i + 1]
							? [`0=${missions[i + 1]?.scenario.slice(0, -4)}`]
							: []),
					])
				),
			].join('\n'),
			...Object.fromEntries(
				missions.map((item, i) => [
					item.scenario,
					missionINI(item, missions[i + 1]),
				])
			),
		},
	};
}
