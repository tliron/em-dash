
UUID = em-dash@github.com_tliron
NAME = Em Dash
TRANSLATIONS = em-dash
TRANSLATIONS_COPYRIGHT = Tal Liron
TRANSLATIONS_EMAIL = tal.liron@gmail.com
SCHEMA = em-dash
INSTALLNAME = $(UUID)

BASE_MODULES = extension.js stylesheet.css metadata.json COPYING README.md
EXTRA_MODULES = convenience.js dash.js dockable.js dockableDash.js entries.js icons.js panelDash.js prefs.js utils.js prefs.ui
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
	rm -f "./prefs.ui.h"

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

./schemas/gschemas.compiled: ./schemas/org.gnome.shell.extensions.$(SCHEMA).gschema.xml ./schemas/org.gnome.shell.extensions.$(SCHEMA).enums.xml
	glib-compile-schemas --strict ./schemas/

# Translations

MSGSRC = $(wildcard ./po/*.po)
XGETTEXT_ARGS = --package-name="$(NAME)" --package-version="$(VERSION)" --copyright-holder="$(TRANSLATIONS_COPYRIGHT)" --msgid-bugs-address="$(TRANSLATIONS_EMAIL)"

./po/%.mo: ./po/%.po
	msgfmt -c $< -o $@

update-translations: ./po/$(TRANSLATIONS).pot
	for l in $(MSGSRC); do \
		msgmerge -U $$l "./po/$(TRANSLATIONS).pot"; \
	done;

./po/$(TRANSLATIONS).pot: $(TOLOCALIZE) prefs.ui
	mkdir -p po
	intltool-extract --type=gettext/glade ./prefs.ui
	xgettext -k_ -kN_ -o "./po/$(TRANSLATIONS).pot" $(XGETTEXT_ARGS) $(TOLOCALIZE)
	xgettext -k_ -kN_ -j -o "./po/$(TRANSLATIONS).pot" $(XGETTEXT_ARGS) ./prefs.ui.h

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

# Development

SCHEMAS = /usr/share/glib-2.0/schemas/

register-schema:
	sudo cp "./schemas/org.gnome.shell.extensions.$(SCHEMA)."*.xml "$(SCHEMAS)"
	sudo chmod -x "$(SCHEMAS)/org.gnome.shell.extensions.$(SCHEMA)."*.xml
	sudo glib-compile-schemas "$(SCHEMAS)"

unregister-schema:
	sudo rm -f "$(SCHEMAS)/org.gnome.shell.extensions.$(SCHEMA)."*.xml
	sudo glib-compile-schemas "$(SCHEMAS)"
	
