/*
 * This file is part of the Em-Dash extension for GNOME.
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
 * Manages monkey patches.
 *
 * The patching function will receive a callable to the patched function prepended as its first
 * argument.
 */
const PatchManager = new Lang.Class({
	Name: 'EmDash.PatchManager',

	_init: function(self) {
		this.self = self;
		this._patches = [];
	},

	destroy: function() {
		while (this._patches.length > 0) {
			let patch = this._patches.pop();
			patch.destroy();
		}
	},

	patch(site, name, fn) {
		this._patches.push(new Patch(this, site, name, fn));
	},

	callOriginal: function(site, name, ...args) {
		let patch = this.get(site, name);
		return patch.callOriginal(...args);
	},

	get: function(site, name) {
		for (let i = 0; i < this._patches.length; i++) {
			let patch = this._patches[i];
			if ((patch.site === site) && (patch.name === name)) {
				return patch;
			}
		}
		return null;
	}
});


/**
 * A monkey patch.
 */
const Patch = new Lang.Class({
	Name: 'EmDash.Patch',

	_init: function(manager, site, name, fn) {
		this.manager = manager;
		this.site = site;
		this.name = name;
		this.fn = fn;

		this.originalFn = site[name];
		this.callOriginal = Lang.bind(this.site, this.originalFn);
		site[name] = Lang.bind(this, this.call);
	},

	destroy: function() {
		this.site[this.name] = this.originalFn;
	},

	call: function(...args) {
		args.unshift(this.callOriginal);
		return this.fn.apply(this.manager.self, args);
	}
});