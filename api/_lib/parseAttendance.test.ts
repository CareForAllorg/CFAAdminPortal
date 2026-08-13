import { describe, expect, it } from 'vitest';
import { parseCsv, validateAttendanceCsv } from './parseAttendance.js';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('name,email\nAlice,a@x.com\nBob,b@x.com')).toEqual([
      ['name', 'email'],
      ['Alice', 'a@x.com'],
      ['Bob', 'b@x.com'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('"Doe, Jane",jane@example.com\n"O\'Brien, Liam",liam@x.com\n')).toEqual([
      ['Doe, Jane', 'jane@example.com'],
      ["O'Brien, Liam", 'liam@x.com'],
    ]);
  });

  it('unescapes "" inside quoted fields', () => {
    expect(parseCsv('"He said ""hello""",note\n')).toEqual([['He said "hello"', 'note']]);
  });

  it('keeps embedded newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",col2\n')).toEqual([['line1\nline2', 'col2']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('name,email\r\nAlice,a@x.com\r\n')).toEqual([
      ['name', 'email'],
      ['Alice', 'a@x.com'],
    ]);
  });

  it('drops blank lines', () => {
    expect(parseCsv('name,email\n\n\nAlice,a@x.com\n\n')).toEqual([
      ['name', 'email'],
      ['Alice', 'a@x.com'],
    ]);
  });

  it('strips a leading BOM', () => {
    expect(parseCsv('\uFEFFname,email\nAlice,a@x.com\n')).toEqual([
      ['name', 'email'],
      ['Alice', 'a@x.com'],
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('does not invent a trailing empty row', () => {
    expect(parseCsv('name,email\n')).toEqual([['name', 'email']]);
  });
});

describe('validateAttendanceCsv', () => {
  it('reports the attendee (data row) count', () => {
    expect(validateAttendanceCsv('name,email\nAlice,a@x.com\nBob,b@x.com\nCarol,c@x.com')).toEqual({
      ok: true,
      attendeeCount: 3,
    });
  });

  it('rejects a header-only file', () => {
    const result = validateAttendanceCsv('name,email\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/at least one attendee/);
    }
  });

  it('rejects empty input', () => {
    const result = validateAttendanceCsv('');
    expect(result.ok).toBe(false);
  });

  it('ignores blank lines between data rows when counting', () => {
    expect(validateAttendanceCsv('name,email\n\nAlice,a@x.com\n\nBob,b@x.com\n')).toEqual({
      ok: true,
      attendeeCount: 2,
    });
  });
});
