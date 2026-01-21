import { ReactNode } from "react"

import Link from "#root/project/zemn.me/components/Link/Link.js"
import { Date } from "#root/ts/react/lang/date.js"

export interface TweetAutoLinkProps {
	readonly children: string
}

export function TwitterAutoLink(props: TweetAutoLinkProps) {
	return <Link href={props.children}>
		{props.children}
	</Link>
}

export interface TwitterUserTagProps {
	readonly children: `@${string}`
}

export function TwitterUserTag(props: TwitterUserTagProps) {
	const username = props.children.slice(1);
	return <Link href={`https://twitter.com/${username}`}>
		{props.children}
	</Link>
}

export interface TwitterHashtagProps {
	readonly children: `#${string}`
}

export function TwitterHashtag({children: tag}: TwitterHashtagProps) {
	const hashText = tag.slice(1);
	return <Link href={`https://twitter.com/hashtag/${hashText}`}>
		{tag}
	</Link>
}

export interface Tweet {
	readonly date: Date
	readonly author: {
		displayname: ReactNode
		username: `@${string}`
	},
	readonly url: string
	readonly children: ReactNode
}

export type TweetProps = Tweet

export function Tweet(props: TweetProps) {
	return <blockquote>
		{props.children} — {props.author.displayname} (<TwitterUserTag>{props.author.username}</TwitterUserTag>) <Date date={props.date}/>
	</blockquote>
}
