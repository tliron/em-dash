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
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;

const log = Utils.logger('panelDash');


/**
 * Dash implementation on the GNOME Shell panel.
 */
const PanelDash = new Lang.Class({
	Name: 'EmDash.PanelDash',
	Extends: Dash.Dash,
    
	_init: function(settings, entryManager) {
		log('init');
    	
    	this.parent(settings, entryManager, false, St.Align.MIDDLE);
    },
	
	setPosition: function(position) {
		let actor = this._icons.actor;
		switch (position) {
		case 'PANEL_NEAR':
			if (Main.panel._centerBox.contains(actor)) {
				Main.panel._centerBox.remove_child(actor);
			}
			let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;
			if (rtl) {
				if (!Main.panel._rightBox.contains(actor)) {
					Main.panel._rightBox.add_child(actor);
				}
			}
			else {
				if (!Main.panel._leftBox.contains(actor)) {
					Main.panel._leftBox.add_child(actor);
				}
			}
			break;
		case 'PANEL_MIDDLE':
			if (Main.panel._leftBox.contains(actor)) {
				Main.panel._leftBox.remove_child(actor);
			}
			else if (Main.panel._rightBox.contains(actor)) {
				Main.panel._rightBox.remove_child(actor);
			}
			if (!Main.panel._centerBox.contains(actor)) {
				Main.panel._centerBox.add_child(actor);
			}
			break;
		}
	}
});
