import { TextDecoder, TextEncoder } from 'util';
import { createRequire } from 'module';

if (typeof global.TextEncoder === 'undefined') {
  // Polyfill required for libraries that rely on the Web API
  Object.assign(global, { TextEncoder, TextDecoder });
}

// Jest runs tests in ESM mode; some compiled code expects a CommonJS `require`.
// Provide a compat shim using Node's createRequire.
if (typeof global.require === 'undefined') {
  global.require = createRequire(import.meta.url);
}
