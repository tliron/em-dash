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

const AppFavorites = imports.ui.appFavorites;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const AppUtils = Me.imports.utils.app;
const IconModel = Me.imports.models.iconModel;

const log = LoggingUtils.logger('dashModel');


/**
 * Manages a sequence of dash icons for a workspace.
 *
 * Favorite icons will appear first, in order, and on all workspaces.
 *
 * Other icons will appear after the favorites, and only if they have a window on the workspace.
 */
var DashModel = class DashModel {
	constructor(modelManager) {
		this.modelManager = modelManager;
		this.icons = [];
	}

	/**
	 * Check if we have an icon for the application.
	 */
	has(app) {
		return this.getIndexOf(app) !== -1;
	}

	/**
	 * Check if we have an icon representing the application.
	 */
	isRepresenting(app) {
		return this.getIndexOfRepresenting(app) !== -1;
	}

	/**
	 * Find the index of an icon for the application.
	 */
	getIndexOf(app) {
		for (let i = 0; i < this.icons.length; i++) {
			const icon = this.icons[i];
			if (icon.isFor(app)) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Find the index of an icon representing the application.
	 */
	getIndexOfRepresenting(app) {
		for (let i = 0; i < this.icons.length; i++) {
			const icon = this.icons[i];
			if (icon.isRepresenting(app)) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Add an icon for the application if there is no icon already representing it.
	 */
	add(app) {
		if (!this.isRepresenting(app)) {
			this.icons.push(new IconModel.IconModel(this, app));
			return true;
		}
		return false;
	}

	/**
	 * Adds icons for the favorite applications if there are no icons already representing them.
	 */
	addFavorites() {
		let changed = false;
		const favorites = AppFavorites.getAppFavorites().getFavorites();
		for (let app of favorites) {
			if (this.add(app)) {
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Adds icons for the running applications in one or all workspaces if there are no icons
	 * already representing them.
	 */
	addRunning(workspaceIndex) {
		let changed = false;
		const appSystem = Shell.AppSystem.get_default();
		const running = appSystem.get_running(); // will be empty when the shell is restarted
		for (let app of running) {
			if ((workspaceIndex === undefined) || AppUtils.isAppOnWorkspace(app, workspaceIndex)) {
				if (this.add(app)) {
					changed = true;
				}
			}
		}
		return changed;
	}

	/**
	 * Removes the icon created for the application. Note that it will not remove icons that are
	 * grabbing it.
	 */
	remove(app) {
		for (let i = 0; i < this.icons.length; i++) {
			const icon = this.icons[i];
			if (icon.isFor(app)) {
				this.icons.splice(i, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Removes an icon.
	 */
	removeIcon(icon) {
		const i = this.icons.indexOf(icon);
		if (i !== -1) {
			this.icons.splice(i, 1);
			return true;
		}
		return false;
	}

	/**
	 * Removes icons that are no longer favorites.
	 */
	prune() {
		const prunables = [];
		for (let icon of this.icons) {
			if (icon.isPrunable) {
				prunables.push(icon);
			}
		}
		let changed = false;
		for (let icon of prunables) {
			if (this.removeIcon(icon)) {
				changed = true;
			}
		}
		return changed;
	}

	toString(workspaceIndex) {
		const iconStrings = [];
		for (let icon of this.icons) {
			iconStrings.push(icon.toString(workspaceIndex));
		}
		return iconStrings.join(', ');
	}
};
