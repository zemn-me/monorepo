export * as deserialize from 'project/cultist/state/deserialize';
export * from 'project/cultist/state/op';
export * as serialize from 'project/cultist/state/serialize';
export * from 'project/cultist/state/state';

// taken from a save from the game.

export const boardMinX = -1440;
export const boardMinY = -780;
export const boardMaxX = -boardMinX;
export const boardMaxY = -boardMinY;
export const cardWidth = Math.abs(-1440 - -1350);
export const cardHeight = Math.abs(780 - 650);
