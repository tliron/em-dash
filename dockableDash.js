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
const Meta = imports.gi.Meta;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;
const Dockable = Me.imports.dockable;

const log = Utils.logger('dockableDash');


/**
 * Dash implementation that can be docked to the sides of the screen.
 */
const DockableDash = new Lang.Class({
	Name: 'EmDash.DockableDash',
	Extends: Dash.Dash,

	_init: function(settings, entryManager) {
		log('init');
		
		this._side = Meta.Side.LEFT;
		this._toggle = false;
		
		this.parent(settings, entryManager,
			(this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT));

		this._dockable = new Dockable.Dockable(this._icons.actor, this._side, this._toggle);

		this._signalManager.connect(this._settings, 'changed::position', this._onPositionChanged);
	},
	
	_onPositionChanged: function(settings, name) {
		log('>>>>>>>>>>>>>>>>>>>>> changed position!');
	},
    
    destroy: function() {
		log('destroy');
    	this._dockable.destroy();
    	this.parent();
    }
});
