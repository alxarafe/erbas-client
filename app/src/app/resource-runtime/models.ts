import { ExactNumber, safeInteger } from './exact-json';
export const RESOURCE_PROTOCOL = {
  navigation: '/api/meta/navigation',
  metadata: '/api/meta/resources',
  records: '/api/resources',
  actions: '/api/resource-actions',
  etag: 'ETag',
  conditional: 'If-None-Match',
  pageSize: 50,
  maxLimit: 100,
} as const;
export type Scalar = string | boolean | ExactNumber | null;
export type Row = Record<string, Scalar>;
export type Operation = 'list' | 'get' | 'create' | 'update' | 'delete';
export interface Annotation {
  vocabulary: string;
  term: string;
  value: unknown;
}
export interface Parameter {
  name: string;
  type: string;
  nullable: boolean;
  required: boolean;
  default?: Scalar;
  constraints: Record<string, unknown>;
  enumValues: string[];
  annotations: Annotation[];
}
export interface Field extends Parameter {
  readOnly: boolean;
  immutable: boolean;
  capabilities: {
    filterable: boolean;
    sortable: boolean;
    searchable: boolean;
    filterOperators: string[];
  };
}
export interface Relation {
  name: string;
  kind: 'MANY_TO_ONE';
  targetResource: string;
  localField: string;
  targetField: string;
  displayField: string | null;
  required: boolean;
}
export interface Action {
  name: string;
  scope: 'ENTITY' | 'COLLECTION' | 'SELECTION';
  requiresSelection: boolean;
  authorized: boolean;
  annotations: Annotation[];
  parameters: Parameter[];
}
export interface Group {
  id: string;
  label?: string;
  fields: string[];
}
export interface FormSection {
  id: string;
  label?: string;
  collapsible: boolean;
  initiallyCollapsed: boolean;
  actions: string[];
  groups: Group[];
}
export interface FormTab {
  id: string;
  label?: string;
  actions: string[];
  sections: FormSection[];
}
export interface Presentation {
  form: { behavior: { unsavedChanges: string }; actions: string[]; tabs: FormTab[] };
}
export interface Metadata {
  id: string;
  version: string;
  moduleId: string;
  definitionHash: string;
  moduleEnabled: boolean;
  idDefinition: { field: string };
  operations: Record<Operation, { declared: boolean; authorized: boolean }>;
  fields: Field[];
  relations: Relation[];
  actions: Action[];
  annotations: Annotation[];
  presentation?: Presentation;
}
export interface Page {
  items: Row[];
  offset: number;
  limit: number;
  total?: number;
}
export interface Filter {
  field: string;
  operator: string;
  value: Scalar;
}
export interface Query {
  offset: number;
  limit: number;
  sort: string[];
  filters: Filter[];
  search?: string;
}
export interface Availability {
  name: string;
  authorized: boolean;
  available: boolean;
  unavailableReason?: string;
}
export type Target = { type: 'RESOURCE'; resource: string } | { type: 'ROUTE'; route: string };
export interface NavigationItem {
  id: string;
  label: string;
  order: number;
  children: NavigationItem[];
  target?: Target;
  icon?: string;
}
export interface Navigation {
  version: string;
  items: NavigationItem[];
}
export function object(value: unknown): value is Record<string, unknown> {
  return (
    !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof ExactNumber)
  );
}
export function scalar(value: unknown): value is Scalar {
  return (
    value === null || ['string', 'boolean'].includes(typeof value) || value instanceof ExactNumber
  );
}
export function row(value: unknown): Row {
  if (!object(value) || !Object.values(value).every(scalar))
    throw new Error('Invalid resource record');
  return value as Row;
}
function validPresentation(value: unknown): boolean {
  if (!object(value) || !object(value['form'])) return false;
  const form = value['form'];
  const strings = (items: unknown) =>
    Array.isArray(items) && items.every((item) => typeof item === 'string');
  const node = (value: unknown): value is Record<string, unknown> =>
    object(value) &&
    typeof value['id'] === 'string' &&
    (value['label'] === undefined || typeof value['label'] === 'string');
  return (
    object(form['behavior']) &&
    ['CONFIRM_DISCARD', 'ALLOW_DISCARD'].includes(String(form['behavior']['unsavedChanges'])) &&
    strings(form['actions']) &&
    Array.isArray(form['tabs']) &&
    form['tabs'].every(
      (tab) =>
        node(tab) &&
        strings(tab['actions']) &&
        Array.isArray(tab['sections']) &&
        tab['sections'].every(
          (section) =>
            node(section) &&
            typeof section['collapsible'] === 'boolean' &&
            typeof section['initiallyCollapsed'] === 'boolean' &&
            strings(section['actions']) &&
            Array.isArray(section['groups']) &&
            section['groups'].every((group) => node(group) && strings(group['fields'])),
        ),
    )
  );
}
export function metadata(value: unknown, resource: string): Metadata {
  if (
    !object(value) ||
    value['id'] !== resource ||
    !object(value['idDefinition']) ||
    typeof value['idDefinition']['field'] !== 'string' ||
    !object(value['operations']) ||
    !Array.isArray(value['fields']) ||
    !Array.isArray(value['relations']) ||
    !Array.isArray(value['actions']) ||
    !Array.isArray(value['annotations']) ||
    typeof value['moduleEnabled'] !== 'boolean'
  )
    throw new Error('Invalid resource metadata');
  for (const operation of ['list', 'get', 'create', 'update', 'delete']) {
    const entry = value['operations'][operation];
    if (
      !object(entry) ||
      typeof entry['declared'] !== 'boolean' ||
      typeof entry['authorized'] !== 'boolean'
    )
      throw new Error('Invalid capabilities');
  }
  for (const field of value['fields'])
    if (
      !object(field) ||
      typeof field['name'] !== 'string' ||
      typeof field['type'] !== 'string' ||
      typeof field['nullable'] !== 'boolean' ||
      typeof field['required'] !== 'boolean' ||
      typeof field['readOnly'] !== 'boolean' ||
      typeof field['immutable'] !== 'boolean' ||
      !object(field['capabilities']) ||
      !Array.isArray(field['capabilities']['filterOperators']) ||
      !Array.isArray(field['annotations']) ||
      !object(field['constraints'])
    )
      throw new Error('Invalid resource field');
  if (value['presentation'] !== undefined && !validPresentation(value['presentation']))
    throw new Error('Invalid resource presentation');
  return value as unknown as Metadata;
}
export function page(value: unknown): Page {
  if (!object(value) || !Array.isArray(value['items'])) throw new Error('Invalid resource page');
  return {
    items: value['items'].map(row),
    offset: safeInteger(value['offset']),
    limit: safeInteger(value['limit']),
    ...(Object.hasOwn(value, 'total') ? { total: safeInteger(value['total']) } : {}),
  };
}
export function navigation(value: unknown): Navigation {
  if (
    !object(value) ||
    typeof value['version'] !== 'string' ||
    !value['version'] ||
    !Array.isArray(value['items'])
  )
    throw new Error('Invalid navigation');
  const ids = new Set<string>();
  function nodes(items: unknown[]): NavigationItem[] {
    return items
      .map((item) => {
        if (
          !object(item) ||
          typeof item['id'] !== 'string' ||
          !item['id'] ||
          ids.has(item['id']) ||
          typeof item['label'] !== 'string' ||
          !item['label'] ||
          !Array.isArray(item['children'])
        )
          throw new Error('Invalid navigation item');
        ids.add(item['id']);
        let target: Target | undefined;
        if (item['target'] !== undefined) {
          const t = item['target'];
          if (!object(t)) throw new Error('Invalid target');
          if (t['type'] === 'RESOURCE' && typeof t['resource'] === 'string' && t['resource'])
            target = { type: 'RESOURCE', resource: t['resource'] };
          else if (
            t['type'] === 'ROUTE' &&
            typeof t['route'] === 'string' &&
            /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?)?$/.test(t['route'])
          )
            target = { type: 'ROUTE', route: t['route'] };
          else return null; // Unknown future targets are never executed.
        }
        const children = nodes(item['children']);
        if (target && children.length) throw new Error('Actionable navigation parent');
        if (!target && !children.length) return null;
        const order = item['order'];
        if (!(order instanceof ExactNumber) || !Number.isSafeInteger(Number(order.text)))
          throw new Error('Invalid navigation order');
        return {
          id: item['id'],
          label: item['label'],
          order: Number(order.text),
          children,
          ...(target ? { target } : {}),
          ...(typeof item['icon'] === 'string' ? { icon: item['icon'] } : {}),
        };
      })
      .filter((item): item is NavigationItem => item !== null);
  }
  return { version: value['version'], items: nodes(value['items']) };
}
export function label(value: { name?: string; id?: string; annotations: Annotation[] }): string {
  return String(
    value.annotations.find((a) => a.vocabulary === 'Common' && a.term === 'Label')?.value ??
      value.name ??
      value.id ??
      '',
  );
}
export function display(value: unknown): string {
  return value instanceof ExactNumber
    ? value.text
    : value === null || value === undefined
      ? '—'
      : String(value);
}
export function allowed(meta: Metadata, operation: Operation): boolean {
  return (
    meta.moduleEnabled &&
    meta.operations[operation].declared &&
    meta.operations[operation].authorized
  );
}
