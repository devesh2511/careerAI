Vendored, unmodified except where noted. Loaded on demand by "Save this chat" (scripts/script.js).

- jspdf.umd.min.js — jsPDF 4.2.1 (MIT), npm `jspdf` dist/; sourceMappingURL line removed
- html2canvas.min.js — html2canvas 1.4.1 (MIT), npm `html2canvas` dist/
- pdf-text-font.js — the font of the PDF's invisible text layer, as base64 in `window.CHAT_PDF_FONT`.
  Noto Sans 2.015 and Noto Sans Devanagari 2.007 (SIL OFL 1.1, see OFL-noto.txt), unhinted TTFs from
  github.com/notofonts/notofonts.github.io. Made with fontTools: each subset with GSUB/GPOS/GDEF and
  hinting dropped, Noto Sans to U+0020–007E, 00A0–024F, 2000–206F, 20A0–20CF, 2100–215F, 2190–21FF,
  2212, Noto Sans Devanagari to U+0900–097F, 1CD0–1CFF, A8E0–A8FF, 200C, 200D, 25CC; then
  `fontTools.merge.Merger` (Noto Sans first) and renamed CrackeerPdfText. If the ranges change, change
  `CHAT_PDF_NO_GLYPH` in scripts/script.js to match.
