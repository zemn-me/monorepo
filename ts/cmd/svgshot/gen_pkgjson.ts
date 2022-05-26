import fs from 'fs/promises';

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
    const deps_list = await fs.readFile('ts/cmd/svgshot/npm_deps');
    const pkgs = new Set(deps_list.toString().split("\n")
        .filter(v => v.startsWith("@npm//")).map(v => labelToNpmPackage(v)));

    const pkg_json_buf = await fs.readFile('package.json');
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