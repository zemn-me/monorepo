extern crate ts;

use std::io;
use ts::ts::{
    ConstantString, Declaration, ExportImport, Expression, Identifier, Statement, TokQuote,
    TokSingleQuote,
};

fn main() {
    let val = Statement::ExportImport(ExportImport {
        value: Declaration {
            name: Identifier {
                value: "something".to_string(),
            },
            value: Some(Expression::String(ConstantString {
                value: "some value".to_string(),
                quote: TokQuote::Single(TokSingleQuote),
            })),
        },
    });

    ts::ts::WriteTo::write_to(val, &mut io::stdout()).expect("Unable to serialize.");
}
