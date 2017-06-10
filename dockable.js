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
const Tweener = imports.ui.tweener;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;

const log = Utils.logger('dockable');


/**
 * Container that can be docked on the side of a monitor.
 */
const Dockable = new Lang.Class({
	Name: 'EmDash.Dockable',

	_init: function(actor, side, toggle) {
		this.actor = new St.Bin({
			name: 'EmDash-Dockable',
			child: actor,
			reactive: true
		});
		//this.actor.set_clip_to_allocation(true);
		this.actor.add_style_class_name('EmDash-DockableDash');
		//this.actor.add_style_class_name(Main.sessionMode.panelStyle);

		this._side = side;
		this._toggle = toggle;
		this._animations = true;
		this._monitorIndex = Main.layoutManager.primaryIndex;

		this._collapsed = this._toggle;
		this._collapsedSize = 3;
		this._pressureBarrier = null;
		this._barrier = null;
		this._workArea = {};
		
		// Sizeless to make sure a strut is not created when added to the chrome
		this.actor.width = 0;
		this.actor.height = 0;

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
		
		this._signalManager = new Utils.SignalManager(this);
		this._signalManager.connect(global.screen, 'workareas-changed', this._onWorkAreasChanged);
		this._signalManager.connectProperty(this.actor, 'hover', this._onHover); // emitted only if track_hover is true

		this._later = Utils.later(this, () => {
			// Wait until later so that themes are fully applied
			Main.layoutManager.addChrome(this.actor, {
				affectsStruts: !this._toggle,
				trackFullscreen: true
			});

			// Only now that the actor is allocated can we get its size
			this._width = actor.width;
			this._height = actor.height;

			// This will be emitted automatically when GNOME Shell is started, but not if the
			// extension is enabled when GNOME Shell is up and running
			global.screen.emit('workareas-changed');
		});
	},

	destroy: function() {
		Meta.later_remove(this._later);
		this._signalManager.destroy();
		this._destroyPressureBarrier();
		this.actor.remove_all_children(); // will be destroyed elsewhere
		Main.layoutManager.removeChrome(this.actor);
		// this.actor.destroy(); cannot and does not need to be destroyed without children!
	},
	
	reinitialize: function() {
		log('reinitialize');

		let bounds = {}, barrier = {};
		let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
		let monitor = Main.layoutManager.monitors[this._monitorIndex];
		//let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

		if ((this._side === Meta.Side.LEFT) || (this._side === Meta.Side.RIGHT)) {
			bounds.y = workArea.y;
			bounds.width = this._collapsed ? this._collapsedSize : this._width;
			bounds.height = workArea.height;
			bounds.y_align = St.Align.START;
			barrier.y1 = bounds.y;
			barrier.y2 = bounds.y + bounds.height;

			if (this._side === Meta.Side.LEFT) { 
				bounds.anchor = Clutter.Gravity.NORTH_WEST;
				bounds.x = monitor.x;
				bounds.x_align = St.Align.START;
				barrier.x1 = barrier.x2 = bounds.x + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_X;
			}
			else { // RIGHT
				bounds.anchor = Clutter.Gravity.NORTH_EAST;
				bounds.x = monitor.x + monitor.width;
				bounds.x_align = St.Align.END;
				barrier.x1 = barrier.x2 = bounds.x - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_X;
			}
		}
		else { // TOP || BOTTOM
			bounds.x = workArea.x;
			bounds.width = workArea.width;
			bounds.height = this._collapsed ? this._collapsedSize : this._height;
			bounds.x_align = St.Align.START;
			barrier.x1 = bounds.x;
			barrier.x2 = bounds.x + bounds.width;

			if (this._side === Meta.Side.TOP) {
				bounds.anchor = Clutter.Gravity.NORTH_WEST;
				bounds.y = monitor.y;
				bounds.y_align = St.Align.START;
				barrier.y1 = barrier.y2 = bounds.y + this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.POSITIVE_Y;
			}
			else { // BOTTOM
				bounds.anchor = Clutter.Gravity.SOUTH_WEST;
				bounds.y = monitor.y + monitor.height;
				bounds.y_align = St.Align.END;
				barrier.y1 = barrier.y2 = bounds.y - this._collapsedSize;
				barrier.directions = Meta.BarrierDirection.NEGATIVE_Y;
			}
		}
		
		let actor = this.actor.get_first_child();
		if (this._collapsed) {
			actor.hide();
			this._setPressureBarrier(barrier);
		}
		else {
			actor.show();
			this._destroyPressureBarrier();
		}

		this._setBounds(bounds);
		this._setRoundedCorners();
		
		/*if (this._animations) {
			//this.actor.hide();
			Tweener.addTween(this.actor, {
				slidex: 1,
				time: 5000,
				delay: 5000,
				transition: 'easeOutQuad',
				onComplete: Lang.bind(this, () => {
					//this.actor.show();
				})
			});
		}*/
		
		// If our bounds have changed, the layout tracker will recreate our strut, which will
		// trigger a call to _onWorkAreasChanged, which in turn might call reinitialize again for
		// the updated work area. I could not find a way to avoid this situation. However, this
		// extra call will result in us calculating the same exact bounds, so nothing will actually
		// change in the layout for this second call, and thus _onWorkAreasChanged won't be called a
		// third time. That'a a few unnecessarily repeated calculations for the second call, but
		// otherwise there is no other effect!
	},
	
	_setRoundedCorners: function() {
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
	
	_setBounds: function(bounds) {
		log('set-bounds: ' + bounds.x + ' ' + bounds.y + ' ' + bounds.width + ' ' + bounds.height);
		this.actor.move_anchor_point_from_gravity(bounds.anchor);
		this.actor.x = bounds.x;
		this.actor.y = bounds.y;
		this.actor.width = bounds.width;
		this.actor.height = bounds.height;
		this.actor.x_align = bounds.x_align;
		this.actor.y_align = bounds.y_align;
	},
	
//	_createStrut: function() {
//		let strutRect = new Meta.Rectangle({
//			x: this.actor.x,
//			y: this.actor.y,
//			width: this.actor.width + 20,
//			height: this.actor.height
//		});
//		log('strut: ' + strutRect.x + ' ' + strutRect.y + ' ' + strutRect.width + ' ' + strutRect.height);
//		let strut = new Meta.Strut({
//			rect: strutRect,
//			side: this._side
//		});
//		let struts = [strut];
//		let screen = global.screen;
//		for (let w = 0; w < screen.n_workspaces; w++) {
//			let workspace = screen.get_workspace_by_index(w);
//			workspace.set_builtin_struts(struts);
//		}
//	},
	
	_setPressureBarrier: function(barrier) {
		log('pressure-barrier: ' + barrier.x1 + ' ' + barrier.y1 + ' ' + barrier.x2 + ' ' + barrier.y2);
		this._destroyPressureBarrier();
		barrier.display = global.display;
		this._barrier = new Meta.Barrier(barrier);
		this._pressureBarrier = new Layout.PressureBarrier(
			100, // pressure threshold (pixels)
			100, // pressure timeout (ms)
			Shell.ActionMode.NORMAL);
		this._pressureBarrier.addBarrier(this._barrier);
		this._signalManager.connect(this._pressureBarrier, 'trigger', this._onPressureBarrierTriggered, true);
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
	
	_hasWorkAreaChanged: function() {
		let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
		if ((workArea.x === this._workArea.x) &&
			(workArea.y === this._workArea.y) &&
			(workArea.width === this._workArea.width) &&
			(workArea.height === this._workArea.height)) {
			// No change
			log('work area not changed: ' + workArea.x + ' ' + workArea.y + ' ' + workArea.width + ' ' + workArea.height);
			return false;
		}
		log('work area changed: ' + workArea.x + ' ' + workArea.y + ' ' + workArea.width + ' ' + workArea.height);
		this._workArea.x = workArea.x;
		this._workArea.y = workArea.y;
		this._workArea.width = workArea.width;
		this._workArea.height = workArea.height;
		return true;
	},
	
	_onPressureBarrierTriggered: function(pressureBarrier) {
		log('pressure-barrier-triggered');
		this._collapsed = false;
		this.reinitialize();
		this.actor.track_hover = true;
	},
	
	_onHover: function(actor, hover) {
		// We considered using the leave-event for this, but it proved problematic: it would be
		// emitted even if we move to children of our actor. :( But hover tracking works as
		// expected!
		log('hover: ' + hover);
		if (!hover) {
			this._collapsed = true;
			this.reinitialize();
			this.actor.track_hover = false;
		}
	},
	
	_onWorkAreasChanged: function(screen) {
		if (this._hasWorkAreaChanged()) {
			this.reinitialize();
		}
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
