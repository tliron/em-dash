
Em—Dash
=======

**WORK IN PROGRESS, DO NOT USE**

An enhanced GNOME Shell desktop dash, implemented as a GNOME Shell extension.

Its primary function is to move the dash out of the overview and into the **top panel** or dock it
on an **edge** of one of the **monitors**.

Also, Em—Dash provides the following *optional* features for the icons:

* Handle any number of icons: when there are too many, it will let you scroll through them. (The
  built-in dash keeps shrinking the icons in order to fit more, until it reaches a minimum icon
  size and then stops showing extra icons).
* Show windows from **all of the workspaces** (like the built-in dash) or only from the
  **current workspace**.
* **Highlight** the currently focused application with a color-appropriate backlight (a feature
  borrowed from the Unity desktop).
* Indicate **how many** windows are open using a dotted line (the built-in dash only shows a full
  line if *any* are open).
* Move the **activities button** from the top panel to the dash. 
* Change the behavior of **left-click** and **middle-click** on the dash icons: launch (like the
  built-in dash), launch/hide, or cycle/hide.
* **Mouse wheel scroll** to cycle windows on the dash icons.
* Show a **window list** or **window previews** when hovering over dash icons (a feature borrowed
  from the Windows desktop; the built-in dash only shows the application name when hovering).
* Allow icons to **"grab"** other windows. This solves a common annoyance with the built-in
  dash, in which poorly designed applications spawn extra icons for their windows. This feature even
  works for **WINE applications**.

Optional features for the dash icons' popup menus:

* Show **media controls** for supported applications (MPRIS).
* Move the **application menu** from the top panel into the relevant icon's popup menu.

Requires GNOME Shell 3.24 and above. Written in ECMAScript 6 (2015). 


What does the name mean?
------------------------

The [em dash](https://en.wikipedia.org/wiki/Dash#Em_dash) is the longest version of the typographic
dash. Hilariously, the "Em—Dash" name is stylized with an em dash inside of it.  


Help Testing
------------

Dependencies for Debian/Ubuntu:

	sudo apt install git make

You can install the extension for the current user like so:

	git clone https://github.com/tliron/em-dash.git
	cd em-dash
	make link

You will then need to restart GNOME Shell and enable the extension via GNOME Tweak.

To update the extension to the latest, run `git pull` in the `em-dash` directory and restart GNOME
Shell.

To uninstall, run `make unlink` in the `em-dash` directory and restart GNOME Shell.

Found a bug? Please [report the issue](https://github.com/tliron/em-dash/issues) immediately!


Developers
----------

Em—Dash has a deliberately extensible model-view architecture, and the
[utils](https://github.com/tliron/em-dash/tree/master/utils) package as a lot of general-purpose
code that can be reused in other GNOME Shell extensions.

We owe a debt to the developers of [Dash-to-Dock](https://github.com/micheleg/dash-to-dock) and
[Dash-to-Panel](https://github.com/jderose9/dash-to-panel). There was much to learn from their code.

Let's make GNOME better, together!

#### Dependencies

To run `make`, you might need to install these dependencies (this is for Ubuntu):

    sudo apt install make zip gettext intltool libglib2.0-bin

#### Debugging

It is recommended to test in a virtual machine running GNOME, so as not to break your dev
environment while you work. Note, though, that St CSS animations will *not* work unless you have 3D
enabled, so you may want to make sure your virtual guest supports 3D.

To enable logging:

	gsettings set org.gnome.shell.extensions.em-dash debug true

You need to restart GNOME Shell for logs to begin. See the logs with
[journalctl](https://www.freedesktop.org/software/systemd/man/journalctl.html). You can filter
specifically for the extension, e.g.:

    journalctl -f -o cat GNOME_SHELL_EXTENSION_NAME="Em-Dash"

Unfortunately, this will not show uncaught exceptions, which are logged by gjs (GNOME JavaScript):

    journalctl -f GLIB_DOMAIN=Gjs

To see all GNOME Shell messages, not just from JavaScript:

    journalctl -f _COMM=gnome-shell

Well, that's except for messages from prefs are found in the extension manager (!):

    journalctl -f _COMM=gnome-shell-ext

So, in the end it might make more sense to just view all journal messages and ignore the noise.

#### Reference

If you've just started developing GNOME extensions, you will be overwhelmed. Here's some important
reference material:

* The [GNOME Shell JavaScript source code](https://github.com/GNOME/gnome-shell/tree/master/js/ui)
  is crucial. This is where your `imports.ui` come from. `imports.misc` is in the
  [same repository](https://github.com/GNOME/gnome-shell/tree/master/js/misc) as is the
  [default CSS](https://github.com/GNOME/gnome-shell/blob/master/data/theme/gnome-shell.css).
* The general `imports` (`imports.lang`, `imports.gettext`, `imports.tweener`) come from the
  [gjs source code](https://git.gnome.org/browse/gjs/tree/modules).
* All the `imports.gi` come from the GObject-Introspection system, which uses language-neutral
  descriptors for installed GObject libraries. (On Ubuntu, you can find the
  automatically-generated descriptors in `/usr/share/gir-1.0/` and compiled ones in
  `/usr/lib/girepository-1.0/` and `/usr/lib/x86_64-linux-gnu/girepository-1.0/`.) The
  implication is that `imports.gi` source code is almost always in C. Here's documentation for the
  most common ones you will use:
  * `imports.gi.Shell` is the
     [part of GNOME Shell written in C](https://developer.gnome.org/shell/stable/).
  * `imports.gi.Clutter` is [Clutter](https://developer.gnome.org/clutter/stable/), the UI
    library for the shell. It's a powerful foundation built on top of OpenGL.
  * `imports.gi.St` is [St](https://developer.gnome.org/st/stable/), a CSS-styled widget toolkit
    built for Clutter (this is what a "GNOME Shell theme" is for). Note that in terms of variety of
    widgets, St is currently nowhere as rich as GTK+ is.
  * `imports.gi.Meta` is actually [Mutter](https://developer.gnome.org/meta/stable/), an
    abstraction above the compositing window manager, such as Metacity. (That's likely the source of
    the "Meta" name.)
  * [GSettings](https://developer.gnome.org/gio/stable/GSettings.html) are part of
    `imports.gi.Gio`. You'll also see some documentation there for the XML format for the
    `/schemas/` files. The `type` fields use GLib's
    [GVariant format](https://developer.gnome.org/glib/stable/gvariant-format-strings.html).
* Though Clutter supports animations, the GNOME Shell code tends to prefer its own gjs
  [tweener](https://git.gnome.org/browse/gjs/tree/modules/tweener) implementation (based on
  [this API](http://hosted.zeh.com.br/tweener/docs/en-us/)).
* The preferences page is quite different from all the above, as it's actually a GTK+ widget. The
  [Glade designer](https://glade.gnome.org/) can be used to edit the `prefs.ui` file used by the
  GTK+ builder. [This documentation](https://people.gnome.org/~gcampagna/docs/Gtk-3.0/) is useful.


TODO
----

#### Dock

* Support dock on different monitors
* Dock with borders seems to keep moving its strut by a pixel or two as app focus changes

#### Overview

* In touch-to-show, make sure dock is shown in overview
* Bottom dash on overview might cover some UI elements

#### DND

* Dragging on empty dash
* Drag and drop mangles clipping
* Can't scroll during drag and drop
* Support scrolling in smaller increments

### Tooltip

* Window list
* Window previews

#### Misc

* Popup menu can be too big to fit small screens
