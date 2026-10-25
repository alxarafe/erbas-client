import { Component, Directive, computed, input, output } from '@angular/core';
import {
  FieldRenderer,
  FieldRendererContext,
  FieldValue,
} from '../../field-types/renderer-context';

@Directive()
export abstract class FieldRendererBase implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  readonly text = computed(() => {
    const value = this.context().value;
    return typeof value === 'string' ? value : '';
  });
  update(value: FieldValue): void {
    if (!this.context().disabled && !this.context().readOnly) this.valueChange.emit(value);
  }
}
@Component({ selector: 'core-fe-default-boolean', templateUrl: './boolean.html' })
export class DefaultBooleanRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-string', templateUrl: './string.html' })
export class DefaultStringRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-text', templateUrl: './text.html' })
export class DefaultTextRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-number', templateUrl: './number.html' })
export class DefaultNumberRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-date', templateUrl: './date.html' })
export class DefaultDateRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-time', templateUrl: './time.html' })
export class DefaultTimeRenderer extends FieldRendererBase {}
@Component({ selector: 'core-fe-default-enum', templateUrl: './enum.html' })
export class DefaultEnumRenderer extends FieldRendererBase {
  readonly unset = '';
  select(value: string): void {
    this.update(value === this.unset ? null : value);
  }
}
@Component({ selector: 'core-fe-default-binary', templateUrl: './binary.html' })
export class DefaultBinaryRenderer extends FieldRendererBase {}
