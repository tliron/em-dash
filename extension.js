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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Utils = Me.imports.utils;
const Entries = Me.imports.entries;
const PanelDash = Me.imports.panelDash;
const DockableDash = Me.imports.dockableDash;


let settings;
let entryManager;
let panelDash;
let dockableDash;


function init() {
	Utils.DEBUG = true;
	Utils.log('init');
	Convenience.initTranslations();
}


function enable() {
	Utils.log('enabling...');
    settings = Convenience.getSettings();
	entryManager = new Entries.EntryManager(settings);
	panelDash = new PanelDash.PanelDash(settings, entryManager);
	dockableDash = new DockableDash.DockableDash(settings, entryManager);
	Utils.log('enabled');
}


function disable() {
	Utils.log('disabling...');
	panelDash.destroy();
	panelDash = null;
	dockableDash.destroy();
	dockableDash = null;
	entryManager.destroy();
	entryManager = null;
	settings.run_dispose();
	settings = null;
	Utils.log('disabled');
}
