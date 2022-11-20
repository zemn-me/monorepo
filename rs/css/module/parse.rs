use swc_css_parser::parser::{ ParserConfig, parse_file, Parser, Parse, Lexer, PResult as Result };
use swc_common::source_map::SourceFile;
use swc_common::input::StringInput;

fn parse_css<'a, T>(file: &'a SourceFile, config: ParserConfig, errors: &mut Vec<Error>) -> Result<T> where
    Parser<Lexer<StringInput<'a>>>: Parse<T> {
        parse_file(file, config, errors)
    }