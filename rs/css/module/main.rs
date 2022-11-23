// adapted from https://github.com/swc-project/swc/blob/0967e8f06d81e498de5c830b766906e5aaaff2fc/crates/swc_css_modules/tests/fixture.rs#L45

use clap::Parser;
use std::fmt;
use std::{convert, fs, io, path::Path};
use swc_atoms::JsWord;
use swc_common::{sync::Lrc, SourceMap};
use swc_css_codegen::{
    writer::basic::{BasicCssWriter, BasicCssWriterConfig, IndentType},
    CodeGenerator, CodegenConfig, Emit,
};
//use swc_css_modules;
use swc_css_modules::CssClassName;
use swc_css_parser::{self, parser::ParserConfig};
use ts::ts::{Declare, Export, Import, Module, Statement};

/// Transforms a CSS module file (*.module.css) into
/// a json file and a css file.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Input css module file
    #[arg(long)]
    module_file: String,

    /// Output css file
    #[arg(long)]
    css_file: String,

    /// Output json file
    #[arg(long)]
    ts_file: String,

    /// Import path for resulting css file
    #[arg(long)]
    css_file_import: String,
}

struct FileScopedConfig<'a> {
    path: &'a std::path::Path,
}

impl<'a> swc_css_modules::TransformConfig for FileScopedConfig<'a> {
    fn new_name_for(&self, local: &JsWord) -> JsWord {
        format!(
            "{className}__{filePath}",
            className = local,
            filePath = self.path.display()
        )
        .into()
    }
}

#[derive(Debug, Clone)]
struct MissingRewrittenValue;

impl fmt::Display for MissingRewrittenValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "missing rewritten value")
    }
}

#[derive(Debug, Clone)]
struct NotYetImplemented;

impl fmt::Display for NotYetImplemented {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "not yet implemented")
    }
}

#[derive(Debug)]
enum CliError {
    SwcCssParser(swc_css_parser::error::Error),
    SerdeJson(serde_json::Error),
    Io(io::Error),
    Fmt(std::fmt::Error),
    NotYetImplemented(NotYetImplemented),
    MissingRewrittenValue(MissingRewrittenValue),
}

impl convert::From<MissingRewrittenValue> for CliError {
    fn from(error: MissingRewrittenValue) -> Self {
        Self::MissingRewrittenValue(error)
    }
}

impl convert::From<NotYetImplemented> for CliError {
    fn from(error: NotYetImplemented) -> Self {
        Self::NotYetImplemented(error)
    }
}

impl convert::From<std::fmt::Error> for CliError {
    fn from(error: std::fmt::Error) -> Self {
        Self::Fmt(error)
    }
}

impl convert::From<swc_css_parser::error::Error> for CliError {
    fn from(error: swc_css_parser::error::Error) -> Self {
        Self::SwcCssParser(error)
    }
}

impl convert::From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self::SerdeJson(error)
    }
}

impl convert::From<io::Error> for CliError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

pub fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

fn canonicalize_css_to_javascript(s: String) -> String {
    s.split('-')
        .filter(|v| !v.is_empty())
        .enumerate()
        .map(|(i, s)| if i < 1 { s.to_string() } else { capitalize(s) })
        .collect::<Vec<String>>()
        .join("")
}

fn act() -> Result<(), CliError> {
    let args: Args = Args::parse();

    let module_file_path = Path::new(&args.module_file);
    let css_file_path = Path::new(&args.css_file);
    let ts_file_path = Path::new(&args.ts_file);
    let css_file_import = args.css_file_import;

    let mut errors = vec![];

    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.load_file(module_file_path)?;

    let mut ss = swc_css_parser::parse_file(
        &fm,
        ParserConfig {
            ..Default::default()
        },
        &mut errors,
    )?;

    let _result = swc_css_modules::imports::analyze_imports(&ss);

    let transform_result = swc_css_modules::compile(
        &mut ss,
        FileScopedConfig {
            path: module_file_path,
        },
    );

    let mut buf = String::new();
    {
        let wr = BasicCssWriter::new(
            &mut buf,
            None,
            BasicCssWriterConfig {
                indent_type: IndentType::Space,
                indent_width: 2,
                ..Default::default()
            },
        );
        let mut g = CodeGenerator::new(
            wr,
            CodegenConfig {
                ..Default::default()
            },
        );

        g.emit(&ss)?;
    }

    fs::write(css_file_path, buf)?;

    let mut exports: Vec<Statement> = transform_result
        .renamed
        .into_iter()
        .map(|(key, value)| {
            Ok(match value.first().ok_or(MissingRewrittenValue)? {
                CssClassName::Local { name } => Ok(vec![Export {
                    value: Declare {
                        name: canonicalize_css_to_javascript(key.to_string()).into(),
                        value: Some(name.to_string().into()),
                    },
                }
                .into()]),

                CssClassName::Import { .. } => Err(NotYetImplemented),

                CssClassName::Global { .. } => Ok(vec![]),
            }?)
        })
        .collect::<Result<Vec<Vec<Statement>>, CliError>>()?
        .into_iter()
        .flatten()
        .collect();

    // add import of css file.
    let mut imports = vec![Import {
        from: css_file_import,
    }
    .into()];

    let mut statements = vec![];

    statements.append(&mut imports);
    statements.append(&mut exports);

    ts::ts::WriteTo::write_to(
        Module { statements },
        &mut fs::OpenOptions::new()
            .read(false)
            .write(true)
            .create(true)
            .open(ts_file_path)?,
    )?;

    Ok(())
}

fn main() {
    act().unwrap();
}
