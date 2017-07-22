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
const Signals = imports.signals;
const Gio = imports.gi.Gio;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;

const log = LoggingUtils.logger('mpris');


/**
 * DBus connection to an MPRIS2 player.
 */
var MPRIS = new Lang.Class({
	Name: 'EmDash.MPRIS',

	_init(name) {
		log('_init');

		this.canPause = null;
		this.canGoNext = null;
		this.canGoPrevious = null;

		this._busName = `org.mpris.MediaPlayer2.${name}`;
		this._destroyed = false;
		this._ownerName = null;
		this._properties = null;
		this._mediaPlayer = null;
		this._mediaPlayerPlayer = null;
		this._mediaPlayerPlaylists = null;
		this._mediaPlayerTracklist = null;

		// While we can successfully create proxies without an owner, they won't work :)
		getOwner(this._busName, Lang.bind(this, this._onGetOwner));
	},

	destroy() {
		log('destroy');
		// There is no way to cancel the existing DBus remote calls, so we'll just make sure not to
		// do anything if answers arrive after we've been destroyed
		this._destroyed = true;
	},

	play() {
		this._mediaPlayerPlayer.PlayRemote();
	},

	pause() {
		this._mediaPlayerPlayer.PauseRemote();
	},

	stop() {
		this._mediaPlayerPlayer.StopRemote();
	},

	next() {
		this._mediaPlayerPlayer.NextRemote();
	},

	previous() {
		this._mediaPlayerPlayer.PreviousRemote();
	},

	_onGetOwner(owner) {
		if (this._destroyed) {
			log('_onGetOwner: destroyed!');
			return;
		}

		if (owner.length === 0) {
			log('_onGetOwner: none');
			return;
		}
		this._ownerName = owner[0];
		log(`_onGetOwner: ${this._ownerName}`);

		// Create proxies
		const onProxyCreated = Lang.bind(this, this._onProxyCreated);
		const interfacePath = '/org/mpris/MediaPlayer2';
		createProxy(MediaPlayerPlayerWrapper, this._busName, interfacePath,
				'mediaPlayerPlayer', onProxyCreated);

		// We're currently not using these other proxies, but are leaving the code here for possible
		// future use
		/*
		createProxy(PropertiesWrapper, this._busName, interfacePath,
			'properties', onProxyCreated);
		createProxy(MediaPlayerWrapper, this._busName, interfacePath,
			'mediaPlayer', onProxyCreated);
		createProxy(MediaPlayerPlaylistsWrapper, this._busName, interfacePath,
			'mediaPlayerPlaylists', onProxyCreated);
		createProxy(MediaPlayerTracklistWrapper, this._busName, interfacePath,
			'mediaPlayerTracklist', onProxyCreated);
		*/
	},

	_onProxyCreated(name, proxy) {
		if (this._destroyed) {
			log('_onProxyCreated: destroyed!');
			return;
		}

		log(`_onProxyCreated: ${name}`);
		this[`_${name}`] = proxy;

		if (this._mediaPlayerPlayer !== null) {
			this.canPause = this._mediaPlayerPlayer.CanPause;
			this.canGoNext = this._mediaPlayerPlayer.CanGoNext;
			this.canGoPrevious = this._mediaPlayerPlayer.CanGoPrevious;

			this.emit('initialize', this);
		}
	}
});

Signals.addSignalMethods(MPRIS.prototype);


const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.freedesktop.DBus">\
		<method name="GetNameOwner">\
			<arg type="s" direction="in" />\
			<arg type="s" direction="out" />\
		</method>\
		<method name="ListNames">\
			<arg type="as" direction="out" />\
		</method>\
		<signal name="NameOwnerChanged">\
			<arg type="s" direction="out" />\
			<arg type="s" direction="out" />\
			<arg type="s" direction="out" />\
		</signal>\
	</interface>\
</node>');


const PropertiesWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.freedesktop.DBus.Properties">\
		<method name="Get">\
			<arg type="s" direction="in" />\
			<arg type="s" direction="in" />\
			<arg type="v" direction="out" />\
		</method>\
		<signal name="PropertiesChanged">\
			<arg type="s" direction="out" />\
			<arg type="a{sv}" direction="out" />\
			<arg type="as" direction="out" />\
		</signal>\
	</interface>\
</node>');


const MediaPlayerWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.mpris.MediaPlayer2">\
		<method name="Raise" />\
		<method name="Quit" />\
		<property name="CanRaise" type="b" access="read" />\
		<property name="HasTrackList" type="b" access="read" />\
		<property name="CanQuit" type="b" access="read" />\
		<property name="Identity" type="s" access="read" />\
		<property name="DesktopEntry" type="s" access="read" />\
	</interface>\
</node>');


const MediaPlayerPlayerWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.mpris.MediaPlayer2.Player">\
		<method name="PlayPause" />\
		<method name="Pause" />\
		<method name="Play" />\
		<method name="Stop" />\
		<method name="Next" />\
		<method name="Previous" />\
		<method name="SetPosition">\
			<arg type="o" direction="in" />\
			<arg type="x" direction="in" />\
		</method>\
		<property name="CanPause" type="b" access="read" />\
		<property name="CanSeek" type="b" access="read" />\
		<property name="CanGoNext" type="b" access="read" />\
		<property name="CanGoPrevious" type="b" access="read" />\
		<property name="Metadata" type="a{sv}" access="read" />\
		<property name="Volume" type="d" access="readwrite" />\
		<property name="PlaybackStatus" type="s" access="read" />\
		<property name="Position" type="x" access="read" />\
		<signal name="Seeked">\
			<arg type="x" direction="out" />\
		</signal>\
	</interface>\
</node>');


const MediaPlayerPlaylistsWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.mpris.MediaPlayer2.Playlists">\
		<method name="ActivatePlaylist">\
			<arg type="o" direction="in" />\
		</method>\
		<method name="GetPlaylists">\
			<arg type="u" direction="in" />\
			<arg type="u" direction="in" />\
			<arg type="s" direction="in" />\
			<arg type="b" direction="in" />\
			<arg type="a(oss)" direction="out" />\
		</method>\
		<property name="PlaylistCount" type="u" access="read" />\
		<property name="Orderings" type="as" access="read" />\
		<property name="ActivePlaylist" type="(b(oss))" access="read" />\
		<signal name="PlaylistChanged">\
			<arg type="(oss)" direction="out" />\
		</signal>\
	</interface>\
</node>');


const MediaPlayerTracklistWrapper = Gio.DBusProxy.makeProxyWrapper(
'<node>\
	<interface name="org.mpris.MediaPlayer2.TrackList">\
		<method name="GetTracksMetadata">\
			<arg type="ao" direction="in" />\
			<arg type="aa{sv}" direction="out" />\
		</method>\
		<method name="GoTo">\
			<arg type="o" direction="in" />\
		</method>\
		<property name="Tracks" type="ao" access="read" />\
		<signal name="TrackListReplaced">\
			<arg type="ao" direction="out" />\
			<arg type="o" direction="out" />\
		</signal>\
		<signal name="TrackAdded">\
			<arg type="a{sv}" direction="out" />\
			<arg type="o" direction="out" />\
		</signal>\
		<signal name="TrackRemoved">\
			<arg type="o" direction="out" />\
		</signal>\
		<signal name="TrackMetadataChanged">\
			<arg type="o" direction="out" />\
			<arg type="a{sv}" direction="out" />\
		</signal>\
	</interface>\
</node>');


function createProxy(wrapperClass, objectPath, interfacePath, name, callback) {
	log(`createProxy: ${name}`);
	new wrapperClass(Gio.DBus.session, objectPath, interfacePath, (proxy) => {
		callback(name, proxy);
	});
}


function getOwner(name, callback) {
	const dbus = new DBusWrapper(Gio.DBus.session, 'org.freedesktop.DBus', '/org/freedesktop/DBus');
	dbus.GetNameOwnerRemote(name, callback);
}
