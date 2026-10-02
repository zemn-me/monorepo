import { TextDecoder, TextEncoder } from 'node:util';

// jsdom omits these web APIs, which React Router uses when its modules load.
Object.assign(globalThis, { TextDecoder, TextEncoder });
