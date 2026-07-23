import type { components } from '#root/project/me/zemn/api/api_client.gen.js';

type ApiScopes = components['schemas']['OAuthScopes'];

export type RequiredScope =
	keyof Pick<
		ApiScopes,
		| 'admin_analytics_read'
		| 'admin_users_manage'
		| 'callbox_key'
		| 'grievance_portal'
		| 'minecraft'
	>;

export interface NavigationLink {
	readonly description?: string;
	readonly href: string;
	readonly label: string;
	readonly requiredScope?: RequiredScope;
}

export interface ArticleNavigationLink extends NavigationLink {
	readonly released: boolean;
}

export interface NavigationSection {
	readonly label: string;
	readonly links: readonly NavigationLink[];
}

export const pageLinks: readonly NavigationLink[] = [
	{ href: '/', label: 'Home' },
	{ href: '/cv', label: 'CV' },
	{ href: '/availability', label: 'Availability' },
];

export const toolLinks: readonly NavigationLink[] = [
	{ href: '/tool/elastictabs', label: 'Elastic Tabstops' },
];

export const articleLinks: readonly ArticleNavigationLink[] = [
	{
		href: '/article/2026/mandarin-bench',
		label: 'Mandarin Bench',
	},
	{
		href: '/article/2026/kasimir',
		label: 'Letter to Kasimir',
		released: true,
	},
	{
		href: '/article/2024/clean',
		label: 'The Hagiography of Clean',
		released: true,
	},
	{
		href: '/article/2024/missing',
		label: 'Missing',
		released: true,
	},
	{
		href: '/article/2020/icloud',
		label: 'How to Hack Apple ID',
		released: false,
	},
	{
		href: '/article/2019/cors',
		label: 'If CORS is just a header...',
		released: true,
	},
	{
		href: '/article/2014/csp',
		label: 'When Security Generates Insecurity',
		released: true,
	},
];

export const releasedArticleLinks: readonly NavigationLink[] = articleLinks.filter(
	link => link.released
);

export const experimentLinks: readonly NavigationLink[] = [
	{
		href: '/experiments',
		label: 'Experiments',
		description: 'List of experiments.',
	},
	{
		href: '/experiments/emoji/flag',
		label: 'Flag emoji',
		description: 'Custom country flag emoji generator.',
	},
	{
		href: '/experiments/rays',
		label: 'Rays',
		description: 'Renderer for ray and halo effects.',
	},
	{
		href: '/experiments/factorio',
		label: 'Factorio',
		description: 'Some Factorio experiments.',
	},
	{
		href: '/experiments/factorio/blueprint',
		label: 'Factorio blueprints',
		description: 'Playing around with the Factorio blueprint format.',
	},
	{
		href: '/experiments/factorio/blueprint/parse',
		label: 'Blueprint parser',
		description: 'Test parser for Factorio blueprints.',
	},
	{
		href: '/experiments/factorio/blueprint/request',
		label: 'Requester chest generator',
		description: 'Factorio requester chest blueprint generator.',
	},
	{
		href: '/experiments/factorio/blueprint/wall',
		label: 'Blueprint wall generator',
		description: 'Adds a wall around blueprint entities and tiles.',
	},
	{
		href: '/experiments/factorio/blueprint/book',
		label: 'Blueprint book',
		description: 'Some Factorio blueprints I like or made.',
	},
	{
		href: '/experiments/cultist',
		label: 'Cultist simulator',
		description:
			'Mostly broken cultist simulator game board from the Covid-19 era.',
	},
	{
		href: '/experiments/geometry_of_music',
		label: 'Geometry of Music',
		description: 'Notes from reading the book Geometry of Music.',
	},
	{
		href: '/experiments/frame',
		label: 'Framing calculator',
		description: 'Calculator for framing and sizing mattes.',
	},
	{
		href: '/experiments/arena',
		label: 'SVG Arena',
		description: 'FPS-style SVG arena with pointer-lock camera controls.',
	},
	{
		href: '/experiments/platonics',
		label: 'Platonic Stress',
		description: 'Stress test for a dense field of SVG platonic solids.',
	},
	{
		href: '/experiments/pitch_training',
		label: 'Pitch Training',
		description: 'Generated Anki decks for pitch recognition practice.',
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
	{ href: '/minecraft', label: 'Minecraft', requiredScope: 'minecraft' },
	{ href: '/key', label: 'Key', requiredScope: 'callbox_key' },
];

export const navSections: readonly NavigationSection[] = [
	{ label: 'Pages', links: pageLinks },
	{ label: 'Tools', links: toolLinks },
	{ label: 'Articles', links: releasedArticleLinks },
	{ label: 'Experiments', links: experimentLinks },
	{ label: 'Account', links: accountLinks },
];
