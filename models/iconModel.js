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

const Lang = imports.lang;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const AppUtils = Me.imports.utils.app;
const WindowUtils = Me.imports.utils.window;

const log = LoggingUtils.logger('iconModel');


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
var IconModel = new Lang.Class({
	Name: 'EmDash.IconModel',

	_init(dashModel, app) {
		this.dashModel = dashModel;
		this.app = app;
		this._matchers = [];
		this._favorite = AppUtils.isFavoriteApp(app);

		let settings = dashModel.modelManager.settings;
		let windowMatchers = settings.get_value('icons-window-matchers');
		windowMatchers = windowMatchers.deep_unpack();
		if (app.id in windowMatchers) {
			let appWindowMatchers = windowMatchers[app.id];
			for (let windowMatcher of appWindowMatchers) {
				if (windowMatcher.length > 2) {
					log(`WARNING: window matcher for ${app.id} has more than two strings: ${windowMatcher.join(', ')}`);
					continue;
				}
				this.addMatcher(...windowMatcher);
			}
		}
	},

	/**
	 * Checks if we were created for the application.
	 */
	isFor(app) {
		return this.app.id === app.id;
	},

	/**
	 * Checks if we represent the application, either because we were created for it or we grab all
	 * its windows.
	 */
	isRepresenting(app) {
		if (this.isFor(app)) {
			return true;
		}

		// Are we grabbing all of the app's windows?
		if (this._matchers.length > 0) {
			let windows = app.get_windows();
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
	},

	/**
	 * Checks if we are grabbing a window.
	 */
	isGrabbing(window) {
		for (let matcher of this._matchers) {
			if (matcher.matches(window)) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Checks if we used to be favorite but no longer are.
	 */
	get isPrunable() {
		return this._favorite && !AppUtils.isFavoriteApp(this.app);
	},

	/**
	 * Associated windows, including those we grab, for all workspaces or for a specific workspace.
	 */
	getWindows(workspaceIndex) {
		let windows = [];

		// App windows
		let appWindows = this.app.get_windows();
		for (let window of appWindows) {
			if ((workspaceIndex !== undefined) &&
				(window.get_workspace().index() != workspaceIndex)) {
				continue;
			}
			windows.push(window);
		}

		// Grabbed windows
		if (this._matchers.length > 0) {
			let nWorkspaces = global.screen.n_workspaces;
			for (let theWorkspaceIndex = 0; theWorkspaceIndex < nWorkspaces; theWorkspaceIndex++) {
				if ((workspaceIndex !== undefined) &&
					(theWorkspaceIndex != workspaceIndex)) {
					continue;
				}
				let workspace = global.screen.get_workspace_by_index(theWorkspaceIndex);
				let workspaceWindows = workspace.list_windows();
				for (let window of workspaceWindows) {
					if (this.isGrabbing(window) && (windows.indexOf(window) == -1)) {
						windows.push(window);
					}
				}
			}
		}

		return windows;
	},

	/**
	 * Checks if any of our windows has focus, for all workspaces or for a specific workspace.
	 */
	hasFocus(workspaceIndex) {
		return WindowUtils.getFocusedWindowIndex(this.getWindows(workspaceIndex)) !== -1;
	},

	addMatcher(wmClass, wmClassInstance = null) {
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
	},

	/**
	 * Adds matchers for all the windows.
	 */
	addMatchersFor(windows) {
		let changed = false;
		for (let window of windows) {
			let wmClass = window.wm_class;
			let wmClassInstance = window.get_wm_class_instance();
			if (this.addMatcher(wmClass, wmClassInstance)) {
				changed = true;
			}
		}
		return changed;
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace.
	 */
	hide(workspaceIndex) {
		log('hide');
		return WindowUtils.hideWindows(this.getWindows(workspaceIndex));
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace if any of out windows has
	 * focus.
	 */
	hideIfHasFocus(workspaceIndex) {
		let windows = this.getWindows(workspaceIndex);
		if (WindowUtils.getFocusedWindowIndex(windows) !== -1) {
			log('hideIfHasFocus: true');
			WindowUtils.hideWindows(windows);
			return true;
		}
		log('hideIfHasFocus: false');
		return false;
	},

	/**
	 * Raises all windows and sets the focus to the primary window for all workspaces or for a
	 * specific workspace.
	 */
	focus(workspaceIndex) {
		let windows = this.getWindows(workspaceIndex);
		WindowUtils.raiseWindowsAndFocusPrimary(windows);
	},

	/**
	 * Cycle focus to next/previous window or optionally hide when reaching the end for all
	 * workspaces or for a specific workspace.
	 */
	cycleFocus(workspaceIndex, next, hideOnLast = false) {
		let windows = this.getWindows(workspaceIndex);
		if (windows.length === 0) {
			log('cycleFocus: do nothing');
			return;
		}

		let focusedWindowIndex = WindowUtils.getFocusedWindowIndex(windows);
		if (focusedWindowIndex === -1) {
			// Focus on first window
			log('cycleFocus: first');
			WindowUtils.focusWindow(windows[0]);
		}
		else if (next) {
			if (focusedWindowIndex < windows.length - 1) {
				// Focus on next window
				focusedWindowIndex += 1;
				log(`cycleFocus: next ${focusedWindowIndex}`);
				WindowUtils.focusWindow(windows[focusedWindowIndex]);
			}
			else if (hideOnLast) {
				log('cycleFocusOrHide: hide');
				this.hide(workspaceIndex);
			}
			else {
				log('cycleFocus: first');
				WindowUtils.focusWindow(windows[0]);
			}
		}
		else {
			if (focusedWindowIndex > 0) {
				// Focus on previous window
				focusedWindowIndex -= 1;
				log(`cycleFocus: previous ${focusedWindowIndex}`);
				WindowUtils.focusWindow(windows[focusedWindowIndex]);
			}
			else if (hideOnLast) {
				log('cycleFocusOrHide: hide');
				this.hide(workspaceIndex);
			}
			else {
				focusedWindowIndex = windows.length - 1;
				log(`cycleFocus: last ${focusedWindowIndex}`);
				WindowUtils.focusWindow(windows[focusedWindowIndex]);
			}
		}
	},

	save() {
		let appWindowMatchers = [];
		for (let matcher of this._matchers) {
			let matchers = [matcher.wmClass];
			if (matcher.wmClassInstance !== null) {
				matchers.push(matcher.wmClassInstance);
			}
			appWindowMatchers.push(matchers);
		}

		let settings = this.dashModel.modelManager.settings;
		let windowMatchers = settings.get_value('icons-window-matchers');
		windowMatchers = windowMatchers.deep_unpack();
		windowMatchers[this.app.id] = appWindowMatchers;
		windowMatchers = new GLib.Variant('a{saas}', windowMatchers)
		settings.set_value('icons-window-matchers', windowMatchers);
	},

	toString(workspaceIndex) {
		let s = '';
		if (this._favorite) {
			s += '*';
		}
		s += this.app.id; // get_name()
		if (this._matchers.length > 0) {
			s += '{' + this._matchers.join(',') + '}';
		}
		let windows = this.getWindows(workspaceIndex);
		if (windows.length > 0) {
			let window_strings = [];
			for (let window of windows) {
				window_strings.push(window.get_wm_class_instance());
			}
			s += '[' + window_strings.join(',') + ']';
		}
		return s;
	}
});


/**
 * Can match a window by its WM_CLASS and optionally its WM_CLASS_INSTANCE.
 */
var Matcher = new Lang.Class({
	Name: 'EmDash.Matcher',

	_init(wmClass, wmClassInstance = null) {
		this.wmClass = wmClass;
		this.wmClassInstance = wmClassInstance || null;
	},

	/**
	 * Checks if we match a window.
	 */
	matches(window) {
		let wmClass = window.wm_class;
		if (this.wmClass === wmClass) {
			if (this.wmClassInstance === null) {
				return true;
			}
			let wmClassInstance = window.get_wm_class_instance();
			if (this.wmClassInstance === wmClassInstance) {
				return true;
			}
		}
		return false;
	},

	toString() {
		if (this.wmClassInstance === null) {
			return this.wmClass;
		}
		return `this.wmClass: ${this.wmClassInstance}`;
	}
});
