
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Entries = Me.imports.entries;
const Panel = Me.imports.panel;
const Dock = Me.imports.dock;


let entryManager;
let panel;
let dock;


function init() {
	Utils.DEBUG = true;
}


function enable() {
	entryManager = new Entries.EntryManager();
	panel = new Panel.Panel(entryManager);
	dock = new Dock.Dock(entryManager);
}


function disable() {
	panel.destroy();
	panel = null;
	dock.destroy();
	dock = null;
	entryManager.destroy();
	entryManager = null;
}
