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
const St = imports.gi.St;

const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const PatchUtils = Me.imports.utils.patch;
const ClutterUtils = Me.imports.utils.clutter;
const StUtils = Me.imports.utils.st;
const Dash = Me.imports.dashes.dash;

const log = LoggingUtils.logger('panelDash');


/**
 * Dash implementation on the GNOME Shell panel.
 */
const TopBarDash = new Lang.Class({
	Name: 'EmDash.TopBarDash',
	Extends: Dash.Dash,

	_init: function(dashManager, location) {
		log('_init');

    	this.parent(dashManager, 'panel', false,
    		dashManager.scalingManager.toLogical(Main.panel.actor.height), false);

    	this._view.dash.x_align = St.Align.START;
    	this._view.dash.set_x_align(Clutter.ActorAlign.START);
		this.bin = new StUtils.FlexBin({
			child: this._view.actor,
			preferred_width: Main.panel.actor.width
			// (the actual width of the bin would shrink to fit in the leftbox)
		});

		this._moveCenter = false;

		// We cannot patch Main.panel._allocate, but we can patch the children's allocates
		this._patchManager = new PatchUtils.PatchManager(this);
		this._patchManager.patch(Main.panel._leftBox, 'allocate', this._leftBoxAllocate);
		this._patchManager.patch(Main.panel._centerBox, 'allocate', this._centerBoxAllocate);
		this._patchManager.patch(Main.panel._rightBox, 'allocate', this._rightBoxAllocate);

		this._signalManager.connectSetting(dashManager.settings, 'top-bar-appearance-merge',
			'boolean', this._onTopBarAppearanceMergeSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'top-bar-move-center',
			'boolean', this._onTopBarMoveCenterSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'top-bar-custom-height', 'boolean',
			this._onTopBarCustomHeightSettingChanged);
		this._signalManager.connectSetting(dashManager.settings, 'top-bar-height', 'uint',
			this._onTopBarHeightSettingChanged);
		this._signalManager.connect(dashManager.scalingManager, 'changed', this._onScalingChanged);
		this._signalManager.connectProperty(Main.panel.actor, 'width', this._onPanelWidthChanged);
		this._signalManager.connectProperty(Main.panel.actor, 'height', this._onPanelHeightChanged);

    	this.setLocation(location);
	},

	destroy: function() {
		log('destroy');
		this.parent();
		this.bin.destroy();
		this._patchManager.destroy();
		Main.panel.actor.set_height(-1);
	},

	setLocation: function(location) {
		// Note: in RTL, the poorly named "_leftBox" actually appears on the right :)
		switch (location) {
		case 'TOP_BAR':
			if (!Main.panel._leftBox.contains(this.bin)) {
				Main.panel._leftBox.add_child(this.bin);
			}
			break;
		}
	},

	_leftBoxAllocate: function(original, childBox, flags) {
		if (!this._moveCenter) {
			original(childBox, flags);
		}
		// else we will postpone until _rightBoxAllocate
	},

	_centerBoxAllocate: function(original, childBox, flags) {
		if (!this._moveCenter) {
			original(childBox, flags);
		}
		// else we will postpone until _rightBoxAllocate
	},

	_rightBoxAllocate: function(original, childBox, flags) {
		original(childBox, flags);

		// TODO: rtl?
		if (this._moveCenter) {
			// OK, now we can finally allocate the other oxes the way we want them

			let centerWidth = ClutterUtils.getNaturalWidth(Main.panel._centerBox);
			let actorBox = new Clutter.ActorBox();

			// Left box extends to left edge of center box
			actorBox.x1 = 0;
			actorBox.x2 = childBox.x1 - centerWidth;
			actorBox.y1 = childBox.y1;
			actorBox.y2 = childBox.y2;
			this._patchManager.callOriginal(Main.panel._leftBox, 'allocate', actorBox, flags);

			// Center box pushed all the way to right box
			actorBox.x1 = actorBox.x2;
			actorBox.x2 = childBox.x1;
			actorBox.y1 = childBox.y1;
			actorBox.y2 = childBox.y2;
			this._patchManager.callOriginal(Main.panel._centerBox, 'allocate', actorBox, flags);
		}
	},

	_updateStyle: function(appearanceMerge) {
		if (appearanceMerge) {
			this._view.dash.add_style_class_name('merge');
		}
		else {
			this._view.dash.remove_style_class_name('merge');
		}
	},

	_updatePanelHeight: function() {
		if (this._dashManager.settings.get_boolean('top-bar-custom-height')) {
			Main.panel.actor.height = this._dashManager.scalingManager.toPhysical(
				this._dashManager.settings.get_uint('top-bar-height'));
		}
		else {
			Main.panel.actor.set_height(-1);
		}
	},

	_onTopBarAppearanceMergeSettingChanged: function(settings, appearanceMerge) {
		log(`"top-bar-appearance-merge" setting changed signal: ${appearanceMerge}`);
		this._updateStyle(appearanceMerge);
	},

	_onTopBarMoveCenterSettingChanged: function(settings, moveCenter) {
		log(`"top-bar-move-center" setting changed signal: ${moveCenter}`);
		this._moveCenter = moveCenter;
		Main.panel.actor.queue_relayout();
	},

	_onTopBarCustomHeightSettingChanged: function(settings, customHeight) {
		log(`"top-bar-custom-height" setting changed signal: ${customHeight}`);
		this._updatePanelHeight();
	},

	_onTopBarHeightSettingChanged: function(settings, height) {
		log(`"top-bar-height" setting changed signal: ${height}`);
		this._updatePanelHeight();
	},

	_onScalingChanged: function(scaling, factor) {
		log(`scaling "changed" signal: ${factor}`);
		this._updatePanelHeight();
	},

	_onPanelWidthChanged: function(actor, width) {
		log(`panel "width" property changed signal: ${width}`);
		this.bin.preferred_width = width;
		// (the actual width of the bin would shrink to fit in the leftbox)
	},

	_onPanelHeightChanged: function(actor, height) {
		log(`panel "height" property changed signal: ${height}`);
		this._view.setIconSize(this._dashManager.scalingManager.toLogical(height));
	}
});
