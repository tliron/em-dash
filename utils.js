/*
 * This file is part of the Em Dash extension for GNOME.
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
const AppFavorites = imports.ui.appFavorites;


let DEBUG = false;


function log(msg) {
	if (DEBUG) {
		global.log('[EmDash] ' + msg);
	}
}


function arrayIncludes(arr, value) {
	// ECMA 6 introduces Array.prototype.includes
	for (let i in arr) {
		if (arr[i] === value) {
			return true;
		}
	}
	return false;
}


function getWorkspacesForApp(app) {
	let workspaceIndexes = [];

	let n_workspaces = global.screen.n_workspaces; // GNOME 3.24 introduces screen.workspaces
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
	let appId = app.id;
	let appFavorites = AppFavorites.getAppFavorites();
	let favorites = appFavorites.getFavoriteMap();
	for (let theAppId in favorites) {
		if (theAppId === appId) {
			return true;
		}
	}
	return false;
}


/**
 * Manages signal connections.
 */
const SignalManager = new Lang.Class({
	Name: 'EmDash.SignalManager',

	_init: function(self) {
		this._self = self;
		this._entries = [];
	},
	
	on: function(obj, name, fn) {
		let boundFn = Lang.bind(this._self, fn);
		let id = obj.connect(name, boundFn);
		if (id > 0) {
			this._entries.push([id, obj, fn]);
		}
	},

	onAfter: function(obj, name, fn) {
		let boundFn = Lang.bind(this._self, fn);
		let id = obj.connect_after(name, fn);
		if (id > 0) {
			this._entries.push([id, obj, fn]);
		}
	},

	onProperty: function(obj, name, fn) {
		let boundFn = Lang.bind(this._self, fn);
		let id = obj.connect('notify::' + name, (obj, paramSpec) => {
			let value = obj[paramSpec.name];
			boundFn(obj, value);
		});
		if (id > 0) {
			this._entries.push([id, obj, fn]);
		}
	},
	
	off: function(fn) {
		for (let i in this._entries) {
			let entry = this._entries[i];
			let theFn = entry[2];
			if (fn === theFn) {
				let id = entry[0];
				let obj = entry[1];
				obj.disconnect(id);
			}
		}
	},

	destroy: function() {
		for (let i in this._entries) {
			let entry = this._entries[i];
			let id = entry[0];
			let obj = entry[1];
			obj.disconnect(id);
		}
		this._entries = [];
	}
});
