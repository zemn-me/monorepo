import { expect, it } from '@jest/globals';

import { historyRows } from '#root/project/me/zemn/app/minecraft/history_data.js';
import type { MinecraftHistoryEvent } from '#root/project/me/zemn/hook/useZemnMeApi.js';

const event = (
	id: string,
	kind: MinecraftHistoryEvent['kind'],
	player?: string
): MinecraftHistoryEvent => ({
	id,
	kind,
	player,
	timestamp: new Date(Number(id) * 1000).toISOString(),
});

it('charts separate player sessions and server uptime, including abrupt shutdowns', () => {
	const rows = historyRows([
		event('1', 'server_on'),
		event('2', 'login', 'Alex'),
		event('3', 'login', 'Steve'),
		event('4', 'logout', 'Alex'),
		event('5', 'server_off'),
		event('6', 'server_on'),
		event('7', 'login', 'Steve'),
		event('8', 'logout', 'Steve'),
	]);
	expect(rows.map(row => row.name)).toEqual(['Server', 'Alex', 'Steve']);
	expect([...rows[0]!.ends]).toEqual([
		['1', 5000],
		['5', 6000],
	]);
	expect([...rows[1]!.ends]).toEqual([['2', 4000]]);
	expect([...rows[2]!.ends]).toEqual([
		['3', 5000],
		['7', 8000],
	]);
});

it('leaves unknown session boundaries unconnected and preserves every login/logout', () => {
	const rows = historyRows([
		event('1', 'logout', 'Alex'),
		event('2', 'login', 'Alex'),
		event('3', 'login', 'Alex'),
	]);
	expect(rows[1]!.events).toHaveLength(3);
	expect([...rows[1]!.ends]).toEqual([['1', 2000]]);
});

it('keeps a player named Server separate from the server', () => {
	expect(
		historyRows([event('1', 'login', 'Server')]).map(row => row.id)
	).toEqual(['server', 'player:Server']);
});

it('does not end a new server or its players when an older task stops', () => {
	const instanceEvent = (
		id: string,
		kind: MinecraftHistoryEvent['kind'],
		instance: string,
		player?: string
	) => ({ ...event(id, kind, player), instance });
	const rows = historyRows([
		instanceEvent('1', 'server_on', 'old'),
		instanceEvent('2', 'server_on', 'new'),
		instanceEvent('3', 'login', 'new', 'Alex'),
		instanceEvent('4', 'server_off', 'old'),
		instanceEvent('5', 'logout', 'new', 'Alex'),
		instanceEvent('6', 'server_off', 'new'),
	]);
	expect([...rows[0]!.ends]).toEqual([
		['1', 4000],
		['2', 6000],
	]);
	expect([...rows[1]!.ends]).toEqual([['3', 5000]]);
});
