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
		this._dragFromIndex = ClutterUtils.getActorIndexOfChild(this._icons._box, this.actor);
		log('drag-begin: ' + this._dragFromIndex);
		this._removeMenuTimeout();
		//this._icons._box.remove_child(this.actor);
		this.actor.hide();
		//this.actor.opacity = 64;
		//this.actor.add_style_class_name('EmDash-Icon-Dragging');
	},

	handleDragEnd: function(dropped) {
		// Hooked from EmDash.Draggable
		log('drag-end: ' + dropped);
		if (!dropped) {
			//this._icons._box.insert_child_at_index(this.actor, this._dragFromIndex);
			this.actor.show();
			//this.actor.opacity = 255;
		}
		endDropHovering();
	},
	
	// Dropping on us

	handleDragOver: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		if (source instanceof AppDisplay.AppIcon) {
			log('drag-over: ' + source.app.id);
			if (Entries.isFavoriteApp(this.app)) {
				startDropHovering(this.actor);
				return DND.DragMotionResult.MOVE_DROP;
			}
		}
		else {
			log('drag-over: unsupported');
		}
		endDropHovering();
		return DND.DragMotionResult.NO_DROP;
	},
	
	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		if (source instanceof AppDisplay.AppIcon) {
			let appId = source.app.id;
			log('accept-drop: ' + appId + ' from ' +
				(source._dragFromIndex === -1 ? 'elsewhere' : source._dragFromIndex) +
				' to entry ' + this._entryIndex);
			let favorites = AppFavorites.getAppFavorites();
			if (source._dragFromIndex === -1) {
				// Dragged from overview
				favorites.addFavoriteAtPos(appId, this._entryIndex);
			}
			else {
				// Moved within the dash
				// favorites.moveFavoriteToPos(appId, this._entryIndex); this is totally broken!
				favorites._removeFavorite(appId);
				if (source._entryIndex < this._entryIndex) {
					this._entryIndex--;
				}
				favorites._addFavorite(appId, this._entryIndex);
			}
			return true;
		}
		else {
			log('accept-drop: not an app');
			return false;
		}
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
	
	_init: function(entryManager, vertical, align) {
		this.entryManager = entryManager;

		// Box
		this._box = new St.BoxLayout({
			name: 'EmDash-Icons-Box',
			vertical: vertical
		});

		// Actor
		this.actor = new St.Bin({
			name: 'EmDash-Icons',
			child: this._box,
			x_align: vertical ? St.Align.MIDDLE : align,
			y_align: vertical ? align : St.Align.MIDDLE
		});

		// Signals
		this._signalManager = new Signals.SignalManager(this);
		this._signalManager.connect(entryManager, 'changed', this._onEntriesChanged);
		
		this.refresh();
	},

	destroy: function() {
		this._signalManager.destroy();
		this.actor.destroy();
	},
	
	setVertical: function(vertical) {
		if (this._box.vertical !== vertical) {
			this._box.vertical = vertical;
			// Swap alignments
			let x_align = this.actor.x_align;
			this.actor.x_align = this.actor.y_align;
			this.actor.y_align = x_align;
			// New icon sizes
			this.refresh();
		}
	},

	setAlign: function(align) {
		if (this._box.vertical) {
			this.actor.x_align = St.Align.MIDDLE;
			this.actor.y_align = align;
		}
		else {
			this.actor.x_align = align;
			this.actor.y_align = St.Align.MIDDLE;
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
		this._box.remove_all_children();

		let size = this._box.vertical ? 36 : Main.panel.actor.get_height() - 10; // TODO: how do we know the _dot height?
		for (let i in entrySequence._entries) {
			let entry = entrySequence._entries[i];
			let appIcon = new Icon(this, entry._app, i);
			//log(appIcon._dot.get_height()); 0
			appIcon.icon.iconSize = size; // IconGrid.BaseIcon
			this._box.add_child(appIcon.actor);
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

function startDropHovering(actor) {
	if (_dropHoveringActor !== actor) {
		endDropHovering();

		log('start-drop-hovering');
		
		_dropHoveringActor = actor;
		
		//_dropHoveringActor.add_style_class_name('EmDash-Icon-Dragging');

		// Replace child with a box
		let originalChild = _dropHoveringActor.get_child();
		box = new St.BoxLayout({
			vertical: true
		});
		_dropHoveringActor.set_child(box);

		// Put a space before the original child in the box
		let space = new St.Widget({
			width: originalChild.width,
			height: originalChild.height
		});
		box.add_child(space);
		box.add_child(originalChild);
	}
}

function endDropHovering() {
	if (_dropHoveringActor !== null) {
		log('end-drop-hovering');
		//_dropHoveringActor.remove_style_class_name('EmDash-Icon-Dragging');

		// Restore original child
		let box = _dropHoveringActor.get_child();
		let originalChild = box.get_child_at_index(1);
		box.remove_child(originalChild);
		box.destroy();
		_dropHoveringActor.set_child(originalChild);
		
		_dropHoveringActor = null;
	}
}


/*
 * Utils 
 */

function isFavoriteApp(app) {
	let favorites = AppFavorites.getAppFavorites().getFavorites();
	return favorites.indexOf(app) != -1;
}
