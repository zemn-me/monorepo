/// This file is a sketch of a system for a typescript module like AST,
/// eventually to be used for generating CSS modules.
use std::io;

trait WriteTo<W>
where
    W: io::Write,
{
    fn write_to(self, w: &mut W) -> io::Result<usize>;
}

#[derive(Copy, Clone)]
struct TokDoubleQuote;

impl<W: io::Write> WriteTo<W> for TokDoubleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        return w.write(b"\"");
    }
}

#[derive(Copy, Clone)]
struct TokSingleQuote;

impl<W: io::Write> WriteTo<W> for TokSingleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        return w.write(b"'");
    }
}

#[derive(Copy, Clone)]
enum TokQuote {
    Double(TokDoubleQuote),
    Single(TokSingleQuote),
}

impl<W: io::Write> WriteTo<W> for TokQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        match self {
            TokQuote::Double(v) => v.write_to(w),
            TokQuote::Single(v) => v.write_to(w),
        }
    }
}

struct ConstantString {
    value: String,
    quote: TokQuote,
}

impl<W: io::Write> WriteTo<W> for ConstantString {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut v: usize = 0;

        v += self.quote.write_to(w)?;

        v += w.write(self.value.as_bytes())?;

        v += self.quote.write_to(w)?;

        io::Result::Ok(v)
    }
}

struct ConstantNumber {
    value: i64,
}

impl<W: io::Write> WriteTo<W> for ConstantNumber {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.to_string().as_bytes())
    }
}

enum Expression {
    String(ConstantString),
    Number(ConstantNumber),
}

impl<W: io::Write> WriteTo<W> for Expression {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        match self {
            Expression::String(s) => s.write_to(w),
            Expression::Number(n) => n.write_to(w),
        }
    }
}

struct Identifier {
    value: String,
}

impl<W: io::Write> WriteTo<W> for Identifier {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.as_bytes())
    }
}

struct Declaration {
    name: Identifier,
    value: Option<Expression>,
}

impl<W: io::Write> WriteTo<W> for Declaration {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        ctr += w.write(b"let ")?;
        ctr += self.name.write_to(w)?;

        match self.value {
            None => (),
            Some(expression) => {
                ctr += w.write(b" = ")?;

                ctr += expression.write_to(w)?;
            }
        };

        io::Result::Ok(ctr)
    }
}

struct ExportImport {
    value: Declaration,
}

impl<W: io::Write> WriteTo<W> for ExportImport {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;

        ctr += w.write(b"export ")?;
        ctr += self.value.write_to(w)?;

        Result::Ok(ctr)
    }
}

enum Statement {
    Declaration(Declaration),
    ExportImport(ExportImport),
}

impl<W: io::Write> WriteTo<W> for Statement {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        match self {
            Statement::Declaration(d) => ctr += d.write_to(w)?,
            Statement::ExportImport(d) => ctr += d.write_to(w)?,
        }

        ctr += w.write(b";")?;

        Result::Ok(ctr)
    }
}

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

    val.write_to(&mut io::stdout());
}
