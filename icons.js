
const Lang = imports.lang;
const AppDisplay = imports.ui.appDisplay;


/**
 * The UI representation of a dash entry. 
 */
const Icon = new Lang.Class({
	Name: 'EmDash.Icon',
    Extends: AppDisplay.AppIcon,
    
	_init: function(app, params) {
		params = params || {};
		params.showLabel = false;
		this.parent(app, params);
	}
});
