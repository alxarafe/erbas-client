import { Injectable } from '@angular/core';
import { FieldArtifact, ThemeArtifact } from '../theme/theme-definition';

export interface NormalizedFieldType {
  readonly id: string;
  readonly rendererArtifact: FieldArtifact;
}
export const NORMALIZED_FIELD_TYPES: readonly NormalizedFieldType[] = Object.freeze([
  Object.freeze({ id: 'BOOLEAN', rendererArtifact: ThemeArtifact.FieldBoolean }),
  Object.freeze({ id: 'STRING', rendererArtifact: ThemeArtifact.FieldString }),
  Object.freeze({ id: 'TEXT', rendererArtifact: ThemeArtifact.FieldText }),
  Object.freeze({ id: 'INT8', rendererArtifact: ThemeArtifact.FieldInt8 }),
  Object.freeze({ id: 'UINT8', rendererArtifact: ThemeArtifact.FieldUint8 }),
  Object.freeze({ id: 'INT16', rendererArtifact: ThemeArtifact.FieldInt16 }),
  Object.freeze({ id: 'UINT16', rendererArtifact: ThemeArtifact.FieldUint16 }),
  Object.freeze({ id: 'INT32', rendererArtifact: ThemeArtifact.FieldInt32 }),
  Object.freeze({ id: 'UINT32', rendererArtifact: ThemeArtifact.FieldUint32 }),
  Object.freeze({ id: 'INT64', rendererArtifact: ThemeArtifact.FieldInt64 }),
  Object.freeze({ id: 'DECIMAL', rendererArtifact: ThemeArtifact.FieldDecimal }),
  Object.freeze({ id: 'UUID', rendererArtifact: ThemeArtifact.FieldUuid }),
  Object.freeze({ id: 'DATE', rendererArtifact: ThemeArtifact.FieldDate }),
  Object.freeze({ id: 'TIME', rendererArtifact: ThemeArtifact.FieldTime }),
  Object.freeze({ id: 'DATETIME', rendererArtifact: ThemeArtifact.FieldDatetime }),
  Object.freeze({ id: 'ENUM', rendererArtifact: ThemeArtifact.FieldEnum }),
  Object.freeze({ id: 'BINARY', rendererArtifact: ThemeArtifact.FieldBinary }),
]);
@Injectable({ providedIn: 'root' })
export class NormalizedFieldTypeRegistry {
  readonly all = NORMALIZED_FIELD_TYPES;
  private readonly types = new Map(this.all.map((type) => [type.id, type]));
  require(id: string): NormalizedFieldType {
    const type = this.types.get(id);
    if (!type) throw new Error('Unsupported semantic field type');
    return type;
  }
}
