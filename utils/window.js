/*
 * This file is part of the Em-Dash extension for GNOME Shell.
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program. If
 * not, see <http://www.gnu.org/licenses/>.
 */

const Meta = imports.gi.Meta;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const log = LoggingUtils.logger('window');


function getFocusedWindowIndex(windows) {
	return windows.findIndex(window => window.has_focus());
}


function hide(windows) {
	for (let window of windows) {
		window.minimize();
	}
}


function focus(window) {
	window.activate(global.get_current_time());
}


function raiseAndFocus(windows) {
	// Adapted from shell_app_activate_window in
	// https://github.com/GNOME/gnome-shell/blob/master/src/shell-app.c

	if (windows.length === 0) {
		log('raiseAndFocus: do nothing');
		return;
	}

	// Sort by user time
	windows.sort((a, b) => {
		return b.get_user_time() - a.get_user_time();
	});
	let window = windows.shift();

	const display = global.display;

	// Is the display newer? (I don't understand what this is for...)
	const time = global.get_current_time();
	const displayTime = display.get_last_user_time();
	if (display.xserver_time_is_before(time, displayTime)) {
		log('raiseAndFocus: display is newer');
		window.set_demands_attention();
		return;
	}

	const currentWorkspace = global.workspace_manager.get_active_workspace();

	// Raise windows in current workspace (in reverse order to preserve stacking)
	windows.reverse();
	for (let window of windows) {
		if (window.get_workspace() === currentWorkspace) {
			window.unminimize();
			window.raise();
		}
	}

	// Find our newest transient in current workspace
	let transients = [];
	window.foreach_transient((transient) => {
		if (transient.get_workspace() === currentWorkspace) {
			let type = transient.window_type;
			if ((type === Meta.WindowType.NORMAL) || (type === Meta.WindowType.DIALOG)) {
				transients.push(transient);
			}
		}
	});
	transients = display.sort_windows_by_stacking(transients);
	const transient = transients.pop();

	// Is the transient newer than us?
	if ((transient !== undefined) &&
			display.xserver_time_is_before(window.get_user_time(), transient.get_user_time())) {
		window = transient;
		log('raiseAndFocus: transient is newer');
	}

	// Focus
	const workspace = window.get_workspace();
	if (workspace === currentWorkspace) {
		window.activate(time);
	}
	else {
		workspace.activate_with_focus(window, time);
	}
}
