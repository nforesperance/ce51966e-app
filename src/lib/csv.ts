// Minimal RFC-4180-ish CSV parser. Handles quoted fields, embedded commas,
// doubled quotes ("") inside quoted values, \r\n or \n row separators.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.some((v) => v.length)) rows.push(row);
        row = [];
      } else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export type CsvUserRow = { full_name: string; phone: string; whatsapp: string; level: string };

export function csvToUsers(text: string): { rows: CsvUserRow[]; errors: string[] } {
  const table = parseCsv(text.trim());
  if (table.length === 0) return { rows: [], errors: ["Empty CSV"] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.findIndex((h) => ["full_name", "name"].includes(h)),
    phone: header.findIndex((h) => h === "phone"),
    whatsapp: header.findIndex((h) => ["whatsapp", "wa"].includes(h)),
    level: header.findIndex((h) => h === "level"),
  };
  if (idx.name === -1) return { rows: [], errors: ["CSV must have a 'name' or 'full_name' column"] };
  const rows: CsvUserRow[] = [];
  const errors: string[] = [];
  for (let r = 1; r < table.length; r++) {
    const raw = table[r];
    const name = (raw[idx.name] ?? "").trim();
    if (!name) { errors.push(`Row ${r + 1}: missing name`); continue; }
    rows.push({
      full_name: name,
      phone: (idx.phone >= 0 ? raw[idx.phone] ?? "" : "").trim(),
      whatsapp: (idx.whatsapp >= 0 ? raw[idx.whatsapp] ?? "" : "").trim(),
      level: (idx.level >= 0 ? raw[idx.level] ?? "" : "").trim(),
    });
  }
  return { rows, errors };
}
