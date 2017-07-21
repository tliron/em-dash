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


const AppFavorites = imports.ui.appFavorites;


function isFavoriteApp(app) {
	let favorites = AppFavorites.getAppFavorites().getFavorites();
	return favorites.indexOf(app) != -1;
}


/**
 * The built-in favorites.moveFavoriteToPos is broken. It does does not decrement the new position
 * when necessary, nor does it verify that no change is needed, and annoyingly it emits two
 * "changed" signals for what should be a single change.
 */
function moveFavoriteToPos(appId, fromPos, toPos) {
	if (fromPos < toPos) {
		toPos--;
	}
	if (fromPos === toPos) {
		return;
	}

	let favorites = AppFavorites.getAppFavorites();
	delete favorites._favorites[appId];
	favorites._addFavorite(appId, toPos);
}


function getWorkspacesForApp(app) {
	let workspaceIndexes = [];

	let nWorkspaces = global.screen.n_workspaces;
	for (let workspaceIndex = 0; workspaceIndex < nWorkspaces; workspaceIndex++) {
		let workspace = global.screen.get_workspace_by_index(workspaceIndex);
		if (app.is_on_workspace(workspace)) {
			workspaceIndexes.push(workspaceIndex);
		}
	}

	return workspaceIndexes;
}

function isAppOnWorkspace(app, workspaceIndex) {
	let workspace = global.screen.get_workspace_by_index(workspaceIndex);
	return app.is_on_workspace(workspace);
}
