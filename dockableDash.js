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
		log('DockableDash._init');
		
		let side = getMutterSideForLocation(location);
		let align = getStAlignForAlignment(settings.get_string('dock-alignment'));
		let stretch = settings.get_boolean('dock-stretch');
		let toggle = settings.get_string('dock-visibility') === 'TOUCH_TO_SHOW';
		
		this.parent(settings, entryManager,
			(side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT), 36);

		// Give our dash the GNOME theme's styling
		this._icons.actor.name = 'dash';
		this._updateStyle(side);
		
		this._dockable = new Dockable.Dockable(this._icons.actor, side, align, stretch, toggle);

		this._signalManager.connectSetting(settings, 'dock-visibility', 'string',
			this._onDockVisibilitySettingChanged);
		this._signalManager.connectSetting(settings, 'dock-alignment', 'string',
			this._onDockAlignmentSettingChanged);
		this._signalManager.connectSetting(settings, 'dock-stretch', 'boolean',
			this._onDockStretchSettingChanged);
		this._signalManager.connectSetting(settings, 'dock-borders', 'boolean',
			this._onDockBordersSettingChanged);
	},
	
    destroy: function() {
		log('DockableDash.destroy');
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
		let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
		if (side === Meta.Side.RIGHT) {
			if (rtl) {
				this._icons.actor.text_direction = Clutter.TextDirection.RTL;
			}
			this._icons.actor.add_style_pseudo_class('rtl');
		}
		else {
			if (rtl) {
				this._icons.actor.text_direction = Clutter.TextDirection.LTR;
			}
			this._icons.actor.remove_style_pseudo_class('rtl');
		}
		if ((side === Meta.Side.BOTTOM) || !this._settings.get_boolean('dock-borders')) {
			this._icons.actor.add_style_class_name('em-dash-no-border');
		}
		else {
			this._icons.actor.remove_style_class_name('em-dash-no-border');
		}
		//this._icons.actor.add_style_class_name('dash-item-container');
	},
    
	_onDockVisibilitySettingChanged: function(settings, dockVisibility) {
		log('dock-visibility setting changed: ' + dockVisibility);
		let toggle = dockVisibility === 'TOUCH_TO_SHOW';
		this._dockable.setToggle(toggle);
	},
    
	_onDockAlignmentSettingChanged: function(settings, dockAlignment) {
		log('dock-alignment setting changed: ' + dockAlignment);
		let align = getStAlignForAlignment(dockAlignment);
		this._dockable.setAlign(align);
	},
	
	_onDockStretchSettingChanged: function(setting, dockStretch) {
		log('dock-stretch setting changed: ' + dockStretch);
		this._dockable.setStretch(dockStretch);
	},

	_onDockBordersSettingChanged: function(setting, dockBorders) {
		log('dock-borders setting changed: ' + dockBorders);
		let location = this._settings.get_string('dash-location');
		this._updateStyle(getMutterSideForLocation(location));
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
