/*
 * This file is part of the Em-Dash extension for GNOME.
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

		log('_init')

		// The UI was designed using Glade
		this._builder = new Gtk.Builder();
		this._builder.set_translation_domain(Me.metadata['gettext-domain']);
		this._builder.add_from_file(Me.path + '/prefs.ui');

		this.widget = this._builder.get_object('prefs');

		// Strings (we keep them as loose labels in the UI to make it easier for translators)
		this._locationPanelLeft = this._builder.get_object('location_panel_left').label;
		this._locationPanelRight = this._builder.get_object('location_panel_right').label;
		this._locationEdgeLeft = this._builder.get_object('location_edge_left').label;
		this._locationEdgeRight = this._builder.get_object('location_edge_right').label;
		this._alignmentTop = this._builder.get_object('alignment_top').label;
		this._alignmentBottom = this._builder.get_object('alignment_bottom').label;
		this._alignmentLeft = this._builder.get_object('alignment_left').label;
		this._alignmentRight = this._builder.get_object('alignment_right').label;
		this._monitorNotConnected = this._builder.get_object('monitor_not_connected').label;

		// Update labels according to direction
		let rtl = Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL;
		if (rtl) {
			this._builder.get_object('location_panel_near').label = this._locationPanelRight;
			this._builder.get_object('location_edge_near').label = this._locationEdgeRight;
			this._builder.get_object('location_edge_far').label = this._locationEdgeLeft;
		}
		else {
			this._builder.get_object('location_panel_near').label = this._locationPanelLeft;
			this._builder.get_object('location_edge_near').label = this._locationEdgeLeft;
			this._builder.get_object('location_edge_far').label = this._locationEdgeRight;
		}

		// Marks
		function addMarks(scale) {
			scale.add_mark(16, Gtk.PositionType.BOTTOM, '16');
			scale.add_mark(32, Gtk.PositionType.BOTTOM, '32');
			scale.add_mark(48, Gtk.PositionType.BOTTOM, '48');
			scale.add_mark(64, Gtk.PositionType.BOTTOM, '64');
			scale.add_mark(96, Gtk.PositionType.BOTTOM, '96');
			scale.add_mark(128, Gtk.PositionType.BOTTOM, '128');
		}
		addMarks(this._builder.get_object('panel_height'));
		addMarks(this._builder.get_object('dock_icon_size'));

		// Update version
		let version = Me.metadata.version;
		if (version === -1) {
			version = '<i>DEVELOPMENT</i>';
		}
		this._builder.get_object('about_version').label = version;

		this._signalManager = new Signals.SignalManager(this);
		this._builder.connect_signals_full(Lang.bind(this, this._onConnectBuilderSignal));
		this._bindSettings();
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
		// this._settings.run_dispose(); TODO: this causes errors
	},

	_bindSettings: function() {
		this._settings.bind('panel-appearance-merge',
			this._builder.get_object('panel_merge'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('dock-stretch',
			this._builder.get_object('size_stretch'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('dock-borders',
			this._builder.get_object('borders_show'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('icons-highlight-focused',
			this._builder.get_object('icons_higlight_focused'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('icons-dots',
			this._builder.get_object('icons_show_dots'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('icons-app-menu',
			this._builder.get_object('icons_move_application_menu'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('icons-media-controls',
			this._builder.get_object('icons_show_media_controls'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._settings.bind('icons-wheel-scroll',
			this._builder.get_object('windows_wheel_scroll'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		// There's no binding support for radio and combo boxes, so we'll have to do it ourselves
		this._signalManager.connectSetting(this._settings, 'dash-location', 'string',
			this._onDashLocationSettingChanged);
		this._signalManager.connectSetting(this._settings, 'dash-location-monitor', 'uint',
			this._onDashLocationMonitorSettingChanged);
		this._signalManager.connectSetting(this._settings, 'panel-custom-height', 'boolean',
			this._onPanelCustomHeightSettingChanged);
		this._signalManager.connectSetting(this._settings, 'panel-height', 'uint',
			this._onPanelHeightSettingChanged);
		this._signalManager.connectSetting(this._settings, 'dock-icon-size', 'uint',
			this._onDockIconSizeSettingChanged);
		this._signalManager.connectSetting(this._settings, 'dock-alignment', 'string',
			this._onDockAlignmentSettingChanged);
		this._signalManager.connectSetting(this._settings, 'dock-visibility', 'string',
			this._onDockVisibilitySettingChanged);
		this._signalManager.connectSetting(this._settings, 'dash-per-workspace', 'boolean',
			this._onDashPerWorkspaceSettingChanged);
		this._signalManager.connectSetting(this._settings, 'icons-left-click', 'string',
			this._onIconsLeftClickSettingChanged);
		this._signalManager.connectSetting(this._settings, 'icons-middle-click', 'string',
			this._onIconsMiddleClickSettingChanged);
		this._signalManager.connectSetting(this._settings, 'icons-hover', 'string',
			this._onIconsHoverSettingChanged);
	},

	_onConnectBuilderSignal: function(builder, object, signal, handler) {
		log(`connect builder signal: ${handler}`);
		// "handler" is what we called the signal in Glade
		this._signalManager.connect(object, signal, this[`_on${handler}`]);
	},

	_onWidgetDestroyed: function(widget) {
		this.destroy();
	},

	// Location radio buttons

	_onDashLocationSettingChanged: function(settings, dashLocation) {
		log(`"dash-location" setting changed signal: ${dashLocation}`);
		switch (dashLocation) {
		case 'PANEL_NEAR':
			this._builder.get_object('location_panel_near').active = true;
			this._builder.get_object('panel_tab').sensitive = true;
			this._builder.get_object('dock_tab').sensitive = false;
			break;
		case 'PANEL_MIDDLE':
			this._builder.get_object('location_panel_middle').active = true;
			this._builder.get_object('panel_tab').sensitive = true;
			this._builder.get_object('dock_tab').sensitive = false;
			break;
		case 'EDGE_NEAR':
			this._builder.get_object('location_edge_near').active = true;
			this._builder.get_object('panel_tab').sensitive = false;
			this._builder.get_object('dock_tab').sensitive = true;
			this._builder.get_object('alignment_near').label = this._alignmentTop;
			this._builder.get_object('alignment_far').label = this._alignmentBottom;
			break;
		case 'EDGE_FAR':
			this._builder.get_object('location_edge_far').active = true;
			this._builder.get_object('panel_tab').sensitive = false;
			this._builder.get_object('dock_tab').sensitive = true;
			this._builder.get_object('alignment_near').label = this._alignmentTop;
			this._builder.get_object('alignment_far').label = this._alignmentBottom;
			break;
		case 'EDGE_BOTTOM':
			this._builder.get_object('location_edge_bottom').active = true;
			this._builder.get_object('panel_tab').sensitive = false;
			this._builder.get_object('dock_tab').sensitive = true;
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

	_onLocationPanelNearToggled: function(button) {
		log('"location_panel_start" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dash-location', 'PANEL_NEAR');
		}
	},

	_onLocationPanelMiddleToggled: function(button) {
		log('"location_panel_middle" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dash-location', 'PANEL_MIDDLE');
		}
	},

	_onLocationEdgeNearToggled: function(button) {
		log('"location_edge_start" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dash-location', 'EDGE_NEAR');
		}
	},

	_onLocationEdgeFarToggled: function(button) {
		log('"location_edge_end" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dash-location', 'EDGE_FAR');
		}
	},

	_onLocationEdgeBottomToggled: function(button) {
		log('"location_edge_bottom" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dash-location', 'EDGE_BOTTOM');
		}
	},

	// Monitor combo box

	_onDashLocationMonitorSettingChanged: function(settings, dashLocationMonitor) {
		log(`"dash-location-monitor" setting changed signal: ${dashLocationMonitor}`);
		let combo = this._builder.get_object('location_monitor');
		let id = String(dashLocationMonitor);
		combo.active_id = id;
		if (combo.active_id !== id) {
			// Changing the active entry failed, meaning that our combo does not have an entry
			// for this monitor, so we'll create one for it
			combo.insert(-1, id, this._monitorNotConnected.format(id));
			combo.active_id = id;
		}
	},

	_onLocationMonitorChanged: function(combo) {
		let locationMonitor = combo.active_id;
		log(`"location_monitor" combo box "changed" signal: ${locationMonitor}`);
		this._settings.set_uint('dash-location-monitor', parseInt(locationMonitor));
	},

	// Custom height radio buttons

	_onPanelCustomHeightSettingChanged: function(settings, panelCustomHeight) {
		log(`"panel-custom-height" setting changed signal: ${panelCustomHeight}`);
		if (panelCustomHeight) {
			this._builder.get_object('panel_custom_height').active = true;
			this._builder.get_object('panel_height').sensitive = true;
		}
		else {
			this._builder.get_object('panel_default_height').active = true;
			this._builder.get_object('panel_height').sensitive = false;
		}
	},

	_onPanelDefaultHeightToggled: function(button) {
		log('"panel_default_height" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_boolean('panel-custom-height', false);
		}
	},

	_onPanelCustomHeightToggled: function(button) {
		log('"panel_custom_height" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_boolean('panel-custom-height', true);
		}
	},

	// Height scale

	_onPanelHeightSettingChanged: function(settings, panelHeight) {
		log(`"panel-height" setting changed signal: ${panelHeight}`);
		this._builder.get_object('panel_height').set_value(panelHeight);
	},

	_onPanelHeightValueChanged: function(scale) {
		let panelHeight = scale.get_value();
		log(`"panel_height" scale value changed signal: ${panelHeight}`);
		this._settings.set_uint('panel-height', panelHeight);
	},

	// Icon size combo box

	_onDockIconSizeSettingChanged: function(settings, dockIconSize) {
		log(`"dock-icon-size" setting changed signal: ${dockIconSize}`);
		this._builder.get_object('dock_icon_size').set_value(dockIconSize);
	},

	_onDockIconSizeValueChanged: function(scale) {
		let dockIconSize = scale.get_value();
		log(`"dock_icon_size" scale value changed signal: ${dockIconSize}`);
		this._settings.set_uint('dock-icon-size', dockIconSize);
	},

	// Alignment radio buttons

	_onDockAlignmentSettingChanged: function(settings, dockAlignment) {
		log(`"dock-alignment" setting changed signal: ${dockAlignment}`);
		switch (dockAlignment) {
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
		log('"alignment_near" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dock-alignment', 'NEAR');
		}
	},

	_onAlignmentMiddleToggled: function(button) {
		log('"alignment_middle" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dock-alignment', 'MIDDLE');
		}
	},

	_onAlignmentFarToggled: function(button) {
		log('"alignment_far" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dock-alignment', 'FAR');
		}
	},

	// Visibility radio buttons

	_onDockVisibilitySettingChanged: function(settings, dockVisibility) {
		log(`"dock-visibility" setting changed signal: ${dockVisibility}`);
		switch (dockVisibility) {
		case 'ALWAYS':
			this._builder.get_object('visibility_always_visible').active = true;
			break;
		case 'TOUCH_TO_SHOW':
			this._builder.get_object('visibility_touch_to_show').active = true;
			break;
		}
	},

	_onVisibilityAlwaysVisibleToggled: function(button) {
		log('"visibility_always_visible" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dock-visibility', 'ALWAYS');
		}
	},

	_onVisibilityTouchToShowToggled: function(button) {
		log('"visibility_touch_to_show" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_string('dock-visibility', 'TOUCH_TO_SHOW');
		}
	},

	// Dash per workspace radio buttons

	_onDashPerWorkspaceSettingChanged: function(settings, dashPerWorkspace) {
		log(`"dash-per-workspace" setting changed signal: ${dashPerWorkspace}`);
		if (dashPerWorkspace) {
			this._builder.get_object('windows_dash_per_workspace').active = true;
		}
		else {
			this._builder.get_object('windows_single_dash').active = true;
		}
	},

	_onSingleDashToggled: function(button) {
		log('windows_single_dash radio button "toggled" signal');
		if (button.active) {
			this._settings.set_boolean('dash-per-workspace', false);
		}
	},

	_onDashPerWorkspaceToggled: function(button) {
		log('"windows_dash_per_workspace" radio button "toggled" signal');
		if (button.active) {
			this._settings.set_boolean('dash-per-workspace', true);
		}
	},

	// Left-click combo box

	_onIconsLeftClickSettingChanged: function(settings, iconsLeftClick) {
		log(`"icons-left-click" setting changed signal: ${iconsLeftClick}`);
		this._builder.get_object('windows_left_click').active_id = iconsLeftClick;
	},

	_onWindowsLeftClickChanged: function(combo) {
		let leftClick = combo.active_id;
		log(`"windows_left_click" combo box "changed" signal: ${leftClick}`);
		this._settings.set_string('icons-left-click', leftClick);
	},

	// Middle-click combo box

	_onIconsMiddleClickSettingChanged: function(settings, iconsMiddleClick) {
		log(`"icons-middle-click" setting changed signal: ${iconsMiddleClick}`);
		this._builder.get_object('windows_middle_click').active_id = iconsMiddleClick;
	},

	_onWindowsMiddleClickChanged: function(combo) {
		let middleClick = combo.active_id;
		log(`"windows_middle_click" combo box "changed" signal: ${middleClick}`);
		this._settings.set_string('icons-middle-click', middleClick);
	},

	// Hover combo box

	_onIconsHoverSettingChanged: function(settings, iconsHover) {
		log(`"icons-hover" setting changed signal: ${iconsHover}`);
		this._builder.get_object('windows_hover').active_id = iconsHover;
	},

	_onWindowsHoverChanged: function(combo) {
		let hover = combo.active_id;
		log(`"windows_hover" combo box "changed" signal: ${hover}`);
		this._settings.set_string('icons-hover', hover);
	}
});


/**
 * Annoyingly, in prefs.js the global.log function will not work. Instead we will redefine it here
 * while keeping the same format as in GNOME Shell's environment.js.
 */
function _log(message) {
	GLib.log_structured(Me.metadata.name, GLib.LogLevelFlags.LEVEL_MESSAGE, {
		MESSAGE: message,
		GNOME_SHELL_EXTENSION_UUID: Me.uuid,
		GNOME_SHELL_EXTENSION_NAME: Me.metadata.name
		// The domain is automatically added as GLIB_DOMAIN
	});
}
