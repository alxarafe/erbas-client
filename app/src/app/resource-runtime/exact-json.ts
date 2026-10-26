// Preserve numeric lexemes before they reach Number; no numeric dependency or
// runtime code generation. JSON strings are decoded by the native JSON parser.
const MAX_JSON_NESTING = 64;
const JSON_NUMBER_TOKEN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/;
export class ExactNumber {
  constructor(readonly text: string) {
    if (JSON_NUMBER_TOKEN.exec(text)?.[0] !== text || text.length === 0)
      throw new Error('Invalid JSON number');
  }
}
export function parseExact(text: string): unknown {
  let at = 0;
  function whitespace() {
    while (/[\t\n\r ]/.test(text[at] ?? 'x')) at++;
  }
  function value(depth = 0): unknown {
    if (depth > MAX_JSON_NESTING) throw new Error('JSON nesting limit');
    whitespace();
    const start = at;
    if (text[at] === '"') {
      at++;
      while (at < text.length) {
        if (text[at++] === '"') return JSON.parse(text.slice(start, at));
        if (text[at - 1] === '\\') at++;
      }
      throw new Error('Unterminated string');
    }
    if (text[at] === '{') {
      at++;
      whitespace();
      const entries: [string, unknown][] = [];
      const keys = new Set<string>();
      if (text[at] === '}') {
        at++;
        return {};
      }
      while (true) {
        whitespace();
        if (text[at] !== '"') throw new Error('Invalid object key');
        const key = value(depth + 1) as string;
        whitespace();
        if (text[at++] !== ':' || keys.has(key)) throw new Error('Invalid or duplicate key');
        keys.add(key);
        entries.push([key, value(depth + 1)]);
        whitespace();
        const end = text[at++];
        if (end === '}') return Object.fromEntries(entries);
        if (end !== ',') throw new Error('Invalid object');
      }
    }
    if (text[at] === '[') {
      at++;
      whitespace();
      const items: unknown[] = [];
      if (text[at] === ']') {
        at++;
        return items;
      }
      while (true) {
        items.push(value(depth + 1));
        whitespace();
        const end = text[at++];
        if (end === ']') return items;
        if (end !== ',') throw new Error('Invalid array');
      }
    }
    for (const [token, result] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const)
      if (text.startsWith(token, at)) {
        at += token.length;
        return result;
      }
    const match = JSON_NUMBER_TOKEN.exec(text.slice(at));
    if (!match) throw new Error('Invalid JSON');
    at += match[0].length;
    return new ExactNumber(match[0]);
  }
  const result = value();
  whitespace();
  if (at !== text.length) throw new Error('Trailing JSON');
  return result;
}
export function stringifyExact(value: unknown): string {
  if (value instanceof ExactNumber) return value.text;
  if (Array.isArray(value)) return '[' + value.map(stringifyExact).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .map(([k, v]) => JSON.stringify(k) + ':' + stringifyExact(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function safeInteger(value: unknown): number {
  if (!(value instanceof ExactNumber) || !/^(0|[1-9][0-9]*)$/.test(value.text))
    throw new Error('Invalid page number');
  const number = Number(value.text);
  if (!Number.isSafeInteger(number)) throw new Error('Page number exceeds client range');
  return number;
}
