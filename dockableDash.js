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
const St = imports.gi.St;

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
			(side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT),
			getAlignForAlignment(settings.get_string('alignment')));
		this._dockable = new Dockable.Dockable(this._icons.actor, side, toggle);

		this._signalManager.connectSetting(settings, 'visibility', 'string',
			this._onVisibilitySettingChanged);
		this._signalManager.connectSetting(settings, 'alignment', 'string',
			this._onAlignmentSettingChanged);
		this._signalManager.connectSetting(settings, 'stretch', 'boolean',
				this._onStretchSettingChanged);
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
    
	_onVisibilitySettingChanged: function(settings, visibility) {
		log('visibility-setting-changed: ' + visibility);
		let toggle = visibility === 'TOUCH_TO_SHOW';
		this._dockable.setToggle(toggle);
	},
    
	_onAlignmentSettingChanged: function(settings, alignment) {
		log('alignment-setting-changed: ' + alignment);
		let align = getAlignForAlignment(alignment);
		this._icons.setAlign(align);
	},
	
	_onStretchSettingChanged: function(setting, stretch) {
		if (stretch) {
			this._icons.actor.add_style_class_name('EmDash-DockableDash');
			this._icons._box.remove_style_class_name('EmDash-DockableDash');
		}
		else {
			this._icons._box.add_style_class_name('EmDash-DockableDash');
			this._icons.actor.remove_style_class_name('EmDash-DockableDash');
		}
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


function getAlignForAlignment(alignment) {
	switch (alignment) {
	case 'NEAR':
		return St.Align.START;
	case 'MIDDLE':
		return St.Align.MIDDLE;
	case 'FAR':
		return St.Align.END;
	}
}