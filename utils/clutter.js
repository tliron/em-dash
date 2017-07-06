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

const Clutter = imports.gi.Clutter;


function isDescendent(actor, ancestor) {
	for (; actor !== null; actor = actor.get_parent()) {
		if (actor === ancestor) {
			return true;
		}
	}
	return false;
}


function getIndexOfChild(actor, child) {
	let nChildren = actor.get_n_children();
	for (let i = 0; i < nChildren; i++) {
		let theChild = actor.get_child_at_index(i);
		if (theChild === child) {
			return i;
		}
	}
	return -1;
}


function newRect(x, y, width, height) {
	return new Clutter.Rect({
		origin: new Clutter.Point({x: x, y: y}),
		size: new Clutter.Size({width: width, height: height})
	});
}


function getMinimumWidth(actor, height = -1) {
	let [minimum] = actor.get_preferred_width(height);
	return minimum;
}


function getMiniumHeight(actor, width = -1) {
	let [minimum] = actor.get_preferred_height(width);
	return minimum;
}


function getNaturalWidth(actor, height = -1) {
	let [, natural] = actor.get_preferred_width(height);
	return natural;
}


function getNaturalHeight(actor, width = -1) {
	let [, natural] = actor.get_preferred_height(width);
	return natural;
}


const eventTypeAsString = new Map([
	[Clutter.EventType.NOTHING, 'NOTHING'],
	[Clutter.EventType.KEY_PRESS, 'KEY_PRESS'],
	[Clutter.EventType.KEY_RELEASE, 'KEY_RELEASE'],
	[Clutter.EventType.MOTION, 'MOTION'],
	[Clutter.EventType.ENTER, 'ENTER'],
	[Clutter.EventType.LEAVE, 'LEAVE'],
	[Clutter.EventType.BUTTON_PRESS, 'BUTTON_PRESS'],
	[Clutter.EventType.BUTTON_RELEASE, 'BUTTON_RELEASE'],
	[Clutter.EventType.SCROLL, 'SCROLL'],
	[Clutter.EventType.STAGE_STATE, 'STAGE_STATE'],
	[Clutter.EventType.DESTROY_NOTIFY, 'DESTROY_NOTIFY'],
	[Clutter.EventType.CLIENT_MESSAGE, 'CLIENT_MESSAGE'],
	[Clutter.EventType.DELETE, 'DELETE'],
	[Clutter.EventType.TOUCH_BEGIN, 'TOUCH_BEGIN'],
	[Clutter.EventType.TOUCH_UPDATE, 'TOUCH_UPDATE'],
	[Clutter.EventType.TOUCH_END, 'TOUCH_END'],
	[Clutter.EventType.TOUCH_CANCEL, 'TOUCH_CANCEL'],
	[Clutter.EventType.TOUCHPAD_PINCH, 'TOUCHPAD_PINCH'],
	[Clutter.EventType.TOUCHPAD_SWIPE, 'TOUCHPAD_SWIPE'],
	[Clutter.EventType.EVENT_LAST, 'EVENT_LAST']
]);