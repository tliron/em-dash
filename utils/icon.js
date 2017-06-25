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
 * Some code by GitHub user SavageTiger:
 *
 *   https://github.com/SavageTiger/dash-to-dock
 */

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const log = LoggingUtils.logger('icon');


/**
 * Gets a GdkPixbuf from an St.Icon.
 *
 * See st_texture_cache_load_gicon and load_texture_async in st-texture-cache.c.
 */
function getStIconPixbuf(stIcon, physicalSize) {
	let gIcon = stIcon.gicon;
	if (gIcon === null) {
		log('getStIconPixbuf: no GIcon');
		return null;
	}

	let themeNode = stIcon.get_theme_node();
	if (themeNode === null) {
		log('getStIconPixbuf: no theme node');
		return null;
	}

	// Lookup flags
	let lookupFlags = Gtk.IconLookupFlags.USE_BUILTIN;
	switch (themeNode.get_icon_style()) {
	case St.IconStyle.REGULAR:
		lookupFlags |= Gtk.IconLookupFlags.FORCE_REGULAR;
		break;
	case St.IconStyle.SYMBOLIC:
		lookupFlags |= Gtk.IconLookupFlags.FORCE_SYMBOLIC;
		break;
	}
	switch (stIcon.text_direction) {
	case Clutter.TextDirection.LTR:
		lookupFlags |= Gtk.IconLookupFlags.DIR_LTR;
		break;
	case Clutter.TextDirection.RTL:
		lookupFlags |= Gtk.IconLookupFlags.DIR_RTL;
		break;
	}

	let iconTheme = Gtk.IconTheme.get_default();
	let iconInfo = iconTheme.lookup_by_gicon_for_scale(gIcon, physicalSize, 1, lookupFlags);
	return iconInfo.load_icon();
}


/**
 * Gets a Clutter.Texture from an St.Icon.
 *
 * We are not using this function, but it's here for reference.
 *
 * See st_icon_update in st-icon.c.
 */
function getStIconClutterTexture(stIcon, physicalSize) {
	let themeNode = stIcon.get_theme_node();
	if (themeNode == null) {
		return null;
	}
	let cache = St.TextureCache.get_default();
	let gIcon = stIcon.gicon;
	return cache.load_gicon(themeNode, gIcon, physicalSize, 1);
}


/**
 * Gets a GdkPixbuf from a Gio.GIcon.
 *
 * We are not using this function, but it's here for reference.
 */
function getGIconPixbuf(gIcon, physicalSize) {
	if (gIcon instanceof Gio.ThemedIcon) {
		let names = gIcon.names;
		log(`Gio.ThemedIcon: ${names.join(', ')}`);
		if (names.length > 0) {
			let name = names[0];
			let iconTheme = Gtk.IconTheme.get_default();;
			return iconTheme.load_icon(name, 64, 0);
		}
	}
	else if (gIcon instanceof Gio.FileIcon) {
		let path = gIcon.file.path;
		log(`Gio.FileIcon: ${path}`);
		return GdkPixbuf.Pixbuf.new_from_file(path);
	}
	else if (gIcon instanceof Gio.BytesIcon) {
		log('Gio.BytesIcon');
		// TODO
		let bytes = gIcon.bytes;
		//GdkPixbuf.Pixbuf.new_from_bytes(bytes, ...);
	}
	return null
}
