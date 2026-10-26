import type { HttpTestingController } from '@angular/common/http/testing';
import { HttpStatusCode } from '@angular/common/http';
import { RESOURCE_PROTOCOL } from './models';
// Neutral synthetic contract fixtures, not resource-specific application screens.
import { Field, Metadata, Navigation } from './models';
export const TEST_RESOURCE = 'catalogue';
export const TEST_ETAG = '"fixture-version"';
export function field(
  name: string,
  type = 'STRING',
  required = false,
  extra: Partial<Field> = {},
): Field {
  return {
    name,
    type,
    required,
    nullable: false,
    readOnly: false,
    immutable: false,
    constraints: {},
    enumValues: [],
    annotations: [],
    capabilities: {
      filterable: true,
      sortable: true,
      searchable: type === 'STRING',
      filterOperators: ['eq', 'ne'],
    },
    ...extra,
  };
}
export function fixtureMetadata(): Metadata {
  return {
    id: TEST_RESOURCE,
    version: '1',
    moduleId: 'example',
    definitionHash: 'hash',
    moduleEnabled: true,
    idDefinition: { field: 'id' },
    operations: Object.fromEntries(
      ['list', 'get', 'create', 'update', 'delete'].map((op) => [
        op,
        { declared: true, authorized: true },
      ]),
    ) as Metadata['operations'],
    fields: [
      field('id', 'UUID', false, { readOnly: true }),
      field('code', 'STRING', true, { immutable: true }),
      field('name', 'STRING', true),
      field('notes', 'STRING', false, { nullable: true }),
      field('amount', 'DECIMAL', false, { nullable: true }),
      field('day', 'DATE', false, { nullable: true }),
      field('active', 'BOOLEAN', false, { default: true }),
    ],
    relations: [],
    actions: [
      {
        name: 'finish',
        scope: 'ENTITY',
        requiresSelection: false,
        authorized: true,
        annotations: [],
        parameters: [field('reason', 'STRING', true)],
      },
    ],
    annotations: [],
  };
}
export const fixtureNavigation: Navigation = {
  version: 'fixture-version',
  items: [
    {
      id: 'example.root',
      label: 'Application',
      order: 10,
      children: [
        {
          id: 'example.resource',
          label: 'Register',
          order: 10,
          children: [],
          target: { type: 'RESOURCE', resource: TEST_RESOURCE },
        },
        {
          id: 'example.route',
          label: 'Home',
          order: 20,
          children: [],
          target: { type: 'ROUTE', route: '/' },
        },
      ],
    },
  ],
};

// Old API fixtures deliberately represent a backend without candidate navigation.
export function isNavigationRequest(request: { url: string }): boolean {
  return request.url.endsWith(RESOURCE_PROTOCOL.navigation);
}
export function finishLegacyNavigation(http: HttpTestingController): void {
  http
    .match(isNavigationRequest)
    .filter((request) => !request.cancelled)
    .forEach((request) =>
      request.flush(
        { code: 'resource_not_found', errors: [{ code: 'resource_not_found' }] },
        { status: HttpStatusCode.NotFound, statusText: 'Not Found' },
      ),
    );
}
