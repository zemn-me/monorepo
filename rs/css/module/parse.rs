use swc_css_parser::{
    self as swc_css,
    parse_file,
    parser::{ ParserConfig, PResult as Result }
};
use swc_common::source_map::SourceFile;
use swc_css_ast::{Stylesheet, Rule, QualifiedRulePrelude, SelectorList, ComplexSelector};
use super::name::generate;
use swc_css_visit::Fold; // take a look at https://github.com/zhusjfaker/swc-css-module/blob/master/src/css_module.rs


fn transformSelectorList(selector_list: SelectorList, file: SourceFile, errors: &mut Vec<swc_css::error::Error>) -> Result<SelectorList> {
    selector_list.children.into_iter().map(|child| transformComplexSelector(child, file, errors)?)
        .collect()
}

fn transformComplexSelector(complexSelector: ComplexSelector, file: SourceFile, errors: &mut Vec<swc_css::error::Error>) -> Result<SelectorList> {
    complexSelector.children.into_iter().map
}


/// transforms a css module to icss
fn transform_css_module(file: SourceFile, config: ParserConfig, errors: &mut Vec<swc_css::error::Error>) -> Result<Stylesheet> {
    let mut parsed_stylesheet: Stylesheet = parse_file(file, config, errors)?;

    parsed_stylesheet.rules = parsed_stylesheet.rules.into_iter().map(|rule| match rule {
        Rule::QualifiedRule(rule) => match rule.prelude {
            QualifiedRulePrelude::SelectorList(selector) => selector.,
            _ => _
        },
        Rule::AtRule(value) => Rule::AtRule(value),
        Rule::ListOfComponentValues(value) => Rule::ListOfComponentValues(value)
    }).collect::<Vec<_>>();




    Result::Ok(parsed_stylesheet)
}