
const Lang = imports.lang;
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;


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
const PanelDash = new Lang.Class({
	Name: 'EmDash.PanelDash',
	Extends: Dash.Dash,
    
	_init: function(entryManager) {
		Utils.log('init PanelDash');
    	
		/*this.panel = Main.panel;
		this.container = this.panel._leftBox;
		this.appMenu = this.panel.statusArea.appMenu;
		this.panelBox = Main.layoutManager.panelBox;*/

    	this.parent(entryManager, false);

		// Remove application menu (TODO: configurable?)
		this._appMenu = Main.panel.statusArea.appMenu.container;
		this._appMenuWasVisible = Main.panel._leftBox.contains(this._appMenu);
		if (this._appMenuWasVisible) {
			Main.panel._leftBox.remove_child(this._appMenu);
		}

		Main.panel._leftBox.add_child(this._icons.actor);

		//Main.uiGroup.add_actor(text);
		
		/*let button = new PanelMenu.Button();
		button.actor.add_actor(text)
		Main.panel.addToStatusArea('hi', button);*/
		
//		patchAllocate(Main.panel._leftBox);
//		patchAllocate(Main.panel._centerBox);
//		patchAllocate(Main.panel._rightBox);

		// Signals
		//this._signalManager.on(Main.panel.actor, 'allocate', this._onPanelAllocated);
    },

	destroy: function() {
		this.parent();
		if (this._appMenuWasVisible) {
			Main.panel._leftBox.add_child(this._appMenu);
		}
	},
	
	_onPanelAllocated: function(actor, box, flags) {
		return;
	}
});
