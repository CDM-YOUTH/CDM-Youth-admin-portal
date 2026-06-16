import ExcelJS from "exceljs";

const HEADER_BG = "B91C1C";
const HEADER_FG_DEFAULT = "D4A840"; // gold — free-text columns
const HEADER_FG_DROPDOWN = "FFFFFF"; // white — selectable/dropdown columns
const ALT_ROW_BG = "FFF5F5";

// Simple flat dropdown: header → allowed values
export type FlatDropdowns = Record<string, string[]>;

// Cascading dropdown: child column header → { parent column header, map of parentValue → childValues }
export type CascadeDropdowns = Record<string, { parent: string; map: Record<string, string[]> }>;

export type DropdownConfig = {
  flat?: FlatDropdowns;
  cascade?: CascadeDropdowns;
};

// Column index (1-based) → Excel letter(s)
function colLetter(n: number): string {
  let s = "";
  let remaining = n;
  while (remaining > 0) {
    const r = (remaining - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return s;
}

// Convert a human-readable name to a valid Excel named-range identifier.
// Must match what the Excel INDIRECT formula produces from the cell value.
function toRangeName(name: string): string {
  return name
    .replace(/['‘’ʼ′]/g, "") // remove apostrophes
    .replace(/[\s\-]+/g, "_")                     // spaces & hyphens → underscore
    .replace(/[^a-zA-Z0-9_]/g, "_")              // anything else → underscore
    .replace(/_+/g, "_")                          // collapse runs
    .replace(/^_|_$/g, "");                       // trim edges
}

// The Excel formula that turns a cell value into the same identifier toRangeName() produces.
// Applied to the parent-column cell reference (e.g. "G2") so INDIRECT can look up the named range.
function indirectFormula(cellRef: string): string {
  // Strip both ASCII apostrophe (CHAR 39) and Windows-1252 right-single-quote (CHAR 146),
  // then spaces → _, hyphens → _
  return (
    `INDIRECT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(` +
    `${cellRef},CHAR(39),""),CHAR(146),"")," ","_"),"-","_"))`
  );
}

type DvAdd = (range: string, rule: object) => void;

export async function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][],
  dropdownConfig?: DropdownConfig,
  options?: { headerTextColor?: string },
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

  // Columns that have any kind of dropdown get white header text
  const dropdownHeaders = new Set<string>([
    ...Object.keys(dropdownConfig?.flat ?? {}),
    ...Object.keys(dropdownConfig?.cascade ?? {}),
    ...Object.values(dropdownConfig?.cascade ?? {}).map((c) => c.parent),
  ]);

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell, colNum) => {
    const header = headers[colNum - 1];
    const isDropdown = !!header && dropdownHeaders.has(header);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.font = {
      bold: true,
      color: { argb: options?.headerTextColor ?? (isDropdown ? HEADER_FG_DROPDOWN : HEADER_FG_DEFAULT) },
      size: 10,
      name: "Calibri",
    };
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

  // Build dropdown validations
  if (dropdownConfig) {
    const flat = dropdownConfig.flat ?? {};
    const cascade = dropdownConfig.cascade ?? {};

    const flatEntries = Object.entries(flat).filter(
      ([h, v]) => headers.includes(h) && v.length > 0,
    );
    const cascadeEntries = Object.entries(cascade).filter(
      ([childH, { parent, map }]) =>
        headers.includes(childH) &&
        headers.includes(parent) &&
        Object.keys(map).length > 0,
    );

    if (flatEntries.length > 0 || cascadeEntries.length > 0) {
      const listsWs = wb.addWorksheet("Lookups");
      listsWs.state = "veryHidden";

      let lookupCol = 1; // next free column in Lookups sheet
      const dvWs = ws as unknown as { dataValidations: { add: DvAdd } };

      // --- Flat dropdowns (direct cell-range reference) ---
      for (const [header, values] of flatEntries) {
        const mainColIdx = headers.indexOf(header) + 1;
        const listColIdx = lookupCol++;

        values.forEach((val, rowIdx) => {
          listsWs.getCell(rowIdx + 1, listColIdx).value = val;
        });

        const mainCol = colLetter(mainColIdx);
        const listCol = colLetter(listColIdx);

        dvWs.dataValidations.add(`${mainCol}2:${mainCol}10000`, {
          type: "list",
          allowBlank: true,
          formulae: [`Lookups!$${listCol}$1:$${listCol}$${values.length}`],
          showErrorMessage: true,
          errorStyle: "information",
          errorTitle: "Suggestion",
          error: "Select a value from the dropdown list.",
        });
      }

      // --- Cascade dropdowns (INDIRECT + named ranges) ---
      for (const [childHeader, { parent, map }] of cascadeEntries) {
        const childColIdx = headers.indexOf(childHeader) + 1;
        const parentColIdx = headers.indexOf(parent) + 1;
        const childMainCol = colLetter(childColIdx);
        const parentMainCol = colLetter(parentColIdx);

        // Write each parent value's children in a Lookups column; create a named range
        for (const [parentVal, childVals] of Object.entries(map)) {
          if (childVals.length === 0) continue;
          const listColIdx = lookupCol++;

          childVals.forEach((val, rowIdx) => {
            listsWs.getCell(rowIdx + 1, listColIdx).value = val;
          });

          const listCol = colLetter(listColIdx);
          const rangeName = toRangeName(parentVal);
          wb.definedNames.add(
            `Lookups!$${listCol}$1:$${listCol}$${childVals.length}`,
            rangeName,
          );
        }

        // INDIRECT picks the named range matching the sanitized parent-cell value
        dvWs.dataValidations.add(`${childMainCol}2:${childMainCol}10000`, {
          type: "list",
          allowBlank: true,
          formulae: [indirectFormula(`${parentMainCol}2`)],
          showErrorMessage: true,
          errorStyle: "information",
          errorTitle: "Suggestion",
          error: "Select the parent value first, then choose from this dropdown.",
        });
      }
    }
  }

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
