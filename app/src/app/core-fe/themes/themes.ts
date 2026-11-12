import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
import { ALTERNATIVE_THEME } from '@alxarafe/ui-theme-alternative';
import { CYBERPUNK_THEME } from '@alxarafe/ui-theme-cyberpunk';
import { VINTAGE_THEME } from '@alxarafe/ui-theme-vintage';
import { HIGH_CONTRAST_THEME } from '@alxarafe/ui-theme-high-contrast';

export { DEFAULT_ARTIFACTS } from '@alxarafe/ui-theme-default';
export const BUILTIN_THEMES = [
  DEFAULT_THEME,
  ALTERNATIVE_THEME,
  CYBERPUNK_THEME,
  VINTAGE_THEME,
  HIGH_CONTRAST_THEME,
] as const;
