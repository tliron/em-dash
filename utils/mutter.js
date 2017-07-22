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
const Meta = imports.gi.Meta;


/**
 * Manages deferred callbacks.
 */
var LaterManager = new Lang.Class({
	Name: 'EmDash.LaterManager',

	_init(self) {
		this._self = self;
		this._laters = new Set();
	},

	destroy() {
		// Forgetting to cancel these can result in crashes if the user enables and disables the
		// extension very quickly...
		for (let later of this._laters) {
			later.destroy();
		}
		this._laters.clear();
	},

	/**
	 * Later type options:
	 *
	 * * Meta.LaterType.RESIZE: call in a resize processing phase that is done before GTK+
	 *   repainting (including window borders) is done.
	 *
	 * * Meta.LaterType.CALC_SHOWING: used by Mutter to compute which windows should be mapped.
	 *
	 * * Meta.LaterType.CHECK_FULLSCREEN: used by Mutter to see if there's a fullscreen window.
	 *
	 * * Meta.LaterType.SYNC_STACK: used by Mutter to send its idea of the stacking order to the
	 *   server.
	 *
	 * * Meta.LaterType.BEFORE_REDRAW: call before the stage is redrawn. (the default.)
	 *
	 * * Meta.LaterType.IDLE: call at a very low priority (can be blocked by running animations or
	 *   redrawing applications)
	 */
	later(callback, type = Meta.LaterType.BEFORE_REDRAW) {
		const later = new Later(this._self, callback, type);
		if (later.initialize()) {
			this._laters.add(later);
			return true;
		}
		return false;
	},

	cancel(callback) {
		for (let later of this._laters) {
			if (later.callback === callback) {
				this._laters.delete(later);
				later.destroy();
				return true;
			}
		}
		return false;
	}
});


/**
 * Deferred callback.
 */
var Later = new Lang.Class({
	Name: 'EmDash.Later',

	_init(self, callback, type) {
		this.self = self;
		this.callback = callback;
		this.type = type;
		this.id = 0;
	},

	initialize() {
		this.id = Meta.later_add(this.type, Lang.bind(this.self, this.callback));
		return this.id != 0;
	},

	destroy() {
		if (this.id != 0) {
			Meta.later_remove(this.id);
			this.id = 0;
		}
	}
});
