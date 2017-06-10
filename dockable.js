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
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;


function log(message) {
	Utils.log('{Dockable} ' + message);
}


/**
 * Container that can be docked on the side of a monitor.
 */
const Dockable = new Lang.Class({
	Name: 'EmDash.Dockable',

	_init: function(actor, side) {
		this.actor = actor;
		this._side = side;
		this._barrier = null;
		this._width = this.actor.width
		this._height = this.actor.height;
		
		// Sizeless to make sure a strut is not created when added to the chrome
		this.actor.width = 0;
		this.actor.height = 0;
		
		Main.layoutManager.addChrome(this.actor, {
			affectsStruts: true,
			trackFullscreen: true
		});

//		this._dashSpacer = new OverviewControls.DashSpacer();
//		this._dashSpacer.setDashActor(this.actor);
//		Main.uiGroup.add_child(this._dashSpacer);

//		let constraint = new Clutter.BindConstraint({
//		source: this._icons.actor,
//		coordinate: (this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT) ?
//			Clutter.BindCoordinate.WIDTH : Clutter.BindCoordinate.HEIGHT
//		});
//		this._icons.actor.add_constraint(constraint);

//		if (Main.legacyTray && Main.legacyTray.actor) {
//			// Make sure we're in front of the legacy tray (if it exists)
//			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor, Main.legacyTray.actor);
//		}
//		else {
//			// At least make sure we're behind the modal dialog group
//			Main.layoutManager.uiGroup.set_child_below_sibling(this.actor, Main.layoutManager.modalDialogGroup);
//		}
		
		// Pressure barrier (move mouse against it to show the dockable when it's hidden)
		this._pressureBarrier = new Layout.PressureBarrier(
			100, // pressure threshold (pixels)
			1000, // pressure timeout (ms)
			Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);
    	
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.connect(this._pressureBarrier, 'trigger', this._onPressureBarrierTriggered);
		this._signalManager.connect(global.screen, 'workareas-changed', this._onWorkAreasChanged, true);
		
		// We need to wait until the work area is complete
		//Utils.later(this, this.reinitialize);
	},

	destroy: function() {
		this._signalManager.destroy();
		this._destroyBarrier();
		this._pressureBarrier.destroy();
	},
	
	reinitialize: function() {
		log('reinitialize');

		let anchor, x, y, width, height, x_align, y_align;
		let barrierX1, barrierX2, barrierY1, barrierY2, barrierDirection;
		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		let monitor = Main.layoutManager.monitors[Main.layoutManager.primaryIndex];
		//let workArea = Main.layoutManager.monitors[Main.layoutManager.primaryIndex];
		//let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

		if ((this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT)) {
			y = workArea.y;
			width = this._width;
			height = workArea.height;
			y_align = St.Align.START;
			barrierY1 = y;
			barrierY2 = y + height;

			if (this._side === Meta.Side.LEFT) { 
				anchor = Clutter.Gravity.NORTH_WEST;
				x = workArea.x;
				x_align = St.Align.START;
				barrierX1 = barrierX2 = x + this._width + 1;
				barrierDirection = Meta.BarrierDirection.POSITIVE_X;
			}
			else { // RIGHT
				anchor = Clutter.Gravity.NORTH_EAST;
				x = workArea.x + workArea.width;
				x_align = St.Align.END;
				barrierX1 = barrierX2 = x - this._width;
				barrierDirection = Meta.BarrierDirection.NEGATIVE_X;
			}
		}
		else { // TOP || BOTTOM
			x = workArea.x;
			width = workArea.width;
			height = this._height;
			x_align = St.Align.START;
			barrierX1 = x;
			barrierX2 = x + width;

			if (this._side === Meta.Side.TOP) {
				anchor = Clutter.Gravity.NORTH_WEST;
				y = workArea.y;
				y_align = St.Align.START;
				barrierY1 = barrierY2 = y + this._height + 1;
				barrierDirection = Meta.BarrierDirection.POSITIVE_Y;
			}
			else { // BOTTOM
				anchor = Clutter.Gravity.SOUTH_WEST;
				y = workArea.y + workArea.height;
				y_align = St.Align.END;
				barrierY1 = barrierY2 = y - this._height;
				barrierDirection = Meta.BarrierDirection.NEGATIVE_Y;
			}
		}

		//this._untrack();
		this._setBounds(anchor, x, y, width, height, x_align, y_align);
		//this._createBarrier(barrierX1, barrierY1, barrierX2, barrierY2, barrierDirection);
		this._updateRoundedCorners();
		//this._track();

		//this._signalManager.disconnect(this._onWorkAreasChanged);
//		this._signalManager.connect(global.screen, 'workareas-changed', () => {
//			log('hi!');
//			//this._signalManager.connect(global.screen, 'workareas-changed', this._onWorkAreasChanged);
//		});

		//let c = this._signalManager.disconnect(this._onWorkAreasChanged);
		
		//this._signalManager.connect()
	},
	
	_untrack: function() {
		Main.layoutManager.untrackChrome(this.actor);
	},
	
	_track: function() {
		Main.layoutManager._trackActor(this.actor, {
			affectsStruts: true,
			trackFullscreen: true
		});
	},
	
	_updateRoundedCorners: function() {
		if (this._side === Meta.Side.LEFT) {
			Main.panel._leftCorner.actor.hide();
			Main.panel._rightCorner.actor.show();
		}
		else if (this._side === Meta.Side.RIGHT) {
			Main.panel._leftCorner.actor.show();
			Main.panel._rightCorner.actor.hide();
		}
		else if (this._side === Meta.Side.TOP) {
			Main.panel._leftCorner.actor.hide();
			Main.panel._rightCorner.actor.hide();
		}
		else { // BOTTOM
			Main.panel._leftCorner.actor.show();
			Main.panel._rightCorner.actor.show();
		}
	},
	
	_setBounds: function(anchor, x, y, width, height, x_align, y_align) {
		log('set-bounds: ' + x + ' ' + y + ' ' + width + ' ' + height);

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
	},
	
	_createStrut: function() {
		let strutRect = new Meta.Rectangle({
			x: this.actor.x,
			y: this.actor.y,
			width: this.actor.width + 20,
			height: this.actor.height
		});
		log('strut: ' + strutRect.x + ' ' + strutRect.y + ' ' + strutRect.width + ' ' + strutRect.height);
		let strut = new Meta.Strut({
			rect: strutRect,
			side: this._side
		});
		let struts = [strut];
		let screen = global.screen;
		for (let w = 0; w < screen.n_workspaces; w++) {
			let workspace = screen.get_workspace_by_index(w);
			workspace.set_builtin_struts(struts);
		}
	},
	
	_createBarrier: function(x1, y1, x2, y2, direction) {
		log('barrier: ' + x1 + ' ' + y1 + ' ' + x2 + ' ' + y2);
		this._destroyBarrier();
		this._barrier = new Meta.Barrier({
			display: global.display,
			x1: x1,
			y1: y1,
			x2: x2,
			y2: y2,
			directions: direction
		});
		this._pressureBarrier.addBarrier(this._barrier);
	},
	
	_destroyBarrier: function() {
		if (this._barrier !== null) {
			this._pressureBarrier.removeBarrier(this._barrier);
			this._barrier.destroy();
			this._barrier = null;
		}
	},
	
	_onPressureBarrierTriggered: function(barrier) {
		log('pressure-barrier-triggered ' + barrier);
	},
	
	_onWorkAreasChanged: function(screen) {
		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		log('work-areas-changed: ' + workArea.x + ' ' + workArea.y + ' ' + workArea.width + ' ' + workArea.height);
		this.reinitialize();
		
//		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
//		
//		if ((workArea.x === this._workAreaX) &&
//			(workArea.y === this._workAreaY) &&
//			(workArea.width === this._workAreaWidth) &&
//			(workArea.height === this._workAreaHeight)) {
//			// No change
//			log('no change');
//			return;
//		}
//		
//		this._workAreaX = workArea.x;
//		this._workAreaY = workArea.y;
//		this._workAreaWidth = workArea.width;
//		this._workAreaHeight = workArea.height;

		//this._remove();
		//Utils.later(this, this.reinitialize, Meta.LaterType.IDLE);
		//Main.layoutManager.untrackChrome(this.actor);
		//if (!this._done) {
//			this.reinitialize();
		//	this._done = true;
		//}
	}
});




const Container = new Lang.Class({
	Name: 'EmDash.Container',
	
	_init: function(actor) {
		this.actor = new Shell.GenericContainer();
		this.actor._delegate = this;
		this.actor.add_actor(actor);
		this._width = -1;
		this._height = -1;
		
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.connect(this.actor, 'allocate', this._onAllocated);
		//this._signalManager.connect(this.actor, 'get-preferred-width', this._getPrefferedWidth);
		//this._signalManager.connect(this.actor, 'get-preferred-height', this._getPrefferedHeight);
	},
	
	destroy: function() {
		this._signalManager.destroy();
	},
	
	move: function(anchor, x, y, width, height, x_align, y_align) {
		this.actor.move_anchor_point_from_gravity(anchor);
		this.actor.x = x;
		this.actor.y = y;
		this._width = width;
		this._height = height;
		this.actor.x_align = x_align;
		this.actor.y_align = y_align;
	},
	
	_onAllocated: function(actor, box, flags) {
		log('>>>> box ' + box.x1 + ' ' + box.y1 + ' ' + box.x2 + ' ' + box.y2);
		
		let child = actor.get_first_child();
		let allocWidth = box.x2 - box.x1;
		let allocHeight = box.y2 - box.y1;
		let [minChildWidth, minChildHeight, natChildWidth, natChildHeight] = 
			child.get_preferred_size();
        
		let childBox = new Clutter.ActorBox();
		childBox.x1 = 0;
		childBox.x2 = natChildWidth;
		childBox.y1 = child.y;
		childBox.y2 = allocHeight;
		child.allocate(box, flags);
		//child.set_clip(-childBox.x1, -childBox.y1,
		//	-childBox.x1 + allocWidth, -childBox.y1 + allocHeight);
	},
	
	_getPrefferedWidth: function(actor, forHeight, alloc) {
		log('>>>>>>>>>> width');
		alloc.min_size = -1;
		alloc.natural_size = this._width;
	},
	
	_getPrefferedHeight: function(actor, forWidth, alloc) {
		log('>>>>>>>>>> height');
		alloc.min_size = -1;
		alloc.natural_size = this._height;
	}
});
