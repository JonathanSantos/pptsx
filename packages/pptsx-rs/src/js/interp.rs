//! Avaliador de AST (tree-walking) do subconjunto. A AST do oxc vive num arena vazado
//! (`'static`): o processo é curto e as closures podem guardar referências aos nós.

use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;

use oxc_ast::ast::*;
use oxc_span::{GetSpan, Span};
use oxc_syntax::operator::{AssignmentOperator, BinaryOperator, LogicalOperator, UnaryOperator, UpdateOperator};

use super::value::*;
use super::{DeckCtx, JsError, R, Throw, fail};

/// Passos de avaliação antes de desistir (laço infinito num deck é bug do autor).
const FUEL: u64 = 50_000_000;
const MAX_DEPTH: u32 = 1_000;

pub struct ModuleRec {
    pub path: PathBuf,
    pub source: &'static str,
    pub exports: Option<Rc<Obj>>,
}

pub enum Flow {
    Normal,
    Return(Value),
    Break,
    Continue,
}

pub struct Interp {
    pub modules: Vec<ModuleRec>,
    pub by_path: HashMap<PathBuf, usize>,
    pub globals: Env,
    pub cur: usize,
    fuel: u64,
    depth: u32,
}

impl Interp {
    pub fn new() -> Self {
        let globals = scope(None);
        super::builtins::install_globals(&globals);
        Interp { modules: Vec::new(), by_path: HashMap::new(), globals, cur: 0, fuel: FUEL, depth: 0 }
    }

    // ───────────── erros ─────────────

    pub fn err<T>(&self, span: Span, msg: impl Into<String>) -> R<T> {
        Err(Throw::Error(JsError { msg: msg.into(), at: Some((self.cur, span.start)) }))
    }

    /// Dá posição a um erro que ainda não tem (vindo de uma função nativa).
    pub fn locate(&self, t: Throw, span: Span) -> Throw {
        match t {
            Throw::Error(JsError { msg, at: None }) => Throw::Error(JsError { msg, at: Some((self.cur, span.start)) }),
            other => other,
        }
    }

    /// Orçamento novo para uma chamada independente (cada regra de lint em cada nó).
    pub fn refuel(&mut self) {
        self.fuel = FUEL;
    }

    pub fn describe(&self, t: Throw) -> String {
        let Throw::Error(e) = t else { return "curto-circuito de ?. fora de uma cadeia".into() };
        let Some((module, offset)) = e.at else { return e.msg };
        let Some(rec) = self.modules.get(module) else { return e.msg };
        let before = &rec.source[..(offset as usize).min(rec.source.len())];
        let line = before.matches('\n').count() + 1;
        let col = before.rsplit('\n').next().map_or(0, |l| l.chars().count()) + 1;
        let code = rec.source.lines().nth(line - 1).unwrap_or("").trim_end();
        format!("{}:{line}:{col}: {}\n    {code}", rec.path.display(), e.msg)
    }

    fn tick(&mut self, span: Span) -> R<()> {
        if self.fuel == 0 {
            return self.err(span, "orçamento de passos esgotado (laço infinito?)");
        }
        self.fuel -= 1;
        Ok(())
    }

    // ───────────── deck ─────────────

    pub fn instantiate_deck(&mut self, default: &Value, ctx: &DeckCtx) -> R<Value> {
        match default {
            Value::Func(_) => {
                let ctx_val = super::builtins::ctx_value(ctx);
                self.call(default, vec![ctx_val])
            }
            other => Ok(other.clone()),
        }
    }

    // ───────────── chamadas ─────────────

    pub fn call(&mut self, f: &Value, args: Vec<Value>) -> R<Value> {
        let Value::Func(func) = f else {
            return fail(format!("{} não é uma função", short_desc(f)));
        };
        match &**func {
            Func::Closure(c) => self.call_closure(c, args),
            Func::Native(n) => (n.f)(self, &n.this, &args),
            Func::Intrinsic(_) => {
                let props = match args.into_iter().next() {
                    Some(Value::Object(o)) => (*o).clone(),
                    _ => Obj::new(),
                };
                self.make_element(f, props, None)
            }
            Func::Component { inner, defaults, .. } => {
                let mut props = defaults.as_ref().map(|d| (**d).clone()).unwrap_or_default();
                if let Some(Value::Object(o)) = args.first() {
                    for (k, v) in o.iter() {
                        props.insert(k.clone(), v.clone());
                    }
                }
                self.call(inner, vec![obj_val(props)])
            }
        }
    }

    fn call_closure(&mut self, c: &Closure, args: Vec<Value>) -> R<Value> {
        if self.depth >= MAX_DEPTH {
            return fail(format!("recursão profunda demais em {}", c.name));
        }
        self.depth += 1;
        let saved = self.cur;
        self.cur = c.module;
        let result = self.call_closure_inner(c, args);
        self.cur = saved;
        self.depth -= 1;
        result
    }

    fn call_closure_inner(&mut self, c: &Closure, args: Vec<Value>) -> R<Value> {
        let env = scope(Some(&c.env));
        for (i, param) in c.params.items.iter().enumerate() {
            let mut value = args.get(i).cloned().unwrap_or(Value::Undefined);
            if matches!(value, Value::Undefined)
                && let Some(init) = &param.initializer {
                    value = self.eval(init, &env)?;
                }
            self.bind_pattern(&param.pattern, value, &env, true)?;
        }
        if let Some(rest) = &c.params.rest {
            let extra = args.iter().skip(c.params.items.len()).cloned().collect();
            self.bind_pattern(&rest.rest.argument, arr_val(extra), &env, true)?;
        }
        match c.body {
            Body::Expr(e) => self.eval(e, &env),
            Body::Block(b) => {
                self.hoist(&b.statements, &env)?;
                match self.exec_stmts(&b.statements, &env)? {
                    Flow::Return(v) => Ok(v),
                    _ => Ok(Value::Undefined),
                }
            }
        }
    }

    fn closure(&self, name: &str, params: &'static FormalParameters<'static>, body: Body, env: &Env) -> Value {
        Value::Func(Rc::new(Func::Closure(Closure { name: Rc::from(name), params, body, env: env.clone(), module: self.cur })))
    }

    pub(crate) fn function_value(&mut self, f: &'static Function<'static>, env: &Env) -> R<Value> {
        if f.r#async || f.generator {
            return Ok(unsupported_fn());
        }
        let Some(body) = &f.body else { return self.err(f.span, "função sem corpo") };
        let name = f.id.as_ref().map_or("anonymous", |id| id.name.as_str());
        Ok(self.closure(name, &f.params, Body::Block(body), env))
    }

    // ───────────── statements ─────────────

    /// `function` é içada no início do bloco, como no JS.
    pub fn hoist(&mut self, stmts: &'static [Statement<'static>], env: &Env) -> R<()> {
        for stmt in stmts {
            let f = match stmt {
                Statement::FunctionDeclaration(f) => f,
                Statement::ExportNamedDeclaration(_) => continue,
                Statement::ExportDeclaration(d) => match &d.declaration {
                    Declaration::FunctionDeclaration(f) => f,
                    _ => continue,
                },
                _ => continue,
            };
            if let Some(id) = &f.id
                && f.body.is_some() {
                    let v = self.function_value(f, env)?;
                    env.define(id.name.as_str(), v, true);
                }
        }
        Ok(())
    }

    pub fn exec_stmts(&mut self, stmts: &'static [Statement<'static>], env: &Env) -> R<Flow> {
        for stmt in stmts {
            match self.exec(stmt, env)? {
                Flow::Normal => {}
                other => return Ok(other),
            }
        }
        Ok(Flow::Normal)
    }

    pub fn exec(&mut self, stmt: &'static Statement<'static>, env: &Env) -> R<Flow> {
        self.tick(stmt.span())?;
        match stmt {
            Statement::BlockStatement(b) => {
                let inner = scope(Some(env));
                self.hoist(&b.body, &inner)?;
                self.exec_stmts(&b.body, &inner)
            }
            Statement::EmptyStatement(_) | Statement::FunctionDeclaration(_) => Ok(Flow::Normal),
            Statement::ExpressionStatement(e) => {
                self.eval(&e.expression, env)?;
                Ok(Flow::Normal)
            }
            Statement::VariableDeclaration(d) => {
                self.declare(d, env)?;
                Ok(Flow::Normal)
            }
            Statement::ReturnStatement(r) => {
                let v = match &r.argument {
                    Some(e) => self.eval(e, env)?,
                    None => Value::Undefined,
                };
                Ok(Flow::Return(v))
            }
            Statement::IfStatement(i) => {
                if self.eval(&i.test, env)?.truthy() {
                    self.exec(&i.consequent, env)
                } else if let Some(alt) = &i.alternate {
                    self.exec(alt, env)
                } else {
                    Ok(Flow::Normal)
                }
            }
            Statement::ForOfStatement(f) => self.exec_for_of(f, env),
            Statement::ForStatement(f) => self.exec_for(f, env),
            Statement::WhileStatement(w) => {
                while self.eval(&w.test, env)?.truthy() {
                    match self.exec(&w.body, env)? {
                        Flow::Break => break,
                        Flow::Return(v) => return Ok(Flow::Return(v)),
                        _ => {}
                    }
                }
                Ok(Flow::Normal)
            }
            Statement::BreakStatement(b) if b.label.is_none() => Ok(Flow::Break),
            Statement::ContinueStatement(c) if c.label.is_none() => Ok(Flow::Continue),
            Statement::ThrowStatement(t) => {
                let v = self.eval(&t.argument, env)?;
                let msg = match &v {
                    Value::Object(o) => o.get("message").map(Value::to_js_string).unwrap_or_else(|| v.to_js_string()),
                    other => other.to_js_string(),
                };
                self.err(t.span, msg)
            }
            Statement::SwitchStatement(s) => self.exec_switch(s, env),
            Statement::TSTypeAliasDeclaration(_)
            | Statement::TSInterfaceDeclaration(_)
            | Statement::TSGlobalDeclaration(_)
            | Statement::TSExternalModuleDeclaration(_)
            | Statement::TSNamespaceDeclaration(_) => Ok(Flow::Normal),
            // Bibliotecas podem declarar classes que o deck nunca usa: o erro só vem se alguém chamar.
            Statement::ClassDeclaration(c) => {
                if let Some(id) = &c.id {
                    env.define(id.name.as_str(), unsupported_fn(), false);
                }
                Ok(Flow::Normal)
            }
            Statement::TryStatement(t) => self.exec_try(t, env),
            other => self.err(other.span(), "instrução fora do subconjunto suportado"),
        }
    }

    fn exec_try(&mut self, t: &'static TryStatement<'static>, env: &Env) -> R<Flow> {
        let block_env = scope(Some(env));
        let mut result = self.exec_stmts(&t.block.body, &block_env);
        if let (Err(Throw::Error(e)), Some(handler)) = (&result, &t.handler) {
            let catch_env = scope(Some(env));
            if let Some(param) = &handler.param {
                let mut o = Obj::new();
                o.insert(Rc::from("message"), str_val(&e.msg));
                o.insert(Rc::from("name"), str_val("Error"));
                self.bind_pattern(&param.pattern, obj_val(o), &catch_env, true)?;
            }
            result = self.exec_stmts(&handler.body.body, &catch_env);
        }
        if let Some(finalizer) = &t.finalizer
            && let Flow::Return(v) = self.exec_stmts(&finalizer.body, &scope(Some(env)))? {
                return Ok(Flow::Return(v));
            }
        result
    }

    fn exec_switch(&mut self, s: &'static SwitchStatement<'static>, env: &Env) -> R<Flow> {
        let disc = self.eval(&s.discriminant, env)?;
        let inner = scope(Some(env));
        let mut matched = false;
        for case in &s.cases {
            if !matched {
                matched = match &case.test {
                    Some(t) => strict_eq(&disc, &self.eval(t, &inner)?),
                    None => false,
                };
            }
            if matched {
                match self.exec_stmts(&case.consequent, &inner)? {
                    Flow::Normal | Flow::Continue => {}
                    Flow::Break => return Ok(Flow::Normal),
                    ret => return Ok(ret),
                }
            }
        }
        if matched {
            return Ok(Flow::Normal);
        }
        // Sem case igual: executa a partir do default.
        let Some(start) = s.cases.iter().position(|c| c.test.is_none()) else { return Ok(Flow::Normal) };
        for case in s.cases.iter().skip(start) {
            match self.exec_stmts(&case.consequent, &inner)? {
                Flow::Normal | Flow::Continue => {}
                Flow::Break => return Ok(Flow::Normal),
                ret => return Ok(ret),
            }
        }
        Ok(Flow::Normal)
    }

    fn exec_for_of(&mut self, f: &'static ForOfStatement<'static>, env: &Env) -> R<Flow> {
        if f.r#await {
            return self.err(f.span, "for await não é suportado");
        }
        let iterable = self.eval(&f.right, env)?;
        let items: Vec<Value> = match &iterable {
            Value::Array(a) => a.borrow().to_vec(),
            Value::Str(s) => s.chars().map(|c| str_val(&c.to_string())).collect(),
            other => return self.err(f.right.span(), format!("for…of espera um array, recebeu {}", short_desc(other))),
        };
        for item in items {
            let iter_env = scope(Some(env));
            match &f.left {
                ForStatementLeft::VariableDeclaration(d) => {
                    let Some(decl) = d.declarations.first() else { continue };
                    self.bind_pattern(&decl.id, item, &iter_env, d.kind != VariableDeclarationKind::Const)?;
                }
                ForStatementLeft::AssignmentTargetIdentifier(id) => {
                    self.assign_name(id.name.as_str(), item, id.span, env)?;
                }
                other => return self.err(other.span(), "alvo de for…of não suportado"),
            }
            match self.exec(&f.body, &iter_env)? {
                Flow::Break => break,
                Flow::Return(v) => return Ok(Flow::Return(v)),
                _ => {}
            }
        }
        Ok(Flow::Normal)
    }

    fn exec_for(&mut self, f: &'static ForStatement<'static>, env: &Env) -> R<Flow> {
        let loop_env = scope(Some(env));
        if let Some(init) = &f.init {
            match init {
                ForStatementInit::VariableDeclaration(d) => self.declare(d, &loop_env)?,
                other => {
                    if let Some(e) = other.as_expression() {
                        self.eval(e, &loop_env)?;
                    }
                }
            }
        }
        loop {
            if let Some(test) = &f.test
                && !self.eval(test, &loop_env)?.truthy() {
                    break;
                }
            match self.exec(&f.body, &loop_env)? {
                Flow::Break => break,
                Flow::Return(v) => return Ok(Flow::Return(v)),
                _ => {}
            }
            if let Some(update) = &f.update {
                self.eval(update, &loop_env)?;
            }
        }
        Ok(Flow::Normal)
    }

    pub fn declare(&mut self, d: &'static VariableDeclaration<'static>, env: &Env) -> R<()> {
        let mutable = match d.kind {
            VariableDeclarationKind::Const => false,
            VariableDeclarationKind::Let | VariableDeclarationKind::Var => true,
            _ => return self.err(d.span, "`using` não é suportado"),
        };
        if d.declare {
            return Ok(());
        }
        for decl in &d.declarations {
            let value = match &decl.init {
                Some(e) => self.eval(e, env)?,
                None => Value::Undefined,
            };
            // Como no JS: `const Card = () => …` dá o nome à função (o lint e os paths usam o nome do componente).
            let value = match (&decl.id, &value) {
                (BindingPattern::BindingIdentifier(id), Value::Func(f)) => match &**f {
                    Func::Closure(c) if &*c.name == "anonymous" => {
                        let body = c.body;
                        Value::Func(Rc::new(Func::Closure(Closure { name: Rc::from(id.name.as_str()), params: c.params, body, env: c.env.clone(), module: c.module })))
                    }
                    _ => value,
                },
                _ => value,
            };
            self.bind_pattern(&decl.id, value, env, mutable)?;
        }
        Ok(())
    }

    pub fn bind_pattern(&mut self, pat: &'static BindingPattern<'static>, value: Value, env: &Env, mutable: bool) -> R<()> {
        match pat {
            BindingPattern::BindingIdentifier(id) => {
                env.define(id.name.as_str(), value, mutable);
                Ok(())
            }
            BindingPattern::AssignmentPattern(a) => {
                let v = if matches!(value, Value::Undefined) { self.eval(&a.right, env)? } else { value };
                self.bind_pattern(&a.left, v, env, mutable)
            }
            BindingPattern::ObjectPattern(o) => {
                if value.is_nullish() {
                    return self.err(o.span, format!("não é possível desestruturar {}", value.to_js_string()));
                }
                let mut used = Vec::new();
                for prop in &o.properties {
                    let key = self.prop_key(&prop.key, prop.computed, env)?;
                    let v = self.get_prop(&value, &key).map_err(|t| self.locate(t, prop.span))?;
                    used.push(key);
                    self.bind_pattern(&prop.value, v, env, mutable)?;
                }
                if let Some(rest) = &o.rest {
                    let mut remaining = Obj::new();
                    if let Value::Object(src) = &value {
                        for (k, v) in src.iter() {
                            if !used.iter().any(|u| u == k) {
                                remaining.insert(k.clone(), v.clone());
                            }
                        }
                    }
                    self.bind_pattern(&rest.argument, obj_val(remaining), env, mutable)?;
                }
                Ok(())
            }
            BindingPattern::ArrayPattern(a) => {
                let items: Vec<Value> = match &value {
                    Value::Array(arr) => arr.borrow().to_vec(),
                    Value::Str(s) => s.chars().map(|c| str_val(&c.to_string())).collect(),
                    other => return self.err(a.span, format!("não é possível desestruturar {} como array", short_desc(other))),
                };
                for (i, el) in a.elements.iter().enumerate() {
                    if let Some(p) = el {
                        self.bind_pattern(p, items.get(i).cloned().unwrap_or(Value::Undefined), env, mutable)?;
                    }
                }
                if let Some(rest) = &a.rest {
                    let tail = items.iter().skip(a.elements.len()).cloned().collect();
                    self.bind_pattern(&rest.argument, arr_val(tail), env, mutable)?;
                }
                Ok(())
            }
        }
    }

    fn prop_key(&mut self, key: &'static PropertyKey<'static>, computed: bool, env: &Env) -> R<Rc<str>> {
        match key {
            PropertyKey::StaticIdentifier(id) if !computed => Ok(Rc::from(id.name.as_str())),
            PropertyKey::PrivateIdentifier(p) => self.err(p.span, "campos privados não são suportados"),
            other => {
                let Some(e) = other.as_expression() else { return self.err(other.span(), "chave inválida") };
                Ok(Rc::from(self.eval(e, env)?.to_js_string()))
            }
        }
    }

    pub(crate) fn lookup_var(&self, name: &str, span: Span, env: &Env) -> R<Value> {
        match env.lookup(name) {
            Some(v) => Ok(v),
            None => self.err(span, format!("`{name}` não está definido")),
        }
    }

    fn assign_name(&self, name: &str, value: Value, span: Span, env: &Env) -> R<()> {
        match env.assign(name, value) {
            Ok(true) => Ok(()),
            Ok(false) => self.err(span, format!("`{name}` não está declarado")),
            Err(()) => self.err(span, format!("`{name}` é const e não pode ser reatribuído")),
        }
    }

    // ───────────── expressões ─────────────

    pub fn eval(&mut self, e: &'static Expression<'static>, env: &Env) -> R<Value> {
        self.tick(e.span())?;
        match e {
            Expression::BooleanLiteral(b) => Ok(Value::Bool(b.value)),
            Expression::NullLiteral(_) => Ok(Value::Null),
            Expression::NumericLiteral(n) => Ok(Value::Num(n.value)),
            Expression::StringLiteral(s) => Ok(str_val(s.value.as_str())),
            Expression::RegExpLiteral(r) => {
                use oxc_ast::ast::RegExpFlags as F;
                let f = r.regex.flags;
                let flags: String = [(F::D, 'd'), (F::G, 'g'), (F::I, 'i'), (F::M, 'm'), (F::S, 's'), (F::U, 'u'), (F::V, 'v'), (F::Y, 'y')].iter().filter(|(b, _)| f.contains(*b)).map(|(_, c)| *c).collect();
                match super::regex::compile(r.regex.pattern.text.as_str(), &flags) {
                    Ok(re) => Ok(super::regex::regex_val(re)),
                    Err(e) => self.err(r.span, e),
                }
            }
            Expression::TemplateLiteral(t) => self.eval_template(t, env),
            Expression::Identifier(id) => {
                let name = id.name.as_str();
                if name == "undefined" {
                    return Ok(Value::Undefined);
                }
                self.lookup_var(name, id.span, env)
            }
            Expression::ArrayExpression(a) => {
                let mut out = Vec::with_capacity(a.elements.len());
                for el in &a.elements {
                    match el {
                        ArrayExpressionElement::SpreadElement(s) => {
                            let v = self.eval(&s.argument, env)?;
                            self.spread_into(&v, &mut out, s.span)?;
                        }
                        ArrayExpressionElement::Elision(_) => out.push(Value::Undefined),
                        other => {
                            let Some(expr) = other.as_expression() else { continue };
                            out.push(self.eval(expr, env)?);
                        }
                    }
                }
                Ok(arr_val(out))
            }
            Expression::ObjectExpression(o) => self.eval_object(o, env),
            Expression::ArrowFunctionExpression(f) => {
                if f.r#async {
                    return Ok(unsupported_fn());
                }
                let body = match &f.body {
                    ArrowFunctionBody::FunctionBody(b) => Body::Block(b),
                    other => match other.as_expression() {
                        Some(expr) => Body::Expr(expr),
                        None => return self.err(f.span, "corpo de função inválido"),
                    },
                };
                Ok(self.closure("anonymous", &f.params, body, env))
            }
            Expression::FunctionExpression(f) => self.function_value(f, env),
            Expression::AssignmentExpression(a) => self.eval_assign(a, env),
            Expression::BinaryExpression(b) => {
                let left = self.eval(&b.left, env)?;
                let right = self.eval(&b.right, env)?;
                binary(b.operator, &left, &right).map_err(|t| self.locate(t, b.span))
            }
            Expression::LogicalExpression(l) => {
                let left = self.eval(&l.left, env)?;
                match l.operator {
                    LogicalOperator::And if !left.truthy() => Ok(left),
                    LogicalOperator::Or if left.truthy() => Ok(left),
                    LogicalOperator::Coalesce if !left.is_nullish() => Ok(left),
                    _ => self.eval(&l.right, env),
                }
            }
            Expression::UnaryExpression(u) => self.eval_unary(u, env),
            Expression::UpdateExpression(u) => {
                let SimpleAssignmentTarget::AssignmentTargetIdentifier(id) = &u.argument else {
                    return self.err(u.span, "++/-- só em variáveis locais");
                };
                let old = self.lookup_var(id.name.as_str(), id.span, env)?.to_num();
                let new = if u.operator == UpdateOperator::Increment { old + 1.0 } else { old - 1.0 };
                self.assign_name(id.name.as_str(), Value::Num(new), id.span, env)?;
                Ok(Value::Num(if u.prefix { new } else { old }))
            }
            Expression::ConditionalExpression(c) => {
                if self.eval(&c.test, env)?.truthy() {
                    self.eval(&c.consequent, env)
                } else {
                    self.eval(&c.alternate, env)
                }
            }
            Expression::CallExpression(c) => self.eval_call(c, env),
            Expression::NewExpression(n) => self.eval_new(n, env),
            Expression::ChainExpression(c) => match self.eval_chain(&c.expression, env) {
                Err(Throw::Short) => Ok(Value::Undefined),
                other => other,
            },
            Expression::StaticMemberExpression(m) => self.eval_static_member(m, env),
            Expression::ComputedMemberExpression(m) => self.eval_computed_member(m, env),
            Expression::ParenthesizedExpression(p) => self.eval(&p.expression, env),
            Expression::TSAsExpression(x) => self.eval(&x.expression, env),
            Expression::TSSatisfiesExpression(x) => self.eval(&x.expression, env),
            Expression::TSNonNullExpression(x) => self.eval(&x.expression, env),
            Expression::TSTypeAssertion(x) => self.eval(&x.expression, env),
            Expression::TSInstantiationExpression(x) => self.eval(&x.expression, env),
            Expression::SequenceExpression(s) => {
                let mut last = Value::Undefined;
                for item in &s.expressions {
                    last = self.eval(item, env)?;
                }
                Ok(last)
            }
            Expression::JSXElement(j) => self.eval_jsx_element(j, env),
            Expression::JSXFragment(f) => self.eval_jsx_fragment(f, env),
            Expression::ImportMeta(_) => {
                let path = self.modules.get(self.cur).map(|r| r.path.clone()).unwrap_or_default();
                let mut o = Obj::new();
                o.insert(Rc::from("url"), str_val(&format!("file://{}", path.display())));
                o.insert(Rc::from("filename"), str_val(&path.display().to_string()));
                o.insert(Rc::from("dirname"), str_val(&path.parent().map(|p| p.display().to_string()).unwrap_or_default()));
                Ok(obj_val(o))
            }
            // No topo de um módulo ESM `this` é undefined (código gerado pelo tsc testa isso).
            Expression::ThisExpression(_) if self.depth == 0 => Ok(Value::Undefined),
            Expression::ThisExpression(t) => self.err(t.span, "`this` não é suportado em decks"),
            Expression::AwaitExpression(a) => self.err(a.span, "await não é suportado em decks"),
            Expression::ClassExpression(_) => Ok(unsupported_fn()),
            Expression::ImportExpression(i) => self.err(i.span, "import() dinâmico não é suportado"),
            other => self.err(other.span(), "expressão fora do subconjunto suportado"),
        }
    }

    fn eval_template(&mut self, t: &'static TemplateLiteral<'static>, env: &Env) -> R<Value> {
        let mut out = String::new();
        for (i, quasi) in t.quasis.iter().enumerate() {
            out.push_str(quasi.value.cooked.as_ref().map_or_else(|| quasi.value.raw.as_str(), |c| c.as_str()));
            if let Some(expr) = t.expressions.get(i) {
                out.push_str(&self.eval(expr, env)?.to_js_string());
            }
        }
        Ok(str_val(&out))
    }

    fn eval_object(&mut self, o: &'static ObjectExpression<'static>, env: &Env) -> R<Value> {
        let mut out = Obj::new();
        for prop in &o.properties {
            match prop {
                ObjectPropertyKind::ObjectProperty(p) => {
                    if p.kind != PropertyKind::Init {
                        return self.err(p.span, "getters/setters não são suportados");
                    }
                    let key = self.prop_key(&p.key, p.computed, env)?;
                    let value = self.eval(&p.value, env)?;
                    out.insert(key, value);
                }
                ObjectPropertyKind::SpreadProperty(s) => {
                    let v = self.eval(&s.argument, env)?;
                    match v {
                        Value::Object(src) => {
                            for (k, item) in src.iter() {
                                out.insert(k.clone(), item.clone());
                            }
                        }
                        Value::Array(items) => {
                            for (i, item) in items.borrow().iter().enumerate() {
                                out.insert(Rc::from(i.to_string()), item.clone());
                            }
                        }
                        Value::Element(e) => {
                            for (k, item) in e.props.iter() {
                                out.insert(k.clone(), item.clone());
                            }
                        }
                        Value::Undefined | Value::Null | Value::Bool(_) | Value::Num(_) => {}
                        Value::Str(s) => {
                            for (i, c) in s.chars().enumerate() {
                                out.insert(Rc::from(i.to_string()), str_val(&c.to_string()));
                            }
                        }
                        Value::Func(_) | Value::Regex(_) => {}
                    }
                }
            }
        }
        Ok(obj_val(out))
    }

    pub fn spread_into(&self, v: &Value, out: &mut Vec<Value>, span: Span) -> R<()> {
        match v {
            Value::Array(items) => out.extend(items.borrow().iter().cloned()),
            Value::Str(s) => out.extend(s.chars().map(|c| str_val(&c.to_string()))),
            other => return self.err(span, format!("não é possível espalhar {} (esperado array)", short_desc(other))),
        }
        Ok(())
    }

    fn eval_unary(&mut self, u: &'static UnaryExpression<'static>, env: &Env) -> R<Value> {
        if u.operator == UnaryOperator::Typeof
            && let Expression::Identifier(id) = &u.argument
                && env.lookup(id.name.as_str()).is_none() {
                    return Ok(str_val("undefined"));
                }
        if u.operator == UnaryOperator::Delete {
            return self.err(u.span, "delete não é suportado (objetos são imutáveis)");
        }
        let v = self.eval(&u.argument, env)?;
        Ok(match u.operator {
            UnaryOperator::UnaryNegation => Value::Num(-v.to_num()),
            UnaryOperator::UnaryPlus => Value::Num(v.to_num()),
            UnaryOperator::LogicalNot => Value::Bool(!v.truthy()),
            UnaryOperator::Typeof => str_val(v.type_of()),
            UnaryOperator::Void => Value::Undefined,
            UnaryOperator::BitwiseNot => Value::Num(f64::from(!to_i32(v.to_num()))),
            UnaryOperator::Delete => Value::Undefined,
        })
    }

    fn eval_assign(&mut self, a: &'static AssignmentExpression<'static>, env: &Env) -> R<Value> {
        let AssignmentTarget::AssignmentTargetIdentifier(id) = &a.left else {
            return self.err(a.span, "só variáveis locais podem ser reatribuídas (objetos e arrays são imutáveis em decks)");
        };
        let name = id.name.as_str();
        let value = match a.operator {
            AssignmentOperator::Assign => self.eval(&a.right, env)?,
            AssignmentOperator::LogicalOr | AssignmentOperator::LogicalAnd | AssignmentOperator::LogicalNullish => {
                let old = self.lookup_var(name, id.span, env)?;
                let keep = match a.operator {
                    AssignmentOperator::LogicalOr => old.truthy(),
                    AssignmentOperator::LogicalAnd => !old.truthy(),
                    _ => !old.is_nullish(),
                };
                if keep {
                    return Ok(old);
                }
                self.eval(&a.right, env)?
            }
            op => {
                let old = self.lookup_var(name, id.span, env)?;
                let right = self.eval(&a.right, env)?;
                let Some(bin) = op.to_binary_operator() else { return self.err(a.span, "operador de atribuição não suportado") };
                binary(bin, &old, &right).map_err(|t| self.locate(t, a.span))?
            }
        };
        self.assign_name(name, value.clone(), id.span, env)?;
        Ok(value)
    }

    fn eval_args(&mut self, args: &'static [Argument<'static>], env: &Env) -> R<Vec<Value>> {
        let mut out = Vec::with_capacity(args.len());
        for arg in args {
            match arg {
                Argument::SpreadElement(s) => {
                    let v = self.eval(&s.argument, env)?;
                    self.spread_into(&v, &mut out, s.span)?;
                }
                other => {
                    let Some(e) = other.as_expression() else { continue };
                    out.push(self.eval(e, env)?);
                }
            }
        }
        Ok(out)
    }

    fn eval_call(&mut self, c: &'static CallExpression<'static>, env: &Env) -> R<Value> {
        let f = match &c.callee {
            Expression::StaticMemberExpression(m) => {
                let obj = self.member_object(&m.object, m.optional, env)?;
                self.get_prop(&obj, m.property.name.as_str()).map_err(|t| self.locate(t, m.span))?
            }
            Expression::ComputedMemberExpression(m) => {
                let obj = self.member_object(&m.object, m.optional, env)?;
                let key = self.eval(&m.expression, env)?;
                self.get_index(&obj, &key).map_err(|t| self.locate(t, m.span))?
            }
            other => self.eval(other, env)?,
        };
        if c.optional && f.is_nullish() {
            return Err(Throw::Short);
        }
        let args = self.eval_args(&c.arguments, env)?;
        if !matches!(f, Value::Func(_)) {
            let callee = &self.modules[self.cur].source[c.callee.span().start as usize..c.callee.span().end as usize];
            return self.err(c.span, format!("`{callee}` não é uma função"));
        }
        self.call(&f, args).map_err(|t| self.locate(t, c.span))
    }

    fn eval_chain(&mut self, el: &'static ChainElement<'static>, env: &Env) -> R<Value> {
        match el {
            ChainElement::CallExpression(c) => self.eval_call(c, env),
            ChainElement::TSNonNullExpression(x) => self.eval(&x.expression, env),
            ChainElement::StaticMemberExpression(m) => self.eval_static_member(m, env),
            ChainElement::ComputedMemberExpression(m) => self.eval_computed_member(m, env),
            ChainElement::PrivateFieldExpression(p) => self.err(p.span, "campos privados não são suportados"),
        }
    }

    fn member_object(&mut self, object: &'static Expression<'static>, optional: bool, env: &Env) -> R<Value> {
        let obj = self.eval(object, env)?;
        if optional && obj.is_nullish() {
            return Err(Throw::Short);
        }
        Ok(obj)
    }

    fn eval_static_member(&mut self, m: &'static StaticMemberExpression<'static>, env: &Env) -> R<Value> {
        let obj = self.member_object(&m.object, m.optional, env)?;
        self.get_prop(&obj, m.property.name.as_str()).map_err(|t| self.locate(t, m.span))
    }

    fn eval_computed_member(&mut self, m: &'static ComputedMemberExpression<'static>, env: &Env) -> R<Value> {
        let obj = self.member_object(&m.object, m.optional, env)?;
        let key = self.eval(&m.expression, env)?;
        self.get_index(&obj, &key).map_err(|t| self.locate(t, m.span))
    }

    pub fn get_index(&self, obj: &Value, key: &Value) -> R<Value> {
        if let (Value::Array(a), Value::Num(n)) = (obj, key) {
            return Ok(index_of(a.borrow().len(), *n).map_or(Value::Undefined, |i| a.borrow()[i].clone()));
        }
        self.get_prop(obj, &key.to_js_string())
    }

    pub fn get_prop(&self, obj: &Value, key: &str) -> R<Value> {
        super::builtins::get_prop(obj, key)
    }

    fn eval_new(&mut self, n: &'static NewExpression<'static>, env: &Env) -> R<Value> {
        let args = self.eval_args(&n.arguments, env)?;
        let Expression::Identifier(id) = &n.callee else {
            return self.err(n.span, "new só é suportado para Set, URL, Error e Array");
        };
        let first = args.first().cloned().unwrap_or(Value::Undefined);
        match id.name.as_str() {
            "Set" => {
                let mut out: Vec<Value> = Vec::new();
                if let Value::Array(items) = &first {
                    for item in items.borrow().iter() {
                        if !out.iter().any(|v| strict_eq(v, item)) {
                            out.push(item.clone());
                        }
                    }
                }
                Ok(arr_val(out))
            }
            "URL" => {
                // new URL('./x.png', import.meta.url) → caminho absoluto do asset.
                let rel = first.to_js_string();
                let base = args.get(1).map(Value::to_js_string).unwrap_or_default();
                // Base terminada em '/' já é a pasta; senão, a pasta do arquivo (como o URL do JS).
                let base = base.trim_start_matches("file://");
                let dir = if base.ends_with('/') { PathBuf::from(base) } else { PathBuf::from(base).parent().map(PathBuf::from).unwrap_or_default() };
                let joined = dir.join(rel.trim_start_matches("file://"));
                let mut normal = PathBuf::new();
                for c in joined.components() {
                    match c {
                        std::path::Component::ParentDir => {
                            normal.pop();
                        }
                        std::path::Component::CurDir => {}
                        other => normal.push(other.as_os_str()),
                    }
                }
                // Pasta continua com '/' no fim, para servir de base a outro URL.
                let mut out = normal.display().to_string();
                if rel.ends_with('/') && !out.ends_with('/') {
                    out.push('/');
                }
                Ok(str_val(&out))
            }
            "Error" | "TypeError" | "RangeError" => {
                let mut o = Obj::new();
                o.insert(Rc::from("name"), str_val(id.name.as_str()));
                o.insert(Rc::from("message"), str_val(&first.to_js_string()));
                Ok(obj_val(o))
            }
            "Array" => {
                let len = first.as_num().unwrap_or(0.0).max(0.0) as usize;
                Ok(arr_val(vec![Value::Undefined; len]))
            }
            "RegExp" => {
                let (source, flags) = match &first {
                    Value::Regex(r) => (r.source.clone(), args.get(1).map_or_else(|| r.flags.clone(), Value::to_js_string)),
                    other => (other.to_js_string(), args.get(1).map(Value::to_js_string).unwrap_or_default()),
                };
                super::regex::compile(&source, &flags).map(super::regex::regex_val).or_else(|e| self.err(n.span, e))
            }
            "Date" => self.err(n.span, "Date não é suportado (decks são determinísticos)"),
            other => self.err(n.span, format!("new {other} não é suportado em decks")),
        }
    }
}

/// Função fora do subconjunto (async, generator, classe): definir pode, chamar é erro.
fn unsupported_fn() -> Value {
    super::builtins::native("unsupported", |_, _, _| fail("async, generators e classes não são suportados em decks"), Value::Undefined)
}

// ───────────── operadores ─────────────

fn to_i32(n: f64) -> i32 {
    if !n.is_finite() {
        return 0;
    }
    (n.trunc() as i64) as i32
}

fn to_primitive(v: &Value) -> Value {
    match v {
        Value::Array(_) | Value::Object(_) | Value::Element(_) | Value::Func(_) => str_val(&v.to_js_string()),
        other => other.clone(),
    }
}

pub fn binary(op: BinaryOperator, a: &Value, b: &Value) -> R<Value> {
    use BinaryOperator as B;
    Ok(match op {
        B::Addition => {
            let (pa, pb) = (to_primitive(a), to_primitive(b));
            if matches!(pa, Value::Str(_)) || matches!(pb, Value::Str(_)) {
                str_val(&(pa.to_js_string() + &pb.to_js_string()))
            } else {
                Value::Num(pa.to_num() + pb.to_num())
            }
        }
        B::Subtraction => Value::Num(a.to_num() - b.to_num()),
        B::Multiplication => Value::Num(a.to_num() * b.to_num()),
        B::Division => Value::Num(a.to_num() / b.to_num()),
        B::Remainder => Value::Num(a.to_num() % b.to_num()),
        B::Exponential => Value::Num(a.to_num().powf(b.to_num())),
        B::Equality => Value::Bool(loose_eq(a, b)),
        B::Inequality => Value::Bool(!loose_eq(a, b)),
        B::StrictEquality => Value::Bool(strict_eq(a, b)),
        B::StrictInequality => Value::Bool(!strict_eq(a, b)),
        B::LessThan | B::LessEqualThan | B::GreaterThan | B::GreaterEqualThan => {
            let ord = match (a, b) {
                (Value::Str(x), Value::Str(y)) => Some(x.cmp(y)),
                _ => a.to_num().partial_cmp(&b.to_num()),
            };
            let Some(ord) = ord else { return Ok(Value::Bool(false)) };
            Value::Bool(match op {
                B::LessThan => ord.is_lt(),
                B::LessEqualThan => ord.is_le(),
                B::GreaterThan => ord.is_gt(),
                _ => ord.is_ge(),
            })
        }
        B::In => match b {
            Value::Object(o) => Value::Bool(o.contains_key(a.to_js_string().as_str())),
            Value::Array(arr) => Value::Bool(index_of(arr.borrow().len(), a.to_num()).is_some()),
            Value::Element(_) => Value::Bool(matches!(a.to_js_string().as_str(), "type" | "props")),
            Value::Func(_) => Value::Bool(false),
            _ => return fail("o operador `in` espera um objeto à direita"),
        },
        B::BitwiseOR => Value::Num(f64::from(to_i32(a.to_num()) | to_i32(b.to_num()))),
        B::BitwiseAnd => Value::Num(f64::from(to_i32(a.to_num()) & to_i32(b.to_num()))),
        B::BitwiseXOR => Value::Num(f64::from(to_i32(a.to_num()) ^ to_i32(b.to_num()))),
        B::ShiftLeft => Value::Num(f64::from(to_i32(a.to_num()).wrapping_shl(to_i32(b.to_num()) as u32 & 31))),
        B::ShiftRight => Value::Num(f64::from(to_i32(a.to_num()).wrapping_shr(to_i32(b.to_num()) as u32 & 31))),
        B::ShiftRightZeroFill => Value::Num(f64::from((to_i32(a.to_num()) as u32).wrapping_shr(to_i32(b.to_num()) as u32 & 31))),
        B::Instanceof => return fail("instanceof não é suportado em decks"),
    })
}

pub fn index_of(len: usize, n: f64) -> Option<usize> {
    if n.fract() != 0.0 || n < 0.0 || n >= len as f64 {
        return None;
    }
    Some(n as usize)
}

pub fn short_desc(v: &Value) -> String {
    match v {
        Value::Str(s) => format!("\"{}\"", s.chars().take(30).collect::<String>()),
        Value::Func(_) => "uma função".into(),
        Value::Array(_) => "um array".into(),
        Value::Object(_) => "um objeto".into(),
        Value::Element(e) => format!("<{}>", e.kind.name()),
        other => other.to_js_string(),
    }
}
