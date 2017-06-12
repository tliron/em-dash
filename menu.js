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
const AppDisplay = imports.ui.appDisplay;
const PopupMenu = imports.ui.popupMenu;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const MPRIS = Me.imports.mpris;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const N_ = (e) => { return e };

const log = Utils.logger('menu');


/**
 * Dash icon popup menu.
 */
const IconMenu = new Lang.Class({
	Name: 'EmDash.IconMenu',
	Extends: AppDisplay.AppIconMenu,
	
	_init: function(source, mpris) {
		log('init');
		this.parent(source);
		this._mpris = null;
		this._settings = this._source._icons._entryManager._settings;
		this._signalManager = new Utils.SignalManager(this);
	},
	
	/**
	 * Override.
	 */
	destroy: function() {
		log('destroy');
		this._destroyMpris();
		this._signalManager.destroy();
		this.parent();
	},
	
	/**
	 * Override.
	 */
	_redisplay: function() {
		this.parent();
		
		// MPRIS?
		this._destroyMpris();
		if (this._settings.get_boolean('media-controls')) {
			let simpleName = this._source._simpleName;
			if (simpleName !== null) {
				this._mpris = new MPRIS.MPRIS(simpleName);
				this._signalManager.connect(this._mpris, 'initialize', this._onMprisInitialized);
			}
		}
	},
	
	_appendMediaControls: function() {
		this._appendSeparator();
		
		// Standard icon names:
		// https://specifications.freedesktop.org/icon-naming-spec/latest/ar01s04.html

		this._appendImageMenuItem(_('Play'), 'media-playback-start', this._onPlay);
		if (this._mpris.canPause) {
			this._appendImageMenuItem(_('Pause'), 'media-playback-pause', this._onPause);
		}
		this._appendImageMenuItem(_('Stop'), 'media-playback-stop', this._onStop);
		if (this._mpris.canGoNext) {
			this._appendImageMenuItem(_('Next track'), 'media-skip-forward', this._onNext);
		}
		if (this._mpris.canGoPrevious) {
			this._appendImageMenuItem(_('Previous track'), 'media-skip-backward', this._onPrevious);
		}
	},
	
	_appendImageMenuItem: function(labelText, iconName, callback) {
		let item = new PopupImageMenuItem(labelText, iconName);
		this.addMenuItem(item);
		this._signalManager.connect(item, 'activate', callback);
		return item;
	},
	
	_destroyMpris: function() {
		if (this._mpris !== null) {
			this._signalManager.disconnect(this._onMprisInitialized);
			this._mpris.destroy();
			this._mpris = null;
		}
	},
	
	_onMprisInitialized: function(mpris) {
		log('mpris-initialized');
		this._appendMediaControls();
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
