// Linhas de texto como o renderizador quebrou, por retângulo (PDFKit). Variante da técnica do M3-F/M8-H:
// em vez de selectionsByLine (que junta vizinhos e embaralha parágrafo vazio), pega cada caractere da
// página cujo centro cai no retângulo e agrupa por linha (centro vertical), da esquerda para a direita.
// Uso: swift pdflines.swift <arquivo.pdf> <caixas.json> <largura-do-slide-pt>
// caixas: [{key, page, x, y, width, height}] em pt do slide. Saída: JSON {key: [linha, ...]}.
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count == 4, let document = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("uso: pdflines.swift <pdf> <caixas.json> <largura-do-slide-pt>\n".data(using: .utf8)!)
  exit(2)
}
let slideWidth = Double(args[3]) ?? 720
let boxes = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[2]))) as! [[String: Any]]

struct Glyph { let char: String; let bounds: CGRect; let size: Double }

var glyphsByPage: [Int: [Glyph]] = [:]
func glyphs(_ index: Int) -> [Glyph] {
  if let cached = glyphsByPage[index] { return cached }
  guard let page = document.page(at: index) else { return [] }
  // selection(for: NSRange) usa o mesmo índice para o texto e para a caixa do caractere.
  let list = (0..<page.numberOfCharacters).compactMap { i -> Glyph? in
    guard let selection = page.selection(for: NSRange(location: i, length: 1)), let char = selection.string else { return nil }
    // A caixa do PDFKit é a da linha (não do glifo): o tamanho da fonte separa rótulo e corpo na mesma faixa.
    let font = selection.attributedString?.attribute(.font, at: 0, effectiveRange: nil) as? NSFont
    return Glyph(char: char, bounds: selection.bounds(for: page), size: Double(font?.pointSize ?? 0))
  }.filter { !$0.bounds.isEmpty && $0.char.trimmingCharacters(in: .whitespacesAndNewlines) != "" }
  // A quebra de linha sintética do PDFKit devolve o último caractere da linha de novo (mesma caixa).
  let unique = list.enumerated().filter { i, glyph in
    i == 0 || !(list[i - 1].char == glyph.char && list[i - 1].bounds == glyph.bounds && list[i - 1].size == glyph.size)
  }.map(\.element)
  glyphsByPage[index] = unique
  return unique
}

var result: [String: [String]] = [:]
for box in boxes {
  let key = box["key"] as! String
  let pageIndex = box["page"] as! Int
  guard let page = document.page(at: pageIndex) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale = Double(bounds.width) / slideWidth
  let rect = CGRect(
    x: (box["x"] as! Double) * scale,
    y: Double(bounds.height) - ((box["y"] as! Double) + (box["height"] as! Double)) * scale,
    width: (box["width"] as! Double) * scale,
    height: (box["height"] as! Double) * scale)
  let fontSize = (box["fontSize"] as? Double) ?? 0
  // Centro horizontal dentro, faixa vertical sobreposta (a caixa de linha pode ser a de um vizinho maior
  // na mesma baseline) e o mesmo tamanho de fonte da amostra.
  let inside = glyphs(pageIndex).filter {
    $0.bounds.midX >= rect.minX && $0.bounds.midX <= rect.maxX && $0.bounds.intersects(rect) && abs($0.size - fontSize) < 0.6
  }
  // Linha = mesma caixa de linha do PDFKit (base da caixa a menos de 1 pt).
  var lines: [[Glyph]] = []
  for glyph in inside.sorted(by: { $0.bounds.minY > $1.bounds.minY }) {
    if let last = lines.last?.first, abs(last.bounds.minY - glyph.bounds.minY) < 1 {
      lines[lines.count - 1].append(glyph)
    } else {
      lines.append([glyph])
    }
  }
  result[key] = lines.map { $0.sorted(by: { $0.bounds.minX < $1.bounds.minX }).map(\.char).joined() }
}
print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
