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
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const OverviewControls = imports.ui.overviewControls;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;
const MutterUtils = Me.imports.utils.mutter;
const Dash = Me.imports.dash;

const log = Logging.logger('dockable');


/**
 * Container that can be docked on the side of a monitor.
 */
const Dockable = new Lang.Class({
	Name: 'EmDash.Dockable',

	_init: function(child, side, align, stretch, toggle) {
		log('Dockable._init');
		
		this.actor = new St.Bin({
			name: 'em-dash-dockable',
			child: child,
			x_fill: true,
			y_fill: true,
			reactive: true // for tracking hover
		});

		this._align = align;

		//this.actor.set_clip_to_allocation(true);

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
		
		// Sizeless at first to make sure a strut is not created when added to the chrome
		this.actor.width = 0;
		this.actor.height = 0;

		this._signalManager = new Signals.SignalManager(this);
		this._laterManager = new MutterUtils.LaterManager(this);

		// Initialize later, to make sure the theme is fully applied
		this._laterManager.later(this.initialize);
	},

	destroy: function() {
		log('Dockable.destroy');
		this._laterManager.destroy();
		this._signalManager.destroy();
		this._destroyPressureBarrier();
		// Note: *cannot* destroy a Bin without children
		this.actor.remove_all_children();
		if (this._initialized()) {
			Main.layoutManager.removeChrome(this.actor);
		}
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
			this._reinitialize();
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
			if (this._initialized()) {
				Main.layoutManager._untrackActor(this.actor);
				Main.layoutManager._trackActor(this.actor, {
					affectsStruts: !this._toggle,
					trackFullscreen: true
				});
			}
		}
	},
	
	initialize: function() {
		this._addToChrome();
		this._signalManager.connect(global.screen, 'workareas-changed', this._onWorkAreasChanged);
		this._signalManager.connectProperty(this.actor, 'hover', this._onHover); // emitted only if track_hover is true
	},
	
	_initialized: function() {
		return this.actor.get_parent() !== null;
	},
	
	_getChild: function() {
		return this.actor.get_first_child();
	},
	
	_addToChrome: function() {
		Main.layoutManager.addChrome(this.actor, {
			affectsStruts: !this._toggle,
			trackFullscreen: true
		});

		if (Main.legacyTray && Main.legacyTray.actor) {
			// Make sure we're in front of the legacy tray (if it exists)
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor,
				Main.legacyTray.actor);
		}
		else {
			// At least make sure we're behind the modal dialog group
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor,
				Main.layoutManager.modalDialogGroup);
		}

		this._reinitialize();
	},
	
	_reinitialize: function() {
		if (!this._initialized()) {
			return;
		}

		log('_reinitialize');

		let bounds = {}, barrier = {};
		let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
		let monitor = Main.layoutManager.monitors[this._monitorIndex];

		if ((this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT)) {
			bounds = {
				y: workArea.y,
				width: -1,
				height: workArea.height,
			};
			barrier = {
				y1: bounds.y,
				y2: bounds.y + workArea.height
			};

			if (this._side === Meta.Side.LEFT) { 
				bounds.anchor = Clutter.Gravity.NORTH_WEST;
				bounds.x = monitor.x;
				barrier.x1 = barrier.x2 = bounds.x + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_X;
			}
			else { // RIGHT
				bounds.anchor = Clutter.Gravity.NORTH_EAST;
				bounds.x = monitor.x + monitor.width;
				barrier.x1 = barrier.x2 = bounds.x - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_X;
			}
		}
		else { // TOP || BOTTOM
			bounds = {
				x: workArea.x,
				width: workArea.width,
				height: -1,
			};
			barrier = {
				x1: bounds.x,
				x2: bounds.x + workArea.width
			};

			if (this._side === Meta.Side.TOP) {
				bounds.anchor = Clutter.Gravity.NORTH_WEST;
				bounds.y = monitor.y;
				barrier.y1 = barrier.y2 = bounds.y + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_Y;
			}
			else { // BOTTOM
				bounds.anchor = Clutter.Gravity.SOUTH_WEST;
				bounds.y = monitor.y + monitor.height;
				barrier.y1 = barrier.y2 = bounds.y - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_Y;
			}
		}
		
		let child = this._getChild();
		if (this._collapsed) {
			child.hide();
			this._setPressureBarrier(barrier);
		}
		else {
			child.show();
			this._destroyPressureBarrier();
		}

		this._refreshAlign();
		this._setBounds(bounds);
		this._setRoundedCorners();
		
		// If our bounds have changed, the chrome layout tracker will recreate our strut, which will
		// trigger a call to _onWorkAreasChanged, which in turn might call _reinitialize *again* for
		// the updated work area. I could not find a way to avoid this situation. However, this
		// extra call will result in us calculating the same exact bounds, so nothing will actually
		// change in the layout for this second call, and thus _onWorkAreasChanged won't be called a
		// third time. That's a few unnecessarily repeated calculations due to the second call, but
		// otherwise there is no other averse effect, and we avoid an endless loop.
	},
	
	_setBounds: function(bounds) {
		log('_setBounds: ' + bounds.x + ' ' + bounds.y + ' ' + bounds.width + ' ' + bounds.height);
		let child = this._getChild();
		if (bounds.width === -1) {
			bounds.width = this.actor.get_preferred_width(bounds.height);
		}
		if (bounds.height === -1) {
			bounds.height = this.actor.get_preferred_height(bounds.width);
		}
		this.actor.move_anchor_point_from_gravity(bounds.anchor);
		this.actor.set_position(bounds.x, bounds.y);
		this.actor.set_size(bounds.width, bounds.height);
	},

	_refreshAlign: function() {
		let child = this._getChild();
		
		// WARNING: Reading x_align or y_align causes a crash! But we can write them just fine. 

		let vertical = (this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT);

		if (this._stretch) {
			if (vertical) {
				// St
				child.y_align = this._align;
				// Clutter
				child.set_y_align(Clutter.ActorAlign.FILL);
			}
			else {
				// St
				child.x_align = this._align;
				// Clutter
				child.set_x_align(Clutter.ActorAlign.FILL);
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
				child.set_y_align(align);
			}
			else {
				child.set_x_align(align);
			}
		}
	},
	
	_setPressureBarrier: function(barrier) {
		log('_setPressureBarrier: ' + barrier.x1 + ' ' + barrier.y1 + ' ' +
			barrier.x2 + ' ' + barrier.y2);
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

	_setRoundedCorners: function() {
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
			log('work area not changed: ' + workArea.x + ' ' + workArea.y + ' ' +
				workArea.width + ' ' + workArea.height);
			return false;
		}
		log('work area changed: ' + workArea.x + ' ' + workArea.y + ' ' +
			workArea.width + ' ' + workArea.height);
		this._workArea.x = workArea.x;
		this._workArea.y = workArea.y;
		this._workArea.width = workArea.width;
		this._workArea.height = workArea.height;
		return true;
	},
	
	_onPressureBarrierTriggered: function(pressureBarrier) {
		log('pressure barrier trigger');
		this._collapsed = false;
		this._reinitialize();
		this.actor.track_hover = true;
	},
	
	_onHover: function(actor, hover) {
		// We tried using the leave-event for this, but it proved problematic: it would be emitted
		// even if we move into children of our actor. But hover tracking works for us!
		log('hover: ' + hover);
		if (!hover) {
			this._collapsed = true;
			this._reinitialize();
			this.actor.track_hover = false;
		}
	},
	
	_onWorkAreasChanged: function(screen) {
		if (this._hasWorkAreaChanged()) {
			this._reinitialize();
		}
	}
});
