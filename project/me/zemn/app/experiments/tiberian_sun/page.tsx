import { type ClientLoaderFunctionArgs, useLoaderData } from 'react-router';
import {
	engineData,
	engineJavaScript,
	engineWasm,
	gameData,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/assets.js';
import { TiberianSun } from '#root/project/me/zemn/app/experiments/tiberian_sun/client.js';
import {
	type GameAssets,
	type GamePreparation,
	prepareGame,
} from '#root/project/tiberian_sun/web/launcher.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

export { ErrorBoundary } from '#root/ts/remix/error.js';

const assets = {
	engineJavaScript,
	engineWasm,
	engineData,
	gameData,
} satisfies GameAssets;

export function clientLoader({
	request,
}: ClientLoaderFunctionArgs): Promise<GamePreparation> {
	return prepareGame(assets, request.signal);
}

export function shouldRevalidate() {
	return false;
}

export function HydrateFallback() {
	return <main role="status">{`Loading ${metadata.title}…`}</main>;
}

export default function Page() {
	const preparation = useLoaderData<typeof clientLoader>();
	return <TiberianSun {...preparation} />;
}

export const metadata = {
	title: 'Tiberian Sun',
	description: 'Play Tiberian Sun in your browser.',
} satisfies Metadata;
export const handle = { metadata };
