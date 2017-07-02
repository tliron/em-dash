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
const AppFavorites = imports.ui.appFavorites;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const ClutterUtils = Me.imports.utils.clutter;
const AppUtils = Me.imports.utils.app;

const log = LoggingUtils.logger('dropPlaceholder');

const ANIMATION_TIME = 0.1;

let selfDrop = false;


/**
 * Drop hovering placeholder singleton.
 */
const DropPlaceholder = new Lang.Class({
	Name: 'EmDash.DropPlaceholder',

	_init: function(actor, after) {
		seflDrop = false;

		this.nextActor = null;
		this.nextAfter = null;

		this._iconView = actor._delegate;
		this._after = after;
		this._destroying = false;
		log(`_init: ${this._iconView.app.id}${after?' after':''}`);

		let vertical = this._iconView.dashView.box.vertical;

		this.actor = new St.Widget({
			name: 'em-dash-placeholder',
			width: vertical ? actor.width : 0,
			height: vertical ? 0 : actor.height,
			style_class: 'placeholder' // GNOME theme styling
		});
		this.actor._delegate = this; // hook for DND

		// Before or after actor?
		let container = this._iconView.dashView.box;
		let index = ClutterUtils.getActorIndexOfChild(container, actor);
		if (after) {
			this._neighbor = container.get_child_at_index(index + 1);
			this.modelIndex = this._iconView.modelIndex + 1;
			container.insert_child_at_index(this.actor, index + 1);
		}
		else {
			this._neighbor = actor;
			this.modelIndex = this._iconView.modelIndex;
			container.insert_child_at_index(this.actor, index);
		}

		// Appear
		let tween = {
			time: ANIMATION_TIME,
			transition: 'easeOutQuad'
		};
		if (vertical) {
			tween.height = actor.height;
		}
		else {
			tween.width = actor.width;
		}
		Tweener.addTween(this.actor, tween);
	},

	destroy: function(immediate = false) {
		if (this._destroying) {
			return;
		}

		this._destroying = true;

		log(`destroying: ${immediate?'immediate':'animated'}`);

		// Dissolve
		let vertical = this._iconView.dashView.box.vertical;
		let tween = {
			time: immediate ? 0 : ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: () => {
				this.actor.destroy();
				log('destroyed');
				nextDropPlaceholder(this.nextActor, this.nextAfter);
			}
		};
		if (vertical) {
			tween.height = 0;
		}
		else {
			tween.width = 0;
		}
		Tweener.addTween(this.actor, tween);
	},

	isFor: function(actor, after) {
		return (this._iconView.actor === actor) && (this._after === after);
	},

	// Dropping on us

	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		let appId = source.app.id;
		if ((source.modelIndex === this.modelIndex) ||
			(source.modelIndex === this.modelIndex - 1)) {
			log(`acceptDrop hook: ${appId} on self`);
			selfDrop = true;
		}
		else if (!('modelIndex' in source)) {
			// Dragged from elsewhere (likely the overview)
			log(`acceptDrop hook: ${appId} from elsewhere to ${this.modelIndex}`);
			let favorites = AppFavorites.getAppFavorites();
			favorites.addFavoriteAtPos(appId, this.modelIndex);
			selfDrop = false;
		}
		else {
			// Moved within the dash
			log(`acceptDrop hook: ${appId} from ${source.modelIndex} to ${this.modelIndex}`);
			AppUtils.moveFavoriteToPos(appId, source.modelIndex, this.modelIndex);
			selfDrop = false;
		}
		removeDropPlaceholder(); // this destroys us!
		return true;
	}
});

let _dropPlaceholder = null;
let _dragMonitor = {
	dragMotion: _onDragMotion
};


function addDropPlaceholder(actor, after) {
	if (_dropPlaceholder === null) {
		_dropPlaceholder = new DropPlaceholder(actor, after);
		DND.addDragMonitor(_dragMonitor);
	}
	else {
		_dropPlaceholder.nextActor = actor;
		_dropPlaceholder.nextAfter = after;
		_dropPlaceholder.destroy();
	}
}


function removeDropPlaceholder() {
	if (_dropPlaceholder !== null) {
		_dropPlaceholder.nextActor = null;
		_dropPlaceholder.nextAfter = null;
		_dropPlaceholder.destroy(selfDrop);
	}
}


function nextDropPlaceholder(nextActor, nextAfter) {
	if ((nextActor !== null) && (nextAfter !== null)) {
		// The old switcheroo
		_dropPlaceholder = new DropPlaceholder(nextActor, nextAfter);
		selfDrop = false;
	}
	else {
		DND.removeDragMonitor(_dragMonitor);
		_dropPlaceholder = null;
	}
}


function _onDragMotion(dragEvent) {
	if (_dropPlaceholder !== null) {
		// Remove placeholder if we've moved out of the dash view box
		if (!isDescendent(dragEvent.targetActor, _dropPlaceholder._iconView.dashView.box)) {
			//log('dragMotion monitor hook: not in our area');
			removeDropPlaceholder();
		}
	}
	return DND.DragMotionResult.CONTINUE;
}



/*
 * Utils
 */

function isDescendent(actor, ancestor) {
	for (; actor !== null; actor = actor.get_parent()) {
		if (actor === ancestor) {
			return true;
		}
	}
	return false;
}
