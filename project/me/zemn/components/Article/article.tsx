'use client';
import { useState } from 'react';

import { PersonMicrodata } from '#root/project/me/zemn/bio/schema.js';
import style from '#root/project/me/zemn/components/Article/style.module.css';
import { tocSegment } from '#root/project/me/zemn/components/Article/toc_context.js';
import { ArticleProps } from '#root/project/me/zemn/components/Article/types/article_types.js';
import { Date as LocalizedDate } from '#root/ts/react/lang/date.js';
import {
	DataProperty,
	itemPropScope,
	itemScope,
} from '#root/ts/schema.org/schema.js';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date.js';

export function Article(props: ArticleProps) {
	const [toc, setToc] = useState<HTMLUListElement | null>(null);
	const publishedDate = props.date
		? nativeDateFromUnknownSimpleDate.parse(props.date)
		: undefined;
	return (
		<div className={style.container}>
			<article {...itemScope('Article')}>
				<span
					hidden
					{...itemPropScope('Article', 'author', 'Person')}
				>
					<PersonMicrodata />
				</span>
				{props.title ? (
					<DataProperty
						item="Article"
						name="headline"
						value={props.title}
					/>
				) : null}
				{publishedDate ? (
					<>
						<LocalizedDate date={publishedDate} />
						<DataProperty
							item="Article"
							name="datePublished"
							value={publishedDate}
						/>
					</>
				) : null}
				<nav>
					<ul ref={setToc} />
				</nav>
				<tocSegment.Provider value={toc}>
					{props.children}
				</tocSegment.Provider>
			</article>
		</div>
	);
}
