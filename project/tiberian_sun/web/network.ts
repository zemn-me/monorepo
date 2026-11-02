// SPDX-License-Identifier: GPL-3.0-or-later
/* biome-ignore-all lint/suspicious/noConsole: Console output is the game's diagnostic log. */
// The engine retains its packet protocol; this transports one datagram per message.
export function createPeerTransport(
	signal: AbortSignal,
	configuration: RTCConfiguration = {
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
	}
) {
	let peer: RTCPeerConnection | undefined;
	let channel: RTCDataChannel | undefined;
	let generation = 0;
	let incoming: { bytes: Uint8Array<ArrayBuffer>; arrived: number }[] = [];
	let head = 0;
	const counters = () => ({
		sentPackets: 0,
		sentBytes: 0,
		receivedPackets: 0,
		receivedBytes: 0,
		deliveredPackets: 0,
		droppedPackets: 0,
		blockedSends: 0,
		peakQueuedBytes: 0,
		maxQueueDelayMs: 0,
	});
	let metrics = counters();
	let previousReport: { frame: number; time: number } | undefined;
	let queuedBytes = 0;
	const state = {
		status: '',
		step: 'choose',
		code: '',
		connected: false,
		host: false,
		busy: false,
		pasted: '',
		active: false,
	};
	const limit = 4 * 1024 * 1024;
	function reset() {
		generation++;
		if (peer) peer.close();
		peer = channel = undefined;
		incoming = [];
		head = 0;
		queuedBytes = 0;
		metrics = counters();
		previousReport = undefined;
		Object.assign(state, {
			status: '',
			step: 'choose',
			code: '',
			connected: false,
			host: false,
			busy: false,
			pasted: '',
		});
	}
	signal.addEventListener('abort', reset, { once: true });
	document.addEventListener(
		'paste',
		event => {
			if (!state.active) return;
			const text = event.clipboardData?.getData('text/plain');
			if (text && text.length <= 65536) {
				state.pasted = text;
				event.preventDefault();
			}
		},
		{ signal }
	);
	function attach(next: RTCDataChannel, token: number) {
		channel = next;
		next.binaryType = 'arraybuffer';
		next.onopen = () => {
			if (token !== generation) return;
			state.connected = true;
			state.step = 'connected';
			state.status = 'Your opponent is connected.';
			console.info('WebRTC game channel connected');
		};
		next.onclose = () => {
			if (token !== generation) return;
			state.connected = false;
			state.status =
				'Opponent disconnected. Return to Internet to reconnect.';
			console.info('WebRTC game channel disconnected');
		};
		next.onmessage = event => {
			const data: unknown = event.data;
			if (token !== generation) return;
			if (
				!(data instanceof ArrayBuffer) ||
				data.byteLength === 0 ||
				data.byteLength > 1536 ||
				queuedBytes + data.byteLength > limit
			) {
				metrics.droppedPackets++;
				return;
			}
			const bytes = new Uint8Array(data);
			incoming.push({ bytes, arrived: performance.now() });
			queuedBytes += bytes.length;
			metrics.receivedPackets++;
			metrics.receivedBytes += bytes.length;
			metrics.peakQueuedBytes = Math.max(
				metrics.peakQueuedBytes,
				queuedBytes
			);
		};
	}
	function begin(host: boolean) {
		reset();
		state.host = host;
		state.status = 'Preparing your code…';
		const token = generation;
		const connection = new RTCPeerConnection(configuration);
		peer = connection;
		connection.onconnectionstatechange = () => {
			if (token !== generation) return;
			if (connection.connectionState === 'failed')
				state.status =
					'Could not connect on these networks. Cancel and try another network.';
		};
		if (host)
			attach(
				connection.createDataChannel('opents-v1', {
					ordered: false,
					maxRetransmits: 0,
				}),
				token
			);
		else
			connection.ondatachannel = event => {
				if (
					token === generation &&
					event.channel.label === 'opents-v1' &&
					!channel
				)
					attach(event.channel, token);
				else event.channel.close();
			};
		return { connection, token };
	}
	async function describe(connection: RTCPeerConnection, token: number) {
		// Gather candidates into the copied SDP so no signaling service is needed.
		if (connection.iceGatheringState !== 'complete') {
			await new Promise<void>((resolve, reject) => {
				const changed = () => {
					if (connection.iceGatheringState === 'complete') finish();
				};
				const closed = () => {
					if (connection.signalingState === 'closed')
						finish(new Error('Connection cancelled.'));
				};
				function finish(error?: Error) {
					connection.removeEventListener(
						'icegatheringstatechange',
						changed
					);
					connection.removeEventListener(
						'signalingstatechange',
						closed
					);
					if (error) reject(error);
					else resolve();
				}
				connection.addEventListener('icegatheringstatechange', changed);
				connection.addEventListener('signalingstatechange', closed);
				changed();
			});
		}
		if (token !== generation) return;
		state.code =
			'OPENTS1:' + btoa(JSON.stringify(connection.localDescription));
		if (!state.connected)
			state.step = state.host ? 'host-share' : 'guest-share';
		state.status = state.connected ? 'Your opponent is connected.' : '';
	}
	async function perform(
		action: 'invite' | 'join' | 'next' | 'back' | 'restart' | 'accept',
		text: string
	) {
		if (state.busy) return;
		if (action === 'restart') {
			reset();
			return;
		}
		if (action === 'join') {
			reset();
			state.step = 'guest-invite';
			state.status = '';
			return;
		}
		if (action === 'next' && state.step === 'host-share' && state.code) {
			state.step = 'host-reply';
			state.status = '';
			return;
		}
		if (action === 'back' && state.step === 'host-reply') {
			state.step = 'host-share';
			state.status = '';
			return;
		}
		let token = generation;
		state.busy = true;
		try {
			if (action === 'invite') {
				const started = begin(true);
				token = started.token;
				state.busy = true;
				state.step = 'host-share';
				await started.connection.setLocalDescription(
					await started.connection.createOffer()
				);
				await describe(started.connection, token);
			} else if (action === 'accept') {
				const code = text.trim();
				if (code.length > 65536 || !code.startsWith('OPENTS1:'))
					throw new Error(
						state.host
							? 'Paste the complete reply code your opponent sent you.'
							: 'Paste the complete invitation code from the host.'
					);
				if (code === state.code)
					throw new Error(
						'That is your code. Paste the code your opponent sent back.'
					);
				const description = decodeDescription(code);
				if (state.host && description.type !== 'answer')
					throw new Error(
						'That is an invitation. Ask your opponent for their reply code.'
					);
				if (!state.host && description.type !== 'offer')
					throw new Error(
						'That is a reply. Ask the host for an invitation code.'
					);
				if (description.type === 'offer') {
					const started = begin(false);
					token = started.token;
					state.busy = true;
					state.step = 'guest-invite';
					await started.connection.setRemoteDescription(description);
					await started.connection.setLocalDescription(
						await started.connection.createAnswer()
					);
					await describe(started.connection, token);
				} else {
					if (
						!peer ||
						!state.host ||
						peer.signalingState !== 'have-local-offer'
					)
						throw new Error(
							'Create an invitation before accepting a reply.'
						);
					await peer.setRemoteDescription(description);
					if (token === generation && !state.connected) {
						state.step = 'connecting';
						state.status = 'Connecting to your opponent…';
					}
				}
			}
		} catch (error) {
			if (token === generation)
				state.status =
					error instanceof Error ? error.message : String(error);
		} finally {
			if (token === generation) state.busy = false;
		}
	}
	return {
		state,
		perform,
		reset,
		diagnostics() {
			return {
				...metrics,
				queuedBytes,
				bufferedBytes: channel?.bufferedAmount ?? 0,
			};
		},
		async report(
			frame: number,
			targetFps: number,
			frameSendRate: number,
			maxAhead: number
		) {
			const now = performance.now();
			const previous = previousReport;
			previousReport = { frame, time: now };
			const snapshot = this.diagnostics();
			const connection = peer;
			const token = generation;
			let path: { local?: string; remote?: string; rttMs?: number } = {};
			try {
				const stats = await connection?.getStats();
				stats?.forEach(entry => {
					if (
						entry.type !== 'transport' ||
						!entry.selectedCandidatePairId
					)
						return;
					const pair = stats.get(entry.selectedCandidatePairId);
					if (!pair) return;
					path = {
						local: stats.get(pair.localCandidateId)?.candidateType,
						remote: stats.get(pair.remoteCandidateId)
							?.candidateType,
						rttMs:
							pair.currentRoundTripTime === undefined
								? undefined
								: pair.currentRoundTripTime * 1000,
					};
				});
			} catch {
				/* A disconnect can race a diagnostic sample. */
			}
			if (token !== generation) return;
			console.info(
				'Multiplayer performance ' +
					JSON.stringify({
						frame,
						targetFps,
						frameSendRate,
						maxAhead,
						intervalMs: previous ? now - previous.time : undefined,
						fps:
							previous && frame > previous.frame
								? ((frame - previous.frame) * 1000) /
									(now - previous.time)
								: undefined,
						...snapshot,
						path,
					})
			);
		},
		send(bytes: Uint8Array<ArrayBuffer>) {
			if (
				!state.connected ||
				!channel ||
				channel.bufferedAmount + bytes.length > limit
			) {
				metrics.blockedSends++;
				return false;
			}
			try {
				channel.send(bytes);
				metrics.sentPackets++;
				metrics.sentBytes += bytes.length;
				return true;
			} catch {
				metrics.blockedSends++;
				return false;
			}
		},
		receive() {
			const packet = incoming[head];
			if (!packet) return;
			head++;
			queuedBytes -= packet.bytes.length;
			metrics.deliveredPackets++;
			metrics.maxQueueDelayMs = Math.max(
				metrics.maxQueueDelayMs,
				performance.now() - packet.arrived
			);
			// Avoid moving the whole queue for every datagram during a burst.
			if (head === incoming.length) {
				incoming = [];
				head = 0;
			} else if (head >= 1024 && head * 2 >= incoming.length) {
				incoming = incoming.slice(head);
				head = 0;
			}
			return packet.bytes;
		},
	};
}

function decodeDescription(code: string): RTCSessionDescriptionInit {
	let value: unknown;
	try {
		value = JSON.parse(atob(code.slice(8)));
	} catch {
		throw new Error(
			'This code is incomplete or invalid. Ask your opponent to copy it again.'
		);
	}
	if (
		typeof value !== 'object' ||
		value === null ||
		!('sdp' in value) ||
		typeof value.sdp !== 'string' ||
		!('type' in value) ||
		(value.type !== 'offer' && value.type !== 'answer')
	) {
		throw new Error('This is not an invitation or reply code.');
	}
	return { type: value.type, sdp: value.sdp };
}

export type PeerTransport = ReturnType<typeof createPeerTransport>;
