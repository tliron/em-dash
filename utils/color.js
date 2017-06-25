/*
 * This file is part of the Em-Dash extension for GNOME.
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
	let array = [r, g, b];
	for (let i = 0; i < 3; i++) {
		let c = array[i];
		c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
		rgb += c;
	}
	return rgb;
}


/**
 * Convert HSV to RGB.
 */
function HSVtoRGB(h, s, v) {
	let i = Math.floor(h * 6);
	let f = h * 6 - i;
	let p = v * (1 - s);
	let q = v * (1 - f * s);
	let t = v * (1 - (1 - f) * s);

	let r, g, b;
	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			 b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


/**
 * Convert RGB to HSV.
 */
function RGBtoHSV(r, g, b) {
	let max = Math.max(r, g, b);
	let min = Math.min(r, g, b);
	let d = max - min;
	let h;
	let s = (max === 0 ? 0 : d / max);
	let v = max / 255;

	switch (max) {
		case min:
			h = 0;
			break;
		case r:
			h = (g - b) + d * (g < b ? 6: 0);
			h /= 6 * d;
			break;
		case g:
			h = (b - r) + d * 2; h /= 6 * d;
			break;
		case b:
			h = (r - g) + d * 4;
			h /= 6 * d;
			break;
	}

	return [h, s, v];
}
