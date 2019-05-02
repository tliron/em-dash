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

const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const DialogUtils = Me.imports.utils.dialog;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = e => e;


/**
 * Just tells the user to click on the grabbing dash icon.
 */
var GrabDialog = class GrabDialog extends DialogUtils.MessageDialog {
	constructor(iconView) {
		super();

		const app = iconView.app;
		const name = GLib.markup_escape_text(app.get_name(), -1);

		this.addTitle(_('Em—Dash'));
		this.addMessage(_('Click on the dash icon that should'
			.format(name)));
		this.addMessage(_('grab the currently open windows of'
			.format(name)));
		this.addMessage(_('<b>%s</b>.'
			.format(name)));
	}

	open() {
		super.open();
		global.display.set_cursor(Meta.Cursor.POINTING_HAND);
	}

	destroy() {
		super.destroy();
		global.display.set_cursor(Meta.Cursor.DEFAULT);
	}
};
