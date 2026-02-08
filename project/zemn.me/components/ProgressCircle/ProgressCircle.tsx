import React from "react";
interface ProgressCircleProps {
	/**
	 * Number between 0 and 1 representing the progress percentage.
	 */
	readonly progress: number;
	readonly className?: string;
	readonly loss: boolean
}

function relativeArc(
	rx: string | number,
	ry: string | number,
	xAxisRotation: string | number,
	largeArcFlag: string | number,
	sweepFlag: string | number,
	x: string | number,
	y: string | number
) {
	return `a${rx},${ry} ${xAxisRotation} ${largeArcFlag},${sweepFlag} ${x},${y}`;
}

export function ProgressCircle({className, loss, progress}: ProgressCircleProps) {
	if (progress < 0 || progress > 1) throw new Error("Progress must be between 0 and 1 (was instead " + progress + ")");
	const width = 1000;
	const height = 1000;
	const outerMargin = 10;
	const dialThickness = 70;
	const innerPadding = 100;
	//const largeArc = progress > 0.5 ? false: true;
	const largeArcBase = progress < 0.5;
	const sweepBase = false;

	const largeArc = loss ? !largeArcBase : largeArcBase;
	const sweep = loss ? !sweepBase : sweepBase;


	const innerR = (width / 2) - outerMargin - dialThickness - innerPadding;

	const handPosX = innerR * Math.cos(
		-(Math.PI / 2) + 2 * Math.PI * progress
	);

	const handPosY = innerR * Math.sin(
		-(Math.PI / 2) + 2 * Math.PI * progress
	) + innerR;

	return <svg className={className} viewBox={`0 0 ${width} ${height}`}>
		{/* dial */}
		<circle
			style={{
				cx: width / 2,
				cy: height / 2,
				stroke: "currentcolor",
				fill: "none",
				strokeWidth: dialThickness,
				r: (width / 2) - outerMargin - dialThickness,
			}}
		/>

		{/* indicator */}
		<path
			d={[
			`M${width/2},0`, // move to centre top point
			`m0,${outerMargin+dialThickness+innerPadding}`, // offset due to dial thickness and padding
			relativeArc(
				innerR,
				innerR,
				0,
				largeArc?"0": "1",
				sweep?"0": "1",
				handPosX,
				handPosY
			),
			`L${width/2},${height/2}`, // move to centre of the circle
			`Z`// close the line


		].join("")}

			style={{
				fill: "currentcolor",
				stroke: "none",
			}}/>

	</svg>
}
