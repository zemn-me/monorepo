import type { components } from '#root/project/me/zemn/api/api_client.gen.js';

type ApiScopes = components['schemas']['OAuthScopes'];

export type RequiredScope = keyof Pick<
	ApiScopes,
	| 'admin_analytics_read'
	| 'admin_users_manage'
	| 'callbox_key'
	| 'grievance_portal'
	| 'journal_read'
	| 'minecraft'
>;

/** In-memory menu records; consume fields together so their names can be minified. */
export type NavigationLink = <R>(
	use: (
		href: string,
		label: string,
		description: string | undefined,
		requiresAuthentication: boolean,
		requiredScope: RequiredScope | undefined
	) => R
) => R;

function link(
	href: string,
	label: string,
	description?: string,
	requiresAuthentication = false,
	requiredScope?: RequiredScope
): NavigationLink {
	return use =>
		use(href, label, description, requiresAuthentication, requiredScope);
}

export type NavigationSection = <R>(
	use: (label: string, links: readonly NavigationLink[]) => R
) => R;

function section(
	label: string,
	links: readonly NavigationLink[]
): NavigationSection {
	return use => use(label, links);
}

export const pageLinks: readonly NavigationLink[] = [
	link('/', 'Home'),
	link('/article', 'Articles', 'Browse all published articles.'),
	link(
		'/experiments',
		'Experiments',
		'Browse experiments, generators, and visual studies.'
	),
	link('/availability', 'Availability', undefined, true),
];

export const accountLinks: readonly NavigationLink[] = [
	link('/admin', 'Admin', undefined, false, 'admin_users_manage'),
	link('/admin/users', 'Users', undefined, false, 'admin_users_manage'),
	link(
		'/admin/analytics',
		'Analytics',
		undefined,
		false,
		'admin_analytics_read'
	),
	link(
		'/grievanceportal',
		'Grievance portal',
		undefined,
		false,
		'grievance_portal'
	),
	link('/journal', 'Journal', undefined, false, 'journal_read'),
	link('/minecraft', 'Minecraft', undefined, false, 'minecraft'),
	link('/key', 'Key', undefined, false, 'callbox_key'),
];

export const navSections: readonly NavigationSection[] = [
	section('Pages', pageLinks),
	section('Account', accountLinks),
];
