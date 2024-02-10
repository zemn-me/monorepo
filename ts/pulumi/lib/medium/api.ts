/**
 * @fileoverview library for interacting with the Medium API
 */
import { z } from 'zod';

import { map, zip2 } from '#root/ts/iter/index.js';

// maybe should include types for response codes etc
function mediumResponse<T extends z.ZodTypeAny>(schema: T) {
	return z.object({
		data: schema,
	});
}

export const user = z.object({
	id: z.string(),
	username: z.string(),
	name: z.string(),
	url: z.string().url(),
});

export const Publication = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	url: z.string().url(),
	imageUrl: z.string().url(),
});

const apiBase = new URL('https://api.medium.com');

const endpoint = (template: TemplateStringsArray, ...params: string[]) => {
	const r = new URL(apiBase);
	r.pathname = [
		...zip2(
			template,
			map(params, v => encodeURIComponent(v))
		),
	].join('/');
	return r;
};

function rest<P extends unknown[], S extends z.ZodTypeAny>(
	f: (...p: P) => Request,
	schema: S
) {
	return async (...p: P) =>
		schema.parseAsync(await fetch(f(...p)).then(b => b.json()));
}

function withAuthorization<P extends unknown[]>(f: (...p: P) => Request) {
	return (auth: `bearer ${string}`, ...p: P) => {
		const r = f(...p);
		r.headers.set('authorization', auth);
		return r;
	};
}

export const me = rest(
	withAuthorization(() => new Request(endpoint`/v1/me`)),
	mediumResponse(user)
);

export const userPublications = rest(
	withAuthorization(
		(userId: string) =>
			new Request(endpoint`/v1/users/${userId}/publications`)
	),
	mediumResponse(z.array(Publication))
);

export const publicationContributors = rest(
	withAuthorization(
		(publicationId: string) =>
			new Request(
				endpoint`/v1/publications/${publicationId}/contributors`
			)
	),
	mediumResponse(
		z.array(
			z.object({
				publicationId: z.string(),
				userId: z.string(),
				role: z.string(),
			})
		)
	)
);

export const publishStatus = z.enum(['public', 'draft', 'unlisted']);
export const license = z.enum([
	'all-rights-reserved',
	'cc-40-by',
	'cc-40-by-sa',
	'cc-40-by-nd',
	'cc-40-by-nc',
	'cc-40-by-nc-nd',
	'cc-40-by-nc-sa',
	'cc-40-zero',
	'public-domain',
]);

export const PostRequest = z.object({
	title: z.string(),
	contentFormat: z.enum(['html', 'markdown']),
	content: z.string(),
	tags: z.optional(z.array(z.string())),
	canonicalUrl: z.optional(z.string().url()),
	publishStatus: z.optional(publishStatus),
	license: z.optional(license),
	notifyFollowers: z.optional(z.boolean()),
});

export const PostResponse = z.object({
	id: z.string(),
	title: z.string(),
	authorId: z.string(),
	tags: z.array(z.string()),
	url: z.string().url(),
	canonicalUrl: z.string().url(),
	publishStatus,
	publishedAt: z.number(),
	license,
	licenseUrl: z.string(),
});

const jsonRequest = (target: URL, json: unknown) => {
	const r = new Request(target, { body: JSON.stringify(json) });
	r.headers.set('content-type', 'application/json');
	return r;
};

export const createPost = rest(
	withAuthorization((authorId: string, post: z.TypeOf<typeof PostRequest>) =>
		jsonRequest(endpoint`/v1/users/${authorId}/posts`, post)
	),
	mediumResponse(PostResponse)
);
