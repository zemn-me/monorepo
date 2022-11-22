/// This file is a sketch of a system for a typescript module like AST,
/// eventually to be used for generating CSS modules.
use std::io;

pub trait WriteTo<W>
where
    W: io::Write,
{
    fn write_to(self, w: &mut W) -> io::Result<usize>;
}

#[derive(Copy, Clone)]
pub struct TokDoubleQuote;

impl<W: io::Write> WriteTo<W> for TokDoubleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(b"\"")
    }
}

#[derive(Copy, Clone)]
pub struct TokSingleQuote;

impl<W: io::Write> WriteTo<W> for TokSingleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(b"'")
    }
}

#[derive(Copy, Clone)]
pub enum TokQuote {
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

pub struct ConstantString {
    pub value: String,
    pub quote: TokQuote,
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

pub struct ConstantNumber {
    pub value: i64,
}

impl<W: io::Write> WriteTo<W> for ConstantNumber {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.to_string().as_bytes())
    }
}

pub enum Expression {
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

pub struct Identifier {
    pub value: String,
}

impl<W: io::Write> WriteTo<W> for Identifier {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.as_bytes())
    }
}

pub struct Declaration {
    pub name: Identifier,
    pub value: Option<Expression>,
}

impl<W: io::Write> WriteTo<W> for Declaration {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        ctr += w.write(b"const ")?;
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

pub struct Export {
    pub value: Declaration,
}

impl<W: io::Write> WriteTo<W> for Export {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;

        ctr += w.write(b"export ")?;
        ctr += self.value.write_to(w)?;

        Result::Ok(ctr)
    }
}

pub struct Import {
    pub from: String,
}

impl<W: io::Write> WriteTo<W> for Import {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;

        ctr += w.write(b"import ")?;
        ctr += w.write(b"\"")?;
        ctr += w.write(self.from.as_bytes())?;
        ctr += w.write(b"\"")?;

        Result::Ok(ctr)
    }
}

pub enum Statement {
    Declaration(Declaration),
    Import(Import),
    Export(Export),
}

impl<W: io::Write> WriteTo<W> for Statement {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        match self {
            Statement::Declaration(d) => ctr += d.write_to(w)?,
            Statement::Import(d) => ctr += d.write_to(w)?,
            Statement::Export(d) => ctr += d.write_to(w)?,
        }

        Result::Ok(ctr)
    }
}

pub struct Module {
    pub statements: Vec<Statement>,
}

impl<W: io::Write> WriteTo<W> for Module {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;

        for statement in self.statements {
            ctr += statement.write_to(w)?;
            ctr += w.write(b";\n")?;
        }

        Ok(ctr)
    }
}
