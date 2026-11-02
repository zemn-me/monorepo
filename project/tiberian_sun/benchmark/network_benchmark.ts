// SPDX-License-Identifier: GPL-3.0-or-later
import {
	createPeerTransport,
	type PeerTransport,
} from '#root/project/tiberian_sun/web/network.js';

const sleep = (ms: number) =>
	new Promise<void>(resolve => setTimeout(resolve, ms));
async function until(
	ready: () => boolean,
	label: string,
	timeout = 15000,
	pollMs = 1
) {
	const deadline = performance.now() + timeout;
	while (!ready()) {
		if (performance.now() > deadline)
			throw new Error(`Timed out: ${label}`);
		await sleep(pollMs);
	}
}
function percentile(samples: number[], fraction: number) {
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[
		Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
	];
}
function packet(size: number, sequence: number) {
	const bytes = new Uint8Array(size).fill(0xa5);
	new DataView(bytes.buffer).setUint32(0, sequence);
	return bytes;
}
function check(bytes: Uint8Array, size: number) {
	if (bytes.length !== size || bytes.subarray(4).some(byte => byte !== 0xa5))
		throw new Error('Datagram was truncated or corrupted');
	return new DataView(
		bytes.buffer,
		bytes.byteOffset,
		bytes.byteLength
	).getUint32(0);
}
async function latency(
	host: PeerTransport,
	guest: PeerTransport,
	pollMs: number
) {
	const samples: number[] = [];
	for (let i = 0; i < 80; i++) {
		const start = performance.now();
		if (!host.send(packet(64, i))) throw new Error('Ping send blocked');
		let echoed = false;
		await until(
			() => {
				const request = guest.receive();
				if (request) {
					check(request, 64);
					if (!guest.send(request))
						throw new Error('Echo send blocked');
				}
				const reply = host.receive();
				if (!reply) return false;
				if (check(reply, 64) !== i)
					throw new Error('Wrong ping sequence');
				echoed = true;
				return true;
			},
			'ping',
			2000,
			pollMs
		);
		if (echoed) samples.push(performance.now() - start);
		await sleep(pollMs);
	}
	return {
		kind: 'ping',
		packetBytes: 64,
		pollMs,
		samples: samples.length,
		p50Ms: percentile(samples, 0.5),
		p95Ms: percentile(samples, 0.95),
		p99Ms: percentile(samples, 0.99),
	};
}
async function throughput(
	host: PeerTransport,
	guest: PeerTransport,
	size: number
) {
	const count = 2048;
	const seen = [new Set<number>(), new Set<number>()];
	const peers = [host, guest];
	let received = 0;
	let lastArrival = performance.now();
	const start = performance.now();
	function drain() {
		for (const [index, peer] of peers.entries()) {
			let bytes: Uint8Array | undefined;
			while ((bytes = peer.receive())) {
				const sequence = check(bytes, size);
				const sequences = seen[index];
				if (!sequences || sequence >= count || sequences.has(sequence))
					throw new Error('Duplicate or invalid sequence');
				sequences.add(sequence);
				received++;
				lastArrival = performance.now();
			}
		}
	}
	for (let i = 0; i < count; i++) {
		for (const peer of peers)
			if (!peer.send(packet(size, i)))
				throw new Error('Burst send blocked');
		// Keep the real browser event loop and SCTP delivery running during bursts.
		if (i % 32 === 31) {
			await sleep(0);
			drain();
		}
	}
	const deadline = performance.now() + 5000;
	while (received < count * 2 && performance.now() < deadline) {
		await sleep(1);
		drain();
	}
	const elapsedMs = Math.max(1, lastArrival - start);
	return {
		kind: 'bidirectional burst',
		packetBytes: size,
		sentPackets: count * 2,
		receivedPackets: received,
		lossPercent: 100 * (1 - received / (count * 2)),
		elapsedMs,
		packetsPerSecond: (received * 1000) / elapsedMs,
		deliveredMbps: (received * size * 8) / (elapsedMs * 1000),
	};
}

async function checkBacklog(host: PeerTransport, guest: PeerTransport) {
	const initial = guest.diagnostics().receivedPackets;
	const seen = new Set<number>();
	async function send(first: number, count: number) {
		for (let i = first; i < first + count; i++) {
			if (!host.send(packet(64, i)))
				throw new Error('Backlog send blocked');
			if (i % 32 === 31) await sleep(0);
		}
		await until(
			() =>
				guest.diagnostics().receivedPackets === initial + first + count,
			'queued burst'
		);
	}
	function take(count: number) {
		for (let i = 0; i < count; i++) {
			const bytes = guest.receive();
			if (!bytes) throw new Error('Backlog packet missing');
			const sequence = check(bytes, 64);
			if (sequence >= 2560 || seen.has(sequence))
				throw new Error('Backlog duplicate or invalid sequence');
			seen.add(sequence);
		}
	}
	await send(0, 2048);
	take(1500); // Exercise queue compaction while packets remain unread.
	await send(2048, 512);
	take(1060);
	if (
		seen.size !== 2560 ||
		guest.receive() ||
		guest.diagnostics().queuedBytes !== 0
	)
		throw new Error('Backlog did not drain exactly');
}

// Real WebRTC and production signaling/queues; no game assets or fake clock.
export async function run() {
	const lifetime = new AbortController();
	const host = createPeerTransport(lifetime.signal, { iceServers: [] });
	const guest = createPeerTransport(lifetime.signal, { iceServers: [] });
	try {
		await host.perform('invite', '');
		if (!host.state.code) throw new Error(host.state.status);
		await guest.perform('accept', host.state.code);
		if (!guest.state.code) throw new Error(guest.state.status);
		await host.perform('accept', guest.state.code);
		await until(
			() => host.state.connected && guest.state.connected,
			'WebRTC connection'
		);
		await checkBacklog(host, guest);
		const results: unknown[] = [];
		results.push(await latency(host, guest, 1));
		results.push(await latency(host, guest, 16));
		for (const size of [64, 512, 1536])
			results.push(await throughput(host, guest, size));
		return {
			userAgent: navigator.userAgent,
			scope: 'two peers in one browser; real loopback WebRTC, no engine',
			results,
			host: host.diagnostics(),
			guest: guest.diagnostics(),
		};
	} finally {
		lifetime.abort();
	}
}
