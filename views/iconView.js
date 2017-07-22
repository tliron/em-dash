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
const AppDisplay = imports.ui.appDisplay;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const DraggableUtils = Me.imports.utils.draggable;
const AppUtils = Me.imports.utils.app;
const IconUtils = Me.imports.utils.icon;
const BacklightUtils = Me.imports.utils.backlight;
const IconMenu = Me.imports.views.iconMenu;
const DropPlaceholder = Me.imports.views.dropPlaceholder;

const log = LoggingUtils.logger('iconView');

const ANIMATION_TIME = 0.1;


/**
 * UI representation of a dash icon.
 *
 * For the sake of as much compatibility as possible with other parts of GNOME Shell, we are
 * inheriting from AppIcon:
 *
 *   https://github.com/GNOME/gnome-shell/blob/master/js/ui/appDisplay.js
 */
var IconView = new Lang.Class({
	Name: 'EmDash.IconView',
	Extends: AppDisplay.AppIcon,

	_init(dashView, model, modelIndex, physicalActorHeight, logicalIconSize) {
		log(`_init: ${modelIndex} ${model.app.id}`);
		this.dashView = dashView;
		this.model = model;
		this.modelIndex = modelIndex;
		this.dissolving = false;

		this._appearing = false;
		this._logicalIconSize = logicalIconSize;
		this._originalX = null;
		this._originalY = null;
		this._originalWidth = null;
		this._originalHeight = null;
		this._originalStyleClass = null;
		this._originalStyle = null;

		this.parent(model.app, {
			showLabel: false,
			isDraggable: false // we will handle draggable ourselves
		});

		this.actor.height = physicalActorHeight;

		// Enhanced dot
		this._simpleDot = this._dot;
		this._enhancedDot = new St.DrawingArea({
			style_class: 'app-well-app-running-dot',
			style: 'background-color: transparent;', // override style class background
			x_expand: true,
			y_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.END,
			visible: false
		});
		this._enhancedDot.connect('repaint', Lang.bind(this, this._onEnhancedDotRepainted));
		this._iconContainer.add_child(this._enhancedDot);

		// Select dot
		if (dashView.modelManager.settings.get_boolean('icons-indicate-number-of-windows')) {
			this._simpleDot.hide();
			this._dot = this._enhancedDot;
			this._updateRunningStyle(); // this was done in parent's _init, but we need to redo
		}
		else {
			this._enhancedDot.hide();
		}

		// Simple name
		this._simpleName = null;
		const id = model.app.id;
		if (id.endsWith('.desktop')) {
			this._simpleName = id.substring(0, id.length - '.desktop'.length);
		}

		// Draggable
		this._draggable = null;
		if (global.settings.is_writable('favorite-apps') && AppUtils.isFavoriteApp(model.app)) {
			this._draggable = new DraggableUtils.Draggable(this.actor);
		}

		// Signals
		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connectProperty(this.actor, 'hover', this._onHoverPropertyChanged);
	},

	/**
	 * Override.
	 */
	_onDestroy() {
		log(`_onDestroy: ${this.app.id}`);
		this._signalManager.destroy();
		if (this._draggable !== null) {
			this._draggable.destroy();
		}
		this.parent();
	},

	// Animations

	dissolve() {
		this.dissolving = true;
		this._dissolve(true);
	},

	appear() {
		if (this._appearing) {
			return;
		}
		this._appearing = true;
		const originalWidth = this.actor.width;
		const originalHeight = this.actor.height;
		this.actor.set_size(0, 0);
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			width: originalWidth,
			height: originalHeight,
			onComplete: () => {
				this._appearing = false;
			}
		});
	},

	_dissolve(destroy = false) {
		log(`_dissolve: ${this.app.id}`);
		const position = this.icon.icon.get_transformed_position();
		this._originalX = position[0];
		this._originalY = position[1];
		this._originalWidth = this.actor.width;
		this._originalHeight = this.actor.height;
		this._originalStyleClass = this.actor.style_class;
		this._originalStyle = this.actor.style;

		// Become an empty space
		this.actor.child.hide();
		this._dot.hide();
		this.actor.style_class = null;
		this.actor.style = null;

		// Shrink
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			width: 0,
			height: 0,
			onComplete: () => {
				if (destroy) {
					this.actor.destroy();
				}
				else {
					this.actor.hide();
				}
			}
		});
	},

	_appear(immediate = false) {
		if (this._appearing) {
			return;
		}
		this._appearing = true;
		log(`_appear: ${this.app.id} ${immediate?'immediate':'animated'}`);
		this.actor.show();
		Tweener.addTween(this.actor, {
			time: immediate ? 0 : ANIMATION_TIME,
			transition: 'easeOutQuad',
			width: this._originalWidth,
			height: this._originalHeight,
			onComplete: () => {
				this._appearing = false;
				this._dot.show();
				this.actor.style_class = this._originalStyleClass;
				this.actor.style = this._originalStyle;
			}
		});
	},

	// Icon

	/**
	 * Override to use fixed icon size.
	 */
	_createIcon(iconSize) {
		if (this._logicalIconSize !== null) {
			iconSize = this._logicalIconSize;
		}
		// Usually creates St.Icon, but for some system windows it could be Clutter.Texture
		return this.parent(iconSize);
	},

	// Focus

	focus() {
		log(`focus: ${this.app.id}`);
		const icon = this.icon.icon;
		if (icon !== null) {
			const backlight = BacklightUtils.getBacklight(this.app.id, () => {
				if (icon instanceof St.Icon) {
					return IconUtils.getStIconPixbuf(icon);
				}
				log('focus: not an St.Icon');
				return null;
			});
			log(`backlight: ${this.app.id} l=${backlight.light} n=${backlight.normal} d=${backlight.dark}`);

			const settings = this.dashView.modelManager.settings;
			if (settings.get_boolean('icons-highlight-focused-gradient')) {
				this.actor.style = `
background-gradient-direction: vertical;
background-gradient-start: ${backlight.normal};
background-gradient-end: ${backlight.dark};`;
			}
			else {
				this.actor.style = `background-color: ${backlight.dark};`;
			}
			// Assumes dot on bottom (TODO: we can check _dot.y_align for Clutter.ActorAlign.END)
			this._simpleDot.style = `background-color: ${backlight.normal};`;
		}
		this.actor.add_style_class_name('focused');
		this._updateRunningStyle();
	},

	unfocus() {
		log(`unfocus: ${this.app.id}`);
		this.actor.remove_style_class_name('focused');
		this.actor.style = null;
		this._simpleDot.style = null;
		this._updateRunningStyle();
	},

	// Running dot

	setRunningDot(enhanced) {
		if (enhanced) {
			this._simpleDot.hide();
			this._dot = this._enhancedDot;
		}
		else {
			this._enhancedDot.hide();
			this._dot = this._simpleDot;
		}
		this._updateRunningStyle();
	},

	_onEnhancedDotRepainted(drawingArea) {
		const dotSpacing = 2;
		let dotMinWidth = 2;

		let number = this.model.windows.length;
		if (number === 0) {
			return;
		}

		const themeNode = this._simpleDot.get_theme_node();
		const color = themeNode.get_background_color();
		const [width, height] = drawingArea.get_surface_size();

		if (dotMinWidth > width) {
			dotMinWidth = width;
		}
		let dotWidth = (width - (number - 1) * dotSpacing) / number;
		if (dotWidth < dotMinWidth) {
			// Max number of dots that would fit
			number = Math.max(Math.floor((width + dotSpacing) / (dotMinWidth + dotSpacing)), 1);
			dotWidth = (width - (number - 1) * dotSpacing) / number;
		}
		const dotDistance = dotWidth + dotSpacing;

		const cr = drawingArea.get_context();
		try {
			cr.save();
			Clutter.cairo_set_source_color(cr, color);
			for (let i = 0; i < number; i++) {
				cr.newSubPath();
				cr.rectangle(i * dotDistance, 0, dotWidth, height);
			}
			cr.fill();
		}
		finally {
			cr.restore();
			cr.$dispose();
		}
	},

	/**
	 * Override to check for grabbed windows, too.
	 */
	_updateRunningStyle() {
		const windows = this.model.windows;
		if (windows.length > 0) {
			this._dot.show();
			if ('queue_repaint' in this._dot) {
				log(`_updateRunningStyle: ${this.app.id} show enhanced`);
				this._dot.queue_repaint();
			}
			else {
				log(`_updateRunningStyle: ${this.app.id} show simple`);
			}
		}
		else {
			log(`_updateRunningStyle: ${this.app.id} hide`);
			this._dot.hide();
		}
	},

	// Menu

	/**
	 * Override and copy original code, just use our menu class instead.
	 */
	popupMenu() {
		this._removeMenuTimeout();
		this.actor.fake_release();

		if (this._draggable) {
			this._draggable.fakeRelease(); // Em-Dash note: our draggable has this method, too
		}

		if (!this._menu) {
			this._menu = new IconMenu.IconMenu(this, this._simpleName,
				this.dashView.modelManager.settings);
			this._menu.connect('activate-window', (menu, window) => {
				this.activateWindow(window);
			});
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this._onMenuPoppedDown();
				}
			});
			const id = Main.overview.connect('hiding', () => {
				this._menu.close();
			});
			this.actor.connect('destroy', () => {
				Main.overview.disconnect(id);
			});

			this._menuManager.addMenu(this._menu);
		}

		this.emit('menu-state-changed', true);

		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		this.emit('sync-tooltip');

		return false;
	},

	// Mouse actions

	/**
	 * Override to support our custom left-click actions.
	 */
	activate(button) {
		const settings = this.dashView.modelManager.settings;
		let iconsLeftClick = settings.get_string('icons-left-click');

		// CTRL forces launch
		const event = Clutter.get_current_event();
		if (event !== null) {
			if ((event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0) {
				iconsLeftClick = 'LAUNCH';
			}
		}

		if (iconsLeftClick !== 'NOTHING') {
			this._clickAction(iconsLeftClick);
		}
	},

	/**
	 * Override to support our custom middle-click actions.
	 */
	_onButtonPress(actor, event) {
		log('"button-press-event" signal');
		if (this.dashView.grabSourceIconView !== null) {
			// We are in grab selection mode
			this.dashView.endGrab(this);
			return Clutter.EVENT_STOP;
		}

		const button = event.get_button();
		switch (button) {
		case 1:
			this._setPopupTimeout();
			break;
		case 2:
			const settings = this.dashView.modelManager.settings;
			const iconsMiddleClick = settings.get_string('icons-middle-click');
			if (iconsMiddleClick !== 'NOTHING') {
				this._clickAction(iconsMiddleClick);
			}
			return Clutter.EVENT_STOP;
		case 3:
			this.popupMenu();
			return Clutter.EVENT_STOP;
		}
		return Clutter.EVENT_PROPAGATE;
	},

	enableWheelScrolling() {
		if (this._signalManager.get(this._onScrollEvent) === null) {
			this._signalManager.connect(this.actor, 'scroll-event', this._onScrollEvent);
		}
	},

	disableWheelScrolling() {
		this._signalManager.disconnect(this._onScrollEvent);
	},

	_onScrollEvent(actor, scrollEvent) {
		switch (scrollEvent.get_scroll_direction()) {
		case Clutter.ScrollDirection.UP:
			log(`actor "scroll-event" signal: ${this.app.id} up`);
			this.model.cycleFocus(false);
			break;
		case Clutter.ScrollDirection.DOWN:
			log(`actor "scroll-event" signal: ${this.app.id} down`);
			this.model.cycleFocus(true);
			break;
		default:
			log(`actor "scroll-event" signal: ${this.app.id}`);
			return false;
		}
		return true;
	},

	_onHoverPropertyChanged(actor, hover) {
		log(`"hover" property changed signal: ${this.app.id} ${hover}`);
		this.dashView.updateTooltip(hover, this);
	},

	_clickAction(action) {
		Main.overview.hide();
		switch (action) {
		case 'LAUNCH':
			this.launch();
			break;
		case 'LAUNCH_OR_SHOW':
			this.launchOrShow();
			break;
		case 'LAUNCH_OR_TOGGLE':
			this.launchOrToggle();
			break;
		case 'LAUNCH_OR_CYCLE':
			this.launchOrCycle();
			break;
		}
	},

	launch() {
		log(`launch: ${this.app.id}`);
		this._openNewWindow(true);
	},

	launchOrShow() {
		log(`launchOrShow: ${this.app.id}`);
		if (!this._openNewWindow()) {
			this.model.focus();
		}
	},

	launchOrToggle() {
		log(`launchOrToggle: ${this.app.id}`);
		if (!this._openNewWindow()) {
			if (!this.model.hideIfHasFocus()) {
				this.model.focus();
			}
		}
	},

	launchOrCycle() {
		log(`launchOrCycle: ${this.app.id}`);
		if (!this._openNewWindow()) {
			this.model.cycleFocus(true, true);
		}
	},

	_openNewWindow(force = false) {
		if (force ||
			(this.model.windows.length === 0)) {
			this.animateLaunch();
			if (this.app.can_open_new_window()) {
				this.app.open_new_window(-1);
			}
			else {
				// Some apps don't allow more than one instance to be running, so for them this may
				// cause nothing to happen; we'll try anyway
				this.app.launch(0, -1, false);

				// TODO: If we failed, but have windows on another workspace, could we switch to
				// that workspace? Probably not, because it's not easy to find out if we failed.
			}
			return true;
		}
		return false;
	},

	// Dragging us

	/**
	 * Hooked from EmDash.Draggable using our actor._delegate.
	 */
	handleDragBegin() {
		log(`handleDragBegin hook: ${this.app.id}`);
		this._removeMenuTimeout();
		this._dissolve();
	},

	/*
	 * Override to make sure the drag actor is the same size as our icon.
	 *
	 * Hooked from DND using our actor._delegate.
	 */
	getDragActor() {
		const size = this.icon.icon.icon_size;
		log(`getDragActor hook: ${this.app.id} ${size}`);
		return this.app.create_icon_texture(size);
	},

	/**
	 * Hooked from EmDash.Draggable using our actor._delegate.
	 */
	getDragRestoreLocation() {
		log(`getDragRestoreLocation hook: ${this.app.id}`);
		return [this._originalX, this._originalY, 1];
	},

	/**
	 * Hooked from EmDash.Draggable using our actor._delegate.
	 */
	handleDragCancelling() {
		// Called as soon as the mouse button is released
		log(`handleDragCancelling hook: ${this.app.id}`);
		// Note: handleDragEnd may be called *before* the appear animation is complete
		this._appear();
	},

	/**
	 * Hooked from EmDash.Draggable using our actor._delegate.
	 */
	handleDragEnd(dropped) {
		// When cancelling, called when the draggable *finishes* "snapping back"
		log(`handleDragEnd hook: ${this.app.id} ${dropped?'dropped':'cancelled'}`);
		DropPlaceholder.remove();
		this.actor.child.show();
		if (dropped) {
			// If cancelled, then the animation was already started in handleDragCancelling
			this._appear(true);
		}
	},

	// Dragging over us

	/**
	 * Test if we can drop on this icon. If we can drop, create the a drop placeholder instead of or
	 * after this icon.
	 *
	 * Hooked from DND using our actor._delegate.
	 */
	handleDragOver(source, actor, x, y, extra) {
		if (source === this) {
			log('handleDragOver hook: self');
			return DND.DragMotionResult.NO_DROP;
		}

		if (!(source instanceof AppDisplay.AppIcon)) {
			log('handleDragOver hook: not an app');
			return DND.DragMotionResult.NO_DROP;
		}

		const vertical = this.dashView.box.vertical;
		const after = vertical ? (y > this.actor.height / 2) : (x > this.actor.width / 2);

		let app = null;
		if (after || (this.modelIndex === 0)) {
			app = this.app;
		}
		else {
			const iconView = this.dashView.getIconViewForModelIndex(this.modelIndex - 1);
			if (iconView !== null) {
				app = iconView.app;
			}
		}
		if ((app === null) || !AppUtils.isFavoriteApp(app)) {
			log(`handleDragOver hook: ${app?app.id:'?'} not a favorite app`);
			return DND.DragMotionResult.NO_DROP;
		}

		log(`handleDragOver hook: ${this.app.id} x=${Math.round(x)} y=${Math.round(y)}`);
		DropPlaceholder.add(this.actor, after);
		return DND.DragMotionResult.MOVE_DROP;
	}
});
