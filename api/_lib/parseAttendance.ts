export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) { text = text.slice(1); }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    field = '';
    // A blank line parses as a single empty field -- drop it instead of
    // surfacing it as a phantom attendee row.
    if (row.some((f) => f !== '')) { rows.push(row); }
    row = [];
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // "" inside a quoted field is an escaped literal quote.
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      // Everything else -- including commas and newlines -- is literal
      // field content while inside quotes.
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\n') {
      endRow();
      i += 1;
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') { i += 1; }
      endRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }

  if (field !== '' || row.length > 0) { endRow(); }

  return rows;
}

export type AttendanceValidation =
  | { ok: true; attendeeCount: number }
  | { ok: false; reason: string };

// Admission check for uploaded attendance lists: anything a spreadsheet
// app exports should parse (quoted commas/newlines, "" escapes), and we
// only care that there's a header line plus at least one data row -- the
// form in PR 9 renders names/emails straight from the file, it doesn't
// require any particular column layout.
export function validateAttendanceCsv(text: string): AttendanceValidation {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ok: false, reason: 'CSV must include a header row and at least one attendee row' };
  }
  if (rows.length === 1) {
    return { ok: false, reason: 'CSV must include at least one attendee row below the header' };
  }
  return { ok: true, attendeeCount: rows.length - 1 };
}
