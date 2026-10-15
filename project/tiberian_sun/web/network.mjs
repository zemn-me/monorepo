// SPDX-License-Identifier: GPL-3.0-or-later
// The engine retains its packet protocol; this transports one datagram per message.
export function createPeerTransport() {
    let peer;
    let channel;
    let generation = 0;
    let incoming = [];
    let queuedBytes = 0;
    const state = { status: 'Create an invitation, or paste an invitation from your opponent.', code: '', connected: false, host: false, busy: false, pasted: '' };
    const limit = 4 * 1024 * 1024;
    function reset() {
        generation++;
        if (peer) peer.close();
        peer = channel = undefined;
        incoming = [];
        queuedBytes = 0;
        Object.assign(state, { status: 'Create an invitation, or paste an invitation from your opponent.', code: '', connected: false, host: false, busy: false, pasted: '' });
    }
    document.addEventListener('paste', event => {
        if (!state.active) return;
        const text = event.clipboardData?.getData('text/plain');
        if (text && text.length <= 65536) { state.pasted = text; event.preventDefault(); }
    });
    function attach(next, token) {
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
            state.status = 'Opponent disconnected. Return to Internet to reconnect.';
            console.info('WebRTC game channel disconnected');
        };
        next.onmessage = ({ data }) => {
            if (token !== generation || !(data instanceof ArrayBuffer) || data.byteLength === 0 || data.byteLength > 1536 || queuedBytes + data.byteLength > limit) return;
            const bytes = new Uint8Array(data);
            incoming.push(bytes);
            queuedBytes += bytes.length;
        };
    }
    function begin(host) {
        reset();
        state.host = host;
        state.status = 'Preparing connection code…';
        const token = generation;
        peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peer.onconnectionstatechange = () => {
            if (token !== generation) return;
            if (peer.connectionState === 'failed') state.status = 'Direct connection failed. These networks may require a relay. Cancel and try another network.';
        };
        if (host) attach(peer.createDataChannel('opents-v1', { ordered: false, maxRetransmits: 0 }), token);
        else peer.ondatachannel = event => {
            if (token === generation && event.channel.label === 'opents-v1' && !channel) attach(event.channel, token);
            else event.channel.close();
        };
        return { connection: peer, token };
    }
    async function describe(connection, token) {
        // Gather candidates into the copied SDP so no signaling service is needed.
        if (connection.iceGatheringState !== 'complete') {
            await new Promise((resolve, reject) => {
                const changed = () => { if (connection.iceGatheringState === 'complete') finish(); };
                const closed = () => { if (connection.signalingState === 'closed') finish(new Error('Connection cancelled.')); };
                function finish(error) {
                    connection.removeEventListener('icegatheringstatechange', changed);
                    connection.removeEventListener('signalingstatechange', closed);
                    if (error) reject(error); else resolve();
                }
                connection.addEventListener('icegatheringstatechange', changed);
                connection.addEventListener('signalingstatechange', closed);
                changed();
            });
        }
        if (token !== generation) return;
        state.code = 'OPENTS1:' + btoa(JSON.stringify(connection.localDescription));
        state.status = state.host ? 'Send your invitation to your opponent, then paste their reply below.' : 'Send this reply to the host. Keep this screen open until connected.';
    }
    async function perform(action, text) {
        if (state.busy) return;
        let token = generation;
        state.busy = true;
        try {
            if (action === 'invite') {
                const started = begin(true);
                token = started.token;
                state.busy = true;
                await started.connection.setLocalDescription(await started.connection.createOffer());
                await describe(started.connection, token);
            } else if (action === 'accept') {
                const code = text.trim();
                if (code.length > 65536 || !code.startsWith('OPENTS1:')) throw new Error('Paste a complete OpenTS connection code.');
                let description;
                try { description = JSON.parse(atob(code.slice(8))); } catch { throw new Error('Invalid connection code.'); }
                if (code === state.code) throw new Error('That is your code. Paste the code your opponent sent back.');
                if (!description || typeof description.sdp !== 'string' || !['offer', 'answer'].includes(description.type)) throw new Error('Invalid connection description.');
                if (description.type === 'offer') {
                    const started = begin(false);
                    token = started.token;
                    state.busy = true;
                    await started.connection.setRemoteDescription(description);
                    await started.connection.setLocalDescription(await started.connection.createAnswer());
                    await describe(started.connection, token);
                } else {
                    if (!peer || !state.host || peer.signalingState !== 'have-local-offer') throw new Error('Create an invitation before accepting a reply.');
                    await peer.setRemoteDescription(description);
                    if (token === generation && !state.connected) state.status = 'Connecting directly to your opponent…';
                }
            }
        } catch (error) {
            if (token === generation) state.status = error.message;
        } finally {
            if (token === generation) state.busy = false;
        }
    }
    return {
        state,
        perform,
        reset,
        send(bytes) {
            if (!state.connected || !channel || channel.bufferedAmount + bytes.length > limit) return false;
            try { channel.send(bytes); return true; } catch { return false; }
        },
        receive() {
            const bytes = incoming.shift();
            if (bytes) queuedBytes -= bytes.length;
            return bytes;
        },
    };
}

