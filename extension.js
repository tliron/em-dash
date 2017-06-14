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
const Logging = Me.imports.utils.logging;
const Dash = Me.imports.dash;
const PanelDash = Me.imports.panelDash;
const DockableDash = Me.imports.dockableDash;

const log = Logging.logger('extension');

let settings = null;
let dashManager = null;


function init() {
	Convenience.initTranslations();
}


function enable() {
    settings = Convenience.getSettings();
    
    Me.LOGGING_ENABLED = settings.get_boolean('debug');
    Me.LOGGING_IMPLEMENTATION = global.log;

    log('enabling...');

	dashManager = new Dash.DashManager(settings, {
		PANEL_NEAR: PanelDash.PanelDash,
		PANEL_MIDDLE: PanelDash.PanelDash,
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
