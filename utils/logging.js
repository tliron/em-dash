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


const Me = imports.misc.extensionUtils.getCurrentExtension();


function logger(name) {
	return (message) => {
		if (Me.LOGGING_ENABLED && Me.LOGGING_IMPLEMENTATION) {
			Me.LOGGING_IMPLEMENTATION(`[Em-Dash] {${name}} ${message}`);
		}
	};
}
