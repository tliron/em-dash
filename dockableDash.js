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
const Logging = Me.imports.utils.logging;
const Dockable = Me.imports.utils.dockable;
const Dash = Me.imports.dash;

const log = Logging.logger('dockableDash');


/**
 * Dash implementation that can be docked to the sides of the screen.
 */
const DockableDash = new Lang.Class({
	Name: 'EmDash.DockableDash',
	Extends: Dash.Dash,

	_init: function(settings, entryManager, location) {
		log('init');
		
		let side = getMutterSideForLocation(location);
		let align = getStAlignForAlignment(settings.get_string('alignment'));
		let stretch = settings.get_boolean('stretch');
		let toggle = settings.get_string('visibility') === 'TOUCH_TO_SHOW';
		
		this.parent(settings, entryManager,
			(side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT));

		// Give our dash the GNOME theme's styling
		this._icons.actor.name = 'dash';
		this._updateStyle(side);
		
		//this._icons.actor.set_text_direction(Clutter.TextDirection.RTL);
		//this._icons.actor.add_style_class_name('dash-item-container');
		
		this._dockable = new Dockable.Dockable(this._icons.actor, side, align, stretch, toggle);
		//this._icons.actor.add_style_class_name('EmDash-DockableDash');

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

	setLocation: function(location) {
		let side = getMutterSideForLocation(location);
		this._icons.setVertical((side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT));
		this._dockable.setSide(side);
		this._updateStyle(side);
	},
	
	_updateStyle: function(side) {
		if (side === Meta.Side.RIGHT) {
			this._icons.actor.add_style_pseudo_class('rtl');
		}
		else {
			this._icons.actor.remove_style_pseudo_class('rtl');
		}
		if (side === Meta.Side.BOTTOM) {
			this._icons.actor.add_style_class_name('em-dash-no-border');
		}
		else {
			this._icons.actor.remove_style_class_name('em-dash-no-border');
		}
	},
    
	_onVisibilitySettingChanged: function(settings, visibility) {
		log('visibility-setting-changed: ' + visibility);
		let toggle = visibility === 'TOUCH_TO_SHOW';
		this._dockable.setToggle(toggle);
	},
    
	_onAlignmentSettingChanged: function(settings, alignment) {
		log('alignment-setting-changed: ' + alignment);
		let align = getStAlignForAlignment(alignment);
		this._dockable.setAlign(align);
	},
	
	_onStretchSettingChanged: function(setting, stretch) {
		this._dockable.setStretch(stretch);
	}
});


/*
 * Utils
 */

function getMutterSideForLocation(location) {
	let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
	switch (location) {
	case 'EDGE_NEAR':
		return rtl ? Meta.Side.RIGHT : Meta.Side.LEFT;
	case 'EDGE_FAR':
		return rtl ? Meta.Side.LEFT : Meta.Side.RIGHT;
	case 'EDGE_BOTTOM':
		return Meta.Side.BOTTOM;
	}
}


function getStAlignForAlignment(alignment) {
	switch (alignment) {
	case 'NEAR':
		return St.Align.START;
	case 'MIDDLE':
		return St.Align.MIDDLE;
	case 'FAR':
		return St.Align.END;
	}
}
