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
	readonly briefing: string;
	readonly events: readonly Event[];
	readonly transmissions: readonly Event[];
	readonly scenario: string;
}

// Derive the archive from the same records as the homepage, including its
// publication boundary. Editorial mission prose is fiction; dossiers are not.
export function bioMissions(now = new Date()): BioMission[] {
	const eras = [
		{
			title: 'First contact',
			years: '2009–2014',
			end: 2014,
			briefing:
				'A signal emerges from the early network. Follow the uplinks through the first experiments, games, and security research.',
		},
		{
			title: 'Establishing a signal',
			years: '2015–2018',
			end: 2018,
			briefing:
				'The signal is getting louder. Recover the records of independent research, public disclosures, and recognition.',
		},
		{
			title: 'Across the network',
			years: '2019–2022',
			end: 2022,
			briefing:
				'The archive spans a wider network. Reconnect the research outposts and trace the work into new organisations.',
		},
		{
			title: 'Beyond the perimeter',
			years: '2023–present',
			end: Infinity,
			briefing:
				'The frontier keeps moving. Recover the latest records of writing, security work, and the systems that come next.',
		},
	];
	const events: Event[] = Bio.timeline
		.filter(event => eventHasStarted(event, now))
		.toSorted((a, b) => a.date.getTime() - b.date.getTime());
	return eras.map((era, index) => {
		const records = events.filter(event => {
			const year = event.date.getUTCFullYear();
			return (
				year <= era.end && year > (eras[index - 1]?.end ?? -Infinity)
			);
		});
		// Space the field transmissions across each era, rather than selecting
		// three adjacent records. Every record remains in the mission dossier.
		const transmissions = [
			...new Set([0, Math.floor(records.length / 2), records.length - 1]),
		].flatMap(i => (records[i] ? [records[i]] : []));
		return {
			...era,
			events: records,
			transmissions,
			scenario: `BIO0${index + 1}.INI`,
		};
	});
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
const action = (kind: number, value: number, waypoint = 'A') =>
	`${kind},0,${value},0,0,0,0,${waypoint}`;
const actions = (...values: string[]) => `${values.length},${values.join(',')}`;
const entered = '1,1,0,0';
const uplinks = [
	[34, 28],
	[44, 40],
	[30, 52],
] as const;

export function missionINI(mission: BioMission, next?: BioMission): string {
	const titles = mission.transmissions.map(
		(event, i) =>
			`${100 + i}=${fieldText(
				`ARCHIVE ${i + 1}/3 | ${event.date.getUTCFullYear()}: ${text(event.title)}. ${event.description ? text(event.description) : ''}`
			)}`
	);
	const triggers = [
		'BOOT=GDI,<none>,Mission briefing,0,1,1,1,0',
		'DONE=GDI,<none>,All archives recovered,0,1,1,1,0',
		'LOSE=GDI,<none>,Expedition lost,0,1,1,1,0',
	];
	const tags = [
		'BOOT_TAG=0,Initialise,BOOT',
		'DONE_TAG=0,Complete,DONE',
		'LOSE_TAG=0,Defeat,LOSE',
	];
	const events = [
		'BOOT=1,13,0,1',
		'DONE=3,36,0,0,36,0,1,36,0,2',
		'LOSE=1,11,0,0',
	];
	const initial = [action(11, 99)];
	const orders = [
		`DONE=${actions(action(1, 0))}`,
		`LOSE=${actions(action(2, 0))}`,
	];
	const cellTags: string[] = [];
	const waypoints = ['0=26026'];
	const buildings: string[] = [];
	const terrain: string[] = [];
	uplinks.forEach(([x, y], index) => {
		const id = `ARC${index}`;
		triggers.push(`${id}=GDI,<none>,Archive ${index + 1},0,1,1,1,0`);
		tags.push(`${id}_TAG=0,Archive ${index + 1},${id}`);
		events.push(`${id}=${entered}`);
		orders.push(
			`${id}=${actions(action(11, 100 + index), action(56, index))}`
		);
		waypoints.push(`${index + 1}=${y * 1000 + x}`);
		initial.push(action(17, index + 1));
		// A wide approach around each hut means a normal move order recovers the
		// archive without requiring pixel-perfect clicking on a tagged cell.
		for (let dy = -2; dy <= 2; dy++)
			for (let dx = -2; dx <= 2; dx++)
				cellTags.push(`${(y + dy) * 1000 + x + dx}=${id}_TAG`);
		buildings.push(
			`${index}=Neutral,CABHUT,256,${x},${y},0,None,0,0,1,0,0,None,None,None,0,0`
		);
		for (let offset = 0; offset < 5; offset++)
			terrain.push(
				`${(y + 5) * 1000 + x - 3 + offset}=TREE0${(offset % 3) + 1}`
			);
	});
	orders.push(`BOOT=${actions(...initial)}`);
	return [
		section('Basic', [
			`Name=Bio: ${mission.title}`,
			'NewINIFormat=4',
			'Player=GDI',
			'HomeCell=0',
			'AltHomeCell=0',
			'SkipMapSelect=yes',
			'SkipScore=yes',
			'IgnoreGlobalAITriggers=yes',
			'FreeRadar=yes',
			'TiberiumGrowthEnabled=no',
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
			'TechLevel=1',
			'Credits=0',
			'IQ=0',
			'Allies=Neutral',
			'Color=Gold',
		]),
		section('Neutral', ['Allies=GDI', 'IQ=0']),
		section('Infantry', [
			'0=GDI,ENGINEER,256,26,26,0,Guard,0,None,0,-1,0,1,1',
			'1=GDI,E1,256,27,26,0,Guard,0,None,0,-1,0,1,1',
			'2=GDI,E1,256,26,27,0,Guard,0,None,0,-1,0,1,1',
		]),
		section('Structures', buildings),
		section('Terrain', terrain),
		section('Waypoints', waypoints),
		section('VariableNames', [
			'0=Archive one,0',
			'1=Archive two,0',
			'2=Archive three,0',
		]),
		section('Triggers', triggers),
		section('Tags', tags),
		section('Events', events),
		section('Actions', orders),
		section('CellTags', cellTags),
		section('Tutorial', [
			"99=Select your expedition and move beside each of the three archive huts shown on radar to recover Thomas Shadwell's bio. No enemies. Take your time.",
			...titles,
		]),
		section('Briefing', [
			`1=${fieldText(mission.title + '. ' + mission.briefing)}`,
			'2=OBJECTIVE: Move any expedition member beside each of the three archive huts shown on radar. Recover all three archives to advance.',
			'3=Select units with a drag box. Left-click terrain to move. Escape opens the game menu. The full timeline and links are in the website campaign dossier.',
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
	missions: readonly BioMission[],
	start: number
): GameCampaign {
	const mission = missions[start];
	if (!mission) throw new Error('Unknown bio mission');
	return {
		scenario: mission.scenario,
		files: {
			// The native skip-map-selection path still uses MAPSEL's stage graph.
			// A direct deployment starts at stage zero, so its graph begins there.
			'MAPSEL.INI': [
				section(
					'GDI',
					missions
						.slice(start)
						.map(
							(item, i) =>
								`${i + 1}=${item.scenario.slice(0, -4)}`
						)
				),
				...missions
					.slice(start)
					.map((item, i, remaining) =>
						section(item.scenario.slice(0, -4), [
							`Scenario=${item.scenario}`,
							...(remaining[i + 1]
								? [
										`0=${remaining[i + 1]?.scenario.slice(0, -4)}`,
									]
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
