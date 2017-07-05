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
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const OverviewControls = imports.ui.overviewControls;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;

const log = LoggingUtils.logger('dockable');


/**
 * Container that can be docked on the side of a monitor.
 */
const Dockable = new Lang.Class({
	Name: 'EmDash.Dockable',

	_init: function(child, alignChild, side, align, stretch, toggle) {
		log('_init');

		this._alignChild = alignChild;
		this._align = align;
		this._side = side;
		this._stretch = stretch;
		this._toggle = toggle;
		this._monitorIndex = Main.layoutManager.primaryIndex;
		this._leftCornerWasVisible = Main.panel._leftCorner.actor.visible;
		this._rightCornerWasVisible = Main.panel._rightCorner.actor.visible;

		this._collapsed = toggle;
		this._collapsedSize = 5;
		this._pressureBarrier = null;
		this._barrier = null;
		this._workArea = {};

		this.actor = new St.Bin({
			name: 'em-dash-dockable',
			child: child,
			x_fill: true,
			y_fill: true,
			reactive: true // for tracking hover
		});

		// Hide to make sure a strut is not created when added to the chrome
		this.actor.hide();

		Main.layoutManager.addChrome(this.actor, {
			affectsStruts: !this._toggle,
			trackFullscreen: true
		});

		if (Main.legacyTray && Main.legacyTray.actor) {
			// Make sure we're behind the legacy tray (if it exists)
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor,
				Main.legacyTray.actor);
		}
		else {
			// At least make sure we're behind the modal dialog group
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor,
				Main.layoutManager.modalDialogGroup);
		}

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(global.screen, 'workareas-changed', this._onWorkAreasChanged);
		this._signalManager.connectProperty(this.actor, 'hover', this._onHover);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
		this._destroyPressureBarrier();
		// Note: *cannot* destroy a Bin without children
		this.actor.remove_all_children();
		Main.layoutManager.removeChrome(this.actor);
		if (this._leftCornerWasVisible) {
			Main.panel._leftCorner.actor.show();
		}
		if (this._rightCornerWasVisible) {
			Main.panel._rightCorner.actor.show();
		}
	},

	setSide: function(side) {
		if (this._side !== side) {
			this._side = side;
			this.actor.set_size(0, 0); // will change struts and trigger 'workareas-changed' signal
		}
	},

	setAlign: function(align) {
		if (this._align !== align) {
			this._align = align;
			this._refreshAlign();
		}
	},

	setStretch: function(stretch) {
		if (this._stretch !== stretch) {
			this._stretch = stretch;
			this._refreshAlign();
		}
	},

	setToggle: function(toggle) {
		if (this._toggle !== toggle) {
			this._collapsed = this._toggle = toggle;
			this._reinitialize(); // will also refresh tracking
		}
	},

	_reinitialize: function() {
		let x, y, width = -1, height = -1, translationX = 0, translationY = 0, barrier = {};
		let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
		let monitor = Main.layoutManager.monitors[this._monitorIndex];

		// Let's do our changes without affecting struts
		this._untrack();

		// So we can read the natural widths and heights
		this.actor.set_size(-1, -1);

		if ((this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT)) {
			y = workArea.y;
			height = workArea.height;
			barrier.y1 = y;
			barrier.y2 = y + workArea.height;

			if (this._side === Meta.Side.LEFT) {
				x = monitor.x;
				// deprecated: anchor = Clutter.Gravity.NORTH_WEST;
				barrier.x1 = barrier.x2 = x + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_X;
			}
			else { // RIGHT
				x = monitor.x + monitor.width;
				translationX = -this.actor.width;
				// deprecated: anchor = Clutter.Gravity.NORTH_EAST;
				barrier.x1 = barrier.x2 = x - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_X;
			}
		}
		else { // TOP || BOTTOM
			x = workArea.x;
			width = workArea.width;
			barrier.x1 = x;
			barrier.x2 = x + workArea.width;

			if (this._side === Meta.Side.TOP) {
				y = monitor.y;
				// deprecated: anchor = Clutter.Gravity.NORTH_WEST;
				barrier.y1 = barrier.y2 = y + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_Y;
			}
			else { // BOTTOM
				y = monitor.y + monitor.height;
				translationY = -this.actor.height;
				// deprecated: anchor = Clutter.Gravity.SOUTH_WEST;
				barrier.y1 = barrier.y2 = y - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_Y;
			}
		}

		let child = this.actor.child;
		if (this._collapsed) {
			child.hide();
			this._setPressureBarrier(barrier);
		}
		else {
			this._destroyPressureBarrier();
			child.show();
		}

		this._refreshAlign();
		this._refreshRoundedCorners();

		log(`_reinitialize: x=${x} y=${y} w=${width} h=${height}`);
		this.actor.set_position(x, y);
		this.actor.set_translation(translationX, translationY, 0);
		this.actor.set_size(width, height);

		// Note: gravity and anchors are deprecated, so we are using fixed translation instead.
		// this.actor.move_anchor_point_from_gravity(anchor);

		this._track();

		// If our bounds have changed, the chrome layout tracker will recreate our strut, which will
		// trigger a call to _onWorkAreasChanged, which in turn might call _reinitialize *again* for
		// the updated work area. I could not find a way to avoid this situation. However, this
		// extra call will result in us calculating the same exact bounds, so nothing will actually
		// change in the layout for this second call, and thus _onWorkAreasChanged won't be called a
		// third time. That's a few unnecessarily repeated calculations due to the second call, but
		// otherwise there is no other averse effect, and we avoid an endless loop.
	},

	_untrack: function() {
		Main.layoutManager._untrackActor(this.actor);
	},

	_track: function() {
		Main.layoutManager._trackActor(this.actor, {
			affectsStruts: !this._toggle,
			trackFullscreen: true
		});
	},

	_refreshAlign: function() {
		// WARNING: Reading x_align or y_align causes a crash! But we can write them just fine.

		let vertical = (this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT);

		if (this._stretch) {
			if (vertical) {
				// St
				this._alignChild.y_align = this._align;
				// Clutter
				this._alignChild.set_y_align(Clutter.ActorAlign.FILL);
			}
			else {
				// St
				this._alignChild.x_align = this._align;
				// Clutter
				this._alignChild.set_x_align(Clutter.ActorAlign.FILL);
			}
		}
		else {
			// Clutter (St has no visible effect here, so we can ignore it)
			let align;
			switch (this._align) {
			case St.Align.START:
				align = Clutter.ActorAlign.START;
				break;
			case St.Align.MIDDLE:
				align = Clutter.ActorAlign.CENTER;
				break;
			case St.Align.END:
				align = Clutter.ActorAlign.END;
				break;
			}
			if (vertical) {
				this._alignChild.set_y_align(align);
			}
			else {
				this._alignChild.set_x_align(align);
			}
		}
	},

	_setPressureBarrier: function(barrier) {
		log(`_setPressureBarrier: x1=${barrier.x1} y1=${barrier.y1} x2=${barrier.x2} y2=${barrier.y2}`);
		this._destroyPressureBarrier();
		barrier.display = global.display;
		this._barrier = new Meta.Barrier(barrier);
		this._pressureBarrier = new Layout.PressureBarrier(
			100, // pressure threshold (pixels)
			100, // pressure timeout (ms)
			Shell.ActionMode.NORMAL);
		this._pressureBarrier.addBarrier(this._barrier);
		this._signalManager.connect(this._pressureBarrier, 'trigger',
			this._onPressureBarrierTriggered, true);
	},

	_destroyPressureBarrier: function() {
		if (this._barrier !== null) {
			this._pressureBarrier.removeBarrier(this._barrier);
			this._barrier.destroy();
			this._barrier = null;
		}
		if (this._pressureBarrier !== null) {
			this._pressureBarrier.destroy();
			this._pressureBarrier = null;
		}
	},

	_refreshRoundedCorners: function() {
		if (this._side === Meta.Side.LEFT) {
			if (this._leftCornerWasVisible) {
				Main.panel._leftCorner.actor.hide();
			}
			if (this._rightCornerWasVisible) {
				Main.panel._rightCorner.actor.show();
			}
		}
		else if (this._side === Meta.Side.RIGHT) {
			if (this._leftCornerWasVisible) {
				Main.panel._leftCorner.actor.show();
			}
			if (this._rightCornerWasVisible) {
				Main.panel._rightCorner.actor.hide();
			}
		}
		else if (this._side === Meta.Side.TOP) {
			if (this._leftCornerWasVisible) {
				Main.panel._leftCorner.actor.hide();
			}
			if (this._rightCornerWasVisible) {
				Main.panel._rightCorner.actor.hide();
			}
		}
		else { // BOTTOM
			if (this._leftCornerWasVisible) {
				Main.panel._leftCorner.actor.show();
			}
			if (this._rightCornerWasVisible) {
				Main.panel._rightCorner.actor.show();
			}
		}
	},

	_hasWorkAreaChanged: function() {
		let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
		if ((workArea.x === this._workArea.x) &&
			(workArea.y === this._workArea.y) &&
			(workArea.width === this._workArea.width) &&
			(workArea.height === this._workArea.height)) {
			// No change
			log(`work area not changed: x=${workArea.x} y=${workArea.y} w=${workArea.width} h=${workArea.height}`);
			return false;
		}
		log(`work area changed: x=${workArea.x} y=${workArea.y} w=${workArea.width} h=${workArea.height}`);
		this._workArea.x = workArea.x;
		this._workArea.y = workArea.y;
		this._workArea.width = workArea.width;
		this._workArea.height = workArea.height;
		return true;
	},

	_onPressureBarrierTriggered: function(pressureBarrier) {
		log('pressure barrier "trigger" signal');
		this._collapsed = false;
		this._reinitialize();
		this.actor.track_hover = true;
	},

	_onHover: function(actor, hover) {
		// Emitted only if track_hover is true.
		// (We tried using the leave-event for this, but it proved problematic: it would be emitted
		// even if we move into children of our actor. But hover tracking works for us!)
		log(`"hover" property changed signal: ${hover}`);
		if (!hover) {
			this._collapsed = true;
			this._reinitialize();
			this.actor.track_hover = false;
		}
	},

	_onWorkAreasChanged: function(screen) {
		log('screen "workareas-changed" signal');
		if (this._hasWorkAreaChanged()) {
			this._reinitialize();
		}
	}
});
