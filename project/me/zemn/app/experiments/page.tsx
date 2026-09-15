import { Metadata } from 'next/types';

import { experimentGroups } from '#root/project/me/zemn/app/experiments/experiments.js';
import style from '#root/project/me/zemn/app/experiments/page.module.css';
import { dividerHeadingClass } from '#root/project/me/zemn/components/DividerHeading/index.js';
import Link from '#root/project/me/zemn/components/Link/index.js';

export default function Page() {
	return (
		<div className={style.page}>
			<h1 className={dividerHeadingClass}>
				<span>Experiments.</span>
			</h1>
			<p className={style.introduction}>
				Small tools, visual studies, games, and unfinished ideas.
			</p>
			<ol aria-label="Experiments" className={style.groups}>
				{experimentGroups.map(group => {
					const headingId = `experiments-${group.title
						.toLowerCase()
						.replaceAll(/[^a-z0-9]+/g, '-')}`;

					return (
						<li className={style.group} key={group.title}>
							<section aria-labelledby={headingId}>
								<header className={style.groupHeading}>
									<h2 id={headingId}>{group.title}</h2>
									<span className={style.count}>
										{group.experiments.length.toString().padStart(2, '0')}
									</span>
								</header>
								<ol className={style.entries}>
									{group.experiments.map(experiment => (
										<li className={style.entry} key={experiment.href}>
											<article className={style.experiment}>
												<h3>
													<Link href={experiment.href}>
														{experiment.title}
													</Link>
												</h3>
												<p>{experiment.description}</p>
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
	title: 'Experiments',
	description: 'Small tools, visual studies, games, and unfinished ideas.',
};
