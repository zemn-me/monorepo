import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';

const port = Number(process.argv[2]);
assert.ok(Number.isInteger(port) && port > 0);
const competitor = createServer();
try {
	competitor.listen({ host: '127.0.0.1', port });
	await assert.rejects(once(competitor, 'listening'), { code: 'EADDRINUSE' });
} finally {
	if (competitor.listening) competitor.close();
}
