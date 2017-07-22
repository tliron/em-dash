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

const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const MutterUtils = Me.imports.utils.mutter;

const log = LoggingUtils.logger('scaling');


// Non-SVG icon themes tend to have icons in these sizes (except for 64 and 96)
const ICON_SAFE_SIZES = [8, 16, 22, 24, 32, 48, 64, 96, 128, 256, 512];


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
 * This setting is used directly by GTK+, so it's a good setting to change to affect scaling for
 * desktop applications, as well as window decorations. But what about GNOME Shell? It's a bit of a
 * mess...
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
 * However, we don't, because this would just "zoom in" and double the size of pixels, making fonts,
 * icons, and other decorations look bad. So, in GNOME Shell this is always 1.
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
 * Note that if there is *no* monitor manager, then "ui_scaling_factor" is taken from XSETTINGS's
 * "Gdk/WindowScalingFactor". But this doesn't happen in GNOME.
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
 * here to apply the setting that GNOME Tweak uses in order to avoid having to restart.
 *
 * Everything in St explicitly multiplies pixel sizes by this value. That might sound great, except
 * that often in your code you will work directly with Clutter APIs, for which you will have to
 * apply St scaling yourself. This includes icon sizes.
 *
 * The recommendation is, wherever you can, to mostly with "logical" sizes, which are universal for
 * whatever scaling factor (like pixel sizes in CSS). Only when "dropping" to Clutter do you have
 * to convert to "physical" sizes.
 */
var ScalingManager = new Lang.Class({
	Name: 'EmDash.ScalingManager',

	_init() {
		log('_init');

		this._factor = null;

		this._interfaceSettings = new Gio.Settings({
    		schema_id: 'org.gnome.desktop.interface'
    	});
		this._xSettings = new Gio.Settings({
    		schema_id: 'org.gnome.settings-daemon.plugins.xsettings'
    	});

		this._laterManager = new MutterUtils.LaterManager(this);

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		const themeContext = St.ThemeContext.get_for_stage(global.stage);
		this._signalManager.connectProperty(themeContext, 'scale-factor',
			this._onStThemeContextScaleFactorChanged);
		this._signalManager.connectSetting(this._interfaceSettings, 'scaling-factor', 'uint',
			this._onMutterScalingFactorSettingChanged);
		this._signalManager.connectSetting(this._xSettings, 'overrides', 'value',
			this._onXOverridesSettingChanged);
	},

	destroy() {
		log('destroy');
		this._laterManager.destroy();
		this._signalManager.destroy();
		this._interfaceSettings.run_dispose();
		this._xSettings.run_dispose();
	},

	toPhysical(logicalSize) {
		return logicalSize * this._factor;
	},

	toLogical(physicalSize) {
		return physicalSize / this._factor;
	},

	getSafeIconSize(physicalSize) {
		for (let i = 1; i < ICON_SAFE_SIZES.length; i++) {
			let nextPhysicalSize = this.toPhysical(ICON_SAFE_SIZES[i]);
			if (nextPhysicalSize > physicalSize) {
				return this.toPhysical(ICON_SAFE_SIZES[i - 1]);
			}
		}
		return this.toPhysical(ICON_SAFE_SIZES[ICON_SAFE_SIZES.length - 1]);
	},

	get stFactor() {
		return getStScaleFactor();
	},

	set stFactor(factor) {
		// WARNING: setting St scaling to 0 will crash GNOME Shell
		if (factor < 1) {
			log(`attemping to set bad value for stFactor: ${factor}`);
			return;
		}

		// We need to give time for other signal listeners to update the theme context first
		this._laterManager.later(() => {
			setStScaleFactor(factor);
		}, Meta.LaterType.RESIZE);
	},

	get mutterFactor() {
		return this._interfaceSettings.get_uint('scaling-factor');
	},

	set mutterFactor(factor) {
		// Setting Mutter factor to 0 means disabling the override
		if (factor < 0) {
			log(`attemping to set bad value for mutterFactor: ${factor}`);
			return;
		}

		this._interfaceSettings.set_uint('scaling-factor', factor);
	},

	get gdkFactor() {
		const overrides = this._xSettings.get_value('overrides');
		return getGdkWindowScalingFactor(overrides);
	},

	set gdkFactor(factor) {
		// WARNING: setting GDK scaling override to 0 will crash GNOME Shell and will prevent it
		// from restarting!
		if (factor < 1) {
			log(`attemping to set bad value for gdkFactor: ${factor}`);
			return;
		}

		if (this.gdkFactor !== factor) {
			setGdkWindowScalingFactor(this._xSettings, factor);
		}
	},

	_onStThemeContextScaleFactorChanged(themeContext, scaleFactor) {
		// Note: this is called whenever the theme context is changed, even if scale-factor
		// itself has *not* changed
		log(`St theme context "scale-factor" property changed signal: ${scaleFactor}`);
		if (scaleFactor !== this._factor) {
			if (this._factor === null) {
				this._factor = scaleFactor;
				this.emit('initialized');
			}
			else {
				this._factor = scaleFactor;
				this.emit('changed', scaleFactor);
			}
		}
	},

	_onMutterScalingFactorSettingChanged(settings, mutterScalingFactor) {
		log(`Mutter "scaling-factor" setting changed signal: ${mutterScalingFactor}`);
		if (mutterScalingFactor === 0) {
			// This will trigger a signal
			this.stFactor = getStScaleFactor();
		}
		else {
			// Propagate
			this.gdkFactor = mutterScalingFactor;
			this.stFactor = mutterScalingFactor;
		}
	},

	_onXOverridesSettingChanged(settings, overrides) {
		const gdkWindowScalingFactor = getGdkWindowScalingFactor(overrides);
		log(`GNOME Settings Daemon overrides "Gdk/WindowScalingFactor" setting changed signal: ${gdkWindowScalingFactor}`);
		if (gdkWindowScalingFactor !== null) {
			if (gdkWindowScalingFactor < 1) {
				this._laterManager.later(() => {
					// If we won't fix this, GNOME Shell will not be able to start!!!
					removeGdkWindowScalingFactor(settings);
				});
			}
			else {
				// Propagate
				this.mutterFactor = gdkWindowScalingFactor;
				this.stFactor = gdkWindowScalingFactor;
			}
		}
	}
});

Signals.addSignalMethods(ScalingManager.prototype);


/*
 * Utils
 */

function getStScaleFactor() {
	return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}


function setStScaleFactor(scaleFactor) {
	St.ThemeContext.get_for_stage(global.stage).scale_factor = scaleFactor;
}


function getGdkWindowScalingFactor(overrides) {
	if (overrides !== null) {
		const gdkWindowScalingFactor = overrides.lookup_value('Gdk/WindowScalingFactor',
			new GLib.VariantType('i'));
		if (gdkWindowScalingFactor !== null) {
			return gdkWindowScalingFactor.get_int32();
		}
	}
	return null;
}


function setGdkWindowScalingFactor(settings, factor) {
	let overrides = settings.get_value('overrides');
	factor = new GLib.Variant('i', factor);
	if (overrides === null) {
		overrides = new GLib.Variant('a{sv}', {
			'Gdk/WindowScalingFactor': factor
		});
	}
	else {
		overrides = new GLib.VariantDict(overrides);
		overrides.insert_value('Gdk/WindowScalingFactor', factor);
		overrides = overrides.end();
	}
	settings.set_value('overrides', overrides);
}


function removeGdkWindowScalingFactor(settings) {
	let overrides = settings.get_value('overrides');
	if (overrides !== null) {
		overrides = new GLib.VariantDict(overrides);
		overrides.remove('Gdk/WindowScalingFactor');
		overrides = overrides.end();
		settings.set_value('overrides', overrides);
	}
}
