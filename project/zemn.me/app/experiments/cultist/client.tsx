'use client';

import type { ReactElement } from 'react';

import type { CoreContent } from '#root/project/cultist/content.js';
import { CultistGame } from '#root/project/cultist/react/game.js';

export interface MainProps {
	readonly core: CoreContent;
}

export default function Main({ core }: MainProps): ReactElement {
	return <CultistGame core={core} />;
}
