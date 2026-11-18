import {
	raData,
	raJavaScript,
	raWasm,
} from '#root/project/me/zemn/app/experiments/vanilla_conquer/assets.js';
import { VanillaConquer } from '#root/project/me/zemn/app/experiments/vanilla_conquer/client.js';
import { raCinematics } from '#root/project/vanilla_conquer/assets/cinematics.js';
import type { GameAssets } from '#root/project/vanilla_conquer/web/launcher.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

const assets = {
	game: 'ra',
	engineJavaScript: raJavaScript,
	engineWasm: raWasm,
	gameData: raData,
	cinematics: raCinematics,
} satisfies GameAssets;
export default function Page() {
	return <VanillaConquer assets={assets} />;
}
export const metadata: Metadata = {
	title: 'Red Alert',
	description: 'Play Red Alert in your browser.',
};
export const handle = { metadata };
