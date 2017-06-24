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
const Signals = imports.signals;
const Main = imports.ui.main;
const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const SignalsUtils = Me.imports.utils.signals;
const Scaling = Me.imports.utils.draggable;
const ClutterUtils = Me.imports.utils.clutter;
const Draggable = Me.imports.utils.draggable;
const Menu = Me.imports.menu;
const Models = Me.imports.models;

const log = Logging.logger('views');


const ANIMATION_TIME = 0.1;


/**
 * UI representation of a dash model.
 */
const DashView = new Lang.Class({
	Name: 'EmDash.DashView',

	_init: function(modelManager, scalingManager, styleClass, vertical, iconSize, quantize) {
		log('DashView._init');

		this.modelManager = modelManager;
		this.quantize = quantize;

		this._scalingManager = scalingManager;
		this._iconSize = null;
		this._focused = null;

		// Box
		this.box = new St.BoxLayout({
			name: 'em-dash-view-box'
		});

		// Actor
		this.actor = new St.Bin({
			name: 'dash', // will use GNOME theme
			style_class: styleClass,
			child: this.box
		});

		let windowTracker = Shell.WindowTracker.get_default();
		let appSystem = Shell.AppSystem.get_default();
		this._signalManager = new SignalsUtils.SignalManager(this);
		this._signalManager.connect(modelManager, 'changed', this._onDashModelChanged);
		this._signalManager.connect(appSystem, 'installed-changed', this._onInstalledChanged);
		this._signalManager.connect(global.screen, 'workspace-switched', this._onWorkspaceSwitched);

		this.setVertical(vertical);
		this.setSize(iconSize);

		this._signalManager.connectProperty(windowTracker, 'focus-app', this._onFocusAppChanged);
		this._signalManager.connectSetting(this.modelManager.settings, 'icons-highlight-focused',
			'boolean', this._onIconsHighlightFocusedSettingChanged);
	},

	destroy: function() {
		log('DashView.destroy');
		this._signalManager.destroy();
		this.actor.destroy();
	},

	getIconViewAt: function(index) {
		let actor = this.box.get_child_at_index(index);
		return actor !== null ? actor._delegate : null;
	},

	setVertical: function(vertical) {
		if (this.box.vertical !== vertical) {
			this.box.vertical = vertical;
			if (vertical) {
				this.box.add_style_class_name('vertical');
			}
			else {
				this.box.remove_style_class_name('vertical');
			}
		}
	},

	setSize: function(iconSize) {
		if (this._iconSize !== iconSize) {
			this._iconSize = iconSize;
			this.refresh();
		}
	},

	refresh: function(workspaceIndex) {
		if (workspaceIndex === undefined) {
			workspaceIndex = global.screen.get_active_workspace().index();
		}
		let dashModel = this.modelManager.getDashModel(workspaceIndex);
		this._refresh(dashModel);
	},

	_refresh: function(dashModel) {
		let physicalActorSize = this._scalingManager.toPhysical(this._iconSize);
		let physicalIconSize = physicalActorSize * 0.75;
		if (this.quantize) {
			physicalIconSize = this._scalingManager.getSafeIconSize(physicalIconSize);
		}

		this.box.remove_all_children();
		log(`_refresh: ${physicalActorSize} ${physicalIconSize}`);
		for (let i = 0; i < dashModel.icons.length; i++) {
			let iconModel = dashModel.icons[i];
			let iconView = new IconView(this, iconModel, i);
			iconView.actor.height = physicalActorSize;
			iconView._fixedIconSize = this._scalingManager.toLogical(physicalIconSize);
			this.box.add_child(iconView.actor);
		}

		this._updateFocusApp();
	},

	_updateFocusApp: function(app) {
		if (this.modelManager.settings.get_boolean('icons-highlight-focused')) {
			if (app === undefined) {
				app = Shell.WindowTracker.get_default().focus_app;
			}
			if (app !== null) {
				let workspaceIndex = global.screen.get_active_workspace().index();
				let dashModel = this.modelManager.getDashModel(workspaceIndex);
				let index = dashModel.getIndexOfRepresenting(app);
				if (index !== null) {
					let actor = this.box.get_child_at_index(index);
					if ((actor !== null) && (this._focused !== actor)) {
						this._removeFocusApp();
						this._focused = actor;
						this._focused.add_style_class_name('focused');
						return;
					}
				}
			}
		}
		this._removeFocusApp();
	},

	_removeFocusApp: function() {
		if (this._focused !== null) {
			this._focused.remove_style_class_name('focused');
			this._focused = null;
		}
	},

	_onDashModelChanged: function(modelManager) {
		log('dash model "changed" signal');
		this.refresh();
	},

	_onInstalledChanged: function(appSystem) {
		log('app system "installed-changed" signal');
		// This could potentially change some of our icons
		this.refresh();
	},

	_onWorkspaceSwitched: function(screen, oldWorkspaceIndex, newWorkspaceIndex, direction) {
		log(`screen "workspace-switched" signal: from ${oldWorkspaceIndex} to ${newWorkspaceIndex} (${direction})`);
		if (!this.modelManager.single) {
			this.refresh(newWorkspaceIndex);
		}
	},

	_onFocusAppChanged: function(windowTracker, app) {
		if (app === null) {
			log('window tracker "focus-app" property changed signal: none');
		}
		else {
			log(`window tracker "focus-app" property changed signal: ${app.id} ${app.get_name()}`);
		}
		this._updateFocusApp(app);
	},

	_onIconsHighlightFocusedSettingChanged: function(settings, iconsHighlightFocused) {
		log(`"icons-highlight-focused" setting changed signal: ${iconsHighlightFocused}`);
		this._updateFocusApp();
	}
});


/**
 * UI representation of a dash icon.
 *
 * See: https://github.com/GNOME/gnome-shell/blob/master/js/ui/appDisplay.js
 */
const IconView = new Lang.Class({
	Name: 'EmDash.IconView',
	Extends: AppDisplay.AppIcon,

	_init: function(dashView, model, modelIndex) {
		log(`IconView._init: ${modelIndex}`);
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
		if (global.settings.is_writable('favorite-apps') && Models.isFavoriteApp(model.app)) {
			this._draggable = new Draggable.Draggable(this.actor);
		}
		else {
			this._draggable = null;
		}
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

	handleDragBegin: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragBegin hook: ${this.app.id}`);
		this._removeMenuTimeout();

		let position = this.icon.icon.get_transformed_position();
		this._originalX = position[0];
		this._originalY = position[1];
		this._originalWidth = this.actor.width;
		this._originalHeight = this.actor.height;

		// Become an empty space
		this.actor.child.hide();

		// Dissolve
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

	getDragRestoreLocation: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`getDragRestoreLocation hook: ${this.app.id}`);
		return [this._originalX, this._originalY, 1];
	},

	handleDragCancelling: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragCancelling hook: ${this.app.id}`);

		// Appear
		this.actor.show();
		Tweener.addTween(this.actor, {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			width: this._originalWidth,
			height: this._originalHeight,
		});
	},

	handleDragEnd: function(dropped) {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragEnd hook: ${this.app.id} ${dropped?'dropped':'cancelled'}`);
		this.actor.child.show();
	},

	/*
	 * Override to make sure the drag actor is the same size as our icon.
	 */
	getDragActor: function() {
		// Hooked from DND using our actor._delegate
		let size = this.icon.icon.icon_size;
		log(`getDragActor hook: ${size}`);
		return this.app.create_icon_texture(size);
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
		if ((app === null) || !Models.isFavoriteApp(app)) {
			log(`handleDragOver hook: ${app?app.id:'?'} not a favorite app`);
			return DND.DragMotionResult.NO_DROP;
		}

		log(`handleDragOver hook: ${this.app.id} x=${Math.round(x)} y=${Math.round(y)}`);
		addDropPlaceholder(this.actor, after);
		return DND.DragMotionResult.MOVE_DROP;
	},

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
			this._menu = new Menu.IconMenu(this, this._simpleName,
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

	/**
	 * Override.
	 */
	_onDestroy: function() {
		log('IconView._onDestroy');
		if (this._draggable !== null) {
			this._draggable.destroy();
		}
		this.parent();
	},

	/**
	 * Override to use fixed icon size
	 */
	_createIcon: function(iconSize) {
		if (this._fixedIconSize !== null) {
			iconSize = this._fixedIconSize;
		}
		return this.parent(iconSize);
	}
});


let _dropPlaceholder = null;
let _dragMonitor = {
	dragMotion: _onDragMotion,
	dragDrop: _onDragDrop
};


/**
 * Drop hovering placeholder singleton.
 */
const DropPlaceholder = new Lang.Class({
	Name: 'EmDash.DropPlaceholder',

	_init: function(actor, after) {
		this.nextActor = null;
		this.nextAfter = null;

		this._iconView = actor._delegate;
		this._after = after;
		this._destroying = false;
		log(`DropPlaceholder._init: ${this._iconView.app.id} ${after?'after':''}`);

		let vertical = this._iconView._dashView.box.vertical;

		this.actor = new St.Widget({
			name: 'em-dash-placeholder',
			width: vertical ? actor.width : 0,
			height: vertical ? 0 : actor.height,
			style_class: 'placeholder' // GNOME theme styling
		});
		this.actor._delegate = this; // hook for DND

		// Before or after actor?
		let container = this._iconView._dashView.box;
		let index = ClutterUtils.getActorIndexOfChild(container, actor);
		if (after) {
			this._neighbor = container.get_child_at_index(index + 1);
			this._modelIndex = this._iconView._modelIndex + 1;
			container.insert_child_at_index(this.actor, index + 1);
		}
		else {
			this._neighbor = actor;
			this._modelIndex = this._iconView._modelIndex;
			container.insert_child_at_index(this.actor, index);
		}

		// Appear
		let tween = {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad'
		};
		if (vertical) {
			tween.height = actor.height;
		}
		else {
			tween.width = actor.width;
		}
		Tweener.addTween(this.actor, tween);
	},

	destroy: function(actor, after) {
		if (this._destroying) {
			return;
		}

		this._destroying = true;

		log('DropPlaceholder.destroying');

		// Dissolve
		let vertical = this._iconView._dashView.box.vertical;
		let tween = {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: () => {
				this.actor.destroy();
				log('DropPlaceholder.destroyed');
				if ((this.nextActor !== null) && (this.nextAfter !== null)) {
					// The old switcheroo
					_dropPlaceholder = new DropPlaceholder(this.nextActor, this.nextAfter);
				}
				else {
					DND.removeDragMonitor(_dragMonitor);
					_dropPlaceholder = null;
				}
			}
		};
		if (vertical) {
			tween.height = 0;
		}
		else {
			tween.width = 0;
		}
		Tweener.addTween(this.actor, tween);
	},

	isFor: function(actor, after) {
		return (this._iconView.actor === actor) && (this._after === after);
	},

	// Dropping on us

	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		let appId = source.app.id;
		if (source._modelIndex === undefined) {
			// Dragged from elsewhere (likely overview)
			log(`acceptDrop hook: ${appId} from elsewhere to ${this._modelIndex}`);
			let favorites = AppFavorites.getAppFavorites();
			favorites.addFavoriteAtPos(appId, this._modelIndex);
		}
		else {
			// Moved within the dash
			log(`acceptDrop hook: ${appId} from ${source._modelIndex} to ${this._modelIndex}`);
			moveFavoriteToPos(appId, source._modelIndex, this._modelIndex);
		}
		return true;
	}
});


function addDropPlaceholder(actor, after) {
	if (_dropPlaceholder === null) {
		_dropPlaceholder = new DropPlaceholder(actor, after);
		DND.addDragMonitor(_dragMonitor);
	}
	else {
		_dropPlaceholder.nextActor = actor;
		_dropPlaceholder.nextAfter = after;
		_dropPlaceholder.destroy();
	}
}


function removeDropPlaceholder() {
	if (_dropPlaceholder !== null) {
		_dropPlaceholder.nextActor = null;
		_dropPlaceholder.nextAfter = null;
		_dropPlaceholder.destroy();
	}
}


function _onDragMotion(dragEvent) {
	if (_dropPlaceholder !== null) {
		// Remove placeholder if we've moved out of the dash view box
		if (!isDescendent(dragEvent.targetActor, _dropPlaceholder._iconView._dashView.box)) {
			//log('dragMotion monitor hook: not in our area');
			removeDropPlaceholder();
		}
	}
	return DND.DragMotionResult.CONTINUE;
}


function _onDragDrop(dropEvent) {
	log('dragDrop monitor hook');
	removeDropPlaceholder();
	return DND.DragDropResult.CONTINUE;
}



/*
 * Utils
 */

/**
 * The built-in favorites.moveFavoriteToPos is broken. It does does not decrement the new position
 * when necessary, nor does it verify that no change is needed.
 */
function moveFavoriteToPos(appId, fromPos, toPos) {
	if (fromPos < toPos) {
		toPos--;
	}
	if (fromPos === toPos) {
		return;
	}
	let favorites = AppFavorites.getAppFavorites();
	favorites._removeFavorite(appId);
	favorites._addFavorite(appId, toPos);
}


function isDescendent(actor, ancestor) {
	for (; actor !== null; actor = actor.get_parent()) {
		if (actor === ancestor) {
			return true;
		}
	}
	return false;
}
