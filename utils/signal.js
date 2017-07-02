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


/**
 * Manages signal connections.
 *
 * Supports single connections (called only one time).
 *
 * You can get individual connections, block them temporarily, or disconnect and then reconnect
 * them.
 */
const SignalManager = new Lang.Class({
	Name: 'EmDash.SignalManager',

	_init: function(self) {
		this.self = self;
		this._connections = new Set();
	},

	destroy: function() {
		for (let connection of this._connections) {
			connection.disconnect(false);
		}
		this._connections.clear();
	},

	get: function(callback) {
		for (let connection of this._connections) {
			if (connection.callback === callback) {
				return connection;
			}
		}
		return null;
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

	connectSetting: function(site, name, type, callback, single) {
		return this._connect(site, name, callback, single, `setting.${type}`);
	},

	disconnect: function(callback) {
		let connection = this.get(callback);
		if (connection !== null) {
			connection.disconnect();
			return connection;
		}
		return null;
	},

	block: function() {
		for (let connection of this._connections) {
			connection.block = true;
		}
	},

	unblock: function() {
		for (let connection of this._connections) {
			connection.block = false;
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


/**
 * A signal connection.
 *
 * Set "blocked" to true to temporarily block the connection, and "blockedReturn" to return a
 * specific value while blocked.
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
		this.blocked = false;
		this.blockedReturn = null;
		this.boundCall = Lang.bind(this, this.call);
	},

	call: function(...args) {
		if (this.blocked) {
			return this.blockedReturn;
		}
		if (this.single) {
			this.disconnect();
		}
		return this.callback.apply(this.manager.self, args);
	},

	connect: function() {
		if (this.mode === 'after') {
			this.id = this.site.connect_after(this.name, this.boundCall);
		}
		else if (this.mode === 'property') {
			this.id = this.site.connect(`notify::${this.name}`, (site, paramSpec) => {
				let value = site[paramSpec.name];
				this.call(site, value);
			});
		}
		else if ((this.mode !== null) && this.mode.startsWith('setting.')) {
			let signalName = `changed::${this.name}`;
			let type = this.mode.substring('setting.'.length);
			let getterName = `get_${type}`;
			this.id = this.site.connect(signalName, (settings, name) => {
				let value = settings[getterName](name);
				this.call(settings, value);
			});
			this.site.emit(signalName, this.name);
		}
		else {
			this.id = this.site.connect(this.name, this.boundCall);
		}

		if (this.id != 0) {
			this.manager._connections.add(this);
			return true;
		}
		return false;
	},

	disconnect: function(remove = true) {
		if (this.id != 0) {
			this.site.disconnect(this.id);
			this.id = 0;
		}
		if (remove) {
			this.manager._connections.delete(this);
		}
	}
});
