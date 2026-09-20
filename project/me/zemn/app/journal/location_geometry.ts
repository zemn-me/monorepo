// Web Mercator coordinates in a unit world; clamp polar locations to its limit.
export function projectLocation(latitude: number, longitude: number) {
	const sine = Math.sin(
		(Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) /
			180
	);
	return {
		x: (longitude + 180) / 360,
		y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI),
	};
}

export function mapViewport(
	locations: readonly { latitude: number; longitude: number }[],
	width: number,
	height: number
) {
	const points = locations.map(point =>
		projectLocation(point.latitude, point.longitude)
	);
	// Cut the world at its largest empty longitude gap, so trips across the
	// antimeridian fit together rather than spanning an almost empty world.
	const sorted = points.map(point => point.x).sort((a, b) => a - b);
	let start = sorted[0] ?? 0;
	let largestGap = -1;
	for (let i = 0; i < sorted.length; i++) {
		const next = sorted[(i + 1) % sorted.length] ?? 0;
		const gap = next + (i === sorted.length - 1 ? 1 : 0) - (sorted[i] ?? 0);
		if (gap > largestGap) {
			largestGap = gap;
			start = next;
		}
	}
	const wrapped = points.map(point => ({
		...point,
		x: point.x < start ? point.x + 1 : point.x,
	}));
	const xs = wrapped.map(point => point.x),
		ys = wrapped.map(point => point.y);
	const minX = Math.min(...xs),
		maxX = Math.max(...xs),
		minY = Math.min(...ys),
		maxY = Math.max(...ys);
	const zoom = Math.max(
		0,
		Math.min(
			13,
			Math.floor(
				Math.log2(
					Math.min(
						Math.max(1, width - 48) /
							(256 * Math.max(maxX - minX, 1e-8)),
						Math.max(1, height - 48) /
							(256 * Math.max(maxY - minY, 1e-8))
					)
				)
			)
		)
	);
	const scale = 256 * 2 ** zoom;
	const left = ((minX + maxX) / 2) * scale - width / 2;
	const top = ((minY + maxY) / 2) * scale - height / 2;
	return {
		zoom,
		left,
		top,
		points: wrapped.map(point => ({
			x: point.x * scale - left,
			y: point.y * scale - top,
		})),
	};
}
