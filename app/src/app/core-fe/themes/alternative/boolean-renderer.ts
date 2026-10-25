import { Component } from '@angular/core';
import { FieldRendererBase } from '../default/field-renderers';

export const BOOLEAN_CHOICES = { yes: 'yes', no: 'no', unset: '' } as const;
@Component({ selector: 'core-fe-alternative-boolean', templateUrl: './boolean.html' })
export class AlternativeBooleanRenderer extends FieldRendererBase {
  readonly choices = BOOLEAN_CHOICES;
  select(value: string): void {
    if (value === this.choices.yes) this.update(true);
    else if (value === this.choices.no) this.update(false);
    else if (value === this.choices.unset) this.update(null);
  }
}
