import { type ClientLoaderFunctionArgs, useLoaderData } from 'react-router';
import {
	tdData,
	tdJavaScript,
	tdWasm,
} from '#root/project/me/zemn/app/experiments/vanilla_conquer/assets.js';
import { VanillaConquer } from '#root/project/me/zemn/app/experiments/vanilla_conquer/client.js';
import {
	type GameAssets,
	type PreparedGame,
	prepareGame,
} from '#root/project/vanilla_conquer/web/launcher.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

const assets = {
	game: 'td',
	engineJavaScript: tdJavaScript,
	engineWasm: tdWasm,
	gameData: tdData,
} satisfies GameAssets;
export function clientLoader({
	request,
}: ClientLoaderFunctionArgs): Promise<PreparedGame> {
	return prepareGame(assets, request.signal);
}

export function shouldRevalidate() {
	return false;
}

export function HydrateFallback() {
	return <main role="status">{`Loading ${metadata.title}…`}</main>;
}

export default function Page() {
	const prepared = useLoaderData<typeof clientLoader>();
	return <VanillaConquer assets={assets} prepared={prepared} />;
}
export const metadata = {
	title: 'Command & Conquer',
	description: 'Play Command & Conquer in your browser.',
} satisfies Metadata;
export const handle = { metadata };
