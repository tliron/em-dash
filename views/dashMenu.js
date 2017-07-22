/*
 * This file is part of the Em-Dash extension for GNOME Shell.
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
const Util = imports.misc.util;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = e => e;

const log = LoggingUtils.logger('dashMenu');


/**
 * Dash menu.
 */
var DashMenu = new Lang.Class({
	Name: 'EmDash.DashMenu',
	Extends: PopupMenu.PopupMenu,

	_init(actor, side) {
		log('_init');

		this.parent(actor, 0.5, side);

		let item = new PopupMenu.PopupSeparatorMenuItem(_('Em—Dash'));
		this.addMenuItem(item);

		item = new PopupMenu.PopupMenuItem(_('Settings...'));
		this.addMenuItem(item);
		item.connect('activate', Lang.bind(this, this._onSettings));

		Main.uiGroup.add_actor(this.actor);

		this.close();
	},

	_onSettings() {
		log('settings item "activate" signal');
		Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid]);
	}
});