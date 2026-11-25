import { useId } from 'react';
import style from './style.module.css';

interface Point {
	x: number;
	y: number;
}

export function SignCaption({
	name,
	start,
	project,
	compact = false,
	opacity,
}: {
	name: string;
	start: number;
	project: (longitude: number) => Point;
	compact?: boolean;
	opacity?: number;
}) {
	const id = useId();
	const points = Array.from({ length: 21 }, (_, i) =>
		project(start + i * 1.5)
	);
	const first = points[0]!,
		last = points[points.length - 1]!;
	const dx = last.x - first.x,
		dy = last.y - first.y;
	// Reverse the baseline on the lower half of the ring so the letters stay upright.
	if (Math.abs(dx) < 1e-6 ? dy > 0 : dx < 0) points.reverse();

	// The chord is a conservative measure of usable space, even when the
	// projected arc folds back on itself near an edge-on view.
	const room = Math.hypot(dx, dy) - 3;
	const short = compact || room < name.length * 5.2;
	const caption = (short ? name.slice(0, 3) : name).toUpperCase();
	const size = Math.min(
		compact ? 9 : 11.5,
		room / (caption.length * (short ? 0.8 : 0.7))
	);
	if (size < 7) return null;
	const path =
		'M' + points.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join('L');
	return (
		<g opacity={opacity}>
			<defs>
				<path id={id} d={path} />
			</defs>
			<text
				textAnchor="middle"
				dominantBaseline="central"
				fill="currentColor"
				fontSize={size}
				letterSpacing=".04em"
				className={compact ? style.globeSign : undefined}
			>
				<title>{name}</title>
				<textPath href={'#' + id} startOffset="50%">
					{caption}
				</textPath>
			</text>
		</g>
	);
}
