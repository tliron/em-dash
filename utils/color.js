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
 * SavageTiger's note: "Most of this code comes from reposts on StackOverflow. I was unable to trace
 * the original authors, otherwise I would have credited them here."
 *
 * The HSV/RGB conversion functions were written by Michele G following the algorithm in
 * https://en.wikipedia.org/wiki/HSL_and_HSV:
 *
 *   https://github.com/micheleg/dash-to-dock/blob/master/utils.js
 */


/**
 * Calculates normal, light, and dark variation and converts to hex.
 */
function getVariationsAsHex(r, g, b) {
	return {
		normal: toHexWithLuminance(r, g, b),
		light: toHexWithLuminance(r, g, b, 0.2),
		dark: toHexWithLuminance(r, g, b, -0.5)
	};
}


/**
 * Converts RGB to hex string, optionally applying luminance.
 */
function toHexWithLuminance(r, g, b, lum = 0) {
	let rgb = '#';
	const array = [r, g, b];
	for (let i = 0; i < 3; i++) {
		let c = array[i];
		c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
		rgb += c;
	}
	return rgb;
}


/**
 * Convert HSV (hue, saturation, value) to RGB (red, green, blue).
 */
function fromHSV(h, s, v) {
	const c = v * s;
	const h1 = h * 6;
	const x = c * (1 - Math.abs(h1 % 2 - 1));
	const m = v - c;

	let r, g, b;
	if (h1 <= 1) {
		r = c + m;
		g = x + m;
		b = m;
	}
	else if (h1 <= 2) {
		r = x + m;
		g = c + m;
		b = m;
	}
	else if (h1 <= 3) {
		r = m;
		g = c + m;
		b = x + m;
	}
	else if (h1 <= 4) {
		r = m;
		g = x + m;
		b = c + m;
	}
	else if (h1 <= 5) {
		r = x + m;
		g = m;
		b = c + m;
	}
	else {
		r = c + m;
		g = m;
		b = x + m;
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


/**
 * Convert RGB (red, green, blue) to HSV (hue, saturation, value).
 */
function toHSV(r, g, b) {
	let M = Math.max(r, g, b);
	let m = Math.min(r, g, b);
	let c = M - m;

	let h;
	if (c == 0) {
		h = 0;
	}
	else if (M == r) {
		h = ((g - b) / c) % 6;
	}
	else if (M == g) {
		h = (b - r) / c + 2;
	}
	else {
		h = (r - g) / c + 4;
	}

	h = h / 6;
	v = M / 255;
	if (M !== 0) {
		s = c/M;
	}
	else {
		s = 0;
	}

	return [h, s, v];
}
