import type { DoomLevel, MapLine, MapPoint } from '#root/ts/doom/level.js';
import type { YawPitchPose } from '#root/ts/math/camera_pose.js';
import { point, x, y, z } from '#root/ts/math/cartesian.js';

export const EYE_HEIGHT = 41 / 64;
export const PLAYER_HEIGHT = 56 / 64;
export const PLAYER_RADIUS = 16 / 64;
export const STEP_HEIGHT = 24 / 64;
export type Doors = Map<number, number>;

export function sectorAt(
	level: DoomLevel,
	px: number,
	pz: number
): number | undefined {
	for (const cell of level.cells) {
		let positive = false,
			negative = false;
		for (let i = 0; i < cell.polygon.length; i++) {
			const a = cell.polygon[i]!,
				b = cell.polygon[(i + 1) % cell.polygon.length]!;
			const cross =
				(b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
			positive ||= cross > 1e-6;
			negative ||= cross < -1e-6;
		}
		if (cell.polygon.length >= 3 && !(positive && negative))
			return cell.sector;
	}
	return undefined;
}
export const ceiling = (level: DoomLevel, sector: number, doors: Doors) =>
	doors.get(sector) ?? level.rooms[sector]!.ceiling;
const distanceToLine = (p: MapPoint, line: MapLine) => {
	const dx = line.b[0] - line.a[0],
		dz = line.b[1] - line.a[1];
	const t = Math.max(
		0,
		Math.min(
			1,
			((p[0] - line.a[0]) * dx + (p[1] - line.a[1]) * dz) /
				(dx * dx + dz * dz)
		)
	);
	return Math.hypot(p[0] - line.a[0] - t * dx, p[1] - line.a[1] - t * dz);
};

export function canStand(
	level: DoomLevel,
	position: MapPoint,
	feet: number,
	doors: Doors
): boolean {
	const sector = sectorAt(level, ...position);
	if (sector === undefined) return false;
	const floor = level.rooms[sector]!.floor;
	if (
		floor - feet > STEP_HEIGHT + 1e-6 ||
		ceiling(level, sector, doors) - Math.max(feet, floor) < PLAYER_HEIGHT
	)
		return false;
	for (const line of level.lines) {
		if (distanceToLine(position, line) >= PLAYER_RADIUS - 1e-6) continue;
		if (!line.back || line.flags & 1) return false;
		const a = line.front.sector,
			b = line.back.sector;
		const bottom = Math.max(level.rooms[a]!.floor, level.rooms[b]!.floor);
		const top = Math.min(
			ceiling(level, a, doors),
			ceiling(level, b, doors)
		);
		if (
			bottom - feet > STEP_HEIGHT + 1e-6 ||
			top - Math.max(feet, bottom) < PLAYER_HEIGHT
		)
			return false;
	}
	return true;
}

/** Small swept steps prevent tunnelling; rejected movement slides along walls. */
export function walk(
	level: DoomLevel,
	pose: YawPitchPose,
	forward: number,
	strafe: number,
	sprint: boolean,
	seconds: number,
	doors: Doors
): YawPitchPose {
	const speed = (sprint ? 8 : 4) / Math.max(1, Math.hypot(forward, strafe));
	const dx =
		(Math.sin(pose.yaw) * forward + Math.cos(pose.yaw) * strafe) *
		speed *
		seconds;
	const dz =
		(Math.cos(pose.yaw) * forward - Math.sin(pose.yaw) * strafe) *
		speed *
		seconds;
	const steps = Math.max(
		1,
		Math.ceil(Math.hypot(dx, dz) / (PLAYER_RADIUS / 3))
	);
	let px = x(pose.position),
		pz = z(pose.position),
		feet = y(pose.position) - EYE_HEIGHT;
	let velocity = pose.verticalVelocity ?? 0;
	for (let i = 0; i < steps; i++) {
		for (const [sx, sz] of [
			[dx / steps, dz / steps],
			[dx / steps, 0],
			[0, dz / steps],
		]) {
			if (canStand(level, [px + sx!, pz + sz!], feet, doors)) {
				px += sx!;
				pz += sz!;
				break;
			}
		}
		const sector = sectorAt(level, px, pz)!;
		const floor = level.rooms[sector]!.floor;
		if (floor >= feet) {
			feet = floor;
			velocity = 0;
		} else {
			velocity -= (16 * seconds) / steps;
			feet = Math.max(floor, feet + (velocity * seconds) / steps);
			if (feet === floor) velocity = 0;
		}
	}
	return {
		...pose,
		position: point<3>(px, feet + EYE_HEIGHT, pz),
		verticalVelocity: velocity,
	};
}

/** Use the nearest line in reach, so doors cannot be activated through solid walls. */
export function useDoor(
	level: DoomLevel,
	pose: YawPitchPose,
	doors: Doors
): boolean {
	const px = x(pose.position),
		pz = z(pose.position),
		dx = Math.sin(pose.yaw),
		dz = Math.cos(pose.yaw);
	let hit: MapLine | undefined,
		nearest = 1.25;
	for (const line of level.lines) {
		const lx = line.b[0] - line.a[0],
			lz = line.b[1] - line.a[1],
			det = dx * lz - dz * lx;
		if (Math.abs(det) < 1e-9) continue;
		const ax = line.a[0] - px,
			az = line.a[1] - pz;
		const t = (ax * lz - az * lx) / det,
			u = (ax * dz - az * dx) / det;
		if (
			t >= 0 &&
			t < nearest &&
			u >= 0 &&
			u <= 1 &&
			(!line.back || line.special || line.flags & 1)
		) {
			nearest = t;
			hit = line;
		}
	}
	if (!hit || ![1, 26, 27, 28, 31, 32, 33, 34, 63, 103].includes(hit.special))
		return false;
	const targets = hit.tag
		? level.rooms.flatMap((room, i) => (room.tag === hit!.tag ? [i] : []))
		: hit.back
			? [hit.back.sector]
			: [];
	let changed = false;
	for (const sector of targets) {
		let top = Infinity;
		for (const line of level.lines) {
			if (!line.back) continue;
			const other =
				line.front.sector === sector
					? line.back.sector
					: line.back.sector === sector
						? line.front.sector
						: undefined;
			if (other !== undefined && other !== sector)
				top = Math.min(top, level.rooms[other]!.ceiling);
		}
		if (
			Number.isFinite(top) &&
			top - 4 / 64 > ceiling(level, sector, doors)
		) {
			doors.set(sector, top - 4 / 64);
			changed = true;
		}
	}
	return changed;
}
