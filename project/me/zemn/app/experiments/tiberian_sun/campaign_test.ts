import { describe, expect, it } from '@jest/globals';
import {
	bioMissions,
	campaignTerrain,
	createBioCampaign,
	overlayPack,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/campaign.js';
import { Bio, eventHasStarted } from '#root/project/me/zemn/bio/bio.js';
import { text } from '#root/ts/react/lang/index.js';

const now = new Date('2026-10-15T12:00:00Z');
describe('native bio campaign', () => {
	it('turns every published entry into an in-game archive exactly once', () => {
		const missions = bioMissions(now);
		const records = missions.flatMap(mission => mission.transmissions);
		expect(records.map(event => event.id)).toEqual(
			Bio.timeline
				.filter(event => eventHasStarted(event, now))
				.toSorted((a, b) => a.date.getTime() - b.date.getTime())
				.map(event => event.id)
		);
		expect(new Set(records.map(event => event.id)).size).toBe(
			records.length
		);
		const files = createBioCampaign(missions).files;
		for (const [index, mission] of missions.entries()) {
			const ini = files[mission.scenario];
			expect(mission.events.length).toBeGreaterThan(0);
			expect(missions.length).toBeLessThanOrEqual(6);
			expect(ini).toContain('WAVE0=2,13,0,');
			const briefing = ini
				?.split('[Briefing]\n')[1]
				?.split('\n\n')[0]
				?.split('\n')
				.filter(Boolean)
				.map(line => line.slice(line.indexOf('=') + 1))
				.join(' ');
			expect(briefing?.length).toBeLessThan(1024);
			for (const [archive, event] of mission.events.entries()) {
				expect(ini).toContain(
					`INTEL${archive}=1,13,0,${8 + Math.floor(archive / 3) * 10}`
				);
				expect(ini).toContain(
					`${100 + archive}=${event.date.toISOString().slice(0, 10)}`
				);
				expect(ini).toContain(event.date.toISOString().slice(0, 10));
				// Plain ASCII titles survive verbatim in the native briefing.
				if (/^[a-zA-Z0-9 .,:()-]+$/.test(text(event.title)))
					expect(ini).toContain(text(event.title));
			}
			if (index < missions.length - 1)
				expect(ini).toContain(
					`NextScenario=${missions[index + 1]?.scenario}`
				);
			else expect(ini).toContain('EndOfGame=yes');
		}
	});
	it('adds one campaign without replacing the original battle or map-selection files', () => {
		const missions = bioMissions(now);
		const { files } = createBioCampaign(missions);
		expect(files['BATTLEWEB.INI']).toContain('[Battles]\n0=BIO');
		expect(files['BATTLEWEB.INI']).toContain('Scenario=BIO01.INI');
		expect(files).not.toHaveProperty('BATTLE.INI');
		expect(files).not.toHaveProperty('MAPSEL.INI');
		expect(files).not.toHaveProperty('SPAWN.INI');
		for (const [i, mission] of missions.entries()) {
			expect(files['MAPSELBIO.INI']).toContain(
				`${i + 1}=${mission.scenario.slice(0, -4)}`
			);
			expect(files['MAPSELBIO.INI']).toContain(
				`Scenario=${mission.scenario}`
			);
		}
	});
	it('changes the tactical objective and economy between operations', () => {
		const missions = bioMissions(now);
		expect(missions.map(mission => mission.operation)).toEqual([
			'raid',
			'defend',
			'siege',
			'raid',
			'defend',
			'siege',
		]);
		const files = createBioCampaign(missions).files;
		expect(files['BIO01.INI']).toContain('DONE=2,36,0,0,36,0,2');
		expect(files['BIO01.INI']).toContain('RESCUE=1,1,0,0');
		expect(files['BIO01.INI']).toContain('0=4,CIV1');
		expect(files['BIO01.INI']).not.toContain(',GACNST,');
		expect(files['BIO02.INI']).toContain('UPLINK=1,7,0,0');
		expect(files['BIO02.INI']).toContain('DONE=2,14,0,0,36,0,1');
		expect(files['BIO03.INI']).toContain('TRAINHOME=1,34,0,7');
		expect(files['BIO03.INI']).toContain('TRAINLOST=1,48,0,0');
		expect(files['BIO06.INI']).toContain('DONE=3,36,0,0,36,0,1,36,0,2');
		expect(files['BIO04.INI']).toContain(',DOGGIE,');
		expect(files['BIO04.INI']).toContain(',VISC_SML,');
		for (const mission of missions) {
			expect(files[mission.scenario]).toContain('[IsoMapPack3]');
			expect(files[mission.scenario]).toContain('=TIBTRE01');
			expect(files[mission.scenario]).toContain(',GALITE,');
		}
		for (const name of ['BIO02.INI', 'BIO03.INI']) {
			expect(files[name]).toContain(',GACNST,');
			expect(files[name]).toContain(',HARV,');
			expect(files[name]).toContain('[OverlayPack]');
		}
	});
	it('keeps existing chapters stable as new bio entries are published', () => {
		const historical = bioMissions(new Date('2024-12-31T23:59:59Z'));
		const current = bioMissions(now);
		expect(historical).toHaveLength(5);
		expect(current.slice(0, 5)).toEqual(historical);
		expect(
			current[0]?.events.some(event =>
				text(event.title).includes('Grove Hotel')
			)
		).toBe(true);
		expect(
			current[2]?.events.some(event =>
				text(event.title).includes('Steam Remote Code')
			)
		).toBe(true);
		expect(
			current[3]?.events.some(event =>
				text(event.title).includes('Relocated to San Francisco')
			)
		).toBe(true);
	});
	it('keeps player buildings and objectives within the native playable diamond', () => {
		for (const ini of Object.values(
			createBioCampaign(bioMissions(now)).files
		)) {
			const structures =
				ini.split('[Structures]\n')[1]?.split('\n\n')[0] ?? '';
			for (const line of structures.trim().split('\n').filter(Boolean)) {
				const fields = line.slice(line.indexOf('=') + 1).split(',');
				if (fields[0] !== 'GDI' && fields[6] === 'None') continue;
				const x = Number(fields[3]),
					y = Number(fields[4]);
				expect(x + y).toBeGreaterThan(48);
				expect(x + y).toBeLessThanOrEqual(114);
				expect(Math.abs(x - y)).toBeLessThan(36);
			}
		}
	});
	it('connects every mission objective across real height changes', () => {
		for (const mission of bioMissions(now)) {
			const terrain = campaignTerrain(mission.act);
			const start = terrain.get('26,26');
			expect(start?.height).toBe(0);
			expect([...terrain.values()].some(cell => cell.height === 4)).toBe(
				true
			);
			expect([...terrain.values()].some(cell => cell.ramp !== 0)).toBe(
				true
			);
			const reached = new Set(['26,26']);
			const queue = [start!];
			for (let i = 0; i < queue.length; i++) {
				const cell = queue[i]!;
				for (const [dx, dy] of [
					[0, 1],
					[1, 0],
					[0, -1],
					[-1, 0],
				]) {
					const key = `${cell.x + dx!},${cell.y + dy!}`;
					const next = terrain.get(key);
					if (
						!next ||
						next.x + next.y <= 48 ||
						next.x + next.y > 114 ||
						Math.abs(next.x - next.y) >= 36 ||
						next.blocked ||
						reached.has(key) ||
						Math.abs(cell.height - next.height) > 1
					)
						continue;
					reached.add(key);
					queue.push(next);
				}
			}
			for (const key of [
				'22,27',
				'30,40',
				'42,31',
				mission.act === 3 ? '44,36' : '44,40',
				'18,34',
				'42,44',
			])
				expect(reached.has(key)).toBe(true);
			const ini = createBioCampaign([mission]).files[mission.scenario]!;
			const structures = ini
				.split('[Structures]\n')[1]!
				.split('\n\n')[0]!;
			for (const line of structures.trim().split('\n')) {
				const fields = line.slice(line.indexOf('=') + 1).split(',');
				const x = Number(fields[3]),
					y = Number(fields[4]);
				// Native foundations must stay level across their entire footprint.
				const foundations: Record<string, readonly [number, number]> = {
					GACNST: [3, 3],
					GAPOWR: [2, 2],
					NAPOWR: [2, 2],
					GAWEAP: [4, 3],
					GAPILE: [2, 2],
					GARADR: [2, 2],
					NARADR: [2, 2],
					CA0007: [1, 2],
					CITY02: [2, 3],
				};
				const [width, depth] = foundations[fields[1]!] ?? [1, 1];
				const height = terrain.get(`${x},${y}`)?.height;
				for (let dy = 0; dy < depth; dy++)
					for (let dx = 0; dx < width; dx++) {
						const ground = terrain.get(`${x + dx},${y + dy}`);
						expect({
							type: fields[1],
							blocked: ground?.blocked,
							ramp: ground?.ramp,
							height: ground?.height,
						}).toEqual({
							type: fields[1],
							blocked: false,
							ramp: 0,
							height,
						});
					}
			}
			if (mission.act === 3) {
				for (let x = 15; x <= 55; x++) {
					const rail = terrain.get(`${x},43`);
					expect(rail?.height).toBe(0);
					expect(rail?.ramp).toBe(0);
					expect(rail?.blocked).toBe(false);
				}
			} else {
				const wall = mission.operation === 'defend' ? '20,36' : '37,40';
				expect(terrain.get(wall)?.blocked).toBe(true);
				expect(reached.has(wall)).toBe(false);
			}
		}
	});
	it('encodes resource cells in bounded native Format80 blocks', () => {
		const original = new Uint8Array(512 * 512).fill(255);
		original.fill(105, 8190, 8200);
		const encoded = overlayPack(original)
			.map(line => line.slice(line.indexOf('=') + 1))
			.join('');
		const bytes = Uint8Array.from(atob(encoded), char =>
			char.charCodeAt(0)
		);
		const decoded: number[] = [];
		for (let cursor = 0; cursor < bytes.length; ) {
			const compressed =
				(bytes[cursor] ?? 0) | ((bytes[cursor + 1] ?? 0) << 8);
			const expanded =
				(bytes[cursor + 2] ?? 0) | ((bytes[cursor + 3] ?? 0) << 8);
			cursor += 4;
			const end = cursor + compressed;
			const start = decoded.length;
			while (cursor < end - 1) {
				expect(bytes[cursor]).toBe(0xfe);
				const count =
					(bytes[cursor + 1] ?? 0) | ((bytes[cursor + 2] ?? 0) << 8);
				decoded.push(
					...Array<number>(count).fill(bytes[cursor + 3] ?? 0)
				);
				cursor += 4;
			}
			expect(bytes[cursor++]).toBe(0x80);
			expect(decoded.length - start).toBe(expanded);
			expect(expanded).toBeLessThanOrEqual(8192);
		}
		expect(Uint8Array.from(decoded)).toEqual(original);
	});
	it('excludes future records and completes a partial final mission', () => {
		const missions = bioMissions(new Date('2009-12-31T23:59:59Z'));
		expect(missions).toHaveLength(1);
		expect(missions[0]?.events).toHaveLength(1);
		const ini = createBioCampaign(missions).files['BIO01.INI'];
		expect(ini).toContain('RELAY=1,7,0,0');
		expect(ini).not.toContain('INTEL1=');
		expect(ini).toContain('EndOfGame=yes');
	});
});
