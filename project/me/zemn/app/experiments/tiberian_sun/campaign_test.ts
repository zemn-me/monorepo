import { describe, expect, it } from '@jest/globals';
import {
	bioMissions,
	createBioCampaign,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/campaign.js';
import { Bio, eventHasStarted } from '#root/project/me/zemn/bio/bio.js';

const now = new Date('2026-10-15T12:00:00Z');
describe('bio campaign', () => {
	it('covers every published timeline record once and keeps future records out', () => {
		const missions = bioMissions(now);
		const records = missions.flatMap(mission => mission.events);
		expect(records.map(event => event.id).toSorted()).toEqual(
			Bio.timeline
				.filter(event => eventHasStarted(event, now))
				.map(event => event.id)
				.toSorted()
		);
		expect(new Set(records.map(event => event.id)).size).toBe(
			records.length
		);
		for (const mission of missions) {
			expect(mission.transmissions).toHaveLength(3);
			for (const event of mission.transmissions)
				expect(mission.events).toContain(event);
		}
		expect(
			bioMissions(new Date('2015-01-01'))
				.slice(1)
				.flatMap(mission => mission.events)
		).toEqual([]);
	});
	it('ships a linked native campaign from any selected mission with three independent recovery objectives', () => {
		const missions = bioMissions(now);
		for (let start = 0; start < missions.length; start++) {
			const campaign = createBioCampaign(missions, start);
			expect(campaign.scenario).toBe(missions[start]?.scenario);
			expect(campaign.files['MAPSEL.INI']).toContain(
				`[GDI]\n1=BIO0${start + 1}`
			);
			for (const [offset, pending] of missions.slice(start).entries()) {
				expect(campaign.files['MAPSEL.INI']).toContain(
					`${offset + 1}=${pending.scenario.slice(0, -4)}`
				);
				expect(campaign.files['MAPSEL.INI']).toContain(
					`Scenario=${pending.scenario}`
				);
			}
			for (const [index, mission] of missions.entries()) {
				const ini = campaign.files[mission.scenario];
				expect(ini).toContain('[Infantry]');
				expect(ini).toContain('Player=GDI');
				expect(ini).toContain('DONE=3,36,0,0,36,0,1,36,0,2');
				for (let archive = 0; archive < 3; archive++) {
					expect(ini).toContain(`ARC${archive}=1,1,0,0`);
					expect(ini).toContain(`56,0,${archive},`);
					expect(ini).toContain(
						`${100 + archive}=ARCHIVE ${archive + 1}/3`
					);
				}
				if (index < missions.length - 1)
					expect(ini).toContain(
						`NextScenario=${missions[index + 1]?.scenario}`
					);
				else expect(ini).toContain('EndOfGame=yes');
			}
		}
		expect(() => createBioCampaign(missions, -1)).toThrow(
			'Unknown bio mission'
		);
	});
});
