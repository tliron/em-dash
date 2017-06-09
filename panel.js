
const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;
const Icons = Me.imports.icons;


function patchAllocate(obj) {
	let originalAllocate = obj.allocate;
	obj.allocate = Lang.bind(obj, (box, flags, original) => {
    	if (original) { 
    		originalAllocate(box, flags);
    	}
	});
}


/**
 * Dash implementation on the GNOME Shell panel.
 */
const Panel = new Lang.Class({
	Name: 'EmDash.Panel',
	Extends: Dash.Dash,
    
	_init: function(entryManager) {
		Utils.log('init panel');
    	
		/*this.panel = Main.panel;
		this.container = this.panel._leftBox;
		this.appMenu = this.panel.statusArea.appMenu;
		this.panelBox = Main.layoutManager.panelBox;*/

		this._actor = new St.Bin({
			name: 'EmDash-Panel'
		});

		this._box = new St.BoxLayout({
			name: 'EmDash-Box'
		});
		this._actor.set_child(this._box);

		// Remove application menu (TODO: configurable?)
		this._appMenu = Main.panel.statusArea.appMenu.container;
		this._appMenuWasVisible = Main.panel._leftBox.contains(this._appMenu);
		if (this._appMenuWasVisible) {
			Main.panel._leftBox.remove_child(this._appMenu);
		}

		Main.panel._leftBox.add_child(this._actor);

		//Main.uiGroup.add_actor(text);
		
		/*let button = new PanelMenu.Button();
		button.actor.add_actor(text)
		Main.panel.addToStatusArea('hi', button);*/
		
//		patchAllocate(Main.panel._leftBox);
//		patchAllocate(Main.panel._centerBox);
//		patchAllocate(Main.panel._rightBox);

    	this.parent(entryManager);

		// Signals
		//this._signalManager.on(Main.panel.actor, 'allocate', this._onPanelAllocated);
		
		this.refreshEntries();
    },

	destroy: function() {
		this.parent();
		this._actor.destroy();
		if (this._appMenuWasVisible) {
			Main.panel._leftBox.add_child(this._appMenu);
		}
	},
	
	_refreshEntries: function(entrySequence) {
		this._box.remove_all_children();

		let text = new St.Label({
			text: 'Em Dash',
			y_align: Clutter.ActorAlign.CENTER
		});
		this._box.add_child(text);

		let size = Main.panel.actor.get_height() - 10; // TODO: how do we know the _dot height?
		for (let i in entrySequence._entries) {
			let entry = entrySequence._entries[i];
			let appIcon = new Icons.Icon(entry._app);
			//Utils.log(appIcon._dot.get_height()); 0
			appIcon.icon.iconSize = size; // IconGrid.BaseIcon
			this._box.add_child(appIcon.actor);
		}
	},
	
	_onPanelAllocated: function(actor, box, flags) {
		return;
	}
});
