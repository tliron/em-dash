
UUID = em-dash@github.com_tliron
NAME = Em Dash
TRANSLATIONS = em-dash
GSCHEMA = em-dash
INSTALLNAME = $(UUID)

BASE_MODULES = extension.js stylesheet.css metadata.json COPYING README.md
EXTRA_MODULES = convenience.js dash.js dockable.js dockableDash.js entries.js icons.js panelDash.js prefs.js utils.js Settings.ui
EXTRA_IMAGES = 
TOLOCALIZE = prefs.js icons.js


# The command line passed variable VERSION is used to set the version string
# in the metadata and in the generated zip-file. If no VERSION is passed, the
# current commit SHA1 is used as version number in the metadata while the
# generated zip file has no string attached.
ifdef VERSION
	VSTRING = _v$(VERSION)
else
	VERSION = $(shell git rev-parse HEAD)
	VSTRING =
endif

ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif

ZIP = $(UUID)$(VSTRING).zip


all: ./schemas/gschemas.compiled $(MSGSRC:.po=.mo)

clean:
	rm -f "./$(ZIP)"
	rm -f "./schemas/gschemas.compiled"
	rm -f "./po/$(TRANSLATIONS).pot"
	rm -f "./Settings.ui.h"

install:
	rm -rf "$(INSTALLBASE)/$(INSTALLNAME)"
	mkdir -p "$(INSTALLBASE)/$(INSTALLNAME)"
	cp -r ./_build/* "$(INSTALLBASE)/$(INSTALLNAME)/"
	-rm -fR ./_build
	echo done

zip-file: _deploy
	cd ./_build ; \
	zip -qr "$(ZIP)" .
	mv "./_build/$(ZIP)" ./
	-rm -fR ./_build

# GSchemas

./schemas/gschemas.compiled: ./schemas/org.gnome.shell.extensions.$(GSCHEMA).gschema.xml
	glib-compile-schemas ./schemas/

# Translations

MSGSRC = $(wildcard ./po/*.po)

./po/%.mo: ./po/%.po
	msgfmt -c $< -o $@

merge-po: ./po/$(TRANSLATIONS).pot
	for l in $(MSGSRC); do \
		msgmerge -U $$l "./po/$(TRANSLATIONS).pot"; \
	done;

./po/$(TRANSLATIONS).pot: $(TOLOCALIZE) Settings.ui
	mkdir -p po
	xgettext -k_ -kN_ -o "./po/$(TRANSLATIONS).pot" --package-name="$(NAME)" $(TOLOCALIZE)
	intltool-extract --type=gettext/glade ./Settings.ui
	xgettext -k_ -kN_ --join-existing -o "./po/$(TRANSLATIONS).pot" ./Settings.ui.h

# Deploy

_deploy: all
	-rm -fR ./_build
	mkdir -p ./_build
	cp $(BASE_MODULES) $(EXTRA_MODULES) ./_build
	#mkdir -p _build/img
	#cd img ; cp $(EXTRA_IMAGES) ../_build/img/
	mkdir -p ./_build/schemas
	cp ./schemas/*.xml ./_build/schemas/
	cp ./schemas/gschemas.compiled ./_build/schemas/
	mkdir -p ./_build/locale
	for l in $(MSGSRC:.po=.mo) ; do \
		lf=./_build/locale/`basename $$l .mo`; \
		mkdir -p $$lf; \
		mkdir -p $$lf/LC_MESSAGES; \
		cp $$l $$lf/LC_MESSAGES/$(TRANSLATIONS).mo; \
	done;
	sed -i 's/"version": -1/"version": "$(VERSION)"/' ./_build/metadata.json;
