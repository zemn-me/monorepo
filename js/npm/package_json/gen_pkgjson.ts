import fs from 'fs/promises';
import { Command } from 'commander';
import { basename } from 'path';


const labelToNpmPackage = (label: string): string => {
    /*
        Eventually, I should actually test this,
        @npm/:node_modules/@bazel/runfiles/LICENSE -> @bazel/runfiles
        @npm//@ok/thing:test.txt -> @ok/thing
        @npm//@ok/thing/file:test.txt -> @ok/thing
        @npm//ok-whatever:fuck -> ok-whatever
    */
    const match = /^@npm\/\/(?::node_modules\/)?((?:@[^\/:]+\/)?[^\/:]+)/.exec(label);

    if (match === null) throw new Error(`${label} does not appear to be an NPM package.`);

    return match[1];
}

const main = async () => {
    const program = (new Command())
        .name('gen_pkgjson')
        .description(
            'Generate a package.json for a bazel JS tree, using a genquery, ' +
            'a base package.json, and a template.'
        )
        .option('--base <path>', 'The \'base\' package.json from which to draw package versions.')
        .option('--query <path>', 'The genquery (path) containing a list of line-break separated deps.')
        .parse(process.argv);

    const opts = program.opts();
    const basepkg = opts.base, deps = opts.query;


    const deps_list = await fs.readFile(deps);
    const pkgs = new Set(deps_list.toString().split("\n")
        .filter(v => v.startsWith("@npm//")).map(v => labelToNpmPackage(v)));

    const pkg_json_buf = await fs.readFile(basepkg);
    const pkg_json: {
        devDependencies: Record<string, string>,
        dependencies: Record<string, string>
    } = JSON.parse(pkg_json_buf.toString());

    const all_deps = new Map([
        ...Object.entries(pkg_json.dependencies),
        ...Object.entries(pkg_json.devDependencies)
    ]);

    const our_deps = [...all_deps].filter(([k, v]) =>
        pkgs.has(k)
    );

    console.log(our_deps);
}


main().catch(e => console.error(e));