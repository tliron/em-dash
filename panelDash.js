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
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;


function log(message) {
	Utils.log('{PanelDash} ' + message);
}


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
		log('init');
    	
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
		//this._signalManager.connect(Main.panel.actor, 'allocate', this._onPanelAllocated);
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
