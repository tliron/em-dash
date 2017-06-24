/*
 * This file is part of the Em-Dash extension for GNOME.
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
 *
 * Original code by GitHub user SavageTiger:
 *
 *   https://github.com/SavageTiger/dash-to-dock
 */

const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gtk = imports.gi.Gtk;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const log = LoggingUtils.logger('icon');


function getStIconPixBuf(stIcon) {
	let gIcon = stIcon.gicon;
	if (gIcon !== null) {
		if (gIcon instanceof Gio.ThemedIcon) {
			let names = gIcon.names;
			log(`Gio.ThemedIcon: ${names.join(', ')}`);
			if (names.length > 0) {
				let name = names[0];
				let themeLoader = new Gtk.IconTheme();
				return [name, themeLoader.load_icon(name, 64, 0)];
			}
		}
		else if (gIcon instanceof Gio.FileIcon) {
			let path = gIcon.file.path;
			log(`Gio.FilIcon: ${path}`);
			return [name, GdkPixbuf.Pixbuf.new_from_file(path)];
		}
		else if (gIcon instanceof Gio.BytesIcon) {
			// TODO
			//let bytes = gIcon.bytes;
			//GdkPixbuf.Pixbuf.new_from_bytes(bytes, ...);
		}
	}
	return [null, null];
}
