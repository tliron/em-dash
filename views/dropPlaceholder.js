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


/**
 * Drop hovering placeholder singleton.
 */
const DropPlaceholder = new Lang.Class({
	Name: 'EmDash.DropPlaceholder',

	_init: function(actor, after) {
		this._iconView = actor._delegate;
		this._after = after;
		log(`_init: ${this._iconView.app.id}${after?' after':''}`);

		this._dropped = false;

		this.destroying = false;
		this.nextActor = null;
		this.nextAfter = null;

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
		let index = ClutterUtils.getIndexOfChild(container, actor);
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

		this._dragMonitor = {
			dragMotion: Lang.bind(this, this._onDragMotion)
		};
		DND.addDragMonitor(this._dragMonitor);

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

	destroy: function() {
		if (this.destroying) {
			return;
		}
		this.destroying = true;

		log(`destroying: ${this._dropped?'immediate':'animated'}`);

		DND.removeDragMonitor(this._dragMonitor);

		// Dissolve
		let vertical = this._iconView.dashView.box.vertical;
		let tween = {
			time: this._dropped ? 0 : ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: () => {
				log('destroyed');
				this.actor.destroy();

				if ((this.nextActor !== null) && (this.nextAfter !== null)) {
					// The old switcheroo
					_dropPlaceholder = new DropPlaceholder(this.nextActor, this.nextAfter);
				}
				else {
					_dropPlaceholder = null;
				}
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
		return (actor === this._iconView.actor) && (after == this._after);
	},

	// Dropping on us

	acceptDrop: function(source, actor, x, y, time) {
		// Hooked from DND using our actor._delegate
		this._dropped = true;
		let appId = source.app.id;
		if ((source.modelIndex === this.modelIndex) ||
			(source.modelIndex === this.modelIndex - 1)) {
			log(`acceptDrop hook: ${appId} on self`);
		}
		else if (!('modelIndex' in source)) {
			// Dragged from elsewhere (likely the overview)
			log(`acceptDrop hook: ${appId} from elsewhere to ${this.modelIndex}`);
			let favorites = AppFavorites.getAppFavorites();
			favorites.addFavoriteAtPos(appId, this.modelIndex);
		}
		else {
			// Moved within the dash
			log(`acceptDrop hook: ${appId} from ${source.modelIndex} to ${this.modelIndex}`);
			let sourceModelIndex = source.modelIndex;
			AppUtils.moveFavoriteToPos(appId, sourceModelIndex, this.modelIndex);
		}
		remove(); // this destroys us!
		return true;
	},

	_onDragMotion: function(dragEvent) {
		// Remove placeholder if we've moved out of the dash view box
		if (!ClutterUtils.isDescendent(dragEvent.targetActor, this._iconView.dashView.box)) {
			log('dragMotion monitor hook: not in our area');
			remove();
			return DND.DragMotionResult.NO_DROP;
		}
		return DND.DragMotionResult.CONTINUE;
	}
});


let _dropPlaceholder = null;


function add(actor, after) {
	if (_dropPlaceholder === null) {
		_dropPlaceholder = new DropPlaceholder(actor, after);
	}
	else if (!_dropPlaceholder.isFor(actor, after)) {
		_dropPlaceholder.nextActor = actor;
		_dropPlaceholder.nextAfter = after;
		_dropPlaceholder.destroy();
	}
}


function remove() {
	if (_dropPlaceholder !== null) {
		_dropPlaceholder.nextActor = null;
		_dropPlaceholder.nextAfter = null;
		_dropPlaceholder.destroy();
	}
}
