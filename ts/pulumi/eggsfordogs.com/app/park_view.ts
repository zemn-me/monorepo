import type { OrbitCamera } from '#root/ts/3d/low_poly.js';

/** Shared deterministic view for the static export and the first live frame. */
export const initialCamera = (): OrbitCamera => ({
	yaw: -0.35,
	pitch: 0.64,
	distance: 17.4,
	target: [0, 0, 0],
});
export const initialViewport = [1200, 800] as const;
export const initialViewBox = `0 0 ${initialViewport[0]} ${initialViewport[1]}`;
