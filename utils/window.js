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
 */

const Clutter = imports.gi.Clutter;


function getFocusedWindowIndex(windows) {
	for (let i = 0; i < windows.length; i++) {
		let window = windows[i];
		if (window.has_focus()) {
			return i;
		}
	}
	return -1;
}


function hideWindows(windows) {
	for (let i = 0; i < windows.length; i++) {
		let window = windows[i];
		window.minimize();
	}
}


function focusWindow(window) {
	window.unminimize();
	window.raise();
	window.focus(Clutter.CURRENT_TIME);
}
