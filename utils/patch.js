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

/**
 * Manages monkey patches.
 *
 * The patching function will receive a callable to the patched function prepended as its first
 * argument.
 */
var PatchManager = class PatchManager {
	constructor(self) {
		this.self = self;
		this._patches = new Set();
	}

	destroy() {
		for (let patch of this._patches) {
			patch.destroy();
		}
		this._patches.clear();
	}

	patch(site, name, fn) {
		this._patches.add(new Patch(this.self, site, name, fn));
	}

	callOriginal(site, name, ...args) {
		const patch = this.get(site, name);
		return patch.callOriginal(...args);
	}

	get(site, name) {
		for (let patch of this._patches) {
			if ((patch.site === site) && (patch.name === name)) {
				return patch;
			}
		}
		return null;
	}
};


/**
 * A monkey patch.
 */
var Patch = class Patch {
	constructor(self, site, name, fn) {
		this.self = self;
		this.site = site;
		this.name = name;
		this.fn = fn;

		this.originalFn = site[name];
		this.callOriginal = this.originalFn.bind(site);
		site[name] = this.call.bind(this);
	}

	destroy() {
		this.site[this.name] = this.originalFn;
	}

	call(...args) {
		args.unshift(this.callOriginal);
		return this.fn.apply(this.self, args);
	}
};
