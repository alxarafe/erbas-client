import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeShellOutlet } from './theme-shell-outlet';
import {
  provideShellExtensions,
  SHELL_SLOTS,
  ShellExtensionDefinition,
  ShellExtensionRegistry,
  ShellSlot,
} from './shell-extensions';
import { provideThemeRuntime, ThemeService } from '../theme/theme-runtime';
import { BUILTIN_THEMES } from '../themes/themes';
import { ThemeId } from '../theme/theme-definition';

@Component({
  selector: 'test-extension',
  template: '<button type="button" class="probe">Optional tool</button>',
})
class Probe {}
@Component({ selector: 'test-a', template: '<span>A</span>' })
class A {}
@Component({ selector: 'test-b', template: '<span>B</span>' })
class B {}
@Component({ selector: 'test-c', template: '<span>C</span>' })
class C {}
@Component({
  imports: [ThemeShellOutlet],
  template: ` <core-fe-shell-outlet
      [heading]="heading"
      [content]="content"
      [footer]="footer"
      [navigation]="navigation"
    />
    <ng-template #heading><h1>Application</h1></ng-template>
    <ng-template #content
      ><label>Draft<input id="draft" /></label
      ><button id="increment" (click)="count.set(count() + 1)">
        Count {{ count() }}
      </button></ng-template
    >
    <ng-template #footer><p id="feature-footer">Application footer</p></ng-template>`,
})
class Harness {
  readonly count = signal(0);
  readonly navigation = [{ id: 'draft', label: 'Draft', href: '#draft' }];
}
const contributions: readonly ShellExtensionDefinition[] = SHELL_SLOTS.map((slot, index) => ({
  id: `probe-${index}`,
  slot,
  component: Probe,
  priority: 0,
}));
describe('Compiled shell slots', () => {
  function configure(entries = contributions) {
    TestBed.configureTestingModule({
      imports: [Harness],
      providers: [provideThemeRuntime(BUILTIN_THEMES), provideShellExtensions(entries)],
    });
  }
  it.each(Object.values(ThemeId))('preserves every required slot in %s', async (theme) => {
    configure();
    TestBed.inject(ThemeService).activate(theme);
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    for (const slot of SHELL_SLOTS)
      expect(page.querySelectorAll(`[data-shell-slot="${slot}"] .probe`).length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toBe('Application');
    expect(page.querySelector('#feature-footer')?.textContent).toBe('Application footer');
    expect(page.querySelector('nav a')?.getAttribute('href')).toBe('#draft');
    expect(page.querySelector('core-fe-shell-outlet')?.classList.contains(`theme-${theme}`)).toBe(
      true,
    );
  });
  it('keeps the shell and contributions mounted for CSS-only Vintage changes', async () => {
    configure();
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const shell = page.querySelector('core-fe-default-shell');
    const contribution = page.querySelector(`[data-shell-slot="${ShellSlot.Footer}"] .probe`);
    TestBed.inject(ThemeService).activate(ThemeId.Vintage);
    await fixture.whenStable();
    expect(page.querySelector('core-fe-default-shell')).toBe(shell);
    expect(page.querySelector(`[data-shell-slot="${ShellSlot.Footer}"] .probe`)).toBe(contribution);
  });
  it('changes structure/slot location without recreating application content', async () => {
    configure();
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    const draft = page.querySelector<HTMLInputElement>('#draft')!;
    draft.value = 'Unsaved draft';
    page.querySelector<HTMLButtonElement>('#increment')!.click();
    await fixture.whenStable();
    const themes = TestBed.inject(ThemeService);
    themes.activate(ThemeId.Cyberpunk);
    await fixture.whenStable();
    expect(page.querySelector('#draft')).toBe(draft);
    expect(draft.value).toBe('Unsaved draft');
    expect(page.querySelector('#increment')?.textContent).toContain('Count 1');
    expect(
      page.querySelector(
        `header .cyber-tools [data-shell-slot="${ShellSlot.FloatingActions}"] .probe`,
      ),
    ).not.toBeNull();
    expect(
      page.querySelector('.cyber-workspace aside core-fe-default-navigation nav ul'),
    ).not.toBeNull();
    expect(page.querySelector('.cyber-panel-content #draft')).toBe(draft);
    themes.activate(ThemeId.Default);
    await fixture.whenStable();
    expect(page.querySelector('#draft')).toBe(draft);
    expect(
      page.querySelector(`.shell-floating [data-shell-slot="${ShellSlot.FloatingActions}"] .probe`),
    ).not.toBeNull();
    expect(page.querySelector('nav ul')).not.toBeNull();
  });
  it('orders contributions by priority then stable ID, independently of registration order', async () => {
    configure([
      { id: 'last', slot: ShellSlot.TopbarActions, component: C, priority: 2 },
      { id: 'b', slot: ShellSlot.TopbarActions, component: B, priority: 1 },
      { id: 'a', slot: ShellSlot.TopbarActions, component: A, priority: 1 },
    ]);
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector(`[data-shell-slot="${ShellSlot.TopbarActions}"]`)
        ?.textContent?.replace(/\s/g, ''),
    ).toBe('ABC');
  });
  it('rejects duplicate IDs even across different slots', () => {
    configure([
      { id: 'same', slot: ShellSlot.Footer, component: A, priority: 0 },
      { id: 'same', slot: ShellSlot.TopbarActions, component: B, priority: 0 },
    ]);
    expect(() => TestBed.inject(ShellExtensionRegistry)).toThrow(/duplicate/);
  });
  it('rejects unknown slots', () => {
    configure([{ id: 'unknown', slot: 'unknown' as ShellSlot, component: A, priority: 0 }]);
    expect(() => TestBed.inject(ShellExtensionRegistry)).toThrow(/Invalid/);
  });
  it.each([
    { id: 'priority', slot: ShellSlot.Footer, component: A, priority: Number.POSITIVE_INFINITY },
    { id: 'component', slot: ShellSlot.Footer, component: class NotAComponent {}, priority: 0 },
    { id: 'invalid id', slot: ShellSlot.Footer, component: A, priority: 0 },
  ])('rejects invalid contribution $id', (entry) => {
    configure([entry]);
    expect(() => TestBed.inject(ShellExtensionRegistry)).toThrow(/Invalid/);
  });
  it('snapshots contributions and rejects unknown outlet slots', () => {
    const source = [{ id: 'stable', slot: ShellSlot.Footer, component: A, priority: 0 }];
    configure(source);
    const registry = TestBed.inject(ShellExtensionRegistry);
    source[0]!.priority = 99;
    source.length = 0;
    expect(registry.forSlot(ShellSlot.Footer)[0]!.priority).toBe(0);
    expect(() => registry.forSlot('unknown' as ShellSlot)).toThrow(/Unknown/);
  });
});
