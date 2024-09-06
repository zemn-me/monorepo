use sha2::{Digest, Sha256};
use std::{convert, env::args, fs::File, io};

#[allow(dead_code)]
#[derive(Debug)]
enum RunError {
    Io(io::Error),
}

impl convert::From<io::Error> for RunError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

fn act() -> Result<(), RunError> {
    let content = args()
        .skip(1)
        .map(|file_name| -> Result<String, RunError> {
            let mut sha = Sha256::new();
            io::copy(&mut File::open(&file_name)?, &mut sha)?;
            Ok(format!("{}  {}\n", hex::encode(sha.finalize()), &file_name))
        })
        .collect::<Result<Vec<String>, RunError>>()?
        .join("");

    io::copy(&mut content.as_bytes(), &mut io::stdout())?;

    Ok(())
}

fn main() {
    act().unwrap()
}
