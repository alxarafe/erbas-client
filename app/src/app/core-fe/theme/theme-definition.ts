import { Type } from '@angular/core';
import { FieldRenderer } from '../field-types/renderer-context';

export const ThemeArtifact = {
  Shell: 'shell',
  Navigation: 'navigation',
  Panel: 'panel',
  FieldBoolean: 'field.BOOLEAN',
  FieldString: 'field.STRING',
  FieldText: 'field.TEXT',
  FieldInt8: 'field.INT8',
  FieldUint8: 'field.UINT8',
  FieldInt16: 'field.INT16',
  FieldUint16: 'field.UINT16',
  FieldInt32: 'field.INT32',
  FieldUint32: 'field.UINT32',
  FieldInt64: 'field.INT64',
  FieldDecimal: 'field.DECIMAL',
  FieldUuid: 'field.UUID',
  FieldDate: 'field.DATE',
  FieldTime: 'field.TIME',
  FieldDatetime: 'field.DATETIME',
  FieldEnum: 'field.ENUM',
  FieldBinary: 'field.BINARY',
} as const;
export type ThemeArtifact = (typeof ThemeArtifact)[keyof typeof ThemeArtifact];
export type FieldArtifact = Extract<ThemeArtifact, `field.${string}`>;
export type StructureArtifact = Exclude<ThemeArtifact, FieldArtifact>;
export type ThemeArtifacts = Readonly<
  Record<StructureArtifact, Type<unknown>> & Record<FieldArtifact, Type<FieldRenderer>>
>;
export const THEME_ARTIFACTS: readonly ThemeArtifact[] = Object.freeze(
  Object.values(ThemeArtifact),
);
export const ThemeId = {
  Default: 'default',
  Alternative: 'alternative',
  Cyberpunk: 'cyberpunk',
  Vintage: 'vintage',
  HighContrast: 'high-contrast',
} as const;
export interface ThemeDefinition {
  readonly id: string;
  readonly cssClass: string;
  readonly overrides: Partial<ThemeArtifacts>;
}
