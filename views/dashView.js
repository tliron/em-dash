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
const Tweener = imports.ui.tweener;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const SignalUtils = Me.imports.utils.signal;
const ClutterUtils = Me.imports.utils.clutter;
const IconView = Me.imports.views.iconView;
const ShowAppsIcon = Me.imports.views.showAppsIcon;

const log = LoggingUtils.logger('dashView');

const ANIMATION_TIME = 0.2;


/**
 * UI representation of a dash model.
 */
const DashView = new Lang.Class({
	Name: 'EmDash.DashView',

	_init: function(modelManager, scalingManager, styleClass, vertical, logicalIconSize, quantize) {
		log('_init');

		this.modelManager = modelManager;
		this.quantize = quantize;

		this._scalingManager = scalingManager;
		this._logicalIconSize = null;
		this._focused = null;
		this._firstIndex = 0;
		this._scrollTranslation = 0;

		// Actor: contains dash and arrow
		this.actor = new St.Widget({
			layout_manager: new Clutter.BinLayout()
		});

		// Icon box
		this.box = new St.BoxLayout({
			name: 'icon-box'
		});

		// Dash
		this.dash = new St.Bin({
			name: 'dash', // will use GNOME theme
			child: this.box,
			style_class: styleClass,
			x_expand: true,
			y_expand: true,
			clip_to_allocation: true
		});
		this.actor.add_child(this.dash);

		// Fader
		this._fader = new St.Widget({
			name: 'fader',
			visible: false
		});
		this.actor.add_child(this._fader);

		this._signalManager = new SignalUtils.SignalManager(this);
		this._signalManager.connect(this.actor, 'paint', () => {
			// We need to wait until we're painted in order to focus app (backlight highlighting
			// need theme information)
			log('"paint" signal');

			this.setVertical(vertical);
			this.setIconSize(logicalIconSize);

			let appSystem = Shell.AppSystem.get_default();
			let windowTracker = Shell.WindowTracker.get_default();
			this._signalManager.connectProperty(this.box, 'allocation',
				this._onBoxAllocationPropertyChanged);
			this._signalManager.connect(this._fader, 'enter-event', this._onFaderEnter);
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

	setIconSize: function(logicalIconSize) {
		if (this._logicalIconSize !== logicalIconSize) {
			this._logicalIconSize = logicalIconSize;
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
		let physicalActorSize = this._scalingManager.toPhysical(this._logicalIconSize);
		let physicalIconSize = physicalActorSize * 0.75;
		if (this.quantize) {
			physicalIconSize = this._scalingManager.getSafeIconSize(physicalIconSize);
		}
		let logicalIconSize = this._scalingManager.toLogical(physicalIconSize);
		log(`_refresh: actor=${physicalActorSize} icon=${physicalIconSize}`);

		this.box.set_translation(0, 0, 0);

		this.box.remove_all_children();
		for (let i = 0; i < dashModel.icons.length; i++) {
			let iconModel = dashModel.icons[i];
			let iconView = new IconView.IconView(this, iconModel, i);
			iconView.actor.height = physicalActorSize;
			iconView._fixedIconSize = logicalIconSize;
			this.box.add_child(iconView.actor);
		}

		let applicationsButton = this.modelManager.settings.get_string('applications-button');
		if (applicationsButton !== 'HIDE') {
			let showAppsIcon = new ShowAppsIcon.ShowAppsIcon(logicalIconSize);
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

		this._updateFader();
		this._updateFocusApp();
		this._updateWheelScrolling();
	},

	_updateClip: function() {
		// Clutter does not normally take into account translation when clipping
		let x = -this.box.translation_x;
		let y = -this.box.translation_y;
		let allocation = this.box.allocation;
		let width = allocation.x2 - allocation.x1;
		let height = allocation.y2 - allocation.y1;
		log(`_updateClip: x=${x} y=${y} w=${width} h=${height}`);
		this.box.clip_rect = ClutterUtils.newRect(x, y, width, height);
	},

	_updateFader: function() {
		this._updateClip();

		let desiredSize, actualSize;
		let allocation = this.box.allocation;
		if (this.box.vertical) {
			desiredSize = ClutterUtils.getMiniumHeight(this.box);
			actualSize = allocation.y2 - allocation.y1;
		}
		else {
			desiredSize = ClutterUtils.getMinimumWidth(this.box);
			actualSize = allocation.x2 - allocation.x1;
		}
		log(`_updateFader: desired=${desiredSize} actual=${actualSize}`);
		let delta = desiredSize - actualSize;

		if (delta > 0) {
			// Size
			let physicalIconSize = this._scalingManager.toPhysical(this._logicalIconSize);
			let size = physicalIconSize * 2; // looks nice

			// Gradient
			let themeNode = this.dash.get_theme_node();
			let start = themeNode.get_background_color();
			start.alpha = 0;
			let end = new Clutter.Color({
				red: start.red / 2,
				green: start.green / 2,
				blue: start.blue / 2,
				alpha: 1
			});

			if (this.box.vertical) {
				this._fader.set_size(allocation.x2 - allocation.x1, size);
				if (this.box.translation_y < 0) {
					// Top
					log('_updateFader: top');
					this._scrollTranslation = 0;
					this._fader.set_position(allocation.x1, allocation.y1);
					this._fader.style = `
background-gradient-direction: vertical;
background-gradient-start: rgba(${end.red}, ${end.green}, ${end.blue}, ${end.alpha});
background-gradient-end: rgba(${start.red}, ${start.green}, ${start.blue}, ${start.alpha});`;
				}
				else {
					// Bottom
					log('_updateFader: bottom');
					this._scrollTranslation = -delta;
					this._fader.set_position(allocation.x1, allocation.y2 - size);
					this._fader.style = `
background-gradient-direction: vertical;
background-gradient-start: rgba(${start.red}, ${start.green}, ${start.blue}, ${start.alpha});
background-gradient-end: rgba(${end.red}, ${end.green}, ${end.blue}, ${end.alpha});`;
				}
			}
			else {
				this._fader.set_size(size, allocation.y2 - allocation.y1);
				if (this.box.translation_x < 0) {
					// Left
					log('_updateFader: left');
					this._scrollTranslation = 0;
					this._fader.set_position(allocation.x1, allocation.y1);
					this._fader.style = `
background-gradient-direction: horizontal;
background-gradient-start: rgba(${end.red}, ${end.green}, ${end.blue}, ${end.alpha});
background-gradient-end: rgba(${start.red}, ${start.green}, ${start.blue}, ${start.alpha});`;
				}
				else {
					// Right
					log('_updateFader: right');
					this._scrollTranslation = -delta;
					this._fader.set_position(allocation.x2 - size, allocation.y1);
					this._fader.style = `
background-gradient-direction: horizontal;
background-gradient-start: rgba(${start.red}, ${start.green}, ${start.blue}, ${start.alpha});
background-gradient-end: rgba(${end.red}, ${end.green}, ${end.blue}, ${end.alpha});`;
				}
			}

			//this._fader.style = 'background-color: red;';
			this._fader.reactive = true;
			this._fader.show();
		}
		else {
			log('_updateFader: hide');
			this._fader.hide();
			this._scrollTranslation = 0;
			this._scroll();
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

	_scroll: function(callback = null) {
		let tween = {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad',
			onUpdate: () => {
				this._updateClip();
			},
			onComplete: callback
		};
		if (this.box.vertical) {
			tween.translation_y = this._scrollTranslation;
		}
		else {
			tween.translation_x = this._scrollTranslation;
		}
		Tweener.addTween(this.box, tween);
	},

	_onBoxAllocationPropertyChanged: function(actor, allocation) {
		log('box "allocation" property changed signal');
		this._updateFader();
	},

	_onFaderEnter: function(actor, crossingEvent) {
		log('fader "enter-event" signal');
		this._fader.reactive = false;
		this._scroll(() => {
			this._updateFader();
		});
		return true;
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
