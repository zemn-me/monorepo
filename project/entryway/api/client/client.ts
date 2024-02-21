import { createTRPCReact } from '@trpc/react-query';

import { API } from '#root/project/entryway/api/router.js';

export const api = createTRPCReact<API>();
