import { Component } from '@angular/core';
import { ShellBase } from '../../shell/shell-content';
import { ShellSlotOutlet } from '../../shell/shell-slot-outlet';
import { ThemeNavigationOutlet } from '../../shell/theme-navigation-outlet';
import { ThemePanelOutlet } from '../../shell/theme-panel-outlet';

@Component({
  selector: 'core-fe-cyberpunk-shell',
  imports: [ShellSlotOutlet, ThemeNavigationOutlet, ThemePanelOutlet],
  templateUrl: './shell.html',
})
export class CyberpunkShell extends ShellBase {}
@Component({ selector: 'core-fe-cyberpunk-panel', templateUrl: './panel.html' })
export class CyberpunkPanel {}
