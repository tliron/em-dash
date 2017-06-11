
Em Dash
=======

**WORK IN PROGRESS, DO NOT USE**

A GNOME Shell extension that replaces the built-in dash with a much enhanced version.

It provides the following extra features for the dash:

* Move it out of the overlay and into the **top panel** or to an **edge** of one of the
  **monitors**.
* Configure to show windows in **all of the workspaces** (like the built-in dash) or only in the
  **current workspace**.

For the dash icons:  
  
* Configure the dash icon indicator to show **how many** windows are open (the built-in dash only
  shows if *any* are open).
* Configure the behavior of **left-click**, **middle-click**, and **wheel scroll** on the dash
  icons.
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
new kind of dash implementation, you can extend the Dash class, or even use the EntryManager
directly. And would you also kindly contribute it to Em Dash?

And if you want to use some of the UI features, you might enjoy Dockable, a generic class that can
be used to dock any St actor to a monitor edge. Also, our Icon class can be used independently in
your own dash-like extension.

Let's make GNOME better, together!

To run make, you might need to install these dependencies:

    sudo apt install make zip gettext intltool libglib2.0-bin


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
