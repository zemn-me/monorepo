/**
 * @fileoverview generates the api-extractor schema.
 * Under rules_js this was kind of hellish due to the differences
 * in execution roots.
 *
 * Since this code is under the same abstraction, it should be easy!
 */

import { Command } from '@commander-js/extra-typings';
import fs from 'fs/promises';
import path from 'path';
// you may need to bazel build //ts/schemas/... to get type completion here... sorry!
import { APIExtractorConfiguration } from 'ts/schemas/microsoft/api-extractor/api-extractor';

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
		'--untrimmedRollup <path>',
		'where to put a file containing the full consolidated API extracted.'
	)
	.option(
		'--tsdoc-metadata <path>',
		'whether and where to put the tsdoc metadata file.'
	)
	.requiredOption('--out <path>', 'where to put the generated config file.')
	.action(async opts => {
		const cfg: APIExtractorConfiguration = {
			mainEntryPointFilePath: opts.entryPoint,
		};

		if (opts.report !== undefined) {
			cfg.apiReport = {
				enabled: true,
				reportFileName: opts.report,
				reportFolder: path.dirname(opts.report),
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

		if (opts.tsdocMetadata !== undefined) {
			cfg.tsdocMetadata = {
				enabled: true,
				tsdocMetadataFilePath: opts.tsdocMetadata,
				...cfg.tsdocMetadata,
			};
		}

		await fs.writeFile(opts.out, JSON.stringify(cfg));
	})
    .parseAsync(process.argv);
