"use client";
import { useState } from 'react';

import { ArticleProps } from '#root/project/zemn.me/components/Article/article_types.js';
import style from '#root/project/zemn.me/components/Article/style.module.css';
import { tocSegment } from '#root/project/zemn.me/components/Article/toc_context.js'
import { Date } from '#root/ts/react/lang/date.js';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date.js';

export function Article(props: ArticleProps) {
	const [toc, setToc] = useState<HTMLUListElement|null>(null);
	return <div className={style.container}>
		<article>
			{props.date ? <Date date={nativeDateFromUnknownSimpleDate.parse(props.date)} /> : null}
			<nav>
				<ul ref={setToc}/>
			</nav>
			<tocSegment.Provider value={toc}>
			{props.children}
			</tocSegment.Provider>
		</article>
	</div>
}

