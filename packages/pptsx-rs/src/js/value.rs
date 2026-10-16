//! Valores do subconjunto JS que um deck pode produzir. Tudo é imutável (Rc sem RefCell):
//! o subconjunto não tem mutação de objetos/arrays, só de `let` locais.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::rc::Rc;

use indexmap::IndexMap;
use oxc_ast::ast::{Expression, FormalParameters, FunctionBody};

use super::interp::Interp;

pub type Obj = IndexMap<Rc<str>, Value>;

#[derive(Clone)]
pub enum Value {
    Undefined,
    Null,
    Bool(bool),
    Num(f64),
    Str(Rc<str>),
    /// Arrays são mutáveis (push/sort em arrays locais é comum em código de DS).
    Array(Rc<RefCell<Vec<Value>>>),
    Object(Rc<Obj>),
    Func(Rc<Func>),
    Element(Rc<Element>),
    Regex(Rc<super::regex::JsRegex>),
}

/// Tipo de nó do pptsx. `B`/`I`/`Sup`/`Sub` viram `Span` com props padrão ao criar o elemento.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Deck,
    Slide,
    Box,
    Text,
    Image,
    Shape,
    Span,
    Chart,
    Table,
    Path,
    Icon,
    Connector,
    SlideNumber,
    /// M19: Box cujo conteúdo é uma função do espaço medido.
    Container,
    Fragment,
    B,
    I,
    Sup,
    Sub,
}

impl Kind {
    pub fn name(self) -> &'static str {
        match self {
            Kind::Deck => "Deck",
            Kind::Slide => "Slide",
            Kind::Box => "Box",
            Kind::Text => "Text",
            Kind::Image => "Image",
            Kind::Shape => "Shape",
            Kind::Span => "Span",
            Kind::Chart => "Chart",
            Kind::Table => "Table",
            Kind::Path => "Path",
            Kind::Icon => "Icon",
            Kind::Connector => "Connector",
            Kind::SlideNumber => "SlideNumber",
            Kind::Container => "Container",
            Kind::Fragment => "Fragment",
            Kind::B => "B",
            Kind::I => "I",
            Kind::Sup => "Sup",
            Kind::Sub => "Sub",
        }
    }
}

pub struct Element {
    pub kind: Kind,
    /// Props sem `children`.
    pub props: Rc<Obj>,
    /// Filhos já normalizados: só `Value::Str` e `Value::Element` (sem Fragment).
    pub children: Vec<Value>,
    /// Raiz do que um componente do autor devolveu: o escopo do shrink (fit/scope.ts).
    pub component: bool,
    /// O componente e as props com que o elemento foi criado: no pptsx o elemento guarda
    /// `type`/`props` e só é expandido no resolve; aqui ele já vem expandido, e `source` deixa
    /// um DS ler `child.type`/`child.props` e recriá-lo (`jsx(child.type, {...child.props, size})`).
    pub source: Option<Rc<(Value, Obj)>>,
}

#[derive(Clone, Copy)]
pub enum Body {
    Block(&'static FunctionBody<'static>),
    Expr(&'static Expression<'static>),
}

pub struct Closure {
    pub name: Rc<str>,
    pub params: &'static FormalParameters<'static>,
    pub body: Body,
    pub env: Env,
    pub module: usize,
}

pub type NativeFn = fn(&mut Interp, &Value, &[Value]) -> super::R<Value>;

pub struct Native {
    pub name: &'static str,
    pub f: NativeFn,
    /// Receptor já ligado (métodos de array/string, `ctx.pick`).
    pub this: Value,
}

pub enum Func {
    Closure(Closure),
    Native(Native),
    Intrinsic(Kind),
    /// `defineComponent`: padrões mesclados antes de chamar `inner`.
    Component { name: Rc<str>, inner: Value, defaults: Option<Rc<Obj>>, meta: Value },
}

// ───────────── ambiente ─────────────

pub struct Slot {
    pub value: Value,
    pub mutable: bool,
}

pub struct Scope {
    pub vars: RefCell<HashMap<Rc<str>, Slot>>,
    pub parent: Option<Env>,
}

pub type Env = Rc<Scope>;

pub fn scope(parent: Option<&Env>) -> Env {
    Rc::new(Scope { vars: RefCell::new(HashMap::new()), parent: parent.cloned() })
}

impl Scope {
    pub fn define(&self, name: &str, value: Value, mutable: bool) {
        self.vars.borrow_mut().insert(Rc::from(name), Slot { value, mutable });
    }

    pub fn lookup(&self, name: &str) -> Option<Value> {
        if let Some(slot) = self.vars.borrow().get(name) {
            return Some(slot.value.clone());
        }
        self.parent.as_ref().and_then(|p| p.lookup(name))
    }

    /// Ok(true) = atribuído; Ok(false) = não existe; Err = é const.
    pub fn assign(&self, name: &str, value: Value) -> Result<bool, ()> {
        if let Some(slot) = self.vars.borrow_mut().get_mut(name) {
            if !slot.mutable {
                return Err(());
            }
            slot.value = value;
            return Ok(true);
        }
        match &self.parent {
            Some(p) => p.assign(name, value),
            None => Ok(false),
        }
    }
}

// ───────────── conversões JS ─────────────

/// `COMPONENT_META` do pptsx é um Symbol; aqui, uma chave reservada.
pub const COMPONENT_META_KEY: &str = "@@pptsx/component-meta";
/// Prop interna do <Slide> que veio de um `defineLayout` (M15).
pub const LAYOUT_KEY: &str = "@@pptsx/layout";
/// Prop interna: meta do componente que gerou o elemento (o mais externo).
pub const COMPONENT_PROP: &str = "@@pptsx/component";

pub fn str_val(s: &str) -> Value {
    Value::Str(Rc::from(s))
}

pub fn obj_val(o: Obj) -> Value {
    Value::Object(Rc::new(o))
}

pub fn arr_val(a: Vec<Value>) -> Value {
    Value::Array(Rc::new(RefCell::new(a)))
}

impl Value {
    pub fn truthy(&self) -> bool {
        match self {
            Value::Undefined | Value::Null => false,
            Value::Bool(b) => *b,
            Value::Num(n) => *n != 0.0 && !n.is_nan(),
            Value::Str(s) => !s.is_empty(),
            _ => true,
        }
    }

    pub fn is_nullish(&self) -> bool {
        matches!(self, Value::Undefined | Value::Null)
    }

    pub fn type_of(&self) -> &'static str {
        match self {
            Value::Undefined => "undefined",
            Value::Null => "object",
            Value::Bool(_) => "boolean",
            Value::Num(_) => "number",
            Value::Str(_) => "string",
            Value::Func(_) => "function",
            _ => "object",
        }
    }

    pub fn to_num(&self) -> f64 {
        match self {
            Value::Undefined => f64::NAN,
            Value::Null => 0.0,
            Value::Bool(b) => f64::from(u8::from(*b)),
            Value::Num(n) => *n,
            Value::Str(s) => {
                let t = s.trim();
                if t.is_empty() {
                    0.0
                } else {
                    t.parse().unwrap_or(f64::NAN)
                }
            }
            Value::Array(a) if a.borrow().is_empty() => 0.0,
            Value::Array(a) if a.borrow().len() == 1 => a.borrow()[0].to_num(),
            _ => f64::NAN,
        }
    }

    pub fn to_js_string(&self) -> String {
        match self {
            Value::Undefined => "undefined".into(),
            Value::Null => "null".into(),
            Value::Bool(b) => b.to_string(),
            Value::Num(n) => num_to_string(*n),
            Value::Str(s) => s.to_string(),
            Value::Array(a) => a
                .borrow().iter()
                .map(|v| if v.is_nullish() { String::new() } else { v.to_js_string() })
                .collect::<Vec<_>>()
                .join(","),
            Value::Object(_) | Value::Element(_) => "[object Object]".into(),
            Value::Func(_) => "function".into(),
            Value::Regex(r) => format!("/{}/{}", r.source, r.flags),
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_num(&self) -> Option<f64> {
        match self {
            Value::Num(n) => Some(*n),
            _ => None,
        }
    }
}

pub fn num_to_string(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity".into() } else { "-Infinity".into() };
    }
    if n == 0.0 {
        return "0".into();
    }
    if n.fract() == 0.0 && n.abs() < 1e21 {
        return format!("{n:.0}");
    }
    format!("{n}")
}

pub fn strict_eq(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Undefined, Value::Undefined) | (Value::Null, Value::Null) => true,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Num(x), Value::Num(y)) => x == y,
        (Value::Str(x), Value::Str(y)) => x == y,
        (Value::Array(x), Value::Array(y)) => Rc::ptr_eq(x, y),
        (Value::Object(x), Value::Object(y)) => Rc::ptr_eq(x, y),
        (Value::Func(x), Value::Func(y)) => Rc::ptr_eq(x, y),
        (Value::Element(x), Value::Element(y)) => Rc::ptr_eq(x, y),
        (Value::Regex(x), Value::Regex(y)) => Rc::ptr_eq(x, y),
        _ => false,
    }
}

pub fn loose_eq(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (x, y) if x.is_nullish() && y.is_nullish() => true,
        (x, y) if x.is_nullish() || y.is_nullish() => false,
        (Value::Num(_) | Value::Str(_) | Value::Bool(_), Value::Num(_) | Value::Str(_) | Value::Bool(_))
            if std::mem::discriminant(a) != std::mem::discriminant(b) =>
        {
            a.to_num() == b.to_num()
        }
        _ => strict_eq(a, b),
    }
}

/// JSON.stringify simplificado (debug e chaves de dados).
pub fn to_json(v: &Value, out: &mut String) {
    match v {
        Value::Undefined | Value::Func(_) => out.push_str("null"),
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Num(n) if n.is_finite() => out.push_str(&num_to_string(*n)),
        Value::Num(_) => out.push_str("null"),
        Value::Str(s) => json_str(s, out),
        Value::Array(a) => {
            out.push('[');
            for (i, item) in a.borrow().iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                to_json(item, out);
            }
            out.push(']');
        }
        Value::Object(o) => {
            out.push('{');
            let mut first = true;
            for (k, item) in o.iter() {
                if matches!(item, Value::Undefined | Value::Func(_)) {
                    continue;
                }
                if !first {
                    out.push(',');
                }
                first = false;
                json_str(k, out);
                out.push(':');
                to_json(item, out);
            }
            out.push('}');
        }
        Value::Element(e) => {
            let _ = write!(out, "{{\"$element\":\"{}\"}}", e.kind.name());
        }
        Value::Regex(_) => out.push_str("{}"),
    }
}

fn json_str(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
}
