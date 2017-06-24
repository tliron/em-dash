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
 * Original code by GitHub user SavageTiger:
 *
 *   https://github.com/SavageTiger/dash-to-dock
 *
 * Original note: "Most of this code comes from reposts on StackOverflow. I was unable to trace the
 * original authors, otherwise I would have credited them here."
 */


function luminance(r, g, b, lum) {
	let hex = b | (g << 8) | (r << 16);

	hex = (0x1000000 + hex).toString(16).slice(1);

	// Convert to decimal and change luminosity
	let rgb = '#';
	for (let i = 0; i < 3; i++) {
		let c = parseInt(hex.substr(i * 2, 2), 16);
		c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
		rgb += ('00' + c).substr(c.length);
	}

	return rgb;
}


function HSVtoRGB(...args) {
	let h, s, v;
	if (args.length === 1) {
		({h, s, v} = args[0]);
//		let color = arguments[0];
//		h = color.h;
//		s = color.s;
//		v = color.v;
	}
	else {
		[h, s, v] = args;
	}

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

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}


function RGBtoHSV(...args) {
	let r, g, b;
	if (args.length === 1) {
		({r, g, b} = args[0]);
//		let color = arguments[0];
//		r = color.r;
//		g = color.g;
//		b = color.b;
	}
	else {
		[r, g, b] = args;
	}

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

	return {
		h: h,
		s: s,
		v: v
	};
}
