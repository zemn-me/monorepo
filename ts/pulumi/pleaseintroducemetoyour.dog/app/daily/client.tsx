'use client';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useCallback, useRef } from 'react';
import { z } from 'zod';

import Link from '#root/project/zemn.me/components/Link/index.js';
import { isDefined, isNotNull } from '#root/ts/guard.js';
import { isString } from '#root/ts/guards.js';

export const PostProps = z.object({
	media: z
		.object({
			reddit_video: z
				.object({
					dash_url: z.string().optional().nullable(),
					hls_url: z.string().optional().nullable(),
					fallback_url: z.string().optional().nullable(),
					scrubber_media_url: z.string().optional().nullable(),
				})
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
	isGallery: z.boolean().optional().nullable(),
	url: z.string().optional().nullable(),
	permalink: z.string().optional().nullable(),
	title: z.string(),
	media_metadata: z
		.record(
			z.string(),
			z.object({
				e: z.literal('Image'),
				s: z.object({
					u: z.string().url(),
					x: z.number(),
					y: z.number(),
				}),
			})
		)
		.optional()
		.nullable(),

	preview: z
		.object({
			images: z
				.array(
					z.object({
						source: z
							.object({
								height: z.number(),
								width: z.number(),
								url: z.string().url(),
							})
							.optional()
							.nullable(),
					})
				)
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
});

const SearchResponseProps = z.object({
	data: z
		.object({
			children: z
				.array(
					z.object({
						data: PostProps,
					})
				)
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
});

function Post(post: z.TypeOf<typeof PostProps>) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const onClick = useCallback(() => void videoRef.current?.play(), []);
	const video = post.media?.reddit_video;
	const videoUrls = [
		video?.hls_url,
		video?.dash_url,
		video?.fallback_url,
	].filter(isString);

	const metadataMedia = [...Object.values(post.media_metadata ?? {})];
	return (
		<article
			className={classNames('post', post.media ? 'media' : undefined)}
			onClick={onClick}
		>
			{post.permalink ? (
				<Link href={'https://reddit.com' + post.permalink}>
					<header>{post.title}</header>
				</Link>
			) : null}
			{metadataMedia.length !== 0 ? (
				<>
					{metadataMedia.map(v => (
						<img
							key={v.s.u}
							src={v.s.u}
							style={{
								display: 'block',
								maxWidth: v.s.x,
								maxHeight: v.s.y,
								width: '100%',
								objectFit: 'cover',
								height: 'auto',
							}}
						/>
					))}
				</>
			) : null}
			{videoUrls.length !== 0 ? (
				<video autoPlay loop muted playsInline ref={videoRef}>
					{videoUrls.map(source =>
						source ? <source key={source} src={source} /> : null
					)}
				</video>
			) : null}

			{post.preview?.images
				? post.preview.images
						.map(v => v.source)
						.filter(isDefined)
						.filter(isNotNull)
						.map(v => (
							<img
								key={v.url}
								src={v.url}
								style={{
									display: 'block',
									maxWidth: v.width,
									maxHeight: v.height,
									width: '100%',
									objectFit: 'cover',
									height: 'auto',
								}}
							/>
						))
				: null}
		</article>
	);
}

const placeHolderData: z.TypeOf<typeof SearchResponseProps> = {
	data: {
		children: [
			{
				data: {
					title: 'a Lovely Dog!',
				},
			},

			{
				data: {
					title: 'my goodness!',
				},
			},

			{
				data: {
					title: 'hims ?',
				},
			},
		],
	},
};

export function DogsOfTheDay() {
	const doggs = useQuery(
		['doggs!'],
		(): Promise<z.TypeOf<typeof SearchResponseProps>> =>
			fetch(
				`https://www.reddit.com/r/aww/search.json?raw_json=1&q=dog&sort=top&t=day&restrict_sr=1`
			)
				.then(r => r.json())
				.then(j => SearchResponseProps.parseAsync(j)),
		{
			placeholderData: placeHolderData,
		}
	);

	return (
		<>
			<h1>Top doggoes of the day!!</h1>
			{doggs.isLoading ? `we are loading the dogs!! 🐕 🐶` : null}
			{doggs.isError ? (
				<p>
					we had an issue loading the doggs... 🐕😭 ...{' '}
					<pre>{`${doggs.error}`}</pre> ...
				</p>
			) : null}
			{doggs.data?.data?.children?.map((post, i) => (
				<Post key={i} {...post.data} />
			)) ?? null}
			<h1>That’s all for today ‼️ Check back tomorrow 🐕</h1>
			<footer>for baby 2016-{new Date().getFullYear()}</footer>
		</>
	);
}
