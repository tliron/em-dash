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

const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const DockableUtils = Me.imports.utils.dockable;
const Dash = Me.imports.dashes.dash;

const log = LoggingUtils.logger('dockableDash');


/**
 * Dash implementation that can be docked to the sides of a monitor.
 */
var DockableDash = class DockableDash extends Dash.Dash {
	constructor(dashManager, location) {
		log('constructor');

		const align = getStAlignForAlignment(dashManager.settings.get_enum('dock-alignment'));
		const stretch = dashManager.settings.get_boolean('dock-stretch');
		const toggle = dashManager.settings.get_string('dock-visibility') === 'TOUCH_TO_REVEAL';

		let side = getStSideForLocation(location);
		super(dashManager, 'dock', side, dashManager.settings.get_uint('dock-icon-size'),
			false);

		side = getMutterSideForLocation(location);
		this._dockable = new DockableUtils.Dockable(this._view.actor, this._view.dash,
			side, align, stretch, toggle);

		// Signals
		this._signalManager.connect(this._view.dash, 'style-changed', this._onStyleChanged);
		this._signalManager.connectSetting(dashManager.settings, 'dock-icon-size', 'uint',
			this._onDockIconSizeSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'dock-stretch', 'boolean',
			this._onDockStretchSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'dock-borders', 'boolean',
			this._onDockBordersSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'dock-alignment', 'string',
			this._onDockAlignmentSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'dock-visibility', 'string',
			this._onDockVisibilitySettingChanged);
		this._signalManager.connect(dashManager.scalingManager, 'changed', this._onScalingChanged);

		this._updateStyle(side);
	}

	destroy() {
		log('destroy');
		this._dockable.destroy();
		super.destroy();
	}

	setLocation(location) {
		let side = getStSideForLocation(location);
		this._view.setSide(side);
		this._view.refresh();
		side = getMutterSideForLocation(location);
		this._dockable.setSide(side);
		this._updateStyle(side);
	}

	_updateStyle(side) {
		const actor = this._view.dash;
		const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
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

		if (!this._dashManager.settings.get_boolean('dock-borders')) {
			actor.add_style_class_name('no-border');
		}
		else {
			actor.remove_style_class_name('no-border');
		}
	}

	_onStyleChanged(actor) {
		log('dash "style-changed" signal');

		// Block this signal connection while changing the style to avoid recursion
		const connection = this._signalManager.get(this._onStyleChanged);
		connection.blocked = true;

		actor.style = null;

		const location = this._dashManager.settings.get_string('dash-location');
		const side = getMutterSideForLocation(location);
		if ((side === Meta.Side.BOTTOM) && this._dashManager.settings.get_boolean('dock-borders')) {
			// Rotate the corner radiuses from side to top
			const themeNode = actor.get_theme_node();
			const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
			let topLeft, topRight;
			if (rtl) {
				topLeft = themeNode.get_border_radius(St.Corner.BOTTOMLEFT);
				topRight = themeNode.get_border_radius(St.Corner.TOPLEFT);
			}
			else {
				topLeft = themeNode.get_border_radius(St.Corner.TOPRIGHT);
				topRight = themeNode.get_border_radius(St.Corner.BOTTOMRIGHT);
			}
			actor.style = `border-radius: ${topLeft}px ${topRight}px 0 0;`;
			// Note: St doesn't seem to support "border-top-left-radius" CSS, etc.
		}

		connection.blocked = false;
	}

	_onDockIconSizeSettingChanged(setting, dockIconSize) {
		log(`"dock-icon-size" setting changed signal: ${dockIconSize}`);
		this._view.setIconSize(dockIconSize);
	}

	_onDockStretchSettingChanged(setting, dockStretch) {
		log(`"dock-stretch" setting changed signal: ${dockStretch}`);
		this._dockable.setStretch(dockStretch);
	}

	_onDockBordersSettingChanged(setting, dockBorders) {
		log(`"dock-borders" setting changed signal: ${dockBorders}`);
		const location = this._dashManager.settings.get_string('dash-location');
		this._updateStyle(getMutterSideForLocation(location));
	}

	_onDockAlignmentSettingChanged(settings, dockAlignment) {
		log(`"dock-alignment" setting changed signal: ${dockAlignment}`);
		const align = getStAlignForAlignment(dockAlignment);
		this._dockable.setAlign(align);
	}

	_onDockVisibilitySettingChanged(settings, dockVisibility) {
		log(`"dock-visibility" setting changed signal: ${dockVisibility}`);
		const toggle = dockVisibility === 'TOUCH_TO_REVEAL';
		this._dockable.setToggle(toggle);
	}

	_onScalingChanged(scaling, factor) {
		log(`scaling "changed" signal: ${factor}`);
		this._view.refresh();
	}
};


/*
 * Utils
 */

function getMutterSideForLocation(location) {
	const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
	switch (location) {
	case 'EDGE_NEAR':
		return rtl ? Meta.Side.RIGHT : Meta.Side.LEFT;
	case 'EDGE_FAR':
		return rtl ? Meta.Side.LEFT : Meta.Side.RIGHT;
	case 'EDGE_BOTTOM':
		return Meta.Side.BOTTOM;
	}
}


function getStSideForLocation(location) {
	const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
	switch (location) {
	case 'EDGE_NEAR':
		return rtl ? St.Side.RIGHT : St.Side.LEFT;
	case 'EDGE_FAR':
		return rtl ? St.Side.LEFT : St.Side.RIGHT;
	case 'EDGE_BOTTOM':
		return St.Side.BOTTOM;
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
