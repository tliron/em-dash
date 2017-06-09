
const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;


/**
 * Base class for dash implementations, such as Panel and Dock.
 */
const Dash = new Lang.Class({
    Name: 'EmDash.Dash',
    
    _init: function(entryManager) {
    	this._entryManager = entryManager;
    	
    	// Hide built-in dash
    	this._dashWasVisible = Main.overview._controls.dash.actor.visible;
    	if (this._dashWasVisible) {
    		Main.overview._controls.dash.actor.hide();
    	}

		// Signals
		let windowTracker = Shell.WindowTracker.get_default();
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.on(entryManager, 'changed', this._onEntriesChanged);
		this._signalManager.on(global.screen, 'workspace-switched', this._onWorkspaceSwitched);
		this._signalManager.onProperty(windowTracker, 'focus-app', this._onFocusChanged);
    },

	destroy: function() {
		this._signalManager.destroy();
    	if (this._dashWasVisible) {
    		Main.overview._controls.dash.actor.show();
    	}
	},
	
	refreshEntries: function(workspaceIndex) {
		if (workspaceIndex === undefined) {
			workspaceIndex = global.screen.get_active_workspace().index();
		}
		let entrySequence = this._entryManager.getEntrySequence(workspaceIndex);
		this._refreshEntries(entrySequence);
	},
	
	_refreshEntries: function(entrySequence) {
	},

	_onEntriesChanged: function(entryManager) {
		Utils.log('[entries-changed]');
		this.refreshEntries();
	},
	
	_onWorkspaceSwitched: function(screen, oldWorkspaceIndex, newWorkspaceIndex, direction) {
		Utils.log('[workspace-switched] from ' + oldWorkspaceIndex + ' to ' + newWorkspaceIndex +
				' (' + direction + ')');
		if (!this._entryManager.single) {
			this.refresh(newWorkspaceIndex);
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