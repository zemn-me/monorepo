export * as deserialize from 'monorepo/project/cultist/state/deserialize.js';
export * from 'monorepo/project/cultist/state/op.js';
export * as serialize from 'monorepo/project/cultist/state/serialize.js';
export * from 'monorepo/project/cultist/state/state.js';

// taken from a save from the game.

export const boardMinX = -1440;
export const boardMinY = -780;
export const boardMaxX = -boardMinX;
export const boardMaxY = -boardMinY;
export const cardWidth = Math.abs(-1440 - -1350);
export const cardHeight = Math.abs(780 - 650);
