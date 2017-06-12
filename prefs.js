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
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = (e) => { return e };

const log = Utils.logger('prefs');


function init() {
	Utils.DEBUG = true;
	Utils.LOG_IMPLEMENTATION = _log;
	settings = Convenience.getSettings();
	log('init');
	Convenience.initTranslations();
}


function buildPrefsWidget() {
	log('build-widget');
	let prefsWidget = new PrefsWidget();
	prefsWidget.widget.show_all();
	return prefsWidget.widget;
}


const PrefsWidget = new Lang.Class({
	Name: 'EmDash.PrefsWidget',

	_init: function() {
		log('init widget')
		
		this._settings = Convenience.getSettings();
		
		// The UI was designed using Glade
		this._builder = new Gtk.Builder();
		this._builder.set_translation_domain(Me.metadata['gettext-domain']);
		this._builder.add_from_file(Me.path + '/prefs.ui');
		
		this.widget = this._builder.get_object('prefs');

		// Update version
		let version = Me.metadata.version;
		if (version === -1) {
			version = 'DEVELOPMENT';
		}
		this._builder.get_object('about_version').label = version;

		this._signalManager = new Utils.SignalManager(this);
		this._builder.connect_signals_full(Lang.bind(this, this._onConnectBuilderSignal));
		this._bindSettings();
	},
	
	destroy: function() {
		log('destroy widget');
		this._signalManager.destroy();
		this._settings.run_dispose();
	},
	
	_bindSettings: function() {
		this._settings.bind('stretch',
				this._builder.get_object('size_stretch'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('quicklist',
				this._builder.get_object('icons_show_quicklist'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('wheel-scroll',
				this._builder.get_object('icons_wheel_scroll'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('media-controls',
				this._builder.get_object('icons_show_media_controls'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		// There's no binding support for radio and combo boxes, so we'll have to do it ourselves
		this._bindSetting('position', this._onPositionSettingChanged, 'string');
		this._bindSetting('monitor', this._onMonitorSettingChanged, 'uint');
		this._bindSetting('visibility', this._onVisibilitySettingChanged, 'string');
		this._bindSetting('left-click', this._onLeftClickSettingChanged, 'string');
		this._bindSetting('middle-click', this._onMiddleClickSettingChanged, 'string');
		this._bindSetting('hover', this._onHoverSettingChanged, 'string');
	},
	
	_bindSetting: function(name, callback, type) {
		callback = Lang.bind(this, callback);
		let signalName = 'changed::' + name;
		let fn = 'get_' + type;
		this._signalManager.connect(this._settings, signalName, (settings, name) => {
			callback(settings[fn](name));
		});
		this._settings.emit(signalName, name);
	},

	_onConnectBuilderSignal: function(builder, object, signal, handler) {
		log('connect-builder-signal: ' + handler);
		// "handler" is what we called the signal in Glade
		this._signalManager.connect(object, signal, this['_on' + handler]);
	},

	_onWidgetDestroyed: function(widget) {
		this.destroy();
	},
	
	// Position radio buttons

	_onPositionSettingChanged: function(position) {
		log('position-setting-changed: ' + position);
		switch (position) {
		case 'PANEL_START':
			this._builder.get_object('position_panel_start').active = true;
			this._builder.get_object('dock_tab').sensitive = false;
			break;
		case 'PANEL_CENTER':
			this._builder.get_object('position_panel_center').active = true;
			this._builder.get_object('dock_tab').sensitive = false;
			break;
		case 'EDGE_START':
			this._builder.get_object('position_edge_start').active = true;
			this._builder.get_object('dock_tab').sensitive = true;
			break;
		case 'EDGE_END':
			this._builder.get_object('position_edge_end').active = true;
			this._builder.get_object('dock_tab').sensitive = true;
			break;
		case 'EDGE_BOTTOM':
			this._builder.get_object('position_edge_bottom').active = true;
			this._builder.get_object('dock_tab').sensitive = true;
			break;
		}
	},
	
	_onPositionPanelStartToggled: function(button) {
		log('position-panel-start-toggled');
		if (button.active) {
			this._settings.set_string('position', 'PANEL_START');
		}
	},
	
	_onPositionPanelCenterToggled: function(button) {
		log('position-panel-center-toggled');
		if (button.active) {
			this._settings.set_string('position', 'PANEL_CENTER');
		}
	},
	
	_onPositionEdgeStartToggled: function(button) {
		log('position-edge-start-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_START');
		}
	},
	
	_onPositionEdgeEndToggled: function(button) {
		log('position-edge-end-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_END');
		}
	},
	
	_onPositionEdgeBottomToggled: function(button) {
		log('position-edge-bottom-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_BOTTOM');
		}
	},
	
	// Monitor combo box

	_onMonitorSettingChanged: function(monitor) {
		log('monitor-setting-changed: ' + monitor);
		let combo = this._builder.get_object('position_monitor');
		let id = String(monitor);
		combo.active_id = id;
		if (combo.active_id !== id) {
			// Changing the active entry failed, meaning that our combo does not have an entry
			// for this monitor, so we'll create one for it
			combo.insert(-1, id, _('Monitor %s (not connected)').format(id));
			combo.active_id = id;
		}
	},

	_onPositionMonitorChanged: function(combo) {
		let monitor = combo.active_id;
		log('position-monitor-changed: ' + monitor);
		this._settings.set_uint('monitor', parseInt(monitor));
	},
	
	// Visibility radio buttons
	
	_onVisibilitySettingChanged: function(visibility) {
		log('visibility-setting-changed: ' + visibility);
		switch (visibility) {
		case 'ALWAYS':
			this._builder.get_object('visibility_always_visible').active = true;
			break;
		case 'TOUCH_TO_SHOW':
			this._builder.get_object('visibility_touch_to_show').active = true;
			break;
		}
	},
	
	_onVisibilityAlwaysVisibleToggled: function(button) {
		log('visibility-always-visible-toggled');
		if (button.active) {
			this._settings.set_string('visibility', 'ALWAYS');
		}
	},
	
	_onVisibilityTouchToShowToggled: function(button) {
		log('visibility-touch-to-show-toggled');
		if (button.active) {
			this._settings.set_string('visibility', 'TOUCH_TO_SHOW');
		}
	},
	
	// Left-click combo box

	_onLeftClickSettingChanged: function(leftClick) {
		log('left-click-setting-changed: ' + leftClick);
		this._builder.get_object('icons_left_click').active_id = leftClick;
	},
	
	_onIconsLeftClickChanged: function(combo) {
		let leftClick = combo.active_id;
		log('icons-left-click-changed: ' + leftClick);
		this._settings.set_string('left-click', leftClick);
	},
	
	// Middle-click combo box

	_onMiddleClickSettingChanged: function(middleClick) {
		log('middle-click-setting-changed: ' + middleClick);
		this._builder.get_object('icons_middle_click').active_id = middleClick;
	},
	
	_onIconsMiddleClickChanged: function(combo) {
		let middleClick = combo.active_id;
		log('icons-middle-click-changed: ' + middleClick);
		this._settings.set_string('middle-click', middleClick);
	},

	// Hover combo box

	_onHoverSettingChanged: function(hover) {
		log('hover-setting-changed: ' + hover);
		this._builder.get_object('icons_hover').active_id = hover;
	},
	
	_onIconsHoverChanged: function(combo) {
		let hover = combo.active_id;
		log('icons-hover-changed: ' + hover);
		this._settings.set_string('hover', hover);
	},
});


function _log(message) {
	// Annoyingly, in prefs.js the global.log function will not work. Instead we will redefine it
	// here borrowing from the source in GNOME Shell's environment.js.
	GLib.log_structured(Me.metadata.name, GLib.LogLevelFlags.LEVEL_MESSAGE, {
		MESSAGE: message,
		GNOME_SHELL_EXTENSION_UUID: Me.uuid,
		GNOME_SHELL_EXTENSION_NAME: Me.metadata.name
		// The domain is automatically added as GLIB_DOMAIN
	});
}
