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
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;


let DEBUG = false;


function log(message) {
	if (DEBUG) {
		global.log('[EmDash] ' + message);
	}
}


function logger(name) {
	return (message) => {
		log('{' + name + '} ' + message);
	};
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
 * Calls a callback later. Later type options:
 * 
 * Meta.LaterType.RESIZE
 * Meta.LaterType.CALC_SHOWING
 * Meta.LaterType.CHECK_FULLSCREEN
 * Meta.LaterType.SYNC_STACK
 * Meta.LaterType.BEFORE_REDRAW
 * Meta.LaterType.IDLE
 * 
 * You can cancel the call by:
 * 
 * Meta.later_remove(id)
 */
function later(self, callback, laterType) {
	if (laterType === undefined) {
		laterType = Meta.LaterType.BEFORE_REDRAW;
	}
	callback = Lang.bind(self, callback)
	return Meta.later_add(laterType, () => {
		callback();
		return GLib.SOURCE_REMOVE;
	});
}


/**
 * Single signal connection.
 */
const SignalConnection = new Lang.Class({
	Name: 'EmDash.SignalConnection',

	_init: function(manager, site, name, callback, single, mode) {
		this.manager = manager;
		this.site = site;
		this.name = name;
		this.callback = callback;
		this.single = single;
		this.mode = mode || null;
		this.id = 0;
	},
	
	connect: function() {
		let callback = Lang.bind(this.manager._self, this.callback);
		
		if (this.single) {
			let connection = this;
			let originalCallback = callback;
			callback = () => {
				connection.disconnect();
				return originalCallback.apply(arguments);
			}
		}
		
		if (this.mode == 'after') {
			this.id = this.site.connect_after(this.name, callback);
		}
		else if (this.mode === 'property') {
			this.id = this.site.connect('notify::' + this.name, (site, paramSpec) => {
				let value = site[paramSpec.name];
				callback(site, value);
			});
		}
		else {
			this.id = this.site.connect(this.name, callback);
		}
		
		if (this.id > 0) {
			this.manager._connections.push(this);
			return true;
		}
		return false;
	},
	
	disconnect: function(remove) {
		this.site.disconnect(this.id);
		if (remove === undefined) {
			remove = true;
		}
		if (remove) {
			for (let i in this.manager._connections) {
				let connection = this.manager._connections[i];
				if (connection === this) {
					this.manager._connections.splice(i, 1);
					break;
				}
			}
		}
	}
});


/**
 * Manages signal connections.
 */
const SignalManager = new Lang.Class({
	Name: 'EmDash.SignalManager',

	_init: function(self) {
		this._self = self;
		this._connections = [];
	},
	
	connect: function(site, name, callback, single) {
		return this._connect(site, name, callback, single);
	},

	connectAfter: function(site, name, callback, single) {
		return this._connect(site, name, callback, single, 'after');
	},

	connectProperty: function(site, name, callback, single) {
		return this._connect(site, name, callback, single, 'property');
	},
	
	disconnect: function(callback) {
		for (let i in this._connections) {
			let connection = this._connections[i];
			if (connection.callback === callback) {
				connection.disconnect();
				return connection;
			}
		}
		return null;
	},

	destroy: function() {
		while (this._connections.length > 0) {
			let connection = this._connections.pop();
			connection.disconnect(false);
		}
	},
	
	_connect: function(site, name, callback, single, mode) {
		mode = mode || null;
		single = single || false;
		let connection = new SignalConnection(this, site, name, callback, single, mode);
		if (connection.connect()) {
			return connection;
		}
		return null;
	}
});
