import { ThemeArtifact, ThemeArtifacts, ThemeDefinition, ThemeId } from '../theme/theme-definition';
import { DefaultShell, DefaultNavigation, DefaultPanel } from './default/structure';
import { CyberpunkShell, CyberpunkPanel } from './cyberpunk/structure';
import { HighContrastPanel } from './high-contrast/panel';
import { AlternativeBooleanRenderer } from './alternative/boolean-renderer';
import {
  DefaultBinaryRenderer,
  DefaultBooleanRenderer,
  DefaultDateRenderer,
  DefaultEnumRenderer,
  DefaultNumberRenderer,
  DefaultStringRenderer,
  DefaultTextRenderer,
  DefaultTimeRenderer,
} from './default/field-renderers';

export const DEFAULT_ARTIFACTS = {
  [ThemeArtifact.Shell]: DefaultShell,
  [ThemeArtifact.Navigation]: DefaultNavigation,
  [ThemeArtifact.Panel]: DefaultPanel,
  [ThemeArtifact.FieldBoolean]: DefaultBooleanRenderer,
  [ThemeArtifact.FieldString]: DefaultStringRenderer,
  [ThemeArtifact.FieldText]: DefaultTextRenderer,
  [ThemeArtifact.FieldInt8]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint8]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt16]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint16]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt32]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint32]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt64]: DefaultNumberRenderer,
  [ThemeArtifact.FieldDecimal]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUuid]: DefaultStringRenderer,
  [ThemeArtifact.FieldDate]: DefaultDateRenderer,
  [ThemeArtifact.FieldTime]: DefaultTimeRenderer,
  [ThemeArtifact.FieldDatetime]: DefaultStringRenderer,
  [ThemeArtifact.FieldEnum]: DefaultEnumRenderer,
  [ThemeArtifact.FieldBinary]: DefaultBinaryRenderer,
} satisfies ThemeArtifacts;
export const BUILTIN_THEMES: readonly ThemeDefinition[] = [
  { id: ThemeId.Default, cssClass: 'theme-default', overrides: DEFAULT_ARTIFACTS },
  {
    id: ThemeId.Alternative,
    cssClass: 'theme-alternative',
    overrides: { [ThemeArtifact.FieldBoolean]: AlternativeBooleanRenderer },
  },
  {
    id: ThemeId.Cyberpunk,
    cssClass: 'theme-cyberpunk',
    overrides: {
      [ThemeArtifact.Shell]: CyberpunkShell,
      [ThemeArtifact.Panel]: CyberpunkPanel,
    },
  },
  { id: ThemeId.Vintage, cssClass: 'theme-vintage', overrides: {} },
  {
    id: ThemeId.HighContrast,
    cssClass: 'theme-high-contrast',
    overrides: { [ThemeArtifact.Panel]: HighContrastPanel },
  },
];
