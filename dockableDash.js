
const Lang = imports.lang;
const St = imports.gi.St;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Dash = Me.imports.dash;
const Dockable = Me.imports.dockable;


/**
 * Dash implementation that can be docked to the sides of the screen.
 */
const DockableDash = new Lang.Class({
	Name: 'EmDash.DockableDash',
	Extends: Dash.Dash,

	_init: function(entryManager) {
		Utils.log('init DockableDash');
		
		this._position = St.Side.LEFT;
		
		this.parent(entryManager,
			(this._position === St.Side.LEFT) || (this._position === St.Side.RIGHT));

		this._icons.actor.add_style_class_name('EmDash-DockableDash');
		
		this._dockable = new Dockable.Dockable(this._icons.actor, this._position);
    },
});