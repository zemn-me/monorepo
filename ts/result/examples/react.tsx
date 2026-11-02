import {
	and_then,
	Err,
	Ok,
	type Result,
	unwrap_or_else,
} from '#root/ts/result/result.js';

type Vector3 = readonly [x: number, y: number, z: number];

export function normalize([x, y, z]: Vector3): Result<Vector3, Error> {
	const length = Math.hypot(x, y, z);
	if (length === 0) {
		return Err(new Error('Cannot normalize a zero-length vector.'));
	}

	return Ok([x / length, y / length, z / length]);
}

declare function useTheme(): { error: string; vector: string };

export function UnitVector({ vector }: { vector: Vector3 }) {
	const theme = useTheme();

	return unwrap_or_else(
		and_then(normalize(vector), vector => (
			<output className={theme.vector}>
				{vector.map(value => value.toFixed(2)).join(', ')}
			</output>
		)),
		error => <p className={theme.error}>{error.message}</p>
	);
}
