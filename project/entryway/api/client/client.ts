import { createTRPCReact } from '@trpc/react-query';

import type { API } from '#root/project/entryway/api/router.js';

export const api = createTRPCReact<API>();
