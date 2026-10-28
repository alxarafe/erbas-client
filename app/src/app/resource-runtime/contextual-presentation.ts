import {
  Action,
  ContextPresentation,
  Field,
  FormMode,
  Metadata,
  Presentation,
  PresentationDocument,
  label,
  object,
} from './models';
import { orderedFields, visibleField } from './fields';

export const CONTEXT_SCOPES: Record<FormMode | 'list', Action['scope'][]> = {
  create: ['COLLECTION'],
  edit: ['ENTITY'],
  view: ['ENTITY'],
  list: ['COLLECTION', 'SELECTION'],
};
function invalid(): never {
  throw new Error('Invalid contextual presentation');
}
function closed(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  if (
    !object(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => ![...required, ...optional].includes(key))
  )
    invalid();
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || /[<>\u0000-\u001f\u007f]/u.test(value))
    invalid();
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) invalid();
}
function references(
  value: unknown,
  known: ReadonlySet<string>,
  seen: Set<string>,
): asserts value is string[] {
  if (!Array.isArray(value)) invalid();
  for (const name of value) {
    if (typeof name !== 'string' || !known.has(name) || seen.has(name)) invalid();
    seen.add(name);
  }
}
function form(value: unknown, meta: Metadata, mode: FormMode): void {
  closed(value, ['behavior', 'actions', 'tabs']);
  closed(value['behavior'], ['unsavedChanges']);
  if (
    typeof value['behavior']['unsavedChanges'] !== 'string' ||
    !['CONFIRM_DISCARD', 'ALLOW_DISCARD'].includes(value['behavior']['unsavedChanges'])
  )
    invalid();
  const fields = new Set(meta.fields.map((field) => field.name)),
    seenFields = new Set<string>(),
    seenActions = new Set<string>();
  const actions = new Set(
    meta.actions
      .filter((action) => CONTEXT_SCOPES[mode].includes(action.scope))
      .map((action) => action.name),
  );
  const actionRefs = (names: unknown) => references(names, actions, seenActions);
  const nodes = (value: unknown, required: string[]): Record<string, unknown>[] => {
    if (!Array.isArray(value)) invalid();
    for (const node of value) {
      closed(node, ['id', ...required], ['label']);
      text(node['id']);
      if (Object.hasOwn(node, 'label')) text(node['label']);
    }
    unique(value.map((node) => node.id));
    return value;
  };
  actionRefs(value['actions']);
  for (const tab of nodes(value['tabs'], ['actions', 'sections'])) {
    actionRefs(tab['actions']);
    for (const section of nodes(tab['sections'], [
      'collapsible',
      'initiallyCollapsed',
      'actions',
      'groups',
    ])) {
      if (
        typeof section['collapsible'] !== 'boolean' ||
        typeof section['initiallyCollapsed'] !== 'boolean' ||
        (section['initiallyCollapsed'] && !section['collapsible'])
      )
        invalid();
      actionRefs(section['actions']);
      for (const group of nodes(section['groups'], ['fields']))
        references(group['fields'], fields, seenFields);
    }
  }
}
export function presentationDocument(value: unknown, meta: Metadata): PresentationDocument {
  closed(value, ['id', 'definitionHash', 'presentation']);
  if (value['id'] !== meta.id || value['definitionHash'] !== meta.definitionHash) invalid();
  const contexts = value['presentation'];
  closed(contexts, [], ['list', 'create', 'edit', 'view']);
  for (const mode of ['create', 'edit', 'view'] as const)
    if (Object.hasOwn(contexts, mode)) form(contexts[mode], meta, mode);
  if (Object.hasOwn(contexts, 'list')) {
    const list = contexts['list'];
    closed(list, ['columns', 'actions']);
    if (!Array.isArray(list['columns'])) invalid();
    const seen = new Set<string>(),
      fields = new Set(meta.fields.map((field) => field.name));
    for (const column of list['columns']) {
      closed(column, ['field'], ['label']);
      references([column['field']], fields, seen);
      if (Object.hasOwn(column, 'label')) text(column['label']);
    }
    references(
      list['actions'],
      new Set(
        meta.actions
          .filter((action) => CONTEXT_SCOPES.list.includes(action.scope))
          .map((action) => action.name),
      ),
      new Set(),
    );
  }
  return value as unknown as PresentationDocument;
}
export function resolveForm(
  meta: Metadata,
  contexts: ContextPresentation | undefined,
  mode: FormMode,
): { fields: Field[]; presentation?: Presentation } {
  if (contexts && Object.hasOwn(contexts, mode)) {
    const form = contexts[mode]!;
    const names = form.tabs.flatMap((tab) =>
      tab.sections.flatMap((section) => section.groups.flatMap((group) => group.fields)),
    );
    return {
      fields: names
        .map((name) => meta.fields.find((field) => field.name === name)!)
        .filter((field) => visibleField(field)),
      presentation: { form },
    };
  }
  return { fields: orderedFields(meta), presentation: meta.presentation };
}
export function resolveColumns(
  meta: Metadata,
  contexts?: ContextPresentation,
): { field: Field; label: string }[] {
  const columns: { field: string; label?: string }[] =
    contexts?.list?.columns ?? meta.fields.map((field) => ({ field: field.name }));
  return columns
    .map((column) => ({
      field: meta.fields.find((field) => field.name === column.field)!,
      label: column.label ?? label(meta.fields.find((field) => field.name === column.field)!),
    }))
    .filter((column) => visibleField(column.field, true));
}
export function contextActions(
  meta: Metadata,
  mode: FormMode | 'list',
  placements: string[] = [],
): Action[] {
  const eligible = meta.moduleEnabled
    ? meta.actions.filter(
        (action) => action.authorized && CONTEXT_SCOPES[mode].includes(action.scope),
      )
    : [];
  return [
    ...placements.flatMap((name) => eligible.filter((action) => action.name === name)),
    ...eligible.filter((action) => !placements.includes(action.name)),
  ];
}
