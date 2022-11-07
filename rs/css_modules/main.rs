use swc_css_parser::parse_str;
use clap::Parser;

/// Search for a pattern in a file and display the lines that contain it.
#[derive(Parser)]
struct Cli {
    /// input css module filepath
    input: std::path::PathBuf,
    /// The path to the file to read
    output: std::path::PathBuf,
}

fn main() {
    let args = Cli::parse();
}

/*
Quite a few things will be needed here, and probably should be dealt with
in separate places.

First is an icss transformer, spec: https://github.com/css-modules/icss

In essence:

    :import("path/to/dep.css") {
       localAlias: keyFromDep;
    /* ... */
    }
    :export {
    exportedKey: exportedValue;
        /* ... */
    }

    .Title {
        color: red;
    }

    :global(main) {
        color: green;
    }


Becomes:

    import { localAlias as keyFromDep } from "path/to/dep.icss.ts";
    export const Title = "_title_116zl_1";
    export { exportedKey as exportedValue };

We can probably just skip the import / export syntax.

I'm not sure how yet, but we will need some bootstrapper that appends the
stylesheet snippets to the DOM.

The approach will need to be react compatible. see https://github.com/gajus/babel-plugin-react-css-modules





Output something like
export const Title = "_title_116zl_1";


*/
