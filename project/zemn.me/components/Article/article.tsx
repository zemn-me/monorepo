import { ArticleProps } from '#root/project/zemn.me/components/Article/article_types.js';
import style from '#root/project/zemn.me/components/Article/style.module.css';
import { Date } from '#root/ts/react/lang/date.js';
import { date } from '#root/ts/time/index.js';

export function Article(props: ArticleProps) {
	return <div className={style.container}>
		<article>
			{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
			<Date date={date.parse(props.date as any)}/>
			{props.children}
		</article>
	</div>
}

