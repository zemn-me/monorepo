/// This file is a sketch of a system for a typescript module like AST,
/// eventually to be used for generating CSS modules.
use std::{convert, default::Default, io};

pub trait WriteTo<W>
where
    W: io::Write,
{
    fn write_to(self, w: &mut W) -> io::Result<usize>;
}

/// SyntaxElement is some element and / or a comment.
/// This allows representation of the free placement of comments,
/// as long as they don't interrupt abstract syntax elements.
#[derive(Clone, Debug)]
pub struct CommentableSyntaxElement<T, W>
where
    W: io::Write,
    T: WriteTo<W>,
{
    fake: std::marker::PhantomData<W>,
    comment: Option<MultiLineComment>,
    element: T,
}

impl<W: io::Write, T: WriteTo<W>> WriteTo<W> for CommentableSyntaxElement<T, W> {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        ctr += match self.comment {
            Some(v) => v.write_to(w)?,
            None => 0,
        };

        WriteTo::write_to(self.element, w)?;

        Ok(ctr)
    }
}

#[derive(Clone, Debug)]
pub struct MultiLineComment {
    content: String,
}

impl<W: io::Write> WriteTo<W> for MultiLineComment {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        ctr += w.write(b"/*")?;
        ctr += w.write(self.content.replace("*/", "*\\/").as_bytes())?;
        ctr += w.write(b"*/")?;
        Ok(ctr)
    }
}

#[derive(Copy, Clone, Debug)]
pub struct TokDoubleQuote;

impl<W: io::Write> WriteTo<W> for TokDoubleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(b"\"")
    }
}

impl convert::From<TokDoubleQuote> for TokQuote {
    fn from(v: TokDoubleQuote) -> Self {
        Self::Double(v)
    }
}

#[derive(Copy, Clone, Debug)]
pub struct TokSingleQuote;

impl<W: io::Write> WriteTo<W> for TokSingleQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(b"'")
    }
}

impl convert::From<TokSingleQuote> for TokQuote {
    fn from(v: TokSingleQuote) -> Self {
        Self::Single(v)
    }
}

#[derive(Copy, Clone, Debug)]
pub enum TokQuote {
    Double(TokDoubleQuote),
    Single(TokSingleQuote),
}

impl Default for TokQuote {
    fn default() -> Self {
        TokSingleQuote.into()
    }
}

impl<W: io::Write> WriteTo<W> for TokQuote {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        match self {
            Self::Double(v) => v.write_to(w),
            Self::Single(v) => v.write_to(w),
        }
    }
}

#[derive(Default, Debug)]
pub struct ConstantString {
    pub value: String,
    pub quote: TokQuote,
}

impl convert::From<String> for ConstantString {
    fn from(value: String) -> Self {
        Self {
            value,
            ..Default::default()
        }
    }
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

#[derive(Default, Debug)]
pub struct ConstantNumber {
    pub value: i64,
}

impl<W: io::Write> WriteTo<W> for ConstantNumber {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.to_string().as_bytes())
    }
}

#[derive(Debug)]
pub struct Undefined;

impl<W: io::Write> WriteTo<W> for Undefined {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(b"undefined")
    }
}

#[derive(Debug)]
pub enum Expression {
    String(ConstantString),
    Number(ConstantNumber),
    Undefined(Undefined),
}

impl Default for Expression {
    fn default() -> Self {
        Undefined.into()
    }
}

impl convert::From<String> for Expression {
    fn from(v: String) -> Self {
        let x: ConstantString = v.into();
        x.into()
    }
}

impl convert::From<ConstantString> for Expression {
    fn from(v: ConstantString) -> Self {
        Self::String(v)
    }
}

impl convert::From<ConstantNumber> for Expression {
    fn from(v: ConstantNumber) -> Self {
        Self::Number(v)
    }
}

impl convert::From<Undefined> for Expression {
    fn from(v: Undefined) -> Self {
        Self::Undefined(v)
    }
}

impl<W: io::Write> WriteTo<W> for Expression {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        match self {
            Self::Number(n) => n.write_to(w),
            Self::String(n) => n.write_to(w),
            Self::Undefined(n) => n.write_to(w),
        }
    }
}

#[derive(Default, Debug)]
pub struct Identifier {
    pub value: String,
}

impl convert::From<String> for Identifier {
    fn from(value: String) -> Self {
        Self { value }
    }
}

impl<W: io::Write> WriteTo<W> for Identifier {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        w.write(self.value.as_bytes())
    }
}

#[derive(Debug)]
pub struct Declare {
    pub name: Identifier,
    pub value: Option<Expression>,
}

impl<W: io::Write> WriteTo<W> for Declare {
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

#[derive(Debug)]
pub struct Export {
    pub value: Declare,
}

impl<W: io::Write> WriteTo<W> for Export {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;

        ctr += w.write(b"export ")?;
        ctr += self.value.write_to(w)?;

        Result::Ok(ctr)
    }
}

#[derive(Default, Debug)]
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

#[derive(Debug)]
pub enum Statement<W: io::Write> {
    Declaration(CommentableSyntaxElement<Declaration, W>),
    Import(CommentableSyntaxElement<Import, W>),
    Export(CommentableSyntaxElement<Export, W>),
    // the empty statement (i.e. ";")
    Empty,
}

impl<W: io::Write> convert::From<Declare> for Statement<W> {
    fn from(v: Declare) -> Self {
        Self::Declaration(v)
    }
}

impl convert::From<Import> for Statement {
    fn from(v: Import) -> Self {
        Self::Import(v)
    }
}

impl convert::From<Export> for Statement {
    fn from(v: Export) -> Self {
        Self::Export(v)
    }
}

impl Default for Statement {
    fn default() -> Self {
        Self::Empty
    }
}

impl<W: io::Write> WriteTo<W> for Statement {
    fn write_to(self, w: &mut W) -> io::Result<usize> {
        let mut ctr: usize = 0;
        match self {
            Self::Declaration(d) => ctr += d.write_to(w)?,
            Self::Import(d) => ctr += d.write_to(w)?,
            Self::Export(d) => ctr += d.write_to(w)?,
            Self::Empty => (), // nothing
        }

        Result::Ok(ctr)
    }
}

#[derive(Debug, Default)]
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
