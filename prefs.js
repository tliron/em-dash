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
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;


const log = Logging.logger('prefs');


function init() {
	Convenience.initTranslations();
}


function buildPrefsWidget() {
	let prefsWidget = new PrefsWidget();
	prefsWidget.widget.show_all();
	return prefsWidget.widget;
}


const PrefsWidget = new Lang.Class({
	Name: 'EmDash.PrefsWidget',

	_init: function() {
		this._settings = Convenience.getSettings();

		Me.LOGGING_ENABLED = this._settings.get_boolean('debug');
		Me.LOGGING_IMPLEMENTATION = _log;

		log('init widget')

		// The UI was designed using Glade
		this._builder = new Gtk.Builder();
		this._builder.set_translation_domain(Me.metadata['gettext-domain']);
		this._builder.add_from_file(Me.path + '/prefs.ui');
		
		this.widget = this._builder.get_object('prefs');

		// Strings (we keep them as loose labels in the UI to make it easier for translators)
		this._positionPanelLeft = this._builder.get_object('position_panel_left').label;
		this._positionPanelRight = this._builder.get_object('position_panel_right').label;
		this._positionEdgeLeft = this._builder.get_object('position_edge_left').label;
		this._positionEdgeRight = this._builder.get_object('position_edge_right').label;
		this._alignmentTop = this._builder.get_object('alignment_top').label;
		this._alignmentBottom = this._builder.get_object('alignment_bottom').label;
		this._alignmentLeft = this._builder.get_object('alignment_left').label;
		this._alignmentRight = this._builder.get_object('alignment_right').label;
		this._monitorNotConnected = this._builder.get_object('monitor_not_connected').label;
		
		// Update labels according to direction
		let rtl = Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL;
		if (rtl) {
			this._builder.get_object('position_panel_near').label = this._positionPanelRight;
			this._builder.get_object('position_edge_near').label = this._positionEdgeRight;
			this._builder.get_object('position_edge_far').label = this._positionEdgeLeft;
		}
		else {
			this._builder.get_object('position_panel_near').label = this._positionPanelLeft;
			this._builder.get_object('position_edge_near').label = this._positionEdgeLeft;
			this._builder.get_object('position_edge_far').label = this._positionEdgeRight;
		}

		// Update version
		let version = Me.metadata.version;
		if (version === -1) {
			version = 'DEVELOPMENT';
		}
		this._builder.get_object('about_version').label = version;

		this._signalManager = new Signals.SignalManager(this);
		this._builder.connect_signals_full(Lang.bind(this, this._onConnectBuilderSignal));
		this._bindSettings();
	},
	
	destroy: function() {
		log('destroy widget');
		this._signalManager.destroy();
		// this._settings.run_dispose(); TODO: this causes errors
	},
	
	_bindSettings: function() {
		this._settings.bind('stretch',
				this._builder.get_object('size_stretch'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('wheel-scroll',
				this._builder.get_object('icons_wheel_scroll'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('move-app-menu-to-icon',
				this._builder.get_object('panel_move_to_icon_menu'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('media-controls',
				this._builder.get_object('icons_show_media_controls'),
				'active',
				Gio.SettingsBindFlags.DEFAULT);

		// There's no binding support for radio and combo boxes, so we'll have to do it ourselves
		let x =this._signalManager.connectSetting(this._settings, 'position', 'string',
			this._onPositionSettingChanged);
		this._signalManager.connectSetting(this._settings, 'monitor', 'uint',
			this._onMonitorSettingChanged);
		this._signalManager.connectSetting(this._settings, 'visibility', 'string',
			this._onVisibilitySettingChanged);
		this._signalManager.connectSetting(this._settings, 'alignment', 'string',
			this._onAlignmentSettingChanged);
		this._signalManager.connectSetting(this._settings, 'left-click', 'string',
			this._onLeftClickSettingChanged);
		this._signalManager.connectSetting(this._settings, 'middle-click', 'string',
			this._onMiddleClickSettingChanged);
		this._signalManager.connectSetting(this._settings, 'hover', 'string',
			this._onHoverSettingChanged);
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

	_onPositionSettingChanged: function(settings, position) {
		log('position-setting-changed: ' + position);
		switch (position) {
		case 'PANEL_NEAR':
			this._builder.get_object('position_panel_near').active = true;
			this._builder.get_object('docking_tab').sensitive = false;
			break;
		case 'PANEL_MIDDLE':
			this._builder.get_object('position_panel_middle').active = true;
			this._builder.get_object('docking_tab').sensitive = false;
			break;
		case 'EDGE_NEAR':
			this._builder.get_object('position_edge_near').active = true;
			this._builder.get_object('docking_tab').sensitive = true;
			this._builder.get_object('alignment_near').label = this._alignmentTop;
			this._builder.get_object('alignment_far').label = this._alignmentBottom;
			break;
		case 'EDGE_FAR':
			this._builder.get_object('position_edge_far').active = true;
			this._builder.get_object('docking_tab').sensitive = true;
			this._builder.get_object('alignment_near').label = this._alignmentTop;
			this._builder.get_object('alignment_far').label = this._alignmentBottom;
			break;
		case 'EDGE_BOTTOM':
			this._builder.get_object('position_edge_bottom').active = true;
			this._builder.get_object('docking_tab').sensitive = true;
			let rtl = Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL;
			if (rtl) {
				this._builder.get_object('alignment_near').label = this._alignmentRight;
				this._builder.get_object('alignment_far').label = this._alignmentLeft;
			}
			else {
				this._builder.get_object('alignment_near').label = this._alignmentLeft;
				this._builder.get_object('alignment_far').label = this._alignmentRight;
			}
			break;
		}
	},
	
	_onPositionPanelNearToggled: function(button) {
		log('position-panel-start-toggled');
		if (button.active) {
			this._settings.set_string('position', 'PANEL_NEAR');
		}
	},
	
	_onPositionPanelMiddleToggled: function(button) {
		log('position-panel-middle-toggled');
		if (button.active) {
			this._settings.set_string('position', 'PANEL_MIDDLE');
		}
	},
	
	_onPositionEdgeNearToggled: function(button) {
		log('position-edge-start-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_NEAR');
		}
	},
	
	_onPositionEdgeFarToggled: function(button) {
		log('position-edge-end-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_FAR');
		}
	},
	
	_onPositionEdgeBottomToggled: function(button) {
		log('position-edge-bottom-toggled');
		if (button.active) {
			this._settings.set_string('position', 'EDGE_BOTTOM');
		}
	},
	
	// Monitor combo box

	_onMonitorSettingChanged: function(settings, monitor) {
		log('monitor-setting-changed: ' + monitor);
		let combo = this._builder.get_object('position_monitor');
		let id = String(monitor);
		combo.active_id = id;
		if (combo.active_id !== id) {
			// Changing the active entry failed, meaning that our combo does not have an entry
			// for this monitor, so we'll create one for it
			combo.insert(-1, id, this._monitorNotConnected.format(id));
			combo.active_id = id;
		}
	},

	_onPositionMonitorChanged: function(combo) {
		let monitor = combo.active_id;
		log('position-monitor-changed: ' + monitor);
		this._settings.set_uint('monitor', parseInt(monitor));
	},
	
	// Visibility radio buttons
	
	_onVisibilitySettingChanged: function(settings, visibility) {
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
	
	// Alignment radio buttons
	
	_onAlignmentSettingChanged: function(settings, alignment) {
		log('alignment-setting-changed: ' + alignment);
		switch (alignment) {
		case 'NEAR':
			this._builder.get_object('alignment_near').active = true;
			break;
		case 'MIDDLE':
			this._builder.get_object('alignment_middle').active = true;
			break;
		case 'FAR':
			this._builder.get_object('alignment_far').active = true;
			break;
		}
	},
	
	_onAlignmentNearToggled: function(button) {
		log('alignment-near-toggled');
		if (button.active) {
			this._settings.set_string('alignment', 'NEAR');
		}
	},
	
	_onAlignmentMiddleToggled: function(button) {
		log('alignment-middle-toggled');
		if (button.active) {
			this._settings.set_string('alignment', 'MIDDLE');
		}
	},
	
	_onAlignmentFarToggled: function(button) {
		log('alignment-far-toggled');
		if (button.active) {
			this._settings.set_string('alignment', 'FAR');
		}
	},
	
	// Left-click combo box

	_onLeftClickSettingChanged: function(settings, leftClick) {
		log('left-click-setting-changed: ' + leftClick);
		this._builder.get_object('icons_left_click').active_id = leftClick;
	},
	
	_onIconsLeftClickChanged: function(combo) {
		let leftClick = combo.active_id;
		log('icons-left-click-changed: ' + leftClick);
		this._settings.set_string('left-click', leftClick);
	},
	
	// Middle-click combo box

	_onMiddleClickSettingChanged: function(settings, middleClick) {
		log('middle-click-setting-changed: ' + middleClick);
		this._builder.get_object('icons_middle_click').active_id = middleClick;
	},
	
	_onIconsMiddleClickChanged: function(combo) {
		let middleClick = combo.active_id;
		log('icons-middle-click-changed: ' + middleClick);
		this._settings.set_string('middle-click', middleClick);
	},

	// Hover combo box

	_onHoverSettingChanged: function(settings, hover) {
		log('hover-setting-changed: ' + hover);
		this._builder.get_object('icons_hover').active_id = hover;
	},
	
	_onIconsHoverChanged: function(combo) {
		let hover = combo.active_id;
		log('icons-hover-changed: ' + hover);
		this._settings.set_string('hover', hover);
	}
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
