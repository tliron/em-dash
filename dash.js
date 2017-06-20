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
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;
const ClutterUtils = Me.imports.utils.clutter;
const MutterUtils = Me.imports.utils.mutter;
const Scaling = Me.imports.utils.scaling;
const Entries = Me.imports.entries;
const Icons = Me.imports.icons;

const log = Logging.logger('dash');


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
    	this.entryManager = new Entries.EntryManager(settings);
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
    		this._appMenuIndex = ClutterUtils.getActorIndexOfChild(Main.panel._RightBox, appMenu);
			if (this._appMenuIndex !== -1) {
				this._appMenuParent = Main.panel._rightBox;
			}
		}

		this._signalManager = new Signals.SignalManager(this);

		// TODO: isn't there a more specific signal we can connect to?
		// Initialize later, to make sure themes are applied
		this._laterManager = new MutterUtils.LaterManager(this);
		this._laterManager.later(this.initialize);
    },

	destroy: function() {
    	log('destroy');
		this._signalManager.destroy();
		this._laterManager.destroy();
		if (this.dash !== null) {
			this.dash.destroy();
		}
		this.entryManager.destroy();
		this.scalingManager.destroy();
		this.restoreBuiltInDash();
		this.restoreAppMenu();
	},

	initialize: function() {
		this._signalManager.connectSetting(this.settings, 'dash-location', 'string',
			this._onDashLocationChanged);
		this._signalManager.connectSetting(this.settings, 'icons-app-menu', 'boolean',
			this._onIconsAppMenuSettingChanged);
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
		log('"dash-location" setting changed signal: ' + dashLocation);
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

	_onIconsAppMenuSettingChanged: function(settings, iconsAppMenu) {
		log('"icons-app-menu" setting changed signal: ' + iconsAppMenu);
		if (iconsAppMenu) {
			this.removeAppMenu();
		}
		else {
			this.restoreAppMenu();
		}
	}
});


/**
 * Base class for dash implementations, such as Panel and Dock.
 */
const Dash = new Lang.Class({
    Name: 'EmDash.Dash',

    _init: function(dashManager, styleClass, vertical, iconHeight) {
		this._dashManager = dashManager;
    	this._icons = new Icons.Icons(dashManager.entryManager, dashManager.scalingManager,
    		styleClass, vertical, iconHeight);
		this._signalManager = new Signals.SignalManager(this);
    },

	destroy: function() {
		this._signalManager.destroy();
		this._icons.destroy();
	},

	setLocation: function(location) {
	}
});
