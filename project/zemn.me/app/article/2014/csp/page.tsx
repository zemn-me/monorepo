'use client';
import { default as Content, frontmatter as metadata } from '#root/mdx/article/2014/csp';
import { HeroVideo } from '#root/project/zemn.me/components/HeroVideo/hero_video.js';
import style from '#root/project/zemn.me/app/article/2014/csp/style.module.css';
import { date }  from '#root/ts/time/index.js';
import { Date } from '#root/ts/react/lang/date.js';



export default function Page() {
	return <div className={style.container}>
		<HeroVideo className={style.heroVideo} />
		<article>
			<Date date={date.parse(metadata.date)}/>
			<Content/>
		</article>
	</div>
}
