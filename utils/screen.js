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

// GNOME 3.30 has removed "global.screen"

const Meta = imports.gi.Meta;


var displayManager = global.screen || global.display;

var display = global.screen ? global.screen.get_display() : global.display;

var workspaceManager = global.screen || global.workspace_manager;

var monitorManager = global.screen || Meta.MonitorManager.get();
