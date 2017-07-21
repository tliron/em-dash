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
 *
 * Adapted from code by GitHub user SavageTiger:
 *
 *   https://github.com/SavageTiger/dash-to-dock
 *
 * SavageTiger's note: "The backlight color choosing algorithm was mostly ported from the C++ source
 * of Canonical's Unity 7 to JavaScript, so it more or less works the same way."
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const LoggingUtils = Me.imports.utils.logging;
const ColorUtils = Me.imports.utils.color;

const log = LoggingUtils.logger('backlight');

// Default to a neutral gray
const DEFAULT_BACKLIGHT = ColorUtils.getVariationsAsHex(180, 180, 180);

const _backlightCache = new Map();


/**
 * Gets backlight color variations based on relative weight of colors, or uses a cached value.
 */
function getBacklight(id, pixbufGetter) {
	if (_backlightCache.has(id)) {
		return _backlightCache.get(id);
	}

	let backlight;
	let pixbuf = pixbufGetter();
	if (pixbuf !== null) {
		let [r, g, b] = getBacklightColor(pixbuf);
		backlight = ColorUtils.getVariationsAsHex(r, g, b);
	}
	else {
		log(`getBacklight: no pixbuf for ${id}`);
		backlight = DEFAULT_BACKLIGHT;
	}

	_backlightCache.set(id, backlight);

	return backlight;
}


/**
 * Resets the backlight cache.
 */
function reset() {
	_backlightCache.clear();
}


/**
 * Calculates a backlight color based on relative weight of colors.
 */
function getBacklightColor(pixbuf) {
	let pixels = pixbuf.get_pixels();

	let width = pixbuf.get_width();
	let height = pixbuf.get_height();

	// Improve performance by down-sampling large icons with convenient sizes
	if ((height === 512) || (height === 256) || (width === 256) || (width === 512)) {
		let resampleY = 1;
		let resampleX = 1;

		if (height === 512) {
			resampleY = 8;
		}
		else if (height === 256) {
			resampleY = 4;
		}

		if (width === 512) {
			resampleX = 8;
		}
		else if (width === 256) {
			resampleX = 4;
		}

		width /= resampleX;
		height /= resampleY;

		pixels = resamplePixels(pixbuf, pixels, resampleX, resampleY);
	}

	let offset = 0;
	let total  = 0;
	let rTotal = 0;
	let gTotal = 0;
	let bTotal = 0;
	for (let i = 0; i < height; i++) {
		for (let x = 0; x < width; x++) {
			let r = pixels[offset];
			let g = pixels[offset + 1];
			let b = pixels[offset + 2];
			let a = pixels[offset + 3];
			offset += 4;

			let saturation = (Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b))) / 255;
			let relevance  = 0.1 + 0.9 * (a / 255) * saturation;

			rTotal += Math.round(r * relevance);
			gTotal += Math.round(g * relevance);
			bTotal += Math.round(b * relevance);

			total += relevance * 255;
		}
	}

	let r = (rTotal / total) * 255;
	let g = (gTotal / total) * 255;
	let b = (bTotal / total) * 255;

	let [h, s, v] = ColorUtils.toHSV(r, g, b);

	// Limit saturation
	if (s > 0.15) {
		s = 0.65;
	}

	// Set value
	v = 0.90;

	return ColorUtils.fromHSV(h, s, v);
}


/**
 * Fast resampling of pixels.
 */
function resamplePixels(pixbuf, pixels, resampleX, resampleY) {
	let resampledPixels = [];
	let limit = pixbuf.get_height() * pixbuf.get_width() / (resampleX * resampleY);

	for (let i = 0; i < limit; i++) {
		let pixel = i * resampleX * resampleY;
		resampledPixels.push(pixels[pixel * 4]);
		resampledPixels.push(pixels[pixel * 4 + 1]);
		resampledPixels.push(pixels[pixel * 4 + 2]);
		resampledPixels.push(pixels[pixel * 4 + 3]);
	}

	return resampledPixels;
}
