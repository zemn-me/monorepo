import * as cultist from '#root/project/cultist/types.js';

export enum Kind {
	PassTime,
	ExecuteRecipe,
	SelectLegacy,
}

export interface SelectLegacy {
	kind: Kind.SelectLegacy;
	legacy: cultist.Legacy;
}

export interface PassTime {
	kind: Kind.PassTime;
	seconds: number;
}

export interface ExecuteRecipe {
	kind: Kind.ExecuteRecipe;
	recipe: [cultist.Recipe, cultist.Element[]];
	byPlayerAction: boolean;
}

export type Action = SelectLegacy | PassTime | ExecuteRecipe;
