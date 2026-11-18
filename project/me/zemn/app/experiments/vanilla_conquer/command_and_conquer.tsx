import {
	tdData,
	tdJavaScript,
	tdWasm,
} from '#root/project/me/zemn/app/experiments/vanilla_conquer/assets.js';
import { VanillaConquer } from '#root/project/me/zemn/app/experiments/vanilla_conquer/client.js';
import type { GameAssets } from '#root/project/vanilla_conquer/web/launcher.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

const assets = {
	game: 'td',
	engineJavaScript: tdJavaScript,
	engineWasm: tdWasm,
	gameData: tdData,
} satisfies GameAssets;
export default function Page() {
	return <VanillaConquer assets={assets} />;
}
export const metadata: Metadata = {
	title: 'Command & Conquer',
	description: 'Play Command & Conquer in your browser.',
};
export const handle = { metadata };
