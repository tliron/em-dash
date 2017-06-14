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

const Lang = imports.lang;
const DND = imports.ui.dnd;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.Logging;
const Signals = Me.imports.utils.signals;

const log = Logging.logger('draggable');


/**
 * Makes it a easier to use the Shell's DND by managing the signals and calling delegate functions.
 */
const Draggable = new Lang.Class({
	Name: 'EmDash.Draggable',
	
	_init: function(actor) {
		log('init');
		this.actor = actor;
		
		this._dragMonitor = null;
		this._draggable = DND.makeDraggable(actor);
		this._dragMonitor = {
			dragMotion: Lang.bind(this, this._onDragMotion),
			dragDrop: Lang.bind(this, this._onDragDrop)
		};

		// Signals
		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(this._draggable, 'drag-begin', this._onDragBegan);
		this._signalManager.connect(this._draggable, 'drag-cancelled', this._onDragCancelled);
		this._signalManager.connect(this._draggable, 'drag-end', this._onDragEnded);
	},

	destroy: function() {
		log('destroy');
		DND.removeDragMonitor(this._dragMonitor);
		this._signalManager.destroy();
	},
	
	fakeRelease: function() {
		this._draggable.fakeRelease();
	},

	_onDragBegan: function(draggable, time) {
		if (this.actor._delegate && this.actor._delegate.handleDragBegin) {
			this.actor._delegate.handleDragBegin();
		}
		DND.addDragMonitor(this._dragMonitor);
	},

	_onDragCancelled: function(draggable, time) {
		log('drag-cancelled: ' + time);
		// Unnecessary, because _onDragEnded will be called anyway with dropped=false
	},

	_onDragEnded: function(draggable, time, dropped) {
		DND.removeDragMonitor(this._dragMonitor);
		this._dragMonitor = null;
		if (this.actor._delegate && this.actor._delegate.handleDragEnd) {
			this.actor._delegate.handleDragEnd(dropped);
		}
	},
	
	_onDragMotion: function(dragEvent) {
		log('drag-motion');
		// Keeping it just for debugging
		return DND.DragMotionResult.CONTINUE;
	},
	
	_onDragDrop: function(dropEvent) {
		log('drag-drop');
		// Keeping it just for debugging, _onDragEnded will be called anyway
		return DND.DragDropResult.CONTINUE;
	}
});
