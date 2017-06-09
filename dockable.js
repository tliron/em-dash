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
//const OverviewControls = imports.ui.overviewControls;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;


/**
 * Container that can be docked on the side of a monitor.
 */
const Dockable = new Lang.Class({
	Name: 'EmDash.Dockable',

	_init: function(actor, position) {
		this.actor = actor;
		
		this._position = position;
		this._barrier = null;

		Main.uiGroup.add_child(this.actor);

//		let constraint = new Clutter.BindConstraint({
//		source: this._icons.actor,
//		coordinate: (this._position === St.Side.LEFT) || (this._position === St.Side.RIGHT) ?
//			Clutter.BindCoordinate.WIDTH : Clutter.BindCoordinate.HEIGHT
//	});
//	this._icons.actor.add_constraint(constraint);

	//this._icons.actor = new Shell.GenericContainer();
	//this._icons.actor._delegate = this;
	//this._icons.actor.set_opacity(255);

	//this._dashSpacer = new OverviewControls.DashSpacer();
	//this._dashSpacer.setDashActor(this._box);
	//Main.uiGroup.add_child(this._dashSpacer);

		// Make sure it's in front of the legacy tray and in back of modal dialogs
		if (Main.legacyTray && Main.legacyTray.actor) {
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor, Main.legacyTray.actor);
		}
		else {
			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor, Main.layoutManager.modalDialogGroup);
		}
		
		// Barrier (move mouse against it to unhide)
		this._pressureBarrier = new Layout.PressureBarrier(
			100, // hot corner pressure threshold (pixels)
			1000, // hot corner pressure timeout (ms)
			Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);

		//Main.overview._controls._group.insert_child_at_index(this.actor, 0);
    	
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.on(global.screen, 'workareas-changed', this._onWorkAreasChanged);
		this._signalManager.on(this.actor, 'paint', this._onPainted);
		this._signalManager.on(this._pressureBarrier, 'trigger', this._onPressureBarrierTriggered);
		//this._signalManager.on(this.actor, 'allocate', this._onAllocated);
		//this._signalManager.on(this.actor, 'get-preferred-width', this._getPrefferedWidth);
		//this._signalManager.on(this.actor, 'get-preferred-height', this._getPrefferedHeight);
	},

	destroy: function() {
		this._signalManager.destroy();
		this._destroyBarrier();
		this._pressureBarrier.destroy();
	},
	
	refreshPosition: function() {
		let anchor, x, y, width, height, x_align, y_align;
		let barrierX1, barrierX2, barrierY1, barrierY2, barrierDirection;
		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		//let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

		if ((this._position === St.Side.LEFT) || (this._position === St.Side.RIGHT)) {
			y = workArea.y;
			width = -1;
			height = workArea.height;
			y_align = St.Align.START;
			barrierY1 = y;
			barrierY2 = y + height;

			if (this._position === St.Side.LEFT) { 
				anchor = Clutter.Gravity.NORTH_WEST;
				x = workArea.x;
				x_align = St.Align.START;
				barrierX1 = barrierX2 = x + this.actor.width + 1;
				direction = Meta.BarrierDirection.POSITIVE_X;
	
				// Rounded corners
				Main.panel._leftCorner.actor.hide();
				Main.panel._rightCorner.actor.show();
			}
			else { // RIGHT
				anchor = Clutter.Gravity.NORTH_EAST;
				x = workArea.x + workArea.width;
				x_align = St.Align.END;
				barrierX1 = barrierX2 = x - this.actor.width;
				direction = Meta.BarrierDirection.NEGATIVE_X;
	
				// Rounded corners
				Main.panel._leftCorner.actor.show();
				Main.panel._rightCorner.actor.hide();
			}
		}
		else { // TOP || BOTTOM
			x = workArea.x;
			width = workArea.width;
			height = -1;
			x_align = St.Align.START;
			barrierX1 = x;
			barrierX2 = x + width;

			if (this._position === St.Side.TOP) {
				anchor = Clutter.Gravity.NORTH_WEST;
				y = workArea.y;
				y_align = St.Align.START;
				barrierY1 = barrierY2 = y + this.actor.height + 1;
				direction = Meta.BarrierDirection.POSITIVE_Y;
				
				// Rounded corners
				Main.panel._leftCorner.actor.hide();
				Main.panel._rightCorner.actor.hide();
			}
			else { // BOTTOM
				anchor = Clutter.Gravity.SOUTH_WEST;
				y = workArea.y + workArea.height;
				y_align = St.Align.END;
				barrierY1 = barrierY2 = y - this.actor.height;
				direction = Meta.BarrierDirection.NEGATIVE_Y;
				
				// Rounded corners
				Main.panel._leftCorner.actor.show();
				Main.panel._rightCorner.actor.show();
			}
		}
		
		// Reposition
		this.actor.move_anchor_point_from_gravity(anchor);
		this.actor.x = x;
		this.actor.y = y;
		if (width !== -1) {
			this.actor.width = width;
		}
		if (height !== -1) {
			this.actor.height = height;
		}
		this.actor.x_align = x_align;
		this.actor.y_align = y_align;
		
		// Barrier
		this._destroyBarrier();
		this._barrier = new Meta.Barrier({
			display: global.display,
			x1: barrierX1,
			y1: barrierY1,
			x2: barrierX2,
			y2: barrierY2,
			directions: direction
		});
		this._pressureBarrier.addBarrier(this._barrier);

		Utils.log('[barrier] ' + barrierX1 + ' ' + barrierY1 + ' ' + barrierX2 + ' ' + barrierY2);
	},
	
	_destroyBarrier: function() {
		if (this._barrier !== null) {
			this._pressureBarrier.removeBarrier(this._barrier);
			this._barrier.destroy();
			this._barrier = null;
		}
	},
	
	_onPainted: function() {
		Utils.log('[painted]');
		this._signalManager.off(this._onPainted);
		this.refreshPosition();
	},
	
	_onPressureBarrierTriggered: function(barrier) {
		Utils.log('!!!!!!!!!!!!! [pressure-barrier-triggered] ' + barrier);
	},
	
	_onWorkAreasChanged: function(screen) {
		Utils.log('[work-areas-changed]')
		this.refreshPosition();
	},
	
	_onAllocated: function(actor, box, flags) {
	},
	
	_getPrefferedWidth: function(actor, forHeight, alloc) {
		Utils.log('>>>>>>>>>> width')
		alloc.min_size = 10;
		alloc.natural_size = 10;
	},
	
	_getPrefferedHeight: function(actor, forWidth, alloc) {
		alloc.min_size = 100;
		alloc.natural_size = 100;
	}
});

