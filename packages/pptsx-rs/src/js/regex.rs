//! RegExp do JS sobre o crate `regex`: o suficiente para o que decks e DS fazem com texto
//! (split por espaço, limpeza, extração de número). Sem lookaround nem backreference.

use std::cell::Cell;
use std::rc::Rc;

use super::interp::Interp;
use super::value::*;
use super::{R, fail};

pub struct JsRegex {
    pub source: String,
    pub flags: String,
    pub re: regex::Regex,
    /// `lastIndex` (em caracteres) das flags g/y.
    pub last: Cell<usize>,
}

impl JsRegex {
    pub fn global(&self) -> bool {
        self.flags.contains('g')
    }

    fn sticky(&self) -> bool {
        self.flags.contains('y')
    }
}

/// Padrão do JS → sintaxe do crate `regex` (flags inline; `/` escapada vira `/`).
pub fn compile(source: &str, flags: &str) -> Result<JsRegex, String> {
    let mut inline = String::new();
    for (js, rs) in [('i', 'i'), ('m', 'm'), ('s', 's')] {
        if flags.contains(js) {
            inline.push(rs);
        }
    }
    let body = source.replace("\\/", "/");
    let pattern = if inline.is_empty() { body } else { format!("(?{inline}){body}") };
    let re = regex::Regex::new(&pattern).map_err(|e| format!("regex /{source}/ não suportada: {}", e.to_string().lines().last().unwrap_or("")))?;
    Ok(JsRegex { source: source.to_string(), flags: flags.to_string(), re, last: Cell::new(0) })
}

pub fn regex_val(r: JsRegex) -> Value {
    Value::Regex(Rc::new(r))
}

fn char_to_byte(s: &str, chars: usize) -> usize {
    s.char_indices().nth(chars).map_or(s.len(), |(b, _)| b)
}

fn byte_to_char(s: &str, byte: usize) -> usize {
    s[..byte].chars().count()
}

thread_local! {
    /// `index` e `input` dos arrays de exec/match (o array do JS tem essas propriedades; o daqui
    /// não guarda propriedades, então ficam ao lado, pelo endereço, conferido pelo Weak).
    static MATCH_INFO: std::cell::RefCell<Vec<(std::rc::Weak<std::cell::RefCell<Vec<Value>>>, f64, Rc<str>)>> = const { std::cell::RefCell::new(Vec::new()) };
}

/// `index`/`input` de um array de resultado de regex, se for um.
pub fn match_prop(a: &Rc<std::cell::RefCell<Vec<Value>>>, key: &str) -> Option<Value> {
    MATCH_INFO.with(|m| {
        let mut m = m.borrow_mut();
        m.retain(|(w, _, _)| w.strong_count() > 0);
        m.iter().find(|(w, _, _)| w.upgrade().is_some_and(|x| Rc::ptr_eq(&x, a))).map(|(_, index, input)| match key {
            "index" => Value::Num(*index),
            _ => Value::Str(input.clone()),
        })
    })
}

/// Resultado de exec: [casamento, grupos…] (grupo ausente = undefined), com `index` e `input`.
fn match_array(caps: &regex::Captures, s: &str) -> Value {
    let v = arr_val(caps.iter().map(|m| m.map_or(Value::Undefined, |m| str_val(m.as_str()))).collect());
    if let (Value::Array(a), Some(m)) = (&v, caps.get(0)) {
        let index = byte_to_char(s, m.start()) as f64;
        MATCH_INFO.with(|info| info.borrow_mut().push((Rc::downgrade(a), index, Rc::from(s))));
    }
    v
}

pub fn exec(r: &JsRegex, s: &str) -> Value {
    let start = if r.global() || r.sticky() { char_to_byte(s, r.last.get()) } else { 0 };
    if start > s.len() {
        r.last.set(0);
        return Value::Null;
    }
    match r.re.captures_at(s, start) {
        Some(caps) if !r.sticky() || caps.get(0).is_some_and(|m| m.start() == start) => {
            if r.global() || r.sticky() {
                let end = caps.get(0).map_or(start, |m| m.end());
                let next = if end == start { byte_to_char(s, end) + 1 } else { byte_to_char(s, end) };
                r.last.set(next);
            }
            match_array(&caps, s)
        }
        _ => {
            r.last.set(0);
            Value::Null
        }
    }
}

pub fn regex_prop(r: &Rc<JsRegex>, key: &str) -> Value {
    let this = Value::Regex(r.clone());
    match key {
        "source" => str_val(&r.source),
        "flags" => str_val(&r.flags),
        "global" => Value::Bool(r.global()),
        "lastIndex" => Value::Num(r.last.get() as f64),
        "test" => super::builtins::native("test", |_, this, a| {
            let Value::Regex(r) = this else { return Ok(Value::Bool(false)) };
            let s = a.first().map(Value::to_js_string).unwrap_or_default();
            Ok(Value::Bool(!matches!(exec(r, &s), Value::Null)))
        }, this),
        "exec" => super::builtins::native("exec", |_, this, a| {
            let Value::Regex(r) = this else { return Ok(Value::Null) };
            Ok(exec(r, &a.first().map(Value::to_js_string).unwrap_or_default()))
        }, this),
        "toString" => super::builtins::native("toString", |_, this, _| Ok(str_val(&this.to_js_string())), this),
        _ => Value::Undefined,
    }
}

// ───────────── métodos de string com regex ─────────────

pub fn split(s: &str, r: &JsRegex, limit: usize) -> Value {
    // Como no JS: grupos de captura entram no resultado.
    let mut out = Vec::new();
    let mut last = 0;
    for caps in r.re.captures_iter(s) {
        let m = caps.get(0).expect("grupo 0");
        if m.start() == m.end() && (m.start() == 0 || m.start() == s.len()) {
            continue;
        }
        out.push(str_val(&s[last..m.start()]));
        for g in caps.iter().skip(1) {
            out.push(g.map_or(Value::Undefined, |g| str_val(g.as_str())));
        }
        last = m.end();
    }
    out.push(str_val(&s[last..]));
    if s.is_empty() && r.re.is_match("") {
        out.clear();
    }
    out.truncate(limit);
    arr_val(out)
}

/// `$1`…`$99`, `$&`, `$$` na string de substituição.
fn expand(template: &str, caps: &regex::Captures) -> String {
    let mut out = String::new();
    let mut chars = template.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '$' {
            out.push(c);
            continue;
        }
        match chars.peek().copied() {
            Some('$') => {
                chars.next();
                out.push('$');
            }
            Some('&') => {
                chars.next();
                out.push_str(caps.get(0).map_or("", |m| m.as_str()));
            }
            Some(d) if d.is_ascii_digit() => {
                let mut n = String::new();
                while let Some(d) = chars.peek().copied().filter(char::is_ascii_digit) {
                    n.push(d);
                    chars.next();
                    if n.len() == 2 {
                        break;
                    }
                }
                let idx: usize = n.parse().unwrap_or(0);
                out.push_str(caps.get(idx).map_or("", |m| m.as_str()));
            }
            _ => out.push('$'),
        }
    }
    out
}

pub fn replace(it: &mut Interp, s: &str, r: &JsRegex, replacement: &Value, all: bool) -> R<Value> {
    if all && !r.global() {
        return fail("replaceAll com regex precisa da flag g");
    }
    let global = all || r.global();
    let mut out = String::new();
    let mut last = 0;
    for caps in r.re.captures_iter(s) {
        let m = caps.get(0).expect("grupo 0");
        out.push_str(&s[last..m.start()]);
        let rep = match replacement {
            Value::Func(_) => {
                let mut args: Vec<Value> = caps.iter().map(|g| g.map_or(Value::Undefined, |g| str_val(g.as_str()))).collect();
                args.push(Value::Num(byte_to_char(s, m.start()) as f64));
                args.push(str_val(s));
                it.call(replacement, args)?.to_js_string()
            }
            other => expand(&other.to_js_string(), &caps),
        };
        out.push_str(&rep);
        last = m.end();
        if !global {
            break;
        }
    }
    out.push_str(&s[last..]);
    Ok(str_val(&out))
}

pub fn string_match(s: &str, r: &JsRegex) -> Value {
    if !r.global() {
        r.last.set(0);
        return exec(r, s);
    }
    let all: Vec<Value> = r.re.find_iter(s).map(|m| str_val(m.as_str())).collect();
    if all.is_empty() { Value::Null } else { arr_val(all) }
}

pub fn match_all(s: &str, r: &JsRegex) -> Value {
    arr_val(r.re.captures_iter(s).map(|c| match_array(&c, s)).collect())
}

pub fn search(s: &str, r: &JsRegex) -> Value {
    Value::Num(r.re.find(s).map_or(-1.0, |m| byte_to_char(s, m.start()) as f64))
}
