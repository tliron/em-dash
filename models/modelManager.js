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
var ModelManager = class ModelManager {
	constructor(settings) {
		log('constructor');

		this.settings = settings;
		this.single = null;

		this._dashModels = new Map();
		this._initialized = false;

		// Signals
		const appFavorites = AppFavorites.getAppFavorites();
		const appSystem = Shell.AppSystem.get_default();
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connectSetting(settings, 'dash-per-workspace', 'boolean',
			this._onDashPerWorkspaceSettingChanged);
		this._signalManager.connectSetting(settings, 'icons-window-matchers', 'value',
			this._onIconsWindowMatchersSettingChanged);
		this._signalManager.connect(appSystem, 'app-state-changed', this._onAppStateChanged);
		this._signalManager.connect(appFavorites, 'changed', this._onFavoritesChanged);
		this._signalManager.connect(global.workspace_manager, 'workspace-added', this._onWorkspaceAdded);
		this._signalManager.connect(global.workspace_manager, 'workspace-removed', this._onWorkspaceRemoved);

		const nWorkspaces = global.workspace_manager.n_workspaces;
		for (let workspaceIndex = 0; workspaceIndex < nWorkspaces; workspaceIndex++) {
			this._onWorkspaceAdded(global.workspace_manager, workspaceIndex);
		}

		this._initialized = true;
	}

	destroy() {
		log('destroy');
		this._signalManager.destroy();
	}

	refresh() {
		this._reset();
		if (this._initialized) {
			this.emit('changed');
		}
	}

	getDashModel(workspaceIndex) {
		if (this.single) {
			// Single index for all workspaces
			workspaceIndex = SINGLE_WORKSPACE_INDEX;
		}
		if (this._dashModels.has(workspaceIndex)) {
			return this._dashModels.get(workspaceIndex);
		}
		const dashModel = new DashModel.DashModel(this);
		this._dashModels.set(workspaceIndex, dashModel);
		dashModel.addFavorites();
		if (workspaceIndex === SINGLE_WORKSPACE_INDEX) {
			dashModel.addRunning();
		}
		else {
			dashModel.addRunning(workspaceIndex);
		}
		return dashModel;
	}

	removeDashModel(workspaceIndex) {
		this._dashModels.delete(workspaceIndex);
	}

	/**
	 * Adds an icon for the application to a specific workspace if there is no icon already
	 * representing it.
	 */
	addTo(workspaceIndex, app) {
		return this.getDashModel(workspaceIndex).add(app);
	}

	/**
	 * Adds an icon for the application to all workspaces if there is no icon already representing
	 * it.
	 */
	addToAll(app) {
		if (this.single) {
			return this.addTo(SINGLE_WORKSPACE_INDEX, app);
		}
		let changed = false;
		const nWorkspaces = global.workspace_manager.n_workspaces;
		for (let workspaceIndex = 0; workspaceIndex < nWorkspaces; workspaceIndex++) {
			if (this.addTo(workspaceIndex, app)) {
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Adds an icon for the application to the workspaces for which it has windows if there is no
	 * icon already representing it.
	 */
	add(app) {
		if (this.single) {
			return this.addTo(SINGLE_WORKSPACE_INDEX, app);
		}
		let changed = false;
		const workspaceIndexes = AppUtils.getWorkspacesForApp(app);
		for (let workspaceIndex of workspaceIndexes) {
			if (this.addTo(workspaceIndex, app)) {
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Removes icons created for the application from all workspaces. Note that it will not remove
	 * icons that are grabbing it.
	 */
	remove(app) {
		let changed = false;
		for (let dashModel of this._dashModels.values()) {
			if (dashModel.remove(app)) {
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Removes icons that are no longer favorites.
	 */
	prune() {
		let changed = false;
		for (let dashModel of this._dashModels.values()) {
			if (dashModel.prune()) {
				changed = true;
			}
		}
		return changed;
	}

	log() {
		if (this.single) {
			if (this._dashModels.has(SINGLE_WORKSPACE_INDEX)) {
				const dashModel = this._dashModels.get(SINGLE_WORKSPACE_INDEX);
				log(`single: ${dashModel}`);
			}
		}
		else {
			for (let [workspaceIndex, dashModel] of this._dashModels) {
				log(`workspace ${workspaceIndex}: ${dashModel.toString(workspaceIndex)}`);
			}
		}
	}

	_reset() {
		this._dashModels.clear();
	}

	// Signals

	_onDashPerWorkspaceSettingChanged(settings, dashPerWorkspace) {
		log(`"dash-per-workspace" setting changed signal: ${dashPerWorkspace}`);
		const single = !dashPerWorkspace;
		if (this.single !== single) {
			this.single = single;
			this.refresh();
		}
	}

	_onIconsWindowMatchersSettingChanged(settings, windowMatchers) {
		log('"icons-window-matchers" setting changed signal');
		this.refresh();
	}

	_onAppStateChanged(appSystem, app) {
		const id = app.id;
		const state = app.state;
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
	}

	_onFavoritesChanged(favorites) {
		log('favorites "changed" signal');
		this.refresh();
	}

	_onWorkspaceAdded(screen, workspaceIndex) {
		log(`workspace manager "workspace-added" signal: ${workspaceIndex}`);

		// Signals
		const workspace = screen.get_workspace_by_index(workspaceIndex);
		workspace.connect('window-added', this._onWindowAdded.bind(this));
		workspace.connect('window-removed', this._onWindowRemoved.bind(this));
	}

	_onWorkspaceRemoved(screen, workspaceIndex) {
		// Note: this seems to never be called!
		log(`workspace manager "workspace-removed" signal: ${workspaceIndex}`);
		this.removeDashModel(workspaceIndex);
	}

	_onWindowAdded(workspace, window) {
		log('workspace "window-added" signal');
		this.refresh();
	}

	_onWindowRemoved(workspace, window) {
		log('workspace "window-removed" signal');
		this.refresh();
	}
};

Signals.addSignalMethods(ModelManager.prototype);
