// implements a standard CSS Module 'generic name' algorithm roughly specified at https://www.npmjs.com/package/generic-names
use hex;
use sha2::{Digest, Sha256};
use std::{borrow::Cow, io::Error, path::Path};

pub fn generate(class_name: String, filepath: &Path, content: &[u8]) -> Result<String, Error> {
    let mut hasher = Sha256::new();
    hasher.update(content);

    let hash = &hasher.finalize()[0..5];

    Ok(format!(
        "{class_name}__{path}__{hash}",
        class_name = class_name,
        path = filepath
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<Cow<'_, str>>>()
            .join("_"),
        hash = hex::encode(hash)
    ))
}

#[cfg(test)]
mod test {
    use super::generate;
    use std::path::Path;

    #[test]
    fn test_correct_format() {
        assert_eq!(
            generate(
                "Button".to_string(),
                Path::new("rs/css/module"),
                b"hello, world"
            )
            .expect("failed to unwrap"),
            "Button__rs_css_module__09ca7e4eaa"
        )
    }
}
