//! Embed de fontes no .pptx (M8; `fonts/eot.ts` e `emit/embed.ts` do TS). O PowerPoint só aceita
//! o `.fntdata` em EOT v2.1 sem compressão MTX e sem XOR (cabeçalho + TTF inteiro): TTF cru ou
//! ofuscado faz ele recusar o arquivo inteiro. O Keynote ignora o embed. Só TrueType de uma face
//! só e com licença que permite embed (fsType sem o bit "Restricted") sai no arquivo.

const EOT_VERSION: u32 = 0x0002_0001;
const EOT_MAGIC: u16 = 0x504c;
const EOT_FIXED_HEADER: usize = 80;
const DEFAULT_CHARSET: u8 = 1;
/// OS/2.fsType bit 1: "Restricted License embedding" (a fonte não pode ser embutida).
const FS_TYPE_RESTRICTED: u16 = 0x0002;
const SFNT_TRUETYPE: u32 = 0x0001_0000;
/// 'true' (TrueType da Apple).
const SFNT_TRUE: u32 = 0x7472_7565;

fn be16(data: &[u8], at: usize) -> u16 {
    u16::from_be_bytes([data[at], data[at + 1]])
}

fn be32(data: &[u8], at: usize) -> u32 {
    u32::from_be_bytes([data[at], data[at + 1], data[at + 2], data[at + 3]])
}

/// TrueType de uma face só: o que cabe num EOT sem conversão (CFF/.otf e .ttc ficam de fora).
pub fn is_truetype(ttf: &[u8]) -> bool {
    ttf.len() >= 12 && matches!(be32(ttf, 0), SFNT_TRUETYPE | SFNT_TRUE)
}

/// Diretório de tabelas sfnt → offset da tabela.
fn table_offset(ttf: &[u8], tag: &[u8; 4]) -> Result<usize, String> {
    let count = usize::from(be16(ttf, 4));
    (0..count)
        .map(|i| 12 + i * 16)
        .filter(|&record| record + 16 <= ttf.len())
        .find(|&record| &ttf[record..record + 4] == tag)
        .map(|record| be32(ttf, record + 8) as usize)
        .filter(|&offset| offset + 96 <= ttf.len() || tag == b"head" && offset + 12 <= ttf.len())
        .ok_or_else(|| format!("Fonte sem a tabela {}; não dá para gerar EOT.", String::from_utf8_lossy(tag)))
}

pub fn fs_type_of(ttf: &[u8]) -> Result<u16, String> {
    let os2 = table_offset(ttf, b"OS/2")?;
    Ok(be16(ttf, os2 + 8))
}

pub fn is_embeddable(fs_type: u16) -> bool {
    fs_type & FS_TYPE_RESTRICTED == 0
}

fn fixed_header(ttf: &[u8]) -> Result<[u8; EOT_FIXED_HEADER], String> {
    let os2 = table_offset(ttf, b"OS/2")?;
    let head = table_offset(ttf, b"head")?;
    let mut h = [0u8; EOT_FIXED_HEADER];
    // EOTSize (0..4) é preenchido depois de concatenar.
    h[4..8].copy_from_slice(&(ttf.len() as u32).to_le_bytes());
    h[8..12].copy_from_slice(&EOT_VERSION.to_le_bytes());
    // Flags (12..16): sem subset, sem MTX, sem XOR.
    h[16..26].copy_from_slice(&ttf[os2 + 32..os2 + 42]); // PANOSE
    h[26] = DEFAULT_CHARSET;
    h[27] = (be16(ttf, os2 + 62) & 1) as u8; // Italic = fsSelection bit 0
    h[28..32].copy_from_slice(&u32::from(be16(ttf, os2 + 4)).to_le_bytes()); // Weight = usWeightClass
    h[32..34].copy_from_slice(&be16(ttf, os2 + 8).to_le_bytes()); // fsType
    h[34..36].copy_from_slice(&EOT_MAGIC.to_le_bytes());
    for k in 0..4 {
        h[36 + k * 4..40 + k * 4].copy_from_slice(&be32(ttf, os2 + 42 + k * 4).to_le_bytes()); // UnicodeRange1-4
    }
    for k in 0..2 {
        h[52 + k * 4..56 + k * 4].copy_from_slice(&be32(ttf, os2 + 78 + k * 4).to_le_bytes()); // CodePageRange1-2
    }
    h[60..64].copy_from_slice(&be32(ttf, head + 8).to_le_bytes()); // CheckSumAdjustment
    // 64..80: Reserved1-4, zeros.
    Ok(h)
}

/// Padding (uint16 = 0) + tamanho em bytes (uint16) + UTF-16LE.
fn eot_string(text: &str) -> Vec<u8> {
    let bytes: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut out = vec![0, 0];
    out.extend((bytes.len() as u16).to_le_bytes());
    out.extend(bytes);
    out
}

fn is_regular_style(style: &str) -> bool {
    matches!(style.trim().to_ascii_lowercase().as_str(), "regular" | "normal" | "roman" | "book")
}

/// `family` é o nome com que o deck usa a fonte (o `typeface` do `<p:embeddedFont>`); estilo e
/// versão vêm da tabela `name` do TTF.
pub fn eot_of(ttf: &[u8], family: &str) -> Result<Vec<u8>, String> {
    let face = rustybuzz::ttf_parser::Face::parse(ttf, 0).map_err(|e| format!("fonte inválida: {e:?}"))?;
    let name = |id: u16| crate::text::font_name(&face, id).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let style = name(rustybuzz::ttf_parser::name_id::SUBFAMILY).unwrap_or_else(|| "Regular".into());
    let version = name(rustybuzz::ttf_parser::name_id::VERSION).unwrap_or_else(|| "Version 1.0".into());
    let full_name = if is_regular_style(&style) { family.to_string() } else { format!("{family} {style}") };
    let mut eot = fixed_header(ttf)?.to_vec();
    eot.extend(eot_string(family));
    eot.extend(eot_string(&style));
    eot.extend(eot_string(&version));
    eot.extend(eot_string(&full_name));
    eot.extend(eot_string("")); // RootString vazio: a fonte vale para qualquer origem
    eot.extend_from_slice(ttf);
    let size = (eot.len() as u32).to_le_bytes();
    eot[0..4].copy_from_slice(&size);
    Ok(eot)
}

/// Elemento de estilo dentro de <p:embeddedFont>, na ordem do CT_EmbeddedFontListEntry.
pub const STYLE_ORDER: [&str; 4] = ["regular", "bold", "italic", "boldItalic"];

pub fn style_of(bold: bool, italic: bool) -> &'static str {
    match (bold, italic) {
        (true, true) => "boldItalic",
        (true, false) => "bold",
        (false, true) => "italic",
        (false, false) => "regular",
    }
}

/// Uma face já pronta para o pacote (ppt/fonts/fontN.fntdata).
pub struct FontPart {
    pub family: String,
    pub style: &'static str,
    pub eot: Vec<u8>,
}
