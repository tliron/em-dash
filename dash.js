
const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Icons = Me.imports.icons;


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
		this._signalManager.on(global.screen, 'workspace-switched', this._onWorkspaceSwitched);
		this._signalManager.onProperty(windowTracker, 'focus-app', this._onFocusChanged);
    },

	destroy: function() {
		this._signalManager.destroy();
		this._icons.destroy();
    	if (this._dashWasVisible) {
    		Main.overview._controls.dash.actor.show();
    	}
	},
	
	_onWorkspaceSwitched: function(screen, oldWorkspaceIndex, newWorkspaceIndex, direction) {
		Utils.log('[workspace-switched] from ' + oldWorkspaceIndex + ' to ' + newWorkspaceIndex +
				' (' + direction + ')');
		if (!this._entryManager.single) {
			this._icons.refresh(newWorkspaceIndex);
		}
	},

	_onFocusChanged: function(windowTracker, app) {
		if (app === null) {
			Utils.log('[focus-changed] none');
			return;
		}
		let id = app.id;
		let name = app.get_name();
		Utils.log('[focus-changed] ' + id + ' ' + name);
		this._entryManager.log();
	}
});