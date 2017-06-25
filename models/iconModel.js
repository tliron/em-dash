/*
 * This file is part of the Em-Dash extension for GNOME.
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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const AppUtils = Me.imports.utils.app;
const WindowUtils = Me.imports.utils.window;
const CollectionUtils = Me.imports.utils.collection;

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
const IconModel = new Lang.Class({
	Name: 'EmDash.IconModel',

	_init: function(app) {
		this.app = app;
		this._matchers = [];
		this._favorite = AppUtils.isFavoriteApp(app);

		// HACK
		if (app.id === 'riot-web.desktop') {
			this._matchers.push(new Matcher('Riot'));
		}
		else if (app.id === 'cxmenu-cxoffice-4305e7ff-7a64-406d-8e9c-2e4e7ecf84ea-0483fdc-Steam.desktop') {
			this._matchers.push(new Matcher('Wine', 'Steam.exe'));
		}
		else if (app.id == 'org.gnome.Terminal.desktop') {
			this._matchers.push(new Matcher('Gnome-control-center'));
		}
	},

	/**
	 * Checks if we were created for the application.
	 */
	isFor: function(app) {
		return this.app.id === app.id;
	},

	/**
	 * Checks if we represent the application, either because we were created for it or we grab all
	 * its windows.
	 */
	isRepresenting: function(app) {
		if (this.isFor(app)) {
			return true;
		}

		// Are we grabbing all of the app's windows?
		if (this._matchers.length > 0) {
			let windows = app.get_windows();
			if (windows.length === 0) {
				return false;
			}
			for (let i = 0; i < windows.length; i++) {
				let window = windows[i];
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
	isGrabbing: function(window) {
		for (let i = 0; i < this._matchers.length; i++) {
			let matcher = this._matchers[i];
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
	getWindows: function(workspaceIndex) {
		let windows = [];

		// App windows
		let appWindows = this.app.get_windows();
		for (let i = 0; i < appWindows.length; i++) {
			let window = appWindows[i];
			if ((workspaceIndex !== undefined) &&
				(window.get_workspace().index() != workspaceIndex)) {
				continue;
			}
			windows.push(window);
		}

		// Grabbed windows
		if (this._matchers.length > 0) {
			let n_workspaces = global.screen.n_workspaces;
			for (let theWorkspaceIndex = 0; theWorkspaceIndex < n_workspaces; theWorkspaceIndex++) {
				if ((workspaceIndex !== undefined) &&
					(theWorkspaceIndex != workspaceIndex)) {
					continue;
				}
				let workspace = global.screen.get_workspace_by_index(theWorkspaceIndex);
				let workspaceWindows = workspace.list_windows();
				for (let i = 0; i < workspaceWindows.length; i++) {
					let window = workspaceWindows[i];
					if (this.isGrabbing(window) &&
						!CollectionUtils.arrayIncludes(windows, window)) {
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
	hasFocus: function(workspaceIndex) {
		return WindowUtils.getFocusedWindowIndex(this.getWindows(workspaceIndex)) !== -1;
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace.
	 */
	hide: function(workspaceIndex) {
		log('hide');
		return WindowUtils.hideWindows(this.getWindows(workspaceIndex));
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace if any of out windows has
	 * focus.
	 */
	hideIfHasFocus: function(workspaceIndex) {
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
	 * Cycle focus to next/previous window or optionally hide when reaching the end for all
	 * workspaces or for a specific workspace.
	 */
	cycleFocus: function(workspaceIndex, next, hideOnLast = false) {
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

	toString: function(workspaceIndex) {
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
			for (let i = 0; i < windows.length; i++) {
				let window = windows[i];
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
const Matcher = new Lang.Class({
	Name: 'EmDash.Matcher',

	_init: function(wmClass, wmClassInstance) {
		this._wmClass = wmClass;
		this._wmClassInstance = wmClassInstance || null;
	},

	/**
	 * Checks if we match a window.
	 */
	matches: function(window) {
		let wmClass = window.wm_class;
		if (this._wmClass === wmClass) {
			if (this._wmClassInstance === null) {
				return true;
			}
			let wmClassInstance = window.get_wm_class_instance();
			if (this._wmClassInstance === wmClassInstance) {
				return true;
			}
		}
		return false;
	},

	toString: function() {
		if (this._wmClassInstance === null) {
			return this._wmClass;
		}
		return `this._wmClass: ${this._wmClassInstance}`;
	}
});
