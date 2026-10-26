import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellBase, NavigationBase } from '../../shell/shell-content';
import { ShellSlotOutlet } from '../../shell/shell-slot-outlet';
import { ThemeNavigationOutlet } from '../../shell/theme-navigation-outlet';
import { ThemePanelOutlet } from '../../shell/theme-panel-outlet';

@Component({
  selector: 'core-fe-default-shell',
  imports: [ShellSlotOutlet, ThemeNavigationOutlet, ThemePanelOutlet],
  templateUrl: './shell.html',
})
export class DefaultShell extends ShellBase {}
@Component({
  selector: 'core-fe-default-navigation',
  imports: [RouterLink, DefaultNavigation],
  templateUrl: './navigation.html',
})
export class DefaultNavigation extends NavigationBase {}
@Component({ selector: 'core-fe-default-panel', templateUrl: './panel.html' })
export class DefaultPanel {}
