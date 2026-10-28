import { FieldValue } from '../core-fe/field-types/renderer-context';
import { ExactNumber, stringifyExact } from './exact-json';
import { Field, Metadata, Parameter, Scalar } from './models';
export function editable(field: Field, editing: boolean): boolean {
  return !field.readOnly && !(editing && field.immutable);
}
export function fieldValue(value: Scalar | undefined): FieldValue {
  return value instanceof ExactNumber ? value.text : (value ?? null);
}
export function scalarInput(field: Parameter, value: FieldValue): Scalar {
  if (value === null) {
    if (!field.nullable) throw new Error('Null is not allowed');
    return null;
  }
  if (field.type === 'BOOLEAN') {
    if (typeof value !== 'boolean') throw new Error('Choose true or false');
    return value;
  }
  if (typeof value !== 'string') throw new Error('Text input required');
  if (field.type === 'DECIMAL') return new ExactNumber(value);
  if (/^(?:U?INT)/.test(field.type)) {
    if (!/^-?(0|[1-9][0-9]*)$/.test(value)) throw new Error('Enter an integer');
    const integer = BigInt(value);
    const bits = BigInt(field.type.replace(/\D/g, ''));
    const unsigned = field.type.startsWith('U');
    if (
      integer < (unsigned ? 0n : -(1n << (bits - 1n))) ||
      integer > (1n << (unsigned ? bits : bits - 1n)) - 1n
    )
      throw new Error('Integer out of range');
    return new ExactNumber(value);
  }
  if (field.type === 'DATE' && !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Use yyyy-MM-dd');
  if (field.enumValues.length && !field.enumValues.includes(value))
    throw new Error('Choose a declared value');
  const length = Array.from(value).length;
  for (const [key, test] of [
    ['minimumLength', (limit: number) => length < limit],
    ['maximumLength', (limit: number) => length > limit],
  ] as const) {
    const limit = field.constraints[key];
    if (limit instanceof ExactNumber && test(Number(limit.text)))
      throw new Error('Text length constraint');
  }
  // Patterns, exact numeric constraints and business rules remain server-authoritative.
  return value;
}
export function visibleField(field: Field, list = false): boolean {
  return !field.annotations.some(
    (annotation) =>
      annotation.vocabulary === 'UI' &&
      (annotation.term === 'Hidden' || (!list && annotation.term === 'FormExcluded')) &&
      annotation.value === true,
  );
}
export function orderedFields(meta: Metadata): Field[] {
  const names =
    meta.presentation?.form.tabs.flatMap((tab) =>
      tab.sections.flatMap((section) => section.groups.flatMap((group) => group.fields)),
    ) ?? [];
  return [...new Set([...names, ...meta.fields.map((field) => field.name)])]
    .map((name) => meta.fields.find((field) => field.name === name)!)
    .filter(Boolean)
    .filter((field) => visibleField(field));
}
export function same(a: unknown, b: unknown): boolean {
  return stringifyExact(a) === stringifyExact(b);
}
