/** Parágrafo `<a:p>…</a:p>` completo, como aparece no XML do slide. */
export type ParagraphXml = string;
/** Parágrafos `<a:p>` do XML, em ordem de documento (sem aninhamento: OOXML não aninha `<a:p>`). */
export declare const paragraphsOf: (xml: string) => readonly ParagraphXml[];
/** Remove de um corpo de parágrafo todo `<a:pPr>` depois do primeiro; o resto fica intacto e na ordem. */
export declare const keepFirstPropsOfBody: (body: string) => string;
/** Aplica `keepFirstPropsOfBody` a um único `<a:p>…</a:p>`. */
export declare const sanitizeParagraph: (paragraph: ParagraphXml) => ParagraphXml;
/**
 * O pptxgenjs repete <a:pPr> antes de cada run, inclusive depois de <a:br/>.
 * O schema OOXML só aceita pPr como primeiro filho de <a:p>; o Keynote tolera,
 * mas o PowerPoint pode exigir "reparar" o arquivo. Mantém só o primeiro.
 */
export declare const keepFirstParagraphProps: (xml: string) => string;
/**
 * O pptxgenjs grava <p:sldIdLst> antes de <p:notesMasterIdLst>; o CT_Presentation
 * pede o contrário (sldMasterIdLst, notesMasterIdLst, handoutMasterIdLst, sldIdLst).
 * O Keynote ignora, mas o PowerPoint pode pedir "reparar". Já na ordem → intacto.
 */
export declare const reorderPresentationLists: (xml: string) => string;
/**
 * M14: ponto sem valor (scatter com x que a série não tem) sai como `<c:v></c:v>`, que o Keynote lê
 * como 0. No OOXML o ponto ausente é omitido do cache.
 */
export declare const dropEmptyChartPoints: (xml: string) => string;
/**
 * O pptxgenjs 4.0.1 grava `ref="A1:B4'"` (apóstrofo sobrando) na tabela do xlsx de
 * bar/line/pie; com isso o Keynote descarta o gráfico e o slide fica vazio (M10-spike).
 */
export declare const fixTableRef: (xml: string) => string;
/** Aplica `fixTableRef` a cada xl/tables/*.xml de um xlsx (zip dentro do zip). */
export declare const fixEmbeddedWorkbook: (workbook: Uint8Array) => Promise<Uint8Array>;
/** Pós-processa slides, presentation.xml, numeração dos gráficos e os xlsx embutidos do .pptx gerado. */
export declare const sanitizePptx: (buffer: Buffer) => Promise<Buffer>;
