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

const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const AppUtils = Me.imports.utils.app;
const WindowUtils = Me.imports.utils.window;

const log = LoggingUtils.logger('iconModel');

const ALL_WORKSPACES = -1;


/**
 * Represents a single dash icon.
 *
 * An icon can be based on an installed application or be "window-backed," which means there is no
 * known installed application for it. Window-backed icons are not very user-friendly, and so we
 * allow any icon to be configured to "grab" such window-backed icons.
 *
 * An icon is associated with a list of windows. Only favorite icons are allowed to stay in the dash
 * with no windows.
 */
var IconModel = class IconModel {
	constructor(dashModel, app) {
		this.dashModel = dashModel;
		this.app = app;
		this._favorite = AppUtils.isFavoriteApp(app);
		this._matchers = null;
	}

	/**
	 * Checks if we were created for the application.
	 */
	isFor(app) {
		return this.app.id === app.id;
	}

	/**
	 * Checks if we represent the application, either because we were created for it or we grab all
	 * its windows.
	 */
	isRepresenting(app) {
		if (this.isFor(app)) {
			return true;
		}

		// Are we grabbing all of the app's windows?
		this.load();
		if (this._matchers.length > 0) {
			const windows = app.get_windows();
			if (windows.length === 0) {
				return false;
			}
			for (let window of windows) {
				if (!this.isGrabbing(window)) {
					return false;
				}
			}
			return true;
		}

		return false;
	}

	/**
	 * Checks if we used to be favorite but no longer are.
	 */
	get isPrunable() {
		return this._favorite && !AppUtils.isFavoriteApp(this.app);
	}

	// Windows

	/**
	 * Associated windows, including those we grab, in all workspaces or in the current workspace,
	 * as configured.
	 */
	get windows() {
		if (this.dashModel.modelManager.single) {
			return this.allWindows;
		}
		else {
			return this.windowsInCurrentWorkspace;
		}
	}

	/**
	 * Associated windows, including those we grab, in all workspaces.
	 */
	get allWindows() {
		return this.getWindowsIn(ALL_WORKSPACES);
	}

	/**
	 * Associated windows, including those we grab, in all workspaces or in a specific workspace.
	 */
	get windowsInCurrentWorkspace() {
		const workspaceIndex = global.workspace_manager.get_active_workspace_index();
		return this.getWindowsIn(workspaceIndex);
	}

	/**
	 * Associated windows, including those we grab, in all workspaces or in a specific workspace.
	 */
	getWindowsIn(workspaceIndex) {
		const windows = [];

		// App windows
		const appWindows = this.app.get_windows();
		for (let window of appWindows) {
			if (!window.skip_taskbar &&
				((workspaceIndex === ALL_WORKSPACES) ||
				(window.get_workspace().index() === workspaceIndex))) {
				windows.push(window);
			}
		}

		// Grabbed windows
		this.load();
		if (this._matchers.length > 0) {
			const addGrabbed = (workspace) => {
				const workspaceWindows = workspace.list_windows();
				for (let window of workspaceWindows) {
					if (this.isGrabbing(window) && (windows.indexOf(window) == -1)) {
						windows.push(window);
					}
				}
			}

			if (workspaceIndex === ALL_WORKSPACES) {
				const nWorkspaces = global.workspace_manager.n_workspaces;
				for (let i = 0; i < nWorkspaces; i++) {
					const workspace = global.workspace_manager.get_workspace_by_index(i);
					addGrabbed(workspace);
				}
			}
			else {
				const workspace = global.workspace_manager.get_active_workspace();
				addGrabbed(workspace);
			}
		}

		return windows;
	}

	/**
	 * Checks if we are grabbing a window.
	 */
	isGrabbing(window) {
		this.load();
		for (let matcher of this._matchers) {
			if (matcher.matches(window)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Hides our windows in the current workspace.
	 */
	hide() {
		log('hide');
		return WindowUtils.hide(this.windowsInCurrentWorkspace);
	}

	/**
	 * Checks if any of our windows has focus.
	 */
	get hasFocus() {
		return WindowUtils.getFocusedWindowIndex(this.windows) !== -1;
	}

	/**
	 * Raises all windows in the current workspace and sets the focus to the primary window (which
	 * might be in a different workspace).
	 */
	focus() {
		// Windows for *all* workspaces, because the primary might not be on the current one
		WindowUtils.raiseAndFocus(this.allWindows);
	}

	/**
	 * Hides our windows if any of them has focus.
	 */
	hideIfHasFocus() {
		const windows = this.windows;
		if (WindowUtils.getFocusedWindowIndex(windows) !== -1) {
			log('hideIfHasFocus: true');
			WindowUtils.hide(windows);
			return true;
		}
		log('hideIfHasFocus: false');
		return false;
	}

	/**
	 * Cycle focus to next/previous window or optionally hide when reaching the end.
	 */
	cycleFocus(next, hideOnLast = false) {
		const windows = this.windows;
		if (windows.length === 0) {
			log('cycleFocus: do nothing');
			return;
		}

		let focusedWindowIndex = WindowUtils.getFocusedWindowIndex(windows);
		if (focusedWindowIndex === -1) {
			// Focus on first window
			log('cycleFocus: first');
			WindowUtils.focus(windows[0]);
		}
		else if (next) {
			if (focusedWindowIndex < windows.length - 1) {
				// Focus on next window
				focusedWindowIndex += 1;
				log(`cycleFocus: next ${focusedWindowIndex}`);
				WindowUtils.focus(windows[focusedWindowIndex]);
			}
			else if (hideOnLast) {
				log('cycleFocusOrHide: hide');
				this.hide(workspaceIndex);
			}
			else {
				log('cycleFocus: first');
				WindowUtils.focus(windows[0]);
			}
		}
		else {
			if (focusedWindowIndex > 0) {
				// Focus on previous window
				focusedWindowIndex -= 1;
				log(`cycleFocus: previous ${focusedWindowIndex}`);
				WindowUtils.focus(windows[focusedWindowIndex]);
			}
			else if (hideOnLast) {
				log('cycleFocusOrHide: hide');
				this.hide(workspaceIndex);
			}
			else {
				focusedWindowIndex = windows.length - 1;
				log(`cycleFocus: last ${focusedWindowIndex}`);
				WindowUtils.focus(windows[focusedWindowIndex]);
			}
		}
	}

	// Matchers

	addMatcher(wmClass, wmClassInstance = null) {
		this.load();
		for (let matcher of this._matchers) {
			if (matcher.wmClass === wmClass) {
				if (matcher.wmClassInstance === wmClassInstance) {
					// Already exists, nothing to add
					return false;
				}
				else if ((wmClassInstance !== null) && (matcher.wmClassInstance === null)) {
					// Just add class instance
					matcher.wmClassInstance = wmClassInstance;
					return true;
				}
			}
		}
		this._matchers.push(new Matcher(wmClass, wmClassInstance));
		return true;
	}

	/**
	 * Adds matchers for all the windows.
	 */
	addMatchersFor(windows) {
		let changed = false;
		for (let window of windows) {
			const wmClass = window.wm_class;
			const wmClassInstance = window.get_wm_class_instance();
			if (this.addMatcher(wmClass, wmClassInstance)) {
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Loads all matchers from settings.
	 */
	load() {
		if (this._matchers !== null) {
			return;
		}

		this._matchers = [];
		const settings = this.dashModel.modelManager.settings;
		const windowMatchers = settings.get_value('icons-window-matchers').deep_unpack();
		if (this.app.id in windowMatchers) {
			const appWindowMatchers = windowMatchers[this.app.id];
			for (let windowMatcher of appWindowMatchers) {
				if (windowMatcher.length > 2) {
					log(`WARNING: window matcher for ${app.id} has more than two strings: ${windowMatcher.join(', ')}`);
					continue;
				}
				this.addMatcher(...windowMatcher);
			}
		}
	}

	/**
	 * Saves all matchers to settings.
	 */
	save() {
		if (this._matchers === null) {
			return;
		}

		const appWindowMatchers = [];
		for (let matcher of this._matchers) {
			const matchers = [matcher.wmClass];
			if (matcher.wmClassInstance !== null) {
				matchers.push(matcher.wmClassInstance);
			}
			appWindowMatchers.push(matchers);
		}

		const settings = this.dashModel.modelManager.settings;
		let windowMatchers = settings.get_value('icons-window-matchers').deep_unpack();
		windowMatchers[this.app.id] = appWindowMatchers;
		windowMatchers = new GLib.Variant('a{saas}', windowMatchers)
		settings.set_value('icons-window-matchers', windowMatchers);
	}

	toString(workspaceIndex) {
		let s = '';
		if (this._favorite) {
			s += '*';
		}
		s += this.app.id; // get_name()
		this.load();
		if (this._matchers.length > 0) {
			s += '{' + this._matchers.join(',') + '}';
		}
		const windows = this.getWindowsIn(workspaceIndex);
		if (windows.length > 0) {
			const windowStrings = [];
			for (let window of windows) {
				windowStrings.push(window.get_wm_class_instance());
			}
			s += '[' + windowStrings.join(',') + ']';
		}
		return s;
	}
};


/**
 * Can match a window by its WM_CLASS and optionally its WM_CLASS_INSTANCE.
 */
var Matcher = class Matcher {
	constructor(wmClass, wmClassInstance = null) {
		this.wmClass = wmClass;
		this.wmClassInstance = wmClassInstance || null;
	}

	/**
	 * Checks if we match a window.
	 */
	matches(window) {
		const wmClass = window.wm_class;
		if (this.wmClass === wmClass) {
			if (this.wmClassInstance === null) {
				return true;
			}
			const wmClassInstance = window.get_wm_class_instance();
			if (this.wmClassInstance === wmClassInstance) {
				return true;
			}
		}
		return false;
	}

	toString() {
		if (this.wmClassInstance === null) {
			return this.wmClass;
		}
		return `this.wmClass: ${this.wmClassInstance}`;
	}
};
