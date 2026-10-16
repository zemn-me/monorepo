import { describe, expect, it } from '@jest/globals';
import {
	bioMissions,
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
					`INTEL${archive}=1,13,0,${5 + archive * Math.min(12, Math.floor(150 / Math.max(1, mission.transmissions.length - 1)))}`
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
		expect(files['BIO01.INI']).toContain('DEADLINE=1,14,0,0');
		expect(files['BIO01.INI']).not.toContain(',GACNST,');
		expect(files['BIO02.INI']).toContain('UPLINK=1,7,0,0');
		expect(files['BIO02.INI']).toContain('DONE=1,14,0,0');
		expect(files['BIO03.INI']).toContain('DONE=1,10,0,1');
		for (const name of ['BIO02.INI', 'BIO03.INI']) {
			expect(files[name]).toContain(',GACNST,');
			expect(files[name]).toContain(',HARV,');
			expect(files[name]).toContain('[OverlayPack]');
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
