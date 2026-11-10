/**
 * A one-page PDF with a line of text, for application file answers.
 *
 * Small enough to write by hand and valid enough for a browser's viewer: the
 * cross-reference table carries real byte offsets. Text is limited to
 * printable ASCII, escaped for a PDF string.
 */
export function minimalPdf(lines: string[]): Uint8Array {
  const escape = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/([\\()])/g, "\\$1");
  const content = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    "24 TL",
    ...lines.map((line, index) => `${index === 0 ? "" : "T* "}(${escape(line)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}
