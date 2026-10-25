import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldRendererOutlet } from './field-renderer-outlet';
import { FieldRendererContext, FieldValue } from './renderer-context';
import { NORMALIZED_FIELD_TYPES } from './normalized-field-types';
import { BUILTIN_THEMES } from '../themes/themes';
import { provideThemeRuntime, ThemeService } from '../theme/theme-runtime';
import { ThemeId } from '../theme/theme-definition';
import { BOOLEAN_CHOICES } from '../themes/alternative/boolean-renderer';

@Component({
  imports: [FieldRendererOutlet],
  template:
    '<core-fe-field-renderer [type]="type()" [context]="context()" (valueChange)="value.set($event)" />',
})
class Harness {
  readonly type = signal('STRING');
  readonly context = signal<FieldRendererContext>({
    id: 'field-probe',
    label: 'Value',
    value: null,
  });
  readonly value = signal<FieldValue>(null);
}
describe('Normalized renderer outlet', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Harness],
      providers: [provideThemeRuntime(BUILTIN_THEMES)],
    }),
  );
  it.each(NORMALIZED_FIELD_TYPES.map((type) => type.id))(
    'renders an accessible default %s artifact',
    async (id) => {
      const fixture = TestBed.createComponent(Harness);
      fixture.componentInstance.type.set(id);
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      expect(page.querySelector('label')?.getAttribute('for')).toBe('field-probe');
      expect(page.querySelector('#field-probe')).not.toBeNull();
    },
  );
  it('selects checkbox vs select through the theme, emitting semantic booleans', async () => {
    const fixture = TestBed.createComponent(Harness);
    const host = fixture.componentInstance;
    host.type.set('BOOLEAN');
    host.context.set({ id: 'field-probe', label: 'Enabled', value: true });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const checkbox = page.querySelector<HTMLInputElement>('input')!;
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(host.value()).toBe(false);
    TestBed.inject(ThemeService).activate(ThemeId.Alternative);
    await fixture.whenStable();
    const select = page.querySelector<HTMLSelectElement>('select')!;
    expect(select.value).toBe(BOOLEAN_CHOICES.yes);
    select.value = BOOLEAN_CHOICES.no;
    select.dispatchEvent(new Event('change'));
    expect(host.value()).toBe(false);
    select.value = BOOLEAN_CHOICES.unset;
    select.dispatchEvent(new Event('change'));
    expect(host.value()).toBeNull();
    TestBed.inject(ThemeService).activate(ThemeId.Cyberpunk);
    await fixture.whenStable();
    expect(page.querySelector<HTMLInputElement>('input')?.type).toBe('checkbox');
  });
  it('preserves exact numeric text and propagates context without semantic coercion', async () => {
    const fixture = TestBed.createComponent(Harness);
    const host = fixture.componentInstance;
    host.type.set('DECIMAL');
    const exact = '123456789012345678901234567890.123456789';
    host.context.set({ id: 'field-probe', label: 'Amount', value: exact });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const input = page.querySelector<HTMLInputElement>('input')!;
    expect(input.type).toBe('text');
    expect(input.value).toBe(exact);
    input.value = exact + '1';
    input.dispatchEvent(new Event('input'));
    expect(host.value()).toBe(exact + '1');
    host.context.set({ ...host.context(), readOnly: true, label: 'Read-only amount' });
    await fixture.whenStable();
    expect(page.querySelector<HTMLInputElement>('input')?.readOnly).toBe(true);
    expect(page.querySelector('label')?.textContent).toBe('Read-only amount');
  });
  it('initializes and updates native enum selection without Angular Forms', async () => {
    const fixture = TestBed.createComponent(Harness);
    const host = fixture.componentInstance;
    host.type.set('ENUM');
    host.context.set({
      id: 'field-probe',
      label: 'State',
      value: 'closed',
      choices: ['open', 'closed'],
    });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLSelectElement>('select')!.value).toBe('closed');
    host.context.set({ ...host.context(), value: 'open' });
    await fixture.whenStable();
    const control = page.querySelector<HTMLSelectElement>('select')!;
    expect(control.value).toBe('open');
    control.value = '';
    control.dispatchEvent(new Event('change'));
    expect(host.value()).toBeNull();
  });
  it.each([ThemeId.Default, ThemeId.Alternative])(
    'honors disabled/read-only boolean state in %s',
    async (theme) => {
      TestBed.inject(ThemeService).activate(theme);
      const fixture = TestBed.createComponent(Harness);
      const host = fixture.componentInstance;
      host.type.set('BOOLEAN');
      host.context.set({ id: 'field-probe', label: 'Enabled', value: true, readOnly: true });
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      const control = page.querySelector<HTMLInputElement | HTMLSelectElement>('#field-probe')!;
      expect(control.disabled).toBe(true);
      control.dispatchEvent(new Event('change'));
      expect(host.value()).toBeNull();
    },
  );
});
