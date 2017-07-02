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
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;

const log = LoggingUtils.logger('st');


/**
 * An St container for a single child to which you can assign a preferred size.
 *
 * Note that's not actually a subclass of St.Bin, but it behaves similarly.
 *
 * Note also that this is a GObject class!
 */
const FlexBin = new Lang.Class({
	Name: 'EmDash-FlexBin', // can't use "." with GObject classes
	Extends: Shell.GenericContainer,

	_init: function(params) {
		params = params || {};

		this.preferred_width = 0;
		this.preferred_height = 0;
		let child = null;

		if ('preferred_width' in params) {
			this.preferred_width = params['preferred_width'];
			delete params['preferred_width'];
		}
		if ('preferred_height' in params) {
			this.preferred_height = params['preferred_height'];
			delete params['preferred_height'];
		}
		if ('child' in params) {
			child = params['child'];
			delete params['child'];
		}

		this.parent(params);

		if (child !== null) {
			this.add_child(child);
		}

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this, 'destroy', this._onDestroy);
		this._signalManager.connect(this, 'allocate', this._onAllocate);
		this._signalManager.connect(this, 'get-preferred-width', this._onGetPreferredWidth);
		this._signalManager.connect(this, 'get-preferred-height', this._onGetPreferredHeight);
	},

	_onDestroy: function() {
		this._signalManager.destroy();
	},

	_onAllocate: function(actor, box, flags) {
        let child = actor.get_first_child();
        if (child !== null) {
	        child.allocate(box, flags);
        }
	},

	_onGetPreferredWidth: function(actor, forHeight, alloc) {
		alloc.min_size = 0;
		alloc.natural_size = this.preferred_width;
		log(`_onGetPreferredWidth: ${this.preferred_width}`);
	},

	_onGetPreferredHeight: function(actor, forWidth, alloc) {
		alloc.min_size = 0;
		alloc.natural_size = this.preferred_height;
		log(`_onGetPreferredHeight: ${this.preferred_height}`);
	}
});
