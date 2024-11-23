"use client";
import { useState } from 'react';

import { tocSegment } from '#root/project/zemn.me/components/Article/toc_context.js'
import { ArticleProps } from '#root/project/zemn.me/components/Article/types/article_types.js';
import { Date } from '#root/ts/react/lang/date.js';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date.js';

export function Article({ className, ...props}: ArticleProps) {
	const [toc, setToc] = useState<HTMLUListElement|null>(null);
	return <article className={className}>
			{props.date ? <Date date={nativeDateFromUnknownSimpleDate.parse(props.date)} /> : null}
			<nav>
				<ul ref={setToc}/>
			</nav>
			<tocSegment.Provider value={toc}>
			{props.children}
			</tocSegment.Provider>
		</article>
}

