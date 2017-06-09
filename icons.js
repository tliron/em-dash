
const Lang = imports.lang;
const Main = imports.ui.main;
const AppDisplay = imports.ui.appDisplay;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;


/**
 * UI representation of a dash entry. 
 */
const Icon = new Lang.Class({
	Name: 'EmDash.Icon',
    Extends: AppDisplay.AppIcon,
    
	_init: function(app, params) {
		params = params || {};
		params.showLabel = false;
		this.parent(app, params);
	}
});


/**
 * UI representation of an dash entry sequence.
 */
const Icons = new Lang.Class({
	Name: 'EmDash.Icons',
	
	_init: function(entryManager, vertical) {
    	this._entryManager = entryManager;
    	this._vertical = vertical;

    	// Actor
		this.actor = new St.Bin({
			name: 'EmDash-Icons'
		});

		// Box
		this._box = new St.BoxLayout({
			name: 'EmDash-Icons-Box',
			vertical: vertical === true
		});
		this.actor.set_child(this._box);

		// Signals
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.on(entryManager, 'changed', this._onEntriesChanged);
		
		this.refresh();
	},

	destroy: function() {
		this._signalManager.destroy();
		this.actor.destroy();
	},

	refresh: function(workspaceIndex) {
		if (workspaceIndex === undefined) {
			workspaceIndex = global.screen.get_active_workspace().index();
		}
		let entrySequence = this._entryManager.getEntrySequence(workspaceIndex);
		this._refresh(entrySequence);
	},
	
	_refresh: function(entrySequence) {
		this._box.remove_all_children();

		let text = new St.Label({
			text: 'Dash',
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER
		});
		this._box.add_child(text);

		let size = this._vertical ? 36 : Main.panel.actor.get_height() - 10; // TODO: how do we know the _dot height?
		for (let i in entrySequence._entries) {
			let entry = entrySequence._entries[i];
			let appIcon = new Icon(entry._app);
			//Utils.log(appIcon._dot.get_height()); 0
			appIcon.icon.iconSize = size; // IconGrid.BaseIcon
			this._box.add_child(appIcon.actor);
		}
	},

	_onEntriesChanged: function(entryManager) {
		Utils.log('[entries-changed]');
		this.refresh();
	}
});
