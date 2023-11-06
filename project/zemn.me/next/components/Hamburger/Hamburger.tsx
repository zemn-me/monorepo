import classNames from 'classnames';
import style from 'project/zemn.me/next/components/Hamburger/Hamburger.module.css';

type SVGProps = JSX.IntrinsicElements['svg'];

export interface HamburgerProps extends SVGProps {
	margin: number;
	strokeWidth: number;
}

const percent = (n: number) => `${n}%`;

// I'm a bit lost with the maths here so draw a diagram and redo it thomas!!

export const Hamburger: React.FC<HamburgerProps> = ({
	className,
	margin,
	strokeWidth,
	...props
}) => {
	const lines: [number, number][][] = [
		// top line
		[
			[margin + strokeWidth, margin + strokeWidth], // TR
			[100 - margin - strokeWidth, margin + strokeWidth], // TL
		],
		// middle line
		[
			[margin + strokeWidth, 50 - strokeWidth - margin],
			[100 - margin - strokeWidth, 50 - strokeWidth - margin],
		],
		// bottom line
		[
			[100 - margin - strokeWidth, margin + strokeWidth], // BR
			[100 - margin - strokeWidth, 100 - margin - strokeWidth],
		],
	];

	return (
		<svg
			className={classNames(style.Hamburger, className)}
			role="img"
			{...props}
			viewBox="0 0 1 1"
		>
			<svg height={1} width={1} x={0} y={0}>
				{lines
					.map(l => l.map(pt => pt.map(scalar => percent(scalar))))
					.map(([[x1, y1], [x2, y2]], i) => (
						<line
							key={i}
							strokeWidth={strokeWidth}
							{...{ x1, y1, x2, y2 }}
						/>
					))}
			</svg>
		</svg>
	);
};
