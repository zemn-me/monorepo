// adapted from https://github.com/swc-project/swc/blob/0967e8f06d81e498de5c830b766906e5aaaff2fc/crates/swc_css_modules/tests/fixture.rs#L45

use clap::Parser;
use std::{convert, fs, io, path::Path};
use swc_atoms::JsWord;
use swc_common::{sync::Lrc, SourceMap};
use swc_css_codegen::{
    writer::basic::{BasicCssWriter, BasicCssWriterConfig, IndentType},
    CodeGenerator, CodegenConfig, Emit,
};
//use swc_css_modules;
use swc_css_parser::{self, ParserConfig};

/// Transforms a CSS module file (*.module.css) into
/// a json file and a css file.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Input css module file
    #[arg(short, long)]
    module_file: String,

    /// Output css file
    #[arg(short, long)]
    css_file: String,

    /// Output json file
    #[arg(short, long)]
    json_file: String,
}

struct TestConfig {}

impl swc_css_modules::TransformConfig for TestConfig {
    fn new_name_for(&self, local: &JsWord) -> JsWord {
        format!("__local__{}", local).into()
    }
}

#[derive(Debug)]
enum CliError {
    SwcCssParserError(swc_css_parser::error::Error),
    SerdeJsonError(serde_json::Error),
    IoError(io::Error),
    FmtError(std::fmt::Error),
}

impl convert::From<std::fmt::Error> for CliError {
    fn from(error: std::fmt::Error) -> Self {
        Self::FmtError(error)
    }
}

impl convert::From<swc_css_parser::error::Error> for CliError {
    fn from(error: swc_css_parser::error::Error) -> Self {
        Self::SwcCssParserError(error)
    }
}

impl convert::From<serde_json::Error> for CliError {
    fn from(error: serde_json::Error) -> Self {
        Self::SerdeJsonError(error)
    }
}

impl convert::From<io::Error> for CliError {
    fn from(error: io::Error) -> Self {
        Self::IoError(error)
    }
}

fn act() -> Result<(), CliError> {
    let args: Args = Args::parse();

    let module_file_path = Path::new(&args.module_file);
    let css_file_path = Path::new(&args.css_file);
    let json_file_path = Path::new(&args.json_file);

    let mut errors = vec![];

    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.load_file(module_file_path)?;

    let mut ss = swc_css_parser::parse_file(
        &fm,
        ParserConfig {
            css_modules: true,
            ..Default::default()
        },
        &mut errors,
    )?;

    let _result = swc_css_modules::imports::analyze_imports(&ss);

    let transform_result = swc_css_modules::compile(&mut ss, TestConfig {});

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

    fs::write(
        json_file_path,
        serde_json::to_string_pretty(&transform_result.renamed)?,
    );

    Ok(())
}

fn main() {
    act().unwrap();
}
