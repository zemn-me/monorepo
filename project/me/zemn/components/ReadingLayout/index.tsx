import { type ReactNode, useCallback, useRef } from 'react';
import style from '#root/project/me/zemn/components/ReadingLayout/style.module.css';

/**
 * Keeps the companion portal beside the reading column when both fit.
 * Sticky controls in the reading column can use --reading-stacked-height.
 */
export function ReadingLayout({
	heading,
	companionRef,
	children,
}: {
	readonly heading: ReactNode;
	readonly companionRef: (element: HTMLDivElement | null) => void;
	readonly children: ReactNode;
}) {
	const layout = useRef<HTMLDivElement>(null);
	const attachCompanion = useCallback(
		(element: HTMLDivElement | null) => {
			companionRef(element);
			if (!element) return;
			const observer = new ResizeObserver(([size]) => {
				const box = size?.borderBoxSize[0];
				if (box)
					layout.current?.style.setProperty(
						'--reading-companion-height',
						`${box.blockSize}px`
					);
			});
			observer.observe(element, { box: 'border-box' });
			return () => {
				observer.disconnect();
				companionRef(null);
			};
		},
		[companionRef]
	);
	return (
		<div className={style.frame}>
			<div className={style.layout} ref={layout}>
				<header className={style.heading}>{heading}</header>
				<div className={style.track}>
					<div className={style.companion} ref={attachCompanion} />
				</div>
				<div className={style.content}>{children}</div>
			</div>
		</div>
	);
}
