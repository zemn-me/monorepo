import { Metadata } from 'next/types';
import { ArenaClient } from '#root/project/me/zemn/app/experiments/arena/client.js';
import {
	createArenaScene,
	OVERVIEW,
} from '#root/project/me/zemn/app/experiments/arena/scene.js';
import { renderSVGSnapshot } from '#root/ts/3d/svg_scene.js';

export default function Page() {
	return (
		<ArenaClient
			initialFrame={renderSVGSnapshot(
				createArenaScene(),
				[],
				OVERVIEW,
				1200,
				800,
				{ farPlane: 200 }
			)}
		/>
	);
}

export const metadata: Metadata = {
	title: 'SVG Arena',
	description:
		'Walk through Doom’s E1M1 with textured SVG meshes, or orbit the wireframe map.',
};
