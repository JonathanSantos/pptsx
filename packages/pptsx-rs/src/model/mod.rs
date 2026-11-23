//! Modelo resolvido: árvore de elementos avaliada → nós com estilo de layout (taffy) e pintura.
//! Aqui ficam os tipos (`Node`, `SlideSpec`, `DeckSpec`…), a herança de texto e o contexto `Cx`;
//! as etapas estão em `style`, `shape`, `resolve`, `data` e `connector`, como o `resolve/` do TS.

use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use taffy::prelude::*;

use crate::css::{Dash, Len, Rgba, Stroke, parse_color, parse_len};
use crate::diag::Diags;
use crate::js::{DeckCtx, Value};
use crate::text::LineHeight;

const BLACK: Rgba = Rgba { r: 0, g: 0, b: 0, a: 1.0 };
const PX_TO_PT: f32 = 0.75;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Align {
    Left,
    Center,
    Right,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Fit {
    Shrink,
    Truncate,
    Error,
}

#[derive(Clone, Debug)]
pub struct StyledRun {
    pub text: String,
    /// Peso CSS pedido (400, 700, 300, 600…); a face mais próxima decide no layout.
    pub weight: u16,
    pub italic: bool,
    pub color: Rgba,
    pub underline: bool,
    pub strike: bool,
    /// OOXML `baseline` em milésimos de % (30000 = sobrescrito).
    pub baseline: Option<i32>,
    pub href: Option<String>,
    /// M13-7: corpo/família do trecho quando diferem do Text.
    pub size: Option<f32>,
    pub family: Option<String>,
}

#[derive(Clone, Debug)]
pub struct TextSpec {
    pub runs: Vec<StyledRun>,
    pub family: String,
    pub size: f32,
    pub min_size: f32,
    pub line_height: LineHeight,
    pub align: Align,
    pub letter_spacing: f32,
    pub nowrap: bool,
    pub max_lines: Option<usize>,
    pub fit: Fit,
    /// SlideNumber: conteúdo de pior caso medido para a largura ("88", "88 / 88").
    pub sample: Option<String>,
    /// Grupo de fit: os Text do slide com o mesmo nome encolhem pela mesma escala.
    pub fit_group: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ShapeSpec {
    pub prst: &'static str,
    pub adj: Vec<(&'static str, i64)>,
    /// roundRect/pill: o ajuste depende do frame, calculado na emissão.
    pub radius: Option<f32>,
    pub pill: bool,
    pub line: bool,
    pub flip_h: bool,
    pub flip_v: bool,
    pub head: Option<String>,
    pub tail: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ImageSpec {
    pub path: PathBuf,
    pub cover: bool,
    /// Tamanho natural em pt (1 px CSS = 0,75 pt).
    pub natural: (f32, f32),
}

// Poucos nós por slide: embrulhar as variantes grandes espalharia Box pelo resolve sem ganho.
#[allow(clippy::large_enum_variant)]
#[derive(Clone, Debug)]
pub enum NodeKind {
    Container,
    Text(TextSpec),
    Shape(ShapeSpec),
    Image(ImageSpec),
    Table(crate::objects::TableSpec),
    Chart(crate::objects::ChartSpec),
    Path(PathSpec),
    Icon(IconSpec),
}

#[derive(Clone, Debug)]
pub struct PathSpec {
    pub path: crate::vector::VectorPath,
    pub view_box: crate::vector::Bounds,
    pub dash: Dash,
}

pub struct IconSpec {
    pub icon: std::rc::Rc<crate::vector::Icon>,
}

impl std::fmt::Debug for IconSpec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("IconSpec")
    }
}

impl Clone for IconSpec {
    fn clone(&self) -> Self {
        IconSpec { icon: self.icon.clone() }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Shadow {
    pub x: f32,
    pub y: f32,
    pub blur: f32,
    pub color: Rgba,
}

#[derive(Clone, Debug, Default)]
pub struct Paint {
    pub fill: Option<Rgba>,
    /// top, right, bottom, left
    pub borders: [Option<Stroke>; 4],
    pub radius: f32,
    /// Opacidade própria (a efetiva multiplica a dos ancestrais, na emissão).
    pub opacity: f32,
    pub shadow: Option<Shadow>,
    /// Rotação própria em graus (gira em torno do centro; desce para os filhos).
    pub rotate: f32,
    /// translate(x, y) do transform: desloca o nó e a subárvore só na pintura.
    pub translate: (f32, f32),
    /// `backgroundImage: url(…)` (cover), com o tamanho natural em pt.
    pub background_image: Option<(PathBuf, (f32, f32))>,
    /// `backgroundImage: linear-gradient(…)`: pinta por cima da cor de fundo (vence-a no PPTX).
    pub gradient: Option<crate::gradient::Gradient>,
}

impl Paint {
    /// Tem preenchimento (cor ou gradiente)?
    pub fn has_fill(&self) -> bool {
        self.fill.is_some() || self.gradient.is_some()
    }

    pub fn uniform_border(&self) -> Option<Stroke> {
        let first = self.borders[0]?;
        self.borders
            .iter()
            .all(|b| b.is_some_and(|b| b.width == first.width && b.color == first.color && b.dash == first.dash))
            .then_some(first)
    }

    pub fn has_border(&self) -> bool {
        self.borders.iter().any(Option::is_some)
    }
}

#[derive(Clone, Debug)]
pub struct Node {
    pub kind: NodeKind,
    pub style: Style,
    pub z: Option<f32>,
    pub absolute: bool,
    pub paint: Paint,
    pub children: Vec<Node>,
    pub label: String,
    pub href: Option<String>,
    pub component: bool,
    /// `id` do autor: alvo de Connector.
    pub id: Option<String>,
    /// Box paginate: os filhos em fluxo continuam em clones do slide quando não cabem.
    pub paginate: bool,
    /// SlideNumber: formato ("n" ou "n / total"); o texto é preenchido depois da paginação.
    pub slide_number: Option<String>,
    /// Sobe de camada na pintura (emit/paint.ts isLayered): posicionado explicitamente, com
    /// zIndex, translúcido ou transformado.
    pub layered: bool,
    /// M15: Text/Image/Box marcado com `placeholder` (ligado ao placeholder do layout).
    pub placeholder: Option<String>,
    /// M15: conteúdo fixo do layout (sai no slideLayout do arquivo, não no slide).
    pub fixed: bool,
    /// flex-basis como o pptsx o passa ao Yoga (style.ts flexBasisOf), para o motor Yoga.
    pub basis: Basis,
    /// Raiz de um componente do autor: `<Nome prop=valor …>` com as props que ele passou, em texto
    /// curto. Os diagnósticos dentro do componente levam isto em `data.component`, para quem lê
    /// saber o que mexer sem conhecer a entranha do DS.
    pub source: Option<std::rc::Rc<str>>,
}

/// Origem do flex-basis (BasisSource do pptsx): nenhuma (auto), do autor (`flexBasis`, ou
/// `flex` com basis escrita) ou implícita do `flex: n` (0, que Text/Table numa column ignoram).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Basis {
    #[default]
    None,
    Author(Dimension),
    Flex(Dimension),
}

/// M15: layout de slide (`defineLayout`): vira um slideLayout no arquivo.
#[derive(Clone, Debug)]
pub struct LayoutSpec {
    pub name: String,
    pub placeholders: Vec<String>,
    pub background: Option<LayoutBackground>,
}

#[derive(Clone, Debug)]
pub enum LayoutBackground {
    Color(Rgba),
    Image(PathBuf),
}

#[derive(Clone, Debug)]
pub struct ConnectorSpec {
    /// Path do conector (`… > Connector[i]`): acha o escopo de ids dele (M19).
    pub path: String,
    pub from: String,
    pub to: String,
    pub from_side: Option<String>,
    pub to_side: Option<String>,
    pub elbow: bool,
    pub start_arrow: Option<String>,
    pub end_arrow: Option<String>,
    pub stroke: Stroke,
    pub label: Option<TextSpec>,
    pub label_background: Option<Rgba>,
}

#[derive(Clone)]
pub struct SlideSpec {
    pub root: Node,
    pub background: Option<Rgba>,
    /// Imagem de fundo do slide (vence a cor, como em slideBackgroundOf).
    pub background_image: Option<(PathBuf, (f32, f32))>,
    /// Gradiente de fundo do slide (vence a cor; a imagem vence os dois).
    pub background_gradient: Option<crate::gradient::Gradient>,
    pub notes: Option<String>,
    /// Notas com estilo (negrito, itálico, cor, sublinhado, link): o pacote grava o corpo rico.
    pub notes_runs: Vec<StyledRun>,
    pub hidden: bool,
    pub connectors: Vec<ConnectorSpec>,
    pub layout: Option<Rc<LayoutSpec>>,
}

pub struct DeckSpec {
    pub slides: Vec<SlideSpec>,
    pub width: f32,
    pub height: f32,
    /// `<Deck theme>` (vence o da config).
    pub theme: Option<crate::config::Theme>,
    /// `<Deck sections>`: (título, slide do autor onde começa, base 1).
    pub sections: Vec<(String, usize)>,
    /// ResolveError do pptsx (id repetido no escopo, conector ambíguo, erro na função de um
    /// Container): o build para sem .pptx.
    pub fatal: Option<crate::validate::Fatal>,
}

/// M19: espaço medido de um `<Container>` na passada anterior: o frame (border-box, que o Box
/// fixa) e a content box (o que a função recebe).
#[derive(Clone, Copy, Debug)]
pub struct Measure {
    pub frame: (f64, f64),
    pub content: (f64, f64),
}

/// M19: o que o resolve precisa para os `<Container>`: o avaliador (as funções rodam nele), as
/// medidas por (slide do autor base 0, path), e o que a passada deixou pendente.
pub struct ContainerRun {
    pub interp: crate::js::Interp,
    pub measures: HashMap<(usize, String), Measure>,
    pub pending: Vec<(usize, String)>,
    /// css-not-emitted do conteúdo devolvido pelas funções, por slide do autor (base 1).
    pub notes: Vec<(usize, crate::validate::Note)>,
    /// Conteúdo devolvido por cada função (o lint roda as regras dos DS nele).
    pub filled: HashMap<(usize, String), Vec<Value>>,
    /// Resultado de cada função por (slide, path, medida): as funções são puras por contrato, então
    /// um Container já medido não roda de novo nas passadas seguintes (as de dentro dele é que rodam).
    cache: HashMap<(usize, String, u32, u32), (Vec<Value>, Vec<crate::validate::Note>)>,
}

impl ContainerRun {
    pub fn new(interp: crate::js::Interp) -> Self {
        ContainerRun { interp, measures: HashMap::new(), pending: Vec::new(), notes: Vec::new(), filled: HashMap::new(), cache: HashMap::new() }
    }

    /// Prepara a próxima passada (as medidas ficam).
    pub fn reset(&mut self) {
        self.pending.clear();
        self.notes.clear();
        self.filled.clear();
    }
}

// ───────────── herança de texto ─────────────

#[derive(Clone)]
struct Inherit {
    family: String,
    size: f32,
    weight: u16,
    italic: bool,
    color: Rgba,
    /// Alguma `color` foi declarada na cascata (o Chart herda a cor só nesse caso, como o TS).
    color_set: bool,
    line_height: LineHeight,
    align: Align,
    letter_spacing: f32,
    transform: Option<String>,
    underline: bool,
    strike: bool,
    /// `fitGroup` do Box/Container mais próximo: vale para os Text de dentro sem o próprio.
    fit_group: Option<String>,
}

impl Default for Inherit {
    fn default() -> Self {
        Inherit {
            family: "Arial".into(),
            size: 18.0,
            weight: 400,
            italic: false,
            color: BLACK,
            color_set: false,
            line_height: LineHeight::Normal,
            align: Align::Left,
            letter_spacing: 0.0,
            transform: None,
            underline: false,
            strike: false,
            fit_group: None,
        }
    }
}

struct Cx<'a> {
    ctx: &'a DeckCtx,
    base_dir: &'a Path,
    diags: &'a Diags,
    slide: usize,
    total: usize,
    /// Conectores saem da árvore e vão para o slide (resolve/connector.ts).
    connectors: Vec<ConnectorSpec>,
    /// Resolvendo o conteúdo fixo do layout.
    fixed: bool,
    containers: Option<&'a RefCell<ContainerRun>>,
    /// 1º ResolveError do slide (o pptsx lança e para).
    fatal: Option<crate::validate::Fatal>,
    /// Path do nó sendo resolvido (`Slide > Box[1] > Image`), para os diagnósticos que nascem no resolve.
    path: String,
}

type Props = crate::js::value::Obj;

impl Cx<'_> {
    /// Prop efetiva: responsivo resolvido e `undefined` = ausente.
    fn get(&self, props: &Props, key: &str) -> Option<Value> {
        let v = props.get(key)?;
        let picked = crate::js::value_pick(v, self.ctx);
        (!matches!(picked, Value::Undefined | Value::Null)).then_some(picked)
    }

    fn num(&self, props: &Props, key: &str) -> Option<f32> {
        match self.get(props, key)? {
            Value::Num(n) => Some(n as f32),
            Value::Str(s) => match parse_len(&s) {
                Some(Len::Pt(v)) => Some(v),
                _ => None,
            },
            _ => None,
        }
    }

    fn string(&self, props: &Props, key: &str) -> Option<String> {
        match self.get(props, key)? {
            Value::Str(s) => Some(s.to_string()),
            Value::Num(n) => Some(crate::js::value::num_to_string(n)),
            Value::Bool(b) => Some(b.to_string()),
            _ => None,
        }
    }

    fn bool(&self, props: &Props, key: &str) -> Option<bool> {
        match self.get(props, key)? {
            Value::Bool(b) => Some(b),
            _ => None,
        }
    }

    fn len(&self, props: &Props, key: &str) -> Option<Len> {
        match self.get(props, key)? {
            Value::Num(n) => Some(Len::Pt(n as f32)),
            Value::Str(s) => {
                let l = parse_len(&s);
                if l.is_none() {
                    self.warn(format!("{key}=\"{s}\" não é um comprimento válido"));
                }
                l
            }
            _ => None,
        }
    }

    fn color(&self, props: &Props, key: &str) -> Option<Rgba> {
        let s = self.string(props, key)?;
        let c = parse_color(&s);
        if c.is_none() {
            self.warn(format!("{key}=\"{s}\" não é uma cor válida"));
        }
        c
    }

    fn warn(&self, msg: String) {
        self.diags.warn(self.slide, msg);
    }

    /// `image-missing`: o arquivo de uma imagem (ou de um fundo) não existe ou não abre. O slide sai com o
    /// retângulo cinza (ou sem o fundo); o caminho resolvido diz a base dos relativos, a pasta do deck.
    fn image_missing(&self, what: &str, src: &str, path: &Path, error: impl std::fmt::Display) {
        let effect = if what == "imagem" { "no lugar dela sai um retângulo cinza" } else { "o fundo não sai" };
        let msg = format!("{} \"{src}\" {}: {effect}. {}", capitalized(what), image_problem(path, &error.to_string()), image_fix(path));
        self.diags.add(crate::diag::Diag::new(crate::diag::Level::Warn, "image-missing", self.slide, self.path.as_str(), msg));
    }
}

/// O que deu errado com o arquivo: não existe (com o caminho resolvido, que diz a base dos relativos) ou existe
/// mas não é um formato que se lê.
fn image_problem(path: &Path, error: &str) -> String {
    // `components` descarta os `.` do meio: "deck/./fotos/x.jpg" sai "deck/fotos/x.jpg".
    let shown: PathBuf = path.components().collect();
    if !path.exists() {
        return format!("não existe ({})", shown.display());
    }
    format!("existe mas não pôde ser lida ({error})")
}

/// O conserto, pela causa: caminho errado, SVG (que vai no `<Icon>`) ou um formato que o PPTX não leva.
fn image_fix(path: &Path) -> &'static str {
    if !path.exists() {
        return "Confira o caminho (relativo à pasta do deck) ou ponha o arquivo lá.";
    }
    if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("svg")) {
        return "SVG não entra em <Image>: use <Icon src=\"…\" /> (vira forma editável; size e color ajustam).";
    }
    "Use PNG ou JPEG."
}

fn capitalized(s: &str) -> String {
    let mut chars = s.chars();
    chars.next().map(|c| c.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

mod connector;
mod data;
pub(crate) mod fit_group;
mod resolve;
mod shape;
mod style;

// Só o resolve tem API pública (resolve_deck, number_slide…); o resto é interno ao modelo.
pub use resolve::*;
use connector::*;
use data::*;
use shape::*;
use style::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_messages_tell_missing_file_from_unreadable_format() {
        let dir = std::env::temp_dir().join(format!("pptsx-rs-img-msg-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("pasta");
        let svg = dir.join("logo.svg");
        let bad = dir.join("foto.png");
        std::fs::write(&svg, "<svg/>").expect("svg");
        std::fs::write(&bad, "não é png").expect("png falso");
        let missing = dir.join("./fotos/nada.jpg");
        assert!(image_problem(&missing, "x").starts_with("não existe (") && !image_problem(&missing, "x").contains("/./"));
        assert!(image_fix(&missing).contains("Confira o caminho"));
        assert_eq!(image_problem(&svg, "Could not decode image"), "existe mas não pôde ser lida (Could not decode image)");
        assert!(image_fix(&svg).contains("<Icon"));
        assert_eq!(image_fix(&bad), "Use PNG ou JPEG.");
        std::fs::remove_dir_all(&dir).expect("limpar");
    }
}
