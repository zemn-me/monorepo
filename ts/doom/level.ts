export type MapPoint = readonly [number, number];
export interface Sector {
	floor: number;
	ceiling: number;
	floorTexture: string;
	ceilingTexture: string;
	light: number;
	tag: number;
}
export interface Side {
	sector: number;
	xOffset: number;
	yOffset: number;
	upper: string;
	lower: string;
	middle: string;
}
export interface MapLine {
	a: MapPoint;
	b: MapPoint;
	flags: number;
	special: number;
	tag: number;
	front: Side;
	back: Side | null;
}
export interface Cell {
	sector: number;
	polygon: MapPoint[];
}
export interface MapTexture {
	width: number;
	height: number;
	url: string;
}
export interface DoomLevel {
	origin: number[];
	walls: number[][][];
	floors: number[][][];
	spawn: number[];
	angle: number;
	linedefs: number;
	sectors: number;
	rooms: Sector[];
	lines: MapLine[];
	cells: Cell[];
	textures: Record<string, MapTexture>;
}
