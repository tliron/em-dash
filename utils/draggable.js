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
const DND = imports.ui.dnd;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const PatchUtils = Me.imports.utils.patch;

const log = LoggingUtils.logger('draggable');


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
		this._patchManager = new PatchUtils.PatchManager(this);
		this._patchManager.patch(this._draggable, '_cancelDrag', this._cancelDrag);
		this._patchManager.patch(this._draggable, '_getRestoreLocation', this._getRestoreLocation);

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this._draggable, 'drag-begin', this._onDragBegan);
		this._signalManager.connect(this._draggable, 'drag-cancelled', this._onDragCancelled);
		this._signalManager.connect(this._draggable, 'drag-end', this._onDragEnded);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
		this._patchManager.destroy();
	},

	fakeRelease: function() {
		this._draggable.fakeRelease();
	},

	_onDragBegan: function(draggable, time) {
		if (this.actor._delegate && this.actor._delegate.handleDragBegin) {
			this.actor._delegate.handleDragBegin();
		}
	},

	_cancelDrag: function(original, eventTime) {
		if (this.actor._delegate && this.actor._delegate.handleDragCancelling) {
			this.actor._delegate.handleDragCancelling();
		}
		original(eventTime);
	},

	_getRestoreLocation: function(original) {
		if (this.actor._delegate && this.actor._delegate.getDragRestoreLocation) {
			return this.actor._delegate.getDragRestoreLocation();
		}
		original();
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
