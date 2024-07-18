use std::{convert, env::args, io};

use extract_imports::{extract_imports, ExtractImportsError};

#[derive(Debug)]
enum ExtractImportsCmdError {
    ExtractImportsLibError(ExtractImportsError),
    Io(io::Error),
    String(String),
}

impl convert::From<&str> for ExtractImportsCmdError {
    fn from(error: &str) -> Self {
        Self::String(error.into())
    }
}

impl convert::From<String> for ExtractImportsCmdError {
    fn from(error: String) -> Self {
        Self::String(error)
    }
}

impl convert::From<io::Error> for ExtractImportsCmdError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl convert::From<ExtractImportsError> for ExtractImportsCmdError {
    fn from(error: ExtractImportsError) -> Self {
        Self::ExtractImportsLibError(error)
    }
}

fn act() -> Result<(), ExtractImportsCmdError> {
    Result::Ok(println!(
        "{}",
        extract_imports(args().next().ok_or("specify target")?)?.join("\n")
    ))
}

fn main() {
    act().unwrap()
}
