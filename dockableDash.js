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

		let vertical = (side === Meta.Side.LEFT) || (side === Meta.Side.RIGHT);
		this.parent(settings, entryManager, null, vertical, this._iconSize);

		this._updateStyle(side);

		this._dockable = new Dockable.Dockable(this._icons.actor, side, align, stretch, toggle);

		let themeContext = St.ThemeContext.get_for_stage(global.stage);
		this._signalManager.connect(this._icons.actor, 'style-changed', this._onStyleChanged);
		this._signalManager.connectSetting(settings, 'dock-visibility', 'string',
			this._onDockVisibilitySettingChanged);
		this._signalManager.connectSetting(settings, 'dock-alignment', 'string',
			this._onDockAlignmentSettingChanged);
		this._signalManager.connectSetting(settings, 'dock-stretch', 'boolean',
			this._onDockStretchSettingChanged);
		this._signalManager.connectSetting(settings, 'dock-borders', 'boolean',
			this._onDockBordersSettingChanged);
		this._signalManager.connectProperty(themeContext, 'scale-factor',
			this._onScaleFactorChanged);
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

	get _iconSize() {
		let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
		return 64 * scaleFactor;
	},

	_updateStyle: function(side) {
		let actor = this._icons.actor;
		let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
		switch (side) {
		case Meta.Side.RIGHT:
			if (rtl) {
				actor.text_direction = Clutter.TextDirection.RTL;
			}
			actor.add_style_pseudo_class('rtl');
			actor.style = null;
			break;
		case Meta.Side.LEFT:
			if (rtl) {
				actor.text_direction = Clutter.TextDirection.LTR;
			}
			actor.remove_style_pseudo_class('rtl');
			actor.style = null;
			break;
		case Meta.Side.BOTTOM:
			if (rtl) {
				actor.text_direction = Clutter.TextDirection.RTL;
				actor.add_style_pseudo_class('rtl');
			}
			else {
				actor.remove_style_pseudo_class('rtl');
			}
			actor.style = 'fake'; // this will force a 'style-changed' signal
			break;
		}

		if (!this._settings.get_boolean('dock-borders')) {
			actor.add_style_class_name('no-border');
		}
		else {
			actor.remove_style_class_name('no-border');
		}
	},

	_onStyleChanged: function(actor) {
		log('style-changed signal');

		// Block the signal while changing the style
		let connection = this._signalManager.get(this._onStyleChanged);
		connection.blocked = true;

		actor.style = null;

		let location = this._settings.get_string('dash-location');
		let side = getMutterSideForLocation(location);
		if ((side === Meta.Side.BOTTOM) && this._settings.get_boolean('dock-borders')) {
			// Rotate the corner radiuses from side to top
			let themeNode = actor.get_theme_node();
			let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
			let topLeft, topRight;
			if (rtl) {
				topLeft = themeNode.get_border_radius(St.Corner.BOTTOMLEFT);
				topRight = themeNode.get_border_radius(St.Corner.TOPLEFT);
			}
			else {
				topLeft = themeNode.get_border_radius(St.Corner.TOPRIGHT);
				topRight = themeNode.get_border_radius(St.Corner.BOTTOMRIGHT);
			}
			actor.style = 'border-radius: %dpx %dpx 0 0;'.format(topLeft, topRight);
			// Note: St CSS doesn't seem to support "border-top-left-radius", etc.
		}

		connection.blocked = false;
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
	},

	_onScaleFactorChanged: function(themeContext, scaleFactor) {
		// Doesn't seem to be called
		log('theme context scale-factor changed !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!: ' + scaleFactor);
		this._icons.setSize(this._iconSize);
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
