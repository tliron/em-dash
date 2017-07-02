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
const Signals = imports.signals;
const AppFavorites = imports.ui.appFavorites;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const AppUtils = Me.imports.utils.app;
const DashModel = Me.imports.models.dashModel;

const log = LoggingUtils.logger('modelManager');


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
const ModelManager = new Lang.Class({
	Name: 'EmDash.ModelManager',

	_init: function(settings) {
		log('_init');

		this.settings = settings;
		this.single = null;

		this._dashModels = new Map();

		// Signals
		let appFavorites = AppFavorites.getAppFavorites();
		let appSystem = Shell.AppSystem.get_default();
		this._signalManager = new SignalUtils.SignalManager(this);
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
		if (this._dashModels.has(workspaceIndex)) {
			return this._dashModels.get(workspaceIndex);
		}
		let dashModel = new DashModel.DashModel();
		this._dashModels.set(workspaceIndex, dashModel);
		dashModel.addFavorites();
		if (workspaceIndex === SINGLE_WORKSPACE_INDEX) {
			dashModel.addRunning();
		}
		else {
			dashModel.addRunning(workspaceIndex);
		}
		return dashModel;
	},

	removeDashModel: function(workspaceIndex) {
		this._dashModels.delete(workspaceIndex);
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
		let workspaceIndexes = AppUtils.getWorkspacesForApp(app);
		for (let workspaceIndex of workspaceIndexes) {
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
		for (let dashModel of this._dashModels.values()) {
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
		for (let dashModel of this._dashModels.values()) {
			if (dashModel.prune()) {
				changed = true;
			}
		}
		return changed;
	},

	log: function() {
		if (this.single) {
			if (SINGLE_WORKSPACE_INDEX in this._dashModels) {
				let dashModel = this._dashModels[SINGLE_WORKSPACE_INDEX];
				log(`single: ${dashModel}`);
			}
		}
		else {
			for (let dashModel of this._dashModels.values()) {
				log(`workspace ${workspaceIndex}: ${dashModel.toString(workspaceIndex)}`);
			}
		}
	},

	_reset: function() {
		this._dashModels.clear();
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
			if (!AppUtils.isFavoriteApp(app)) { // favorites stay
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

Signals.addSignalMethods(ModelManager.prototype);
