import fs from 'fs';

export class ParsingFileError extends Error {
    name = "ParsingFileError"
    constructor(public parent: Error, public file: string) {
        super(`parsing file: ${file}: ${parent}`);
    }
}

function mergeShallow(onto: any, source: any): any {
    for (const [key, value] of Object.entries(source)) {
        if (value instanceof Array) {
            if (onto[key] === undefined) {
                onto[key] = [];
            } else if (!(onto[key] instanceof Array)) {
                throw new Error(`mergeShallow: key ${key} in onto is not Array, but is in source`);
            }

            onto[key] = [...onto[key], ...value];

            continue;
        }

        if (onto[key] === undefined) {
            onto[key] = {};
        }

        for (const [key2, value2] of Object.entries(value as any)) {
            if (key2 in onto) {
                throw new Error(`mergeShallow: collision! ${key}.${key2} is present in both source and destination!`)
            }

            onto[key2] = value2;
        }


    }

    return onto;
}

// takes a set of not-really-json files and merges them shallowly
async function Main(files: Iterable<string> = process.argv.slice(2)) {
    const output: Object = {}
    for (const file of files) {
        try {
            const content = (await fs.promises.readFile(file)).toString();
            if (content.trim() === "") continue;
            mergeShallow(output, eval(`(${content})`));

        } catch (e) {
            throw new ParsingFileError(e, file);
        }
    }

    console.log(JSON.stringify(output));
}

if (require.main === module) {
    Main().catch(e => console.error(e));
}