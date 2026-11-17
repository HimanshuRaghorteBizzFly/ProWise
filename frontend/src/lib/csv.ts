/**
 * Safe CSV Exporter with Formula Injection Mitigation (OWASP & Blueprint V1.1)
 *
 * If a cell string starts with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote (')
 * to prevent spreadsheet calculation vulnerabilities.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // OWASP Formula injection defense: check leading dangerous character
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape internal double quotes by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function generateCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerRow = headers.map(sanitizeCsvCell).join(",");
  const dataRows = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerRow, ...dataRows].join("\r\n");
}

export function exportToSafeCSV<T extends Record<string, any>>(data: T[], fields: (keyof T)[]): string {
  const headers = fields.map(String);
  const rows = data.map((item) => fields.map((f) => item[f]));
  return generateCsv(headers, rows);
}


export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

