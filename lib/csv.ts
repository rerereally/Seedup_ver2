/** Quote a cell and keep spreadsheet apps from interpreting imported text as a formula. */
export function csvCell(value: string) {
  const safe = /^(?:[\t\r\n]|\s*[=+\-@])/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
