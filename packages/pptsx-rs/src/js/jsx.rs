//! JSX: a tag de um componente do autor é chamada na hora (expansão ansiosa); a de uma
//! primitiva vira `Element` com os filhos já achatados.

use std::rc::Rc;

use oxc_ast::ast::*;

use super::interp::{Interp, short_desc};
use super::value::*;
use super::{R, fail};

impl Interp {
    pub fn eval_jsx_element(&mut self, el: &'static JSXElement<'static>, env: &Env) -> R<Value> {
        let tag = match &el.opening_element.name {
            JSXElementName::IdentifierReference(r) => self.lookup_var(r.name.as_str(), r.span, env)?,
            JSXElementName::MemberExpression(m) => self.eval_jsx_member(m, env)?,
            JSXElementName::Identifier(id) => {
                return self.err(id.span, format!("<{}> não existe no pptsx: use as primitivas (Box, Text, Shape, Image…)", id.name.as_str()));
            }
            JSXElementName::NamespacedName(n) => return self.err(n.span, "tags com namespace não são suportadas"),
            JSXElementName::ThisExpression(t) => return self.err(t.span, "`this` não é suportado em decks"),
        };
        let mut props = Obj::new();
        for item in &el.opening_element.attributes {
            match item {
                JSXAttributeItem::Attribute(a) => {
                    let name = match &a.name {
                        JSXAttributeName::Identifier(id) => id.name.as_str().to_string(),
                        JSXAttributeName::NamespacedName(n) => format!("{}:{}", n.namespace.name.as_str(), n.name.name.as_str()),
                    };
                    let value = match &a.value {
                        None => Value::Bool(true),
                        Some(JSXAttributeValue::StringLiteral(s)) => str_val(&decode_entities(s.value.as_str())),
                        Some(JSXAttributeValue::ExpressionContainer(c)) => match c.expression.as_expression() {
                            Some(e) => self.eval(e, env)?,
                            None => Value::Undefined,
                        },
                        Some(JSXAttributeValue::Element(e)) => self.eval_jsx_element(e, env)?,
                        Some(JSXAttributeValue::Fragment(f)) => self.eval_jsx_fragment(f, env)?,
                    };
                    props.insert(Rc::from(name), value);
                }
                JSXAttributeItem::SpreadAttribute(s) => {
                    let v = self.eval(&s.argument, env)?;
                    for (k, item) in super::builtins::entries_of(&v) {
                        props.insert(k, item);
                    }
                }
            }
        }
        let children = self.jsx_children(&el.children, env)?;
        self.make_element(&tag, props, Some(children)).map_err(|t| self.locate(t, el.opening_element.span))
    }

    pub fn eval_jsx_fragment(&mut self, f: &'static JSXFragment<'static>, env: &Env) -> R<Value> {
        let children = self.jsx_children(&f.children, env)?;
        let mut out = Vec::new();
        normalize_children(children, &mut out)?;
        Ok(Value::Element(Rc::new(Element { kind: Kind::Fragment, props: Rc::new(Obj::new()), children: out, component: false, source: None })))
    }

    fn eval_jsx_member(&mut self, m: &'static JSXMemberExpression<'static>, env: &Env) -> R<Value> {
        let obj = match &m.object {
            JSXMemberExpressionObject::IdentifierReference(r) => self.lookup_var(r.name.as_str(), r.span, env)?,
            JSXMemberExpressionObject::MemberExpression(inner) => self.eval_jsx_member(inner, env)?,
            JSXMemberExpressionObject::ThisExpression(t) => return self.err(t.span, "`this` não é suportado em decks"),
        };
        self.get_prop(&obj, m.property.name.as_str()).map_err(|t| self.locate(t, m.span))
    }

    fn jsx_children(&mut self, children: &'static [JSXChild<'static>], env: &Env) -> R<Vec<Value>> {
        let mut out = Vec::new();
        for child in children {
            match child {
                JSXChild::Text(t) => {
                    let text = clean_jsx_text(t.value.as_str());
                    if !text.is_empty() {
                        out.push(str_val(&decode_entities(&text)));
                    }
                }
                JSXChild::Element(e) => out.push(self.eval_jsx_element(e, env)?),
                JSXChild::Fragment(f) => out.push(self.eval_jsx_fragment(f, env)?),
                JSXChild::ExpressionContainer(c) => {
                    if let Some(e) = c.expression.as_expression() {
                        out.push(self.eval(e, env)?);
                    }
                }
                JSXChild::Spread(s) => {
                    let v = self.eval(&s.expression, env)?;
                    self.spread_into(&v, &mut out, s.span)?;
                }
            }
        }
        Ok(out)
    }

    /// Cria o elemento (primitiva) ou chama o componente. `children` = filhos do JSX;
    /// `None` = chamada direta (`Box({...})`, `jsx(Box, props)`), filhos em `props.children`.
    pub fn make_element(&mut self, tag: &Value, mut props: Obj, children: Option<Vec<Value>>) -> R<Value> {
        let Value::Func(func) = tag else {
            return fail(format!("{} não é um componente", short_desc(tag)));
        };
        let children = match children {
            Some(list) if !list.is_empty() => list,
            _ => match props.shift_remove("children") {
                Some(Value::Array(items)) => items.borrow().to_vec(),
                Some(Value::Undefined) | None => Vec::new(),
                Some(other) => vec![other],
            },
        };
        props.shift_remove("key");
        if let Func::Intrinsic(kind) = &**func {
            let (kind, defaults): (Kind, &[(&str, &str)]) = match kind {
                Kind::B => (Kind::Span, &[("fontWeight", "bold")]),
                Kind::I => (Kind::Span, &[("fontStyle", "italic")]),
                Kind::Sup => (Kind::Span, &[("verticalAlign", "super")]),
                Kind::Sub => (Kind::Span, &[("verticalAlign", "sub")]),
                other => (*other, &[]),
            };
            for (k, v) in defaults {
                if !props.contains_key(*k) {
                    props.insert(Rc::from(*k), str_val(v));
                }
            }
            // M19: o filho do Container é a função do espaço; ela roda depois do layout que o mede.
            let out = match (kind, children.as_slice()) {
                (Kind::Container, [Value::Func(_)]) => children,
                _ => {
                    let mut out = Vec::new();
                    normalize_children(children, &mut out)?;
                    out
                }
            };
            return Ok(Value::Element(Rc::new(Element { kind, props: Rc::new(props), children: out, component: false, source: None })));
        }
        match children.len() {
            0 => {}
            1 => {
                props.insert(Rc::from("children"), children.into_iter().next().unwrap_or(Value::Undefined));
            }
            _ => {
                props.insert(Rc::from("children"), arr_val(children));
            }
        }
        let meta = component_meta(tag);
        let source = Rc::new((tag.clone(), props.clone()));
        match self.call(tag, vec![obj_val(props)])? {
            // O componente mais externo vence (resolve/expand.ts): o meta dele fica no elemento,
            // para o lint (`ctx.component`) e o path dos achados.
            Value::Element(e) if e.kind != Kind::Fragment => {
                let mut props = (*e.props).clone();
                if let Some(meta) = meta {
                    props.insert(Rc::from(COMPONENT_PROP), meta);
                }
                Ok(Value::Element(Rc::new(Element { kind: e.kind, props: Rc::new(props), children: e.children.clone(), component: true, source: Some(source) })))
            }
            // Fragment: cada filho é raiz do componente (resolve/expand.ts passa o `outer` adiante).
            Value::Element(e) if e.kind == Kind::Fragment && meta.is_some() => {
                let children = e
                    .children
                    .iter()
                    .map(|c| match c {
                        Value::Element(child) => {
                            let mut props = (*child.props).clone();
                            props.insert(Rc::from(COMPONENT_PROP), meta.clone().unwrap_or(Value::Undefined));
                            Value::Element(Rc::new(Element { kind: child.kind, props: Rc::new(props), children: child.children.clone(), component: child.component, source: child.source.clone() }))
                        }
                        other => other.clone(),
                    })
                    .collect();
                Ok(Value::Element(Rc::new(Element { kind: Kind::Fragment, props: e.props.clone(), children, component: e.component, source: e.source.clone() })))
            }
            other => Ok(other),
        }
    }
}

/// Achata arrays e fragments; descarta null/undefined/booleanos; números viram texto.
pub fn normalize_children(values: Vec<Value>, out: &mut Vec<Value>) -> R<()> {
    for v in values {
        match v {
            Value::Undefined | Value::Null | Value::Bool(_) => {}
            Value::Num(n) => out.push(str_val(&num_to_string(n))),
            Value::Str(_) => out.push(v),
            Value::Array(items) => normalize_children(items.borrow().to_vec(), out)?,
            Value::Element(e) if e.kind == Kind::Fragment => out.extend(e.children.iter().cloned()),
            Value::Element(_) => out.push(v),
            Value::Object(_) | Value::Regex(_) => return fail("objeto não é um filho válido (esperado elemento ou texto)"),
            Value::Func(_) => return fail("função não é um filho válido (faltou chamar o componente?)"),
        }
    }
    Ok(())
}

/// Regra do JSX (Babel): linhas só de espaço somem, cada linha é aparada e as linhas
/// restantes se juntam com um espaço.
fn clean_jsx_text(raw: &str) -> String {
    let lines: Vec<&str> = raw.split('\n').map(|l| l.strip_suffix('\r').unwrap_or(l)).collect();
    let last_non_empty = lines.iter().rposition(|l| l.chars().any(|c| c != ' ' && c != '\t'));
    let mut out = String::new();
    for (i, line) in lines.iter().enumerate() {
        let mut text: &str = line;
        let replaced;
        if text.contains('\t') {
            replaced = text.replace('\t', " ");
            text = &replaced;
        }
        if i != 0 {
            text = text.trim_start_matches(' ');
        }
        if i != lines.len() - 1 {
            text = text.trim_end_matches(' ');
        }
        if text.is_empty() {
            continue;
        }
        out.push_str(text);
        if Some(i) != last_non_empty {
            out.push(' ');
        }
    }
    out
}

fn decode_entities(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let tail = &rest[amp..];
        let Some(semi) = tail.find(';').filter(|&p| p <= 10) else {
            out.push('&');
            rest = &tail[1..];
            continue;
        };
        let entity = &tail[1..semi];
        let decoded = match entity {
            "nbsp" => Some('\u{a0}'),
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            "mdash" => Some('—'),
            "ndash" => Some('–'),
            "hellip" => Some('…'),
            "middot" => Some('·'),
            "bull" => Some('•'),
            "copy" => Some('©'),
            e if e.starts_with("#x") => u32::from_str_radix(&e[2..], 16).ok().and_then(char::from_u32),
            e if e.starts_with('#') => e[1..].parse().ok().and_then(char::from_u32),
            _ => None,
        };
        match decoded {
            Some(c) => {
                out.push(c);
                rest = &tail[semi + 1..];
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Meta do componente (`defineComponent` traz o inteiro; função comum, só o nome).
fn component_meta(tag: &Value) -> Option<Value> {
    let Value::Func(f) = tag else { return None };
    match &**f {
        Func::Component { meta, .. } => Some(meta.clone()),
        Func::Closure(c) if !c.name.is_empty() => {
            let mut o = Obj::new();
            o.insert(Rc::from("name"), Value::Str(c.name.clone()));
            Some(obj_val(o))
        }
        // defineLayout: o componente embrulhado.
        Func::Native(n) => match &n.this {
            Value::Object(o) => o.get("component").and_then(component_meta),
            _ => None,
        },
        _ => None,
    }
}
