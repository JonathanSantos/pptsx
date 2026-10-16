//! `build --serve`: o preview ao vivo do pptsx (cli/preview do TS) com `std::net`, sem framework.
//! Rotas: `/` (a página, a mesma do TS), `/state.json`, `/diagnostics.json`, `/svg/<tamanho>/<n>`
//! e `/events` (SSE: `update` a cada rebuild). O estado é a pasta que o build filho grava
//! (`--state-out`): `state.json`, `diagnostics.json` e `<tamanho>/<n>.svg`; o servidor só lê e
//! acrescenta a versão e o erro do último rebuild.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const PAGE: &str = include_str!("../assets/preview.html");

struct State {
    version: u64,
    dir: PathBuf,
    error: Option<String>,
}

#[derive(Clone)]
pub struct Server {
    state: Arc<Mutex<State>>,
    clients: Arc<Mutex<Vec<TcpStream>>>,
    pub port: u16,
}

fn json_string(s: &str) -> String {
    let mut out = String::new();
    crate::js::value::to_json(&crate::js::value::str_val(s), &mut out);
    out
}

fn respond(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let head = format!("HTTP/1.1 {status}\r\ncontent-type: {content_type}\r\ncache-control: no-store\r\ncontent-length: {}\r\nconnection: close\r\n\r\n", body.len());
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

/// `state.json` do filho com `version` e `error` do servidor na frente (a página fura o cache das
/// imagens pela versão e mostra o erro mantendo o resultado anterior).
fn state_json(state: &State) -> String {
    let body = std::fs::read_to_string(state.dir.join("state.json")).unwrap_or_else(|_| "{\"builtAt\":\"\",\"sizes\":[]}".into());
    let error = state.error.as_deref().map_or(String::new(), |e| format!("\"error\":{},", json_string(e)));
    let rest = body.trim_start().strip_prefix('{').unwrap_or("}");
    format!("{{\"version\":{},{error}{rest}", state.version)
}

fn handle(mut stream: TcpStream, server: &Server) {
    let mut reader = BufReader::new(stream.try_clone().expect("clone do socket"));
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return;
    }
    // Resto do cabeçalho: lido e ignorado (só o caminho importa).
    let mut header = String::new();
    while reader.read_line(&mut header).is_ok_and(|n| n > 2) {
        header.clear();
    }
    let target = line.split_whitespace().nth(1).unwrap_or("/");
    let path = target.split('?').next().unwrap_or("/");
    if path == "/" {
        return respond(&mut stream, "200 OK", "text/html; charset=utf-8", PAGE.as_bytes());
    }
    if path == "/events" {
        let _ = stream.write_all(b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ncache-control: no-store\r\nconnection: keep-alive\r\n\r\n: conectado\n\n");
        let _ = stream.flush();
        server.clients.lock().expect("clientes").push(stream);
        return;
    }
    let state = server.state.lock().expect("estado");
    if path == "/state.json" {
        let body = state_json(&state);
        return respond(&mut stream, "200 OK", "application/json", body.as_bytes());
    }
    if path == "/diagnostics.json" {
        let body = std::fs::read(state.dir.join("diagnostics.json")).unwrap_or_else(|_| b"[]".to_vec());
        return respond(&mut stream, "200 OK", "application/json", &body);
    }
    if let Some(rest) = path.strip_prefix("/svg/") {
        let mut parts = rest.splitn(2, '/');
        let (size, n) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
        // O preview do Rust não tem contornos de debug: `?debug=1` serve o mesmo SVG.
        if !size.is_empty() && !size.contains("..") && n.parse::<u32>().is_ok()
            && let Ok(body) = std::fs::read(state.dir.join(size).join(format!("{n}.svg")))
        {
            return respond(&mut stream, "200 OK", "image/svg+xml", &body);
        }
        return respond(&mut stream, "404 Not Found", "text/plain; charset=utf-8", "slide não encontrado".as_bytes());
    }
    respond(&mut stream, "404 Not Found", "text/plain; charset=utf-8", "não encontrado".as_bytes());
}

impl Server {
    /// Sobe o servidor em 127.0.0.1:`port` (0 = porta livre) e aceita conexões numa thread.
    pub fn start(port: u16, dir: PathBuf) -> std::io::Result<Server> {
        let listener = TcpListener::bind(("127.0.0.1", port))?;
        let port = listener.local_addr()?.port();
        let server = Server { state: Arc::new(Mutex::new(State { version: 0, dir, error: None })), clients: Arc::new(Mutex::new(Vec::new())), port };
        let accept = server.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let server = accept.clone();
                std::thread::spawn(move || handle(stream, &server));
            }
        });
        Ok(server)
    }

    /// Um rebuild terminou: nova versão, erro (ou nenhum) e aviso às páginas abertas.
    pub fn notify(&self, error: Option<String>) {
        let version = {
            let mut state = self.state.lock().expect("estado");
            state.version += 1;
            state.error = error;
            state.version
        };
        let message = format!("event: update\ndata: {version}\n\n");
        let mut clients = self.clients.lock().expect("clientes");
        clients.retain_mut(|c| c.write_all(message.as_bytes()).and_then(|()| c.flush()).is_ok());
    }
}
