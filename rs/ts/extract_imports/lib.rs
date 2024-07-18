use std::{convert, io, path::Path};
use swc_common::sync::Lrc;
use swc_ecma_ast::ModuleDecl;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax};

#[derive(Debug)]
pub enum ExtractImportsError {
    Io(io::Error),
    Swc(swc_ecma_parser::error::Error),
}

impl convert::From<io::Error> for ExtractImportsError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl convert::From<swc_ecma_parser::error::Error> for ExtractImportsError {
    fn from(error: swc_ecma_parser::error::Error) -> Self {
        Self::Swc(error)
    }
}

/// Load a filename and extract a list of typescript module imports.
pub fn extract_imports(filename: String) -> Result<Vec<String>, ExtractImportsError> {
    let cm: Lrc<swc_common::SourceMap> = Default::default();

    let file = cm.load_file(Path::new(&filename))?;

    let mut parser = Parser::new_from(Lexer::new(
        Syntax::Typescript(Default::default()),
        Default::default(),
        StringInput::from(&*file),
        None,
    ));

    parser.take_errors().into_iter().try_for_each(Result::Err)?;

    let res = parser
        .parse_module()?
        .body
        .into_iter()
        .filter_map(|item| match item {
            swc_ecma_ast::ModuleItem::ModuleDecl(m) => match m {
                ModuleDecl::Import(import) => Some(import.src.value.clone().to_string()),
                ModuleDecl::ExportDecl(_) => None,
                ModuleDecl::ExportNamed(_) => None,
                ModuleDecl::ExportDefaultDecl(_) => None,
                ModuleDecl::ExportDefaultExpr(_) => None,
                ModuleDecl::ExportAll(export) => Some(export.src.value.to_string()),
                ModuleDecl::TsImportEquals(_) => None,
                ModuleDecl::TsExportAssignment(_) => None,
                ModuleDecl::TsNamespaceExport(_) => None,
            },
            swc_ecma_ast::ModuleItem::Stmt(_) => None,
        })
        .collect::<Vec<String>>();

    Result::Ok(res)
}
