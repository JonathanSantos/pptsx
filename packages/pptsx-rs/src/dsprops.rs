//! Schema das props dos componentes de um DS, lido dos **tipos** e sem Node: para cada
//! `defineComponent<XProps>(meta, fn)` dos módulos que o avaliador carregou, acha a interface (ou o
//! `type`) `XProps` e tira de cada prop o nome, o tipo (o texto do TS), se é opcional, a descrição
//! (o JSDoc acima dela) e o padrão da desestruturação da função (`{ tone = 'default' }`).
//!
//! Tudo aqui é puro: fontes entram, dados saem. O `oxc` só faz o parse (o mesmo do avaliador); nada
//! é checado nem inferido. Um tipo que não dá para abrir sem o compilador (`Omit<BoxProps, 'x'>`, um
//! tipo de outro pacote) fica em `extends`, com o texto dele, em vez de sumir.

use std::collections::HashMap;
use std::path::Path;
use std::rc::Rc;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

use crate::js::value::{Obj, Value, arr_val, obj_val, str_val};

const DEFINE_COMPONENT: &str = "defineComponent";
/// `A extends B extends C…`: fundo o bastante para qualquer DS e curto o bastante para um ciclo.
const MAX_DEPTH: usize = 8;
/// Marca do schema que o `createDs` do kit deduz dos casos do catálogo (ds.js schemaFromMeta).
const DERIVED_SOURCE_PREFIX: &str = "catálogo";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PropInfo {
    pub name: String,
    /// O tipo como está escrito no TS, numa linha.
    pub ty: String,
    pub optional: bool,
    pub description: Option<String>,
    /// O padrão da desestruturação, como está escrito (`'default'`, `3`, `tokens.space.md`).
    pub default: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ComponentProps {
    pub name: String,
    /// `XProps`, quando as props têm nome.
    pub type_name: Option<String>,
    pub props: Vec<PropInfo>,
    /// Tipos de que as props herdam e que não deu para abrir (texto do TS).
    pub extends: Vec<String>,
}

/// Um módulo carregado: o caminho (só para escolher a sintaxe) e a fonte.
pub struct ModuleSource<'a> {
    pub path: &'a Path,
    pub source: &'a str,
}

// ───────────── leitura de um módulo ─────────────

/// Um pedaço de um tipo de props, na ordem em que foi escrito.
#[derive(Debug, Clone)]
enum Part {
    Props(Vec<PropInfo>),
    /// Referência a outro tipo pelo nome (`extends Base`, `Base & {…}`).
    Named(String),
    /// Tipo que só o compilador abre: fica como texto.
    Opaque(String),
}

struct RawComponent {
    name: String,
    type_name: Option<String>,
    parts: Vec<Part>,
    defaults: Vec<(String, String)>,
}

#[derive(Default)]
struct ModuleFacts {
    types: HashMap<String, Vec<Part>>,
    components: Vec<RawComponent>,
}

/// Uma função do módulo, declarada ou em expressão.
#[derive(Clone, Copy)]
enum FnRef<'p, 'a> {
    Arrow(&'p ArrowFunctionExpression<'a>),
    Function(&'p Function<'a>),
}

impl<'p, 'a> FnRef<'p, 'a> {
    fn first_param(self) -> Option<&'p FormalParameter<'a>> {
        match self {
            FnRef::Arrow(f) => f.params.items.first(),
            FnRef::Function(f) => f.params.items.first(),
        }
    }

    /// O corpo em bloco (uma arrow de corpo-expressão não tem).
    fn body(self) -> Option<&'p FunctionBody<'a>> {
        match self {
            FnRef::Arrow(f) => match &f.body {
                ArrowFunctionBody::FunctionBody(body) => Some(body),
                _ => None,
            },
            FnRef::Function(f) => f.body.as_deref(),
        }
    }

    /// O valor de uma arrow de corpo-expressão (`(x) => valor`).
    fn expression(self) -> Option<&'p Expression<'a>> {
        match self {
            FnRef::Arrow(f) => f.body.as_expression(),
            FnRef::Function(_) => None,
        }
    }
}

struct Reader<'s, 'p, 'a> {
    source: &'s str,
    program: &'p Program<'a>,
}

fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// `/** texto */` → `texto`, sem os asteriscos de cada linha.
fn clean_jsdoc(comment: &str) -> String {
    let body = comment.trim().trim_start_matches("/**").trim_end_matches("*/");
    one_line(&body.lines().map(|l| l.trim().trim_start_matches('*').trim()).collect::<Vec<_>>().join(" "))
}

impl<'s, 'p, 'a> Reader<'s, 'p, 'a> {
    fn text(&self, span: Span) -> &'s str {
        self.source.get(span.start as usize..span.end as usize).unwrap_or("")
    }

    /// O JSDoc colado acima de `start` (só espaço em branco entre os dois).
    fn jsdoc_before(&self, start: u32) -> Option<String> {
        let comment = self.program.comments.iter().rev().find(|c| c.span.end <= start)?;
        let between = self.source.get(comment.span.end as usize..start as usize)?;
        let raw = self.text(comment.span);
        if !between.trim().is_empty() || !raw.starts_with("/**") {
            return None;
        }
        Some(clean_jsdoc(raw)).filter(|d| !d.is_empty())
    }

    fn prop_of(&self, sig: &TSSignature<'a>) -> Option<PropInfo> {
        match sig {
            TSSignature::TSPropertySignature(p) => {
                let name = p.key.static_name()?.to_string();
                let ty = p.type_annotation.as_ref().map_or("unknown".to_string(), |t| one_line(self.text(t.type_annotation.span())));
                Some(PropInfo { name, ty, optional: p.optional, description: self.jsdoc_before(p.span.start), default: None })
            }
            TSSignature::TSMethodSignature(m) => {
                let name = m.key.static_name()?.to_string();
                Some(PropInfo { name, ty: "function".into(), optional: m.optional, description: self.jsdoc_before(m.span.start), default: None })
            }
            _ => None,
        }
    }

    fn props_of(&self, members: &[TSSignature<'a>]) -> Part {
        Part::Props(members.iter().filter_map(|m| self.prop_of(m)).collect())
    }

    fn parts_of_type(&self, ty: &TSType<'a>, out: &mut Vec<Part>) {
        match ty {
            TSType::TSTypeLiteral(l) => out.push(self.props_of(&l.members)),
            TSType::TSIntersectionType(i) => i.types.iter().for_each(|t| self.parts_of_type(t, out)),
            TSType::TSParenthesizedType(p) => self.parts_of_type(&p.type_annotation, out),
            TSType::TSTypeReference(r) if r.type_arguments.is_none() => match &r.type_name {
                TSTypeName::IdentifierReference(id) => out.push(Part::Named(id.name.to_string())),
                _ => out.push(Part::Opaque(one_line(self.text(r.span)))),
            },
            other => out.push(Part::Opaque(one_line(self.text(other.span())))),
        }
    }

    fn parts_of_interface(&self, decl: &TSInterfaceDeclaration<'a>) -> Vec<Part> {
        let mut parts: Vec<Part> = decl
            .extends
            .iter()
            .map(|h| match (&h.type_name, &h.type_arguments) {
                (TSTypeName::IdentifierReference(id), None) => Part::Named(id.name.to_string()),
                _ => Part::Opaque(one_line(self.text(h.span))),
            })
            .collect();
        parts.push(self.props_of(&decl.body.body));
        parts
    }

    /// A função de uma expressão: ela mesma, a declarada com esse nome, ou a que uma fábrica
    /// devolve (`view(theme)` com `const view = (theme) => (props: P) => …`).
    fn function_of(&self, expr: &'p Expression<'a>) -> Option<FnRef<'p, 'a>> {
        match expr {
            Expression::ArrowFunctionExpression(f) => Some(FnRef::Arrow(f)),
            Expression::FunctionExpression(f) => Some(FnRef::Function(f)),
            Expression::ParenthesizedExpression(p) => self.function_of(&p.expression),
            Expression::Identifier(id) => self.declared_function(id.name.as_str()),
            Expression::CallExpression(call) => match &call.callee {
                Expression::Identifier(id) => self.declared_function(id.name.as_str()).and_then(|factory| self.returned_function(factory)),
                _ => None,
            },
            _ => None,
        }
    }

    /// `function Nome(…)` ou `const Nome = (…) => …` do topo do módulo.
    fn declared_function(&self, name: &str) -> Option<FnRef<'p, 'a>> {
        self.declarations().find_map(|decl| match decl {
            Declaration::FunctionDeclaration(f) if f.id.as_ref().is_some_and(|id| id.name == name) => Some(FnRef::Function(f)),
            Declaration::VariableDeclaration(v) => v.declarations.iter().find_map(|d| match (&d.id, &d.init) {
                (BindingPattern::BindingIdentifier(id), Some(init)) if id.name == name && !matches!(init, Expression::Identifier(_) | Expression::CallExpression(_)) => self.function_of(init),
                _ => None,
            }),
            _ => None,
        })
    }

    /// A função que uma fábrica devolve: o corpo-expressão de uma arrow ou o `return` do corpo.
    fn returned_function(&self, factory: FnRef<'p, 'a>) -> Option<FnRef<'p, 'a>> {
        if let Some(value) = factory.expression() {
            return self.function_of(value);
        }
        factory.body()?.statements.iter().find_map(|stmt| match stmt {
            Statement::ReturnStatement(r) => r.argument.as_ref().and_then(|arg| self.function_of(arg)),
            _ => None,
        })
    }

    fn defaults_of(&self, param: &FormalParameter<'a>) -> Vec<(String, String)> {
        let BindingPattern::ObjectPattern(pattern) = &param.pattern else { return Vec::new() };
        pattern
            .properties
            .iter()
            .filter_map(|prop| match &prop.value {
                BindingPattern::AssignmentPattern(a) => Some((prop.key.static_name()?.to_string(), one_line(self.text(a.right.span())))),
                _ => None,
            })
            .collect()
    }

    /// `defineComponent<XProps>(meta, fn)`: o nome vem do meta (ou da variável), o tipo do argumento
    /// de tipo (ou da anotação do 1º parâmetro da função) e os padrões da desestruturação.
    fn component_of(&self, call: &'p CallExpression<'a>, binding: Option<&str>) -> Option<RawComponent> {
        if !matches!(&call.callee, Expression::Identifier(id) if id.name == DEFINE_COMPONENT) {
            return None;
        }
        let meta_name = call.arguments.first().and_then(Argument::as_expression).and_then(|meta| match meta {
            Expression::StringLiteral(s) => Some(s.value.to_string()),
            Expression::ObjectExpression(o) => o.properties.iter().find_map(|p| match p {
                ObjectPropertyKind::ObjectProperty(p) if p.key.static_name().as_deref() == Some("name") => match &p.value {
                    Expression::StringLiteral(s) => Some(s.value.to_string()),
                    _ => None,
                },
                _ => None,
            }),
            _ => None,
        });
        let name = meta_name.or_else(|| binding.map(String::from))?;
        let param = call.arguments.get(1).and_then(Argument::as_expression).and_then(|f| self.function_of(f)).and_then(|f| f.first_param());
        let type_arg = call.type_arguments.as_ref().and_then(|t| t.params.first());
        let annotated = param.and_then(|p| p.type_annotation.as_ref()).map(|t| &t.type_annotation);
        let mut parts = Vec::new();
        let props_type = type_arg.or(annotated);
        if let Some(ty) = props_type {
            self.parts_of_type(ty, &mut parts);
        }
        let type_name = match props_type {
            Some(TSType::TSTypeReference(r)) => Some(one_line(self.text(r.span))),
            _ => None,
        };
        Some(RawComponent { name, type_name, parts, defaults: param.map(|p| self.defaults_of(p)).unwrap_or_default() })
    }

    /// Declarações do topo do módulo, exportadas ou não.
    fn declarations(&self) -> impl Iterator<Item = &'p Declaration<'a>> {
        self.program.body.iter().filter_map(|stmt| match stmt {
            Statement::ExportDeclaration(e) => Some(&e.declaration),
            other => other.as_declaration(),
        })
    }

    fn walk_statements(&self, statements: &'p [Statement<'a>], out: &mut Vec<RawComponent>) {
        statements.iter().for_each(|stmt| self.walk_statement(stmt, out));
    }

    fn walk_body(&self, body: Option<&'p FunctionBody<'a>>, out: &mut Vec<RawComponent>) {
        if let Some(body) = body {
            self.walk_statements(&body.statements, out);
        }
    }

    fn walk_declaration(&self, decl: &'p Declaration<'a>, out: &mut Vec<RawComponent>) {
        match decl {
            Declaration::VariableDeclaration(v) => {
                for d in &v.declarations {
                    let binding = match &d.id {
                        BindingPattern::BindingIdentifier(id) => Some(id.name.as_str()),
                        _ => None,
                    };
                    if let Some(init) = &d.init {
                        self.walk_expression(init, binding, out);
                    }
                }
            }
            Declaration::FunctionDeclaration(f) => self.walk_body(f.body.as_deref(), out),
            _ => {}
        }
    }

    fn walk_statement(&self, stmt: &'p Statement<'a>, out: &mut Vec<RawComponent>) {
        match stmt {
            Statement::ExportDeclaration(e) => self.walk_declaration(&e.declaration, out),
            Statement::ExportDefaultDeclaration(d) => match &d.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) => self.walk_body(f.body.as_deref(), out),
                other => {
                    if let Some(expr) = other.as_expression() {
                        self.walk_expression(expr, None, out);
                    }
                }
            },
            Statement::ReturnStatement(r) => {
                if let Some(arg) = &r.argument {
                    self.walk_expression(arg, None, out);
                }
            }
            Statement::ExpressionStatement(e) => self.walk_expression(&e.expression, None, out),
            Statement::BlockStatement(b) => self.walk_statements(&b.body, out),
            Statement::IfStatement(i) => {
                self.walk_statement(&i.consequent, out);
                if let Some(alternate) = &i.alternate {
                    self.walk_statement(alternate, out);
                }
            }
            other => {
                if let Some(decl) = other.as_declaration() {
                    self.walk_declaration(decl, out);
                }
            }
        }
    }

    /// Procura `defineComponent(…)` onde um DS costuma escrevê-lo: numa `const`, no valor de uma
    /// chave de objeto, no retorno de uma fábrica. `binding` é o nome da variável ou da chave.
    fn walk_expression(&self, expr: &'p Expression<'a>, binding: Option<&str>, out: &mut Vec<RawComponent>) {
        match expr {
            Expression::CallExpression(call) => match self.component_of(call, binding) {
                Some(component) => out.push(component),
                None => {
                    self.walk_expression(&call.callee, None, out);
                    call.arguments.iter().filter_map(Argument::as_expression).for_each(|arg| self.walk_expression(arg, None, out));
                }
            },
            Expression::ArrowFunctionExpression(f) => match FnRef::Arrow(f).expression() {
                Some(value) => self.walk_expression(value, None, out),
                None => self.walk_body(FnRef::Arrow(f).body(), out),
            },
            Expression::FunctionExpression(f) => self.walk_body(f.body.as_deref(), out),
            Expression::ObjectExpression(o) => {
                for property in &o.properties {
                    let ObjectPropertyKind::ObjectProperty(p) = property else { continue };
                    let key = p.key.static_name();
                    self.walk_expression(&p.value, key.as_deref(), out);
                }
            }
            Expression::ArrayExpression(a) => a.elements.iter().filter_map(ArrayExpressionElement::as_expression).for_each(|e| self.walk_expression(e, None, out)),
            Expression::ParenthesizedExpression(p) => self.walk_expression(&p.expression, binding, out),
            Expression::TSAsExpression(e) => self.walk_expression(&e.expression, binding, out),
            Expression::TSSatisfiesExpression(e) => self.walk_expression(&e.expression, binding, out),
            Expression::ConditionalExpression(c) => {
                self.walk_expression(&c.consequent, binding, out);
                self.walk_expression(&c.alternate, binding, out);
            }
            _ => {}
        }
    }

    fn facts(&self) -> ModuleFacts {
        let mut facts = ModuleFacts::default();
        for decl in self.declarations() {
            match decl {
                Declaration::TSInterfaceDeclaration(i) => {
                    facts.types.insert(i.id.name.to_string(), self.parts_of_interface(i));
                }
                Declaration::TSTypeAliasDeclaration(t) => {
                    let mut parts = Vec::new();
                    self.parts_of_type(&t.type_annotation, &mut parts);
                    facts.types.insert(t.id.name.to_string(), parts);
                }
                _ => {}
            }
        }
        self.walk_statements(&self.program.body, &mut facts.components);
        facts
    }
}

fn read_module(module: &ModuleSource) -> ModuleFacts {
    let is_code = module.path.extension().and_then(|e| e.to_str()).is_some_and(|e| matches!(e, "ts" | "tsx" | "js" | "jsx" | "mjs"));
    // Só vale o parse de quem define um componente ou declara um tipo que outro módulo pode usar.
    if !is_code || !(module.source.contains(DEFINE_COMPONENT) || module.source.contains("interface ") || module.source.contains("type ")) {
        return ModuleFacts::default();
    }
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, module.source, SourceType::from_path(module.path).unwrap_or(SourceType::tsx())).parse();
    Reader { source: module.source, program: &parsed.program }.facts()
}

// ───────────── resolução dos tipos ─────────────

#[derive(Default)]
struct Members {
    props: Vec<PropInfo>,
    extends: Vec<String>,
}

impl Members {
    /// A declaração mais próxima vence, no lugar da herdada.
    fn put(&mut self, prop: PropInfo) {
        match self.props.iter_mut().find(|p| p.name == prop.name) {
            Some(existing) => *existing = prop,
            None => self.props.push(prop),
        }
    }

    fn opaque(&mut self, text: &str) {
        if !self.extends.iter().any(|e| e == text) {
            self.extends.push(text.to_string());
        }
    }
}

/// Um tipo pelo nome: o do próprio módulo vence o de outro (dois DS podem ter um `CardProps` cada).
fn find_type<'m>(modules: &'m [ModuleFacts], home: usize, name: &str) -> Option<(usize, &'m Vec<Part>)> {
    let own = modules.get(home).and_then(|m| m.types.get(name)).map(|parts| (home, parts));
    own.or_else(|| modules.iter().enumerate().find_map(|(i, m)| m.types.get(name).map(|parts| (i, parts))))
}

fn collect(modules: &[ModuleFacts], home: usize, parts: &[Part], depth: usize, out: &mut Members) {
    for part in parts {
        match part {
            Part::Props(props) => props.iter().cloned().for_each(|p| out.put(p)),
            Part::Opaque(text) => out.opaque(text),
            Part::Named(name) => match find_type(modules, home, name) {
                Some((module, inner)) if depth < MAX_DEPTH => collect(modules, module, inner, depth + 1, out),
                _ => out.opaque(name),
            },
        }
    }
}

fn is_literal(part: &str) -> bool {
    let quoted = |q: char| part.len() >= 2 && part.starts_with(q) && part.ends_with(q) && !part[1..part.len() - 1].contains(q);
    quoted('\'') || quoted('"') || part.parse::<f64>().is_ok() || matches!(part, "true" | "false" | "null")
}

/// `'a' | 'b' | 3`: uma união só de literais.
fn is_literal_union(text: &str) -> bool {
    text.split('|').map(str::trim).all(is_literal)
}

/// Um tipo que é só o nome de uma união de literais do DS (`Tone`) vira a própria união: é o que
/// quem escreve o deck precisa saber, e o nome sozinho não diz.
fn expand_literal_alias(modules: &[ModuleFacts], home: usize, ty: &str) -> Option<String> {
    let (_, parts) = find_type(modules, home, ty)?;
    match parts.as_slice() {
        [Part::Opaque(text)] if is_literal_union(text) => Some(text.clone()),
        _ => None,
    }
}

fn resolve(modules: &[ModuleFacts], home: usize, raw: &RawComponent) -> ComponentProps {
    let mut members = Members::default();
    collect(modules, home, &raw.parts, 0, &mut members);
    for prop in &mut members.props {
        if let Some(union) = expand_literal_alias(modules, home, &prop.ty) {
            prop.ty = union;
        }
    }
    for (name, default) in &raw.defaults {
        if let Some(prop) = members.props.iter_mut().find(|p| &p.name == name) {
            prop.default = Some(default.clone());
        }
    }
    ComponentProps { name: raw.name.clone(), type_name: raw.type_name.clone(), props: members.props, extends: members.extends }
}

/// As props de todo `defineComponent` dos módulos, na ordem em que aparecem.
pub fn extract(sources: &[ModuleSource]) -> Vec<ComponentProps> {
    let modules: Vec<ModuleFacts> = sources.iter().map(read_module).collect();
    modules.iter().enumerate().flat_map(|(home, m)| m.components.iter().map(move |raw| (home, raw))).map(|(home, raw)| resolve(&modules, home, raw)).collect()
}

// ───────────── schema ─────────────

fn get<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    match v {
        Value::Object(o) => o.get(key).filter(|v| !v.is_nullish()),
        _ => None,
    }
}

/// O schema de um componente no formato do schema do núcleo (`{ type, properties, required }`),
/// com as props na ordem da declaração.
pub fn to_schema(component: &ComponentProps) -> Value {
    let mut properties = Obj::new();
    for prop in &component.props {
        let mut p = Obj::new();
        p.insert(Rc::from("type"), str_val(&prop.ty));
        if let Some(description) = &prop.description {
            p.insert(Rc::from("description"), str_val(description));
        }
        if let Some(default) = &prop.default {
            p.insert(Rc::from("default"), str_val(default));
        }
        properties.insert(Rc::from(prop.name.as_str()), obj_val(p));
    }
    let required: Vec<Value> = component.props.iter().filter(|p| !p.optional).map(|p| str_val(&p.name)).collect();
    let mut out = Obj::new();
    out.insert(Rc::from("type"), str_val("object"));
    out.insert(Rc::from("properties"), obj_val(properties));
    out.insert(Rc::from("required"), arr_val(required));
    if !component.extends.is_empty() {
        out.insert(Rc::from("x-extends"), arr_val(component.extends.iter().map(|e| str_val(e)).collect()));
    }
    let source = component.type_name.as_ref().map_or("tipos do componente".to_string(), |t| format!("tipos ({t})"));
    out.insert(Rc::from("x-source"), str_val(&source));
    obj_val(out)
}

/// O schema de um componente veio do autor do DS (e não da dedução do kit pelos casos do catálogo)?
fn is_authored(entry: &Value) -> bool {
    !get(entry, "x-source").is_some_and(|s| s.to_js_string().starts_with(DERIVED_SOURCE_PREFIX))
}

/// Os tipos mandam; do schema deduzido do catálogo ficam os exemplos de cada prop.
fn with_examples(typed: &Value, derived: Option<&Value>) -> Value {
    let (Value::Object(typed_obj), Some(Value::Object(examples_of))) = (typed, derived.and_then(|d| get(d, "properties"))) else { return typed.clone() };
    let Some(Value::Object(properties)) = typed_obj.get("properties") else { return typed.clone() };
    let mut merged = Obj::new();
    for (name, prop) in properties.iter() {
        let examples = examples_of.get(&**name).and_then(|d| get(d, "examples")).filter(|e| matches!(e, Value::Array(a) if !a.borrow().is_empty()));
        let prop = match (prop, examples) {
            (Value::Object(p), Some(examples)) => {
                let mut p = (**p).clone();
                p.insert(Rc::from("examples"), examples.clone());
                obj_val(p)
            }
            _ => prop.clone(),
        };
        merged.insert(name.clone(), prop);
    }
    let mut out = (**typed_obj).clone();
    out.insert(Rc::from("properties"), obj_val(merged));
    obj_val(out)
}

/// O schema do DS, componente a componente: o que o autor passou ao `createDs` vence; senão, o lido
/// dos tipos (com os exemplos do catálogo); senão, o deduzido do catálogo. `names` são os
/// componentes do manifesto, na ordem dele.
pub fn merge_schema(existing: Option<&Value>, names: &[String], typed: &[ComponentProps]) -> Option<Value> {
    let mut out = Obj::new();
    for name in names {
        let current = existing.and_then(|schema| get(schema, name));
        let from_types = typed.iter().find(|c| &c.name == name && (!c.props.is_empty() || !c.extends.is_empty()));
        let entry = match (current, from_types) {
            (Some(entry), _) if is_authored(entry) => entry.clone(),
            (derived, Some(component)) => with_examples(&to_schema(component), derived),
            (Some(entry), None) => entry.clone(),
            (None, None) => continue,
        };
        out.insert(Rc::from(name.as_str()), entry);
    }
    // Entradas do schema do autor que não são componentes do manifesto (tipos auxiliares) continuam.
    if let Some(Value::Object(schema)) = existing {
        for (name, entry) in schema.iter().filter(|(name, _)| !names.iter().any(|n| n.as_str() == &***name)) {
            out.insert(name.clone(), entry.clone());
        }
    }
    (!out.is_empty()).then(|| obj_val(out))
}

fn component_names(manifest: &Value) -> Vec<String> {
    match get(manifest, "components") {
        Some(Value::Array(list)) => list.borrow().iter().filter_map(|meta| get(meta, "name").map(Value::to_js_string)).collect(),
        _ => Vec::new(),
    }
}

/// O schema de um manifesto de DS, completado com os tipos dos módulos que o avaliador carregou.
pub fn schema_of(interp: &crate::js::Interp, manifest: &Value) -> Option<Value> {
    let sources: Vec<ModuleSource> = interp.modules.iter().map(|m| ModuleSource { path: &m.path, source: m.source }).collect();
    merge_schema(get(manifest, "schema"), &component_names(manifest), &extract(&sources))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn extract_one(source: &str) -> Vec<ComponentProps> {
        extract(&[ModuleSource { path: Path::new("ds.tsx"), source }])
    }

    fn prop<'a>(component: &'a ComponentProps, name: &str) -> &'a PropInfo {
        component.props.iter().find(|p| p.name == name).unwrap_or_else(|| panic!("sem a prop {name}"))
    }

    const CARD: &str = r#"
import { Box, type Children } from 'pptsx';
import { defineComponent } from '@pptsx/ds-kit';

export type Tone = 'default' | 'brand';

export interface CardProps {
  /** O título do cartão, numa linha. */
  readonly title: string;
  /**
   * Tom da superfície.
   * Padrão 'default'.
   */
  readonly tone?: Tone;
  // comentário de linha não é descrição
  readonly columns?: 2 | 3;
  readonly items: readonly { label: string; value: number }[];
  readonly children?: Children;
}

function CardView({ title, tone = 'default', columns = 3, items, children }: CardProps) {
  return <Box>{children}</Box>;
}

export const Card = defineComponent<CardProps>({ name: 'Card', ds: 'x', tags: ['block'] }, CardView);
"#;

    #[test]
    fn reads_name_type_optional_description_and_default() {
        let found = extract_one(CARD);
        assert_eq!(found.len(), 1);
        let card = &found[0];
        assert_eq!(card.name, "Card");
        assert_eq!(card.type_name.as_deref(), Some("CardProps"));
        assert_eq!(card.props.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(), ["title", "tone", "columns", "items", "children"]);
        let title = prop(card, "title");
        assert_eq!((title.ty.as_str(), title.optional, title.description.as_deref()), ("string", false, Some("O título do cartão, numa linha.")));
        let tone = prop(card, "tone");
        assert_eq!((tone.ty.as_str(), tone.optional, tone.default.as_deref()), ("'default' | 'brand'", true, Some("'default'")), "o alias de literais abre");
        assert_eq!(tone.description.as_deref(), Some("Tom da superfície. Padrão 'default'."));
        let columns = prop(card, "columns");
        assert_eq!((columns.ty.as_str(), columns.description.as_deref(), columns.default.as_deref()), ("2 | 3", None, Some("3")));
        assert_eq!(prop(card, "items").ty, "readonly { label: string; value: number }[]");
        assert!(card.extends.is_empty());
    }

    #[test]
    fn follows_extends_and_intersections_and_keeps_what_it_cannot_open() {
        let source = r#"
interface Base { /** Rótulo. */ label: string; size?: number }
interface Wide extends Base, Omit<BoxProps, 'children'> { size: number; wide?: boolean }
type Mixed = Base & { extra?: string } & SlideProps;
export const A = defineComponent<Wide>({ name: 'A' }, ({ wide = false }) => null);
export const B = defineComponent<Mixed>('B', () => null);
"#;
        let found = extract_one(source);
        let a = &found[0];
        assert_eq!(a.props.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(), ["label", "size", "wide"]);
        assert!(!prop(a, "size").optional, "a declaração mais próxima vence a herdada");
        assert_eq!(prop(a, "label").description.as_deref(), Some("Rótulo."));
        assert_eq!(prop(a, "wide").default.as_deref(), Some("false"));
        assert_eq!(a.extends, ["Omit<BoxProps, 'children'>"]);
        let b = &found[1];
        assert_eq!(b.name, "B");
        assert_eq!(b.props.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(), ["label", "size", "extra"]);
        assert_eq!(b.extends, ["SlideProps"]);
    }

    #[test]
    fn only_unions_of_literals_are_expanded() {
        assert!(is_literal_union("'a' | \"b\" | 3 | true"));
        assert!(!is_literal_union("string | number"));
        assert!(!is_literal_union("keyof typeof tones"));
        let source = "type Size = number | 'auto';\nexport const A = defineComponent<{ size?: Size }>({ name: 'A' }, () => null);";
        assert_eq!(prop(&extract_one(source)[0], "size").ty, "Size");
    }

    #[test]
    fn falls_back_to_the_parameter_annotation_and_the_variable_name() {
        let source = r#"
type P = { n: number };
const View = ({ n = 1 }: P) => null;
export const Counter = defineComponent({ tags: [] }, View);
export const Inline = defineComponent<{ a?: string }>({ name: 'Inline' }, (props) => null);
"#;
        let found = extract_one(source);
        assert_eq!(found[0].name, "Counter");
        assert_eq!(prop(&found[0], "n").default.as_deref(), Some("1"));
        assert_eq!(found[1].type_name, None);
        assert!(prop(&found[1], "a").optional);
    }

    #[test]
    fn finds_the_props_type_in_another_module() {
        let types = ModuleSource { path: Path::new("types.ts"), source: "export interface TagProps { /** Texto. */ text: string }" };
        let component = ModuleSource { path: Path::new("tag.tsx"), source: "import type { TagProps } from './types.ts';\nexport const Tag = defineComponent<TagProps>({ name: 'Tag' }, () => null);" };
        let found = extract(&[component, types]);
        assert_eq!(prop(&found[0], "text").description.as_deref(), Some("Texto."));
    }

    #[test]
    fn finds_components_built_by_a_factory_with_curried_views() {
        let source = r#"
export interface CoverProps { readonly title: string; readonly tone?: Tone }
const coverView = (theme: Theme) => ({ title, tone = 'brand' }: CoverProps) => null;
function closingView(theme: Theme) {
  return function ({ title = 'Obrigado' }: { title?: string }) { return null; };
}
export const createLayouts = (theme: Theme) => ({
  Cover: defineComponent<CoverProps>({ name: 'Cover', tags: ['layout'] }, coverView(theme)),
  Closing: defineComponent({ tags: [] }, closingView(theme)),
});
"#;
        let found = extract_one(source);
        assert_eq!(found.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(), ["Cover", "Closing"]);
        assert_eq!(prop(&found[0], "tone").default.as_deref(), Some("'brand'"));
        assert!(!prop(&found[0], "title").optional);
        assert_eq!(prop(&found[1], "title").default.as_deref(), Some("'Obrigado'"));
    }

    fn json(v: &Value) -> String {
        let mut out = String::new();
        crate::js::value::to_json(v, &mut out);
        out
    }

    #[test]
    fn schema_marks_required_and_keeps_declaration_order() {
        let card = &extract_one(CARD)[0];
        let schema = json(&to_schema(card));
        assert!(schema.contains(r#""required":["title","items"]"#), "{schema}");
        assert!(schema.contains(r#""tone":{"type":"'default' | 'brand'","description":"Tom da superfície. Padrão 'default'.","default":"'default'"}"#), "{schema}");
        assert!(schema.find("\"title\"") < schema.find("\"tone\""));
    }

    #[test]
    fn types_replace_the_catalog_schema_but_not_the_authors() {
        let typed = extract_one(CARD);
        let derived = crate::js::parse_json(r#"{ "Card": { "type": "object", "properties": { "title": { "type": "string", "examples": ["Receita"] } }, "required": ["title"], "x-source": "catálogo e defaults" } }"#).expect("json");
        let merged = json(&merge_schema(Some(&derived), &["Card".to_string()], &typed).expect("schema"));
        assert!(merged.contains(r#""title":{"type":"string","description":"O título do cartão, numa linha.","examples":["Receita"]}"#), "{merged}");
        assert!(merged.contains(r#""x-source":"tipos (CardProps)""#), "{merged}");

        let authored = crate::js::parse_json(r#"{ "Card": { "type": "object", "properties": { "only": { "type": "number" } }, "required": [] } }"#).expect("json");
        let kept = json(&merge_schema(Some(&authored), &["Card".to_string()], &typed).expect("schema"));
        assert!(kept.contains("\"only\"") && !kept.contains("\"tone\""), "{kept}");
    }

    #[test]
    fn components_without_types_keep_the_catalog_schema() {
        let derived = crate::js::parse_json(r#"{ "Plain": { "type": "object", "properties": { "x": { "type": "number" } }, "required": [], "x-source": "catálogo e defaults" } }"#).expect("json");
        let merged = json(&merge_schema(Some(&derived), &["Plain".to_string(), "Ghost".to_string()], &[]).expect("schema"));
        assert!(merged.contains("\"Plain\"") && !merged.contains("Ghost"), "{merged}");
    }
}
