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
const Signals = imports.signals;
const AppFavorites = imports.ui.appFavorites;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const SignalsUtils = Me.imports.utils.signals;
const Collections = Me.imports.utils.collections;

const log = Logging.logger('models');


const SINGLE_WORKSPACE_INDEX = -1;


/**
 * Manages dash icon sequences.
 *
 * Can be configured to use a separate icon sequence for each workspace, or single icon sequence for
 * all of them.
 *
 * Icons will be added and removed in response to applications being opened or closed, as well as
 * changes to the list of favorite applications.
 *
 * Internally relies on the GNOME Shell AppSystem, but with enhancements to support per-workspace
 * tracking and window grabbing.
 */
const DashModelManager = new Lang.Class({
	Name: 'EmDash.DashModelManager',

	_init: function(settings) {
		log('_init');

		this.settings = settings;
		this.single = null;

		let appFavorites = AppFavorites.getAppFavorites();
		let appSystem = Shell.AppSystem.get_default();
		this._signalManager = new SignalsUtils.SignalManager(this);
		this._signalManager.connectSetting(settings, 'dash-per-workspace', 'boolean',
			this._onDashPerWorkspaceSettingChanged); // triggers a refresh immediately
		this._signalManager.connect(appSystem, 'app-state-changed', this._onStateChanged);
		this._signalManager.connect(appFavorites, 'changed', this._onFavoritesChanged);
		this._signalManager.connect(global.screen, 'workspace-added', this._onWorkspaceAdded);
		this._signalManager.connect(global.screen, 'workspace-removed', this._onWorkspaceRemoved);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
	},

	refresh: function() {
		this._reset();
		this.emit('changed');
	},

	getDashModel: function(workspaceIndex) {
		if (this.single) {
			workspaceIndex = SINGLE_WORKSPACE_INDEX;
		}
		let dashModel = this._dashModels[workspaceIndex];
		if (dashModel === undefined) {
			dashModel = this._dashModels[workspaceIndex] = new DashModel();
			dashModel.addFavorites();
			if (workspaceIndex === SINGLE_WORKSPACE_INDEX) {
				dashModel.addRunning();
			}
			else {
				dashModel.addRunning(workspaceIndex);
			}
		}
		return dashModel;
	},

	removeDashModel: function(workspaceIndex) {
		delete this._dashModels[workspaceIndex];
	},

	/**
	 * Adds an icon for the application to a specific workspace if there is no icon already
	 * representing it.
	 */
	addTo: function(workspaceIndex, app) {
		return this.getDashModel(workspaceIndex).add(app);
	},

	/**
	 * Adds an icon for the application to all workspaces if there is no icon already representing
	 * it.
	 */
	addToAll: function(app) {
		if (this.single) {
			return this.addTo(SINGLE_WORKSPACE_INDEX, app);
		}
		let changed = false;
		let n_workspaces = global.screen.n_workspaces;
		for (let workspaceIndex = 0; workspaceIndex < n_workspaces; workspaceIndex++) {
			if (this.addTo(workspaceIndex, app)) {
				changed = true;
			}
		}
		return changed;
	},

	/**
	 * Adds an icon for the application to the workspaces for which it has windows if there is no
	 * icon already representing it.
	 */
	add: function(app) {
		if (this.single) {
			return this.addTo(SINGLE_WORKSPACE_INDEX, app);
		}
		let changed = false;
		let workspaceIndexes = getWorkspacesForApp(app);
		for (let i = 0; i < workspaceIndexes.length; i++) {
			let workspaceIndex = workspaceIndexes[i];
			if (this.addTo(workspaceIndex, app)) {
				changed = true;
			}
		}
		return changed;
	},

	/**
	 * Removes icons created for the application from all workspaces. Note that it will not remove
	 * icons that are grabbing it.
	 */
	remove: function(app) {
		let changed = false;
		for (let workspaceIndex in this._dashModels) {
			let dashModel = this._dashModels[workspaceIndex];
			if (dashModel.remove(app)) {
				changed = true;
			}
		}
		return changed;
	},

	/**
	 * Removes icons that are no longer favorites.
	 */
	prune: function() {
		let changed = false;
		for (let workspaceIndex in this._dashModels) {
			let dashModel = this._dashModels[workspaceIndex];
			if (dashModel.prune()) {
				changed = true;
			}
		}
		return changed;
	},

	log: function() {
		if (this.single) {
			let dashModel = this._dashModels[SINGLE_WORKSPACE_INDEX];
			if (dashModel !== undefined) {
				log(`single: ${dashModel}`);
			}
		}
		else {
			for (let workspaceIndex in this._dashModels) {
				let dashModel = this._dashModels[workspaceIndex];
				log(`workspace ${workspaceIndex}: ${dashModel.toString(workspaceIndex)}`);
			}
		}
	},

	_reset: function() {
		this._dashModels = {};
	},

	_onDashPerWorkspaceSettingChanged: function(settings, dashPerWorkspace) {
		log(`"dash-per-workspace" setting changed signal: ${dashPerWorkspace}`);
		let single = !dashPerWorkspace;
		if (this.single !== single) {
			this.single = single;
			this.refresh();
		}
	},

	_onStateChanged: function(appSystem, app) {
		let id = app.id;
		let state = app.state;
		if (state == Shell.AppState.STARTING) {
			log(`app system "app-state-changed" signal: ${id} starting`);
		}
		else if (state == Shell.AppState.RUNNING) {
			// Note: running events will be sent for each open app when the shell is restarted
			log(`app system "app-state-changed" signal: ${id} running`);
			if (this.add(app)) {
				this.emit('changed');
			}
		}
		else if (state == Shell.AppState.STOPPED) {
			log(`app system "app-state-changed" signal: ${id} stopped`);
			if (!isFavoriteApp(app)) { // favorites stay
				if (this.remove(app)) {
					this.emit('changed');
				}
			}
		}
	},

	_onFavoritesChanged: function(favorites) {
		log('favorites "changed" signal');
		this.refresh();
	},

	_onWorkspaceAdded: function(screen, workspaceIndex) {
		log(`screen "workspace-added" signal: ${workspaceIndex}`);
		// Nothing to do: new workspaces are created on demand
	},

	_onWorkspaceRemoved: function(screen, workspaceIndex) {
		log(`screen "workspace-removed" signal: ${workspaceIndex}`);
		this.removeDashModel(workspaceIndex);
	}
});

Signals.addSignalMethods(DashModelManager.prototype);


/**
 * Manages a sequence of dash icons for a workspace.
 *
 * Favorite icons will appear first, in order, and on all workspaces.
 *
 * Other icons will appear after the favorites, and only if they have a window on the workspace.
 */
const DashModel = new Lang.Class({
	Name: 'EmDash.DashModel',

	_init: function() {
		this.icons = [];
	},

	/**
	 * Check if we have an icon representing the application.
	 */
	isRepresenting: function(app) {
		return this.getIndexOfRepresenting(app) !== null;
	},

	/**
	 * Find the index of an icon representing the application.
	 */
	getIndexOfRepresenting: function(app) {
		for (let i = 0; i < this.icons.length; i++) {
			let icon = this.icons[i];
			if (icon.isRepresenting(app)) {
				return i;
			}
		}
		return null;
	},


	/**
	 * Add an icon for the application if there is no icon already representing it.
	 */
	add: function(app) {
		if (!this.isRepresenting(app)) {
			this.icons.push(new IconModel(app));
			return true;
		}
		return false;
	},

	/**
	 * Adds icons for the favorite applications if there are no icons already representing them.
	 */
	addFavorites: function() {
		let changed = false;
		let favorites = AppFavorites.getAppFavorites().getFavorites();
		for (let i = 0; i < favorites.length; i++) {
			let app = favorites[i];
			if (this.add(app)) {
				changed = true;
			}
		}
		return changed;
	},

	/**
	 * Adds icons for the running applications in one or all workspaces if there are no icons
	 * already representing them.
	 */
	addRunning: function(workspaceIndex) {
		let changed = false;
		let appSystem = Shell.AppSystem.get_default();
		let running = appSystem.get_running(); // will be empty when the shell is restarted
		for (let i = 0; i < running.length; i++) {
			let app = running[i];
			if (workspaceIndex === undefined) {
				if (this.add(app)) {
					changed = true;
				}
			}
			else {
				if (isAppOnWorkspace(app, workspaceIndex)) {
					if (this.add(app)) {
						changed = true;
					}
				}
			}
		}
		return changed;
	},

	/**
	 * Removes the icon created for the application. Note that it will not remove icons that are
	 * grabbing it.
	 */
	remove: function(app) {
		for (let i = 0; i < this.icons.length; i++) {
			let icon = this.icons[i];
			if (icon.isFor(app)) {
				this.icons.splice(i, 1);
				return true;
			}
		}
		return false;
	},

	/**
	 * Removes an icon.
	 */
	removeIcon: function(icon) {
		for (let i = 0; i < this.icons.length; i++) {
			if (this.icons[i] === icon) {
				this.icons.splice(i, 1);
				return true;
			}
		}
		return false;
	},

	/**
	 * Removes icons that are no longer favorites.
	 */
	prune: function() {
		let prunables = [];
		for (let i = 0; i < this.icons.length; i++) {
			let icon = this.icons[i];
			if (icon.isPrunable) {
				prunables.push(icon);
			}
		}
		let changed = false;
		for (let i = 0; i < prunables.length; i++) {
			if (this.removeIcon(prunables[i])) {
				changed = true;
			}
		}
		return changed;
	},

	toString: function(workspaceIndex) {
		let iconStrings = [];
		for (let i = 0; i < this.icons.length; i++) {
			let icon = this.icons[i];
			iconStrings.push(icon.toString(workspaceIndex));
		}
		return iconStrings.join(', ');
	}
});


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
		this._favorite = isFavoriteApp(app);

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
		return this._favorite && !isFavoriteApp(this.app);
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
					if (this.isGrabbing(window) && !Collections.arrayIncludes(windows, window)) {
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
		return getFocusedWindowIndex(this.getWindows(workspaceIndex)) !== -1;
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace.
	 */
	hide: function(workspaceIndex) {
		log('hide');
		return hideWindows(this.getWindows(workspaceIndex));
	},

	/**
	 * Hides our windows for all workspaces or for a specific workspace if any of out windows has
	 * focus.
	 */
	hideIfHasFocus: function(workspaceIndex) {
		let windows = this.getWindows(workspaceIndex);
		if (getFocusedWindowIndex(windows) !== -1) {
			log('hideIfHasFocus: true');
			hideWindows(windows);
			return true;
		}
		log('hideIfHasFocus: false');
		return false;
	},

	/**
	 * Move focus to next window or hide if focused on last window for all workspaces or for a
	 * specific workspace.
	 */
	cycleFocusOrHide: function(workspaceIndex) {
		let windows = this.getWindows(workspaceIndex);
		if (windows.length === 0) {
			log('cycleFocusOrHide: do nothing');
			return;
		}

		let focusedWindowIndex = getFocusedWindowIndex(windows);
		if (focusedWindowIndex === -1) {
			// Focus on first window
			log('cycleFocusOrHide: first');
			focusWindow(windows[0]);
		}
		else if (focusedWindowIndex < windows.length - 1 ) {
			// Focus on next window
			focusedWindowIndex += 1;
			log(`cycleFocusOrHide: ${focusedWindowIndex}`);
			focusWindow(windows[focusedWindowIndex]);
		}
		else {
			log('cycleFocusOrHide: hide');
			this.hide(workspaceIndex);
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


/*
 * Utils
 */

function getWorkspacesForApp(app) {
	let workspaceIndexes = [];

	let n_workspaces = global.screen.n_workspaces;
	for (let workspaceIndex = 0; workspaceIndex < n_workspaces; workspaceIndex++) {
		let workspace = global.screen.get_workspace_by_index(workspaceIndex);
		if (app.is_on_workspace(workspace)) {
			workspaceIndexes.push(workspaceIndex);
		}
	}

	return workspaceIndexes;
}


function isAppOnWorkspace(app, workspaceIndex) {
	let workspace = global.screen.get_workspace_by_index(workspaceIndex);
	return app.is_on_workspace(workspace);
}


function isFavoriteApp(app) {
	let favorites = AppFavorites.getAppFavorites().getFavorites();
	return favorites.indexOf(app) != -1;
}


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
	for (let i = 0; i < windows.length; i++) {
		let window = windows[i];
		window.minimize();
	}
}


function focusWindow(window) {
	window.unminimize();
	window.raise();
	window.focus(Clutter.CURRENT_TIME);
}
