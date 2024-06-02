'use client';
import { default as Content } from '#root/mdx/article/2014/csp';
import { HeroVideo } from '#root/project/zemn.me/components/HeroVideo/hero_video.js';
import style from '#root/project/zemn.me/app/article/2014/csp/style.module.css';


export default function Page() {
	return <div className={style.article}>
		<HeroVideo/>
		<Content/>
	</div>
}
