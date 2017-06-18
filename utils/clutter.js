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


function getActorIndexOfChild(actor, child) {
	let n_children = actor.get_n_children();
	for (let i = 0; i < n_children; i++) {
		let theChild = actor.get_child_at_index(i);
		if (theChild === child) {
			return i;
		}
	}
	return -1;
}


function getNaturalWidth(actor, height) {
	if (height === undefined) {
		height = -1;
		let [min, natural] = actor.get_preferred_width(height);
		return natural;
	}
}


function getNaturalHeight(actor, width) {
	if (width === undefined) {
		width = -1;
		let [min, natural] = actor.get_preferred_height(width);
		return natural;
	}
}