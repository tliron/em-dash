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
const AppDisplay = imports.ui.appDisplay;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const ShellMenu = imports.gi.ShellMenu;
const Atk = imports.gi.Atk;
const GObject = imports.gi.GObject;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const MPRIS = Me.imports.utils.mpris;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = e => e;

const log = LoggingUtils.logger('iconMenu');


/**
 * Dash icon popup menu.
 */
const IconMenu = new Lang.Class({
	Name: 'EmDash.IconMenu',
	Extends: AppDisplay.AppIconMenu,

	_init: function(source, simpleName, settings) {
		log('_init');
		this.parent(source);
		this._simpleName = simpleName;
		this._appMenu = null;
		this._mediaControlsMenu = null;
		this._settings = settings;

//		// See: https://github.com/GNOME/gnome-shell/blob/master/js/ui/panelMenu.js
//		let Main = imports.ui.main;
//		let St = imports.gi.St;
//		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
//		let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
//		let verticalMargins = this.actor.margin_top + this.actor.margin_bottom;
//		let maxHeight = Math.round((workArea.height - verticalMargins) / scaleFactor);
//		this.box.style = ('max-height: %spx;').format(50);
	},

	/**
	 * Override.
	 */
	destroy: function() {
		log('destroy');
		if (this._appMenu !== null) {
			this._appMenu.destroy();
		}
		if (this._mediaControlsMenu !== null) {
			this._mediaControlsMenu.destroy();
		}
		this.parent();
	},

	/**
	 * Override.
	 */
	_redisplay: function() {
		log('_redisplay');

		if (this._appMenu !== null) {
			this._appMenu.destroy();
			this._appMenu = null;
		}
		if (this._mediaControlsMenu !== null) {
			this._mediaControlsMenu.destroy();
			this._mediaControlsMenu = null;
		}

		this.parent();

		// Application menu
		if (this._settings.get_boolean('menu-application')) {
			let menuModel = this._source.app.menu; // Gio.DBusMenuModel
			let actionGroup = this._source.app.action_group;
			if ((menuModel !== null) && (actionGroup !== null)) {
				this._appMenu = new AppMenu(actionGroup, menuModel);
				this.addMenuItem(this._appMenu.item);
			}
		}

		// Media controls
		if (this._settings.get_boolean('menu-media-controls') && (this._simpleName !== null)) {
			this._mediaControlsMenu = new MediaControlsMenu(this._simpleName);
			this.addMenuItem(this._mediaControlsMenu.item);
		}
	}
});


/**
 * Base class for containers that use Shell.MenuTracker to insert and remove items.
 */
const TrackingContainer = new Lang.Class({
	Name: 'EmDash.TrackingContainer',

	_init: function() {
		this._menu = null;
		this._menuTracker = null;
		this._items = [];
		this._startPosition = 0;
		this._signalManager = new SignalUtils.SignalManager(this);
	},

	destroy: function() {
		this._signalManager.destroy();
		if (this._menuTracker !== null) {
			this._menuTracker.destroy();
		}
		for (let i = 0; i < this._items.length; i++) {
			let item = this._items[i];
			item.destroy();
		}
		this.item.destroy();
	},

	_track: function(menu, actionGroup, itemModel) {
		this._menu = menu;
		this._menuTracker = Shell.MenuTracker.new(actionGroup, itemModel, null,
			this._onInsertItem.bind(this, this),
			this._onRemoveItem.bind(this, this));
	},

	_trackSubmenu: function(menu, trackerItem) {
		this._menu = menu;
		this._menuTracker = Shell.MenuTracker.new_for_item_submenu(trackerItem,
			this._onInsertItem.bind(this, this),
			this._onRemoveItem.bind(this, this));
	},

	_onInsertItem: function(menu, trackerItem, position) {
		log(`menu tracker insert item: ${position} "${trackerItem.label||''}"`);

		let submenu = this.item instanceof PopupSubMenuMenuItem;

		if (!submenu && (this._startPosition == 0)) {
			// Add a separator before the first item
			let item = new PopupMenu.PopupSeparatorMenuItem();
			this._items.push(item);
			this._menu.addMenuItem(item);
			alwaysShowMenuSeparator(this._signalManager, this._menu, item);
			this._startPosition = 1;
		}

		if (trackerItem.is_separator) {
			let item = new PopupMenu.PopupSeparatorMenuItem(stripMnemonics(trackerItem.label));
			this._items.push(item);
			this._menu.addMenuItem(item, this._startPosition + position);
		}
		else {
			let item = new AppMenuItem(trackerItem);
			this._items.push(item);
			this._menu.addMenuItem(item.item, this._startPosition + position);
		}

		if (submenu) {
			// We need at least one item to show the submenu
			this.item.setSubmenuShown(true);
		}
	},

	_onRemoveItem: function(menu, position) {
		log(`menu tracker remove item: ${position}`);
		let items = this._menu._getMenuItems();
		items[position].destroy();
	}
});


/**
 * Application menu section.
 */
const AppMenu = new Lang.Class({
	Name: 'EmDash.AppMenu',
	Extends: TrackingContainer,

	_init: function(actionGroup, menuModel, trackerItem = null) {
		this.parent();
		this.item = new PopupMenu.PopupMenuSection();
		this._track(this.item, actionGroup, menuModel);
//		this.item = new PopupMenu.PopupSubMenuMenuItem('Application Menu');
//		this._track(this.item.menu, actionGroup, menuModel);
	}
});


/**
 * Manages the relationship between an application menu item and a tracker item.
 */
const AppMenuItem = new Lang.Class({
	Name: 'EmDash.AppMenuItem',
	Extends: TrackingContainer, // we only need the base class functionality for has_submenu

	_init: function(trackerItem) {
		this.parent();
		this._trackerItem = trackerItem;

		let label = stripMnemonics(trackerItem.label);
		if (trackerItem.has_submenu) {
			this.item = new PopupSubMenuMenuItem(label);
			this._signalManager.connect(this.item, 'open', this._onOpen, true);
			this._signalManager.connectProperty(trackerItem, 'submenu-shown',
				this._onSubmenuShownChanged);
		}
		else {
			this.item = new PopupMenu.PopupMenuItem(label);
			this._signalManager.connect(this.item, 'activate', this._onActivated);
			this._signalManager.connectProperty(trackerItem, 'role', this._onRoleChanged);
			this._signalManager.connectProperty(trackerItem, 'toggled', this._onToggledChanged);
			this._refreshRole(trackerItem.role);
		}
		this._signalManager.connectProperty(trackerItem, 'label', this._onLabelChanged);
		this._signalManager.connectProperty(trackerItem, 'sensitive', this._onSensitiveChanged);
		this.item.setSensitive(trackerItem.sensitive);
		trackerItem.bind_property('visible', this.item.actor, 'visible',
			GObject.BindingFlags.SYNC_CREATE);
	},

	destroy: function() {
		this.parent();
		this._trackerItem.run_dispose();
	},

	_refreshRole: function(role) {
		switch (role) {
		case ShellMenu.MenuTrackerItemRole.NORMAL:
			this.item.actor.accessible_role = Atk.Role.MENU_ITEM;
			this.item.setOrnament(PopupMenu.Ornament.NONE);
			break;
		case ShellMenu.MenuTrackerItemRole.RADIO:
			this.item.actor.accessible_role = Atk.Role.RADIO_MENU_ITEM;
			this.item.setOrnament(this._trackerItem.toggled ?
				PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
			break;
		case ShellMenu.MenuTrackerItemRole.CHECK:
			this.item.actor.accessible_role = Atk.Role.CHECK_MENU_ITEM;
			this.item.setOrnament(this._trackerItem.toggled ?
				PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
			break;
		}
	},

	_onOpen: function(item) {
		log(`menu item "${this.item.label.text||''}" "open" signal`);
		this._trackSubmenu(this.item.menu, this._trackerItem);
	},

	_onActivated: function(menuItem) {
		log(`menu item "${this.item.label.text||''}" "activate" signal`);
		this._trackerItem.activated();
	},

	_onLabelChanged: function(trackerItem, label) {
		log(`tracker item "${this.item.label.text||''}" "label" property changed signal: ${label}`);
		this.item.label.text = stripMnemonics(label);
	},

	_onSubmenuShownChanged: function(trackerItem, submenuShown) {
		log(`tracker item "${this.item.label.text||''}" "submenu-shown" property changed signal: ${submenuShown}`);
		this.item.setSubmenuShown(submenuShown);
	},

	_onSensitiveChanged: function(trackerItem, sensitive) {
		log(`tracker item "${this.item.label.text||''}" "sensitive" property changed signal: ${sensitive}`);
		this.item.setSensitive(sensitive);
	},

	_onRoleChanged: function(trackerItem, role) {
		log(`tracker item "${this.item.label.text||''}" "role" property changed signal: ${role}`);
		this._refreshRole(role);
	},

	_onToggledChanged: function(trackerItem, toggled) {
		log(`tracker item "${this.item.label.text||''}" "toggled" property changed signal: ${toggled}`);
		this._refreshRole(trackerItem.role);
	}
});



/**
 * Media controls menu section.
 */
const MediaControlsMenu = new Lang.Class({
	Name: 'EmDash.MediaControlsMenu',

	_init: function(simpleName) {
		this.item = new PopupMenu.PopupMenuSection();
		this._mpris = new MPRIS.MPRIS(simpleName);

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this._mpris, 'initialize', this._onInitialized);
	},

	destroy: function() {
		this._signalManager.destroy();
		this._mpris.destroy();
		this.item.destroy();
	},

	_onInitialized: function(mpris) {
		log('mpris "initialize" signal');

		this.item.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// Standard icon names:
		// https://specifications.freedesktop.org/icon-naming-spec/latest/ar01s04.html

		this._appendItem(_('Play'), 'media-playback-start', this._onPlay);
		if (this._mpris.canPause) {
			this._appendItem(_('Pause'), 'media-playback-pause', this._onPause);
		}
		this._appendItem(_('Stop'), 'media-playback-stop', this._onStop);
		if (this._mpris.canGoNext) {
			this._appendItem(_('Next track'), 'media-skip-forward', this._onNext);
		}
		if (this._mpris.canGoPrevious) {
			this._appendItem(_('Previous track'), 'media-skip-backward', this._onPrevious);
		}
	},

	_appendItem: function(labelText, iconName, callback) {
		log(`MediaControlsMenu._appendItem: ${labelText}`)
		let item = new PopupImageMenuItem(labelText, iconName);
		this.item.addMenuItem(item);
		this._signalManager.connect(item, 'activate', callback);
	},

	_onPlay: function() {
		log('play')
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
 * Popup sub-menu item, with support for an "open" signal.
 */
const PopupSubMenuMenuItem = new Lang.Class({
	Name: 'EmDash.PopupSubMenuMenuItem',
	Extends: PopupMenu.PopupSubMenuMenuItem,

	_setOpenState: function(open) {
		this.parent(open);
		this.emit('open');
	}

});


/**
 * Popup menu item with an icon.
 *
 * The original version puts the icon after the label, which looks weird. Our version flips the
 * order.
 *
 * See: https://github.com/GNOME/gnome-shell/blob/master/js/ui/popupMenu.js
 */
const PopupImageMenuItem = new Lang.Class({
	Name: 'EmDash.PopupImageMenuItem',
	Extends: PopupMenu.PopupImageMenuItem,

	_init: function(text, iconName, params) {
		this.parent(text, iconName, params);
		this.actor.remove_child(this._icon);
		this.actor.remove_child(this.label);
		this.actor.add_child(this._icon);
		this.actor.add_child(this.label);
	}
});


/**
 * See: https://github.com/GNOME/gnome-shell/blob/js/ui/remoteMenu.js
 */
function stripMnemonics(label) {
	// Remove all underscores that are not followed by another underscore
	if (label === null) {
		return null;
	}
	return label.replace(/_([^_])/, '$1');
}



/**
 * PopupMenuBase tries to be smart about automatically hiding separators when their neighbors aren't
 * visible, but it's buggy for our uses, so we'll override that mechanism.
 */
function alwaysShowMenuSeparator(signalManager, menu, item) {
	signalManager.connect(menu, 'open-state-changed', (menu) => {
		log('forcing menu separator to be visible')
		item.actor.show();
	});
}