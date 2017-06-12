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
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const MPRIS = Me.imports.mpris;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = (e) => { return e };

const log = Utils.logger('icons');


/**
 * UI representation of a dash entry. 
 */
const Icon = new Lang.Class({
	Name: 'EmDash.Icon',
	Extends: AppDisplay.AppIcon,
	
	_init: function(app, params) {
		params = params || {};
		params.showLabel = false;
		this.parent(app, params);
		
		// Can we extract a simple name?
		let id = app.id;
		let suffix = '.desktop';
		if (id.endsWith(suffix)) {
			this._simpleName = id.substring(0, id.length - suffix.length);
		}
		else {
			this._simpleName = null;
		}

		// Signals
		this._signalManager = new Utils.SignalManager(this);
	},

	/*
	 * Override in order to use our menu class:
	 * https://github.com/GNOME/gnome-shell/blob/master/js/ui/appDisplay.js
	 */
	popupMenu: function() {
		this._removeMenuTimeout();
		this.actor.fake_release();

		if (this._draggable) {
			this._draggable.fakeRelease();
		}
		
		if (!this._menu) {
			this._menu = new IconMenu(this);
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
		this._signalManager.destroy();
		this.parent();
	}
});


/**
 * Popup menu.
 */
const IconMenu = new Lang.Class({
	Name: 'EmDash.IconMenu',
	Extends: AppDisplay.AppIconMenu,
	
	_init: function(source, mpris) {
		this.parent(source);
		
		this._signalManager = new Utils.SignalManager(this);
		
		// MPRIS?
		if (source._simpleName !== null) {
			this._mpris = new MPRIS.MPRIS(source._simpleName);
			this._signalManager.connect(this._mpris, 'initialize', this._onMprisInitialized);
		}
		else {
			this._mpris = null;
		}
	},
	
	/**
	 * Override.
	 */
	destroy: function() {
		if (this._mpris !== null) {
			this._mpris.destroy();
		}
		this._signalManager.destroy();
		this.parent();
	},
	
	/**
	 * Override.
	 */
	_redisplay: function() {
		this.parent();
		this._mpris.reinitialize();
	},
	
	_onMprisInitialized: function(mpris) {
		log('mpris-initialized');
		this._appendSeparator();
		let item;
		item = this._appendMenuItem(_('Play'));
		this._signalManager.connect(item, 'activate', this._onPlay);
		if (mpris.canPause) {
			item = this._appendMenuItem(_('Pause'));
			this._signalManager.connect(item, 'activate', this._onPause);
		}
		item = this._appendMenuItem(_('Stop'));
		this._signalManager.connect(item, 'activate', this._onStop);
		if (mpris.canGoNext) {
			item = this._appendMenuItem(_('Next track'));
			this._signalManager.connect(item, 'activate', this._onNext);
		}
		if (mpris.canGoPrevious) {
			item = this._appendMenuItem(_('Previous track'));
			this._signalManager.connect(item, 'activate', this._onPrevious);
		}
	},
	
	_onPlay: function() {
		log('play');
		this._mpris.play();
	},
	
	_onPause: function() {
		log('pause');
		this._mpris.pause();
	},
	
	_onStop: function() {
		log('stop');
		this._mpris.stop();
	},
	
	_onNext: function() {
		log('next');
		this._mpris.next();
	},
	
	_onPrevious: function() {
		log('previous');
		this._mpris.previous();
	}
});


/**
 * UI representation of an dash entry sequence.
 */
const Icons = new Lang.Class({
	Name: 'EmDash.Icons',
	
	_init: function(entryManager, vertical) {
		this._entryManager = entryManager;

		// Box
		this._box = new St.BoxLayout({
			name: 'EmDash-Icons-Box',
			vertical: vertical
		});

		// Actor
		this.actor = new St.Bin({
			name: 'EmDash-Icons',
			child: this._box
		});

		// Signals
		this._signalManager = new Utils.SignalManager(this);
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
//			this._box.destroy();
//			this._box = new St.BoxLayout({
//				name: 'EmDash-Icons-Box',
//				vertical: vertical
//			});
//			this.actor.set_child(this._box);
			this.refresh();
		}
	},

	refresh: function(workspaceIndex) {
		if (workspaceIndex === undefined) {
			workspaceIndex = global.screen.get_active_workspace().index();
		}
		let entrySequence = this._entryManager.getEntrySequence(workspaceIndex);
		this._refresh(entrySequence);
	},
	
	_refresh: function(entrySequence) {
		this._box.remove_all_children();

		let text = new St.Label({
			text: _('Dash'),
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER
		});
		this._box.add_child(text);

		let size = this._box.vertical ? 36 : Main.panel.actor.get_height() - 10; // TODO: how do we know the _dot height?
		for (let i in entrySequence._entries) {
			let entry = entrySequence._entries[i];
			let appIcon = new Icon(entry._app);
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
