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

// Derive the archive from the same records as the homepage, including its
// publication boundary. Editorial mission prose is fiction; dossiers are not.
export function bioMissions(now = new Date()): BioMission[] {
	const events: Event[] = Bio.timeline
		.filter(event => eventHasStarted(event, now))
		.toSorted((a, b) => a.date.getTime() - b.date.getTime());
	// Six acts keep the timeline a campaign rather than one fetch quest per entry.
	// New records join their chronological act automatically.
	const size = Math.max(1, Math.ceil(events.length / 6));
	const operations = ['raid', 'defend', 'siege'] as const;
	const names = [
		'Root Access',
		'Hack Fortress',
		'Privilege Escalation',
		'Lateral Movement',
		'Zero Trust',
		'Full Disclosure',
	];
	return Array.from(
		{ length: Math.ceil(events.length / size) },
		(_, index) => {
			const records = events.slice(index * size, (index + 1) * size);
			const years = `${records[0]?.date.getUTCFullYear()}–${records.at(-1)?.date.getUTCFullYear()}`;
			const operation = operations[index % operations.length] ?? 'raid';
			return {
				title: `${names[index]}: ${years}`,
				years,
				act: index + 1,
				operation,
				briefing:
					operation === 'raid'
						? 'A stolen biography is being rewritten by Nod. Break in and destroy their relay. The power plant is an optional target: knock it out to silence the lasers and unlock reinforcements.'
						: operation === 'defend'
							? 'Hold the uplink for three minutes while the timeline uploads. Spend your starting funds on troops or defenses. Enemy waves alternate approaches. Destroy their forward relay to stop reinforcements.'
							: 'Build an army and wipe out the Nod installation. Harvest the nearby Tiberium to fund your attack. Destroy the power plant to open the defended entrance, or flank through the woods.',
				events: records,
				transmissions: records,
				scenario: `BIO${String(index + 1).padStart(2, '0')}.INI`,
			};
		}
	);
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
		`${event.date.toISOString().slice(0, 10)}: ${text(event.title)}. ${event.description ? text(event.description) : ''}`
	);
}
const action = (kind: number, value: number, waypoint = 'A') =>
	`${kind},0,${value},0,0,0,0,${waypoint}`;
const actions = (...values: string[]) => `${values.length},${values.join(',')}`;
const teamAction = (team: string) =>
	`80,1,${team},0,0,0,0,${team === 'SUPPORT' ? 'F' : team === 'EAST' ? 'D' : 'E'}`;

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
	const encoded = btoa(String.fromCharCode(...bytes));
	return (encoded.match(/.{1,70}/g) ?? []).map(
		(line, i) => `${i + 1}=${line}`
	);
}

export function missionINI(mission: BioMission, next?: BioMission): string {
	const raid = mission.operation === 'raid';
	const defense = mission.operation === 'defend';
	// Rotate subsequent battlefields around the diamond map's center. Each
	// act changes the approach and the radar view as well as the objective.
	const position = (x: number, y: number): readonly [number, number] => {
		switch ((mission.act - 1) % 4) {
			case 1:
				return [y, 80 - x];
			case 2:
				return [80 - x, 80 - y];
			case 3:
				return [80 - y, x];
			default:
				return [x, y];
		}
	};
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
		house = 'GDI'
	) => {
		triggers.push(`${id}=${house},<none>,${id},0,1,1,1,0`);
		tags.push(`${id}_TAG=0,${id},${id}`);
		events.push(`${id}=${condition}`);
		orders.push(`${id}=${actions(...commands)}`);
	};
	addTrigger('BOOT', '1,13,0,1', [
		action(11, 99),
		action(17, 1),
		action(17, 2),
		...(raid || defense ? [action(27, defense ? 180 : 300)] : []),
	]);
	addTrigger('LOSE', '1,11,0,0', [action(2, 0)]);
	addTrigger('POWER', '1,7,0,0', [action(11, 90), teamAction('SUPPORT')]);
	addTrigger('RELAY', '1,7,0,0', [
		action(56, 0),
		action(11, 91),
		...(raid ? [action(1, 0)] : []),
	]);
	if (defense) {
		addTrigger('UPLINK', '1,7,0,0', [action(2, 0)]);
		addTrigger('DONE', '1,14,0,0', [action(1, 0)]);
	} else if (raid) addTrigger('DEADLINE', '1,14,0,0', [action(2, 0)]);
	else addTrigger('DONE', '1,10,0,1', [action(1, 0)]);
	// Full dated bio records arrive during play; they never fill the native
	// briefing's fixed 1024-byte buffer or force players through reading screens.
	const intelInterval = Math.min(
		12,
		Math.max(
			1,
			Math.floor(150 / Math.max(1, mission.transmissions.length - 1))
		)
	);
	mission.transmissions.forEach((_, i) =>
		addTrigger(`INTEL${i}`, `1,13,0,${5 + i * intelInterval}`, [
			action(11, 100 + i),
		])
	);
	const waves = defense ? [20, 50, 80, 110, 140, 165] : [45, 90, 150, 210];
	waves.forEach((time, i) =>
		addTrigger(`WAVE${i}`, `2,13,0,${time},37,0,0`, [
			action(11, i % 2 ? 93 : 92),
			teamAction(i % 2 ? 'WEST' : 'EAST'),
		])
	);
	const structures: string[] = [];
	const units: string[] = [];
	const infantry: string[] = [];
	const building = (
		owner: string,
		type: string,
		x: number,
		y: number,
		tag = 'None'
	) =>
		structures.push(
			`${structures.length}=${owner},${type},256,${position(x, y).join(',')},0,${tag},1,0,1,${type === 'GACTWR' ? 1 : 0},0,${type === 'GACTWR' ? 'GAVULC' : 'None'},None,None,0,0`
		);
	const unit = (
		owner: string,
		type: string,
		x: number,
		y: number,
		order = 'Guard'
	) =>
		units.push(
			`${units.length}=${owner},${type},256,${position(x, y).join(',')},0,${order},None,0,-1,0,-1,1,1`
		);
	const soldier = (
		owner: string,
		type: string,
		x: number,
		y: number,
		order = 'Guard'
	) =>
		infantry.push(
			`${infantry.length}=${owner},${type},256,${position(x, y).join(',')},0,${order},0,None,0,-1,0,1,1`
		);
	building('Nod', 'NAPOWR', 34, 28, 'POWER_TAG');
	building('Nod', 'NARADR', 44, 40, 'RELAY_TAG');
	building('Nod', 'NALASR', 39, 35);
	building('Nod', 'NALASR', 43, 35);
	if (!raid) {
		building('Nod', 'NAHAND', 46, 43);
		building('GDI', 'GACNST', 23, 24);
		building('GDI', 'GAPOWR', 22, 29);
		building('GDI', 'GAPOWR', 18, 28);
		building('GDI', 'GAPILE', 27, 29);
		building('GDI', 'PROC', 22, 34);
		building('GDI', 'GAWEAP', 29, 34);
		building('GDI', 'GARADR', 18, 34, defense ? 'UPLINK_TAG' : 'None');
		unit('GDI', 'HARV', 26, 36, 'Harvest');
		building('GDI', 'GACTWR', 32, 29);
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
	const terrain: string[] = [];
	for (let y = 31; y < 44; y++) {
		if (y === 36 || y === 37) continue;
		terrain.push(`${cell(35, y)}=TREE0${(y % 3) + 1}`);
		if (y % 2) terrain.push(`${cell(36, y)}=TREE02`);
	}
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
				if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
					const [a, b] = position(x, y);
					overlays[b * 512 + a] = 105; // Engine OVERLAY_TIBERIUM01 (green Tiberium).
					density[b * 512 + a] = 11;
				}
	}
	const teams = ['EAST', 'WEST', 'SUPPORT'];
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
		section('Houses', ['0=GDI', '1=Nod', '2=Neutral', '3=Special']),
		section('GDI', [
			'PlayerControl=yes',
			'TechLevel=7',
			`Credits=${raid ? 0 : 80}`,
			'IQ=0',
			'Allies=Neutral',
			'Color=Gold',
		]),
		section('Nod', ['TechLevel=7', 'Credits=0', 'IQ=0', 'Color=DarkRed']),
		section('Neutral', ['Allies=GDI', 'IQ=0']),
		section('General', ['MessageDelay=0.12']),
		section('NAPOWR', ['Power=500']),
		section('NALASR', ['Powered=yes']),
		section('Structures', structures),
		section('Units', units),
		section('Infantry', infantry),
		section('Terrain', terrain),
		section('OverlayPack', overlayPack(overlays)),
		section('OverlayDataPack', overlayPack(density)),
		section(
			'Waypoints',
			[
				[26, 26],
				[34, 28],
				[44, 40],
				[52, 29],
				[24, 48],
				[23, 24],
			].map(([x, y], i) => `${i}=${cell(x ?? 0, y ?? 0)}`)
		),
		section('VariableNames', ['0=Enemy relay destroyed,0']),
		section('TaskForces', ['0=RAIDERS', '1=ARMOR', '2=BACKUP']),
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
		section('ScriptTypes', ['0=ASSAULT', '1=ARRIVE']),
		section('ASSAULT', ['Name=Assault player base', '0=0,1']),
		section('ARRIVE', ['Name=Player reinforcements', '0=3,0', '1=5,2']),
		section(
			'TeamTypes',
			teams.map((id, i) => `${i}=${id}`)
		),
		...teams.map((id, i) =>
			section(id, [
				`Name=${id}`,
				`House=${i === 2 ? 'GDI' : 'Nod'}`,
				`TaskForce=${['RAIDERS', 'ARMOR', 'BACKUP'][i]}`,
				`Script=${i === 2 ? 'ARRIVE' : 'ASSAULT'}`,
				`Waypoint=${['D', 'E', 'F'][i]}`,
				'Max=10',
				'Full=yes',
				'Autocreate=no',
				'Recruiter=no',
				'VeteranLevel=1',
				'Aggressive=yes',
			])
		),
		section('Triggers', triggers),
		section('Tags', tags),
		section('Events', events),
		section('Actions', orders),
		section('Tutorial', [
			`99=${raid ? 'Destroy the southern Nod relay before the five-minute purge. Optional: destroy the eastern power plant for a blackout and two Titans.' : defense ? 'Protect your radar uplink for three minutes. Build troops and defenses now. Kill the enemy relay to stop the waves.' : 'Destroy every Nod building. Build, harvest, and expand. The eastern power plant supplies the laser defenses.'}`,
			'90=POWER BREACHED. Two Titans inbound. Push through the defenses!',
			'91=RELAY DESTROYED. Enemy reinforcement channel severed.',
			'92=CONTACT: infantry approaching from the east!',
			'93=CONTACT: armor approaching from the west!',
			...mission.transmissions.map(
				(event, i) => `${100 + i}=${recordText(event)}`
			),
		]),
		section('Briefing', [
			`1=${fieldText(mission.title)}`,
			`2=${fieldText(mission.briefing)}`,
			'3=Drag-select troops. Left-click to move or attack. Use the radar to scout. Right-click cancels selection. Escape opens this briefing.',
			`4=Timeline: ${mission.events.length} dated transmissions, beginning with ${fieldText(mission.events[0] ? text(mission.events[0].title) : '')}. Combat operations are fiction: the intercepted bio records are real.`,
		]),
		section('Lighting', [
			'Ambient=0.85',
			'Red=0.92',
			'Green=1.0',
			'Blue=0.87',
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
