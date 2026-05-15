'use client';

import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import {
	cameraPoseAtProgress,
	clampProgress,
	createEndingsWorld,
	cueStatesAtProgress,
	darknessAtProgress,
	type RenderedPolygon,
	renderEndingsScene,
	SCROLL_LENGTH_VH,
	type StoryCueState,
	SVG_HEIGHT,
	SVG_WIDTH,
} from '#root/project/endings/app/scene.js';
import style from '#root/project/endings/app/style.module.css';
import { is_err, unwrap, unwrap_err } from '#root/ts/result/result.js';

interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

const world = createEndingsWorld();

function scrollProgress(): number {
	const maxScroll =
		document.documentElement.scrollHeight - window.innerHeight;
	if (maxScroll <= 0) {
		return 0;
	}

	return clampProgress(window.scrollY / maxScroll);
}

function cueStyle(cue: StoryCueState): CSSProperties {
	return {
		opacity: cue.opacity,
		transform: `translate3d(0, ${cue.translateY.toFixed(2)}px, 0)`,
		pointerEvents: cue.opacity > 0.02 ? 'auto' : 'none',
	};
}

function svgPointsBounds(polygon: RenderedPolygon): string {
	return polygon.points;
}

export function EndingsClient() {
	const viewportRef = useRef<SVGSVGElement | null>(null);
	const frameRequestedRef = useRef(false);
	const [progress, setProgress] = useState(0);
	const [viewportSize, setViewportSize] = useState<ViewportSize>({
		width: SVG_WIDTH,
		height: SVG_HEIGHT,
	});

	useEffect(() => {
		function syncViewportSize() {
			const bounds = viewportRef.current?.getBoundingClientRect();
			if (bounds == null) {
				return;
			}

			const width = Math.max(1, Math.round(bounds.width));
			const height = Math.max(1, Math.round(bounds.height));
			setViewportSize(current =>
				current.width === width && current.height === height
					? current
					: { width, height }
			);
		}

		function scheduleProgressUpdate() {
			if (frameRequestedRef.current) {
				return;
			}

			frameRequestedRef.current = true;
			window.requestAnimationFrame(() => {
				frameRequestedRef.current = false;
				setProgress(scrollProgress());
				syncViewportSize();
			});
		}

		syncViewportSize();
		setProgress(scrollProgress());
		window.addEventListener('scroll', scheduleProgressUpdate, {
			passive: true,
		});
		window.addEventListener('resize', scheduleProgressUpdate);

		return () => {
			window.removeEventListener('scroll', scheduleProgressUpdate);
			window.removeEventListener('resize', scheduleProgressUpdate);
		};
	}, []);

	const pose = useMemo(() => cameraPoseAtProgress(progress), [progress]);
	const renderedResult = useMemo(
		() =>
			renderEndingsScene(
				world,
				pose,
				viewportSize.width,
				viewportSize.height
			),
		[pose, viewportSize.height, viewportSize.width]
	);
	const cues = useMemo(() => cueStatesAtProgress(progress), [progress]);
	const darkness = darknessAtProgress(progress);
	const rendered = is_err(renderedResult) ? null : unwrap(renderedResult);
	const renderError = is_err(renderedResult)
		? unwrap_err(renderedResult)
		: null;

	return (
		<main
			className={style.shell}
			style={
				{
					'--ending-progress': progress,
					'--ending-darkness': darkness,
					minHeight: `${SCROLL_LENGTH_VH}vh`,
				} as CSSProperties
			}
		>
			<section className={style.stage} aria-label="Endings">
				<svg
					aria-label="A scroll-driven sunset, hill, and bench scene"
					className={style.viewport}
					ref={viewportRef}
					role="img"
					viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
				>
					<defs>
						<linearGradient
							id="endingsSky"
							x1="0"
							x2="0"
							y1="0"
							y2="1"
						>
							<stop offset="0%" stopColor="#4a2144" />
							<stop offset="36%" stopColor="#c45d4a" />
							<stop offset="64%" stopColor="#f0a052" />
							<stop offset="100%" stopColor="#3a161b" />
						</linearGradient>
						<radialGradient
							id="endingsSun"
							cx="50%"
							cy="50%"
							r="50%"
						>
							<stop offset="0%" stopColor="#fff4b8" />
							<stop offset="56%" stopColor="#ffd36b" />
							<stop offset="100%" stopColor="#ef7a3d" />
						</radialGradient>
						<radialGradient
							id="endingsSunHaze"
							cx="50%"
							cy="50%"
							r="50%"
						>
							<stop
								offset="0%"
								stopColor="#ffd36b"
								stopOpacity="0.42"
							/>
							<stop
								offset="58%"
								stopColor="#f07c48"
								stopOpacity="0.16"
							/>
							<stop
								offset="100%"
								stopColor="#f07c48"
								stopOpacity="0"
							/>
						</radialGradient>
					</defs>
					<rect
						fill="url(#endingsSky)"
						height={viewportSize.height}
						width={viewportSize.width}
					/>
					<rect
						className={style.skyShade}
						height={viewportSize.height}
						width={viewportSize.width}
					/>
					{rendered?.sun.visible ? (
						<>
							<circle
								cx={rendered.sun.cx}
								cy={rendered.sun.cy}
								fill="url(#endingsSunHaze)"
								r={rendered.sun.radius * 2.5}
							/>
							<circle
								cx={rendered.sun.cx}
								cy={rendered.sun.cy}
								fill="url(#endingsSun)"
								r={rendered.sun.radius}
							/>
						</>
					) : null}
					{rendered?.polygons.map(polygon => (
						<polygon
							fill={polygon.fill}
							key={polygon.id}
							opacity={polygon.opacity}
							points={svgPointsBounds(polygon)}
						/>
					))}
					{rendered?.segments.map((segment, index) => (
						<line
							key={`${index}:${segment.depth.toFixed(3)}`}
							opacity={Math.min(1, segment.opacity * 1.55)}
							stroke={segment.stroke}
							strokeLinecap="round"
							strokeWidth={segment.width}
							x1={segment.x1}
							x2={segment.x2}
							y1={segment.y1}
							y2={segment.y2}
						/>
					))}
					<rect
						className={style.blackout}
						height={viewportSize.height}
						width={viewportSize.width}
					/>
				</svg>
				<div className={style.textLayer} aria-live="polite">
					<div className={style.textRun}>
						{cues.map(cue => (
							<p
								className={style.cue}
								key={cue.id}
								style={cueStyle(cue)}
							>
								{cue.text.replaceAll('--', '\u2013')}
							</p>
						))}
					</div>
					{renderError != null ? (
						<p className={style.renderError}>
							Render degraded: {renderError.message}
						</p>
					) : null}
				</div>
			</section>
		</main>
	);
}
