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


const Me = imports.misc.extensionUtils.getCurrentExtension();


/**
 * Creates a logger function for a logger name.
 */
function logger(name) {
	return (message) => {
		if (Me.LOGGING_ENABLED && Me.LOGGING_IMPLEMENTATION) {
			Me.LOGGING_IMPLEMENTATION(`[Em-Dash] {${name}} ${message}`);
		}
	};
}


/*
 * Why not use global "let" vars here, and instead put our global values in the extension object?
 * Because we found global "let" to be weirdly unreliable. A bug somewhere in the import mechanism
 * causes the globals to sometimes *not* be shared with other files. Our extension.js would enable
 * logging via a global "let" defined here, but some imported modules failed to log, while others
 * logged just fine. We could not find a way to reproduce the bug reliably.
 */
