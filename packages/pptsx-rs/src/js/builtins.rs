//! Biblioteca padrão mínima do subconjunto: o que decks e design systems usam de fato
//! (métodos de array/string, Math, Object, JSON). Nada de IO, Date ou aleatoriedade.

use std::rc::Rc;

use super::interp::{Interp, index_of};
use super::value::*;
use super::{DeckCtx, R, fail};

pub fn native(name: &'static str, f: NativeFn, this: Value) -> Value {
    Value::Func(Rc::new(Func::Native(Native { name, f, this })))
}

fn arg(args: &[Value], i: usize) -> Value {
    args.get(i).cloned().unwrap_or(Value::Undefined)
}

fn object_of(entries: &[(&'static str, Value)]) -> Value {
    let mut o = Obj::new();
    for (k, v) in entries {
        o.insert(Rc::from(*k), v.clone());
    }
    obj_val(o)
}

fn fns(entries: &[(&'static str, NativeFn)]) -> Value {
    let pairs: Vec<(&'static str, Value)> = entries.iter().map(|(k, f)| (*k, native(k, *f, Value::Undefined))).collect();
    object_of(&pairs)
}

// ───────────── globais ─────────────

pub fn install_globals(env: &Env) {
    let num = |n: f64| Value::Num(n);
    let math = {
        let mut o = match fns(&[
            ("min", |_, _, a| Ok(Value::Num(a.iter().map(Value::to_num).fold(f64::INFINITY, |m, x| if x.is_nan() || m.is_nan() { f64::NAN } else { m.min(x) })))),
            ("max", |_, _, a| Ok(Value::Num(a.iter().map(Value::to_num).fold(f64::NEG_INFINITY, |m, x| if x.is_nan() || m.is_nan() { f64::NAN } else { m.max(x) })))),
            ("round", |_, _, a| Ok(Value::Num((arg(a, 0).to_num() + 0.5).floor()))),
            ("floor", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().floor()))),
            ("ceil", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().ceil()))),
            ("abs", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().abs()))),
            ("sqrt", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().sqrt()))),
            ("cbrt", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().cbrt()))),
            ("pow", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().powf(arg(a, 1).to_num())))),
            ("sign", |_, _, a| Ok(Value::Num({ let x = arg(a, 0).to_num(); if x == 0.0 || x.is_nan() { x } else { x.signum() } }))),
            ("trunc", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().trunc()))),
            ("log", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().ln()))),
            ("log10", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().log10()))),
            ("log2", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().log2()))),
            ("exp", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().exp()))),
            ("sin", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().sin()))),
            ("cos", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().cos()))),
            ("tan", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().tan()))),
            ("atan", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().atan()))),
            ("atan2", |_, _, a| Ok(Value::Num(arg(a, 0).to_num().atan2(arg(a, 1).to_num())))),
            ("hypot", |_, _, a| Ok(Value::Num(a.iter().map(|v| v.to_num().powi(2)).sum::<f64>().sqrt()))),
            ("random", |_, _, _| fail("Math.random não é suportado (decks são determinísticos)")),
        ]) {
            Value::Object(o) => (*o).clone(),
            _ => unreachable!(),
        };
        o.insert(Rc::from("PI"), num(std::f64::consts::PI));
        o.insert(Rc::from("E"), num(std::f64::consts::E));
        obj_val(o)
    };
    env.define("Math", math, false);
    env.define(
        "Object",
        fns(&[
            ("keys", |_, _, a| Ok(arr_val(entries_of(&arg(a, 0)).into_iter().map(|(k, _)| Value::Str(k)).collect()))),
            ("values", |_, _, a| Ok(arr_val(entries_of(&arg(a, 0)).into_iter().map(|(_, v)| v).collect()))),
            ("entries", |_, _, a| Ok(arr_val(entries_of(&arg(a, 0)).into_iter().map(|(k, v)| arr_val(vec![Value::Str(k), v])).collect()))),
            ("fromEntries", |_, _, a| {
                let mut o = Obj::new();
                if let Value::Array(items) = arg(a, 0) {
                    for item in items.borrow().iter() {
                        if let Value::Array(pair) = item {
                            let key = pair.borrow().first().map(Value::to_js_string).unwrap_or_default();
                            o.insert(Rc::from(key), pair.borrow().get(1).cloned().unwrap_or(Value::Undefined));
                        }
                    }
                }
                Ok(obj_val(o))
            }),
            ("assign", |_, _, a| {
                // Objetos são imutáveis: devolve a fusão (o 1º argumento não muda).
                let mut o = Obj::new();
                for src in a {
                    for (k, v) in entries_of(src) {
                        o.insert(k, v);
                    }
                }
                Ok(obj_val(o))
            }),
            ("freeze", |_, _, a| Ok(arg(a, 0))),
            ("hasOwn", |_, _, a| Ok(Value::Bool(matches!(arg(a, 0), Value::Object(o) if o.contains_key(arg(a, 1).to_js_string().as_str()))))),
        ]),
        false,
    );
    env.define(
        "Array",
        fns(&[
            ("isArray", |_, _, a| Ok(Value::Bool(matches!(arg(a, 0), Value::Array(_))))),
            ("of", |_, _, a| Ok(arr_val(a.to_vec()))),
            ("from", |it, _, a| {
                let source = arg(a, 0);
                let items: Vec<Value> = match &source {
                    Value::Array(items) => items.borrow().to_vec(),
                    Value::Str(s) => s.chars().map(|c| str_val(&c.to_string())).collect(),
                    Value::Object(o) => {
                        let len = o.get("length").map_or(0.0, Value::to_num).max(0.0) as usize;
                        vec![Value::Undefined; len]
                    }
                    _ => Vec::new(),
                };
                let Some(f) = a.get(1) else { return Ok(arr_val(items)) };
                let mut out = Vec::with_capacity(items.len());
                for (i, item) in items.into_iter().enumerate() {
                    out.push(it.call(f, vec![item, Value::Num(i as f64)])?);
                }
                Ok(arr_val(out))
            }),
        ]),
        false,
    );
    env.define(
        "JSON",
        fns(&[
            ("stringify", |_, _, a| {
                let mut out = String::new();
                to_json(&arg(a, 0), &mut out);
                Ok(str_val(&out))
            }),
            ("parse", |_, _, a| {
                let text = arg(a, 0).to_js_string();
                let mut p = JsonParser { s: text.as_bytes(), i: 0 };
                let v = p.value().ok_or(())
                    .and_then(|v| { p.ws(); if p.i == p.s.len() { Ok(v) } else { Err(()) } });
                v.or_else(|_| fail(format!("JSON inválido perto da posição {}", p.i)))
            }),
        ]),
        false,
    );
    env.define("console", fns(&[("log", console_log), ("warn", console_note), ("error", console_note), ("info", console_log)]), false);
    env.define("Number", native("Number", |_, _, a| Ok(Value::Num(if a.is_empty() { 0.0 } else { arg(a, 0).to_num() })), Value::Undefined), false);
    env.define("String", native("String", |_, _, a| Ok(str_val(&if a.is_empty() { String::new() } else { arg(a, 0).to_js_string() })), Value::Undefined), false);
    env.define("Boolean", native("Boolean", |_, _, a| Ok(Value::Bool(arg(a, 0).truthy())), Value::Undefined), false);
    env.define("parseInt", native("parseInt", parse_int, Value::Undefined), false);
    env.define("parseFloat", native("parseFloat", parse_float, Value::Undefined), false);
    env.define("isNaN", native("isNaN", |_, _, a| Ok(Value::Bool(arg(a, 0).to_num().is_nan())), Value::Undefined), false);
    env.define("isFinite", native("isFinite", |_, _, a| Ok(Value::Bool(arg(a, 0).to_num().is_finite())), Value::Undefined), false);
    env.define("Infinity", num(f64::INFINITY), false);
    env.define("NaN", num(f64::NAN), false);
}

fn console_text(a: &[Value]) -> String {
    let parts: Vec<String> = a
        .iter()
        .map(|v| match v {
            Value::Str(s) => s.to_string(),
            other => {
                let mut out = String::new();
                to_json(other, &mut out);
                out
            }
        })
        .collect();
    parts.join(" ")
}

/// console.warn/error: nota do módulo (um DS avisando de ícone desconhecido, por exemplo), que o
/// build devolve como diagnóstico `module-warning` em vez de perder no stderr.
fn console_note(it: &mut Interp, _: &Value, a: &[Value]) -> R<Value> {
    let text = console_text(a);
    if !it.notes.contains(&text) {
        it.notes.push(text);
    }
    Ok(Value::Undefined)
}

fn console_log(_: &mut Interp, _: &Value, a: &[Value]) -> R<Value> {
    eprintln!("[deck] {}", console_text(a));
    Ok(Value::Undefined)
}

fn parse_int(_: &mut Interp, _: &Value, a: &[Value]) -> R<Value> {
    let s = arg(a, 0).to_js_string();
    let radix = a.get(1).map_or(10.0, Value::to_num) as u32;
    let t = s.trim();
    let (neg, t) = t.strip_prefix('-').map_or((false, t), |r| (true, r));
    let digits: String = t.chars().take_while(|c| c.is_digit(radix.clamp(2, 36))).collect();
    if digits.is_empty() {
        return Ok(Value::Num(f64::NAN));
    }
    let n = i64::from_str_radix(&digits, radix.clamp(2, 36)).map_or(f64::NAN, |n| n as f64);
    Ok(Value::Num(if neg { -n } else { n }))
}

fn parse_float(_: &mut Interp, _: &Value, a: &[Value]) -> R<Value> {
    let s = arg(a, 0).to_js_string();
    let t = s.trim_start();
    let end = t
        .char_indices()
        .take_while(|(i, c)| c.is_ascii_digit() || *c == '.' || ((*c == '-' || *c == '+') && *i == 0) || *c == 'e' || *c == 'E')
        .map(|(i, c)| i + c.len_utf8())
        .last()
        .unwrap_or(0);
    let mut slice = &t[..end];
    while !slice.is_empty() && slice.parse::<f64>().is_err() {
        slice = &slice[..slice.len() - 1];
    }
    Ok(Value::Num(slice.parse().unwrap_or(f64::NAN)))
}

pub fn entries_of(v: &Value) -> Vec<(Rc<str>, Value)> {
    match v {
        Value::Object(o) => o.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
        Value::Array(a) => a.borrow().iter().enumerate().map(|(i, v)| (Rc::from(i.to_string()), v.clone())).collect(),
        Value::Element(e) => e.props.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
        _ => Vec::new(),
    }
}

// ───────────── contexto do deck ─────────────

pub fn ctx_value(ctx: &DeckCtx) -> Value {
    let base = object_of(&[
        ("name", str_val(&ctx.name)),
        ("width", Value::Num(ctx.width)),
        ("height", Value::Num(ctx.height)),
        ("aspect", Value::Num(ctx.aspect())),
        ("scale", Value::Num(ctx.scale())),
    ]);
    let Value::Object(o) = &base else { unreachable!() };
    let mut full = (**o).clone();
    full.insert(Rc::from("pick"), native("pick", pick_native, base.clone()));
    obj_val(full)
}

fn pick_native(_: &mut Interp, this: &Value, a: &[Value]) -> R<Value> {
    let Value::Object(ctx) = this else { return Ok(arg(a, 0)) };
    let name = ctx.get("name").map(Value::to_js_string).unwrap_or_default();
    let aspect = ctx.get("aspect").map_or(16.0 / 9.0, Value::to_num);
    let scale = ctx.get("scale").map_or(1.0, Value::to_num);
    Ok(pick_responsive(&arg(a, 0), &name, aspect, scale))
}

/// M19: o `ContainerBox` que a função do `<Container>` recebe (content box medida, em pt).
pub fn container_box(width: f64, height: f64, ctx: &DeckCtx) -> Value {
    // DEFAULTS.containerQuery: narrow ⇔ largura < 480 pt; short ⇔ altura < 240 pt.
    let (narrow, short) = (width < 480.0, height < 240.0);
    let flags = object_of(&[("narrow", Value::Bool(narrow)), ("short", Value::Bool(short))]);
    object_of(&[
        ("width", Value::Num(width)),
        ("height", Value::Num(height)),
        ("aspect", Value::Num(if height > 0.0 { width / height } else { 0.0 })),
        ("narrow", Value::Bool(narrow)),
        ("short", Value::Bool(short)),
        ("pick", native("pick", container_pick, flags)),
        ("slide", ctx_value(ctx)),
    ])
}

/// box.pick: com estreito e baixo, small > narrow > short; com um só, ele; senão base.
fn container_pick(_: &mut Interp, this: &Value, a: &[Value]) -> R<Value> {
    let value = arg(a, 0);
    let Value::Object(o) = &value else { return Ok(value) };
    let Some(base) = o.get("base") else { return Ok(value.clone()) };
    let flag = |k: &str| matches!(this, Value::Object(f) if matches!(f.get(k), Some(Value::Bool(true))));
    let keys: &[&str] = match (flag("narrow"), flag("short")) {
        (true, true) => &["small", "narrow", "short"],
        (true, false) => &["narrow"],
        (false, true) => &["short"],
        _ => &[],
    };
    Ok(keys.iter().find_map(|k| o.get(*k).filter(|v| !matches!(v, Value::Undefined)).cloned()).unwrap_or_else(|| base.clone()))
}

/// Regra do pptsx (core/responsive.ts): nome exato do tamanho > wide > tall > base.
pub fn pick_responsive(value: &Value, name: &str, aspect: f64, scale: f64) -> Value {
    let Value::Object(o) = value else { return value.clone() };
    let Some(base) = o.get("base") else { return value.clone() };
    let mut keys = vec![name];
    if scale > 1.2 && name != "wide" {
        keys.push("wide");
    }
    if aspect < 1.5 {
        keys.push("tall");
    }
    keys.iter()
        .find_map(|k| o.get(*k).filter(|v| !matches!(v, Value::Undefined)).cloned())
        .unwrap_or_else(|| base.clone())
}

// ───────────── acesso a propriedades ─────────────

pub fn get_prop(obj: &Value, key: &str) -> R<Value> {
    match obj {
        Value::Object(o) => Ok(o.get(key).cloned().unwrap_or(Value::Undefined)),
        Value::Array(a) => {
            if key == "length" || key == "size" {
                return Ok(Value::Num(a.borrow().len() as f64));
            }
            if key == "index" || key == "input" {
                return Ok(super::regex::match_prop(a, key).unwrap_or(Value::Undefined));
            }
            if let Ok(i) = key.parse::<usize>() {
                return Ok(a.borrow().get(i).cloned().unwrap_or(Value::Undefined));
            }
            Ok(array_method(key).map_or(Value::Undefined, |(name, f)| native(name, f, obj.clone())))
        }
        Value::Str(s) => {
            if key == "length" {
                return Ok(Value::Num(s.encode_utf16().count() as f64));
            }
            if let Ok(i) = key.parse::<usize>() {
                return Ok(s.chars().nth(i).map_or(Value::Undefined, |c| str_val(&c.to_string())));
            }
            Ok(string_method(key).map_or(Value::Undefined, |(name, f)| native(name, f, obj.clone())))
        }
        Value::Num(_) => Ok(number_method(key).map_or(Value::Undefined, |(name, f)| native(name, f, obj.clone()))),
        Value::Func(f) => Ok(func_static(f, key)),
        Value::Element(e) => Ok(match (key, &e.source) {
            ("props", Some(source)) => obj_val(source.1.clone()),
            ("type", Some(source)) => source.0.clone(),
            ("props", None) => {
                let mut props = (*e.props).clone();
                if !e.children.is_empty() {
                    let children = if e.children.len() == 1 { e.children[0].clone() } else { arr_val(e.children.clone()) };
                    props.insert(Rc::from("children"), children);
                }
                obj_val(props)
            }
            ("type", None) => str_val(e.kind.name()),
            _ => Value::Undefined,
        }),
        Value::Bool(_) => Ok(Value::Undefined),
        Value::Regex(r) => Ok(super::regex::regex_prop(r, key)),
        Value::Undefined | Value::Null => fail(format!("não é possível ler `{key}` de {}", obj.to_js_string())),
    }
}

fn func_static(f: &Func, key: &str) -> Value {
    let name = match f {
        Func::Native(n) => n.name,
        Func::Closure(c) if key == "name" => return Value::Str(c.name.clone()),
        Func::Component { name, .. } if key == "name" || key == "displayName" => return Value::Str(name.clone()),
        Func::Component { meta, .. } if key == COMPONENT_META_KEY => return meta.clone(),
        Func::Intrinsic(k) if key == "name" => return str_val(k.name()),
        _ => return Value::Undefined,
    };
    match (name, key) {
        (_, "name") => str_val(name),
        ("Number", "isFinite") => native("isFinite", |_, _, a| Ok(Value::Bool(matches!(arg(a, 0), Value::Num(n) if n.is_finite()))), Value::Undefined),
        ("Number", "isInteger") => native("isInteger", |_, _, a| Ok(Value::Bool(matches!(arg(a, 0), Value::Num(n) if n.is_finite() && n.fract() == 0.0))), Value::Undefined),
        ("Number", "isNaN") => native("isNaN", |_, _, a| Ok(Value::Bool(matches!(arg(a, 0), Value::Num(n) if n.is_nan()))), Value::Undefined),
        ("Number", "parseFloat") => native("parseFloat", parse_float, Value::Undefined),
        ("Number", "parseInt") => native("parseInt", parse_int, Value::Undefined),
        ("Number", "MAX_SAFE_INTEGER") => Value::Num(9007199254740991.0),
        ("Number", "EPSILON") => Value::Num(f64::EPSILON),
        _ => Value::Undefined,
    }
}

// ───────────── métodos de array ─────────────

/// Cópia dos itens (os callbacks podem mexer no array enquanto ele é percorrido).
fn this_arr(this: &Value) -> Rc<Vec<Value>> {
    match this {
        Value::Array(a) => Rc::new(a.borrow().clone()),
        _ => Rc::new(Vec::new()),
    }
}

fn with_arr<T>(this: &Value, f: impl FnOnce(&mut Vec<Value>) -> T) -> Option<T> {
    match this {
        Value::Array(a) => Some(f(&mut a.borrow_mut())),
        _ => None,
    }
}

fn rel_index(v: Option<&Value>, len: usize, default: usize) -> usize {
    let Some(v) = v.filter(|v| !matches!(v, Value::Undefined)) else { return default };
    let n = v.to_num();
    if n.is_nan() {
        return 0;
    }
    let n = n.trunc();
    if n < 0.0 { (len as f64 + n).max(0.0) as usize } else { (n as usize).min(len) }
}

fn callback_each(it: &mut Interp, this: &Value, a: &[Value], mut visit: impl FnMut(usize, &Value, Value) -> Option<Value>) -> R<Option<Value>> {
    let arr = this_arr(this);
    let f = arg(a, 0);
    for (i, item) in arr.iter().enumerate() {
        let r = it.call(&f, vec![item.clone(), Value::Num(i as f64), this.clone()])?;
        if let Some(out) = visit(i, item, r) {
            return Ok(Some(out));
        }
    }
    Ok(None)
}

fn sort_values(it: &mut Interp, items: &mut [Value], cmp: Option<&Value>) -> R<()> {
    // Merge sort estável com comparador do autor (sort_by não aceita erro no meio).
    if items.len() <= 1 {
        return Ok(());
    }
    let mid = items.len() / 2;
    sort_values(it, &mut items[..mid], cmp)?;
    sort_values(it, &mut items[mid..], cmp)?;
    let mut merged = Vec::with_capacity(items.len());
    let (mut i, mut j) = (0, mid);
    while i < mid && j < items.len() {
        let after = match cmp {
            Some(f) => it.call(f, vec![items[i].clone(), items[j].clone()])?.to_num() > 0.0,
            None => items[i].to_js_string() > items[j].to_js_string(),
        };
        if after {
            merged.push(items[j].clone());
            j += 1;
        } else {
            merged.push(items[i].clone());
            i += 1;
        }
    }
    merged.extend_from_slice(&items[i..mid]);
    merged.extend_from_slice(&items[j..]);
    items.clone_from_slice(&merged);
    Ok(())
}

fn flatten_into(v: &Value, depth: f64, out: &mut Vec<Value>) {
    match v {
        Value::Array(items) if depth >= 1.0 => items.borrow().iter().for_each(|i| flatten_into(i, depth - 1.0, out)),
        other => out.push(other.clone()),
    }
}

fn array_method(key: &str) -> Option<(&'static str, NativeFn)> {
    let f: (&'static str, NativeFn) = match key {
        "map" => ("map", |it, this, a| {
            let mut out = Vec::new();
            callback_each(it, this, a, |_, _, r| {
                out.push(r);
                None
            })?;
            Ok(arr_val(out))
        }),
        "flatMap" => ("flatMap", |it, this, a| {
            let mut out = Vec::new();
            callback_each(it, this, a, |_, _, r| {
                flatten_into(&r, 1.0, &mut out);
                None
            })?;
            Ok(arr_val(out))
        }),
        "filter" => ("filter", |it, this, a| {
            let mut out = Vec::new();
            callback_each(it, this, a, |_, item, r| {
                if r.truthy() {
                    out.push(item.clone());
                }
                None
            })?;
            Ok(arr_val(out))
        }),
        "forEach" => ("forEach", |it, this, a| {
            callback_each(it, this, a, |_, _, _| None)?;
            Ok(Value::Undefined)
        }),
        "find" => ("find", |it, this, a| Ok(callback_each(it, this, a, |_, item, r| r.truthy().then(|| item.clone()))?.unwrap_or(Value::Undefined))),
        "findIndex" => ("findIndex", |it, this, a| Ok(callback_each(it, this, a, |i, _, r| r.truthy().then_some(Value::Num(i as f64)))?.unwrap_or(Value::Num(-1.0)))),
        "some" => ("some", |it, this, a| Ok(Value::Bool(callback_each(it, this, a, |_, _, r| r.truthy().then_some(Value::Bool(true)))?.is_some()))),
        "every" => ("every", |it, this, a| Ok(Value::Bool(callback_each(it, this, a, |_, _, r| (!r.truthy()).then_some(Value::Bool(false)))?.is_none()))),
        "reduce" => ("reduce", |it, this, a| {
            let arr = this_arr(this);
            let f = arg(a, 0);
            let mut iter = arr.iter().enumerate();
            let mut acc = match a.get(1) {
                Some(init) => init.clone(),
                None => match iter.next() {
                    Some((_, first)) => first.clone(),
                    None => return fail("reduce de array vazio sem valor inicial"),
                },
            };
            for (i, item) in iter {
                acc = it.call(&f, vec![acc, item.clone(), Value::Num(i as f64), this.clone()])?;
            }
            Ok(acc)
        }),
        "includes" | "has" => ("includes", |_, this, a| {
            let needle = arg(a, 0);
            Ok(Value::Bool(this_arr(this).iter().any(|v| strict_eq(v, &needle) || (v.to_num().is_nan() && needle.to_num().is_nan() && matches!((v, &needle), (Value::Num(_), Value::Num(_)))))))
        }),
        "indexOf" => ("indexOf", |_, this, a| {
            let needle = arg(a, 0);
            Ok(Value::Num(this_arr(this).iter().position(|v| strict_eq(v, &needle)).map_or(-1.0, |i| i as f64)))
        }),
        "lastIndexOf" => ("lastIndexOf", |_, this, a| {
            let needle = arg(a, 0);
            Ok(Value::Num(this_arr(this).iter().rposition(|v| strict_eq(v, &needle)).map_or(-1.0, |i| i as f64)))
        }),
        "join" => ("join", |_, this, a| {
            let sep = match arg(a, 0) {
                Value::Undefined => ",".to_string(),
                other => other.to_js_string(),
            };
            let parts: Vec<String> = this_arr(this).iter().map(|v| if v.is_nullish() { String::new() } else { v.to_js_string() }).collect();
            Ok(str_val(&parts.join(&sep)))
        }),
        "slice" => ("slice", |_, this, a| {
            let arr = this_arr(this);
            let start = rel_index(a.first(), arr.len(), 0);
            let end = rel_index(a.get(1), arr.len(), arr.len());
            Ok(arr_val(if start < end { arr[start..end].to_vec() } else { Vec::new() }))
        }),
        "concat" => ("concat", |_, this, a| {
            let mut out = this_arr(this).to_vec();
            for v in a {
                match v {
                    Value::Array(items) => out.extend(items.borrow().iter().cloned()),
                    other => out.push(other.clone()),
                }
            }
            Ok(arr_val(out))
        }),
        "flat" => ("flat", |_, this, a| {
            let depth = a.first().map_or(1.0, Value::to_num);
            let mut out = Vec::new();
            for item in this_arr(this).iter() {
                flatten_into(item, depth, &mut out);
            }
            Ok(arr_val(out))
        }),
        "at" => ("at", |_, this, a| {
            let arr = this_arr(this);
            let n = arg(a, 0).to_num().trunc();
            let i = if n < 0.0 { arr.len() as f64 + n } else { n };
            Ok(index_of(arr.len(), i).map_or(Value::Undefined, |i| arr[i].clone()))
        }),
        "toReversed" => ("toReversed", |_, this, _| Ok(arr_val(this_arr(this).iter().rev().cloned().collect()))),
        "reverse" => ("reverse", |_, this, _| {
            with_arr(this, |v| v.reverse());
            Ok(this.clone())
        }),
        "toSorted" => ("toSorted", |it, this, a| {
            let mut items = this_arr(this).to_vec();
            let cmp = a.first().filter(|v| matches!(v, Value::Func(_))).cloned();
            sort_values(it, &mut items, cmp.as_ref())?;
            Ok(arr_val(items))
        }),
        // Como no JS: ordena no lugar e devolve o próprio array.
        "sort" => ("sort", |it, this, a| {
            let mut items = this_arr(this).to_vec();
            let cmp = a.first().filter(|v| matches!(v, Value::Func(_))).cloned();
            sort_values(it, &mut items, cmp.as_ref())?;
            with_arr(this, |v| *v = items);
            Ok(this.clone())
        }),
        "push" => ("push", |_, this, a| Ok(Value::Num(with_arr(this, |v| {
            v.extend(a.iter().cloned());
            v.len()
        }).unwrap_or(0) as f64))),
        "pop" => ("pop", |_, this, _| Ok(with_arr(this, Vec::pop).flatten().unwrap_or(Value::Undefined))),
        "shift" => ("shift", |_, this, _| Ok(with_arr(this, |v| if v.is_empty() { Value::Undefined } else { v.remove(0) }).unwrap_or(Value::Undefined))),
        "unshift" => ("unshift", |_, this, a| Ok(Value::Num(with_arr(this, |v| {
            for (i, x) in a.iter().enumerate() {
                v.insert(i, x.clone());
            }
            v.len()
        }).unwrap_or(0) as f64))),
        "splice" => ("splice", |_, this, a| {
            let len = this_arr(this).len();
            let start = rel_index(a.first(), len, 0);
            let count = a.get(1).map_or(len - start, |c| (c.to_num().max(0.0) as usize).min(len - start));
            let removed = with_arr(this, |v| v.splice(start..start + count, a.iter().skip(2).cloned()).collect::<Vec<_>>()).unwrap_or_default();
            Ok(arr_val(removed))
        }),
        "fill" => ("fill", |_, this, a| {
            let value = arg(a, 0);
            with_arr(this, |v| v.iter_mut().for_each(|x| *x = value.clone()));
            Ok(this.clone())
        }),
        "keys" => ("keys", |_, this, _| Ok(arr_val((0..this_arr(this).len()).map(|i| Value::Num(i as f64)).collect()))),
        "values" => ("values", |_, this, _| Ok(this.clone())),
        "entries" => ("entries", |_, this, _| Ok(arr_val(this_arr(this).iter().enumerate().map(|(i, v)| arr_val(vec![Value::Num(i as f64), v.clone()])).collect()))),
        "add" | "set" | "delete" | "clear" => ("mutation", |_, _, _| fail("Set/Map mutáveis não são suportados em decks: monte o array com spread ou filter")),
        _ => return None,
    };
    Some(f)
}

// ───────────── métodos de string ─────────────

fn this_str(this: &Value) -> Rc<str> {
    match this {
        Value::Str(s) => s.clone(),
        other => Rc::from(other.to_js_string()),
    }
}

fn char_slice(s: &str, start: usize, end: usize) -> String {
    s.chars().skip(start).take(end.saturating_sub(start)).collect()
}

fn char_index_of(hay: &str, needle: &str) -> Option<usize> {
    hay.find(needle).map(|byte| hay[..byte].chars().count())
}

fn string_method(key: &str) -> Option<(&'static str, NativeFn)> {
    let f: (&'static str, NativeFn) = match key {
        "toUpperCase" | "toLocaleUpperCase" => ("toUpperCase", |_, this, _| Ok(str_val(&this_str(this).to_uppercase()))),
        "toLowerCase" | "toLocaleLowerCase" => ("toLowerCase", |_, this, _| Ok(str_val(&this_str(this).to_lowercase()))),
        "trim" => ("trim", |_, this, _| Ok(str_val(this_str(this).trim()))),
        "trimStart" => ("trimStart", |_, this, _| Ok(str_val(this_str(this).trim_start()))),
        "trimEnd" => ("trimEnd", |_, this, _| Ok(str_val(this_str(this).trim_end()))),
        "toString" | "valueOf" | "normalize" => ("toString", |_, this, _| Ok(Value::Str(this_str(this)))),
        "split" => ("split", |_, this, a| {
            let s = this_str(this);
            if let Some(Value::Regex(r)) = a.first() {
                return Ok(super::regex::split(&s, r, a.get(1).map_or(usize::MAX, |v| v.to_num() as usize)));
            }
            let limit = a.get(1).map_or(usize::MAX, |v| v.to_num() as usize);
            let parts: Vec<Value> = match arg(a, 0) {
                Value::Undefined => vec![Value::Str(s.clone())],
                sep => {
                    let sep = sep.to_js_string();
                    if sep.is_empty() {
                        s.chars().map(|c| str_val(&c.to_string())).collect()
                    } else {
                        s.split(sep.as_str()).map(str_val).collect()
                    }
                }
            };
            Ok(arr_val(parts.into_iter().take(limit).collect()))
        }),
        "slice" => ("slice", |_, this, a| {
            let s = this_str(this);
            let len = s.chars().count();
            let start = rel_index(a.first(), len, 0);
            let end = rel_index(a.get(1), len, len);
            Ok(str_val(&char_slice(&s, start, end)))
        }),
        "substring" => ("substring", |_, this, a| {
            let s = this_str(this);
            let len = s.chars().count();
            let clamp = |v: Option<&Value>, d: usize| v.filter(|v| !matches!(v, Value::Undefined)).map_or(d, |v| v.to_num().max(0.0).min(len as f64) as usize);
            let (x, y) = (clamp(a.first(), 0), clamp(a.get(1), len));
            Ok(str_val(&char_slice(&s, x.min(y), x.max(y))))
        }),
        "startsWith" => ("startsWith", |_, this, a| Ok(Value::Bool(this_str(this).starts_with(arg(a, 0).to_js_string().as_str())))),
        "endsWith" => ("endsWith", |_, this, a| Ok(Value::Bool(this_str(this).ends_with(arg(a, 0).to_js_string().as_str())))),
        "includes" => ("includes", |_, this, a| Ok(Value::Bool(this_str(this).contains(arg(a, 0).to_js_string().as_str())))),
        "indexOf" => ("indexOf", |_, this, a| Ok(Value::Num(char_index_of(&this_str(this), &arg(a, 0).to_js_string()).map_or(-1.0, |i| i as f64)))),
        "lastIndexOf" => ("lastIndexOf", |_, this, a| {
            let s = this_str(this);
            let needle = arg(a, 0).to_js_string();
            Ok(Value::Num(s.rfind(needle.as_str()).map_or(-1.0, |b| s[..b].chars().count() as f64)))
        }),
        "replace" => ("replace", |it, this, a| replace(it, this, a, false)),
        "replaceAll" => ("replaceAll", |it, this, a| replace(it, this, a, true)),
        "padStart" => ("padStart", |_, this, a| pad(this, a, true)),
        "padEnd" => ("padEnd", |_, this, a| pad(this, a, false)),
        "repeat" => ("repeat", |_, this, a| Ok(str_val(&this_str(this).repeat(arg(a, 0).to_num().max(0.0) as usize)))),
        "charAt" => ("charAt", |_, this, a| Ok(str_val(&this_str(this).chars().nth(arg(a, 0).to_num().max(0.0) as usize).map(String::from).unwrap_or_default()))),
        "at" => ("at", |_, this, a| {
            let s = this_str(this);
            let len = s.chars().count();
            let n = arg(a, 0).to_num().trunc();
            let i = if n < 0.0 { len as f64 + n } else { n };
            Ok(index_of(len, i).and_then(|i| s.chars().nth(i)).map_or(Value::Undefined, |c| str_val(&c.to_string())))
        }),
        "concat" => ("concat", |_, this, a| Ok(str_val(&(this_str(this).to_string() + &a.iter().map(Value::to_js_string).collect::<String>())))),
        "match" => ("match", |_, this, a| match a.first() {
            Some(Value::Regex(r)) => Ok(super::regex::string_match(&this_str(this), r)),
            Some(other) => {
                let r = super::regex::compile(&other.to_js_string(), "").or_else(fail)?;
                Ok(super::regex::string_match(&this_str(this), &r))
            }
            None => Ok(arr_val(vec![str_val("")])),
        }),
        "matchAll" => ("matchAll", |_, this, a| match a.first() {
            Some(Value::Regex(r)) => Ok(super::regex::match_all(&this_str(this), r)),
            _ => fail("matchAll espera uma regex com flag g"),
        }),
        "search" => ("search", |_, this, a| match a.first() {
            Some(Value::Regex(r)) => Ok(super::regex::search(&this_str(this), r)),
            Some(other) => Ok(Value::Num(char_index_of(&this_str(this), &other.to_js_string()).map_or(-1.0, |i| i as f64))),
            None => Ok(Value::Num(0.0)),
        }),
        "localeCompare" => ("localeCompare", |_, this, a| {
            let (x, y) = (this_str(this).to_lowercase(), arg(a, 0).to_js_string().to_lowercase());
            Ok(Value::Num(match x.cmp(&y) {
                std::cmp::Ordering::Less => -1.0,
                std::cmp::Ordering::Equal => 0.0,
                std::cmp::Ordering::Greater => 1.0,
            }))
        }),
        _ => return None,
    };
    Some(f)
}

fn pad(this: &Value, a: &[Value], start: bool) -> R<Value> {
    let s = this_str(this);
    let target = arg(a, 0).to_num().max(0.0) as usize;
    let fill = match arg(a, 1) {
        Value::Undefined => " ".to_string(),
        v => v.to_js_string(),
    };
    let len = s.chars().count();
    if len >= target || fill.is_empty() {
        return Ok(Value::Str(s));
    }
    let padding: String = fill.chars().cycle().take(target - len).collect();
    Ok(str_val(&if start { padding + &s } else { s.to_string() + &padding }))
}

fn replace(it: &mut Interp, this: &Value, a: &[Value], all: bool) -> R<Value> {
    let s = this_str(this);
    if let Some(Value::Regex(r)) = a.first() {
        return super::regex::replace(it, &s, r, &arg(a, 1), all);
    }
    let pattern = arg(a, 0).to_js_string();
    let replacement = arg(a, 1);
    let mut out = String::new();
    let mut rest: &str = &s;
    while let Some(pos) = rest.find(pattern.as_str()) {
        out.push_str(&rest[..pos]);
        let rep = match &replacement {
            Value::Func(_) => it.call(&replacement, vec![str_val(&pattern)])?.to_js_string(),
            other => other.to_js_string(),
        };
        out.push_str(&rep);
        rest = &rest[pos + pattern.len()..];
        if !all || pattern.is_empty() {
            break;
        }
    }
    out.push_str(rest);
    Ok(str_val(&out))
}

// ───────────── métodos de número ─────────────

fn number_method(key: &str) -> Option<(&'static str, NativeFn)> {
    Some(match key {
        "toFixed" => ("toFixed", |_, this, a| {
            let digits = arg(a, 0).to_num().max(0.0) as usize;
            Ok(str_val(&format!("{:.*}", digits, this.to_num())))
        }),
        "toString" => ("toString", |_, this, a| {
            let radix = a.first().map_or(10.0, Value::to_num) as u32;
            if radix == 10 || !(2..=36).contains(&radix) {
                return Ok(str_val(&this.to_js_string()));
            }
            Ok(str_val(&radix_string(this.to_num(), radix)))
        }),
        "toLocaleString" => ("toLocaleString", |_, this, a| {
            let locale = arg(a, 0).to_js_string();
            Ok(str_val(&locale_number(this.to_num(), locale.starts_with("pt") || locale.starts_with("de") || locale.starts_with("es"))))
        }),
        "valueOf" => ("valueOf", |_, this, _| Ok(this.clone())),
        _ => return None,
    })
}

/// Number.prototype.toString(radix) para inteiros (o caso de cores hex); fração vai em base 10.
fn radix_string(n: f64, radix: u32) -> String {
    if !n.is_finite() || n.fract() != 0.0 {
        return num_to_string(n);
    }
    let mut v = n.abs() as u64;
    if v == 0 {
        return "0".into();
    }
    let mut digits = Vec::new();
    while v > 0 {
        digits.push(std::char::from_digit((v % u64::from(radix)) as u32, radix).unwrap_or('0'));
        v /= u64::from(radix);
    }
    let body: String = digits.iter().rev().collect();
    if n < 0.0 { format!("-{body}") } else { body }
}

/// toLocaleString simplificado: até 3 casas, separador de milhar. Suficiente para rótulos.
fn locale_number(n: f64, comma_decimal: bool) -> String {
    let (group, decimal) = if comma_decimal { ('.', ',') } else { (',', '.') };
    let rounded = (n * 1000.0).round() / 1000.0;
    let text = num_to_string(rounded.abs());
    let (int, frac) = text.split_once('.').map_or((text.as_str(), ""), |(i, f)| (i, f));
    let mut grouped = String::new();
    for (i, c) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            grouped.push(group);
        }
        grouped.push(c);
    }
    let sign = if rounded < 0.0 { "-" } else { "" };
    if frac.is_empty() { format!("{sign}{grouped}") } else { format!("{sign}{grouped}{decimal}{frac}") }
}

// ───────────── JSON.parse ─────────────

/** JSON completo → Value (o mesmo parser do JSON.parse); None se inválido. */
pub fn parse_json(text: &str) -> Option<Value> {
    let mut p = JsonParser { s: text.as_bytes(), i: 0 };
    let v = p.value()?;
    p.ws();
    (p.i == p.s.len()).then_some(v)
}

struct JsonParser<'a> {
    s: &'a [u8],
    i: usize,
}

impl JsonParser<'_> {
    fn ws(&mut self) {
        while self.i < self.s.len() && matches!(self.s[self.i], b' ' | b'\n' | b'\r' | b'\t') {
            self.i += 1;
        }
    }

    fn eat(&mut self, lit: &str) -> bool {
        if self.s[self.i..].starts_with(lit.as_bytes()) {
            self.i += lit.len();
            return true;
        }
        false
    }

    fn value(&mut self) -> Option<Value> {
        self.ws();
        match *self.s.get(self.i)? {
            b'{' => {
                self.i += 1;
                let mut o = Obj::new();
                self.ws();
                if self.eat("}") {
                    return Some(obj_val(o));
                }
                loop {
                    self.ws();
                    let key = self.string()?;
                    self.ws();
                    if !self.eat(":") {
                        return None;
                    }
                    let v = self.value()?;
                    o.insert(Rc::from(key), v);
                    self.ws();
                    if self.eat("}") {
                        return Some(obj_val(o));
                    }
                    if !self.eat(",") {
                        return None;
                    }
                }
            }
            b'[' => {
                self.i += 1;
                let mut out = Vec::new();
                self.ws();
                if self.eat("]") {
                    return Some(arr_val(out));
                }
                loop {
                    out.push(self.value()?);
                    self.ws();
                    if self.eat("]") {
                        return Some(arr_val(out));
                    }
                    if !self.eat(",") {
                        return None;
                    }
                }
            }
            b'"' => self.string().map(|s| str_val(&s)),
            b't' if self.eat("true") => Some(Value::Bool(true)),
            b'f' if self.eat("false") => Some(Value::Bool(false)),
            b'n' if self.eat("null") => Some(Value::Null),
            _ => {
                let start = self.i;
                while self.i < self.s.len() && matches!(self.s[self.i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') {
                    self.i += 1;
                }
                std::str::from_utf8(&self.s[start..self.i]).ok()?.parse().ok().map(Value::Num)
            }
        }
    }

    fn string(&mut self) -> Option<String> {
        if !self.eat("\"") {
            return None;
        }
        let mut out: Vec<u16> = Vec::new();
        let mut bytes: Vec<u8> = Vec::new();
        let flush = |bytes: &mut Vec<u8>, out: &mut Vec<u16>| {
            out.extend(String::from_utf8_lossy(bytes).encode_utf16());
            bytes.clear();
        };
        loop {
            let c = *self.s.get(self.i)?;
            self.i += 1;
            match c {
                b'"' => {
                    flush(&mut bytes, &mut out);
                    return Some(String::from_utf16_lossy(&out));
                }
                b'\\' => {
                    flush(&mut bytes, &mut out);
                    let e = *self.s.get(self.i)?;
                    self.i += 1;
                    match e {
                        b'n' => out.push(u16::from(b'\n')),
                        b't' => out.push(u16::from(b'\t')),
                        b'r' => out.push(u16::from(b'\r')),
                        b'b' => out.push(8),
                        b'f' => out.push(12),
                        b'u' => {
                            let hex = std::str::from_utf8(self.s.get(self.i..self.i + 4)?).ok()?;
                            out.push(u16::from_str_radix(hex, 16).ok()?);
                            self.i += 4;
                        }
                        other => out.push(u16::from(other)),
                    }
                }
                other => bytes.push(other),
            }
        }
    }
}
