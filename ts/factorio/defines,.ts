import { z } from 'zod/v4-mini';

export enum _DefinesControlBehaviorTransportBeltContentReadMode {
	pulse = 0,
	hold = 1,
}

export const DefinesControlBehaviorTransportBeltContentReadMode = z.nativeEnum(
	_DefinesControlBehaviorTransportBeltContentReadMode
);
export type DefinesControlBehaviorTransportBeltContentReadMode = z.infer<
	typeof DefinesControlBehaviorInserterHandReadMode
>;

export enum _DefinesControlBehaviorInserterHandReadMode {
	hold = 0,
	pulse = 1,
}

export const DefinesControlBehaviorInserterHandReadMode = z.nativeEnum(
	_DefinesControlBehaviorInserterHandReadMode
);
export type DefinesControlBehaviorInserterHandReadMode = z.infer<
	typeof DefinesControlBehaviorInserterHandReadMode
>;

export enum _DefinesControlBehaviorMiningDrillResourceReadMode {
	this_miner = 1,
	entire_patch = 2,
}

export const DefinesControlBehaviorMiningDrillResourceReadMode = z.nativeEnum(
	_DefinesControlBehaviorMiningDrillResourceReadMode
);
export type DefinesControlBehaviorMiningDrillResourceReadMode = z.infer<
	typeof DefinesControlBehaviorInserterHandReadMode
>;
