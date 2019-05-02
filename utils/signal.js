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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const log = LoggingUtils.logger('signal');


/**
 * Manages signal connections.
 *
 * Supports single connections (called only one time).
 *
 * You can get individual connections, block them temporarily, or disconnect and then reconnect
 * them.
 *
 * WARNING: The signal manager *will* keep references to the objects to which you connect, so
 * it will keep them from being garbage-collected.
 */
var SignalManager = class SignalManager {
	constructor(self) {
		this.self = self;
		this._connections = new Set();
	}

	destroy() {
		log(`destroy: ${this.self}`);
		for (let connection of this._connections) {
			connection.disconnect(false);
		}
		this._connections.clear();
	}

	get(callback) {
		for (let connection of this._connections) {
			if (connection.callback === callback) {
				return connection;
			}
		}
		return null;
	}

	getFor(site, name) {
		for (let connection of this._connections) {
			if ((connection.site === site) && (connection.name == name)) {
				return connection;
			}
		}
		return null;
	}

	connect(site, name, callback, single) {
		return this._connect(site, name, callback, single);
	}

	connectAfter(site, name, callback, single) {
		return this._connect(site, name, callback, single, 'after');
	}

	connectProperty(site, name, callback, single) {
		return this._connect(site, name, callback, single, 'property');
	}

	connectSetting(site, name, type, callback, single) {
		return this._connect(site, name, callback, single, `setting.${type}`);
	}

	disconnect(callback) {
		const connection = this.get(callback);
		if (connection !== null) {
			connection.disconnect();
			return connection;
		}
		return null;
	}

	disconnectFor(site) {
		for (let connection of this._connections) {
			if (connection.site === site) {
				connection.disconnect();
			}
		}
	}

	block() {
		for (let connection of this._connections) {
			connection.block = true;
		}
	}

	unblock() {
		for (let connection of this._connections) {
			connection.block = false;
		}
	}

	_connect(site, name, callback, single, mode) {
		mode = mode || null;
		single = single || false;
		const connection = new SignalConnection(this, site, name, callback, single, mode);
		if (connection.connect()) {
			return connection;
		}
		return null;
	}
};


/**
 * A signal connection.
 *
 * Set "blocked" to true to temporarily block the connection, and "blockedReturn" to return a
 * specific value while blocked.
 */
var SignalConnection = class SignalConnection {
	constructor(manager, site, name, callback, single, mode) {
		this.manager = manager;
		this.site = site;
		this.name = name;
		this.callback = callback;
		this.single = single;
		this.mode = mode || null;
		this.id = 0;
		this.blocked = false;
		this.blockedReturn = null;
		this.boundCall = this.call.bind(this);
	}

	call(...args) {
		if (this.blocked) {
			return this.blockedReturn;
		}
		if (this.single) {
			this.disconnect();
		}
		return this.callback.apply(this.manager.self, args);
	}

	connect() {
		if (this.mode === 'after') {
			this.id = this.site.connect_after(this.name, this.boundCall);
		}
		else if (this.mode === 'property') {
			this.id = this.site.connect(`notify::${this.name}`, (site, paramSpec) => {
				const value = site[paramSpec.name];
				this.call(site, value);
			});
		}
		else if ((this.mode !== null) && this.mode.startsWith('setting.')) {
			const signalName = `changed::${this.name}`;
			const type = this.mode.substring('setting.'.length);
			const getterName = `get_${type}`;
			this.id = this.site.connect(signalName, (settings, name) => {
				const value = settings[getterName](name);
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
	}

	disconnect(remove = true) {
		if (remove) {
			this.manager._connections.delete(this);
		}
		if (this.id != 0) {
			this.site.disconnect(this.id);
			this.id = 0;
		}
	}
};
