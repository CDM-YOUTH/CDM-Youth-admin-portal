import ExcelJS from "exceljs";

const HEADER_BG = "B91C1C"; // deep red
const HEADER_FG = "D4A840"; // gold
const ALT_ROW_BG = "FFF5F5"; // faint rose for alternate rows

export async function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CDM Youth Office";
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName);

  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(h.length + 6, 18),
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 10, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "7F1010" } },
      right: { style: "thin", color: { argb: "7F1010" } },
      left: { style: "thin", color: { argb: "7F1010" } },
      top: { style: "thin", color: { argb: "7F1010" } },
    };
  });

  // Add data rows
  rows.forEach((row, i) => {
    const dataRow = ws.addRow(row);
    dataRow.height = 16;
    const bg = i % 2 === 0 ? "FFFFFF" : ALT_ROW_BG;
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 9, name: "Calibri", color: { argb: "222222" } };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        bottom: { style: "hair", color: { argb: "E0D0D0" } },
        right: { style: "hair", color: { argb: "E0D0D0" } },
      };
    });
  });

  // Freeze the header row
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2" }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
