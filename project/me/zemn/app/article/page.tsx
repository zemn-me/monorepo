import { Metadata } from 'next/types';

import { articles } from '#root/project/me/zemn/app/article/articles.js';
import style from '#root/project/me/zemn/app/article/page.module.css';
import * as bio from '#root/project/me/zemn/bio/index.js';
import { dividerHeadingClass } from '#root/project/me/zemn/components/DividerHeading/index.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { romanize } from '#root/project/me/zemn/components/timeline/roman.js';

const articlesByYear = Map.groupBy(articles, article =>
	article.publishedAt.getFullYear()
);

function formatDate(date: Date, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'long',
	}).format(date);
}

export default function Page() {
	return (
		<div className={style.page}>
			<h1 className={dividerHeadingClass}>
				<span>Articles.</span>
			</h1>
			<p className={style.introduction}>
				Essays, letters, and notes, arranged by publication date.
			</p>
			<ol aria-label="Published articles" className={style.years}>
				{[...articlesByYear].map(([year, yearArticles]) => {
					const age = year - bio.Bio.birthdate.getFullYear();
					const headingId = `articles-${year}`;

					return (
						<li className={style.year} key={year}>
							<section aria-labelledby={headingId}>
								<header className={style.yearHeading}>
									<h2 id={headingId}>{year}</h2>
									<span
										aria-label={`Age ${age}`}
										className={style.age}
										lang="zxx-u-nu-romanlow"
									>
										{romanize(age)}
									</span>
								</header>
								<ol className={style.entries}>
									{yearArticles.map(article => (
										<li className={style.entry} key={article.href}>
											<time
												className={style.date}
												dateTime={article.dateTime}
												lang={article.language}
											>
												{formatDate(
													article.publishedAt,
													article.language
												)}
											</time>
											<article className={style.article}>
												<h3>
													<Link
														href={article.href}
														lang={article.language}
													>
														{article.title}
													</Link>
												</h3>
												{article.description ? (
													<p lang={article.language}>
														{article.description}
													</p>
												) : null}
											</article>
										</li>
									))}
								</ol>
							</section>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

export const metadata: Metadata = {
	title: 'Articles',
	description: 'Essays, letters, and notes by Thomas NJ Shadwell.',
};
