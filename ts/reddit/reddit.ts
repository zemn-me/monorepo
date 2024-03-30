import { z } from 'zod';

export const RedditStatusFailed = z.object({
	status: z.literal('failed'),
});

export const RedditMediaMetadata = z.object({
	e: z.literal('Image'),
	s: z.object({
		u: z.string().url(),
		x: z.number(),
		y: z.number(),
	}),
	status: z.literal('valid'),
});

export const RedditPost = z.object({
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
		.record(z.string(), z.union([RedditMediaMetadata, RedditStatusFailed]))
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

export const RedditSearchResponse = z.object({
	data: z
		.object({
			children: z
				.array(
					z.object({
						data: RedditPost,
					})
				)
				.optional()
				.nullable(),
		})
		.optional()
		.nullable(),
});
