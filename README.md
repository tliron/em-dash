
Em—Dash
=======

**WORK IN PROGRESS, DO NOT USE**

An enhanced GNOME Shell desktop dash, implemented as a GNOME Shell extension.

It's primary function is to move the dash out of the overview and into the **top panel** or dock it
on an **edge** of one of the **monitors**.

It supports any number of icons: when there are too many, it will let you scroll through them. (The
built-in dash keeps shrinking the icons in order to fit more, until it reaches a minimum icon size
and then stops showing extra icons...)

Also, Em—Dash provides the following *optional* features for the icons:

* Show windows from **all of the workspaces** (like the built-in dash) or only from the
  **current workspace**.
* **Highlight** the currently focused application with a color-appropriate backlight (a feature
  borrowed from the Unity desktop).
* Show dots for **how many** windows are open (the built-in dash only shows a line if *any* are
  open).
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

t
What does the name mean?
------------------------

The [em dash](https://en.wikipedia.org/wiki/Dash#Em_dash) is the longest version of the typographic
dash. Hilariously, the "Em—Dash" name is stylized with an em dash inside of it.  


Developers
----------

Em—Dash has a deliberately extensible and reusable architecture. If you have your own idea for a
new kind of dash implementation, you can extend the `Dash` class, or even use the `EntryManager`
directly. Would you also kindly contribute it to Em—Dash?

And if you want to use some of the UI features, you might enjoy `Dockable`, a generic class that can
be used to dock any St actor to a monitor edge. Also, our Icon class can be used independently in
your own dash-like extension.

We owe a debt to the developers of [Dash-to-Dock](https://github.com/micheleg/dash-to-dock) and
[Dash-to-Panel](https://github.com/jderose9/dash-to-panel). There was much to learn from their code.

Let's make GNOME better, together!

#### Dependencies

To run `make`, you might need to install these dependencies (this is for Ubuntu):

    sudo apt install make zip gettext intltool libglib2.0-bin

#### Debugging

It is recommended to test in a virtual machine running GNOME, so as not to break your dev
environment while yoiu work. Note, though, that St CSS animations will not work unless you have 3D
enabled, so you want to make sure your virtual guest supports 3D.

See the logs with [journalctl](https://www.freedesktop.org/software/systemd/man/journalctl.html).
You can filter specifically for the extension, e.g.:

    journalctl -f -o cat GNOME_SHELL_EXTENSION_NAME="Em-Dash"

Unfortunately, this will not show uncaught exceptions, which are logged by gjs (GNOME JavaScript):

    journalctl -f GLIB_DOMAIN=Gjs

To see all GNOME Shell messages, not just from JavaScript:

    journalctl -f _COMM=gnome-shell

Well, that's except for messages from prefs are found in the extension manager (!):

    journalctl -f _COMM=gnome-shell-ext

So, in the end it might make more sense to just view all journalctl messages. Sigh.

#### Reference

If you've just started developing GNOME extensions, you will be overwhelmed. Here's some important
reference material:

* The [GNOME Shell JavaScript source code](https://github.com/GNOME/gnome-shell/tree/master/js/ui)
  is crucial. This is where your `imports.ui` come from. `imports.misc` is in the
  [same repository](https://github.com/GNOME/gnome-shell/tree/master/js/misc) as is the
  [default CSS](https://github.com/GNOME/gnome-shell/blob/master/data/theme/gnome-shell.css).
* The general `imports` (`imports.lang`, `imports.gettext`, `imports.tweener`) come from the
  [gjs source code](https://git.gnome.org/browse/gjs/tree/modules).
* All the `imports.gi` come from the GObject-Introspection system, which uses language-neutral XML
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
* Learn about [tweeners](http://hosted.zeh.com.br/tweener/docs/en-us/).
* The preferences page is quite different from all the above, as it's actually a GTK+ widget. The
  [Glade designer](https://glade.gnome.org/) can be used to edit the `prefs.ui` file used by the
  GTK+ builder.


TODO
----

* Scrollable if there are too many icons
* In touch-to-show, make sure it is shown in overview! Also on all monitors!
* Allow dragging to after all other favorites
* Window previews/lists on hover
* Dragging on empty dash
* Add applications button
* Wobbly drag and drop in panel
* Dock with borders seems to keep moving its strut by a pixel or two as app focus changes
* Restarting with bottom dock -- doesn't rotate corners
* Reset backcolor cache if icon theme changes
