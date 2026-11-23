//! A CLI de ponta a ponta: o que um agente tenta antes de ler a documentação.

use std::fs;
use std::process::Command;

/// `<comando> --help` mostra a ajuda e sai 0, sem rodar o comando. `types --help` criava uma pasta chamada
/// `--help` com os tipos dentro, e `mcp --help` subia o servidor calado.
#[test]
fn every_command_answers_help_without_running() {
    let cwd = std::env::temp_dir().join(format!("pptsx-rs-cli-help-{}", std::process::id()));
    let _ = fs::remove_dir_all(&cwd);
    fs::create_dir_all(&cwd).expect("pasta temporária");
    for command in ["build", "check", "tree", "lint", "init", "types", "skill", "mcp"] {
        for flag in ["--help", "-h"] {
            let run = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).args([command, flag]).current_dir(&cwd).output().expect("rodar o binário");
            let stdout = String::from_utf8_lossy(&run.stdout);
            assert!(run.status.success(), "{command} {flag}: {:?}\n{stdout}{}", run.status, String::from_utf8_lossy(&run.stderr));
            assert!(stdout.contains(&format!("pptsx-rs {command} ")), "{command} {flag}: {stdout}");
        }
    }
    let left: Vec<_> = fs::read_dir(&cwd).expect("pasta temporária").flatten().map(|e| e.file_name()).collect();
    let _ = fs::remove_dir_all(&cwd);
    assert!(left.is_empty(), "a ajuda gravou arquivos: {left:?}");
}

#[test]
fn plain_help_and_version_exit_zero() {
    let help = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).arg("--help").output().expect("rodar o binário");
    assert!(help.status.success() && String::from_utf8_lossy(&help.stdout).contains("pptsx-rs skill"));
    let version = Command::new(env!("CARGO_BIN_EXE_pptsx-rs")).arg("--version").output().expect("rodar o binário");
    assert_eq!(String::from_utf8_lossy(&version.stdout).trim(), format!("pptsx-rs {}", env!("CARGO_PKG_VERSION")));
}
