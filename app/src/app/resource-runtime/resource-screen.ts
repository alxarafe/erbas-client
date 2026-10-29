import { HttpStatusCode } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Subscription, switchMap, map } from 'rxjs';
import { ResourceForm } from './resource-form';
import {
  Action,
  ActionTarget,
  ContextPresentation,
  Availability,
  Field,
  Filter,
  Metadata,
  NavigationItem,
  Page,
  Query,
  Row,
  Scalar,
  allowed,
  display,
  label,
  RESOURCE_PROTOCOL as P,
} from './models';
import { RuntimeClient, RuntimeFailure, failureMessage, translateFailure } from './runtime-client';
import {
  contextActions,
  CONTEXT_SCOPES,
  resolveForm,
  resolveColumns,
} from './contextual-presentation';
import { orderedFields, scalarInput } from './fields';
@Component({
  selector: 'app-generic-resource',
  imports: [ResourceForm],
  templateUrl: './resource-screen.html',
})
export class ResourceScreen {
  readonly resource = input.required<string>();
  readonly client = inject(RuntimeClient);
  readonly meta = signal<Metadata | null>(null);
  readonly contexts = signal<ContextPresentation | undefined>(undefined);
  readonly page = signal<Page | null>(null);
  readonly error = signal<RuntimeFailure | null>(null);
  readonly busy = signal(false);
  readonly selected = signal<Row | null>(null);
  readonly editing = signal(false);
  readonly viewing = signal(false);
  readonly deleting = signal<Row | null>(null);
  readonly action = signal<Action | null>(null);
  readonly availability = signal<Availability[]>([]);
  readonly listAvailability = signal<Availability[]>([]);
  readonly selection = signal<Row[]>([]);
  readonly listActions = computed(() =>
    this.meta() ? contextActions(this.meta()!, 'list', this.contexts()?.list?.actions) : [],
  );
  readonly hasSelectionActions = computed(() =>
    this.listActions().some((action) => action.scope === 'SELECTION'),
  );
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly query = signal<Query>({ offset: 0, limit: P.pageSize, sort: [], filters: [] });
  readonly filters = signal<
    { field: string; operator: string; value: string; nullValue: boolean }[]
  >([]);
  readonly title = computed(() => {
    const find = (items: NavigationItem[]): string | undefined => {
      for (const item of items) {
        if (item.target?.type === 'RESOURCE' && item.target.resource === this.resource())
          return item.label;
        const child = find(item.children);
        if (child) return child;
      }
      return undefined;
    };
    return (
      find(this.client.navigation()?.items ?? []) ??
      (this.meta() ? label(this.meta()!) : this.resource())
    );
  });
  readonly label = label;
  readonly display = display;
  readonly allowed = allowed;
  readonly failureMessage = failureMessage;
  readonly orderedFields = orderedFields;
  readonly mode = computed(() =>
    this.viewing() ? ('view' as const) : this.selected() ? ('edit' as const) : ('create' as const),
  );
  readonly form = computed(() =>
    this.meta() ? resolveForm(this.meta()!, this.contexts(), this.mode()) : { fields: [] },
  );
  readonly formFields = computed(() => this.form().fields);
  readonly scopes = computed(() => CONTEXT_SCOPES[this.mode()]);
  readonly presentedActions = computed(() =>
    this.meta() ? contextActions(this.meta()!, this.mode()) : [],
  );
  readonly parameterFields = computed(() => (this.action() ? this.parameters(this.action()!) : []));
  private requests = new Subscription();
  private listRequests = new Subscription();
  private loadRequest?: Subscription;
  constructor() {
    effect(() => {
      const resource = this.resource(),
        key = this.client.key();
      untracked(() => {
        this.requests.unsubscribe();
        this.listRequests.unsubscribe();
        this.requests = new Subscription();
        this.loadRequest?.unsubscribe();
        this.error.set(null);
        this.fieldErrors.set({});
        this.availability.set([]);
        this.listAvailability.set([]);
        this.selection.set([]);
        this.busy.set(false);
        this.meta.set(null);
        this.contexts.set(undefined);
        this.page.set(null);
        this.selected.set(null);
        this.editing.set(false);
        this.viewing.set(false);
        this.action.set(null);
        this.deleting.set(null);
        this.query.set({ offset: 0, limit: P.pageSize, sort: [], filters: [] });
        this.filters.set([]);
        if (!key) return;
        this.requests.add(
          this.client
            .metadata(resource)
            .pipe(
              switchMap((meta) =>
                this.client.presentation(meta).pipe(map((document) => ({ meta, document }))),
              ),
            )
            .subscribe({
              next: ({ meta, document }) => {
                this.contexts.set(document?.presentation);
                this.meta.set(meta);
                this.load();
              },
              error: (error) => this.representationFailed(error),
            }),
        );
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.requests.unsubscribe();
      this.listRequests.unsubscribe();
      this.loadRequest?.unsubscribe();
    });
  }
  refreshMetadata() {
    if (this.editing() || this.action()) return;
    this.error.set(null);
    this.busy.set(true);
    this.requests.add(
      this.client
        .metadata(this.resource(), true)
        .pipe(
          switchMap((meta) =>
            this.client.presentation(meta, true).pipe(map((document) => ({ meta, document }))),
          ),
        )
        .subscribe({
          next: ({ meta, document }) => {
            this.contexts.set(document?.presentation);
            this.meta.set(meta);
            this.busy.set(false);
            if (!allowed(meta, 'list')) this.page.set(null);
            else this.load();
            if (this.selected()) this.refreshAvailability();
          },
          error: (error) => this.representationFailed(error),
        }),
    );
  }
  hasSearch(meta: Metadata) {
    return meta.fields.some((field) => field.capabilities.searchable);
  }
  columns(meta: Metadata) {
    return resolveColumns(meta, this.contexts()).map((column) => column.field);
  }
  columnLabel(field: Field) {
    return resolveColumns(this.meta()!, this.contexts()).find(
      (column) => column.field.name === field.name,
    )!.label;
  }
  removeFilter(index: number) {
    this.filters.update((filters) => filters.filter((_, i) => i !== index));
  }
  previous(offset: number, limit: number) {
    return Math.max(0, offset - limit);
  }
  load() {
    const meta = this.meta();
    if (!meta || !allowed(meta, 'list')) return;
    this.error.set(null);
    this.busy.set(true);
    this.loadRequest?.unsubscribe();
    this.loadRequest = this.client.list(meta.id, this.query()).subscribe({
      next: (page) => {
        this.page.set(page);
        this.selection.set([]);
        this.refreshListAvailability();
        this.busy.set(false);
      },
      error: (error) => {
        this.page.set(null);
        this.failed(error);
      },
    });
  }
  paginate(offset: number) {
    this.query.update((q) => ({ ...q, offset }));
    this.load();
  }
  addFilter() {
    const field = this.meta()!.fields.find((f) => f.capabilities.filterable);
    if (field)
      this.filters.update((filters) => [
        ...filters,
        {
          field: field.name,
          operator: field.capabilities.filterOperators[0]!,
          value: '',
          nullValue: false,
        },
      ]);
  }
  setFilter(
    index: number,
    key: 'field' | 'operator' | 'value' | 'nullValue',
    value: string | boolean,
  ) {
    this.filters.update((filters) =>
      filters.map((filter, i) => {
        if (i !== index) return filter;
        const next = { ...filter, [key]: value };
        if (key === 'field')
          next.operator = this.meta()!.fields.find(
            (f) => f.name === value,
          )!.capabilities.filterOperators[0]!;
        return next;
      }),
    );
  }
  operators(name: string) {
    return this.meta()?.fields.find((f) => f.name === name)?.capabilities.filterOperators ?? [];
  }
  apply(event: Event, search: string, first: string, second: string) {
    event.preventDefault();
    try {
      const filters = this.filters().map((filter) => {
        const field = this.meta()!.fields.find((f) => f.name === filter.field)!;
        if (filter.nullValue && (!field.nullable || !['eq', 'ne'].includes(filter.operator)))
          throw new Error('Invalid null filter');
        if (
          !filter.nullValue &&
          field.type === 'BOOLEAN' &&
          !['true', 'false'].includes(filter.value)
        )
          throw new Error('Use true or false');

        return {
          field: field.name,
          operator: filter.operator,
          value: filter.nullValue
            ? null
            : scalarInput(
                {
                  ...field,
                  constraints: ['contains', 'startsWith'].includes(filter.operator)
                    ? {}
                    : field.constraints,
                },
                field.type === 'BOOLEAN' ? filter.value === 'true' : filter.value,
              ),
        };
      });
      this.query.set({
        ...this.query(),
        offset: 0,
        search,
        sort: [...new Set([first, second].filter(Boolean))],
        filters,
      });
      this.load();
    } catch {
      this.error.set(new RuntimeFailure(HttpStatusCode.BadRequest, 'invalid_request'));
    }
  }
  create() {
    this.selected.set(null);
    this.viewing.set(false);
    this.action.set(null);
    this.fieldErrors.set({});
    this.editing.set(true);
    this.refreshAvailability();
  }
  open(row: Row, edit: boolean) {
    const meta = this.meta()!;
    this.error.set(null);
    const accept = (value: Row) => {
      this.selected.set(value);
      this.editing.set(edit);
      this.viewing.set(!edit);
      this.action.set(null);
      this.fieldErrors.set({});
      this.refreshAvailability();
    };
    // Action authorization is independent of GET authorization. A list-provided
    // typed ID is sufficient for contextual availability and execution.
    if (!allowed(meta, 'get')) {
      accept(row);
      return;
    }
    this.requests.add(
      this.client
        .get(meta.id, row[meta.idDefinition.field]!)
        .subscribe({ next: accept, error: (error) => this.failed(error) }),
    );
  }
  entityActions(meta: Metadata) {
    return meta.actions.some((action) => action.scope === 'ENTITY' && action.authorized);
  }
  close() {
    this.editing.set(false);
    this.viewing.set(false);
    this.action.set(null);
    this.selected.set(null);
  }
  save(body: Row) {
    const meta = this.meta()!;
    this.busy.set(true);
    const id = this.selected()?.[meta.idDefinition.field];
    this.requests.add(
      this.client.save(meta.id, body, id).subscribe({
        next: () => {
          this.busy.set(false);
          this.close();
          this.load();
        },
        error: (error) => this.failed(error),
      }),
    );
  }
  confirmDelete() {
    const meta = this.meta()!,
      row = this.deleting();
    if (!row) return;
    this.busy.set(true);
    this.requests.add(
      this.client.delete(meta.id, row[meta.idDefinition.field]!).subscribe({
        next: () => {
          this.deleting.set(null);
          this.busy.set(false);
          this.close();
          this.load();
        },
        error: (error) => this.failed(error),
      }),
    );
  }
  refreshAvailability() {
    const meta = this.meta()!;
    this.availability.set([]);
    if (!this.presentedActions().length) return;
    if (!this.selected()) {
      this.requests.add(
        this.client.actionAvailability(meta.id, { scope: 'COLLECTION' }).subscribe({
          next: (value) => this.availability.set(value),
          error: (error) => this.failed(error),
        }),
      );
      return;
    }
    const id = this.selected()![meta.idDefinition.field];
    if (id === undefined) return;
    this.requests.add(
      this.client.availability(meta.id, id).subscribe({
        next: (value) => this.availability.set(value),
        error: (error) => this.failed(error),
      }),
    );
  }
  toggleSelection(row: Row) {
    this.selection.update((rows) =>
      rows.includes(row)
        ? rows.filter((value) => value !== row)
        : rows.length < P.maxSelection
          ? [...rows, row]
          : rows,
    );
    this.refreshListAvailability();
  }
  private refreshListAvailability() {
    this.listRequests.unsubscribe();
    this.listRequests = new Subscription();
    this.listAvailability.set([]);
    for (const scope of ['COLLECTION', 'SELECTION'] as const) {
      if (
        !this.listActions().some((action) => action.scope === scope) ||
        (scope === 'SELECTION' && !this.selection().length)
      )
        continue;
      const target: ActionTarget =
        scope === 'COLLECTION'
          ? { scope }
          : { scope, ids: this.selection().map((row) => row[this.meta()!.idDefinition.field]!) };
      this.listRequests.add(
        this.client.actionAvailability(this.meta()!.id, target).subscribe({
          next: (values) => this.listAvailability.update((all) => [...all, ...values]),
          error: (error) => this.failed(error),
        }),
      );
    }
  }
  listActionAvailable(name: string) {
    return this.listAvailability().some(
      (state) => state.name === name && state.authorized && state.available,
    );
  }
  private target(action: Action): ActionTarget | undefined {
    if (action.scope === 'COLLECTION') return { scope: 'COLLECTION' };
    if (action.scope === 'SELECTION')
      return this.selection().length
        ? {
            scope: 'SELECTION',
            ids: this.selection().map((row) => row[this.meta()!.idDefinition.field]!),
          }
        : undefined;
    return this.selected()
      ? { scope: 'ENTITY', id: this.selected()![this.meta()!.idDefinition.field]! }
      : undefined;
  }
  available(name: string) {
    return this.availability().some((a) => a.name === name && a.authorized && a.available);
  }
  parameters(action: Action): Field[] {
    return action.parameters.map((p) => ({
      ...p,
      readOnly: false,
      immutable: false,
      capabilities: { filterable: false, sortable: false, searchable: false, filterOperators: [] },
    }));
  }
  execute(parameters: Row) {
    const meta = this.meta()!,
      action = this.action(),
      target = action ? this.target(action) : undefined;
    if (!action || !target) return;
    const selected = this.selected();
    this.busy.set(true);
    this.requests.add(
      this.client.executeAction(meta.id, action.name, target, parameters).subscribe({
        next: () => {
          this.busy.set(false);
          this.action.set(null);
          if (selected) this.open(selected, false);
          else if (this.editing()) this.refreshAvailability();
          this.load();
        },
        error: (error) => {
          this.failed(error);
          if (this.selected() || this.editing()) this.refreshAvailability();
          else this.refreshListAvailability();
        },
      }),
    );
  }
  private representationFailed(error: unknown) {
    this.meta.set(null);
    this.contexts.set(undefined);
    this.page.set(null);
    this.selected.set(null);
    this.editing.set(false);
    this.viewing.set(false);
    this.failed(error);
  }
  private failed(error: unknown) {
    const failure = translateFailure(error);
    this.error.set(failure);
    this.busy.set(false);
    this.fieldErrors.set(
      Object.fromEntries(
        failure.details
          .filter((detail) => detail.path)
          .map((detail) => [detail.path!.replace(/^\$?\.?/, ''), detail.code]),
      ),
    );
  }
}
