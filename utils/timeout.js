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
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;


var TimeoutManager = new Lang.Class({
	Name: 'EmDash.TimeoutManager',

	_init(self) {
		this.self = self;
		this._timeouts = new Set();
	},

	destroy() {
		for (let timeout of this._timeouts) {
			timeout.destroy();
		}
		this._timeouts.clear();
	},

	add(time, name, callback) {
		this._timeouts.add(new Timeout(time, name, this.self, callback));
	},

	cancel(name) {
		for (let timeout of this._timeouts) {
			if (timeout.name === name) {
				this._timeouts.delete(timeout);
				timeout.destroy();
				return true;
			}
		}
		return false;
	},

	cancelAndAdd(time, name, callback) {
		this.cancel(name);
		this.add(time, name, callback);
	}
});


var Timeout = new Lang.Class({
	Name: 'EmDash.Timeout',

	_init(time, name, self, callback) {
		this.name = name;
		this.self = self;
		this.callback = callback;
		this.id = Mainloop.timeout_add(time, Lang.bind(this, this.call));
		if (this.id !== 0) {
			GLib.Source.set_name_by_id(this.id, `[em-dash] ${name}`);
		}
	},

	destroy() {
		if (this.id !== 0) {
			Mainloop.source_remove(this.id);
			this.id = 0;
		}
	},

	call() {
		this.id = 0;
		this.callback.call(this.self);
		return GLib.SOURCE_REMOVE;
	}
});
