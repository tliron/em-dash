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
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;
const Scaling = Me.imports.utils.scaling;
const ModelManager = Me.imports.models.modelManager;

const log = LoggingUtils.logger('dashManager');


/**
 * Manages several dash implementations, switching between them according to changed to the
 * "location" setting.
 */
const DashManager = new Lang.Class({
    Name: 'EmDash.DashManager',

    _init: function(settings, dashClasses) {
    	log('_init');

    	this.dash = null;
    	this.settings = settings;
    	this.modelManager = new ModelManager.ModelManager(settings);
		this.scalingManager = new Scaling.ScalingManager();

    	this._dashClasses = dashClasses;
    	this._overlayDashWasVisible = Main.overview._controls.dash.actor.visible;

		this.removeBuiltInDash();

    	// Remember original location of app menu
		let appMenu = Main.panel.statusArea.appMenu.container;
		this._appMenuIndex = ClutterUtils.getActorIndexOfChild(Main.panel._leftBox, appMenu);
		this._appMenuParent = null;
		if (this._appMenuIndex !== -1) {
			this._appMenuParent = Main.panel._leftBox;
		}
		else {
    		this._appMenuIndex = ClutterUtils.getActorIndexOfChild(Main.panel._rightBox, appMenu);
			if (this._appMenuIndex !== -1) {
				this._appMenuParent = Main.panel._rightBox;
			}
		}

		this._signalManager = new SignalUtils.SignalManager(this);

		this._signalManager.connect(this.scalingManager, 'initialized', () => {
			// Initialize only when we have scaling info
			log('initialize');
			this._signalManager.connectSetting(settings, 'dash-location', 'string',
				this._onDashLocationChanged);
			this._signalManager.connectSetting(settings, 'menu-application', 'boolean',
				this._onMenuApplicationSettingChanged);
		}, true);
    },

	destroy: function() {
    	log('destroy');
		this._signalManager.destroy();
		if (this.dash !== null) {
			this.dash.destroy();
		}
		this.modelManager.destroy();
		this.scalingManager.destroy();
		this.restoreBuiltInDash();
		this.restoreAppMenu();
	},

	removeBuiltInDash: function() {
    	if (this._overlayDashWasVisible) {
    		Main.overview._controls.dash.actor.hide();
    	}
	},

	restoreBuiltInDash: function() {
    	if (this._overlayDashWasVisible) {
    		Main.overview._controls.dash.actor.show();
    	}
	},

	removeAppMenu: function() {
		if (this._appMenuParent !== null) {
			let appMenu = Main.panel.statusArea.appMenu.container;
			if (this._appMenuParent.contains(appMenu)) {
				this._appMenuParent.remove_child(appMenu);
			}
		}
	},

	restoreAppMenu: function() {
		if (this._appMenuParent !== null) {
			let appMenu = Main.panel.statusArea.appMenu.container;
			if (!this._appMenuParent.contains(appMenu)) {
				this._appMenuParent.insert_child_at_index(appMenu, this._appMenuIndex);
			}
		}
	},

	_onDashLocationChanged: function(settings, dashLocation) {
		log(`"dash-location" setting changed signal: ${dashLocation}`);
		let DashClass = this._dashClasses[dashLocation];
		if (this.dash !== null) {
			if (this.dash instanceof DashClass) {
				this.dash.setLocation(dashLocation);
				return;
			}
			else {
				this.dash.destroy();
			}
		}
		this.dash = new DashClass(this, dashLocation);
	},

	_onMenuApplicationSettingChanged: function(settings, menuApplication) {
		log(`"menu-application" setting changed signal: ${menuApplication}`);
		if (menuApplication) {
			this.removeAppMenu();
		}
		else {
			this.restoreAppMenu();
		}
	}
});
