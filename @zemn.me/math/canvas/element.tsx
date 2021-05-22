import React from 'react'
import * as Camera from '../camera';
import * as Matrix from '../matrix';
import * as Homog from '../homog'
import * as Cart from '../cartesian';
import * as Cnv from '.'
import * as Vec from '../vec';

export const extent2DContext = React.createContext

export const translate3DContext = React.createContext<Vec.Vector<3> | undefined>(undefined);
export const translate2DContext = React.createContext<Vec.Vector<2> | undefined>(undefined);

export const use3DCoordinates = (coords: Vec.Vector<3>): Vec.Vector<3> => {
	const transform = React.useContext(translate3DContext);
	if (transform) coords = Vec.add(transform, coords);
	return coords;
}

export interface Translate3DProps {
	by: Vec.Vector<3>
}

export const Translate3D: React.FC<Translate3DProps> = ({ by, children }) => {
	const translate = React.useContext(translate3DContext);
	if ( translate) by = Vec.add(by, translate);
	return <translate3DContext.Provider value={translate}>
		{children}
	</translate3DContext.Provider>
}

export const use2DCoordinates = (coords: Vec.Vector<2>): Vec.Vector<2> => {
	const transform = React.useContext(translate2DContext);
	if (transform) coords =  Vec.add(transform, coords);
	return coords;
}

export const useProject = (v: Vec.Vector<3>): Vec.Vector<2> =>
	Matrix.asVec(Homog.pointToCart(Camera.transform(Homog.fromCart(Matrix.fromVec(v)))));


type SVGLineElementPropsWithoutPoints = Omit<JSX.IntrinsicElements["line"], "x1" | "x2" | "y1" | "y2" | "start" | "end">;
export interface LineProps<N extends number = number> extends SVGLineElementPropsWithoutPoints{
	start: Vec.Vector<N>
	end: Vec.Vector<N>,
	children: never
}

export const Line3D = (props: LineProps<3>) => {
	let [ cStart, cEnd ] = [props.start, props.end ];
	cStart = use3DCoordinates(cStart);
	cEnd = use3DCoordinates(cEnd);
	let [ start2D, end2D ] = [
		useProject(cStart),
		useProject(cEnd)
	];
	start2D = use2DCoordinates(start2D);
	end2D = use2DCoordinates(end2D);
	const [ [ x1, y1], [x2, y2]] = [ start2D, end2D ];
	return <line x1={x1} y1={y1} x2={x2} y2={y2}/>
}


export interface LineElement extends React.ReactElement<LineProps, typeof Line>{}

export type Element = LineElement;


export interface CanvasProps {
	children: React.ReactElement
}

export const useChildExtent = (): {minX: number, minY: number, maxX: number, maxY: number} => {

}

export const Canvas: React.FC<CanvasProps> = ({ children }) => {
	return <svg>
		{children}
	</svg>
}
