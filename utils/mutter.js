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
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;


/*
 * Manages deferred callbacks.
 */
const LaterManager = new Lang.Class({
	Name: 'EmDash.LaterManager',

	_init: function(self) {
		this._self = self;
		this._laters = [];
	},

	/**
	 * Later type options:
	 * 
	 * * Meta.LaterType.RESIZE: call in a resize processing phase that is done before GTK+
	 *   repainting (including window borders) is done.
	 * * Meta.LaterType.CALC_SHOWING: used by Mutter to compute which windows should be mapped.
	 * * Meta.LaterType.CHECK_FULLSCREEN: used by Mutter to see if there's a fullscreen window.
	 * * Meta.LaterType.SYNC_STACK: used by Mutter to send its idea of the stacking order to the server.
	 * * Meta.LaterType.BEFORE_REDRAW: call before the stage is redrawn. (the default.)
	 * * Meta.LaterType.IDLE: call at a very low priority (can be blocked by running animations or
	 *   redrawing applications)
	 */
	later: function(callback, type) {
		if (type === undefined) {
			type = Meta.LaterType.BEFORE_REDRAW;
		}
		let later = new Later(this._self, callback, type);
		if (later.initialize()) {
			this._laters.push(later);
			return true;
		}
		return false;
	},
	
	cancel: function(callback) {
		for (let i  = 0; i < this._laters.length; i++) {
			let later = this._laters[i];
			if (later.callback === callback) {
				later.destroy();
				this._laters.splice(i, 1);
				return true;
			}
		}
		return false;
	},
	
	destroy: function() {
		// Forgetting to cancel these can result in crashes if the user enables and disables the
		// extension very quickly...
		while (this._laters.length > 0) {
			let later = this._laters.pop();
			later.cancel();
		}
	}
});


/**
 * Deferred callback.
 */
const Later = new Lang.Class({
	Name: 'EmDash.Later',

	_init: function(self, callback, type) {
		this.self = self;
		this.callback = callback;
		this.type = type;
		this.id = 0;
	},
	
	initialize: function() {
		let callback = Lang.bind(this.self, this.callback);
		this.id = Meta.later_add(this.type, () => {
			callback();
			// I could not find documentation for return values, but GNOME Shell code returns this
			return GLib.SOURCE_REMOVE;
		});
		return this.id != 0;
	},
	
	cancel: function() {
		if (this.id != 0) {
			Meta.later_remove(this.id);
			this.id = 0;
		}
	}
});
