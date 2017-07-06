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
const Signals = imports.signals;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;

const log = LoggingUtils.logger('dialog');

const ANIMATION_TIME = 0.1;


/**
 * This is an "almost-modal" dialog, in that it doesn't actually grab the keyboard and mouse, but
 * will disappear if the mouse is clicked anywhere in the workspace.
 */
const MessageDialog = new Lang.Class({
	Name: 'EmDash.MessageDialog',

	_init: function() {
		log('_init');

		this._overlay = null;

		// We will copy the structure and styles of modal dialogs, so it would look similar

		// Main actor
		this.actor = new St.BoxLayout({
			style_class: 'modal-dialog',
			request_mode: Clutter.RequestMode.HEIGHT_FOR_WIDTH,
			opacity: 0
		});

		// Context box
		this._content = new St.BoxLayout({
			style_class: 'modal-dialog-content-box',
			vertical: true
		});
		this.actor.add_child(this._content);

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
	},

	destroy: function() {
		log('destroy');
		this.emit('destroy');
		this._signalManager.destroy();
		this.actor.destroy();
		if (this._overlay !== null) {
			this._overlay.destroy();
		}
	},

	open: function() {
		log('open');

		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		Main.layoutManager.addChrome(this.actor);

		// Center
		this.actor.set_position(
			(workArea.x + workArea.width - this.actor.width) / 2,
			(workArea.y + workArea.height - this.actor.height) / 2);

		// Fade in
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			opacity: 255
		});

		// Overlay (for click events)
		this._overlay = new Clutter.Actor({
			x: workArea.x,
			y: workArea.y,
			width: workArea.width,
			height: workArea.height,
			reactive: true
		});
		Main.layoutManager.addChrome(this._overlay);
		this._signalManager.connect(this._overlay, 'button-press-event', this._onButtonPressed);
	},

	addLabel: function(text) {
		let label = new St.Label({
			text: text,
			x_align: Clutter.ActorAlign.CENTER
		});
		label.clutter_text.use_markup = true;
		this._content.add_child(label);
	},

	_onButtonPressed: function(actor, buttonEvent) {
		log('"button-press-event" signal');
		this.destroy();
		return true;
	}
});

Signals.addSignalMethods(MessageDialog.prototype);
