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
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Logging = Me.imports.utils.logging;
const Signals = Me.imports.utils.signals;
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
	
	_init: function(icons, app, i) {
		this.parent(app, {
			showLabel: false,
			isDraggable: false // we will handle draggable ourselves
		});
		
		this._icons = icons;
		this._entryIndex = i;
		this._dragFromIndex = -1;
		
		// Can we extract a simple name?
		let id = app.id;
		let suffix = '.desktop';
		if (id.endsWith(suffix)) {
			this._simpleName = id.substring(0, id.length - suffix.length);
		}
		else {
			this._simpleName = null;
		}

		// Draggable
		if (global.settings.is_writable('favorite-apps') && Entries.isFavoriteApp(app)) {
			this._draggable = new Draggable.Draggable(this.actor);
		}
		else {
			this._draggable = null;
		}
	},
	
	// Dragging us

	handleDragBegin: function() {
		// Hooked from EmDash.Draggable
		this._dragFromIndex = ClutterUtils.getActorIndexOfChild(this._icons.box, this.actor);
		log('drag-begin: ' + this._dragFromIndex);
		this._removeMenuTimeout();
		//this._icons.box.remove_child(this.actor);
		this.actor.hide();
		//this.actor.opacity = 64;
		//this.actor.add_style_class_name('EmDash-Icon-Dragging');
	},

	handleDragEnd: function(dropped) {
		// Hooked from EmDash.Draggable
		log('drag-end: ' + dropped);
		if (!dropped) {
			//this._icons.box.insert_child_at_index(this.actor, this._dragFromIndex);
			this.actor.show();
			//this.actor.opacity = 255;
		}
		endDropHovering();
	},
	
	// Dropping on us

	handleDragOver: function(source, actor, x, y, extra) {
		// Hooked from DND using our actor._delegate
		if (source instanceof AppDisplay.AppIcon) {
			log('handleDragOver: ' + source.app.id + ' ' + x + ' ' + y);
			if (Entries.isFavoriteApp(this.app)) {
				let vertical = this._icons.box.vertical;
				let after = vertical ? y > 60 : x > 30;
				startDropHovering(this.actor, after, vertical);
				return DND.DragMotionResult.MOVE_DROP;
			}
		}
		else {
			log('handleDragOver: unsupported');
		}
		endDropHovering();
		return DND.DragMotionResult.NO_DROP;
	},
	
	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		if (source instanceof AppDisplay.AppIcon) {
			let appId = source.app.id;
			log('acceptDrop: ' + appId + ' from ' +
				(source._dragFromIndex === -1 ? 'elsewhere' : source._dragFromIndex) +
				' to entry ' + this._entryIndex);
			if (source._dragFromIndex === -1) {
				// Dragged from overview
				let favorites = AppFavorites.getAppFavorites();
				favorites.addFavoriteAtPos(appId, this._entryIndex);
			}
			else {
				// Moved within the dash
				let newEntryIndex = this._entryIndex; 
				if (_dropHoveringAfter) {
					newEntryIndex++;
				}
				moveFavoriteToPos(appId, source._entryIndex, newEntryIndex);
			}
			return true;
		}
		else {
			log('acceptDrop: not an app');
			return false;
		}
	},
	
	/*
	 * Override to make sure the drag actor is the same size as us.
	 */
	getDragActor: function() {
		return this.app.create_icon_texture(this.icon.iconSize);
	},
	
	/*
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
			this._menu.connect('activate-window', Lang.bind(this, (menu, window) => {
				this.activateWindow(window);
			}));
			this._menu.connect('open-state-changed', Lang.bind(this, (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this._onMenuPoppedDown();
				}
			}));
			let id = Main.overview.connect('hiding', Lang.bind(this, () => {
				this._menu.close();
			}));
			this.actor.connect('destroy', function() {
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
		if (this._draggable !== null) {
			this._draggable.destroy();
		}
		this.parent();
	}
});


/**
 * UI representation of an dash entry sequence.
 */
const Icons = new Lang.Class({
	Name: 'EmDash.Icons',
	
	_init: function(entryManager, vertical, iconSize) {
		this.entryManager = entryManager;
		
		this._iconSize = iconSize;

		// Box
		this.box = new St.BoxLayout({
			name: 'em-dash-icons-box',
			vertical: vertical
		});

		// Actor
		this.actor = new St.Bin({
			name: 'em-dash-icons',
			child: this.box
		});

		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(entryManager, 'changed', this._onEntriesChanged);
		
		this.refresh();
	},

	destroy: function() {
		this._signalManager.destroy();
		this.actor.destroy();
	},
	
	setVertical: function(vertical) {
		if (this.box.vertical !== vertical) {
			this.box.vertical = vertical;
			// Swap alignments
//			let x_align = this.actor.x_align;
//			this.actor.x_align = this.actor.y_align;
//			this.actor.y_align = x_align;
			// New icon sizes
			this.refresh();
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
		this.box.remove_all_children();

		for (let i in entrySequence._entries) {
			let entry = entrySequence._entries[i];
			let appIcon = new Icon(this, entry._app, i);
//			appIcon.icon._getPreferredHeight = Lang.bind(this, (actor, forWidth, alloc) => {
//				return this._iconSize;
//			});
			//appIcon.icon.actor.set_height(this._iconSize);
			//log(appIcon._dot.get_preferred_height(100));
			appIcon.icon.setIconSize(this._iconSize);
			//appIcon.actor.set_height(this._iconSize);
			this.box.add_child(appIcon.actor);
		}
	},

	_onEntriesChanged: function(entryManager) {
		log('entries-changed');
		this.refresh();
	}
});


/*
 * Drop hovering (handled globally)
 */

let _dropHoveringActor = null;
let _dropHoveringAfter = null;


function startDropHovering(actor, after, vertical) {
	if ((_dropHoveringActor !== actor) || (_dropHoveringAfter !== after)) {
		endDropHovering();

		log('startDropHovering');
		
		_dropHoveringActor = actor;
		_dropHoveringAfter = after;

		let originalChild = _dropHoveringActor.get_child();
		let width = originalChild.width;
		let height = originalChild.height;

		// Replace original child with a box
		let box = new St.BoxLayout({
			name: 'em-dash-drop-hovering',
			vertical: vertical
		});
		_dropHoveringActor.set_child(box);

		// Put a placeholder before or after the original child in the box
		let placeholder = new St.Widget({
			name: 'em-dash-drop-hovering-placeholder',
			width: width,
			height: height,
			style_class: 'placeholder' // GNOME theme styling
		});
		if (_dropHoveringAfter) {
			box.add_child(originalChild);
			box.add_child(placeholder);
		}
		else {
			box.add_child(placeholder);
			box.add_child(originalChild);
		}

		//_dropHoveringActor.add_style_class_name('EmDash-Icon-Dragging');
	}
}

function endDropHovering() {
	if (_dropHoveringActor !== null) {
		log('endDropHovering');

		// Restore original child
		let box = _dropHoveringActor.get_child();
		let originalChild = box.get_child_at_index(_dropHoveringAfter ? 0 : 1);
		box.remove_child(originalChild);
		box.destroy();
		_dropHoveringActor.set_child(originalChild);

		//_dropHoveringActor.remove_style_class_name('EmDash-Icon-Dragging');

		_dropHoveringActor = null;
		_dropHoveringAfter = null;
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
 * The built-in favorites.moveFavoriteToPos is broken. It does does not decrement new position if
 * necessary, nor does it verify that there is no change.
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
