import { config } from 'zod/v4/core';

// Schema construction can probe Function before React providers are evaluated.
config({ jitless: true });
