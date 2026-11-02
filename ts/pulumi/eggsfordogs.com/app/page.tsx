import '#root/ts/pulumi/eggsfordogs.com/app/base.css';

import { renderSVGSnapshot } from '#root/ts/3d/svg_scene.js';
import { EggDogYardClient } from '#root/ts/pulumi/eggsfordogs.com/app/client.js';
import {
	buildActors,
	buildParkMesh,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_mesh.js';
import {
	initialCamera,
	initialViewport,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_view.js';
import { createPark } from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';

// Reuse the deterministic frame across server requests as well as the static export.
const initialScene = renderSVGSnapshot(
	buildParkMesh(),
	buildActors(createPark()),
	initialCamera(),
	...initialViewport
);

export default function Page() {
	return <EggDogYardClient initialScene={initialScene} />;
}
