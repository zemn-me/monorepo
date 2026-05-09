import { describe, expect, it } from '@jest/globals';

import {
	metadataToMetaDescriptors,
	viewportToMetaDescriptors,
} from '#root/ts/remix/index.js';

describe('metadataToMetaDescriptors', () => {
	it('renders Next-style root metadata used by the static apps', () => {
		expect(
			metadataToMetaDescriptors(
				{
					alternates: { canonical: './' },
					authors: [{ name: 'Thomas Shadwell' }],
					formatDetection: {
						email: false,
						telephone: false,
						url: false,
					},
					metadataBase: new URL('https://zemn.me'),
					themeColor: [
						{
							color: '#010',
							media: '(prefers-color-scheme: dark)',
						},
						{
							color: '#fff',
							media: '(prefers-color-scheme: light)',
						},
					],
					title: {
						default: 'zemn.me',
						template: '%s <- zemn.me',
					},
					twitter: {
						creator: '@zemnmez',
					},
				},
				{
					route: {
						location: { pathname: '/tool/elastictabs' },
						matches: [],
					},
				}
			)
		).toEqual([
			{ title: 'zemn.me' },
			{
				content: '#010',
				media: '(prefers-color-scheme: dark)',
				name: 'theme-color',
			},
			{
				content: '#fff',
				media: '(prefers-color-scheme: light)',
				name: 'theme-color',
			},
			{ content: 'Thomas Shadwell', name: 'author' },
			{
				content: 'email=no, telephone=no, url=no',
				name: 'format-detection',
			},
			{
				href: 'https://zemn.me/tool/elastictabs',
				rel: 'canonical',
				tagName: 'link',
			},
			{ content: '@zemnmez', name: 'twitter:creator' },
		]);
	});

	it('keeps inherited root tags and applies the inherited title template', () => {
		expect(
			metadataToMetaDescriptors(
				{
					description: 'Article description',
					openGraph: {
						description: 'Article description',
						publishedTime: '2024-01-02T03:04:05.000Z',
						title: 'Article',
						type: 'article',
					},
					title: 'Article',
					twitter: {
						card: 'summary',
						title: 'Article',
					},
				},
				{
					inheritedMetadata: {
						formatDetection: { telephone: false },
						themeColor: '#fff',
						title: {
							default: 'example.com',
							template: '%s | example.com',
						},
						twitter: {
							creator: '@example',
						},
					},
				}
			)
		).toEqual([
			{ title: 'Article | example.com' },
			{ content: '#fff', name: 'theme-color' },
			{ content: 'telephone=no', name: 'format-detection' },
			{ content: '@example', name: 'twitter:creator' },
			{ content: 'Article description', name: 'description' },
			{ content: 'Article description', property: 'og:description' },
			{
				content: '2024-01-02T03:04:05.000Z',
				property: 'article:published_time',
			},
			{ content: 'Article', property: 'og:title' },
			{ content: 'article', property: 'og:type' },
			{ content: 'summary', name: 'twitter:card' },
			{ content: 'Article', name: 'twitter:title' },
		]);
	});
});

describe('viewportToMetaDescriptors', () => {
	it('renders the Next viewport export shape', () => {
		expect(
			viewportToMetaDescriptors({
				initialScale: 1,
				userScalable: false,
				width: 'device-width',
			})
		).toEqual([
			{
				content:
					'initial-scale=1, user-scalable=no, width=device-width',
				name: 'viewport',
			},
		]);
	});
});
