//! Módulos ESM: `pptsx` é nativo; o resto (arquivos relativos, pacotes em node_modules,
//! JSON) é lido, parseado pelo oxc e avaliado uma vez.

use std::fs;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_span::{SourceType, Span};

use super::builtins::{native, pick_responsive};
use super::interp::{Flow, Interp, ModuleRec};
use super::value::*;
use super::{JsError, R, Throw, fail};

const EXTENSIONS: &[&str] = &["tsx", "ts", "jsx", "js", "mjs", "json"];

impl Interp {
    pub fn load_entry(&mut self, path: &Path) -> R<Rc<Obj>> {
        let abs = fs::canonicalize(path).map_err(|e| Throw::Error(JsError { msg: format!("{}: {e}", path.display()), at: None }))?;
        self.load_module(&abs)
    }

    fn load_module(&mut self, path: &Path) -> R<Rc<Obj>> {
        if let Some(&id) = self.by_path.get(path) {
            return match &self.modules[id].exports {
                Some(e) => Ok(e.clone()),
                None => fail(format!("import circular envolvendo {}", path.display())),
            };
        }
        let text = fs::read_to_string(path).map_err(|e| Throw::Error(JsError { msg: format!("{}: {e}", path.display()), at: None }))?;
        let is_json = path.extension().is_some_and(|e| e == "json");
        // JSON é uma expressão JS válida: o mesmo parser e avaliador servem.
        let source: &'static str = Box::leak(if is_json { format!("export default ({text});").into_boxed_str() } else { text.into_boxed_str() });
        let id = self.modules.len();
        self.modules.push(ModuleRec { path: path.to_path_buf(), source, exports: None });
        self.by_path.insert(path.to_path_buf(), id);

        let alloc: &'static Allocator = Box::leak(Box::new(Allocator::default()));
        let source_type = if is_json { SourceType::mjs() } else { SourceType::from_path(path).unwrap_or(SourceType::tsx()) };
        let parsed = Parser::new(alloc, source, source_type).parse();
        if let Some(first) = parsed.diagnostics.errors().next() {
            let offset = first.labels.first().map_or(0, |l| l.offset());
            return Err(Throw::Error(JsError { msg: format!("erro de sintaxe: {}", first.message), at: Some((id, offset)) }));
        }
        let program: &'static Program<'static> = Box::leak(Box::new(parsed.program));

        let saved = self.cur;
        self.cur = id;
        let result = self.exec_module(program);
        self.cur = saved;
        let exports = Rc::new(result?);
        self.modules[id].exports = Some(exports.clone());
        Ok(exports)
    }

    fn exec_module(&mut self, program: &'static Program<'static>) -> R<Obj> {
        let env = scope(Some(&self.globals));
        let mut exports = Obj::new();
        // ESM: imports antes de tudo, depois as funções içadas.
        for stmt in &program.body {
            if let Statement::ImportDeclaration(d) = stmt {
                self.exec_import(d, &env)?;
            }
        }
        self.hoist(&program.body, &env)?;
        let mut pending: Vec<(Rc<str>, Rc<str>)> = Vec::new();
        for stmt in &program.body {
            match stmt {
                Statement::ImportDeclaration(_) => {}
                Statement::ExportDeclaration(d) => self.exec_export_decl(&d.declaration, &env, &mut exports)?,
                Statement::ExportDefaultDeclaration(d) => {
                    let value = match &d.declaration {
                        ExportDefaultDeclarationKind::FunctionDeclaration(f) => {
                            let v = self.function_value(f, &env)?;
                            if let Some(id) = &f.id {
                                env.define(id.name.as_str(), v.clone(), true);
                            }
                            v
                        }
                        ExportDefaultDeclarationKind::ClassDeclaration(c) => return self.err(c.span, "classes não são suportadas em decks"),
                        ExportDefaultDeclarationKind::TSInterfaceDeclaration(_) => continue,
                        other => match other.as_expression() {
                            Some(e) => self.eval(e, &env)?,
                            None => continue,
                        },
                    };
                    exports.insert(Rc::from("default"), value);
                }
                Statement::ExportNamedDeclaration(d) => {
                    if d.export_kind == ImportOrExportKind::Type {
                        continue;
                    }
                    for spec in &d.specifiers {
                        if spec.export_kind != ImportOrExportKind::Type {
                            pending.push((export_name(&spec.exported), export_name(&spec.local)));
                        }
                    }
                }
                Statement::ExportFromDeclaration(d) => {
                    if d.export_kind == ImportOrExportKind::Type {
                        continue;
                    }
                    let source = self.import(d.source.value.as_str(), d.source.span)?;
                    for spec in &d.specifiers {
                        // Nome que o módulo de origem não tem é tipo (o TS apaga): não vira export.
                        let local = export_name(&spec.local);
                        if spec.export_kind == ImportOrExportKind::Type {
                            continue;
                        }
                        if let Some(v) = source.get(&*local) {
                            exports.insert(export_name(&spec.exported), v.clone());
                        }
                    }
                }
                Statement::ExportAllDeclaration(d) => {
                    if d.export_kind == ImportOrExportKind::Type {
                        continue;
                    }
                    let source = self.import(d.source.value.as_str(), d.source.span)?;
                    match &d.exported {
                        Some(name) => {
                            exports.insert(export_name(name), Value::Object(source));
                        }
                        None => {
                            for (k, v) in source.iter().filter(|(k, _)| &***k != "default") {
                                exports.insert(k.clone(), v.clone());
                            }
                        }
                    }
                }
                other => {
                    if let Flow::Return(_) = self.exec(other, &env)? {
                        return self.err(other_span(other), "return fora de função");
                    }
                }
            }
        }
        // `export { a as b }` vale para declarações de qualquer ponto do módulo.
        for (exported, local) in pending {
            if let Some(v) = env.lookup(&local) {
                exports.insert(exported, v);
            }
        }
        Ok(exports)
    }

    fn exec_export_decl(&mut self, decl: &'static Declaration<'static>, env: &Env, exports: &mut Obj) -> R<()> {
        match decl {
            Declaration::VariableDeclaration(d) => {
                self.declare(d, env)?;
                for declarator in &d.declarations {
                    let mut names = Vec::new();
                    binding_names(&declarator.id, &mut names);
                    for name in names {
                        exports.insert(Rc::from(name), env.lookup(name).unwrap_or(Value::Undefined));
                    }
                }
            }
            Declaration::FunctionDeclaration(f) => {
                if let Some(id) = &f.id {
                    exports.insert(Rc::from(id.name.as_str()), env.lookup(id.name.as_str()).unwrap_or(Value::Undefined));
                }
            }
            Declaration::ClassDeclaration(c) => {
                if let Some(id) = &c.id {
                    self.exec_class_stub(id.name.as_str(), env, exports);
                }
            }
            Declaration::TSEnumDeclaration(e) => return self.err(e.span, "enum não é suportado (use um objeto const)"),
            _ => {}
        }
        Ok(())
    }

    fn exec_class_stub(&self, name: &str, env: &Env, exports: &mut Obj) {
        let stub = native("unsupported", |_, _, _| fail("classes não são suportadas em decks"), Value::Undefined);
        env.define(name, stub.clone(), false);
        exports.insert(Rc::from(name), stub);
    }

    fn exec_import(&mut self, d: &'static ImportDeclaration<'static>, env: &Env) -> R<()> {
        if d.import_kind == ImportOrExportKind::Type {
            return Ok(());
        }
        let exports = self.import(d.source.value.as_str(), d.source.span)?;
        let Some(specs) = &d.specifiers else { return Ok(()) };
        for spec in specs {
            match spec {
                ImportDeclarationSpecifier::ImportSpecifier(s) => {
                    if s.import_kind == ImportOrExportKind::Type {
                        continue;
                    }
                    // Nome ausente = tipo importado sem `type` (o TS apaga); vira undefined.
                    let name = export_name(&s.imported);
                    env.define(s.local.name.as_str(), exports.get(&*name).cloned().unwrap_or(Value::Undefined), false);
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                    env.define(s.local.name.as_str(), exports.get("default").cloned().unwrap_or(Value::Undefined), false);
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                    env.define(s.local.name.as_str(), Value::Object(exports.clone()), false);
                }
            }
        }
        Ok(())
    }

    fn import(&mut self, spec: &str, span: Span) -> R<Rc<Obj>> {
        if spec == "pptsx" || spec.starts_with("pptsx/") {
            return Ok(Rc::new(pptsx_module()));
        }
        if let Some(m) = super::node::node_module(spec) {
            return Ok(Rc::new(m));
        }
        let from = self.modules[self.cur].path.parent().map(Path::to_path_buf).unwrap_or_default();
        let Some(path) = resolve(&from, spec) else {
            return self.err(span, format!("módulo '{spec}' não encontrado"));
        };
        self.load_module(&path).map_err(|t| self.locate(t, span))
    }
}

fn other_span(stmt: &Statement) -> Span {
    oxc_span::GetSpan::span(stmt)
}

fn export_name(n: &ModuleExportName) -> Rc<str> {
    Rc::from(match n {
        ModuleExportName::IdentifierName(i) => i.name.as_str(),
        ModuleExportName::IdentifierReference(r) => r.name.as_str(),
        ModuleExportName::StringLiteral(s) => s.value.as_str(),
    })
}

fn binding_names(p: &'static BindingPattern<'static>, out: &mut Vec<&'static str>) {
    match p {
        BindingPattern::BindingIdentifier(id) => out.push(id.name.as_str()),
        BindingPattern::AssignmentPattern(a) => binding_names(&a.left, out),
        BindingPattern::ObjectPattern(o) => {
            o.properties.iter().for_each(|prop| binding_names(&prop.value, out));
            if let Some(rest) = &o.rest {
                binding_names(&rest.argument, out);
            }
        }
        BindingPattern::ArrayPattern(a) => {
            a.elements.iter().flatten().for_each(|el| binding_names(el, out));
            if let Some(rest) = &a.rest {
                binding_names(&rest.argument, out);
            }
        }
    }
}

// ───────────── resolução ─────────────

fn file_candidates(base: &Path) -> Option<PathBuf> {
    if base.is_file() {
        return Some(base.to_path_buf());
    }
    // Convenção ESM do TS: './x.js' no código aponta para './x.ts'.
    if let Some(ext) = base.extension().and_then(|e| e.to_str())
        && matches!(ext, "js" | "mjs" | "jsx") {
            for alt in ["ts", "tsx"] {
                let p = base.with_extension(alt);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    for ext in EXTENSIONS {
        let p = PathBuf::from(format!("{}.{ext}", base.display()));
        if p.is_file() {
            return Some(p);
        }
    }
    if base.is_dir() {
        for ext in EXTENSIONS {
            let p = base.join(format!("index.{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

pub(crate) fn resolve(from: &Path, spec: &str) -> Option<PathBuf> {
    if spec.starts_with("./") || spec.starts_with("../") || spec.starts_with('/') {
        return file_candidates(&from.join(spec)).and_then(|p| fs::canonicalize(p).ok());
    }
    resolve_package(from, spec)
}

/// Pacote em node_modules (subindo pastas). Usa `exports["."]` (source/import/default),
/// `module` ou `main` do package.json; subcaminhos resolvem direto no pacote.
fn resolve_package(from: &Path, spec: &str) -> Option<PathBuf> {
    let mut parts = spec.splitn(if spec.starts_with('@') { 3 } else { 2 }, '/');
    let name = if spec.starts_with('@') { format!("{}/{}", parts.next()?, parts.next()?) } else { parts.next()?.to_string() };
    let sub = parts.next();
    let mut dir = Some(from);
    while let Some(d) = dir {
        let pkg = d.join("node_modules").join(&name);
        if pkg.is_dir() {
            if let Some(sub) = sub {
                return file_candidates(&pkg.join(sub)).and_then(|p| fs::canonicalize(p).ok());
            }
            let entry = package_entry(&pkg).unwrap_or_else(|| "index".into());
            return file_candidates(&pkg.join(entry)).and_then(|p| fs::canonicalize(p).ok());
        }
        dir = d.parent();
    }
    None
}

fn package_entry(pkg: &Path) -> Option<String> {
    let mut interp = Interp::new();
    let value = interp.load_entry(&pkg.join("package.json")).ok()?.get("default").cloned()?;
    let pick = |v: &Value| -> Option<String> {
        match v {
            Value::Str(s) => Some(s.to_string()),
            Value::Object(o) => ["source", "import", "default"].iter().find_map(|k| o.get(*k).and_then(Value::as_str).map(String::from)),
            _ => None,
        }
    };
    let Value::Object(o) = &value else { return None };
    if let Some(exports) = o.get("exports") {
        let dot = match exports {
            Value::Object(e) if e.contains_key(".") => e.get(".").cloned(),
            other => Some(other.clone()),
        };
        if let Some(entry) = dot.as_ref().and_then(pick) {
            return Some(entry);
        }
    }
    ["source", "module", "main"].iter().find_map(|k| o.get(*k).and_then(Value::as_str).map(String::from))
}

// ───────────── módulo nativo `pptsx` ─────────────

/// Cores do tema Office que o pptsx usa quando o autor não declara (DEFAULTS.theme.colors).
pub const THEME_DEFAULTS: &[(&str, &str)] = &[
    ("dark1", "#000000"),
    ("light1", "#FFFFFF"),
    ("dark2", "#44546A"),
    ("light2", "#E7E6E6"),
    ("accent1", "#4472C4"),
    ("accent2", "#ED7D31"),
    ("accent3", "#A5A5A5"),
    ("accent4", "#FFC000"),
    ("accent5", "#5B9BD5"),
    ("accent6", "#70AD47"),
    ("hyperlink", "#0563C1"),
    ("followedHyperlink", "#954F72"),
];

/// resolveTheme do pptsx (resolve/theme.ts): valida os nomes, normaliza para hex e completa com o padrão.
fn resolve_theme(_: &mut Interp, _: &Value, a: &[Value]) -> R<Value> {
    let theme = a.first().cloned().unwrap_or(Value::Undefined);
    let field = |k: &str| match &theme {
        Value::Object(o) => o.get(k).cloned().unwrap_or(Value::Undefined),
        _ => Value::Undefined,
    };
    let given = match field("colors") {
        Value::Object(o) => o,
        _ => Rc::new(Obj::new()),
    };
    let mut declared = Vec::new();
    for (key, value) in given.iter() {
        if matches!(value, Value::Undefined) {
            continue;
        }
        if !THEME_DEFAULTS.iter().any(|(n, _)| *n == &**key) {
            let names: Vec<&str> = THEME_DEFAULTS.iter().map(|(n, _)| *n).collect();
            return fail(format!("theme.colors.{key} não existe; use {}", names.join(", ")));
        }
        declared.push(Value::Str(key.clone()));
    }
    let mut colors = Obj::new();
    for (name, default) in THEME_DEFAULTS {
        let hex = match given.get(*name).filter(|v| !matches!(v, Value::Undefined)) {
            Some(v) => match crate::css::parse_color(&v.to_js_string()) {
                Some(c) => format!("#{}", c.hex()),
                None => return fail(format!("theme.colors.{name}: cor inválida \"{}\"", v.to_js_string())),
            },
            None => default.to_string(),
        };
        colors.insert(Rc::from(*name), str_val(&hex));
    }
    let name = match field("name") {
        Value::Str(s) if !s.trim().is_empty() => Value::Str(s),
        _ => str_val("pptsx"),
    };
    let fonts = match field("fonts") {
        Value::Undefined => obj_val(Obj::new()),
        other => other,
    };
    let mut out = Obj::new();
    out.insert(Rc::from("name"), name);
    out.insert(Rc::from("colors"), obj_val(colors));
    out.insert(Rc::from("declared"), arr_val(declared));
    out.insert(Rc::from("fonts"), fonts);
    Ok(obj_val(out))
}

fn pptsx_module() -> Obj {
    let mut m = Obj::new();
    let prims = [
        ("Deck", Kind::Deck),
        ("Slide", Kind::Slide),
        ("Box", Kind::Box),
        ("Text", Kind::Text),
        ("Image", Kind::Image),
        ("Shape", Kind::Shape),
        ("Span", Kind::Span),
        ("B", Kind::B),
        ("I", Kind::I),
        ("Sup", Kind::Sup),
        ("Sub", Kind::Sub),
        ("Chart", Kind::Chart),
        ("Table", Kind::Table),
        ("Path", Kind::Path),
        ("Icon", Kind::Icon),
        ("Connector", Kind::Connector),
        ("SlideNumber", Kind::SlideNumber),
        ("Container", Kind::Container),
        ("Fragment", Kind::Fragment),
    ];
    for (name, kind) in prims {
        m.insert(Rc::from(name), Value::Func(Rc::new(Func::Intrinsic(kind))));
    }
    let identity: NativeFn = |_, _, a| Ok(a.first().cloned().unwrap_or(Value::Undefined));
    for name in ["defineDeck", "defineDs", "defineConfig"] {
        m.insert(Rc::from(name), native(name, identity, Value::Undefined));
    }
    m.insert(
        Rc::from("defineComponent"),
        native(
            "defineComponent",
            |_, _, a| {
                let meta = a.first().cloned().unwrap_or(Value::Undefined);
                let name = match &meta {
                    Value::Str(s) => s.clone(),
                    Value::Object(o) => o.get("displayName").or_else(|| o.get("name")).map_or(Rc::from("Component"), |v| Rc::from(v.to_js_string())),
                    _ => Rc::from("Component"),
                };
                let inner = a.get(1).cloned().unwrap_or(Value::Undefined);
                let defaults = match a.get(2) {
                    Some(Value::Object(o)) => Some(o.clone()),
                    _ => None,
                };
                let mut meta_obj = match &meta {
                    Value::Object(o) => (**o).clone(),
                    _ => Obj::new(),
                };
                meta_obj.insert(Rc::from("name"), Value::Str(name.clone()));
                if let Some(d) = &defaults {
                    meta_obj.insert(Rc::from("defaults"), Value::Object(d.clone()));
                }
                Ok(Value::Func(Rc::new(Func::Component { name, inner, defaults, meta: obj_val(meta_obj) })))
            },
            Value::Undefined,
        ),
    );
    // M15: o componente devolve um <Slide> marcado com o layout (nome, placeholders, fixed, background);
    // o mais interno vence, como em resolve/expand.ts.
    m.insert(
        Rc::from("defineLayout"),
        native(
            "defineLayout",
            |_, _, a| {
                let mut layout = match a.get(1) {
                    Some(Value::Object(o)) => (**o).clone(),
                    _ => Obj::new(),
                };
                layout.insert(Rc::from("name"), a.first().cloned().unwrap_or(Value::Undefined));
                let mut this = Obj::new();
                this.insert(Rc::from("layout"), obj_val(layout));
                this.insert(Rc::from("component"), a.get(2).cloned().unwrap_or(Value::Undefined));
                Ok(native(
                    "Layout",
                    |it, this, args| {
                        let Value::Object(this) = this else { return Ok(Value::Undefined) };
                        let component = this.get("component").cloned().unwrap_or(Value::Undefined);
                        match it.call(&component, args.to_vec())? {
                            Value::Element(e) if e.kind == Kind::Slide && !e.props.contains_key(LAYOUT_KEY) => {
                                let mut props = (*e.props).clone();
                                props.insert(Rc::from(LAYOUT_KEY), this.get("layout").cloned().unwrap_or(Value::Undefined));
                                Ok(Value::Element(Rc::new(Element { kind: e.kind, props: Rc::new(props), children: e.children.clone(), component: e.component, source: e.source.clone() })))
                            }
                            other => Ok(other),
                        }
                    },
                    obj_val(this),
                ))
            },
            Value::Undefined,
        ),
    );
    let jsx: NativeFn = |it, _, a| {
        let tag = a.first().cloned().unwrap_or(Value::Undefined);
        let props = match a.get(1) {
            Some(Value::Object(o)) => (**o).clone(),
            _ => Obj::new(),
        };
        it.make_element(&tag, props, None)
    };
    for name in ["jsx", "jsxs", "jsxDEV"] {
        m.insert(Rc::from(name), native(name, jsx, Value::Undefined));
    }
    m.insert(
        Rc::from("toHexColor"),
        native(
            "toHexColor",
            |_, _, a| {
                let raw = a.first().map(Value::to_js_string).unwrap_or_default();
                match crate::css::parse_color(&raw) {
                    Some(c) => Ok(str_val(&format!("#{}", c.hex()))),
                    None => fail(format!("cor inválida: \"{raw}\"")),
                }
            },
            Value::Undefined,
        ),
    );
    m.insert(Rc::from("COMPONENT_META"), str_val(COMPONENT_META_KEY));
    // A Liberation Sans (Arial) já vem embutida no binário: as faces padrão não precisam de arquivo.
    m.insert(Rc::from("defaultFontFaces"), native("defaultFontFaces", |_, _, _| Ok(arr_val(Vec::new())), Value::Undefined));
    m.insert(Rc::from("defaultFontFiles"), native("defaultFontFiles", |_, _, _| Ok(arr_val(Vec::new())), Value::Undefined));
    m.insert(Rc::from("resolveTheme"), native("resolveTheme", resolve_theme, Value::Undefined));
    m.insert(Rc::from("isResponsive"), native("isResponsive", |_, _, a| Ok(Value::Bool(matches!(a.first(), Some(Value::Object(o)) if o.contains_key("base")))), Value::Undefined));
    m.insert(
        Rc::from("mapResponsive"),
        native(
            "mapResponsive",
            |it, _, a| {
                let value = a.first().cloned().unwrap_or(Value::Undefined);
                let f = a.get(1).cloned().unwrap_or(Value::Undefined);
                match &value {
                    Value::Object(o) if o.contains_key("base") => {
                        let mut out = Obj::new();
                        for (k, v) in o.iter() {
                            out.insert(k.clone(), it.call(&f, vec![v.clone()])?);
                        }
                        Ok(obj_val(out))
                    }
                    other => it.call(&f, vec![other.clone()]),
                }
            },
            Value::Undefined,
        ),
    );
    m.insert(
        Rc::from("pickResponsive"),
        native(
            "pickResponsive",
            |_, _, a| {
                let ctx = a.get(1).cloned().unwrap_or(Value::Undefined);
                let get = |k: &str| match &ctx {
                    Value::Object(o) => o.get(k).cloned().unwrap_or(Value::Undefined),
                    _ => Value::Undefined,
                };
                Ok(pick_responsive(&a.first().cloned().unwrap_or(Value::Undefined), &get("name").to_js_string(), get("aspect").to_num(), get("scale").to_num()))
            },
            Value::Undefined,
        ),
    );
    m
}
