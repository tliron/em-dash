/*
 * This file is part of the Em-Dash extension for GNOME Shell.
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
const ExtensionUtils = Me.imports.utils.extension;
const LoggingUtils = Me.imports.utils.logging;
const DashManager = Me.imports.dashes.dashManager;
const TopBarDash = Me.imports.dashes.topBarDash;
const DockableDash = Me.imports.dashes.dockableDash;

const log = LoggingUtils.logger('extension');

var settings = null;
var dashManager = null;


function init() {
	ExtensionUtils.initTranslations();
}


function enable() {
    settings = ExtensionUtils.getSettings();

    Me.LOGGING_ENABLED = settings.get_boolean('debug');
    Me.LOGGING_IMPLEMENTATION = global.log;

    log('enabling...');

	dashManager = new DashManager.DashManager(settings, {
		TOP_BAR: TopBarDash.TopBarDash,
		EDGE_NEAR: DockableDash.DockableDash,
		EDGE_FAR: DockableDash.DockableDash,
		EDGE_BOTTOM: DockableDash.DockableDash
	});

	log('enabled');
}


function disable() {
	log('disabling...');

	dashManager.destroy();
	dashManager = null;
	settings.run_dispose();
	settings = null;

	log('disabled');
}
