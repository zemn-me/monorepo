// SPDX-License-Identifier: GPL-3.0-or-later
/* biome-ignore-all lint/suspicious/noConsole: Console output is the game's diagnostic log. */
// The engine retains its packet protocol; this transports one datagram per message.
export function createPeerTransport(signal: AbortSignal) {
	let peer: RTCPeerConnection | undefined;
	let channel: RTCDataChannel | undefined;
	let generation = 0;
	let incoming: Uint8Array<ArrayBuffer>[] = [];
	let queuedBytes = 0;
	const state = {
		status: 'Create an invitation, or paste an invitation from your opponent.',
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
		queuedBytes = 0;
		Object.assign(state, {
			status: 'Create an invitation, or paste an invitation from your opponent.',
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
			state.status = 'Connected. Continue to the game lobby.';
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
			if (
				token !== generation ||
				!(data instanceof ArrayBuffer) ||
				data.byteLength === 0 ||
				data.byteLength > 1536 ||
				queuedBytes + data.byteLength > limit
			)
				return;
			const bytes = new Uint8Array(data);
			incoming.push(bytes);
			queuedBytes += bytes.length;
		};
	}
	function begin(host: boolean) {
		reset();
		state.host = host;
		state.status = 'Preparing connection code…';
		const token = generation;
		const connection = new RTCPeerConnection({
			iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
		});
		peer = connection;
		connection.onconnectionstatechange = () => {
			if (token !== generation) return;
			if (connection.connectionState === 'failed')
				state.status =
					'Direct connection failed. These networks may require a relay. Cancel and try another network.';
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
		state.status = state.host
			? 'Send your invitation to your opponent, then paste their reply below.'
			: 'Send this reply to the host. Keep this screen open until connected.';
	}
	async function perform(action: 'invite' | 'accept', text: string) {
		if (state.busy) return;
		let token = generation;
		state.busy = true;
		try {
			if (action === 'invite') {
				const started = begin(true);
				token = started.token;
				state.busy = true;
				await started.connection.setLocalDescription(
					await started.connection.createOffer()
				);
				await describe(started.connection, token);
			} else if (action === 'accept') {
				const code = text.trim();
				if (code.length > 65536 || !code.startsWith('OPENTS1:'))
					throw new Error('Paste a complete OpenTS connection code.');
				if (code === state.code)
					throw new Error(
						'That is your code. Paste the code your opponent sent back.'
					);
				const description = decodeDescription(code);
				if (description.type === 'offer') {
					const started = begin(false);
					token = started.token;
					state.busy = true;
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
					if (token === generation && !state.connected)
						state.status = 'Connecting directly to your opponent…';
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
		send(bytes: Uint8Array<ArrayBuffer>) {
			if (
				!state.connected ||
				!channel ||
				channel.bufferedAmount + bytes.length > limit
			)
				return false;
			try {
				channel.send(bytes);
				return true;
			} catch {
				return false;
			}
		},
		receive() {
			const bytes = incoming.shift();
			if (bytes) queuedBytes -= bytes.length;
			return bytes;
		},
	};
}

function decodeDescription(code: string): RTCSessionDescriptionInit {
	let value: unknown;
	try {
		value = JSON.parse(atob(code.slice(8)));
	} catch {
		throw new Error('Invalid connection code.');
	}
	if (
		typeof value !== 'object' ||
		value === null ||
		!('sdp' in value) ||
		typeof value.sdp !== 'string' ||
		!('type' in value) ||
		(value.type !== 'offer' && value.type !== 'answer')
	) {
		throw new Error('Invalid connection description.');
	}
	return { type: value.type, sdp: value.sdp };
}

export type PeerTransport = ReturnType<typeof createPeerTransport>;
