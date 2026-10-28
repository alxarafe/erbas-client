import { fixtureMetadata, field, fixtureForm as contextualForm } from './runtime-fixtures';
import { ContextPresentation, Metadata } from './models';
import {
  contextActions,
  presentationDocument,
  resolveColumns,
  resolveForm,
} from './contextual-presentation';
import { editable } from './fields';
import { projectLayout } from './resource-layout';
function document(meta: Metadata, presentation: ContextPresentation = {}) {
  return { id: meta.id, definitionHash: meta.definitionHash, presentation };
}
describe('RESOURCE-PRESENTATION-001 compiled contract and resolution', () => {
  it('accepts independent forms, ordered list labels and the closed legacy empty object', () => {
    const meta = fixtureMetadata();
    expect(presentationDocument(document(meta), meta).presentation).toEqual({});
    const value = document(meta, {
      create: contextualForm('code', 'name'),
      edit: contextualForm('name', 'code'),
      view: contextualForm('id'),
      list: { columns: [{ field: 'name', label: 'List name' }, { field: 'code' }], actions: [] },
    });
    expect(presentationDocument(value, meta)).toBe(value);
    expect(resolveColumns(meta, value.presentation).map((column) => column.label)).toEqual([
      'List name',
      'code',
    ]);
  });
  it.each([
    'root-property',
    'wrong-id',
    'wrong-hash',
    'null-context',
    'context-property',
    'form-property',
    'behavior-property',
    'tab-property',
    'section-property',
    'group-property',
    'unknown-field',
    'duplicate-field',
    'duplicate-across-containers',
    'duplicate-tab',
    'duplicate-section',
    'duplicate-group',
    'unknown-action',
    'duplicate-action',
    'wrong-scope',
    'list-property',
    'column-property',
    'unknown-column',
    'duplicate-column',
    'invalid-label',
    'invalid-behavior',
    'behavior-array',
    'invalid-collapse',
  ])('rejects %s instead of silently resolving fallback', (fault) => {
    const meta = fixtureMetadata();
    const value: any = document(meta, {
      create: contextualForm('name'),
      list: { columns: [{ field: 'name' }], actions: [] },
    });
    const form = value.presentation.create,
      tab = form.tabs[0],
      section = tab.sections[0],
      group = section.groups[0];
    switch (fault) {
      case 'root-property':
        value.css = 'x';
        break;
      case 'wrong-id':
        value.id = 'other';
        break;
      case 'wrong-hash':
        value.definitionHash = 'other';
        break;
      case 'null-context':
        value.presentation.edit = null;
        break;
      case 'context-property':
        value.presentation.permission = 'x';
        break;
      case 'form-property':
        form.renderer = 'x';
        break;
      case 'behavior-property':
        form.behavior.css = 'x';
        break;
      case 'tab-property':
        tab.width = 1;
        break;
      case 'section-property':
        section.hidden = true;
        break;
      case 'group-property':
        group.editable = true;
        break;
      case 'unknown-field':
        group.fields = ['unknown'];
        break;
      case 'duplicate-field':
        group.fields = ['name', 'name'];
        break;
      case 'duplicate-across-containers':
        section.groups.push({ ...group, id: 'other' });
        break;
      case 'duplicate-tab':
        form.tabs.push(tab);
        break;
      case 'duplicate-section':
        tab.sections.push(section);
        break;
      case 'duplicate-group':
        section.groups.push(group);
        break;
      case 'unknown-action':
        form.actions = ['unknown'];
        break;
      case 'duplicate-action':
        value.presentation.edit = contextualForm();
        value.presentation.edit.actions = ['finish'];
        value.presentation.edit.tabs[0].actions = ['finish'];
        break;
      case 'wrong-scope':
        form.actions = ['finish'];
        break;
      case 'list-property':
        value.presentation.list.sort = ['name'];
        break;
      case 'column-property':
        value.presentation.list.columns[0].width = 1;
        break;
      case 'unknown-column':
        value.presentation.list.columns = [{ field: 'unknown' }];
        break;
      case 'duplicate-column':
        value.presentation.list.columns.push({ field: 'name', label: 'Other' });
        break;
      case 'invalid-label':
        value.presentation.list.columns[0].label = '<b>label</b>';
        break;
      case 'behavior-array':
        form.behavior.unsavedChanges = ['CONFIRM_DISCARD'];
        break;
      case 'invalid-behavior':
        form.behavior.unsavedChanges = 'IGNORE';
        break;
      case 'invalid-collapse':
        section.initiallyCollapsed = true;
        break;
    }
    expect(() => presentationDocument(value, meta)).toThrow();
  });
  it.each(['create', 'edit', 'view'] as const)(
    'uses the exact %s subset/order without appending omitted required fields',
    (mode) => {
      const meta = fixtureMetadata(),
        context = { [mode]: contextualForm('name', 'code') };
      const resolved = resolveForm(meta, context, mode);
      expect(resolved.fields.map((field) => field.name)).toEqual(['name', 'code']);
      expect(projectLayout(resolved.fields, resolved.presentation, []).fallback).toEqual([]);
      expect(editable(resolved.fields[1]!, mode !== 'create')).toBe(mode === 'create');
    },
  );
  it.each(['create', 'edit', 'view'] as const)(
    'distinguishes absent and explicitly empty %s',
    (mode) => {
      const meta = fixtureMetadata();
      meta.presentation = { form: contextualForm('name') };
      const empty = { behavior: { unsavedChanges: 'CONFIRM_DISCARD' }, actions: [], tabs: [] };
      expect(resolveForm(meta, { [mode]: empty }, mode).fields).toEqual([]);
      const legacy = resolveForm(meta, {}, mode);
      expect(legacy.fields[0]!.name).toBe('name');
      expect(legacy.fields.length).toBe(meta.fields.length);
      delete meta.presentation;
      expect(resolveForm(meta, undefined, mode).fields).toEqual(meta.fields);
    },
  );
  it('never flattens a legacy form into LIST; empty columns remain empty and labels have three levels', () => {
    const meta = fixtureMetadata();
    meta.presentation = { form: contextualForm('name') };
    meta.fields[1]!.annotations = [{ vocabulary: 'Common', term: 'Label', value: 'Code' }];
    expect(resolveColumns(meta, {}).map((column) => column.field.name)).toEqual(
      meta.fields.map((field) => field.name),
    );
    expect(resolveColumns(meta, { list: { columns: [], actions: [] } })).toEqual([]);
    expect(
      resolveColumns(meta, {
        list: {
          columns: [{ field: 'code' }, { field: 'name' }, { field: 'id', label: 'Identifier' }],
          actions: [],
        },
      }).map((column) => column.label),
    ).toEqual(['Code', 'name', 'Identifier']);
  });
  it('static hints take precedence in every explicit context and preserve metadata semantics', () => {
    const meta = fixtureMetadata();
    meta.fields.push(
      field('hidden', 'STRING', false, {
        annotations: [{ vocabulary: 'UI', term: 'Hidden', value: true }],
      }),
      field('excluded', 'STRING', false, {
        annotations: [{ vocabulary: 'UI', term: 'FormExcluded', value: true }],
      }),
    );
    for (const mode of ['create', 'edit', 'view'] as const)
      expect(
        resolveForm(
          meta,
          { [mode]: contextualForm('hidden', 'excluded', 'code') },
          mode,
        ).fields.map((field) => field.name),
      ).toEqual(['code']);
    expect(
      resolveColumns(meta, {
        list: { columns: [{ field: 'hidden' }, { field: 'excluded' }], actions: [] },
      }).map((column) => column.field.name),
    ).toEqual(['excluded']);
    expect(meta.fields.find((field) => field.name === 'code')!.immutable).toBe(true);
  });
  it('validates context scopes and resolves only effective authorized actions in placement order', () => {
    const meta = fixtureMetadata(),
      entity = meta.actions[0]!;
    meta.actions.push(
      { ...entity, name: 'collect', scope: 'COLLECTION' },
      { ...entity, name: 'select', scope: 'SELECTION', requiresSelection: true },
      { ...entity, name: 'denied', authorized: false },
    );
    const create = contextualForm('name');
    create.actions = ['collect'];
    const edit = contextualForm('name');
    edit.actions = ['finish'];
    presentationDocument(
      document(meta, {
        create,
        edit,
        view: edit,
        list: { columns: [], actions: ['select', 'collect'] },
      }),
      meta,
    );
    expect(
      contextActions(meta, 'list', ['select', 'collect']).map((action) => action.name),
    ).toEqual(['select', 'collect']);
    expect(contextActions(meta, 'create').map((action) => action.name)).toEqual(['collect']);
    expect(contextActions(meta, 'view').map((action) => action.name)).toEqual(['finish']);
  });
});
