/*
 * This file is part of the Em-Dash extension for GNOME.
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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
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
 * See: https://github.com/GNOME/gnome-shell/blob/master/js/ui/appDisplay.js
 */
const IconView = new Lang.Class({
	Name: 'EmDash.IconView',
	Extends: AppDisplay.AppIcon,

	_init: function(dashView, model, modelIndex) {
		log(`_init: ${model.app.id}`);
		this._dashView = dashView;
		this._model = model;
		this._modelIndex = modelIndex;
		this._fixedIconSize = null;
		this._originalX = null;
		this._originalY = null;
		this._originalWidth = null;
		this._originalHeight = null;

		this.parent(model.app, {
			showLabel: false,
			isDraggable: false // we will handle draggable ourselves
		});

		// Can we extract a simple name?
		let id = model.app.id;
		if (id.endsWith('.desktop')) {
			this._simpleName = id.substring(0, id.length - '.desktop'.length);
		}
		else {
			this._simpleName = null;
		}

		// Draggable?
		if (global.settings.is_writable('favorite-apps') && AppUtils.isFavoriteApp(model.app)) {
			this._draggable = new DraggableUtils.Draggable(this.actor);
		}
		else {
			this._draggable = null;
		}
	},

	/**
	 * Override.
	 */
	_onDestroy: function() {
		log(`_onDestroy: ${this.app.id}`);
		if (this._draggable !== null) {
			this._draggable.destroy();
		}
		this.parent();
	},

	// Icons

	/**
	 * Override to use fixed icon size
	 */
	_createIcon: function(iconSize) {
		if (this._fixedIconSize !== null) {
			iconSize = this._fixedIconSize;
		}
		return this.parent(iconSize);
	},

	// Focus

	focus: function() {
		log(`focus: ${this.app.id}`);
		let icon = this.icon.icon;
		if (icon !== null) {
			// TODO: use the theme to get the pixbuf
			//log(this._dashView.actor.get_theme());

			let [name, pixbuf] = IconUtils.getStIconPixBuf(icon);
			let backlight = BacklightUtils.getBacklightColor(name, pixbuf);
			log(`backlight: l=${backlight.lighter} o=${backlight.original} d=${backlight.darker}`);

			let settings = this._dashView.modelManager.settings;
			if (settings.get_boolean('icons-highlight-focused-gradient')) {
				this.actor.style = `
background-gradient-direction: vertical;
background-gradient-start: ${backlight.original};
background-gradient-end: ${backlight.darker};`;
			}
			else {
				this.actor.style = `background-color: ${backlight.darker};`;
			}
			// Assumes dot on botton
			this._dot.style = `background-color: ${backlight.original};`;
		}
		this.actor.add_style_class_name('focused');
	},

	unfocus: function() {
		log(`unfocus: ${this.app.id}`);
		this.actor.remove_style_class_name('focused');
		this.actor.style = null;
		this._dot.style = null;
	},

	// Menu

	/**
	 * Override and copy original code, just use our menu class instead.
	 */
	popupMenu: function() {
		this._removeMenuTimeout();
		this.actor.fake_release();

		if (this._draggable) {
			this._draggable.fakeRelease(); // Em-Dash note: our draggable has this method, too
		}
		if (!this._menu) {
			this._menu = new IconMenu.IconMenu(this, this._simpleName,
				this._dashView.modelManager.settings);
			this._menu.connect('activate-window', (menu, window) => {
				this.activateWindow(window);
			});
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this._onMenuPoppedDown();
				}
			});
			let id = Main.overview.connect('hiding', () => {
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

	// Clicks

	/**
	 * Override to support our custom left-click actions.
	 */
	activate: function(button) {
		let settings = this._dashView.modelManager.settings;
		let iconsLeftClick = settings.get_string('icons-left-click');

		// CTRL forces launch
		let event = Clutter.get_current_event();
		if (event !== null) {
			if ((event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0) {
				iconsLeftClick = 'LAUNCH';
			}
		}

		if (iconsLeftClick !== 'NOTHING') {
			this._clickAction(iconsLeftClick);
		}
	},

	_onClicked: function(actor, button) {
		this.parent(actor, button);
	},

	/**
	 * Override to support our custom middle-click actions.
	 */
	_onButtonPress: function(actor, event) {
		let button = event.get_button();
		switch (button) {
		case 1:
			this._setPopupTimeout();
			break;
		case 2:
			let settings = this._dashView.modelManager.settings;
			let iconsMiddleClick = settings.get_string('icons-middle-click');
			if (iconsMiddleClick !== 'NOTHING') {
				this._clickAction(iconsMiddleClick);
				return Clutter.EVENT_STOP;
			}
			break;
		case 3:
			this.popupMenu();
			return Clutter.EVENT_STOP;
		}
		return Clutter.EVENT_PROPAGATE;
	},

	_clickAction: function(action) {
		Main.overview.hide();
		switch (action) {
		case 'LAUNCH':
			this._launch();
			break;
		case 'LAUNCH_OR_SHOW':
			this._launchOrShow();
			break;
		case 'LAUNCH_OR_TOGGLE':
			this._launchOrToggle();
			break;
		case 'LAUNCH_OR_CYCLE':
			this._launchOrCycle();
			break;
		}
	},

	_launch: function() {
		log(`_launch: ${this.app.id}`);
		if (this.app.state === Shell.AppState.STOPPED) {
			this.animateLaunch();
		}
		if (this.app.can_open_new_window()) {
			// Opening a new window would also be considered "launching"
			this.app.open_new_window(-1);
		}
		else {
			// Some apps don't allow more than one instance to be running, so for them this may
			// cause nothing to happen; we'll try anyway
			this.app.launch(0, -1, false);
		}
	},

	_launchOrShow: function() {
		log(`_launchOrShow: ${this.app.id}`);
		if (this.app.state === Shell.AppState.STOPPED) {
			this.animateLaunch();
		}
		this.app.activate();
	},

	_launchOrToggle: function() {
		log(`_launchOrToggle: ${this.app.id}`);
		if (!this._activateIfStopped() && !this._model.hideIfHasFocus(this._workspaceIndex)) {
			// If we get here we should be already running, so this would not launch, only raise the
			// primary window
			this.app.activate();
		}
	},

	_launchOrCycle: function() {
		log(`_launchOrCycle: ${this.app.id}`);
		if (!this._activateIfStopped()) {
			this._model.cycleFocusOrHide(this._workspaceIndex);
		}
	},

	get _workspaceIndex() {
		let settings = this._dashView.modelManager.settings;
		if (settings.get_boolean('dash-per-workspace')) {
			return global.screen.get_active_workspace().index();
		}
		return undefined;
	},

	_activateIfStopped: function() {
		if (this.app.state === Shell.AppState.STOPPED) {
			// Launch
			this.animateLaunch();
			if (this.app.can_open_new_window()) {
				// Opening a new window would also be considered "launching"
				this.app.open_new_window(-1);
			}
			else {
				this.app.activate();
			}
			return true;
		}
		return false;
	},

	// Dragging us

	/*
	 * Override to make sure the drag actor is the same size as our icon.
	 */
	getDragActor: function() {
		// Hooked from DND using our actor._delegate
		let size = this.icon.icon.icon_size;
		log(`getDragActor hook: ${this.app.id} ${size}`);
		return this.app.create_icon_texture(size);
	},

	handleDragBegin: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragBegin hook: ${this.app.id}`);
		this._removeMenuTimeout();
		this._dissolve();
	},

	getDragRestoreLocation: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`getDragRestoreLocation hook: ${this.app.id}`);
		return [this._originalX, this._originalY, 1];
	},

	handleDragCancelling: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		// Called as soon as the mouse button is released
		log(`handleDragCancelling hook: ${this.app.id}`);
		// Note: handleDragEnd may be called before the reappear animation is complete!
		this._reappear();
	},

	handleDragEnd: function(dropped) {
		// Hooked from EmDash.Draggable using our actor._delegate
		// When cancelling, called when the draggable finishes "snapping back"
		log(`handleDragEnd hook: ${this.app.id} ${dropped?'dropped':'cancelled'}`);
		this.actor.child.show();
		// If cancelled, then the animation was already started in handleDragCancelling
		if (dropped) {
			this._reappear(DropPlaceholder.selfDrop);
		}
	},

	_dissolve: function() {
		log(`_dissolve: ${this.app.id}`);
		let position = this.icon.icon.get_transformed_position();
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
				this.actor.hide();
			}
		});
	},

	_reappear: function(immediate = false) {
		log(`_reappear: ${this.app.id} ${immediate}`);
		this.actor.show();
		Tweener.addTween(this.actor, {
			time: immediate ? 0 : ANIMATION_TIME,
			transition: 'easeOutQuad',
			width: this._originalWidth,
			height: this._originalHeight,
			onComplete: () => {
				this._dot.show();
				this.actor.style_class = this._originalStyleClass;
				this.actor.style = this._originalStyle;
			}
		});
	},

	// Dragging over us

	handleDragOver: function(source, actor, x, y, extra) {
		if (source === this) {
			log('handleDragOver hook: it\'s us');
			return DND.DragMotionResult.NO_DROP;
		}

		// Hooked from DND using our actor._delegate
		if (!(source instanceof AppDisplay.AppIcon)) {
			log('handleDragOver hook: not an app');
			return DND.DragMotionResult.NO_DROP;
		}

		let vertical = this._dashView.box.vertical;
		let after = vertical ? y > this.actor.height / 2 : x > this.actor.width / 2;

		let app = null;
		if (after || (this._modelIndex === 0)) {
			app = this.app;
		}
		else {
			let iconView = this._dashView.getIconViewAt(this._modelIndex - 1);
			if (iconView !== null) {
				app = iconView.app;
			}
		}
		if ((app === null) || !AppUtils.isFavoriteApp(app)) {
			log(`handleDragOver hook: ${app?app.id:'?'} not a favorite app`);
			return DND.DragMotionResult.NO_DROP;
		}

		log(`handleDragOver hook: ${this.app.id} x=${Math.round(x)} y=${Math.round(y)}`);
		DropPlaceholder.addDropPlaceholder(this.actor, after);
		return DND.DragMotionResult.MOVE_DROP;
	}
});
