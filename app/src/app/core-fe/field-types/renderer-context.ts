import { InputSignal, OutputEmitterRef } from '@angular/core';

// Exact numbers, dates, instants and binary values stay strings here. Transport and
// semantic validation belong to the future Resource Runtime, not to theme widgets.
export type FieldValue = string | boolean | null;
export interface FieldRendererContext {
  readonly id: string;
  readonly label: string;
  readonly value: FieldValue;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly choices?: readonly string[];
}
export interface FieldRenderer {
  readonly context: InputSignal<FieldRendererContext>;
  readonly valueChange: OutputEmitterRef<FieldValue>;
}
export const FIELD_RENDERER_BINDINGS = { context: 'context', valueChange: 'valueChange' } as const;
