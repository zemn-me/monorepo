/**
 * @fileoverview This file implements an Euler Angle type.
 */

export class EulerAngle<Pitch extends number = number, Yaw extends Number = number, Roll extends Number = number> {
    constructor(public pitch: Pitch, public yaw: Yaw, public roll: Roll) {}
}