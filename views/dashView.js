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
const Dash = imports.ui.dash;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;
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
		this._firstIndex = 0;

		// Box
		this.box = new St.BoxLayout({
			name: 'em-dash-view-box',
			clip_to_allocation: true
		});

		// Arrow
		this._arrow = new St.Widget({
			name: 'em-dash-arrow',
			visible: false
		});

		// Actor
		this.actor = new St.Widget({
			name: 'dash', // will use GNOME theme
			style_class: styleClass,
			layout_manager: new Clutter.BinLayout()
		});
		this.actor.add_child(this.box);
		this.actor.add_child(this._arrow);

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this.actor, 'paint', () => {
			// We need to wait until we're painted in order to focus app (backlight highlighting
			// need theme information)
			log('"paint" signal');

			this.setVertical(vertical);
			this.setSize(iconSize);

			let appSystem = Shell.AppSystem.get_default();
			let windowTracker = Shell.WindowTracker.get_default();
			this._signalManager.connectProperty(this.box, 'allocation',
				this._onBoxAllocationPropertyChanged);
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
			this._signalManager.connectSetting(this.modelManager.settings,
				'applications-button', 'string', this._onApplicationsButtonSettingChanged);
			this._signalManager.connectSetting(this.modelManager.settings, 'icons-wheel-scroll',
				'boolean', this._onIconsWheelScrollSettingChanged);
		}, true);
	},

	destroy: function() {
		log('destroy');
		this._signalManager.destroy();
		this.actor.destroy();
	},

	getIconViewAt: function(index) {
		let actor = this.box.get_child_at_index(this._firstIndex + index);
		if (actor !== null) {
			let delegate = actor._delegate;
			if (delegate instanceof IconView.IconView) {
				return delegate;
			}
		}
		return null;
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

		let applicationsButton = this.modelManager.settings.get_string('applications-button');
		if (applicationsButton !== 'HIDE') {
			let showAppsIcon = new ShowAppsIcon(physicalIconSize);
			if (applicationsButton === 'FAR') {
				this.box.add_child(showAppsIcon);
				this._firstIndex = 0;
			}
			else { // NEAR
				this.box.insert_child_at_index(showAppsIcon, 0);
				this._firstIndex = 1;
			}
		}
		else {
			this._firstIndex = 0;
		}

		this._updateFocusApp();
		this._updateWheelScrolling();
	},

	_updateArrow: function() {
		let desiredHeight = ClutterUtils.getMiniumHeight(this.box);
		let actualHeight = this.box.height;
		if (desiredHeight > actualHeight) {
			log('!!!!!!!! doesn\'t fit');
			let padding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
			let x = this.actor.width / 2;
			let y = this.box.allocation.y2 - padding - 20;
			this._arrow.move_anchor_point_from_gravity(Clutter.Gravity.SOUTH);
			this._arrow.set_position(x, y);
			this._arrow.show();
		}
		else {
			log('!!!!!!!! fits');
			this._arrow.hide();
		}
	},

	_updateWheelScrolling: function(iconsWheelScroll) {
		if (iconsWheelScroll === undefined) {
			iconsWheelScroll = this.modelManager.settings.get_boolean('icons-wheel-scroll');
		}
		let nChildren = this.box.get_n_children();
		for (let i = 0; i < nChildren; i++) {
			let iconView = this.getIconViewAt(i);
			if (iconView !== null) {
				if (iconsWheelScroll) {
					iconView.enableWheelScrolling();
				}
				else {
					iconView.disableWheelScrolling();
				}
			}
		}
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

	_onBoxAllocationPropertyChanged: function(actor, allocation) {
		log('box "allocation" property changed signal');
		this._updateArrow();
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

	_onApplicationsButtonSettingChanged: function(settings, applicationsButton) {
		log(`"applications-button" setting changed signal: ${applicationsButton}`);
		this.refresh();
	},

	_onIconsWheelScrollSettingChanged: function(settings, iconsWheelScroll) {
		log(`"icons-wheel-scroll" setting changed signal: ${iconsWheelScroll}`);
		this._updateWheelScrolling(iconsWheelScroll);
	}
});


/**
 * Our version of ShowAppsIcon will activate/deactivate the overview.
 *
 * Note that this is a GObject class!
 */
const ShowAppsIcon = new Lang.Class({
	Name: 'EmDash-ShowAppsIcon', // can't use "." with GObject classes
	Extends: Dash.ShowAppsIcon,

	_init: function(iconSize) {
		this.parent();

		this.childScale = 1;
		this.childOpacity = 255;
		this.icon.setIconSize(iconSize);

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connectProperty(this.toggleButton, 'checked',
			this._onButtonCheckedChanged);

		this.child.add_style_class_name('show-apps-em-dash');
	},

	destroy: function() {
		this._signalManager.destroy();
		this.parent();
	},

	_onButtonCheckedChanged: function(button, checked) {
		log(`ShowAppsIcon "checked" property changed signal: ${checked}`);
		Main.overview.viewSelector._showAppsButton.checked = checked;
		if (checked) {
			Main.overview.show();
		}
		else {
			Main.overview.hide();
		}
	}
});
