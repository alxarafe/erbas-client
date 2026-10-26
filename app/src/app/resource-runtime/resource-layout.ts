import { visibleField } from './fields';
import { Component, TemplateRef, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Action, Availability, Field, Presentation, label } from './models';
export interface LayoutGroup {
  id: string;
  label?: string;
  fields: Field[];
}
export interface LayoutSection {
  id: string;
  label?: string;
  collapsible: boolean;
  initiallyCollapsed: boolean;
  actions: Action[];
  groups: LayoutGroup[];
}
export interface LayoutTab {
  id: string;
  label?: string;
  actions: Action[];
  sections: LayoutSection[];
}
export interface Layout {
  actions: Action[];
  tabs: LayoutTab[];
  fallback: Field[];
  unplacedActions: Action[];
}
// Effective capability projection is supplied by the screen. This function knows
// no claims, roles, resource identifiers or authorization rules.
export function projectLayout(
  fields: readonly Field[],
  presentation: Presentation | undefined,
  actions: readonly Action[],
): Layout {
  fields = fields.filter(visibleField);
  actions = actions.filter((action) => action.scope === 'ENTITY' && action.authorized);
  const byName = new Map(fields.map((field) => [field.name, field]));
  const placedFields = new Set<string>();
  const placedActions = new Set<string>();
  function actionRefs(names: readonly string[]): Action[] {
    return names.flatMap((name) => {
      const action = actions.find((action) => action.name === name);
      if (!action || placedActions.has(name)) return [];
      placedActions.add(name);
      return [action];
    });
  }
  const rootActions = actionRefs(presentation?.form.actions ?? []);
  const tabs = (presentation?.form.tabs ?? []).flatMap((tab) => {
    const tabActions = actionRefs(tab.actions);
    const sections = tab.sections.flatMap((section) => {
      const sectionActions = actionRefs(section.actions);
      const groups = section.groups.flatMap((group) => {
        const known = group.fields.flatMap((name) => {
          const field = byName.get(name);
          if (!field || placedFields.has(name)) return [];
          placedFields.add(name);
          return [field];
        });
        return known.length ? [{ id: group.id, label: group.label, fields: known }] : [];
      });
      return groups.length || sectionActions.length
        ? [{ ...section, groups, actions: sectionActions }]
        : [];
    });
    return sections.length || tabActions.length
      ? [{ id: tab.id, label: tab.label, sections, actions: tabActions }]
      : [];
  });
  return {
    actions: rootActions,
    tabs,
    fallback: fields.filter((field) => !placedFields.has(field.name)),
    unplacedActions: actions.filter((action) => !placedActions.has(action.name)),
  };
}
@Component({
  selector: 'app-resource-layout',
  imports: [NgTemplateOutlet],
  templateUrl: './resource-layout.html',
  styleUrl: './resource-layout.css',
})
export class ResourceLayout {
  readonly fields = input.required<Field[]>();
  readonly presentation = input<Presentation>();
  readonly actions = input<Action[]>([]);
  readonly availability = input<Availability[]>([]);
  readonly busy = input(false);
  readonly fieldTemplate = input.required<TemplateRef<{ $implicit: Field }>>();
  readonly actionSelected = output<Action>();
  readonly layout = computed(() =>
    projectLayout(this.fields(), this.presentation(), this.actions()),
  );
  readonly chosenTab = signal<string | null>(null);
  readonly activeTab = computed(
    () =>
      this.layout().tabs.find((tab) => tab.id === this.chosenTab())?.id ??
      this.layout().tabs[0]?.id ??
      null,
  );
  readonly label = label;
  available(action: Action) {
    return this.availability().some(
      (state) => state.name === action.name && state.authorized && state.available,
    );
  }
  moveTab(event: KeyboardEvent, index: number) {
    const tabs = this.layout().tabs;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.chosenTab.set(tabs[next]!.id);
    const buttons = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]');
    buttons?.[next]?.focus();
  }
}
