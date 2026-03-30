import createFetchClient from "openapi-fetch";

import type { paths } from "#root/project/zemn.me/api/api_client.gen.js";
import { ZEMN_ME_API_BASE } from "#root/project/zemn.me/constants/constants.js";

export const publicFetchClient = createFetchClient<paths>({
	baseUrl: ZEMN_ME_API_BASE,
});
