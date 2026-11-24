import { VectorTile } from '@mapbox/vector-tile';
import { useQueries } from '@tanstack/react-query';
import { PbfReader } from 'pbf';
import style from '#root/project/me/zemn/app/journal/style.module.css';

const tileSize = 256;
const drawingOrder = [
	'green',
	'water',
	'river',
	'boundary',
	'road',
	'arterial',
] as const;
type Ink = (typeof drawingOrder)[number];
type Label = { text: string; x: number; y: number; priority: number };

function inkFor(layer: string, kind: unknown): Ink | undefined {
	switch (layer) {
		case 'ocean':
		case 'water_polygons':
			return 'water';
		case 'water_lines':
			return 'river';
		case 'boundaries':
			return 'boundary';
		case 'land':
			if (
				[
					'park',
					'wood',
					'forest',
					'grass',
					'meadow',
					'recreation_ground',
				].includes(String(kind))
			)
				return 'green';
			break;
		case 'streets':
			if (
				['motorway', 'trunk', 'primary', 'secondary'].includes(
					String(kind)
				)
			)
				return 'arterial';
			return 'road';
	}
}

async function readTile(url: string, signal: AbortSignal) {
	const response = await fetch(url, {
		signal,
		credentials: 'omit',
		referrerPolicy: 'strict-origin-when-cross-origin',
	});
	if (!response.ok) throw new Error('Map tile unavailable');
	const tile = new VectorTile(
		new PbfReader(new Uint8Array(await response.arrayBuffer()))
	);
	const paths = new Map<Ink, string[]>();
	const labels: Label[] = [];
	for (const name of [
		'land',
		'ocean',
		'water_polygons',
		'water_lines',
		'boundaries',
		'streets',
		'street_labels',
		'place_labels',
		'water_polygons_labels',
		'boundary_labels',
	]) {
		const layer = tile.layers[name];
		if (!layer) continue;
		const scale = tileSize / layer.extent;
		for (let i = 0; i < layer.length; i++) {
			const feature = layer.feature(i);
			const props = feature.properties;
			if (name === 'street_labels') {
				const text = props.name;
				if (typeof text !== 'string' || !text) continue;
				const line = feature.loadGeometry()[0];
				const start = line?.[0],
					end = line?.at(-1);
				if (
					!line ||
					!start ||
					!end ||
					Math.hypot(end.x - start.x, end.y - start.y) * scale <
						Math.max(65, text.length * 7)
				)
					continue;
				const point = line[Math.floor((line.length - 1) / 2)]!;
				labels.push({
					x: point.x * scale,
					y: point.y * scale,
					text,
					priority: 0,
				});
				continue;
			}
			if (feature.type === 1) {
				const point = feature.loadGeometry()[0]?.[0];
				const text = props.name;
				if (point && typeof text === 'string' && text) {
					labels.push({
						x: point.x * scale,
						y: point.y * scale,
						text,
						priority:
							name === 'place_labels'
								? 3
								: name === 'water_polygons_labels'
									? 2
									: 1,
					});
				}
				continue;
			}
			const ink = inkFor(name, props.kind);
			if (!ink) continue;
			const parts = paths.get(ink) ?? [];
			paths.set(ink, parts);
			for (const line of feature.loadGeometry()) {
				for (let j = 0; j < line.length; j++) {
					const { x, y } = line[j]!;
					parts.push(
						`${j ? 'L' : 'M'}${(x * scale).toFixed(1)},${(y * scale).toFixed(1)}`
					);
				}
				if (feature.type === 3) parts.push('Z');
			}
		}
	}
	return {
		paths: Object.fromEntries(
			Array.from(paths, ([ink, parts]) => [ink, parts.join('')])
		),
		labels,
	};
}

export function VectorMap({
	left,
	top,
	width,
	height,
	zoom,
	points,
}: {
	left: number;
	top: number;
	width: number;
	height: number;
	zoom: number;
	points: readonly { x: number; y: number }[];
}) {
	const count = 2 ** zoom;
	const urls = new Set<string>();
	const tiles = [];
	for (
		let x = Math.floor(left / tileSize);
		x < Math.ceil((left + width) / tileSize);
		x++
	) {
		for (
			let y = Math.max(0, Math.floor(top / tileSize));
			y < Math.min(count, Math.ceil((top + height) / tileSize));
			y++
		) {
			const url = `https://vector.openstreetmap.org/shortbread_v1/${zoom}/${((x % count) + count) % count}/${y}.mvt`;
			urls.add(url);
			tiles.push({ x: x * tileSize - left, y: y * tileSize - top, url });
		}
	}
	const requests = Array.from(urls);
	const results = useQueries({
		queries: requests.map(url => ({
			queryKey: ['journal-vector-tile', url],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				readTile(url, signal),
			staleTime: Infinity,
			meta: { persist: false },
			retry: 1,
		})),
	});
	const data = new Map(requests.map((url, i) => [url, results[i]?.data]));
	const candidates = tiles
		.flatMap(tile =>
			(data.get(tile.url)?.labels ?? []).map(label => ({
				...label,
				x: tile.x + label.x,
				y: tile.y + label.y,
			}))
		)
		.sort((a, b) => b.priority - a.priority);
	const labels: (Label & { halfWidth: number })[] = [];
	for (const label of candidates) {
		const halfWidth = Math.max(12, label.text.length * 3.4);
		if (
			label.x - halfWidth < 3 ||
			label.x + halfWidth > width - 3 ||
			label.y < 9 ||
			label.y > height - 9
		)
			continue;
		if (
			points.some(
				pin =>
					Math.abs(pin.x - label.x) < halfWidth + 14 &&
					Math.abs(pin.y - 12 - label.y) < 20
			) ||
			labels.some(
				previous =>
					previous.text === label.text ||
					(Math.abs(previous.y - label.y) < 17 &&
						Math.abs(previous.x - label.x) <
							previous.halfWidth + halfWidth + 8)
			)
		)
			continue;
		labels.push({ ...label, halfWidth });
	}
	return (
		<>
			<svg
				className={style.mapTiles}
				width={width}
				height={height}
				role="img"
				aria-label="Location map"
				aria-busy={results.some(result => result.isPending)}
			>
				{tiles.map(tile => (
					<svg
						key={`${tile.x}:${tile.y}`}
						x={tile.x}
						y={tile.y}
						width={tileSize}
						height={tileSize}
						overflow="hidden"
					>
						{drawingOrder.map(ink => {
							const path = data.get(tile.url)?.paths[ink];
							return path ? (
								<path
									key={ink}
									className={style[ink]}
									d={path}
									fillRule="nonzero"
								/>
							) : null;
						})}
					</svg>
				))}
				{labels.map(label => (
					<text
						key={label.text}
						x={label.x}
						y={label.y}
						textAnchor="middle"
						dominantBaseline="middle"
					>
						{label.text}
					</text>
				))}
			</svg>
			{results.every(result => result.isError) && (
				<span className={style.mapError} role="status">
					Map detail unavailable
				</span>
			)}
		</>
	);
}
