import { useRouter } from 'next/router'
import Path from 'path'
import * as articles from 'linear2/features/articles'
import * as next from 'next'
import style from './style.module.sass'
import Render from 'linear2/features/md/render'
import * as unist from 'unist'
import { articleBase } from '.'
import { makeYears, Timeline } from 'linear2/features/elements/timeline'

import * as bio from 'lib/bio'
import * as e from 'linear2/features/elements'

interface StaticPropsContext extends next.GetStaticPropsContext {
	params: {
		path: string[]
	}
}

export async function getStaticProps(context: StaticPropsContext) {
	const { title, ast, edits } = new articles.Article({
		dirPath: Path.parse(
			Path.join('pages', 'article', ...context?.params?.path),
		),
	})
	const content = {
		props: {
			ast: await ast,
			title: await title,
			edits: await edits,
		},
	}

	return JSON.parse(JSON.stringify(content))
}

export const getStaticPaths: next.GetStaticPaths = async () => {
	return articles.pathsIn(...articleBase)
}

const writings = bio.timeline
	.filter((event) => event?.tags?.some((tag) => tag == bio.writing))
	.sort(({ date: a }, { date: b }) => +a - +b)

const clamp = (v: number, min = -Infinity, max = Infinity) => {
	if (v < min) return min
	if (v > max) return max
	return v
}

const lim = 30

function NiceList({
	children,
	idx = 0,
	connector = <>and</>,
}: {
	children: React.ReactElement[]
	idx?: number
	connector?: React.ReactElement
}) {
	if (children.length == 0) return null
	if (children.length == 1 && idx > 0)
		return (
			<>
				{connector} {children[0]}
			</>
		)
	return (
		<>
			{children[0]},{' '}
			<NiceList
				{...{
					children: children.slice(1),
					idx: idx + 1,
					connector,
				}}
			/>
		</>
	)
}

export default function Article(props: {
	ast: unist.Node
	title: unist.Node
	edits: Date[]
}) {
	let { edits } = props
	edits = edits.sort((a, b) => +a - +b)
	const router = useRouter()
	const isInTimeline = writings.findIndex(
		(e) =>
			e.url &&
			e.url.hostname == 'zemn.me' &&
			e.url.pathname == router.asPath,
	)

	const timeline =
		isInTimeline == -1
			? writings.slice(0, lim)
			: writings.slice(
					clamp(isInTimeline - lim, 0),
					clamp(isInTimeline + lim, writings.length - isInTimeline),
			  )

	return (
		<div className={style.ArticlePage}>
			<Timeline
				years={makeYears(timeline)}
				lang="en-GB"
				className={style.Timeline}
				indicateCurrent
			/>
			<div className={style.Article}>
				<Render node={props.ast} />
				&lsquo;
				<Render node={props.title} />
				&rsquo;
				{props.edits.length ? (
					<>
						{' '}
						was written on{' '}
						<e.date date={new Date(edits[0])}>
							<e.dateText
								year="numeric"
								month="long"
								day="numeric"
							/>
						</e.date>
					</>
				) : null}
				{props.edits.length > 1 ? (
					<>
						{' '}
						and edited{' '}
						{
							<NiceList>
								{edits.slice(1).map((d, i) => (
									<e.date key={i} date={new Date(d)}>
										<e.dateText
											month="short"
											year="numeric"
											day="numeric"
										/>
									</e.date>
								))}
							</NiceList>
						}
						.
					</>
				) : (
					''
				)}
			</div>
		</div>
	)
}
