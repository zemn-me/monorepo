import { createTRPCReact } from '@trpc/react-query';

import type { API } from '#root/project/entryway/api/model.js';

export const api = createTRPCReact<API>();
