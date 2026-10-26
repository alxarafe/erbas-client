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
import { Subscription } from 'rxjs';
import { ResourceForm } from './resource-form';
import {
  Action,
  Availability,
  Field,
  Filter,
  Metadata,
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
  readonly page = signal<Page | null>(null);
  readonly error = signal<RuntimeFailure | null>(null);
  readonly busy = signal(false);
  readonly selected = signal<Row | null>(null);
  readonly editing = signal(false);
  readonly viewing = signal(false);
  readonly deleting = signal<Row | null>(null);
  readonly action = signal<Action | null>(null);
  readonly availability = signal<Availability[]>([]);
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly query = signal<Query>({ offset: 0, limit: P.pageSize, sort: [], filters: [] });
  readonly filters = signal<
    { field: string; operator: string; value: string; nullValue: boolean }[]
  >([]);
  readonly label = label;
  readonly display = display;
  readonly allowed = allowed;
  readonly failureMessage = failureMessage;
  readonly orderedFields = orderedFields;
  readonly formFields = computed(() => (this.meta() ? orderedFields(this.meta()!) : []));
  readonly parameterFields = computed(() => (this.action() ? this.parameters(this.action()!) : []));
  private requests = new Subscription();
  private loadRequest?: Subscription;
  constructor() {
    effect(() => {
      const resource = this.resource(),
        key = this.client.key();
      untracked(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.loadRequest?.unsubscribe();
        this.error.set(null);
        this.fieldErrors.set({});
        this.availability.set([]);
        this.busy.set(false);
        this.meta.set(null);
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
          this.client.metadata(resource).subscribe({
            next: (meta) => {
              this.meta.set(meta);
              this.load();
            },
            error: (error) => this.failed(error),
          }),
        );
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.requests.unsubscribe();
      this.loadRequest?.unsubscribe();
    });
  }
  hasSearch(meta: Metadata) {
    return meta.fields.some((field) => field.capabilities.searchable);
  }
  columns(meta: Metadata) {
    return meta.fields.filter(
      (field) =>
        !field.annotations.some(
          (a) => a.vocabulary === 'UI' && a.term === 'Hidden' && a.value === true,
        ),
    );
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
    const meta = this.meta()!,
      id = this.selected()?.[meta.idDefinition.field];
    this.availability.set([]);
    if (id === undefined || !meta.actions.some((a) => a.scope === 'ENTITY' && a.authorized)) return;
    this.requests.add(
      this.client.availability(meta.id, id).subscribe({
        next: (value) => this.availability.set(value),
        error: (error) => this.failed(error),
      }),
    );
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
      selected = this.selected();
    if (!action || !selected) return;
    this.busy.set(true);
    this.requests.add(
      this.client
        .execute(meta.id, action.name, selected[meta.idDefinition.field]!, parameters)
        .subscribe({
          next: () => {
            this.busy.set(false);
            this.action.set(null);
            this.open(selected, false);
            this.load();
          },
          error: (error) => {
            this.failed(error);
            this.refreshAvailability();
          },
        }),
    );
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
