import type { components } from '#root/project/me/zemn/api/api_client.gen.js';

type ApiScopes = components['schemas']['OAuthScopes'];

export type RequiredScope = keyof Pick<
	ApiScopes,
	| 'admin_analytics_read'
	| 'admin_users_manage'
	| 'callbox_key'
	| 'grievance_portal'
	| 'journal'
	| 'minecraft'
>;

export interface NavigationLink {
	readonly description?: string;
	readonly href: string;
	readonly label: string;
	readonly requiresAuthentication?: boolean;
	readonly requiredScope?: RequiredScope;
}

export interface NavigationSection {
	readonly label: string;
	readonly links: readonly NavigationLink[];
}

export const pageLinks: readonly NavigationLink[] = [
	{ href: '/', label: 'Home' },
	{
		href: '/article',
		label: 'Articles',
		description: 'Browse all published articles.',
	},
	{
		href: '/experiments',
		label: 'Experiments',
		description: 'Browse experiments, generators, and visual studies.',
	},
	{
		href: '/availability',
		label: 'Availability',
		requiresAuthentication: true,
	},
];

export const accountLinks: readonly NavigationLink[] = [
	{ href: '/admin', label: 'Admin', requiredScope: 'admin_users_manage' },
	{
		href: '/admin/users',
		label: 'Users',
		requiredScope: 'admin_users_manage',
	},
	{
		href: '/admin/analytics',
		label: 'Analytics',
		requiredScope: 'admin_analytics_read',
	},
	{
		href: '/grievanceportal',
		label: 'Grievance portal',
		requiredScope: 'grievance_portal',
	},
	{ href: '/journal', label: 'Journal', requiredScope: 'journal' },
	{ href: '/minecraft', label: 'Minecraft', requiredScope: 'minecraft' },
	{ href: '/key', label: 'Key', requiredScope: 'callbox_key' },
];

export const navSections: readonly NavigationSection[] = [
	{ label: 'Pages', links: pageLinks },
	{ label: 'Account', links: accountLinks },
];
