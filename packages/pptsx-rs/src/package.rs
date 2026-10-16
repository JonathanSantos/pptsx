//! Pacote .pptx (OPC/zip): partes fixas vêm de `templates/` (tema, master, notes master,
//! as mesmas que o pptsx grava hoje); presentation, slides, notas e relações são gerados.

use std::fmt::Write as _;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::LazyLock;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::emit::{Media, RelKind, SlideXml, esc};

const THEME: &str = include_str!("../templates/theme1.xml");
const MASTER: &str = include_str!("../templates/slideMaster1.xml");
const NOTES_MASTER: &str = include_str!("../templates/notesMaster1.xml");
const NOTES_MASTER_RELS: &str = include_str!("../templates/notesMaster1.xml.rels");
const PRES_PROPS: &str = include_str!("../templates/presProps.xml");
const VIEW_PROPS: &str = include_str!("../templates/viewProps.xml");
const TABLE_STYLES: &str = include_str!("../templates/tableStyles.xml");

const XML_HEAD: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
const REL_NS: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS: &str = "http://schemas.openxmlformats.org/package/2006/relationships";

pub struct SlideOut {
    pub slide: SlideXml,
    pub notes: Option<String>,
    pub notes_runs: Vec<crate::model::StyledRun>,
    /// M15: índice em `DeckOut::layouts` (slideLayout{i+2}); ausente = layout padrão.
    pub layout: Option<usize>,
}

pub struct DeckOut<'a> {
    pub title: &'a str,
    pub document: crate::config::Document,
    pub width: f32,
    pub height: f32,
    pub slides: Vec<SlideOut>,
    pub media: Media,
    pub lang: &'a str,
    pub theme: Option<crate::config::Theme>,
    /// (título, índice de saída onde começa).
    pub sections: Vec<(String, usize)>,
    /// M15: layouts do deck (`defineLayout`), na ordem em que aparecem.
    pub layouts: Vec<(std::rc::Rc<crate::model::LayoutSpec>, Option<crate::emit::LayoutPart>)>,
    /// M8: faces embutidas (ppt/fonts/fontN.fntdata), na ordem de registro.
    pub fonts: Vec<crate::embed::FontPart>,
}

/// Tema do arquivo: o do pptsx (Office) com as cores e fontes que o autor declarou.
fn theme_xml(theme: Option<&crate::config::Theme>) -> String {
    let Some(theme) = theme else { return THEME.to_string() };
    let tags = [
        ("dark1", "dk1"), ("light1", "lt1"), ("dark2", "dk2"), ("light2", "lt2"), ("accent1", "accent1"), ("accent2", "accent2"), ("accent3", "accent3"),
        ("accent4", "accent4"), ("accent5", "accent5"), ("accent6", "accent6"), ("hyperlink", "hlink"), ("followedHyperlink", "folHlink"),
    ];
    let name = esc(theme.name.as_deref().unwrap_or("pptsx"));
    let mut scheme = format!("<a:clrScheme name=\"{name}\">");
    for (slot, tag) in tags {
        let declared = theme.colors.iter().find(|(k, _)| k == slot).map(|(_, v)| v.clone());
        let default = crate::js::THEME_DEFAULTS.iter().find(|(k, _)| *k == slot).map_or("000000".to_string(), |(_, v)| v.trim_start_matches('#').to_string());
        let _ = write!(scheme, "<a:{tag}><a:srgbClr val=\"{}\"/></a:{tag}>", declared.unwrap_or(default));
    }
    scheme.push_str("</a:clrScheme>");
    let mut xml = THEME.to_string();
    if let (Some(start), Some(end)) = (xml.find("<a:clrScheme"), xml.find("</a:clrScheme>")) {
        xml.replace_range(start..end + "</a:clrScheme>".len(), &scheme);
    }
    let font = |xml: &mut String, block: &str, family: Option<&String>| {
        let Some(family) = family else { return };
        let Some(start) = xml.find(&format!("<a:{block}>")) else { return };
        let Some(latin) = xml[start..].find("<a:latin ").map(|i| i + start) else { return };
        let Some(close) = xml[latin..].find("/>").map(|i| i + latin) else { return };
        xml.replace_range(latin..close + 2, &format!("<a:latin typeface=\"{}\"/>", esc(family)));
    };
    font(&mut xml, "majorFont", theme.heading.as_ref());
    font(&mut xml, "minorFont", theme.body.as_ref());
    xml.replacen("name=\"Office Theme\"", &format!("name=\"{name}\""), 1)
}

/// M15: cores declaradas do tema viram `<a:schemeClr>` e as famílias do tema `+mj-lt`/`+mn-lt`
/// nos slides, layouts, master e gráficos (emit/theme.ts): trocar o tema no PowerPoint repinta o deck.
struct Themer {
    schemes: Vec<(String, &'static str)>,
    fonts: Vec<(String, &'static str)>,
    srgb: &'static regex::Regex,
    latin: &'static regex::Regex,
}

/// Nome de cada cor no `<a:schemeClr>` dos slides (tx1/bg1, não dk1/lt1); a ordem desempata hex repetido.
const SCHEMES: [(&str, &str); 12] = [
    ("accent1", "accent1"), ("accent2", "accent2"), ("accent3", "accent3"), ("accent4", "accent4"), ("accent5", "accent5"), ("accent6", "accent6"),
    ("dark1", "tx1"), ("light1", "bg1"), ("dark2", "tx2"), ("light2", "bg2"), ("hyperlink", "hlink"), ("followedHyperlink", "folHlink"),
];

impl Themer {
    fn new(theme: Option<&crate::config::Theme>) -> Self {
        let mut schemes: Vec<(String, &'static str)> = Vec::new();
        let mut fonts = Vec::new();
        if let Some(theme) = theme {
            for (slot, scheme) in SCHEMES {
                let Some((_, hex)) = theme.colors.iter().find(|(k, _)| k == slot) else { continue };
                let hex = hex.to_ascii_uppercase();
                if !schemes.iter().any(|(h, _)| *h == hex) {
                    schemes.push((hex, scheme));
                }
            }
            // Título e corpo iguais: vale a de corpo.
            if let Some(body) = &theme.body {
                fonts.push((esc(body), "+mn-lt"));
            }
            if let Some(heading) = &theme.heading {
                fonts.push((esc(heading), "+mj-lt"));
            }
        }
        static SRGB_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r#"<a:srgbClr val="([0-9A-Fa-f]{6})"\s*(?:/>|>(.*?)</a:srgbClr>)"#).expect("regex fixa"));
        static LATIN_RE: LazyLock<regex::Regex> = LazyLock::new(|| regex::Regex::new(r#"<a:latin typeface="([^"]*)""#).expect("regex fixa"));
        Themer { schemes, fonts, srgb: &SRGB_RE, latin: &LATIN_RE }
    }

    fn apply(&self, xml: &str) -> String {
        if self.schemes.is_empty() && self.fonts.is_empty() {
            return xml.to_string();
        }
        let colored = self.srgb.replace_all(xml, |c: &regex::Captures| {
            let hex = c[1].to_ascii_uppercase();
            let Some((_, scheme)) = self.schemes.iter().find(|(h, _)| *h == hex) else { return c[0].to_string() };
            match c.get(2).map(|m| m.as_str()).filter(|m| !m.is_empty()) {
                Some(children) => format!("<a:schemeClr val=\"{scheme}\">{children}</a:schemeClr>"),
                None => format!("<a:schemeClr val=\"{scheme}\"/>"),
            }
        });
        self.latin
            .replace_all(&colored, |c: &regex::Captures| match self.fonts.iter().find(|(f, _)| *f == c[1]) {
                Some((_, slot)) => format!("<a:latin typeface=\"{slot}\""),
                None => c[0].to_string(),
            })
            .into_owned()
    }
}

fn rels(entries: &[(String, &str, String)]) -> String {
    let mut out = format!("{XML_HEAD}<Relationships xmlns=\"{PKG_REL_NS}\">");
    for (id, kind, target) in entries {
        let external = if *kind == "hyperlink" { " TargetMode=\"External\"" } else { "" };
        let _ = write!(out, "<Relationship Id=\"{id}\" Type=\"{REL_NS}/{kind}\" Target=\"{}\"{external}/>", esc(target));
    }
    out.push_str("</Relationships>");
    out
}

fn content_types(deck: &DeckOut) -> String {
    let mut out = format!("{XML_HEAD}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">");
    for (ext, ty) in [
        ("xml", "application/xml"),
        ("rels", "application/vnd.openxmlformats-package.relationships+xml"),
        ("png", "image/png"),
        ("jpeg", "image/jpeg"),
        ("jpg", "image/jpeg"),
        ("gif", "image/gif"),
        ("svg", "image/svg+xml"),
        ("webp", "image/webp"),
        ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("bmp", "image/bmp"),
    ] {
        let _ = write!(out, "<Default Extension=\"{ext}\" ContentType=\"{ty}\"/>");
    }
    if !deck.fonts.is_empty() {
        let _ = write!(out, "<Default Extension=\"fntdata\" ContentType=\"application/x-fontdata\"/>");
    }
    let pml = "application/vnd.openxmlformats-officedocument.presentationml";
    let mut over = |part: &str, ty: String| {
        let _ = write!(out, "<Override PartName=\"{part}\" ContentType=\"{ty}\"/>");
    };
    over("/ppt/presentation.xml", format!("{pml}.presentation.main+xml"));
    over("/ppt/slideMasters/slideMaster1.xml", format!("{pml}.slideMaster+xml"));
    for n in 1..=deck.layouts.len() + 1 {
        over(&format!("/ppt/slideLayouts/slideLayout{n}.xml"), format!("{pml}.slideLayout+xml"));
    }
    over("/ppt/notesMasters/notesMaster1.xml", format!("{pml}.notesMaster+xml"));
    over("/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml".into());
    over("/ppt/presProps.xml", format!("{pml}.presProps+xml"));
    over("/ppt/viewProps.xml", format!("{pml}.viewProps+xml"));
    over("/ppt/tableStyles.xml", format!("{pml}.tableStyles+xml"));
    for n in 1..=deck.media.charts.len() {
        over(&format!("/ppt/charts/chart{n}.xml"), "application/vnd.openxmlformats-officedocument.drawingml.chart+xml".into());
    }
    for (i, s) in deck.slides.iter().enumerate() {
        over(&format!("/ppt/slides/slide{}.xml", i + 1), format!("{pml}.slide+xml"));
        if s.notes.is_some() {
            over(&format!("/ppt/notesSlides/notesSlide{}.xml", i + 1), format!("{pml}.notesSlide+xml"));
        }
    }
    over("/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml".into());
    over("/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml".into());
    out.push_str("</Types>");
    out
}

fn presentation(deck: &DeckOut) -> String {
    let ids: String = (0..deck.slides.len()).map(|i| format!("<p:sldId id=\"{}\" r:id=\"rId{}\"/>", 256 + i, i + 2)).collect();
    let notes_rid = deck.slides.len() + 2;
    let (cx, cy) = (crate::emit::emu(deck.width), crate::emit::emu(deck.height));
    let levels: String = (1..=9)
        .map(|l| {
            format!(
                "<a:lvl{l}pPr marL=\"{}\" algn=\"l\" defTabSz=\"914400\" rtl=\"0\" eaLnBrk=\"1\" latinLnBrk=\"0\" hangingPunct=\"1\"><a:defRPr sz=\"1800\" kern=\"1200\"><a:solidFill><a:schemeClr val=\"tx1\"/></a:solidFill><a:latin typeface=\"+mn-lt\"/><a:ea typeface=\"+mn-ea\"/><a:cs typeface=\"+mn-cs\"/></a:defRPr></a:lvl{l}pPr>",
                (l - 1) * 457200
            )
        })
        .collect();
    // M8: embedTrueTypeFonts + <p:embeddedFontLst> depois de notesSz (ordem do CT_Presentation).
    let embed_flag = if deck.fonts.is_empty() { "" } else { " embedTrueTypeFonts=\"1\"" };
    format!(
        "{XML_HEAD}<p:presentation xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"{REL_NS}\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" saveSubsetFonts=\"1\" autoCompressPictures=\"0\"{embed_flag}><p:sldMasterIdLst><p:sldMasterId id=\"2147483648\" r:id=\"rId1\"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id=\"rId{notes_rid}\"/></p:notesMasterIdLst><p:sldIdLst>{ids}</p:sldIdLst><p:sldSz cx=\"{cx}\" cy=\"{cy}\"/><p:notesSz cx=\"{cy}\" cy=\"{cx}\"/>{}<p:defaultTextStyle>{levels}</p:defaultTextStyle>{}</p:presentation>",
        embedded_fonts_xml(deck),
        sections_xml(deck)
    )
}

/// Uma entrada por família, na ordem da primeira aparição; faces na ordem do schema. pitchFamily
/// 34 = variable pitch + swiss, charset 0 = ANSI: o que o spike M8-S gravou e o PowerPoint aceitou.
fn embedded_fonts_xml(deck: &DeckOut) -> String {
    if deck.fonts.is_empty() {
        return String::new();
    }
    let mut families: Vec<&str> = Vec::new();
    for part in &deck.fonts {
        if !families.contains(&part.family.as_str()) {
            families.push(&part.family);
        }
    }
    let mut out = String::from("<p:embeddedFontLst>");
    for family in families {
        let _ = write!(out, "<p:embeddedFont><p:font typeface=\"{}\" pitchFamily=\"34\" charset=\"0\"/>", esc(family));
        for style in crate::embed::STYLE_ORDER {
            if let Some(i) = deck.fonts.iter().position(|p| p.family == family && p.style == style) {
                let _ = write!(out, "<p:{style} r:id=\"rIdFont{}\"/>", i + 1);
            }
        }
        out.push_str("</p:embeddedFont>");
    }
    out.push_str("</p:embeddedFontLst>");
    out
}

/// Seções do PowerPoint (extensão p14); cada uma vai do seu início até a próxima.
fn sections_xml(deck: &DeckOut) -> String {
    if deck.sections.is_empty() {
        return String::new();
    }
    let mut out = String::from("<p:extLst><p:ext uri=\"{521415D9-36F7-43E2-AB2F-B90AF26B5E84}\"><p14:sectionLst xmlns:p14=\"http://schemas.microsoft.com/office/powerpoint/2010/main\">");
    for (i, (title, start)) in deck.sections.iter().enumerate() {
        let end = deck.sections.get(i + 1).map_or(deck.slides.len(), |(_, s)| *s);
        let ids: String = (*start..end.min(deck.slides.len())).map(|n| format!("<p14:sldId id=\"{}\"/>", 256 + n)).collect();
        // GUID estável por posição: o arquivo sai igual a cada build.
        let _ = write!(out, "<p14:section name=\"{}\" id=\"{{5EC71A1E-0000-4000-8000-{:012X}}}\"><p14:sldIdLst>{ids}</p14:sldIdLst></p14:section>", esc(title), i + 1);
    }
    out.push_str("</p14:sectionLst></p:ext></p:extLst>");
    out
}

fn presentation_rels(deck: &DeckOut) -> String {
    let n = deck.slides.len();
    let mut entries = vec![("rId1".to_string(), "slideMaster", "slideMasters/slideMaster1.xml".to_string())];
    for i in 0..n {
        entries.push((format!("rId{}", i + 2), "slide", format!("slides/slide{}.xml", i + 1)));
    }
    entries.push((format!("rId{}", n + 2), "notesMaster", "notesMasters/notesMaster1.xml".into()));
    entries.push((format!("rId{}", n + 3), "presProps", "presProps.xml".into()));
    entries.push((format!("rId{}", n + 4), "viewProps", "viewProps.xml".into()));
    entries.push((format!("rId{}", n + 5), "theme", "theme/theme1.xml".into()));
    entries.push((format!("rId{}", n + 6), "tableStyles", "tableStyles.xml".into()));
    for i in 0..deck.fonts.len() {
        entries.push((format!("rIdFont{}", i + 1), "font", format!("fonts/font{}.fntdata", i + 1)));
    }
    rels(&entries)
}

const LAYOUT: &str = "<p:sldLayout xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" preserve=\"1\"><p:cSld name=\"DEFAULT\"><p:bg><p:bgRef idx=\"1001\"><a:schemeClr val=\"bg1\"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";

fn rel_entry(id: String, rel: &RelKind) -> (String, &'static str, String) {
    match rel {
        RelKind::Image(name) => (id, "image", format!("../media/{name}")),
        RelKind::Hyperlink(url) => (id, "hyperlink", url.clone()),
        RelKind::Chart(n) => (id, "chart", format!("../charts/chart{n}.xml")),
    }
}

/// M15: slideLayout de um `defineLayout`: conteúdo fixo antes dos placeholders (no PowerPoint o que
/// vem depois fica por cima). Placeholders com inset 0 e sem autoajuste, como os textos do slide.
fn author_layout(spec: &crate::model::LayoutSpec, part: Option<&crate::emit::LayoutPart>, lang: &str) -> String {
    let bg = part.map(|p| p.background.as_str()).unwrap_or_default();
    let mut tree = String::new();
    if let Some(part) = part {
        tree.push_str(&part.drawings);
        let first_id = part.drawings.matches("<p:cNvPr ").count() as u32 + 1000;
        for (i, ph) in part.placeholders.iter().enumerate() {
            let prompt = esc(crate::emit::placeholder_prompt(&ph.name));
            let f = ph.frame;
            let lst = ph.text.as_ref().map_or_else(
                || "<a:lstStyle/>".to_string(),
                |t| {
                    let algn = match t.align {
                        crate::model::Align::Left => "l",
                        crate::model::Align::Center => "ctr",
                        crate::model::Align::Right => "r",
                    };
                    format!(
                        "<a:lstStyle><a:lvl1pPr marL=\"0\" indent=\"0\" algn=\"{algn}\"><a:buNone/><a:defRPr sz=\"{}\" b=\"{}\"{}><a:solidFill><a:srgbClr val=\"{}\"/></a:solidFill><a:latin typeface=\"{}\"/></a:defRPr></a:lvl1pPr></a:lstStyle>",
                        (t.size * 100.0).round() as i64,
                        u8::from(t.bold),
                        if t.italic { " i=\"1\"" } else { "" },
                        t.color.hex(),
                        esc(&t.family)
                    )
                },
            );
            let _ = write!(
                tree,
                "<p:sp><p:nvSpPr><p:cNvPr id=\"{}\" name=\"{prompt}\"/><p:cNvSpPr><a:spLocks noGrp=\"1\"/></p:cNvSpPr><p:nvPr>{}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x=\"{}\" y=\"{}\"/><a:ext cx=\"{}\" cy=\"{}\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap=\"square\" lIns=\"0\" tIns=\"0\" rIns=\"0\" bIns=\"0\" anchor=\"t\"><a:noAutofit/></a:bodyPr>{lst}<a:p><a:r><a:rPr lang=\"{lang}\" dirty=\"0\"/><a:t>{prompt}</a:t></a:r></a:p></p:txBody></p:sp>",
                first_id + i as u32,
                crate::emit::ph_xml(ph.ty, ph.idx),
                crate::emit::emu(f.x),
                crate::emit::emu(f.y),
                crate::emit::emu(f.w),
                crate::emit::emu(f.h)
            );
        }
    }
    format!(
        "{XML_HEAD}<p:sldLayout xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"{REL_NS}\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" preserve=\"1\" userDrawn=\"1\"><p:cSld name=\"{}\">{bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>{tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>",
        esc(&spec.name)
    )
}

fn external(href: Option<&str>) -> Option<&str> {
    href.filter(|h| !h.starts_with("slide:"))
}

/// Notas que precisam do caminho rico (emit/notes.ts isRichNotes).
fn is_rich(runs: &[crate::model::StyledRun]) -> bool {
    runs.iter().any(|r| r.weight >= 600 || r.italic || r.underline || r.strike || external(r.href.as_deref()).is_some() || r.color.hex() != "000000" || r.baseline.is_some())
}

/// Corpo das notas: texto puro como o pptxgenjs grava, ou um `<a:r>` por trecho com estilo e link.
/// Devolve o XML e os links externos (URL, rId) para o `.rels`.
fn notes_slide(text: &str, runs: &[crate::model::StyledRun], lang: &str) -> (String, Vec<(String, String)>) {
    let mut links: Vec<(String, String)> = Vec::new();
    let paragraphs: String = if is_rich(runs) {
        for r in runs {
            if let Some(h) = external(r.href.as_deref())
                && !links.iter().any(|(u, _)| u == h) {
                    links.push((h.to_string(), format!("rIdNotesLink{}", links.len() + 1)));
                }
        }
        // '\n' separa parágrafos, como no Text; parágrafo vazio fica sem trechos.
        let mut paras: Vec<Vec<(&crate::model::StyledRun, String)>> = vec![Vec::new()];
        for r in runs {
            for (k, piece) in r.text.split('\n').enumerate() {
                if k > 0 {
                    paras.push(Vec::new());
                }
                if !piece.is_empty() {
                    paras.last_mut().expect("parágrafo").push((r, piece.to_string()));
                }
            }
        }
        paras
            .iter()
            .map(|p| {
                let body: String = p
                    .iter()
                    .map(|(r, t)| {
                        let mut attrs = vec![format!("lang=\"{lang}\"")];
                        if r.weight >= 600 {
                            attrs.push("b=\"1\"".into());
                        }
                        if r.italic {
                            attrs.push("i=\"1\"".into());
                        }
                        if r.underline {
                            attrs.push("u=\"sng\"".into());
                        }
                        if r.strike {
                            attrs.push("strike=\"sngStrike\"".into());
                        }
                        if let Some(b) = r.baseline {
                            attrs.push(format!("baseline=\"{b}\""));
                        }
                        attrs.push("dirty=\"0\"".into());
                        let fill = if r.color.hex() == "000000" { String::new() } else { format!("<a:solidFill><a:srgbClr val=\"{}\"/></a:solidFill>", r.color.hex()) };
                        let link = external(r.href.as_deref()).and_then(|h| links.iter().find(|(u, _)| u == h)).map(|(_, id)| format!("<a:hlinkClick r:id=\"{id}\"/>")).unwrap_or_default();
                        format!("<a:r><a:rPr {}>{fill}{link}</a:rPr><a:t>{}</a:t></a:r>", attrs.join(" "), esc(t))
                    })
                    .collect();
                format!("<a:p>{body}<a:endParaRPr lang=\"{lang}\" dirty=\"0\"/></a:p>")
            })
            .collect()
    } else {
        text.split('\n')
            .map(|line| {
                if line.is_empty() {
                    format!("<a:p><a:endParaRPr lang=\"{lang}\" dirty=\"0\"/></a:p>")
                } else {
                    format!("<a:p><a:r><a:rPr lang=\"{lang}\" dirty=\"0\"/><a:t>{}</a:t></a:r></a:p>", esc(line))
                }
            })
            .collect()
    };
    let xml = format!(
        "{XML_HEAD}<p:notes xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"{REL_NS}\" xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/><a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id=\"2\" name=\"Slide Image Placeholder 1\"/><p:cNvSpPr><a:spLocks noGrp=\"1\" noRot=\"1\" noChangeAspect=\"1\"/></p:cNvSpPr><p:nvPr><p:ph type=\"sldImg\"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id=\"3\" name=\"Notes Placeholder 2\"/><p:cNvSpPr><a:spLocks noGrp=\"1\"/></p:cNvSpPr><p:nvPr><p:ph type=\"body\" idx=\"1\"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>{paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>"
    );
    (xml, links)
}

/// Data UTC (ISO 8601) sem dependência de crate de datas.
fn now_iso() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs()) as i64;
    let (days, rem) = (secs.div_euclid(86400), secs.rem_euclid(86400));
    // Algoritmo civil_from_days (Howard Hinnant).
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

fn core_xml(title: &str, doc: &crate::config::Document) -> String {
    let now = now_iso();
    let creator = esc(doc.author.as_deref().unwrap_or("pptsx-rs"));
    let subject = doc.subject.as_ref().map(|s| format!("<dc:subject>{}</dc:subject>", esc(s))).unwrap_or_default();
    let keywords = doc.keywords.as_ref().map(|k| format!("<cp:keywords>{}</cp:keywords>", esc(k))).unwrap_or_default();
    format!(
        "{XML_HEAD}<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title>{}</dc:title>{subject}<dc:creator>{creator}</dc:creator><cp:lastModifiedBy>{creator}</cp:lastModifiedBy><cp:revision>1</cp:revision><dcterms:created xsi:type=\"dcterms:W3CDTF\">{now}</dcterms:created><dcterms:modified xsi:type=\"dcterms:W3CDTF\">{now}</dcterms:modified>{keywords}</cp:coreProperties>",
        esc(title)
    )
}

fn app_xml(deck: &DeckOut) -> String {
    let notes = deck.slides.iter().filter(|s| s.notes.is_some()).count();
    format!(
        "{XML_HEAD}<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><TotalTime>0</TotalTime><Words>0</Words><Application>pptsx-rs</Application><PresentationFormat>Custom</PresentationFormat><Paragraphs>0</Paragraphs><Slides>{}</Slides><Notes>{notes}</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop>{}<LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>",
        deck.slides.len(),
        deck.document.company.as_ref().map(|c| format!("<Company>{}</Company>", esc(c))).unwrap_or_default()
    )
}

pub fn write_pptx(path: &Path, deck: &DeckOut) -> std::io::Result<()> {
    let file = File::create(path)?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let put = |zip: &mut ZipWriter<File>, name: &str, data: &[u8]| -> std::io::Result<()> {
        zip.start_file(name, opts).map_err(std::io::Error::other)?;
        zip.write_all(data)
    };
    // [Content_Types].xml primeiro: alguns leitores exigem.
    put(&mut zip, "[Content_Types].xml", content_types(deck).as_bytes())?;
    put(
        &mut zip,
        "_rels/.rels",
        format!(
            "{XML_HEAD}<Relationships xmlns=\"{PKG_REL_NS}\"><Relationship Id=\"rId1\" Type=\"{REL_NS}/extended-properties\" Target=\"docProps/app.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"{REL_NS}/officeDocument\" Target=\"ppt/presentation.xml\"/></Relationships>"
        )
        .as_bytes(),
    )?;
    put(&mut zip, "docProps/app.xml", app_xml(deck).as_bytes())?;
    put(&mut zip, "docProps/core.xml", core_xml(deck.title, &deck.document).as_bytes())?;
    put(&mut zip, "ppt/presentation.xml", presentation(deck).as_bytes())?;
    put(&mut zip, "ppt/_rels/presentation.xml.rels", presentation_rels(deck).as_bytes())?;
    for (i, part) in deck.fonts.iter().enumerate() {
        put(&mut zip, &format!("ppt/fonts/font{}.fntdata", i + 1), &part.eot)?;
    }
    put(&mut zip, "ppt/presProps.xml", PRES_PROPS.as_bytes())?;
    put(&mut zip, "ppt/viewProps.xml", VIEW_PROPS.as_bytes())?;
    put(&mut zip, "ppt/tableStyles.xml", TABLE_STYLES.as_bytes())?;
    put(&mut zip, "ppt/theme/theme1.xml", theme_xml(deck.theme.as_ref()).as_bytes())?;
    // Layouts do autor depois do padrão: slideLayout{i+2}, rId{i+3} no master (rId2 é o tema).
    let layout_ids: String = (0..deck.layouts.len()).map(|i| format!("<p:sldLayoutId id=\"{}\" r:id=\"rId{}\"/>", 2147483650 + i, i + 3)).collect();
    let themer = Themer::new(deck.theme.as_ref());
    put(&mut zip, "ppt/slideMasters/slideMaster1.xml", themer.apply(&MASTER.replace("</p:sldLayoutIdLst>", &format!("{layout_ids}</p:sldLayoutIdLst>"))).as_bytes())?;
    let mut master_rels = vec![("rId1".to_string(), "slideLayout", "../slideLayouts/slideLayout1.xml".to_string()), ("rId2".into(), "theme", "../theme/theme1.xml".into())];
    for i in 0..deck.layouts.len() {
        master_rels.push((format!("rId{}", i + 3), "slideLayout", format!("../slideLayouts/slideLayout{}.xml", i + 2)));
    }
    put(&mut zip, "ppt/slideMasters/_rels/slideMaster1.xml.rels", rels(&master_rels).as_bytes())?;
    put(&mut zip, "ppt/slideLayouts/slideLayout1.xml", format!("{XML_HEAD}{LAYOUT}").as_bytes())?;
    put(&mut zip, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels(&[("rId1".into(), "slideMaster", "../slideMasters/slideMaster1.xml".into())]).as_bytes())?;
    for (i, (spec, part)) in deck.layouts.iter().enumerate() {
        let n = i + 2;
        put(&mut zip, &format!("ppt/slideLayouts/slideLayout{n}.xml"), themer.apply(&author_layout(spec, part.as_ref(), deck.lang)).as_bytes())?;
        let mut entries = vec![("rId1".to_string(), "slideMaster", "../slideMasters/slideMaster1.xml".to_string())];
        for (j, rel) in part.iter().flat_map(|p| p.rels.iter()).enumerate() {
            entries.push(rel_entry(format!("rId{}", j + 2), rel));
        }
        put(&mut zip, &format!("ppt/slideLayouts/_rels/slideLayout{n}.xml.rels"), rels(&entries).as_bytes())?;
    }
    put(&mut zip, "ppt/notesMasters/notesMaster1.xml", NOTES_MASTER.as_bytes())?;
    put(&mut zip, "ppt/notesMasters/_rels/notesMaster1.xml.rels", NOTES_MASTER_RELS.as_bytes())?;

    for (i, s) in deck.slides.iter().enumerate() {
        let n = i + 1;
        put(&mut zip, &format!("ppt/slides/slide{n}.xml"), themer.apply(&s.slide.xml).as_bytes())?;
        let layout = s.layout.map_or(1, |i| i + 2);
        let mut entries = vec![("rId1".to_string(), "slideLayout", format!("../slideLayouts/slideLayout{layout}.xml"))];
        for (j, rel) in s.slide.rels.iter().enumerate() {
            entries.push(rel_entry(format!("rId{}", j + 2), rel));
        }
        if s.notes.is_some() {
            entries.push((format!("rId{}", s.slide.rels.len() + 2), "notesSlide", format!("../notesSlides/notesSlide{n}.xml")));
        }
        put(&mut zip, &format!("ppt/slides/_rels/slide{n}.xml.rels"), rels(&entries).as_bytes())?;
        if let Some(text) = &s.notes {
            let (xml, links) = notes_slide(text, &s.notes_runs, deck.lang);
            put(&mut zip, &format!("ppt/notesSlides/notesSlide{n}.xml"), xml.as_bytes())?;
            let mut entries = vec![("rId1".to_string(), "notesMaster", "../notesMasters/notesMaster1.xml".to_string()), ("rId2".into(), "slide", format!("../slides/slide{n}.xml"))];
            entries.extend(links.into_iter().map(|(href, id)| (id, "hyperlink", href)));
            put(&mut zip, &format!("ppt/notesSlides/_rels/notesSlide{n}.xml.rels"), rels(&entries).as_bytes())?;
        }
    }
    for (i, (xml, workbook)) in deck.media.charts.iter().enumerate() {
        let n = i + 1;
        put(&mut zip, &format!("ppt/charts/chart{n}.xml"), themer.apply(xml).as_bytes())?;
        put(&mut zip, &format!("ppt/charts/_rels/chart{n}.xml.rels"), rels(&[("rId1".into(), "package", format!("../embeddings/Microsoft_Excel_Worksheet{n}.xlsx"))]).as_bytes())?;
        put(&mut zip, &format!("ppt/embeddings/Microsoft_Excel_Worksheet{n}.xlsx"), workbook)?;
    }
    for (name, source) in &deck.media.files {
        let bytes = match source {
            crate::emit::MediaSource::File(path) => std::fs::read(path)?,
            crate::emit::MediaSource::Bytes(b) => b.clone(),
        };
        // Imagem já comprimida: guardar sem deflate economiza CPU sem perder tamanho.
        zip.start_file(format!("ppt/media/{name}"), SimpleFileOptions::default().compression_method(CompressionMethod::Stored)).map_err(std::io::Error::other)?;
        zip.write_all(&bytes)?;
    }
    zip.finish().map_err(std::io::Error::other)?;
    Ok(())
}
