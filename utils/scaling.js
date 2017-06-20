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
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const SignalsUtils = Me.imports.utils.signals;

const log = Logging.logger('scaling');


/**
 * Tracks changes to scaling.
 *
 * GDK
 * ---
 *
 * It uses "Gdk/WindowScalingFactor" (integer) in XSETTINGS (X11, not GSettings).
 *
 * GNOME's settings daemon has an XSETTINGS plugin that allows you to override XSETTINGS via
 * "org.gnome.settings-daemon.plugins.xsettings/overrides". This is exactly what GNOME Tweak sets
 * when you change "window scaling".
 *
 * This setting is used directly by GTK+. But how do we get from here to GNOME Shell? It's a bit
 * of a mess...
 *
 * Clutter
 * -------
 *
 * Its "window_scaling_factor" (integer) comes from the backend, though you can override it with the
 * CLUTTER_SCALE environment var. It affects the default scaling factor for all Clutter canvases.
 * You can access it like so:
 *
 *   Clutter.Settings.get_default().window_scaling_factor
 *
 * Since Mutter and St both use Clutter, it might seem as though we could just use this feature.
 * However, it doesn't, because this would just "zoom in" and double the size of pixels, making
 * fonts, icons, and other decorations look bad. So, in GNOME Shell this is always 1.
 *
 * Mutter
 * ------
 *
 * It uses its own "ui_scaling_factor" (integer). Note that "ui_scaling_factor" can unfortunately
 * only be accessed by C code, and is not exposed to JavaScript.
 *
 * If the backend is doing its own scaling, then this will always be 1. Otherwise, Mutter will try
 * to use the "monitor manager" (currently an experimental feature).
 *
 * The monitor manager will use the max scaling of all connected monitor. (Which is annoying:
 * monitors should each have their own scale, no?) By default, Mutter automatically sets the scaling
 * of each monitor: 2 for Hi-DPI monitors, 1 for everything else. However, you can override this by
 * setting a non-zero value to "org.gnome.desktop.interface/scaling-factor". (Internally in Mutter,
 * it's called "global_scaling_factor".)
 *
 * GNOME indeed uses a monitor manager, so all the above applies.
 *
 * Note that if there is no monitor manager, then "ui_scaling_factor" is taken from XSETTINGS's
 * "Gdk/WindowScalingFactor".
 *
 * St
 * --
 *
 * Changes to Mutter's "ui_scaling_factor" are automatically applied (in shell-global.c) to the
 * theme context associated with the global Clutter stage (the root actor):
 *
 *   St.ThemeContext.get_for_stage(global.stage).scale_factor
 *
 * Unfortunately, Mutter itself will not update that setting after it's initialized, meaning that
 * you will have to restart GNOME Shell for everything to work properly. We are introducing a hack
 * here to apply the setting that GNOME Tweak uses in order to avoid restarting.
 *
 * Everything in St explicitly multiplies pixel sizes by this value. This includes all CSS
 * properties and icon sizes. That might sound great ... except that often in your code you expect
 * pixel lengths to be pixel lengths. For this reason, you need to take into account that some St
 * widgets might be bigger than expected.
 */
const ScalingManager = new Lang.Class({
	Name: 'EmDash.ScalingManager',

	_init: function() {
		log('_init');

		this.factor = getScaleFactor();

		this._interfaceSettings = new Gio.Settings({
    		schema_id: 'org.gnome.desktop.interface'
    	});
		this._xSettings = new Gio.Settings({
    		schema_id: 'org.gnome.settings-daemon.plugins.xsettings'
    	});

		let themeContext = St.ThemeContext.get_for_stage(global.stage);
		this._signalManager = new SignalsUtils.SignalManager(this);
		this._signalManager.connectProperty(themeContext, 'scale-factor',
			this._onStScaleFactorChanged);
		this._signalManager.connectSetting(this._interfaceSettings, 'scaling-factor', 'uint',
			this._onMutterScalingFactorSettingChanged);
		this._signalManager.connectSetting(this._xSettings, 'overrides', 'value',
			this._onXOverridesSettingChanged);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
		this._interfaceSettings.run_dispose();
		this._xSettings.run_dispose();
	},

	_refresh() {
		let factor = getScaleFactor();
		if (factor !== this.factor) {
			log('_refresh: ' + this.factor + ' to ' + factor);
			this.factor = factor;
			this.emit('changed', factor);
		}
	},

	_onStScaleFactorChanged: function(themeContext, scaleFactor) {
		// Note: this is called whenever the theme context is changed, even if scale-factor
		// itself has not changed...
		log('theme context "scale-factor" property changed signal: ' + scaleFactor);
		this._refresh();
	},

	_onMutterScalingFactorSettingChanged: function(settings, mutterScalingFactor) {
		log('mutter "scaling-factor" setting changed signal: ' + mutterScalingFactor);
		// We shall force a scale change for GNOME Settings Daemon
		if (getGdkScalingFactor(this._xSettings.get_value('overrides')) !== mutterScalingFactor) {
			setGdkScalingFactor(this._xSettings, mutterScalingFactor);
		}
		// We shall force a scale change for St
		if (St.ThemeContext.get_for_stage(global.stage).scale_factor !== mutterScalingFactor) {
			St.ThemeContext.get_for_stage(global.stage).scale_factor = mutterScalingFactor;
		}
	},

	_onXOverridesSettingChanged: function(settings, overrides) {
		let gdkScalingFactor = getGdkScalingFactor(overrides);
		log('GNOME Settings Daemon overrides "Gdk/WindowScalingFactor" setting changed signal: '
			+ gdkScalingFactor);
		if (gdkScalingFactor !== null) {
			// We shall force a scale change for Mutter
			if (this._interfaceSettings.get_uint('scaling-factor') !== gdkScalingFactor) {
				this._interfaceSettings.set_uint('scaling-factor', gdkScalingFactor);
			}
			// We shall force a scale change for St
			if (St.ThemeContext.get_for_stage(global.stage).scale_factor !== gdkScalingFactor) {
				St.ThemeContext.get_for_stage(global.stage).scale_factor = gdkScalingFactor;
			}
		}
	}
});

Signals.addSignalMethods(ScalingManager.prototype);


/*
 * Utils
 */

function getScaleFactor() {
	return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}


function getGdkScalingFactor(overrides) {
	if (overrides !== null) {
		let gdkWindowScalingFactor = overrides.lookup_value('Gdk/WindowScalingFactor',
			new GLib.VariantType('i'));
		if (gdkWindowScalingFactor !== null) {
			return gdkWindowScalingFactor.get_int32();
		}
	}
	return null;
}


function setGdkScalingFactor(settings, gdkScalingFactor) {
	gdkScalingFactor = new GLib.Variant('i', gdkScalingFactor);
	let overrides = settings.get_value('overrides');
	if (overrides === null) {
		overrides = new GLib.Variant('a{sv}', {
			'Gdk/WindowScalingFactor': gdkScalingFactor
		});
	}
	else {
		overrides = new GLib.VariantDict(overrides);
		overrides.insert_value('Gdk/WindowScalingFactor', gdkScalingFactor);
		overrides = overrides.end();
	}
	settings.set_value('overrides', overrides);
}
