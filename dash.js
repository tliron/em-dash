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
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;
const ClutterUtils = Me.imports.utils.clutter;
const Entries = Me.imports.entries;
const Icons = Me.imports.icons;

const log = Logging.logger('dash');


/**
 * Manages several dash implementations, switching between them according to changed to the
 * "location" setting.
 */
const DashManager = new Lang.Class({
    Name: 'EmDash.DashManager',

    _init: function(settings, _dashClasses) {
    	this._settings = settings;
    	this._dashClasses = _dashClasses;
    	this._entryManager = new Entries.EntryManager(settings); 

    	this.dash = null;

		this._appMenuParent = null;;
		this._appMenuIndex = -1;;
    	if (settings.get_boolean('move-app-menu-to-icon')) {
	    	// Remember original location of app menu
			let appMenu = Main.panel.statusArea.appMenu.container;
    		this._appMenuIndex = ClutterUtils.getActorIndexOfChild(Main.panel._leftBox, appMenu);
			if (this._appMenuIndex !== -1) {
				this._appMenuParent = Main.panel._leftBox;
			}
			else {
	    		this._appMenuIndex = ClutterUtils.getActorIndexOfChild(Main.panel._RightBox, appMenu);
				if (this._appMenuIndex !== -1) {
					this._appMenuParent = Main.panel._rightBox;
				}
			}
    	}

		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connectSetting(this._settings, 'location', 'string',
			this._onLocationChanged);
		this._signalManager.connectSetting(this._settings, 'move-app-menu-to-icon', 'boolean',
			this._onMoveAppMenuToIconSettingChanged);
		
		this._settings.emit('changed::location', 'location');
	},
	
	destroy: function() {
		this._signalManager.destroy();
		if (this.dash !== null) {
			this.dash.destroy();
		}
		this._entryManager.destroy();
		this.restoreAppMenu();
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
	
	_onLocationChanged: function(settings, location) {
		log('location-setting-changed: ' + location);
		let DashClass = this._dashClasses[location];
		if (this.dash !== null) {
			if (this.dash instanceof DashClass) {
				this.dash.setLocation(location);
				return;
			}
			else {
				this.dash.destroy();
			}
		}
		this.dash = new DashClass(this._settings, this._entryManager, location);
	},
	
	_onMoveAppMenuToIconSettingChanged: function(settings, moveAppMenuToIcon) {
		log('move-app-menu-to-icon-setting-changed: ' + moveAppMenuToIcon);
		if (moveAppMenuToIcon) {
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
    
    _init: function(settings, entryManager, vertical) {
		this._settings = settings;
    	this._entryManager = entryManager;
    	
    	// Hide overlay dash
    	this._overlayDashWasVisible = Main.overview._controls.dash.actor.visible;
    	if (this._overlayDashWasVisible) {
    		//Main.overview._controls.dash.actor.hide();
    	}
    	
    	// Icons
    	this._icons = new Icons.Icons(entryManager, vertical);

		let windowTracker = Shell.WindowTracker.get_default();
		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(global.screen, 'workspace-switched', this._onWorkspaceSwitched);
		this._signalManager.connectProperty(windowTracker, 'focus-app', this._onFocusChanged);
    },

	destroy: function() {
		this._signalManager.destroy();
		this._icons.destroy();
    	if (this._overlayDashWasVisible) {
    		Main.overview._controls.dash.actor.show();
    	}
	},
	
	setLocation: function(location) {
	},
	
	_onWorkspaceSwitched: function(screen, oldWorkspaceIndex, newWorkspaceIndex, direction) {
		log('workspace-switched from ' + oldWorkspaceIndex + ' to ' + newWorkspaceIndex +
			' (' + direction + ')');
		if (!this._entryManager.single) {
			this._icons.refresh(newWorkspaceIndex);
		}
	},

	_onFocusChanged: function(windowTracker, app) {
		if (app === null) {
			log('focus-changed: none');
		}
		else {
			log('focus-changed: ' + app.id + ' ' + app.get_name());
		}
	}
});
