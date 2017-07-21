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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const SignalUtils = Me.imports.utils.signal;
const DashView = Me.imports.views.dashView;


/**
 * Base class for dash implementations, such as PanelDash and DockableDash.
 *
 * They should be considered singletons, as only one instance ever exists, as managed by
 * DashManager.
 */
var Dash = new Lang.Class({
	Name: 'EmDash.Dash',

	_init(dashManager, styleClass, vertical, iconSize, quantize) {
		this._dashManager = dashManager;
		this._view = new DashView.DashView(dashManager.modelManager, dashManager.scalingManager,
			styleClass, vertical, iconSize, quantize);
		this._signalManager = new SignalUtils.SignalManager(this);
	},

	destroy() {
		this._signalManager.destroy();
		this._view.destroy();
	},

	setLocation(location) {
	}
});
