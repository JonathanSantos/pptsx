//! Diagnósticos do build no formato do pptsx (`Diagnostic` de core/types.ts): severidade, código,
//! slide, path do nó, mensagem para um LLM agir e dados (`overflowPt`, `fromSize`…).

use std::cell::RefCell;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Level {
    Info,
    Warn,
    Error,
}

impl Level {
    pub fn name(self) -> &'static str {
        match self {
            Level::Info => "info",
            Level::Warn => "warning",
            Level::Error => "error",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum Data {
    Num(f64),
    Str(String),
    List(Vec<String>),
}

#[derive(Clone, Debug)]
pub struct Diag {
    pub level: Level,
    pub code: &'static str,
    /// 0 = deck inteiro.
    pub slide: usize,
    pub path: String,
    pub msg: String,
    pub data: Vec<(&'static str, Data)>,
}

impl Diag {
    pub fn new(level: Level, code: &'static str, slide: usize, path: impl Into<String>, msg: impl Into<String>) -> Self {
        Diag { level, code, slide, path: path.into(), msg: msg.into(), data: Vec::new() }
    }

    pub fn with(mut self, key: &'static str, value: Data) -> Self {
        self.set(key, value);
        self
    }

    pub fn num(self, key: &'static str, value: f64) -> Self {
        self.with(key, Data::Num(value))
    }

    pub fn set(&mut self, key: &'static str, value: Data) {
        match self.data.iter_mut().find(|(k, _)| *k == key) {
            Some(entry) => entry.1 = value,
            None => self.data.push((key, value)),
        }
    }

    pub fn get(&self, key: &str) -> Option<&Data> {
        self.data.iter().find(|(k, _)| *k == key).map(|(_, v)| v)
    }

    pub fn get_str(&self, key: &str) -> Option<&str> {
        match self.get(key) {
            Some(Data::Str(s)) => Some(s),
            _ => None,
        }
    }

    pub fn get_num(&self, key: &str) -> Option<f64> {
        match self.get(key) {
            Some(Data::Num(n)) => Some(*n),
            _ => None,
        }
    }
}

#[derive(Default)]
pub struct Diags(RefCell<Vec<Diag>>);

impl Diags {
    pub fn add(&self, d: Diag) {
        let mut list = self.0.borrow_mut();
        // O mesmo aviso repetido no mesmo nó (ex.: um componente em loop) aparece uma vez.
        if list.iter().any(|o| o.level == d.level && o.code == d.code && o.slide == d.slide && o.path == d.path && o.msg == d.msg) {
            return;
        }
        list.push(d);
    }

    /// Aviso sem código próprio do pptsx (o que o Rust ainda detecta à parte).
    pub fn push(&self, level: Level, slide: usize, msg: String) {
        self.add(Diag::new(level, "note", slide, "", msg));
    }

    pub fn warn(&self, slide: usize, msg: String) {
        self.push(Level::Warn, slide, msg);
    }

    pub fn extend(&self, list: Vec<Diag>) {
        for d in list {
            self.add(d);
        }
    }

    pub fn into_vec(self) -> Vec<Diag> {
        self.0.into_inner()
    }
}

/// 1 casa decimal (diagnostics.ts round).
pub fn round(v: f64) -> f64 {
    // Math.round do JS: meio sobe (para +∞).
    (v * 10.0 + 0.5).floor() / 10.0
}

/// Número como o JS imprime: sem ".0" sobrando.
pub fn fmt(v: f64) -> String {
    crate::js::value::num_to_string(round(v))
}
