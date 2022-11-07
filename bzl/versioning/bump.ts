import { Command } from 'commander';

new Command()
    .name('bump-version')
    .description(
        'bumps a semver version'
    )
    .requiredOption('--major <string>', 'major version file (e.g. contents: 1)')
    .requiredOption('--minor <string>', 'minor version file (e.g. contents: 2)')
    .requiredOption('--patch <string>', 'patch version file (e.g. contents: 2)')
    .requiredOption('--bump <major|minor|patch>', 'which ')