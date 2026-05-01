import type { ReactElement } from 'react';

import { loadCoreContent } from '#root/project/cultist/content_node.js';
import { CultistGame } from '#root/project/cultist/react/game.js';

export default async function Page(): Promise<ReactElement> {
	const core = await loadCoreContent();

	return <CultistGame core={core} />;
}
