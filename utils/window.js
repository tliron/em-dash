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
	for (let i = 0; i < windows.length; i++) {
		let window = windows[i];
		if (window.has_focus()) {
			return i;
		}
	}
	return -1;
}


function hideWindows(windows) {
	for (let window of windows) {
		window.minimize();
	}
}


function focusWindow(window) {
	window.activate(global.get_current_time());
}


function raiseWindowsAndFocusPrimary(windows) {
	// Adapted from shell_app_activate_window in
	// https://github.com/GNOME/gnome-shell/blob/master/src/shell-app.c

	if (windows.length === 0) {
		log('raiseWindowsAndFocusPrimary: do nothing');
		return;
	}

	// Sort by user time
	windows.sort((a, b) => {
		return b.get_user_time() - a.get_user_time();
	});
	let window = windows.shift();

	let display = global.screen.get_display();

	// Is the display newer? (I don't understand what this is for...)
	let time = global.get_current_time();
	let displayTime = display.get_last_user_time();
	if (display.xserver_time_is_before(time, displayTime)) {
		log('raiseWindowsAndFocusPrimary: display is newer');
		window.set_demands_attention();
		return;
	}

	let activeWorkspace = global.screen.get_active_workspace();

	// Raise windows in this workspace (in reverse order to preserve stacking)
	windows.reverse();
	for (let window of windows) {
		if (window.get_workspace() === activeWorkspace) {
			window.unminimize();
			window.raise();
		}
	}

	// Find our newest transient in this workspace
	let transients = [];
	window.foreach_transient((transient) => {
		if (transient.get_workspace() === activeWorkspace) {
			let type = transient.window_type;
			if ((type === Meta.WindowType.NORMAL) || (type === Meta.WindowType.DIALOG)) {
				transients.push(transient);
			}
		}
	});
	transients = display.sort_windows_by_stacking(transients);
	let transient = transients.pop();

	// Is the transient newer than us?
	if ((transient !== undefined) &&
			display.xserver_time_is_before(window.get_user_time(), transient.get_user_time())) {
		window = transient;
		log('raiseWindowsAndFocusPrimary: transient is newer');
	}

	// Focus
	let workspace = window.get_workspace();
	if (workspace === activeWorkspace) {
		window.activate(time);
	}
	else {
		workspace.activate_with_focus(window, time);
	}
}
