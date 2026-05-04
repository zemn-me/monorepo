import * as cartesian from '#root/ts/math/cartesian.js';
import * as euler_angle from '#root/ts/math/euler_angle.js';
import * as homogenous from '#root/ts/math/homog.js';
import * as Matrix from '#root/ts/math/matrix.js';
import * as quaternion from '#root/ts/math/quaternion.js';

export const Quaternion = {
	fromEulerAngles(e: euler_angle.EulerAngle): quaternion.Quaternion {
		const cy = Math.cos(e.yaw * 0.5);
		const sy = Math.sin(e.yaw * 0.5);
		const cp = Math.cos(e.pitch * 0.5);
		const sp = Math.sin(e.pitch * 0.5);
		const cr = Math.cos(e.roll * 0.5);
		const sr = Math.sin(e.roll * 0.5);

		const w = cr * cp * cy + sr * sp * sy;
		const x = sr * cp * cy - cr * sp * sy;
		const y = cr * sp * cy + sr * cp * sy;
		const z = cr * cp * sy - sr * sp * cy;

		return quaternion.from(x, y, z, w);
	},

	fromPoint3D(pts: cartesian.Point3D): quaternion.Quaternion {
		const [[x], [y], [z]] = pts!;
		return quaternion.from(x!, y!, z!, 0);
	},
};

export const Cartestian = {
	fromQuaternion(q: quaternion.Quaternion): cartesian.Point3D {
		return [
			[quaternion.x(q)],
			[quaternion.y(q)],
			[quaternion.z(q)],
		] as const;
	},
};

export const Euler = {
	fromQuaternion(q: quaternion.Quaternion): euler_angle.EulerAngle {
		const sinr_cosp =
			2 *
			(quaternion.w(q) * quaternion.x(q) +
				quaternion.y(q) * quaternion.z(q));
		const cosr_cosp =
			1 -
			2 *
				(quaternion.x(q) * quaternion.x(q) +
					quaternion.y(q) * quaternion.y(q));
		const roll = Math.atan2(sinr_cosp, cosr_cosp);

		const sinp =
			2 *
			(quaternion.w(q) * quaternion.y(q) -
				quaternion.z(q) * quaternion.x(q));
		let pitch;
		if (Math.abs(sinp) >= 1) {
			pitch = (Math.sign(sinp) * Math.PI) / 2;
		} else {
			pitch = Math.asin(sinp);
		}

		const siny_cosp =
			2 *
			(quaternion.w(q) * quaternion.z(q) +
				quaternion.x(q) * quaternion.y(q));
		const cosy_cosp =
			1 -
			2 *
				(quaternion.y(q) * quaternion.y(q) +
					quaternion.z(q) * quaternion.z(q));
		const yaw = Math.atan2(siny_cosp, cosy_cosp);

		return new euler_angle.EulerAngle(pitch, yaw, roll);
	},
};

export const homogToCart = <N extends number>(
	pt: homogenous.Point<N>
): cartesian.Point<N> =>
	Matrix.map<1, N, number, number>(
		homogenous.nonw<N>(pt),
		v => v * homogenous.w<N>(pt)
	);

export const cartToHomog = <N extends number>(
	pt: cartesian.Point<N>
): homogenous.Point<N> => [...pt, [1]] as homogenous.Point<N>;
