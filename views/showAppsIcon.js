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
const Main = imports.ui.main;
const Dash = imports.ui.dash;
const GObject = imports.gi.GObject;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;

const log = LoggingUtils.logger('showAppsIcon');


/**
 * Our version of ShowAppsIcon will activate/deactivate the overview.
 *
 * Note that this is a GObject class!
 */
var ShowAppsIcon = GObject.registerClass(
class EmDash_ShowAppsIcon extends Dash.ShowAppsIcon {
	_init(logicalIconSize) {
		super._init();

		this.childScale = 1;
		this.childOpacity = 255;
		this.icon.setIconSize(logicalIconSize);

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connectProperty(this.toggleButton, 'checked',
			this._onButtonCheckedChanged);
		this._signalManager.connectProperty(Main.overview.viewSelector._showAppsButton, 'checked',
			this._onBuiltInButtonCheckedChanged);

		this.child.add_style_class_name('show-apps-minimal');
	}

	destroy() {
		this._signalManager.destroy();
		super.destroy();
	}

	// Signals

	_onButtonCheckedChanged(button, checked) {
		log(`"checked" property changed signal: ${checked}`);
		if (Main.overview.viewSelector._showAppsButton.checked !== checked) {
			Main.overview.viewSelector._showAppsButton.checked = checked;
		}
		if (checked) {
			Main.overview.show();
		}
		else {
			Main.overview.hide();
		}
	}

	_onBuiltInButtonCheckedChanged(button, checked) {
		log(`built-in ShowAppsIcon "checked" property changed signal: ${checked}`);
		// TODO: occasionally this causes an error: reference to undefined property "checked"
		// how to replicate?
		if (this.toggleButton.checked !== checked) {
			this.toggleButton.checked = checked;
		}
	}
});

