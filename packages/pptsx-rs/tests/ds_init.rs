//! Um design system de ponta a ponta: `createDs({ fonts, sizes })` e um componente que já é um slide inteiro,
//! do `init --ds` ao `check`, sem nada na config além do registro do DS.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const DS: &str = r#"import { Box, Slide, Text, defineComponent } from 'pptsx';
import { createDs } from '@pptsx/ds-kit';

export const Capa = defineComponent({ name: 'Capa', catalog: [{ props: { title: 'Olá' } }] }, ({ title }: { title: string }) => (
  <Slide padding={40} fontFamily="Marca Teste"><Text fontSize={40}>{title}</Text></Slide>
));

export const Cartao = defineComponent({ name: 'Cartao', catalog: [{ props: { label: 'Receita' } }] }, ({ label }: { label: string }) => (
  <Box padding={12} fontFamily="Marca Teste"><Text>{label}</Text></Box>
));

export const ds = createDs({
  name: 'marca-teste',
  version: '0.0.1',
  components: [Capa, Cartao],
  fonts: [{ family: 'Marca Teste', weight: 400, file: new URL('./fonts/Marca-Regular.ttf', import.meta.url).pathname }],
  sizes: ['wide', '4x3'],
});
"#;

fn run(cwd: &Path, args: &[&str]) -> (bool, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args(args).current_dir(cwd).output().expect("rodar o binário");
    (out.status.success(), format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)))
}

#[test]
fn ds_fonts_sizes_and_slide_components_work_from_init_without_touching_the_config() {
    let root: PathBuf = std::env::temp_dir().join(format!("pptsx-rs-ds-init-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("ds/fonts")).expect("pasta do DS");
    fs::write(root.join("ds/index.tsx"), DS).expect("DS");
    let font = Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/fonts/LiberationSans-Regular.ttf");
    fs::copy(font, root.join("ds/fonts/Marca-Regular.ttf")).expect("fonte da marca");

    let (ok, output) = run(&root, &["init", "deck", "--ds", "ds/index.tsx"]);
    assert!(ok, "{output}");
    let deck = fs::read_to_string(root.join("deck/deck.tsx")).expect("deck gerado");
    // O componente de slide vai direto no <Deck>; o outro, num <Slide> do catálogo.
    assert!(deck.contains("\n    <Capa title=\"Olá\" />\n"), "{deck}");
    assert!(deck.contains("<Cartao label=\"Receita\" />") && deck.matches("<Slide").count() == 1, "{deck}");

    // Sem --size: valem os tamanhos do DS; a fonte declarada por ele mede o texto (sem font-missing).
    let (ok, output) = run(&root, &["check", "deck/deck.tsx"]);
    let _ = fs::remove_dir_all(&root);
    assert!(ok, "{output}");
    assert!(output.contains("deck wide") && output.contains("deck 4x3") && !output.contains("deck 16x9"), "{output}");
    assert!(!output.contains("font-missing") && output.contains("Nenhum diagnóstico"), "{output}");
}
