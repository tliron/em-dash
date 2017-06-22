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

const Lang = imports.lang;
const DND = imports.ui.dnd;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;

const log = Logging.logger('draggable');


/**
 * Makes it a easier to use GNOME Shell's DND by managing the signals and calling delegated
 * functions.
 */
const Draggable = new Lang.Class({
	Name: 'EmDash.Draggable',

	_init: function(actor) {
		log('_init');
		this.actor = actor;

		this._draggable = DND.makeDraggable(actor);

		// Monkey patches
		this._originalCancelDrag = this._draggable._cancelDrag;
		this._draggable._cancelDrag = Lang.bind(this, this._cancelDrag);
		this._originalGetRestoreLocation = this._draggable._getRestoreLocation;
		this._draggable._getRestoreLocation = Lang.bind(this, this._getRestoreLocation);

		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(this._draggable, 'drag-begin', this._onDragBegan);
		this._signalManager.connect(this._draggable, 'drag-cancelled', this._onDragCancelled);
		this._signalManager.connect(this._draggable, 'drag-end', this._onDragEnded);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
	},

	fakeRelease: function() {
		this._draggable.fakeRelease();
	},

	_onDragBegan: function(draggable, time) {
		if (this.actor._delegate && this.actor._delegate.handleDragBegin) {
			this.actor._delegate.handleDragBegin();
		}
	},

	_cancelDrag: function(eventTime) {
		if (this.actor._delegate && this.actor._delegate.handleDragCancelling) {
			this.actor._delegate.handleDragCancelling();
		}
		this._originalCancelDrag.call(this._draggable, eventTime);
	},

	_getRestoreLocation: function() {
		if (this.actor._delegate && this.actor._delegate.getDragRestoreLocation) {
			return this.actor._delegate.getDragRestoreLocation();
		}
		return this._originalGetRestoreLocation.call(this._draggable);
	},

	_onDragCancelled: function(draggable, time) {
		// Unnecessary, because _onDragEnded will be called anyway with dropped=false
		if (this.actor._delegate && this.actor._delegate.handleDragCancelled) {
			this.actor._delegate.handleDragCancelled();
		}
	},

	_onDragEnded: function(draggable, time, dropped) {
		if (this.actor._delegate && this.actor._delegate.handleDragEnd) {
			this.actor._delegate.handleDragEnd(dropped);
		}
	}
});
