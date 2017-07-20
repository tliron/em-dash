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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;

const log = LoggingUtils.logger('showAppsIcon');


/**
 * Our version of ShowAppsIcon will activate/deactivate the overview.
 *
 * Note that this is a GObject class!
 */
var ShowAppsIcon = new Lang.Class({
	Name: 'EmDash-ShowAppsIcon', // can't use "." with GObject classes
	Extends: Dash.ShowAppsIcon,

	_init: function(logicalIconSize) {
		this.parent();

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
	},

	destroy: function() {
		this._signalManager.destroy();
		this.parent();
	},

	_onButtonCheckedChanged: function(button, checked) {
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
	},

	_onBuiltInButtonCheckedChanged: function(button, checked) {
		log(`built-in ShowAppsIcon "checked" property changed signal: ${checked}`);
		if (this.toggleButton.checked !== checked) {
			this.toggleButton.checked = checked;
		}
	}
});
