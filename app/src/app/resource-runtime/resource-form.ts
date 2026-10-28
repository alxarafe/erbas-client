import { NgTemplateOutlet } from '@angular/common';
import { ResourceLayout } from './resource-layout';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Subscription, switchMap, map } from 'rxjs';
import { FieldRendererOutlet } from '../core-fe/field-types/field-renderer-outlet';
import { FieldValue } from '../core-fe/field-types/renderer-context';
import {
  Action,
  Availability,
  Presentation,
  Field,
  Metadata,
  Relation,
  Row,
  Scalar,
  display,
  label,
  RESOURCE_PROTOCOL as P,
} from './models';
import { RuntimeClient, RuntimeFailure, failureMessage, translateFailure } from './runtime-client';
import { editable, fieldValue, same, scalarInput, visibleField } from './fields';
import { parseExact, stringifyExact } from './exact-json';
interface Lookup {
  rows: Row[];
  offset: number;
  total?: number;
  meta: Metadata;
}
@Component({
  selector: 'app-resource-form',
  imports: [FieldRendererOutlet, ResourceLayout],
  templateUrl: './resource-form.html',
})
export class ResourceForm {
  readonly presentation = input<Presentation>();
  readonly readOnly = input(false);
  readonly actions = input<Action[]>([]);
  readonly actionScopes = input<readonly Action['scope'][]>(['ENTITY']);
  readonly availability = input<Availability[]>([]);
  readonly actionSelected = output<Action>();
  readonly idPrefix = input('resource');
  readonly fields = input.required<Field[]>();
  readonly renderedFields = computed(() => this.fields().filter((field) => visibleField(field)));
  readonly relations = input<Relation[]>([]);
  readonly record = input<Row | null>(null);
  readonly busy = input(false);
  readonly fieldErrors = input<Readonly<Record<string, string>>>({});
  readonly submitted = output<Row>();
  readonly cancelled = output<void>();
  readonly values = signal<Record<string, FieldValue>>({});
  readonly changed = signal<ReadonlySet<string>>(new Set());
  readonly message = signal('');
  readonly lookups = signal<Record<string, Lookup>>({});
  readonly pageSize = P.maxLimit;
  previous(offset: number) {
    return Math.max(0, offset - P.maxLimit);
  }
  constraintHelp(field: Field): string {
    return Object.entries(field.constraints)
      .map(([name, value]) => name + ': ' + display(value))
      .join(' · ');
  }
  readonly display = display;
  readonly label = label;
  readonly stringify = stringifyExact;
  readonly editable = editable;
  private readonly client = inject(RuntimeClient);
  private lookupRequests = new Subscription();
  lookupValue(field: Field): string {
    const value = this.values()[field.name] ?? null;
    if (value === null) return '';
    try {
      return stringifyExact(scalarInput(field, value));
    } catch {
      return '';
    }
  }
  constructor() {
    effect((onCleanup) => {
      const record = this.record();
      const fields = this.renderedFields();
      this.values.set(
        Object.fromEntries(
          fields.map((f) => [
            f.name,
            fieldValue(record && Object.hasOwn(record, f.name) ? record[f.name] : f.default),
          ]),
        ),
      );
      this.changed.set(new Set());
      this.message.set('');
      this.lookups.set({});
      const subscriptions = new Subscription();
      this.lookupRequests = subscriptions;
      if (!this.readOnly())
        for (const relation of this.relations())
          if (fields.some((field) => field.name === relation.localField && !field.readOnly))
            subscriptions.add(this.loadLookup(relation, 0));
      onCleanup(() => subscriptions.unsubscribe());
    });
  }
  change(name: string, value: FieldValue) {
    this.values.update((values) => ({ ...values, [name]: value }));
    this.changed.update((fields) => new Set([...fields, name]));
  }
  relation(field: Field) {
    return this.relations().find((relation) => relation.localField === field.name);
  }
  choose(name: string, value: string) {
    if (!value) return;
    const parsed = parseExact(value);
    this.change(name, fieldValue(parsed as Scalar));
  }
  lookupNext(relation: Relation, offset: number) {
    this.lookupRequests.add(this.loadLookup(relation, offset));
  }
  private loadLookup(relation: Relation, offset: number): Subscription {
    return this.client
      .metadata(relation.targetResource)
      .pipe(
        switchMap((meta) =>
          this.client
            .list(relation.targetResource, { offset, limit: P.maxLimit, sort: [], filters: [] })
            .pipe(
              map((page) => ({ meta, rows: page.items, offset: page.offset, total: page.total })),
            ),
        ),
      )
      .subscribe({
        next: (lookup) => this.lookups.update((all) => ({ ...all, [relation.name]: lookup })),
        error: (error) => this.message.set(failureMessage(translateFailure(error))),
      });
  }
  submit(event: Event) {
    event.preventDefault();
    if (this.readOnly()) return;
    const payload: Row = {};
    try {
      for (const field of this.renderedFields()) {
        if (!editable(field, this.record() !== null)) continue;
        const dirty = this.changed().has(field.name);
        if (!dirty) {
          if (!this.record() && field.required && !Object.hasOwn(field, 'default'))
            throw new Error(label(field) + ' is required');
          continue;
        }
        const value = scalarInput(field, this.values()[field.name] ?? null);
        if (!this.record() || !same(value, this.record()![field.name])) payload[field.name] = value;
      }
      if (this.record() && Object.keys(payload).length === 0) throw new Error('No changes to save');
      this.message.set('');
      this.submitted.emit(payload);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'Invalid fields');
    }
  }
}
