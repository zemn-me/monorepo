import type { MinecraftHistoryEvent } from '#root/project/me/zemn/hook/useZemnMeApi.js';

export function historyRows(events: readonly MinecraftHistoryEvent[]) {
	const rows = new Map<
		string,
		{
			id: string;
			name: string;
			events: MinecraftHistoryEvent[];
			ends: Map<string, number>;
		}
	>();
	rows.set('server', {
		id: 'server',
		name: 'Server',
		events: [],
		ends: new Map(),
	});
	// Deployments can overlap, including sessions for the same player.
	const playersByInstance = new Map<
		string,
		Map<string, MinecraftHistoryEvent>
	>();
	const servers = new Map<string, MinecraftHistoryEvent>();
	let offline: MinecraftHistoryEvent | undefined;
	for (const event of events) {
		const id = event.player ? `player:${event.player}` : 'server';
		let row = rows.get(id);
		if (!row) {
			row = {
				id,
				name: event.player ?? 'Server',
				events: [],
				ends: new Map(),
			};
			rows.set(id, row);
		}
		const at = Date.parse(event.timestamp);
		const instance = event.instance ?? 'legacy';
		if (event.player) {
			let players = playersByInstance.get(instance);
			if (!players) {
				players = new Map();
				playersByInstance.set(instance, players);
			}
			const previous = players.get(id);
			if (
				previous &&
				(previous.kind !== 'login' || event.kind === 'logout')
			) {
				// A second login without a logout does not prove an uninterrupted session.
				if (!row.ends.has(previous.id)) row.ends.set(previous.id, at);
			}
			players.set(id, event);
		}
		row.events.push(event);
		if (event.kind === 'server_on') {
			if (offline && servers.size === 0) row.ends.set(offline.id, at);
			offline = undefined;
			const running = servers.get(instance);
			if (running) row.ends.set(running.id, at);
			servers.set(instance, event);
		}
		if (event.kind === 'server_off') {
			const running = servers.get(instance);
			if (running) row.ends.set(running.id, at);
			servers.delete(instance);
			if (servers.size === 0) {
				if (offline) row.ends.set(offline.id, at);
				offline = event;
			}
			for (const [playerID, activity] of playersByInstance.get(instance) ?? []) {
				const playerRow = rows.get(playerID);
				if (activity.kind === 'login' && !playerRow?.ends.has(activity.id)) {
					playerRow?.ends.set(activity.id, at);
				}
			}
		}
	}
	return [...rows.values()].sort((a, b) =>
		a.id === 'server'
			? -1
			: b.id === 'server'
				? 1
				: a.name.localeCompare(b.name)
	);
}
