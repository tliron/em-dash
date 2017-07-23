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
const Atk = imports.gi.Atk;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;

const log = LoggingUtils.logger('dialog');

const ANIMATION_TIME = 0.1;


/**
 * This is an "almost-modal" dialog": it doesn't grab the keyboard and mouse, but will close if the
 * mouse is clicked anywhere in the workspace.
 */
var MessageDialog = new Lang.Class({
	Name: 'EmDash.MessageDialog',

	_init() {
		log('_init');

		this._overlay = null;

		// We are copying the structure and styles of prompt modal dialogs.
		// See: ui/modalDialog.js and ui/windowManager.js.

		// (Note that in versions of GNOME Shell *after* 3.24 this is separated into its own
		// reusable class in ui/dialog.js, with new style classes.)

		// Actor
		this.actor = new St.Widget({
			layout_manager: new Clutter.BinLayout(),
			accessible_role: Atk.Role.DIALOG,
			opacity: 0
		});
		this.actor.add_constraint(new Clutter.BindConstraint({
			source: global.stage,
			coordinate: Clutter.BindCoordinate.ALL
		}));

		// Dialog
		this._dialog = new St.BoxLayout({
			style_class: 'modal-dialog', // GNOME theme styling
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			vertical: true,
			request_mode: Clutter.RequestMode.HEIGHT_FOR_WIDTH
		});
		this.actor.add_child(this._dialog);

		// Content box
		this._contentBox = new St.BoxLayout({
			style_class: 'modal-dialog-content-box', // GNOME theme styling
			vertical: true
		});
		this._dialog.add(this._contentBox, {
			expand: true,
			x_fill: true,
			y_fill: true,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.START
		});

		// Buttons (we *have* to add this, because some themes expect it and render a background)
		this._buttons = new St.Widget({
			layout_manager: new Clutter.BoxLayout({
				homogeneous: true
			})
		});
		this._dialog.add(this._buttons, {
			x_align: St.Align.MIDDLE,
			y_align: St.Align.END
		});

		// Cancel
		this._cancel = new St.Button({
			style_class: 'modal-dialog-linked-button', // GNOME theme styling
			pseudo_class: 'default',
			button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
			reactive: true,
			can_focus: true,
			x_expand: true,
			y_expand: true,
			label: 'Cancel'
		});
		this._buttons.add_actor(this._cancel);

		// Main
		this._main = new St.BoxLayout({
			style_class: 'prompt-dialog-main-layout' // GNOME theme styling
		});
		this._contentBox.add_actor(this._main);

		// Message
		this._message = new St.BoxLayout({
			style_class: 'prompt-dialog-message-layout', // GNOME theme styling
			vertical: true
		});
		this._main.add(this._message, {
			expand: true,
			y_align: St.Align.START
		});

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this._cancel, 'clicked', this._onCancel);
	},

	destroy() {
		log('destroy');
		this._signalManager.destroy();
		this.emit('destroy');

		if (this._overlay !== null) {
			this._overlay.destroy();
		}

		// Fade out
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			opacity: 0,
			onComplete: () => {
				this.actor.destroy();
			}
		});
	},

	open() {
		log('open');

		const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

		// Reactive overlay (for click events)
		this._overlay = new Clutter.Actor({
			x: workArea.x,
			y: workArea.y,
			width: workArea.width,
			height: workArea.height,
			reactive: true
		});
		Main.layoutManager.addChrome(this._overlay);
		this._signalManager.connect(this._overlay, 'button-press-event', this._onButtonPressed);

		// Center
		Main.layoutManager.addChrome(this.actor);
		this.actor.set_position(
			(workArea.x + workArea.width - this.actor.width) / 2,
			(workArea.y + workArea.height - this.actor.height) / 2);

		global.focus_manager.add_group(this.actor);

		// Fade in
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			opacity: 255
		});
	},

	addTitle(text) {
		const label = new St.Label({
			text: text,
			style_class: 'prompt-dialog-headline', // GNOME theme styling
			x_align: Clutter.ActorAlign.CENTER
		});
		label.clutter_text.use_markup = true;
		this._message.add_actor(label, {
			y_fill: false,
			y_align: St.Align.START
		});
	},

	addMessage(text) {
		const label = new St.Label({
			text: text,
			x_align: Clutter.ActorAlign.CENTER
		});
		label.clutter_text.use_markup = true;
		this._message.add(label, {
			y_fill: false,
			y_align: St.Align.START
		});
	},

	// Signals

	_onCancel(actor) {
		log('cancel "clicked" signal');
		this.emit('cancel');
		this.destroy();
	},

	_onButtonPressed(actor, buttonEvent) {
		log('"button-press-event" signal');
		this.emit('cancel');
		this.destroy();
		return true;
	}
});

Signals.addSignalMethods(MessageDialog.prototype);
