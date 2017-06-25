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
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const IconView = Me.imports.views.iconView;

const log = LoggingUtils.logger('dashView');


/**
 * UI representation of a dash model.
 */
const DashView = new Lang.Class({
	Name: 'EmDash.DashView',

	_init: function(modelManager, scalingManager, styleClass, vertical, iconSize, quantize) {
		log('_init');

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

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this.actor, 'paint', () => {
			// We need to wait until we're painted in order to focus app (backlight highlighting)
			log('"paint" signal');

			this.setVertical(vertical);
			this.setSize(iconSize);

			let appSystem = Shell.AppSystem.get_default();
			let windowTracker = Shell.WindowTracker.get_default();
			this._signalManager.connect(this.modelManager, 'changed', this._onDashModelChanged);
			this._signalManager.connect(appSystem, 'installed-changed',
				this._onInstalledChanged);
			this._signalManager.connect(global.screen, 'workspace-switched',
				this._onWorkspaceSwitched);
			this._signalManager.connectProperty(windowTracker, 'focus-app',
				this._onFocusAppChanged);
			this._signalManager.connectSetting(this.modelManager.settings,
				'icons-highlight-focused', 'boolean', this._onIconsHighlightFocusedSettingChanged);
			this._signalManager.connectSetting(this.modelManager.settings,
				'icons-highlight-focused-gradient', 'boolean',
				this._onIconsHighlightFocusedGradientSettingChanged);
		}, true);
	},

	destroy: function() {
		log('destroy');
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
		log(`_refresh: actor=${physicalActorSize} icon=${physicalIconSize}`);
		for (let i = 0; i < dashModel.icons.length; i++) {
			let iconModel = dashModel.icons[i];
			let iconView = new IconView.IconView(this, iconModel, i);
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
					let iconView = this.getIconViewAt(index);
					if (iconView !== null) {
						if (this._focused !== iconView) {
							this._removeFocusApp();
							this._focused = iconView;
							this._focused.focus();
						}
						return;
					}
				}
			}
		}
		this._removeFocusApp();
	},

	_removeFocusApp: function() {
		if (this._focused !== null) {
			this._focused.unfocus();
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
	},

	_onIconsHighlightFocusedGradientSettingChanged: function(settings,
		iconsHighlightFocusedGradient) {
		log(`"icons-highlight-focused-gradient" setting changed signal: ${iconsHighlightFocusedGradient}`);
		if (this._focused !== null) {
			this._focused.unfocus();
			this._focused.focus();
		}
	},
});
