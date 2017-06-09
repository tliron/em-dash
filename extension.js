
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Entries = Me.imports.entries;
const PanelDash = Me.imports.panelDash;
const DockableDash = Me.imports.dockableDash;


let entryManager;
let panelDash;
let dockableDash;


function init() {
	Utils.DEBUG = true;
}


function enable() {
	entryManager = new Entries.EntryManager();
	panelDash = new PanelDash.PanelDash(entryManager);
	dockableDash = new DockableDash.DockableDash(entryManager);
}


function disable() {
	panelDash.destroy();
	panelDash = null;
	dockableDash.destroy();
	dockableDash = null;
	entryManager.destroy();
	entryManager = null;
}
