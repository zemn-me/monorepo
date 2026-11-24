import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection, createServer } from 'node:net';

const port = Number(process.argv[2]);
assert.ok(Number.isInteger(port) && port > 0);
const competitor = createServer();
try {
	competitor.listen({ host: '127.0.0.1', port });
	await assert.rejects(once(competitor, 'listening'), error =>
		error.code === 'EADDRINUSE' ||
		(process.platform === 'win32' && error.code === 'EACCES')
	);
} finally {
	if (competitor.listening) competitor.close();
}

// A bound reservation must not make a TCP readiness probe report success.
const probe = createConnection({ host: '127.0.0.1', port });
try {
	// Some kernels drop the SYN for a bound, non-listening socket.
	await assert.rejects(
		once(probe, 'connect', { signal: AbortSignal.timeout(1000) }),
		error => ['ECONNREFUSED', 'ETIMEDOUT', 'ABORT_ERR'].includes(error.code)
	);
} finally {
	probe.destroy();
}
