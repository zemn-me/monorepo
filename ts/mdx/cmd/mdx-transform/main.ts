/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import * as mdx from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import remarkSectionize from 'remark-sectionize';
import { SourceMapGenerator } from 'source-map';
import { read, write } from 'to-vfile';
import { VFile } from 'vfile';

import { map } from '#root/ts/iter/index.js';
import { zip } from '#root/ts/math/vec.js';

type HastNode = HastElement | HastParent | HastText;

interface HastParent {
	readonly type: string;
	children?: HastNode[];
}

interface HastElement extends HastParent {
	readonly type: 'element';
	tagName: string;
	properties?: Record<string, unknown>;
	children?: HastNode[];
}

interface HastText {
	readonly type: 'text';
	value: string;
}

function collect(value: string, previous: string[]) {
	return previous.concat([value]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isParent(value: unknown): value is HastParent {
	return isRecord(value) && Array.isArray(value.children);
}

function isElement(value: unknown, tagName?: string): value is HastElement {
	return (
		isRecord(value) &&
		value.type === 'element' &&
		typeof value.tagName === 'string' &&
		(tagName === undefined || value.tagName === tagName)
	);
}

function stringProperty(node: HastElement, name: string): string | undefined {
	const value = node.properties?.[name];
	return typeof value === 'string' ? value : undefined;
}

function hasProperty(node: HastElement, name: string): boolean {
	return node.properties?.[name] !== undefined;
}

function isFootnotesSection(node: unknown): node is HastElement {
	return (
		isElement(node, 'section') &&
		(hasProperty(node, 'dataFootnotes') ||
			hasProperty(node, 'data-footnotes'))
	);
}

function isFootnoteItem(node: unknown): node is HastElement {
	return (
		isElement(node, 'li') &&
		stringProperty(node, 'id')?.startsWith('user-content-fn-') === true
	);
}

function isFootnoteBackref(node: unknown): node is HastElement {
	return isElement(node, 'a') && hasProperty(node, 'dataFootnoteBackref');
}

function collectFootnoteBackrefs(node: HastNode): HastElement[] {
	if (!isParent(node)) return [];

	const backrefs: HastElement[] = [];
	const children: HastNode[] = [];

	for (const child of node.children ?? []) {
		if (isFootnoteBackref(child)) {
			child.children = [{ type: 'text', value: '↑' }];
			backrefs.push(child);
			continue;
		}

		backrefs.push(...collectFootnoteBackrefs(child));
		children.push(child);
	}

	node.children = children;
	return backrefs;
}

function prependFootnoteBackrefs(item: HastElement) {
	const backrefs = collectFootnoteBackrefs(item);
	if (backrefs.length === 0) return;

	const backrefPrefix: HastNode[] = [];
	for (const [index, backref] of backrefs.entries()) {
		if (index > 0) {
			backrefPrefix.push({ type: 'text', value: ' ' });
		}
		backrefPrefix.push(backref);
	}
	backrefPrefix.push({ type: 'text', value: ' ' });

	const firstParagraph = item.children?.find(child =>
		isElement(child, 'p')
	);
	if (firstParagraph !== undefined) {
		firstParagraph.children = [
			...backrefPrefix,
			...(firstParagraph.children ?? []),
		];
		return;
	}

	item.children = [...backrefPrefix, ...(item.children ?? [])];
}

function findDeepestSectionWithRef(
	node: HastNode,
	refId: string,
	currentSection?: HastElement
): HastElement | undefined {
	const nextSection =
		isElement(node, 'section') && !isFootnotesSection(node)
			? node
			: currentSection;

	if (isElement(node) && stringProperty(node, 'id') === refId) {
		return nextSection;
	}

	if (!isParent(node)) {
		return undefined;
	}

	for (const child of node.children ?? []) {
		const section = findDeepestSectionWithRef(child, refId, nextSection);
		if (section !== undefined) return section;
	}

	return undefined;
}

function cloneWithoutId(node: HastNode): HastNode {
	if (!isElement(node)) return node;

	const properties = { ...node.properties };
	delete properties.id;

	return {
		...node,
		properties,
		children: node.children?.map(cloneWithoutId),
	};
}

function createFootnotesSection(
	label: HastNode | undefined,
	items: HastElement[]
): HastElement {
	return {
		type: 'element',
		tagName: 'section',
		properties: {
			className: ['footnotes'],
			dataFootnotes: true,
		},
		children: [
			...(label === undefined ? [] : [label]),
			{
				type: 'element',
				tagName: 'ol',
				properties: {},
				children: items,
			},
		],
	};
}

function sectionFootnotes() {
	return (tree: unknown) => {
		if (!isParent(tree)) return;

		const footnotesIndex = tree.children?.findIndex(isFootnotesSection);
		if (footnotesIndex === undefined || footnotesIndex < 0) return;

		const footnotes = tree.children?.[footnotesIndex];
		if (!isFootnotesSection(footnotes)) return;

		const label = footnotes.children?.find(child =>
			isElement(child, 'h2')
		);
		const list = footnotes.children?.find(child => isElement(child, 'ol'));
		if (!isElement(list, 'ol')) return;

		const itemsBySection = new Map<HastElement, HastElement[]>();

		for (const item of list.children ?? []) {
			if (!isFootnoteItem(item)) continue;
			prependFootnoteBackrefs(item);

			const footnoteId = stringProperty(item, 'id');
			const refId = footnoteId?.replace(
				'user-content-fn-',
				'user-content-fnref-'
			);
			if (refId === undefined) continue;

			const section = findDeepestSectionWithRef(tree, refId);
			if (section === undefined) continue;

			itemsBySection.set(section, [
				...(itemsBySection.get(section) ?? []),
				item,
			]);
		}

		if (itemsBySection.size === 0) return;

		let firstSection = true;
		for (const [section, items] of itemsBySection) {
			const sectionLabel =
				firstSection || label === undefined
					? label
					: cloneWithoutId(label);
			section.children = [
				...(section.children ?? []),
				createFootnotesSection(sectionLabel, items),
			];
			firstSection = false;
		}

		tree.children?.splice(footnotesIndex, 1);
	};
}

void new Command('mdx-transform')
	.addHelpText(
		'beforeAll',
		`${
			'Transform a set of MDX files to .tsx files.\n' +
			'\n' +
			'The number of input files and output files must be the same, as' +
			'input files are directly mapped to output files in order.'
		}`
	)
	.requiredOption('--input <file>', `${'Input file(s).'}`, collect, [])
	.requiredOption(
		'--output-js <file>',
		`${'Output javascript file(s).'}`,
		collect,
		[]
	)
	.requiredOption(
		'--output-map <file>',
		`${'Output source map file(s).'}`,
		collect,
		[]
	)
	.action(async o => {
		const { input, outputJs, outputMap } = o;

		if (![input, outputJs, outputMap].every(v => v.length == input.length))
			throw new Error(
				'there must be the same number of output JS and map files as input JS files.'
			);

		await Promise.all([
			...map(
				map(
					zip(zip(input, outputJs), outputMap),
					([[i, j] = [], m]) =>
						// each of these must be defined since all 3 arraysmust be same length.
						[i!, j!, m!] as [string, string, string]
				),
				async ([input, jsFile, mapFile]) => {
					const js = await mdx.compile(await read(input), {
						SourceMapGenerator: SourceMapGenerator,
						remarkPlugins: [
							remarkGfm,
							remarkFrontmatter,
							remarkMdxFrontmatter,
							remarkSectionize,
						],
						rehypePlugins: [sectionFootnotes],
					});

					js.path = jsFile;

					js.map!.sourcesContent = [
						(await readFile(input)).toString(),
					];
					// the source map uses relative paths to the js file
					// but is being generated relative to cwd.
					js.map!.sources = js.map!.sources.map(v => `/${v}`);
					const sourceMap: VFile = new VFile({
						path: mapFile,
						value: JSON.stringify(js.map),
					});
					js.value += `//# sourceMappingURL=${path.relative(path.dirname(js.path), sourceMap.path)}`;
					await Promise.all([write(js), write(sourceMap)]);
				}
			),
		]);
	})
	.parseAsync(process.argv)
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
