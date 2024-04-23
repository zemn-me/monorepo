import { z } from 'zod';

export enum _DefinesControlBehaviorTransportBeltContentReadMode {
	pulse = 0,
	hold = 1,
}

export const DefinesControlBehaviorTransportBeltContentReadMode = z.nativeEnum(
	_DefinesControlBehaviorTransportBeltContentReadMode
);
export type DefinesControlBehaviorTransportBeltContentReadMode = z.TypeOf<
	typeof DefinesControlBehaviorInserterHandReadMode
>;

export enum _DefinesControlBehaviorInserterHandReadMode {
	hold = 0,
	pulse = 1,
}

export const DefinesControlBehaviorInserterHandReadMode = z.nativeEnum(
	_DefinesControlBehaviorInserterHandReadMode
);
export type DefinesControlBehaviorInserterHandReadMode = z.TypeOf<
	typeof DefinesControlBehaviorInserterHandReadMode
>;

export enum _DefinesControlBehaviorMiningDrillResourceReadMode {
	this_miner = 1,
	entire_patch = 2,
}

export const DefinesControlBehaviorMiningDrillResourceReadMode = z.nativeEnum(
	_DefinesControlBehaviorMiningDrillResourceReadMode
);
export type DefinesControlBehaviorMiningDrillResourceReadMode = z.TypeOf<
	typeof DefinesControlBehaviorInserterHandReadMode
>;
