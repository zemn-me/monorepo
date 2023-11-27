import style from 'project/zemn.me/next/components/ScrollUpMenu/index.module.css';
import React from 'react';

export interface Props {
	readonly children: [menu: React.ReactNode, main: React.ReactNode];
}

export function ScrollUpMenu({ children: [menu, main] }: Props) {
	const mainRef = React.useRef<HTMLDivElement | null>(null);
	React.useEffect(() => {
		if (mainRef?.current)
			mainRef.current.scrollIntoView({
				behavior: 'instant',
				block: 'nearest',
				inline: 'start',
			});
	}, []);
	return (
		<div className={style.container}>
			<div className={style.menu}>{menu}</div>
			<div className={style.content} ref={mainRef}>
				{main}
			</div>
		</div>
	);
}
