extern crate ts;

use std::io;
use ts::ts::{Declare, Export, Module};

fn main() {
    let val = Module {
        statements: vec![Export {
            value: Declare {
                name: "something".to_string().into(),
                value: Some("some value".to_string().into()),
            },
        }
        .into()],
    };

    ts::ts::WriteTo::write_to(val, &mut io::stdout()).expect("Unable to serialize.");
}
