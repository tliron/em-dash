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
const Utils = Me.imports.utils;
const Icons = Me.imports.icons;


function log(message) {
	Utils.log('{Dash} ' + message);
}


/**
 * Base class for dash implementations, such as Panel and Dock.
 */
const Dash = new Lang.Class({
    Name: 'EmDash.Dash',
    
    _init: function(entryManager, vertical) {
    	this._entryManager = entryManager;
    	
    	// Hide built-in dash
    	this._dashWasVisible = Main.overview._controls.dash.actor.visible;
    	if (this._dashWasVisible) {
    		Main.overview._controls.dash.actor.hide();
    	}
    	
    	// Icons
    	this._icons = new Icons.Icons(entryManager, vertical);

		// Signals
		let windowTracker = Shell.WindowTracker.get_default();
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.connect(global.screen, 'workspace-switched', this._onWorkspaceSwitched);
		this._signalManager.connectProperty(windowTracker, 'focus-app', this._onFocusChanged);
    },

	destroy: function() {
		this._signalManager.destroy();
		this._icons.destroy();
    	if (this._dashWasVisible) {
    		Main.overview._controls.dash.actor.show();
    	}
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
			return;
		}
		let id = app.id;
		let name = app.get_name();
		log('focus-changed: ' + id + ' ' + name);
		this._entryManager.log();
	}
});
