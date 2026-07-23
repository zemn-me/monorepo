'use client';
import { useContext, useEffect, useMemo, useState } from 'react';
import type { Article } from 'schema-dts';

import { schema } from '#root/project/me/zemn/bio/schema.js';
import style from '#root/project/me/zemn/components/Article/style.module.css';
import { tocSegment } from '#root/project/me/zemn/components/Article/toc_context.js';
import { ArticleProps } from '#root/project/me/zemn/components/Article/types/article_types.js';
import { gladeMenuTopContentContext } from '#root/project/me/zemn/components/Glade/menu_top_content_context.js';
import { Date as LocalizedDate } from '#root/ts/react/lang/date.js';
import { Schema } from '#root/ts/schema.org/schema.js';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date.js';

export function Article(props: ArticleProps) {
	const [articleToc, setArticleToc] = useState<HTMLUListElement | null>(null);
	const [menuToc, setMenuToc] = useState<HTMLUListElement | null>(null);
	const setGladeMenuTopContent = useContext(gladeMenuTopContentContext);
	const menuTocContent = useMemo(
		() => (
			<section
				aria-label="Article contents"
				className={style.menuTocSection}
			>
				<h2 className={style.menuTocHeading}>Contents</h2>
				<nav className={style.menuToc}>
					<ul ref={setMenuToc} />
				</nav>
			</section>
		),
		[]
	);

	useEffect(() => {
		if (setGladeMenuTopContent === null) {
			return;
		}

		setGladeMenuTopContent(menuTocContent);
		return () => setGladeMenuTopContent(null);
	}, [menuTocContent, setGladeMenuTopContent]);

	const tocTargets = [articleToc, menuToc].filter(
		(toc): toc is HTMLUListElement => toc !== null
	);

	return (
		<div className={style.container} data-article-layout={props.layout}>
			<article>
				{props.date ? (
					<LocalizedDate
						date={nativeDateFromUnknownSimpleDate.parse(props.date)}
					/>
				) : null}
				<nav>
					<ul ref={setArticleToc} />
				</nav>
				<tocSegment.Provider value={tocTargets}>
					{props.children}
				</tocSegment.Provider>
				<Schema>
					{{
						'@context': 'https://schema.org',
						'@type': 'Article',
						author: [schema],
						headline: props.title,
						datePublished: props.date
							? nativeDateFromUnknownSimpleDate
									.parse(props.date)
									.toISOString()
							: undefined,
					}}
				</Schema>
			</article>
		</div>
	);
}
