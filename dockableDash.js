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
const Clutter = imports.gi.Clutter;

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
		
		let side = getSideForPosition(settings.get_string('position'));
		let toggle = settings.get_string('visibility') === 'TOUCH_TO_SHOW';
		
		this.parent(settings, entryManager,
			(side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT));
		this._dockable = new Dockable.Dockable(this._icons.actor, side, toggle);
		
		this._signalManager.connect(settings, 'changed::visibility', this._onVisibilityChanged);
	},
	
    destroy: function() {
		log('destroy');
    	this._dockable.destroy();
    	this.parent();
    },

	setPosition: function(position) {
		let side = getSideForPosition(position);
		this._icons.setVertical((side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT));
		this._dockable.setSide(side);
	},
    
	_onVisibilityChanged: function(settings, name) {
		let toggle = settings.get_string('visibility') === 'TOUCH_TO_SHOW';
		this._dockable.setToggle(toggle);
	}
});


function getSideForPosition(position) {
	let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
	switch (position) {
	case 'EDGE_NEAR':
		return rtl ? Meta.Side.RIGHT : Meta.Side.LEFT;
	case 'EDGE_FAR':
		return rtl ? Meta.Side.LEFT : Meta.Side.RIGHT;
	case 'EDGE_BOTTOM':
		return Meta.Side.BOTTOM;
	}
}