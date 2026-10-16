import {
	engineData,
	engineJavaScript,
	engineWasm,
	gameData,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/assets.js';
import { TiberianSun } from '#root/project/me/zemn/app/experiments/tiberian_sun/client.js';
import type { GameAssets } from '#root/project/tiberian_sun/web/launcher.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

export const assets = {
	engineJavaScript,
	engineWasm,
	engineData,
	gameData,
} satisfies GameAssets;

export default function Page() {
	return <TiberianSun assets={assets} />;
}

export const metadata: Metadata = {
	title: 'Tiberian Sun',
	description: 'Play Tiberian Sun in your browser.',
};
export const handle = { metadata };
