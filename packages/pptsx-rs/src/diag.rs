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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_is_one_decimal_with_half_up_like_js_math_round() {
        assert_eq!(round(1.25), 1.3);
        // Math.round(-12.5) é -12 no JS: o meio sobe para +∞, inclusive nos negativos.
        assert_eq!(round(-1.25), -1.2);
        assert_eq!(round(2.04), 2.0);
    }

    #[test]
    fn fmt_prints_numbers_like_js_without_trailing_zero() {
        assert_eq!(fmt(12.0), "12");
        assert_eq!(fmt(2.71), "2.7");
        assert_eq!(fmt(-0.04), "0");
    }

    #[test]
    fn diags_keep_one_copy_of_the_same_warning_on_the_same_node() {
        let diags = Diags::default();
        diags.add(Diag::new(Level::Warn, "x", 1, "Slide > Text", "m"));
        diags.add(Diag::new(Level::Warn, "x", 1, "Slide > Text", "m"));
        diags.add(Diag::new(Level::Warn, "x", 2, "Slide > Text", "m"));
        assert_eq!(diags.into_vec().len(), 2);
    }

    #[test]
    fn notes_have_the_note_code_and_no_path() {
        let diags = Diags::default();
        diags.warn(3, "imagem".into());
        let d = &diags.into_vec()[0];
        assert_eq!((d.level, d.code, d.slide, d.path.as_str()), (Level::Warn, "note", 3, ""));
    }

    #[test]
    fn data_set_replaces_the_value_of_an_existing_key() {
        let d = Diag::new(Level::Error, "box-overflow", 1, "", "").num("overflowPt", 1.0).num("overflowPt", 2.0).with("axis", Data::Str("x".into()));
        assert_eq!(d.get_num("overflowPt"), Some(2.0));
        assert_eq!(d.get_str("axis"), Some("x"));
        assert_eq!(d.data.len(), 2);
    }
}
