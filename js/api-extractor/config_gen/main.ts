/**
 * @fileoverview generates the api-extractor schema.
 * Under rules_js this was kind of hellish due to the differences
 * in execution roots.
 *
 * Since this code is under the same abstraction, it should be easy!
 */

import { Command } from '@commander-js/extra-typings';
import fs from 'fs/promises';
import paths from 'path';

import * as guard from '#//ts/guard';
// you may need to bazel build //ts/schemas/... to get type completion here... sorry!
import { APIExtractorConfiguration } from '#//ts/schemas/microsoft/api-extractor/api-extractor';

new Command()
	.name('gen_config')
	.description('generate an api-extractor config')
	.requiredOption(
		'--entry-point <path>',
		'the .d.ts to use as an entrypoint for the api extraction.'
	)
	.option('--ts-config <path>', 'path to the tsconfig for this project.')
	.option(
		'--report <path>',
		'where to put the report (used for determining if the API has changed over time).'
	)
	.option(
		'--doc-model <path>',
		'where to put the doc model (can be used for generating docs)'
	)
	.option(
		'--untrimmed-rollup <path>',
		'where to put a file containing the full consolidated API extracted.'
	)
	.option(
		'--public-trimmed-rollup <path>',
		'where to put a file containing the public consolidated API extracted.'
	)
	.option(
		'--tsdoc-metadata <path>',
		'whether and where to put the tsdoc metadata file.'
	)
	.requiredOption('--project-folder <path>', 'the base dir for the project')
	.option('--relativize', 'detects bin-relative paths and removes them')
	.requiredOption('--out <path>', 'where to put the generated config file.')
	.action(async opts => {
		const BINDIR = guard.must(guard.isDefined)(process.env['BAZEL_BINDIR']);

		function normalizePath(path: string): string;
		function normalizePath(path: undefined): undefined;
		function normalizePath(path: undefined | string): undefined | string;

		function normalizePath(path: string | undefined): string | undefined {
			if (path?.startsWith(BINDIR)) return paths.relative(BINDIR, path);
			return path;
		}

		function projectFolderRelativize(path: string): string;
		function projectFolderRelativize(path: undefined): undefined;
		function projectFolderRelativize(
			path: undefined | string
		): undefined | string;

		function projectFolderRelativize(
			path: string | undefined
		): string | undefined {
			if (path == undefined) return path;

			return paths.join('<projectFolder>', path);
		}

		// normalize input paths
		[
			opts.report,
			opts.tsConfig,
			opts.untrimmedRollup,
			opts.publicTrimmedRollup,
			opts.tsdocMetadata,
			opts.docModel,
		] = [
			opts.report,
			opts.tsConfig,
			opts.untrimmedRollup,
			opts.publicTrimmedRollup,
			opts.tsdocMetadata,
			opts.docModel,
		].map(v => normalizePath(v));

		opts.projectFolder = normalizePath(opts.projectFolder);
		opts.entryPoint = normalizePath(opts.entryPoint);
		opts.out = normalizePath(opts.out);

		// relativize all project-relative things
		[
			opts.report,
			opts.tsConfig,
			opts.untrimmedRollup,
			opts.publicTrimmedRollup,
			opts.tsdocMetadata,
			opts.docModel,
		] = [
			opts.report,
			opts.tsConfig,
			opts.untrimmedRollup,
			opts.publicTrimmedRollup,
			opts.tsdocMetadata,
			opts.docModel,
		].map(v => projectFolderRelativize(v));

		opts.entryPoint = projectFolderRelativize(opts.entryPoint);

		const cfg: APIExtractorConfiguration = {
			mainEntryPointFilePath: opts.entryPoint,
		};

		if (opts.report !== undefined) {
			cfg.apiReport = {
				enabled: true,
				reportFileName: paths.basename(opts.report),
				reportFolder: paths.dirname(opts.report),
				...cfg.apiReport,
			};
		}

		if (opts.tsConfig !== undefined) {
			cfg.compiler = {
				tsconfigFilePath: opts.tsConfig,
				...cfg.compiler,
			};
		}

		if (opts.untrimmedRollup !== undefined) {
			cfg.dtsRollup = {
				enabled: true,
				untrimmedFilePath: opts.untrimmedRollup,
				...cfg.dtsRollup,
			};
		}

		if (opts.publicTrimmedRollup !== undefined) {
			cfg.dtsRollup = {
				enabled: true,
				publicTrimmedFilePath: opts.publicTrimmedRollup,
				...cfg.dtsRollup,
			};
		}

		if (opts.tsdocMetadata !== undefined) {
			cfg.tsdocMetadata = {
				enabled: true,
				tsdocMetadataFilePath: opts.tsdocMetadata,
				...cfg.tsdocMetadata,
			};
		}

		if (opts.docModel !== undefined) {
			cfg.docModel = {
				enabled: true,
				apiJsonFilePath: opts.docModel,
				...cfg.docModel,
			};
		}

		if (opts.projectFolder !== undefined) {
			cfg.projectFolder = opts.projectFolder;
		}

		await fs.writeFile(opts.out, JSON.stringify(cfg, null, 2));
	})
	.parseAsync(process.argv);
