
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
 * Dash implementation that can be docked to the sides of the screen.
 */
const Dock = new Lang.Class({
	Name: 'EmDash.Dock',
	Extends: Dash.Dash,

	_init: function(entryManager) {
		Utils.log('init dock');
		
		this._position = St.Side.LEFT;
		this._barrier = null;

		this.parent(entryManager,
			(this._position === St.Side.LEFT) || (this._position === St.Side.RIGHT));

		this._icons.actor.add_style_class_name('EmDash-Dock');

//		let constraint = new Clutter.BindConstraint({
//			source: this._icons.actor,
//			coordinate: (this._position === St.Side.LEFT) || (this._position === St.Side.RIGHT) ?
//				Clutter.BindCoordinate.WIDTH : Clutter.BindCoordinate.HEIGHT
//		});
//		this._icons.actor.add_constraint(constraint);

		//this._icons.actor = new Shell.GenericContainer();
		//this._icons.actor._delegate = this;
		//this._icons.actor.set_opacity(255);

		//this._dashSpacer = new OverviewControls.DashSpacer();
		//this._dashSpacer.setDashActor(this._box);
		//Main.uiGroup.add_child(this._dashSpacer);
		
		Main.uiGroup.add_child(this._icons.actor);
		
		// Z
		if (Main.legacyTray && Main.legacyTray.actor) {
			Main.layoutManager.uiGroup.set_child_below_sibling(this._icons.actor, Main.legacyTray.actor);
		}
		else {
			Main.layoutManager.uiGroup.set_child_below_sibling(this._icons.actor, Main.layoutManager.modalDialogGroup);
		}
		
		this._pressureBarrier = new Layout.PressureBarrier(
			100, // hot corner pressure threshold (pixels)
			1000, // hot corner pressure timeout (ms)
			Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);

		//Main.overview._controls._group.insert_child_at_index(this._icons.actor, 0);
    	
		this._signalManager.on(global.screen, 'workareas-changed', this._onWorkAreasChanged);
		this._signalManager.on(this._icons.actor, 'paint', this._onPainted);
		this._signalManager.on(this._pressureBarrier, 'trigger', this._onPressureBarrierTriggered);
		//this._signalManager.on(this._icons.actor, 'allocate', this._onAllocated);
		//this._signalManager.on(this._icons.actor, 'get-preferred-width', this._getPrefferedWidth);
		//this._signalManager.on(this._icons.actor, 'get-preferred-height', this._getPrefferedHeight);
    },

	destroy: function() {
		this.parent();
		this._icons.actor.destroy();
		this._destroyBarrier();
		this._pressureBarrier.destroy();
	},
	
	_destroyBarrier: function() {
		if (this._barrier !== null) {
			this._pressureBarrier.removeBarrier(this._barrier);
			this._barrier.destroy();
			this._barrier = null;
		}
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
				barrierX1 = barrierX2 = x + this._icons.actor.width + 1;
				direction = Meta.BarrierDirection.POSITIVE_X;
	
				// Rounded corners
				Main.panel._leftCorner.actor.hide();
				Main.panel._rightCorner.actor.show();
			}
			else { // RIGHT
				anchor = Clutter.Gravity.NORTH_EAST;
				x = workArea.x + workArea.width;
				x_align = St.Align.END;
				barrierX1 = barrierX2 = x - this._icons.actor.width;
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
				barrierY1 = barrierY2 = y + this._icons.actor.height + 1;
				direction = Meta.BarrierDirection.POSITIVE_Y;
				
				// Rounded corners
				Main.panel._leftCorner.actor.hide();
				Main.panel._rightCorner.actor.hide();
			}
			else { // BOTTOM
				anchor = Clutter.Gravity.SOUTH_WEST;
				y = workArea.y + workArea.height;
				y_align = St.Align.END;
				barrierY1 = barrierY2 = y - this._icons.actor.height;
				direction = Meta.BarrierDirection.NEGATIVE_Y;
				
				// Rounded corners
				Main.panel._leftCorner.actor.show();
				Main.panel._rightCorner.actor.show();
			}
		}
		
		// Reposition
		this._icons.actor.move_anchor_point_from_gravity(anchor);
		this._icons.actor.x = x;
		this._icons.actor.y = y;
		if (width !== -1) {
			this._icons.actor.width = width;
		}
		if (height !== -1) {
			this._icons.actor.height = height;
		}
		this._icons.actor.x_align = x_align;
		this._icons.actor.y_align = y_align;
		
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