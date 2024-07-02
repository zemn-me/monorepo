import { ArticleProps } from '#root/project/zemn.me/components/Article/article_types';
import style from '#root/project/zemn.me/components/Article/style.module.css';
import { Date } from '#root/ts/react/lang/date';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date';

export function Article(props: ArticleProps) {
	return <div className={style.container}>
		<article>
			<Date date={nativeDateFromUnknownSimpleDate.parse(props.date)}/>
			{props.children}
		</article>
	</div>
}


