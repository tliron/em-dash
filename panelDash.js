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
const Main = imports.ui.main;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Dash = Me.imports.dash;

const log = Logging.logger('panelDash');


/**
 * Dash implementation on the GNOME Shell panel.
 */
const PanelDash = new Lang.Class({
	Name: 'EmDash.PanelDash',
	Extends: Dash.Dash,

	_init: function(settings, entryManager, location) {
		log('PanelDash._init');

		this._panelOriginalHeight = Main.panel.actor.height;
		this._updatePanelHeight(settings);

    	this.parent(settings, entryManager, 'panel', false, Main.panel.actor.height);

		this._signalManager.connectSetting(settings, 'panel-appearance-merge', 'boolean',
			this._onPanelAppearanceMergeSettingChanged);
		this._signalManager.connectSetting(settings, 'panel-custom-height', 'boolean',
			this._onPanelCustomHeightSettingChanged);
		this._signalManager.connectSetting(settings, 'panel-height', 'uint',
			this._onPanelHeightSettingChanged);
		this._signalManager.connectProperty(Main.panel.actor, 'height',
			this._onPanelHeightChanged);

    	this.setLocation(location);
	},

	destroy: function() {
		this.parent();
		Main.panel.actor.height = this._panelOriginalHeight;
	},

	setLocation: function(location) {
		// Note: in RTL, the _leftBox actually appears on the right :)
		let actor = this._icons.actor;
		switch (location) {
		case 'PANEL_NEAR':
			if (Main.panel._centerBox.contains(actor)) {
				Main.panel._centerBox.remove_child(actor);
			}
			if (!Main.panel._leftBox.contains(actor)) {
				Main.panel._leftBox.add_child(actor);
			}
			break;
		case 'PANEL_MIDDLE':
			if (Main.panel._leftBox.contains(actor)) {
				Main.panel._leftBox.remove_child(actor);
			}
			if (!Main.panel._centerBox.contains(actor)) {
				Main.panel._centerBox.add_child(actor);
			}
			break;
		}
	},

	_updateStyle: function(panelAppearanceMerge) {
		if (panelAppearanceMerge) {
			this._icons.actor.add_style_class_name('merge');
		}
		else {
			this._icons.actor.remove_style_class_name('merge');
		}
	},

	_updatePanelHeight: function(settings) {
		if (settings === undefined) {
			settings = this._settings;
		}
		if (settings.get_boolean('panel-custom-height')) {
			Main.panel.actor.height = settings.get_uint('panel-height');
		}
		else {
			Main.panel.actor.height = this._panelOriginalHeight;
		}
	},

	_onPanelAppearanceMergeSettingChanged: function(settings, panelAppearanceMerge) {
		log('panel-appearance-merge setting changed: ' + panelAppearanceMerge);
		this._updateStyle(panelAppearanceMerge);
	},

	_onPanelCustomHeightSettingChanged: function(settings, customHeight) {
		log('panel-custom-height setting changed: ' + customHeight);
		this._updatePanelHeight();
	},

	_onPanelHeightSettingChanged: function(settings, height) {
		log('panel-height setting changed: ' + height);
		this._updatePanelHeight();
	},

	_onPanelHeightChanged: function(actor, height) {
		log('panel height changed: ' + height);
		this._icons.setSize(height);
	}
});
