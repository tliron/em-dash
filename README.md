
Em Dash
=======

**WORK IN PROGRESS, DO NOT USE**

A GNOME Shell extension that replaces the built-in dash with a much enhanced version.

It provides the following extra features for the dash:

* Move it out of the overlay and into the **top panel** or dock on an **edge** of one of the
  **monitors**.
* Configure to show windows in **all of the workspaces** (like the built-in dash) or only in the
  **current workspace**.

For the dash icons:  
  
* Configure the dash icon indicator to show **how many** windows are open (the built-in dash only
  shows if *any* are open).
* Configure the behavior of **left-click** and **middle-click** on the dash icons.
* Allow **wheel scroll** to cycle windows on the dash icons.
* Configure the dash icons to show **window previews** when hovering over them (a Windows feature).
* Configure icons to **"grab"** other windows. This solves a common annoyance with the built-in
  dash, in which poorly designed applications spawn extra icons for their windows. This feature even
  works for WINE applications.

For the drop-down menus:

* Show **quicklists** in the drop-down menu for supported applications (a Unity desktop feature).
* Show **media controls** in the drop-down menu for supported applications (MPRIS).


Developers
----------

Hi! Em Dash has a deliberately extensible and reusable architecture. If you have your own idea for a
new kind of dash implementation, you can extend the `Dash` class, or even use the `EntryManager`
directly. And would you also kindly contribute it to Em Dash?

And if you want to use some of the UI features, you might enjoy `Dockable`, a generic class that can
be used to dock any St actor to a monitor edge. Also, our Icon class can be used independently in
your own dash-like extension.

Let's make GNOME better, together!

To run `make`, you might need to install these dependencies (this is for Ubuntu):

    sudo apt install make zip gettext intltool libglib2.0-bin

It is recommended to test in a virtual machine running GNOME, so as not to break your dev
environment.

See the logs with [journalctl](https://www.freedesktop.org/software/systemd/man/journalctl.html).
You can filter specifically for the extension, e.g.:

    journalctl -f -o cat GNOME_SHELL_EXTENSION_NAME="Em Dash"

Unfortunately, this will not show uncaught exceptions, which are logged by gjs (GNOME JavaScript):

    journalctl -f GLIB_DOMAIN=Gjs

To see all GNOME Shell messages, not just from JavaScript:

    journalctl -f _COMM=gnome-shell

But actually messages from prefs are found here:

    journalctl -f _COMM=gnome-shell-ext

So it might make more sense to just view all messages!   

If you've just started developing GNOME extensions, you will be overwhelmed. Here's some important
reference material:

* The [GNOME Shell JavaScript source code](https://github.com/GNOME/gnome-shell/tree/master/js/ui)
  is crucial. This is where your `imports.ui` come from. `imports.misc` is in the
  [same repository](https://github.com/GNOME/gnome-shell/tree/master/js/misc). Lots of useful
  stuff there.
* The general `imports` (`imports.lang`, `imports.gettext`) come from the
  [gjs source code](https://git.gnome.org/browse/gjs/tree/modules).
* All the `imports.gi` come from the GObject-Introspection system, which uses language-neutral XML
  descriptors for installed GObject libraries. (On Ubuntu, you can find the
  automatically-generated descriptors in `/usr/share/gir-1.0/` and compiled ones in
  `/usr/lib/girepository-1.0/` and `/usr/lib/x86_64-linux-gnu/girepository-1.0/`.) The implication
  is that `imports.gi` source code is almost always in C. Here's documentation for the most common
  ones you will use:
  * `imports.gi.Shell` is the
     [written-in-C parts of GNOME Shell](https://developer.gnome.org/shell/stable/).
  * `imports.gi.Clutter` is [Clutter](https://developer.gnome.org/clutter/stable/), the UI library
    for the shell.
  * `imports.gi.St` is [St](https://developer.gnome.org/st/stable/), a small widget toolkit built
    on top of Clutter, which supports CSS-based theming (this is what a "GNOME Shell theme" is for).
    Note that St is nowhere as rich as GTK+ is. You have very few widgets to work with.
  * `imports.gi.Meta` is actually [Mutter](https://developer.gnome.org/meta/stable/), an abstraction
    above the compositing window manager (such as Metacity).
  * [GSettings](https://developer.gnome.org/gio/stable/GSettings.html) are part of `imports.gi.Gio`.
    You'll also see some documentation there for the XML format for the `/schemas/` files. The
    `type` fields use the
    [GVariant format](https://developer.gnome.org/glib/stable/gvariant-format-strings.html).
* The preferences page is quite different from all the above, as it's actually written in GTK+! The
  [Glade designer](https://glade.gnome.org/) can be used to edit the `prefs.ui` file used by the
  GTK+ builder.


Credits
-------

We owe a great debt to Michele G, the original author of the
[Dash-to-Dock extension](https://github.com/micheleg/dash-to-dock). That codebase contains
solutions to many thorny problems with docking that made their way to our reusable Dockable class.


What does the name mean?
------------------------

The [em dash](https://en.wikipedia.org/wiki/Dash#Em_dash) is the longest version of the typographic
dash.


TODO
----

* Icons too big in Hi-DPI
* Sometimes when switching position the widget size is wrong (minimal)
* Icon dragging
* Scrollable if there are too many icons
* Touch to show should not have struts
