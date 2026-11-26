import type { ChartGeometry } from './chart_geometry.js';
import { type nearestAspects, type Placement } from './zodiac.js';

export function WheelGuides({
	geometry,
	aspects,
	selected,
	ascendant,
}: {
	geometry: ChartGeometry;
	aspects: ReturnType<typeof nearestAspects>;
	selected?: Placement;
	ascendant?: number;
}) {
	const at = geometry.ring;
	const anchor = ascendant ?? 0;
	const xy = (p: { x: number; y: number }) =>
		p.x.toFixed(2) + ',' + p.y.toFixed(2);
	const start =
		selected && geometry.aspectEnd(selected.marker, selected.longitude);
	return (
		<g aria-label="Selected object aspects and ascendant">
			{start &&
				aspects.map(({ dash, name, placement }) => {
					const end = geometry.aspectEnd(
						placement.marker,
						placement.longitude
					);
					const { object } = placement.marker;
					const title = `${name} · ${object.name}\n${object.piece}`;
					const line = geometry.frame.segment(start, end);
					if (!line) return null;
					return (
						<g key={name}>
							<line
								{...line}
								stroke="currentColor"
								strokeOpacity=".72"
								strokeWidth="1"
								strokeDasharray={dash}
							>
								<title>{title}</title>
							</line>
							{end.visible && (
								<circle
									cx={end.x}
									cy={end.y}
									r="2"
									fill="currentColor"
								>
									<title>{title}</title>
								</circle>
							)}
						</g>
					);
				})}
			{ascendant !== undefined && (
				<g fill="currentColor">
					<title>Rising sign (Ascendant) · Eastern horizon</title>
					<path
						d={
							'M' +
							xy(at(anchor, 1.16)) +
							'L' +
							xy(at(anchor, 0.89))
						}
						stroke="currentColor"
					/>
					<text
						x={at(anchor, 0.84).x}
						y={at(anchor, 0.84).y - 4}
						textAnchor="middle"
						fontSize="9"
					>
						ASC
					</text>
				</g>
			)}
		</g>
	);
}
