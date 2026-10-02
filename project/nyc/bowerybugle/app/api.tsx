import { useMutation, useQueryClient } from '@tanstack/react-query';
import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import { createContext, type ReactNode, useContext } from 'react';
import type {
	components,
	paths,
} from '#root/project/nyc/bowerybugle/api/api_client.gen.js';

export type Issue = components['schemas']['Issue'];

function data<T>(result: {
	data?: T;
	error?: components['schemas']['Problem'];
}): T {
	if (result.error) throw new Error(result.error.error);
	if (result.data === undefined) throw new Error('Please try again.');
	return result.data;
}

// Each deployed site uses a sibling API host, keeping cookies off the static site.
export function apiOrigin(siteOrigin: string): string {
	const url = new URL(siteOrigin);
	url.hostname = `api.${url.hostname}`;
	return url.origin;
}
export class API {
	readonly fetchClient;
	readonly queries;
	constructor(readonly origin: string) {
		this.fetchClient = createFetchClient<paths>({
			baseUrl: origin,
			credentials: 'include',
			cache: 'no-store',
			fetch: (...args) => globalThis.fetch(...args),
		});
		this.fetchClient.use({
			async onResponse({ response }) {
				if (!response.ok) {
					const body: unknown = await response
						.clone()
						.json()
						.catch(() => null);
					throw new Error(
						body &&
							typeof body === 'object' &&
							'error' in body &&
							typeof body.error === 'string'
							? body.error
							: 'Please try again.'
					);
				}
			},
		});
		this.queries = createClient(this.fetchClient);
	}
	url(path: string) {
		return new URL(path, this.origin).href;
	}
	issues() {
		return this.queries.queryOptions('get', '/api/issues', {
			baseUrl: this.origin,
		});
	}
	session() {
		return this.queries.queryOptions(
			'get',
			'/api/session',
			{ baseUrl: this.origin },
			{ retry: false }
		);
	}
	async requestLogin(email: string) {
		return data(
			await this.fetchClient.POST('/api/login', { body: { email } })
		);
	}
	async confirmLogin(token: string) {
		return data(
			await this.fetchClient.POST('/api/login/confirm', {
				body: { token },
			})
		);
	}
	async logout() {
		return data(await this.fetchClient.POST('/api/logout'));
	}
	async upload(number: number, file: File) {
		if (
			!file.name.toLowerCase().endsWith('.pdf') ||
			file.size < 5 ||
			file.size > 50 * 1024 * 1024
		)
			throw new Error('Choose a PDF up to 50 MB.');
		const prepared = data(
			await this.fetchClient.POST('/api/uploads', {
				body: { number, size: file.size },
			})
		);
		const body = new FormData();
		for (const [key, value] of Object.entries(prepared.fields))
			body.append(key, value);
		body.append('file', file);
		const response = await fetch(prepared.url, {
			method: 'POST',
			body,
			credentials: 'omit',
		});
		if (!response.ok)
			throw new Error('The upload failed. Please try again.');
		await this.fetchClient.POST('/api/uploads/{id}/publish', {
			params: { path: { id: prepared.id } },
		});
	}
}
const APIContext = createContext<API | null>(null);
export function APIProvider({
	api,
	children,
}: {
	api: API;
	children: ReactNode;
}) {
	return <APIContext value={api}>{children}</APIContext>;
}
export function useAPI() {
	const api = useContext(APIContext);
	if (!api) throw new Error('APIProvider is missing');
	return api;
}
export type Edit =
	| { kind: 'add' | 'delete' | 'remove'; number: number }
	| { kind: 'upload'; number: number; file: File };
export function useEdit() {
	const api = useAPI();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (edit: Edit) => {
			switch (edit.kind) {
				case 'add':
					await api.fetchClient.POST('/api/issues', {
						body: { number: edit.number },
					});
					return `Issue ${edit.number} added.`;
				case 'delete':
					await api.fetchClient.DELETE('/api/issues/{number}', {
						params: { path: { number: edit.number } },
					});
					return `Issue ${edit.number} deleted.`;
				case 'remove':
					await api.fetchClient.DELETE('/api/issues/{number}/pdf', {
						params: { path: { number: edit.number } },
					});
					return `PDF removed from issue ${edit.number}.`;
				case 'upload':
					await api.upload(edit.number, edit.file);
					return `Issue ${edit.number} is published.`;
			}
		},
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: api.issues().queryKey });
		},
	});
}
