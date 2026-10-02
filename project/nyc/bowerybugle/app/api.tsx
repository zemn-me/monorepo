import {
	queryOptions,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query';
import { createContext, type ReactNode, useContext } from 'react';

export interface Issue {
	number: number;
	pdf?: string;
	size?: number;
}
interface Session {
	authenticated: boolean;
}
interface Upload {
	id: string;
	url: string;
	fields: Record<string, string>;
}

// Each deployed site uses a sibling API host, keeping cookies off the static site.
export function apiOrigin(siteOrigin: string): string {
	const url = new URL(siteOrigin);
	url.hostname = `api.${url.hostname}`;
	return url.origin;
}
export class API {
	constructor(readonly origin: string) {}
	url(path: string) {
		return new URL(path, this.origin).href;
	}
	async request<T>(
		path: string,
		body?: unknown,
		method = body === undefined ? 'GET' : 'POST',
		signal?: AbortSignal
	): Promise<T> {
		const response = await fetch(this.url(path), {
			method,
			signal,
			credentials: 'include',
			cache: 'no-store',
			...(body === undefined
				? {}
				: {
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					}),
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'Please try again.');
		return data;
	}
	issues() {
		return queryOptions({
			queryKey: ['issues', this.origin],
			queryFn: ({ signal }) =>
				this.request<{ issues: Issue[] }>(
					'/api/issues',
					undefined,
					'GET',
					signal
				),
		});
	}
	session() {
		return queryOptions({
			queryKey: ['session', this.origin],
			queryFn: ({ signal }) =>
				this.request<Session>('/api/session', undefined, 'GET', signal),
			retry: false,
		});
	}
	async upload(number: number, file: File) {
		if (
			!file.name.toLowerCase().endsWith('.pdf') ||
			file.size < 5 ||
			file.size > 50 * 1024 * 1024
		)
			throw new Error('Choose a PDF up to 50 MB.');
		const prepared = await this.request<Upload>('/api/uploads', {
			number,
			size: file.size,
		});
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
		await this.request(`/api/uploads/${prepared.id}/publish`, {});
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
					await api.request('/api/issues', { number: edit.number });
					return `Issue ${edit.number} added.`;
				case 'delete':
					await api.request(
						`/api/issues/${edit.number}`,
						undefined,
						'DELETE'
					);
					return `Issue ${edit.number} deleted.`;
				case 'remove':
					await api.request(
						`/api/issues/${edit.number}/pdf`,
						undefined,
						'DELETE'
					);
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
