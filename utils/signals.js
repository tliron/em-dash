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
		this._self = self;
		this._connections = [];
	},

	destroy: function() {
		while (this._connections.length > 0) {
			let connection = this._connections.pop();
			connection.disconnect(false);
		}
	},

	get: function(callback) {
		for (let i = 0; i < this._connections.length; i++) {
			let connection = this._connections[i];
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
		return this._connect(site, name, callback, single, 'setting.' + type);
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
		for (let i = 0; i < this._connections.length; i++) {
			let connection = this._connections[i];
			connection.block = true;
		}
	},

	unblock: function() {
		for (let i = 0; i < this._connections.length; i++) {
			let connection = this._connections[i];
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
		this.blocked = false;
		this.blockedReturn = null;
	},

	call: function() {
		if (this.blocked) {
			return this.blockedReturn;
		}
		let r = this.callback.apply(this.manager._self, arguments);
		if (this.single) {
			this.disconnect();
		}
		return r;
	},

	connect: function() {
		let callback = Lang.bind(this, this.call);

		let settingPrefix = 'setting.';

		if (this.mode === 'after') {
			this.id = this.site.connect_after(this.name, callback);
		}
		else if (this.mode === 'property') {
			this.id = this.site.connect('notify::' + this.name, (site, paramSpec) => {
				let value = site[paramSpec.name];
				callback(site, value);
			});
		}
		else if ((this.mode !== null) && this.mode.startsWith(settingPrefix)) {
			let signalName = 'changed::' + this.name;
			let type = this.mode.substring(settingPrefix.length);
			let getterName = 'get_' + type;
			this.id = this.site.connect(signalName, (settings, name) => {
				let value = settings[getterName](name);
				callback(settings, value);
			});
			this.site.emit(signalName, this.name);
		}
		else {
			this.id = this.site.connect(this.name, callback);
		}

		if (this.id != 0) {
			this.manager._connections.push(this);
			return true;
		}
		return false;
	},

	disconnect: function(remove) {
		if (this.id != 0) {
			this.site.disconnect(this.id);
			this.id = 0;
		}
		if (remove === undefined) {
			remove = true;
		}
		if (remove) {
			for (let i = 0; i < this.manager._connections.length; i++) {
				let connection = this.manager._connections[i];
				if (connection === this) {
					this.manager._connections.splice(i, 1);
					break;
				}
			}
		}
	}
});
