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
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;

const log = Utils.logger('prefs');


function init() {
	Utils.DEBUG = true;
	Utils.LOG_IMPLEMENTATION = _log;
	log('init');
	Convenience.initTranslations();
}


function buildPrefsWidget() {
	log('build-widget');
	let settings = new Prefs();
	let widget = settings.widget;
	widget.show_all();
	return widget;
}


const Prefs = new Lang.Class({
	Name: 'EmDash.Prefs',

	_init: function() {
		log('init widget')
		
		this._settings = Convenience.getSettings();
		
		// The UI was designed using Glade
		this._builder = new Gtk.Builder();
		this._builder.set_translation_domain(Me.metadata['gettext-domain']);
		this._builder.add_from_file(Me.path + '/prefs.ui');
		
		this.widget = this._builder.get_object('prefs');
		
		// Glade doesn't support ScrolledWindow, so we will recreate the parent window here
//		let viewport = this._builder.get_object('settings_viewport');
//		this.widget.remove(viewport);
//		this.widget = new Gtk.ScrolledWindow();
//		this.widget.add(viewport);

//		this._settings.bind('position',
//				this._builder.get_object('position'),
//				'active',
//				Gio.SettingsBindFlags.DEFAULT);
		
		this._signalManager = new Utils.SignalManager(this);
		this._builder.connect_signals_full(Lang.bind(this, this._onConnectBuilderSignal));
		this._bindSettings();
	},
	
	destroy: function() {
		log('destroy widget');
		this._signalManager.destroy();
	},
	
	_bindSettings: function() {
		this._bindSettingString('position', this._onPositionChanged);
		this._bindSettingString('visibility', this._onVisibilityChanged);
	},
	
	_bindSettingString: function(name, callback) {
		callback = Lang.bind(this, callback);
		let signalName = 'changed::' + name;
		this._signalManager.connect(this._settings, signalName, (settings, name) => {
			callback(settings.get_string(name));
		});
		this._settings.emit(signalName, name);
	},
	
	_onPositionChanged: function(position) {
		log('position-changed: ' + position);
		switch (position) {
		case 'PANEL_START':
			this._builder.get_object('position_panel_start').set_active(true);
			this._builder.get_object('visibility_frame').set_sensitive(false);
			break;
		case 'PANEL_CENTER':
			this._builder.get_object('position_panel_center').set_active(true);
			this._builder.get_object('visibility_frame').set_sensitive(false);
			break;
		case 'EDGE_START':
			this._builder.get_object('position_edge_start').set_active(true);
			this._builder.get_object('visibility_frame').set_sensitive(true);
			break;
		case 'EDGE_END':
			this._builder.get_object('position_edge_end').set_active(true);
			this._builder.get_object('visibility_frame').set_sensitive(true);
			break;
		case 'EDGE_BOTTOM':
			this._builder.get_object('position_edge_bottom').set_active(true);
			this._builder.get_object('visibility_frame').set_sensitive(true);
			break;
		}
	},
	
	_onVisibilityChanged: function(visibility) {
		log('visibility-changed: ' + visibility);
		switch (visibility) {
		case 'ALWAYS':
			this._builder.get_object('visibility_always_visible').set_active(true);
			break;
		case 'TOUCH_TO_SHOW':
			this._builder.get_object('visibility_touch_to_show').set_active(true);
			break;
		}
	},
	
	_onConnectBuilderSignal: function(builder, object, signal, handler) {
		log('connect-builder-signal: ' + handler);
		this._signalManager.connect(object, signal, this['_on' + handler]);
	},

	_onWidgetDestroyed: function(widget) {
		this.destroy();
	},

	_onPositionPanelStartToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('position', 'PANEL_START');
		}
	},
	
	_onPositionPanelCenterToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('position', 'PANEL_CENTER');
		}
	},
	
	_onPositionEdgeStartToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('position', 'EDGE_START');
		}
	},
	
	_onPositionEdgeEndToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('position', 'EDGE_END');
		}
	},
	
	_onPositionEdgeBottomToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('position', 'EDGE_BOTTOM');
		}
	},
	
	_onVisibilityAlwaysVisibleToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('visibility', 'ALWAYS');
		}
	},
	
	_onVisibilityTouchToShowToggled: function(button) {
		if (button.get_active()) {
			this._settings.set_string('visibility', 'TOUCH_TO_SHOW');
		}
	}
});


function _log(message) {
	// Annoyingly, in prefs the global.log function will not work. Instead we will redefine it
	// here based on the source in GNOME Shell's environment.js.
	GLib.log_structured(Me.metadata.name, GLib.LogLevelFlags.LEVEL_MESSAGE, {
		MESSAGE: message,
		GNOME_SHELL_EXTENSION_UUID: Me.uuid,
		GNOME_SHELL_EXTENSION_NAME: Me.metadata.name
	});
}
