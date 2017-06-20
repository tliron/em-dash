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
const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const DND = imports.ui.dnd;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;
const Scaling = Me.imports.utils.draggable;
const ClutterUtils = Me.imports.utils.clutter;
const Draggable = Me.imports.utils.draggable;
const Menu = Me.imports.menu;
const Entries = Me.imports.entries;

const log = Logging.logger('icons');


/**
 * UI representation of a dash entry.
 *
 * See: https://github.com/GNOME/gnome-shell/blob/master/js/ui/appDisplay.js
 */
const Icon = new Lang.Class({
	Name: 'EmDash.Icon',
	Extends: AppDisplay.AppIcon,

	_init: function(icons, app, entryIndex) {
		log(`_init: ${entryIndex}`);
		this._icons = icons;
		this._entryIndex = entryIndex;
		this._fixedIconSize = null;

		this.parent(app, {
			showLabel: false,
			isDraggable: false // we will handle draggable ourselves
		});
		//this.actor.height = height;
		//this.actor.style_class = 'app-well-app2'; // app-well-app
//		this._iconContainer.layout_manager = new Clutter.BoxLayout({
//			vertical: true
//		});
		//this.icon._spacing = 0;
		//this._iconContainer.set_child_above_sibling(this.icon.actor, this._dot);
		//this.actor.add_style_class_name('panel-button');
//		this.actor.scale_x = 0.5;
//		this.actor.scale_y = 0.5;
//		this.icon.actor.scale_x = 0.5;
//		this.icon.actor.scale_y = 0.5;
//		this._dot.scale_x = 0.5;
//		this._dot.scale_y = 0.5;

		// Can we extract a simple name?
		let id = app.id;
		if (id.endsWith('.desktop')) {
			this._simpleName = id.substring(0, id.length - '.desktop'.length);
		}
		else {
			this._simpleName = null;
		}

		// Draggable?
		if (global.settings.is_writable('favorite-apps') && Entries.isFavoriteApp(app)) {
			this._draggable = new Draggable.Draggable(this.actor);
		}
		else {
			this._draggable = null;
		}
	},

	// Dragging us

	handleDragBegin: function() {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragBegin hook: ${this.app.id}`);
		this._removeMenuTimeout();
		this.actor.hide();
	},

	handleDragEnd: function(dropped) {
		// Hooked from EmDash.Draggable using our actor._delegate
		log(`handleDragEnd hook: ${this.app.id} ${dropped}`);
		this.actor.show();
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
		// Hooked from DND using our actor._delegate
		if (!(source instanceof AppDisplay.AppIcon)) {
			log('handleDragOver hook: not an app');
			return DND.DragMotionResult.NO_DROP;
		}

		let vertical = this._icons.box.vertical;
		let after = vertical ? y > this.actor.height / 2 : x > this.actor.width / 2;

		let app = null;
		if (after || (this._entryIndex === 0)) {
			app = this.app;
		}
		else {
			let icon = this._icons.getIconAt(this._entryIndex - 1);
			if (icon !== null) {
				app = icon.app;
			}
		}
		if ((app === null) || !Entries.isFavoriteApp(app)) {
			log('handleDragOver: not a favorite app');
			return DND.DragMotionResult.NO_DROP;
		}

		log(`handleDragOver hook: ${this.app.id} ${Math.round(x)} ${Math.round(y)}`);
		startDropHovering(this.actor, after);
		return DND.DragMotionResult.MOVE_DROP;
	},

	/**
	 * Override and copy original code, just use our menu class instead.
	 */
	popupMenu: function() {
		this._removeMenuTimeout();
		this.actor.fake_release();

		if (this._draggable) {
			this._draggable.fakeRelease();
		}

		if (!this._menu) {
			this._menu = new Menu.IconMenu(this, this._simpleName, this._icons);
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
		log('_onDestroy');
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


/**
 * UI representation of an dash entry sequence.
 */
const Icons = new Lang.Class({
	Name: 'EmDash.Icons',

	_init: function(entryManager, scalingManager, styleClass, vertical, iconSize, quantize) {
		this.entryManager = entryManager;
		this.quantize = quantize;

		this._scalingManager = scalingManager;
		this._iconSize = null;

		// Box
		this.box = new St.BoxLayout({
			name: 'em-dash-icons-box'
		});

		// Actor
		this.actor = new St.Bin({
			name: 'dash', // will use GNOME theme
			style_class: styleClass,
			child: this.box
		});

		let windowTracker = Shell.WindowTracker.get_default();
		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(entryManager, 'changed', this._onEntriesChanged);
		this._signalManager.connect(global.screen, 'workspace-switched', this._onWorkspaceSwitched);
		this._signalManager.connectProperty(windowTracker, 'focus-app', this._onFocusChanged);

		this.setVertical(vertical);
		this.setSize(iconSize);
	},

	destroy: function() {
		this._signalManager.destroy();
		this.actor.destroy();
	},

	getIconAt: function(index) {
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
		let entrySequence = this.entryManager.getEntrySequence(workspaceIndex);
		this._refresh(entrySequence);
	},

	_refresh: function(entrySequence) {
		let physicalActorSize = this._scalingManager.toPhysical(this._iconSize);
		let physicalIconSize = physicalActorSize * 0.75;
		if (this.quantize) {
			physicalIconSize = this._scalingManager.getQuantizedIconSize(physicalIconSize);
		}

		this.box.remove_all_children();
		log(`_refresh: ${physicalActorSize} ${physicalIconSize}`);
		for (let i = 0; i < entrySequence.entries.length; i++) {
			let entry = entrySequence.entries[i];
			let icon = new Icon(this, entry.app, i);
			icon.actor.height = physicalActorSize
			icon._fixedIconSize = this._scalingManager.toLogical(physicalIconSize);
			this.box.add_child(icon.actor);

//			let Dash = imports.ui.dash;
//			icon._Container = new Dash.DashItemContainer();
//			icon._Container.setChild(icon.actor);
//			icon.actor.label_actor = null;
//			icon._Container.setLabelText(entry.app.get_name());
//			//_hookUpLabel
//			icon._Container.show();
//			this.box.add_child(icon._Container);
		}
	},

	_onEntriesChanged: function(entryManager) {
		log('entries "changed" signal');
		this.refresh();
	},

	_onWorkspaceSwitched: function(screen, oldWorkspaceIndex, newWorkspaceIndex, direction) {
		log(`screen "workspace-switched" signal: from ${oldWorkspaceIndex} to ${newWorkspaceIndex} (${direction})`);
		if (!this.entryManager.single) {
			this.refresh(newWorkspaceIndex);
		}
	},

	_onFocusChanged: function(windowTracker, app) {
		if (app === null) {
			log('window tracker "focus-app" property changed signal: none');
		}
		else {
			log(`window tracker "focus-app" property changed signal: ${app.id} ${app.get_name()}`);
		}
	}
});


/**
 * Drop hovering placeholder.
 */
const Placeholder = new Lang.Class({
	Name: 'EmDash.Placeholder',

	_init: function(actor, after) {
		this._icon = actor._delegate;
		this._after = after;
		log(`Placeholder._init: ${this._icon.app.id} ${after}`);

		this.actor = new St.Widget({
			name: 'em-dash-placeholder',
			width: actor.width,
			height: actor.height,
			style_class: 'placeholder' // GNOME theme styling
		});
		this.actor._delegate = this;

		// Before or after actor?
		let container = this._icon._icons.box;
		let index = ClutterUtils.getActorIndexOfChild(container, actor);
		if (after) {
			container.insert_child_at_index(this.actor, index + 1);
			this._entryIndex = this._icon._entryIndex + 1;
		}
		else {
			container.insert_child_at_index(this.actor, index);
			this._entryIndex = this._icon._entryIndex;
		}

		// Drag monitor
		this._dragMonitor = {
			dragMotion: Lang.bind(this, this._onDragMotion),
			dragDrop: Lang.bind(this, this._onDragDrop)
		};
		DND.addDragMonitor(this._dragMonitor);
	},

	destroy: function() {
		log('Placeholder.destroy');
		DND.removeDragMonitor(this._dragMonitor);
		this.actor.destroy();
	},

	isFor: function(actor, after) {
		return (this._icon.actor === actor) && (this._after === after);
	},

	// Dropping on us

	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		let appId = source.app.id;
		if (source._entryIndex === undefined) {
			// Dragged from elsewhere (likely overview)
			log(`acceptDrop hook: ${appId} from elsewhere to ${this._entryIndex}`);
			let favorites = AppFavorites.getAppFavorites();
			favorites.addFavoriteAtPos(appId, this._entryIndex);
		}
		else {
			// Moved within the dash
			log(`acceptDrop hook: ${appId} from ${source._entryIndex} to ${this._entryIndex}`);
			moveFavoriteToPos(appId, source._entryIndex, this._entryIndex);
		}
		return true;
	},

	_onDragMotion: function(dragEvent) {
		// We're checking for the icon box, too, so that moving into the spaces between icons won't
		// cause hovering to stop
		if ((dragEvent.targetActor !== this.actor) &&
			(dragEvent.targetActor !== this._icon._icons.box)) {
			endDropHovering();
		}
		return DND.DragMotionResult.CONTINUE;
	},

	_onDragDrop: function(dropEvent) {
		log('dragDrop monitor hook');
		endDropHovering();
		return DND.DragDropResult.CONTINUE;
	}
});


let _dropHoveringPlaceholder = null;


function startDropHovering(actor, after) {
	if ((_dropHoveringPlaceholder === null) || !_dropHoveringPlaceholder.isFor(actor, after)) {
		endDropHovering();
		_dropHoveringPlaceholder = new Placeholder(actor, after);
	}
}


function endDropHovering() {
	if (_dropHoveringPlaceholder !== null) {
		_dropHoveringPlaceholder.destroy();
		_dropHoveringPlaceholder = null;
	}
}


/*
 * Utils
 */

function isFavoriteApp(app) {
	let favorites = AppFavorites.getAppFavorites().getFavorites();
	return favorites.indexOf(app) != -1;
}


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
