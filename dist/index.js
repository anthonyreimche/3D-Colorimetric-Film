//#region src/colour/mat3.ts
var e = [
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1
];
function t(e) {
	if (e.length !== 9) throw Error(`a 3×3 matrix needs 9 numbers, not ${e.length}`);
	return [
		e[0],
		e[1],
		e[2],
		e[3],
		e[4],
		e[5],
		e[6],
		e[7],
		e[8]
	];
}
function n(e, t) {
	let n = (n, r) => e[n * 3] * t[r] + e[n * 3 + 1] * t[3 + r] + e[n * 3 + 2] * t[6 + r];
	return [
		n(0, 0),
		n(0, 1),
		n(0, 2),
		n(1, 0),
		n(1, 1),
		n(1, 2),
		n(2, 0),
		n(2, 1),
		n(2, 2)
	];
}
function r(e, t) {
	return [
		e[0] * t[0] + e[1] * t[1] + e[2] * t[2],
		e[3] * t[0] + e[4] * t[1] + e[5] * t[2],
		e[6] * t[0] + e[7] * t[1] + e[8] * t[2]
	];
}
function i(e) {
	let [t, n, r, i, a, o, s, c, l] = e, u = a * l - o * c, d = -(i * l - o * s), f = i * c - a * s, p = t * u + n * d + r * f;
	return Math.abs(p) > 2 ** -52 * Math.hypot(t, n, r) * Math.hypot(i, a, o) * Math.hypot(s, c, l) ? [
		u / p,
		-(n * l - r * c) / p,
		(n * o - r * a) / p,
		d / p,
		(t * l - r * s) / p,
		-(t * o - r * i) / p,
		f / p,
		-(t * c - n * s) / p,
		(t * a - n * i) / p
	] : null;
}
function a(e) {
	let t = i(e);
	if (!t) throw Error("singular colour matrix");
	return t;
}
var o = (e) => [
	e[0],
	0,
	0,
	0,
	e[1],
	0,
	0,
	0,
	e[2]
], s = (e, t, n) => [
	e[0],
	t[0],
	n[0],
	e[1],
	t[1],
	n[1],
	e[2],
	t[2],
	n[2]
], c = (e, t) => [
	e[t],
	e[3 + t],
	e[6 + t]
], l = (e) => [
	e[0],
	e[3],
	e[6],
	e[1],
	e[4],
	e[7],
	e[2],
	e[5],
	e[8]
];
//#endregion
//#region src/param-table.ts
function u(e) {
	return Object.entries(e).map(([e, t]) => t.type === "bool" ? {
		key: e,
		glslType: "bool",
		default: t.default,
		label: t.label
	} : {
		key: e,
		glslType: t.type,
		default: t.default,
		range: {
			min: t.min,
			max: t.max
		},
		label: t.label
	});
}
var d = (e, t) => {
	let n = Math.min(e.max, Math.max(e.min, t));
	return e.type === "int" ? Math.round(n) : n;
};
function f(e, t) {
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		let e = t[r];
		n[r] = i.type === "bool" ? typeof e == "boolean" ? e : i.default : d(i, typeof e == "number" && Number.isFinite(e) ? e : i.default);
	}
	return n;
}
function p(e) {
	return f(e, {});
}
function m(e, t) {
	let n = [];
	for (let r in e) n.push({
		key: r,
		glslType: e[r],
		default: t[r]
	});
	return n;
}
function h(e, t) {
	let n = { ...t };
	for (let [r, i] of Object.entries(t)) {
		let t = e[r];
		t && t.type !== "bool" && typeof i == "number" && (Number.isNaN(i) ? delete n[r] : n[r] = d(t, i));
	}
	return n;
}
var g = (e, t) => Object.fromEntries(Object.entries(t).map(([t, n]) => [`${e}.${t}`, n]));
function _(e, t) {
	let n = `${e}.`, r = {};
	for (let [e, i] of Object.entries(t)) e.startsWith(n) && (typeof i == "number" || typeof i == "boolean") && (r[e.slice(n.length)] = i);
	return r;
}
//#endregion
//#region src/params.ts
var v = {
	contrast: {
		type: "float",
		default: 2.25,
		min: .25,
		max: 4.25,
		label: "contrast"
	},
	gamma: {
		type: "float",
		default: 0,
		min: -1,
		max: 1,
		label: "mid-tones"
	},
	vibrance: {
		type: "float",
		default: 1,
		min: 0,
		max: 2,
		label: "vibrance"
	},
	chromatic_boost: {
		type: "float",
		default: 0,
		min: 0,
		max: 1,
		label: "chromatic boost"
	},
	peak_luminance: {
		type: "float",
		default: 0,
		min: -100,
		max: 100,
		label: "peak luminance"
	},
	input_exposure: {
		type: "float",
		default: 0,
		min: -2,
		max: 2,
		label: "input exposure"
	},
	hl_hue_shift: {
		type: "float",
		default: 0,
		min: -1,
		max: 1,
		label: "Abney rotation"
	},
	hl_desaturation: {
		type: "float",
		default: .25,
		min: 0,
		max: 1,
		label: "highlight roll-off"
	},
	hl_desat_threshold: {
		type: "float",
		default: .5,
		min: 0,
		max: 1,
		label: "desaturation threshold"
	},
	gamut_knee: {
		type: "float",
		default: .2,
		min: 0,
		max: 1,
		label: "gamut knee"
	},
	gamut_steepness: {
		type: "float",
		default: .5,
		min: 0,
		max: 1,
		label: "gamut steepness"
	},
	output_cs: {
		type: "int",
		default: 1,
		min: 0,
		max: 4,
		label: "display target"
	},
	color_look: {
		type: "int",
		default: 0,
		min: 0,
		max: 11,
		label: "colour look"
	},
	look_opacity: {
		type: "float",
		default: 1,
		min: 0,
		max: 1,
		label: "look opacity"
	},
	contrast_pivot: {
		type: "float",
		default: .5,
		min: .01,
		max: .99,
		label: "contrast pivot"
	},
	toe_power: {
		type: "float",
		default: 1,
		min: .25,
		max: 3,
		label: "toe power"
	},
	shoulder_power: {
		type: "float",
		default: 1,
		min: .25,
		max: 3,
		label: "shoulder power"
	},
	hl_detail_recovery: {
		type: "float",
		default: .2,
		min: 0,
		max: 1,
		label: "detail recovery"
	},
	chroma_x_contrast: {
		type: "float",
		default: 0,
		min: 0,
		max: 10,
		label: "X-axis chroma contrast"
	},
	chroma_x_pivot: {
		type: "float",
		default: 50,
		min: 25,
		max: 75,
		label: "X-axis contrast pivot"
	},
	chroma_z_contrast: {
		type: "float",
		default: 0,
		min: 0,
		max: 10,
		label: "Z-axis chroma contrast"
	},
	chroma_z_pivot: {
		type: "float",
		default: 50,
		min: 25,
		max: 75,
		label: "Z-axis contrast pivot"
	},
	mono_green: {
		type: "float",
		default: 0,
		min: 0,
		max: 10,
		label: "green filter"
	}
}, y = p(v), b = [
	"sRGB",
	"Rec. 2020",
	"Display P3",
	"ProPhoto RGB",
	"Adobe RGB"
], ee = [
	"Neutral",
	"Natural look",
	"Portrait",
	"Vibrant",
	"Nature",
	"Blue sky",
	"Soft warm",
	"Soft",
	"Deep cool",
	"Authentic cinema",
	"Bright atmosphere",
	"Monochrome"
], x = [
	[
		.2126,
		.7152,
		.0722
	],
	[
		.2627,
		.678,
		.0593
	],
	[
		.2289,
		.6918,
		.0793
	],
	[
		.288,
		.7119,
		1e-4
	],
	[
		.2973,
		.6274,
		.0753
	]
], S = [
	1.076,
	-.047,
	-.058,
	-.014,
	1.044,
	-.052,
	-.105,
	.049,
	1.076,
	1.029,
	-.023,
	-.002,
	-.008,
	1.008,
	.007,
	-.074,
	.046,
	1.01,
	1.074,
	-.054,
	-.071,
	.006,
	1.009,
	-.059,
	-.103,
	.06,
	1.086,
	1.084,
	-.006,
	-.093,
	-.074,
	1.008,
	.06,
	-.011,
	.005,
	1.024,
	1.218,
	-.119,
	-.099,
	.007,
	1.076,
	-.069,
	-.192,
	.048,
	1.154,
	1.05,
	.02,
	-.01,
	-.02,
	1.02,
	0,
	-.01,
	-.02,
	1.03,
	1.082,
	-.051,
	-.047,
	-.02,
	1.052,
	-.045,
	.103,
	.042,
	1.073,
	.98,
	-.01,
	-.01,
	0,
	1.05,
	-.02,
	.02,
	.01,
	1.1,
	1.02,
	-.01,
	-.01,
	-.03,
	1.04,
	-.01,
	0,
	-.03,
	1.03,
	1.067,
	-.049,
	-.031,
	-.017,
	1.033,
	-.026,
	-.088,
	.042,
	1.055
], C = [
	.6945836396324686,
	.14268890101747944,
	.1269394537712512,
	.28646669883147013,
	.6689591418290065,
	.04457415933952332,
	0,
	.02769843372692241,
	.7974898507919064
], w = [
	1.660491002108434,
	-.5876411387885492,
	-.07284986331988486,
	-.1245504745215906,
	1.1328998971259596,
	-.008349422604369477,
	-.018150763354905213,
	-.10057889800800739,
	1.1187296613629127,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1.343578252584332,
	-.2821796705261358,
	-.06139858205819622,
	-.06529745278911947,
	1.075787915848574,
	-.010490463059454964,
	.0028217872617010515,
	-.019598494524494175,
	1.0167767072627931,
	.8351070891490238,
	.04879601732982788,
	.11593570461330915,
	.05402451863071904,
	.9289784107406033,
	.0170562613980029,
	-.002341691561590776,
	.03633707394814432,
	.9659643311807049,
	1.1519783947159161,
	-.09750305530240848,
	-.054475339413507635,
	-.12455047452159049,
	1.1328998971259596,
	-.008349422604369503,
	-.02253038278105581,
	-.049806507428388894,
	1.0723368902094448
], T = [
	.6274038959346991,
	.3292830383778838,
	.04331306568741722,
	.069097289358232,
	.919540395075459,
	.011362315566309176,
	.01639143887515023,
	.08801330787722576,
	.8955952532476239,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	.7538330343617218,
	.19859736905261646,
	.047569596585661844,
	.04574384896535825,
	.9417772198116939,
	.012478931222948127,
	-.0012103403545183937,
	.01760171730108999,
	.9836086230534283,
	1.2007680891347712,
	-.05747473331232554,
	-.14310216842779236,
	-.06993212725951843,
	1.0805425606086707,
	-.010686094282437804,
	.005541568367013693,
	-.04078654020154116,
	1.0352899874010184,
	.8773338416636569,
	.07749370651571998,
	.04517245182062312,
	.09662259146620368,
	.8915273202441809,
	.011850088289615686,
	.02292106270284832,
	.043036685010679435,
	.934042252286472
], E = [
	.174112,
	.004964,
	.174008,
	.004981,
	.173801,
	.004915,
	.17356,
	.004923,
	.173337,
	.004797,
	.173021,
	.004775,
	.172577,
	.004799,
	.172087,
	.004833,
	.171407,
	.005102,
	.170301,
	.005789,
	.168878,
	.0069,
	.166895,
	.008556,
	.164412,
	.010858,
	.161105,
	.013793,
	.156641,
	.017705,
	.150985,
	.02274,
	.14396,
	.029703,
	.135503,
	.039879,
	.124118,
	.057803,
	.109594,
	.086843,
	.091294,
	.132702,
	.068706,
	.200723,
	.045391,
	.294976,
	.02346,
	.412703,
	.008168,
	.538423,
	.003859,
	.654823,
	.01387,
	.750186,
	.038852,
	.812016,
	.074302,
	.833803,
	.114161,
	.826207,
	.154722,
	.805864,
	.192876,
	.781629,
	.22962,
	.754329,
	.265775,
	.724324,
	.301604,
	.692308,
	.337363,
	.658848,
	.373102,
	.624451,
	.408736,
	.589607,
	.444062,
	.554714,
	.478775,
	.520202,
	.512486,
	.486591,
	.544787,
	.454434,
	.575151,
	.424232,
	.602933,
	.396497,
	.627037,
	.372491,
	.648233,
	.351395,
	.665764,
	.334011,
	.680079,
	.319747,
	.691504,
	.308342,
	.700606,
	.299301,
	.707918,
	.292027,
	.714032,
	.285929,
	.719033,
	.280935,
	.723032,
	.276948,
	.725992,
	.274008,
	.728272,
	.271728,
	.729969,
	.270031,
	.731089,
	.268911,
	.731993,
	.268007,
	.732719,
	.267281,
	.733417,
	.266583,
	.734047,
	.265953,
	.73439,
	.26561,
	.734592,
	.265408,
	.73469,
	.26531,
	.73469,
	.26531
], D = [
	215.33465,
	216.65399,
	217.88428,
	219.05153,
	220.14357,
	221.16588,
	222.1217,
	223.01161,
	223.83662,
	224.59834,
	225.29921,
	225.93167,
	226.51031,
	227.04002,
	227.52505,
	227.96997,
	228.37961,
	228.75839,
	229.10887,
	229.44225,
	223.68723,
	214.168,
	205.47426,
	197.50737,
	190.18221,
	183.42755,
	177.40927,
	171.71423,
	166.01921,
	161.26114,
	156.51205,
	152.09988,
	148.09119,
	144.08249,
	140.61681,
	137.19861,
	133.96431,
	131.02483,
	128.08536,
	125.4802,
	122.93465,
	120.49192,
	118.27464,
	116.05737,
	114.0555,
	112.11517,
	110.23206,
	108.52786,
	106.82366,
	105.26328,
	103.76254,
	102.29211,
	100.96827,
	99.64443,
	98.41933,
	97.25076,
	96.096,
	95.06489,
	94.03378,
	93.07201,
	92.16363,
	91.25852,
	90.46065,
	89.66278,
	88.9145,
	88.21698,
	87.51945,
	86.91,
	86.30434,
	85.73459,
	85.21377,
	84.69295,
	84.24227,
	83.80045,
	83.3848,
	83.01721,
	82.64962,
	82.33952,
	82.04231,
	81.76405,
	81.53416,
	81.30428,
	81.12289,
	80.95801,
	80.83521,
	80.72168,
	80.65045,
	80.59034,
	80.57131,
	80.5671,
	80.60517,
	80.65601,
	80.75144,
	80.85907,
	81.01254,
	81.17904,
	81.39567,
	81.62642,
	81.90923,
	82.20887,
	82.5598,
	82.93072,
	83.35113,
	83.7947,
	84.29233,
	84.81635,
	85.39422,
	86.00119,
	86.66454,
	87.35604,
	88.10696,
	88.88807,
	89.72918,
	90.60318,
	91.5398,
	92.51119,
	93.54398,
	94.61283,
	95.74192,
	96.90921,
	98.13804,
	99.40525,
	100.73635,
	102.10578,
	103.54021,
	105.01234,
	106.55258,
	108.13228,
	109.78187,
	111.47143,
	113.23616,
	115.04231,
	116.92601,
	118.85246,
	120.86163,
	122.91274,
	125.04886,
	127.22766,
	129.49422,
	131.80248,
	134.20437,
	136.64542,
	139.18477,
	141.7574,
	144.42843,
	147.11901,
	149.91091,
	152.71301,
	155.62236,
	158.53839,
	161.56854,
	164.59702,
	167.74177,
	170.87844,
	174.13757,
	177.38217,
	180.75291,
	184.09992,
	187.5802,
	191.02417,
	194.61319,
	198.14956,
	201.86339,
	205.49933,
	209.35075,
	213.10937,
	217.10868,
	220.98853,
	225.15117,
	229.14913,
	233.51938,
	237.72111,
	242.30969,
	246.71441,
	251.55396,
	256.19424,
	261.3218,
	266.20905,
	271.65866,
	276.8345,
	282.62812,
	288.11413,
	294.30017,
	300.15022,
	306.75516,
	313.0006,
	320.03412,
	326.65935,
	334.14812,
	341.20554,
	349.15821,
	356.62305,
	365.05924,
	373.005,
	381.98756,
	390.45261,
	400.03007,
	409.09923,
	419.36868,
	429.09772,
	440.10982,
	450.60016,
	462.4489,
	473.75378,
	486.5134,
	498.72287,
	512.51868,
	525.71943,
	540.63986,
	554.90985,
	570.99998,
	586.35636,
	603.68996,
	620.20696,
	638.99757,
	656.90554,
	677.15919,
	696.34557,
	718.06863,
	738.6092,
	761.87958,
	783.85566,
	808.71603,
	832.03886,
	858.63238,
	883.55051,
	911.94378,
	938.53107,
	969.00048,
	997.36899,
	1029.94947,
	1060.28584,
	1094.99923,
	1127.44384,
	1164.36269,
	1198.98879,
	1237.19312,
	1273.05128,
	1313.63076,
	1351.65816,
	1394.65221,
	1434.90942,
	1479.36892,
	1521.29923,
	1568.31051,
	1611.98419,
	1660.62312,
	1705.85267,
	1756.34372,
	1803.03751,
	1855.55009,
	1903.87186,
	1958.61575,
	2008.99678,
	2065.34081,
	2116.53174,
	2174.75144,
	2227.24046,
	2286.71107,
	2334.72467,
	2382.30107,
	2412.86075,
	2440.19453,
	2454.06478,
	2459.10001,
	2451.71571,
	2434.68372,
	2404.6888,
	2367.15629,
	2312.62957,
	2255.384,
	2181.09339,
	2107.34164,
	2016.32946,
	1927.02893,
	1817.55349,
	1712.68006,
	1587.07577,
	1470.86887,
	1330.42737,
	1206.14536,
	1053.68427,
	932.34317,
	788.29193,
	696.24225,
	611.5339,
	544.99676,
	492.60999,
	450.65358,
	416.32756,
	387.83403,
	363.87664,
	343.46013,
	325.87004,
	310.59306,
	297.22935,
	285.46049,
	275.03443,
	265.7511,
	257.45036,
	250.00035,
	243.29181,
	237.2343,
	231.75173,
	226.77956,
	222.26262,
	218.15373,
	214.41231,
	210.99364,
	207.86736,
	204.98974,
	202.32907,
	199.85763,
	197.55163,
	195.39062,
	193.357,
	191.43587,
	189.61455,
	187.88248,
	186.23068,
	184.65166,
	183.13911,
	181.68774,
	180.2931,
	178.95149,
	177.65981,
	176.41537,
	175.21587,
	174.0593,
	172.94393,
	171.86825,
	170.83094,
	169.83086,
	168.86699,
	167.93843,
	167.04441,
	166.18422,
	165.35726,
	164.56299,
	163.80093,
	163.07064,
	162.37175
], te = [...D, ...Array(360 - D.length).fill(0)], O = .1, k = 4;
function A(e) {
	let t = 1.15, n = .04, r = Math.max(e, 1), i = 128 + 768 * (Math.log(r / 100) / Math.log(100)), a = r / 100, o = .5 * (a + Math.sqrt(a * (a + 4 * n))), s = o / (i / o / (i / o + 1)) ** t, c = 10.013 / 100 * (1 + Math.log(r / 100) / Math.log(2) * .14), l = .5 * (c + Math.sqrt(c * (c + 4 * n))), u = .18 / (-(o * (l / s) ** (1 / t)) / ((l / s) ** (1 / t) - 1));
	return {
		s2: u * o,
		m2: o / (i / o / (i / o + u)) ** t,
		g: t,
		t1: n,
		nr: 100,
		n: r
	};
}
function j(e, t) {
	if (!(t > 0)) return 0;
	let n = e.m2 * (t / (t + e.s2)) ** +e.g;
	return n * n / (n + e.t1) * e.nr;
}
var M = t(C.map(Math.fround)), N = i(M);
if (!N) throw Error("singular Rec.2020 matrix");
var P = N, F = (e, t) => e[t * 3] + e[t * 3 + 1] + e[t * 3 + 2], I = F(M, 0) / F(M, 1), L = F(M, 2) / F(M, 1), R = (e, t) => {
	let n = 180 / Math.PI * Math.atan2(e, t);
	return n < 0 && (n += 360), Math.min(359, Math.max(0, Math.trunc(n)));
};
function ne(e, t) {
	let n = e + 1 + t, r = e / n, i = t / n, a = Array(360).fill(0), o = (e, t) => {
		let n = 1 - e - t, o = e - r, s = n - i, c = Math.sqrt(o * o + s * s), l = R(s, o);
		c > a[l] && (a[l] = c);
	}, s = E.length / 2;
	for (let e = 0; e < s; e++) o(E[2 * e], E[2 * e + 1]);
	let c = E[2 * (s - 1)], l = E[2 * (s - 1) + 1], u = E[0], d = E[1], f = c / l, p = (1 - c - l) / l, m = u / d, h = (1 - u - d) / d;
	for (let e = 1; e <= 32; e++) {
		let t = e / 33, n = f + t * (m - f), r = p + t * (h - p), i = n + 1 + r;
		o(n / i, 1 / i);
	}
	let g = 0;
	for (let e = 0; e < 360; e++) a[e] > 0 ? g = a[e] : g > 0 && (a[e] = g);
	g = 0;
	for (let e = 359; e >= 0; e--) a[e] > 0 ? g = a[e] : g > 0 && (a[e] = g);
	let _ = 1e6;
	for (let e of a) e > 0 && e < _ && (_ = e);
	return _ > 1e5 && (_ = 1), a.map((e) => e <= 0 ? _ : e);
}
var re = ne(I, L);
function ie(e, t, n) {
	return Math.expm1(-t * e) / Math.expm1(-t) * ((1 + Math.exp(-t * (1 - n))) / (1 + Math.exp(-t * (e - n))));
}
function ae(e, t) {
	let n = t / 100;
	return {
		gain: e,
		shift: n,
		r05: ie(.5, e, n)
	};
}
var oe = (e, n) => t(e.slice(n * 9, n * 9 + 9));
function se(e) {
	let t = e.color_look === 11, n = e.output_cs >= 0 && e.output_cs <= 4 ? e.output_cs : 1, r = Math.max(e.chroma_x_contrast, 1e-4), i = Math.max(e.chroma_z_contrast, 1e-4), a = t ? Math.min(r, k) : r, o = t ? Math.min(i, k) : i, s = t ? O * e.mono_green : 0, c = -Math.max(Math.min(e.gamma, 1), -1);
	return {
		exposureFactor: 2 ** e.input_exposure,
		contrast: Math.max(e.contrast, .001),
		contrastPivot: 1 - Math.max(Math.min(e.contrast_pivot, .99), .01),
		lumaCoeff: x[n],
		hlDesat: Math.max(e.hl_desaturation, 0),
		hlDesatThreshold: Math.max(e.hl_desat_threshold, 0),
		hlRotation: e.hl_hue_shift,
		gamma: c,
		gammaPower: 2 ** c,
		vibrance: Math.max(e.vibrance, 0),
		chromaticBoost: Math.max(e.chromatic_boost, 0),
		gamutKnee: Math.max(e.gamut_knee, 0),
		gamutSteepness: Math.max(e.gamut_steepness, 1e-6),
		toePower: Math.max(e.toe_power, 0),
		shoulderPower: Math.max(e.shoulder_power, 0),
		gamutFwd: oe(w, n),
		gamutInv: oe(T, n),
		gamutEnable: n !== 1,
		ssts: A(200 * (1 + e.peak_luminance / 100)),
		chromaX: ae(a, e.chroma_x_pivot),
		chromaZ: ae(o, e.chroma_z_pivot),
		monoXGain: t ? O * r - s : 0,
		monoZGain: t ? O * i - s : 0,
		monochrome: t
	};
}
//#endregion
//#region src/autotune.ts
var ce = [
	"Contrasty",
	"Neutral",
	"Soft"
], le = [
	{
		targetSd: 1.8,
		gain: 1,
		contrastMin: .6,
		contrastMax: 3.5,
		toeBase: 1.15,
		toeAmplitude: -.4,
		shoulderAmplitude: .4
	},
	{
		targetSd: 1.8,
		gain: .88,
		contrastMin: .7,
		contrastMax: 3.1,
		toeBase: 1.08,
		toeAmplitude: -.35,
		shoulderAmplitude: .35
	},
	{
		targetSd: 1.8,
		gain: .78,
		contrastMin: .8,
		contrastMax: 2.8,
		toeBase: 1,
		toeAmplitude: -.3,
		shoulderAmplitude: .3
	}
], ue = 2048, de = -20, fe = .99, pe = .92, z = .18;
function B(e, t) {
	let n = A(t), r = j(n, e) / n.nr;
	return Math.min(Math.max(r, 0) ** (1 / 2.4), 1);
}
var me = (e) => 200 * (1 + e / 100), he = (e) => (e / 200 - 1) * 100, V = (e, t, n) => Math.max(Math.min(e, n), t);
function ge(e, t, n, r = 0) {
	let i = le[n], [a, o, s] = [
		M[3],
		M[4],
		M[5]
	], c = t > 1e6 ? 4 : 1, l = (t) => a * e[4 * t] + o * e[4 * t + 1] + s * e[4 * t + 2], u = new Uint32Array(ue), d = ue / 36, f = 0;
	for (let e = 0; e < t; e += c) {
		let t = l(e);
		if (t > 1e-6) {
			f++;
			let e = Math.trunc((Math.log2(t) - de) * d);
			u[V(e, 0, 2047)]++;
		}
	}
	if (f === 0) return null;
	let p = Math.trunc(f * .15), m = Math.trunc(f * .95), h = Math.trunc(f * fe), g = 0, _ = 0, v = 2047, y = !1, b = 0;
	for (let e = 0; e < ue; e++) {
		let t = u[e];
		if (t === 0) continue;
		let n = b;
		if (b += t, b > p && n < m) {
			let r = t;
			n < p && (r -= p - n), b > m && (r -= b - m), g += r * (de + (e + .5) / d), _ += r;
		}
		!y && b >= h && (v = e, y = !0);
	}
	let ee = r > 1e-6 ? r : _ > 0 ? 2 ** (g / _) : z, x = Math.log2(z / ee), S = V(x, -2, 2), C = 2 ** (de + (v + .5) / d + x), w, T = 1, E = 400;
	if (B(C, E) <= pe) w = 200;
	else if (B(C, T) >= pe) w = T;
	else {
		for (let e = 0; e < 24; e++) {
			let e = .5 * (T + E);
			B(C, e) > pe ? E = e : T = e;
		}
		w = .5 * (T + E);
	}
	let D = V(he(w), -100, 100), te = V(1 - B(z, me(D)), .01, .99), O = Math.log2(z), k = 2 ** x, A = 0, j = 0, N = 0, P = 0, F = 0, I = 0;
	for (let e = 0; e < t; e += c) {
		let t = l(e) * k;
		if (t > .001) {
			let e = Math.log2(t) - O;
			A += e * e, j++, e < 0 ? (N += e * e, P++) : (F += e * e, I++);
		}
	}
	let L = j > 0 ? Math.sqrt(A / j) : 1.5, R = P > 0 ? Math.sqrt(N / P) : i.targetSd, ne = I > 0 ? Math.sqrt(F / I) : i.targetSd, re = V(i.gain * 2.25 * (i.targetSd / Math.max(L, .4)), i.contrastMin, i.contrastMax), ie = V((R - 1.2) / 1.3, 0, 1), ae = V((ne - 1.2) / 1.3, 0, 1);
	return {
		input_exposure: S,
		peak_luminance: D,
		contrast_pivot: te,
		contrast: re,
		toe_power: i.toeBase - i.toeAmplitude * ie,
		shoulder_power: i.toeBase - i.shoulderAmplitude * ae
	};
}
var _e = {
	encoding: "linear",
	primaries: "rec2020"
};
async function ve(e) {
	if (!e.develop.captureFloatFrame) return "unsupported";
	let t = e.stores.useDevelopStore.getState().params, n = await e.develop.captureFloatFrame(t, {
		point: "scene",
		space: _e
	});
	return n ? n.point === "scene" ? n : "unsupported" : "no frame";
}
//#endregion
//#region src/runtime.ts
var ye = null;
function be(e) {
	ye = e;
}
function H() {
	if (!ye) throw Error("[colorimetric-film] api() called before activate()");
	return ye;
}
function U(e, t, ...n) {
	return H().react.createElement(e, t, ...n);
}
//#endregion
//#region src/derive.ts
var xe = {
	tdcfTone: "vec4",
	tdcfCurve: "vec4",
	tdcfSstsP: "vec4",
	tdcfHl: "vec4",
	tdcfGamut: "vec4",
	tdcfLuma: "vec3",
	tdcfGamutFwd: "mat3",
	tdcfGamutInv: "mat3",
	tdcfChroma: "vec4",
	tdcfChromaN: "vec4",
	tdcfLook: "mat3",
	tdcfLookMix: "vec4"
}, W = (e) => +!!e;
function Se(n) {
	let r = se(n), i = n.color_look >= 1 && n.color_look <= 10, a = i ? t(S.slice((n.color_look - 1) * 9, n.color_look * 9)) : e;
	return {
		tdcfTone: [
			r.exposureFactor,
			r.contrast,
			r.contrastPivot,
			r.gammaPower
		],
		tdcfCurve: [
			r.toePower,
			r.shoulderPower,
			W(r.contrast !== 1 || r.toePower !== 1 || r.shoulderPower !== 1),
			W(r.gamma !== 0)
		],
		tdcfSstsP: [
			r.ssts.s2,
			r.ssts.m2,
			r.ssts.g,
			r.ssts.t1
		],
		tdcfHl: [
			r.hlDesat,
			r.hlDesatThreshold,
			r.hlRotation,
			r.vibrance
		],
		tdcfGamut: [
			r.gamutKnee,
			r.gamutSteepness,
			r.chromaticBoost,
			W(r.gamutEnable)
		],
		tdcfLuma: [...r.lumaCoeff],
		tdcfGamutFwd: l(r.gamutFwd),
		tdcfGamutInv: l(r.gamutInv),
		tdcfChroma: [
			r.chromaX.gain,
			r.chromaX.shift,
			r.chromaZ.gain,
			r.chromaZ.shift
		],
		tdcfChromaN: [
			r.chromaX.r05,
			r.chromaZ.r05,
			r.monoXGain,
			r.monoZGain
		],
		tdcfLook: l(a),
		tdcfLookMix: [
			n.look_opacity,
			W(i),
			W(r.monochrome),
			Math.max(n.hl_detail_recovery, 0)
		]
	};
}
//#endregion
//#region src/colour/profiles.ts
var Ce = {
	x: .31271,
	y: .32902
}, we = [
	.9642,
	1,
	.8249
], Te = [
	.8951,
	.2664,
	-.1614,
	-.7502,
	1.7135,
	.0367,
	.0389,
	-.0685,
	1.0296
], Ee = (e) => [
	e.x / e.y,
	1,
	(1 - e.x - e.y) / e.y
];
function G(e) {
	let t = e[0] + e[1] + e[2];
	return {
		x: e[0] / t,
		y: e[1] / t
	};
}
function De(e, t) {
	let i = s(Ee(e[0]), Ee(e[1]), Ee(e[2]));
	return n(i, o(r(a(i), t)));
}
function Oe(e, t) {
	let i = r(Te, e), s = r(Te, t);
	return n(n(a(Te), o([
		s[0] / i[0],
		s[1] / i[1],
		s[2] / i[2]
	])), Te);
}
function ke(e) {
	let t = Ee(Ce), r = n(Oe(t, we), De(e, t));
	return {
		toXyz: r,
		fromXyz: a(r),
		primaries: [
			G(c(r, 0)),
			G(c(r, 1)),
			G(c(r, 2))
		],
		white: G(we)
	};
}
var Ae = ke([
	{
		x: .708,
		y: .292
	},
	{
		x: .17,
		y: .797
	},
	{
		x: .131,
		y: .046
	}
]);
ke([
	{
		x: .68,
		y: .32
	},
	{
		x: .265,
		y: .69
	},
	{
		x: .15,
		y: .06
	}
]), ke([
	{
		x: .64,
		y: .33
	},
	{
		x: .21,
		y: .71
	},
	{
		x: .15,
		y: .06
	}
]);
var je = ke([
	{
		x: .64,
		y: .33
	},
	{
		x: .3,
		y: .6
	},
	{
		x: .15,
		y: .06
	}
]), Me = n(Ae.fromXyz, je.toXyz), Ne = a(Me);
//#endregion
//#region src/glsl.ts
function K(e) {
	let t = e.toPrecision(10);
	return /[.e]/.test(t) ? t : `${t}.0`;
}
var q = (e) => `mat3(${l(e).map(K).join(", ")})`, Pe = (e, t) => `const float ${e}[${t.length}] = float[${t.length}](${t.map(K).join(", ")});`, Fe = I + 1 + L, Ie = `${`const mat3 TDCF_709_TO_2020 = ${q(Me)};
const mat3 TDCF_2020_TO_709 = ${q(Ne)};
const mat3 TDCF_IN = ${q(M)};
const mat3 TDCF_OUT = ${q(P)};
const float TDCF_WHITE_X = ${K(I)};
const float TDCF_WHITE_Z = ${K(L)};
const float TDCF_WCX = ${K(I / Fe)};
const float TDCF_WCZ = ${K(L / Fe)};
const float TDCF_SHAPE_REF = 2.090563;
${Pe("TDCF_BOUNDARY", re)}
${Pe("TDCF_REACH", te)}`}
bool tdcfFinite(float x) {
  return abs(x) <= 3.0e38;
}
vec3 tdcfEncode(vec3 x) {
  vec3 a = abs(x);
  vec3 e = mix(a * 12.92, 1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, greaterThanEqual(a, vec3(0.0031308)));
  return sign(x) * e;
}
float tdcfSsts(float x) {
  if (!(x > 0.0)) return 0.0;
  float f = tdcfSstsP.y * pow(x / (x + tdcfSstsP.x), tdcfSstsP.z);
  return (f * f) / (f + tdcfSstsP.w) * 100.0;
}
float tdcfYTm(float yScene) {
  float y = tdcfSsts(yScene * tdcfTone.x) / 100.0;
  y = pow(max(y, 0.0), 1.0 / 2.4);
  y = min(y, 1.0);
  if (tdcfCurve.z > 0.5) {
    float c = tdcfTone.y;
    float p = tdcfTone.z;
    if (y <= p) {
      float t = p > 0.0 ? y / p : 0.0;
      float e = c * (tdcfCurve.x + (1.0 - tdcfCurve.x) * t);
      y = p * pow(max(y / p, 0.0), e);
    } else {
      float rp = 1.0 - p;
      float t = rp > 0.0 ? (1.0 - y) / rp : 0.0;
      float e = c * (tdcfCurve.y + (1.0 - tdcfCurve.y) * t);
      y = 1.0 - rp * pow(max((1.0 - y) / rp, 0.0), e);
    }
  }
  return y;
}
float tdcfDesat(float yNorm, float hlDesat, float threshold) {
  if (hlDesat <= 0.0 || yNorm <= threshold) return 0.0;
  if (!tdcfFinite(yNorm)) return 0.0;
  float t = max(yNorm - threshold, 0.0) / yNorm;
  float x = min(t * hlDesat, 1.0);
  return x * x;
}
float tdcfDegrees(float dz, float dx) {
  if (dz == 0.0 && dx == 0.0) return 0.0;
  float a = degrees(atan(dz, dx));
  if (a < 0.0) a += 360.0;
  if (a >= 360.0) a -= 360.0;
  return a;
}
float tdcfBoundary(float angle) {
  int bin = min(int(angle), 359);
  int next = bin == 359 ? 0 : bin + 1;
  return TDCF_BOUNDARY[bin] + (angle - float(bin)) * (TDCF_BOUNDARY[next] - TDCF_BOUNDARY[bin]);
}
float tdcfReach(float h) {
  int i0 = min(int(h), 359);
  int i1 = i0 == 359 ? 0 : i0 + 1;
  return TDCF_REACH[i0] + (h - float(i0)) * (TDCF_REACH[i1] - TDCF_REACH[i0]);
}
float tdcfChromaNorm(float h) {
  float hr = radians(h);
  float a = cos(hr);
  float b = sin(hr);
  float a2 = a * a - b * b;
  float b2 = 2.0 * a * b;
  float a3 = 4.0 * a * a * a - 3.0 * a;
  float b3 = 3.0 * b - 4.0 * b * b * b;
  return 11.34072 * a + 16.46899 * a2 + 7.8838 * a3 + 14.66441 * b - 6.37224 * b2 + 9.19364 * b3 + 77.12896;
}
float tdcfExpm1(float x) {
  return abs(x) < 0.1 ? x * (1.0 + x / 2.0 * (1.0 + x / 3.0 * (1.0 + x / 4.0 * (1.0 + x / 5.0)))) : exp(x) - 1.0;
}
float tdcfResponse(float u, float gain, float shift) {
  return (tdcfExpm1(-gain * u) / tdcfExpm1(-gain)) * ((1.0 + exp(-gain * (1.0 - shift))) / (1.0 + exp(-gain * (u - shift))));
}
float tdcfNeutral(float r, float u01, float r05) {
  return u01 <= 0.5 ? 0.5 * r / max(r05, 1.0e-4) : 0.5 + 0.5 * (r - r05) / max(1.0 - r05, 1.0e-4);
}
vec2 tdcfChromaContrast(vec2 xz, float yTm) {
  if (yTm <= 0.0) return xz;
  if (!tdcfFinite(xz.x) || !tdcfFinite(xz.y)) return xz;
  float sum = xz.x + yTm + xz.y;
  if (sum <= 0.0) return xz;
  float dx = xz.x / sum - TDCF_WCX;
  float dz = xz.y / sum - TDCF_WCZ;
  float maxDist = tdcfBoundary(tdcfDegrees(dz, dx));
  if (maxDist <= 0.0) return xz;
  float u01 = 0.5 * (clamp(dx / maxDist, -1.0, 1.0) + 1.0);
  float w01 = 0.5 * (clamp(dz / maxDist, -1.0, 1.0) + 1.0);
  float rnu = tdcfNeutral(tdcfResponse(u01, tdcfChroma.x, tdcfChroma.y), u01, tdcfChromaN.x);
  float rnw = tdcfNeutral(tdcfResponse(w01, tdcfChroma.z, tdcfChroma.w), w01, tdcfChromaN.y);
  float cx = TDCF_WCX + (2.0 * rnu - 1.0) * maxDist;
  float cz = TDCF_WCZ + (2.0 * rnw - 1.0) * maxDist;
  float yNew = 1.0 - cx - cz;
  return yNew > 0.0 ? vec2(cx, cz) * (yTm / yNew) : xz;
}
vec2 tdcfSpectralGamut(vec2 xz, float yTm) {
  if (yTm <= 0.0) return xz;
  if (!tdcfFinite(xz.x) || !tdcfFinite(xz.y)) return xz;
  float sum = xz.x + yTm + xz.y;
  if (sum <= 0.0) return xz;
  float dx = xz.x / sum - TDCF_WCX;
  float dz = xz.y / sum - TDCF_WCZ;
  float chromaSq = dx * dx + dz * dz;
  float maxDist = tdcfBoundary(tdcfDegrees(dz, dx));
  float target = maxDist * 0.92;
  if (maxDist > 0.0 && chromaSq > target * target) {
    float chroma = sqrt(chromaSq);
    float excess = chroma - target;
    float bsteep = max(target * 0.05, 0.001);
    float scale = (chroma - excess / (excess + bsteep) * excess) / chroma;
    float cx = TDCF_WCX + scale * dx;
    float cz = TDCF_WCZ + scale * dz;
    float yNew = 1.0 - cx - cz;
    if (yNew > 0.0) {
      xz = vec2(cx, cz) * (yTm / yNew);
      dx = cx - TDCF_WCX;
      dz = cz - TDCF_WCZ;
      chromaSq = dx * dx + dz * dz;
    }
  }
  float angle = tdcfDegrees(dz, dx);
  float shape = tdcfReach(angle) / max(tdcfChromaNorm(angle), 1.0e-6);
  float kneeMod = tdcfGamut.x * sqrt(max(shape / TDCF_SHAPE_REF, 0.0));
  if (chromaSq > kneeMod * kneeMod) {
    float chroma = sqrt(chromaSq);
    float excess = chroma - kneeMod;
    float scale = (chroma - excess / (excess + tdcfGamut.y) * excess) / chroma;
    float xNew = TDCF_WCX + scale * dx;
    float zNew = TDCF_WCZ + scale * dz;
    float yNew = 1.0 - xNew - zNew;
    if (yNew > 0.0) xz = vec2(xNew, zNew) * (yTm / yNew);
  }
  return xz;
}
vec3 tdcfGamutCompress(vec3 rgb) {
  float luma = dot(tdcfLuma, rgb);
  float anchor = luma > 1.0e-4 ? luma : 1.0;
  float t = 0.0;
  for (int c = 0; c < 3; c++) {
    if (rgb[c] < 0.0) {
      float denom = anchor - rgb[c];
      t = max(t, denom > 1.0e-6 ? -rgb[c] / denom : 1.0);
    } else if (rgb[c] > 1.0) {
      float denom = rgb[c] - anchor;
      t = max(t, denom > 1.0e-6 ? (rgb[c] - 1.0) / denom : 1.0);
    }
  }
  if (t <= 0.0) return rgb;
  float blend = min(t, 1.0);
  return (1.0 - blend) * rgb + blend * anchor;
}
vec3 tdcfSaturate(vec3 rgb, float gain) {
  float luma = dot(tdcfLuma, rgb);
  return luma + gain * (rgb - luma);
}
float tdcfSatNorm(vec3 rgb) {
  float luma = dot(tdcfLuma, rgb);
  float maxc = max(rgb.r, max(rgb.g, rgb.b));
  float minc = min(rgb.r, min(rgb.g, rgb.b));
  float level = max(maxc, max(abs(minc), abs(luma)));
  return level > 0.0 ? (maxc - minc) / level : 0.0;
}
vec3 tdcfEval(vec3 rgbIn) {
  vec3 xyz = TDCF_IN * rgbIn;
  float yAbs = xyz.y;
  if (!(yAbs > 1.0e-10) || !tdcfFinite(yAbs)) return vec3(0.0);
  float xRatio = clamp(xyz.x / yAbs, -100.0, 100.0);
  float zRatio = clamp(xyz.z / yAbs, -100.0, 100.0);

  float yTm = tdcfYTm(yAbs);
  if (tdcfCurve.w > 0.5) yTm = pow(clamp(yTm, 0.0, 1.0), tdcfTone.w);

  vec2 xz = vec2(xRatio, zRatio) * yTm;
  xz = tdcfChromaContrast(xz, yTm);
  xz = tdcfSpectralGamut(xz, yTm);

  float yExposed = yAbs * tdcfTone.x;
  float w = tdcfDesat(yExposed, tdcfHl.x, tdcfHl.y);

  if (tdcfLookMix.z > 0.5) {
    float off = tdcfChromaN.z * (xz.x - TDCF_WHITE_X * yTm) + tdcfChromaN.w * (xz.y - TDCF_WHITE_Z * yTm);
    float lim = 0.6 * yTm;
    float aOff = abs(off);
    if (aOff > lim) {
      float soft = max(lim * 0.5, 1.0e-6);
      float over = aOff - lim;
      float v = lim + over / (over + soft) * soft;
      off = off < 0.0 ? -v : v;
    }
    float grey = max(yTm + off, 0.0);
    if (!tdcfFinite(grey)) grey = 0.0;
    if (w > 0.0 && tdcfFinite(w)) {
      float ts = min(w, 1.0);
      grey = grey * (1.0 - ts) + ts;
    }
    return vec3(grey);
  }

  vec3 rgb = TDCF_OUT * vec3(xz.x, yTm, xz.y);

  if (tdcfHl.z != 0.0 && yAbs > 1.0e-10) {
    float compression = min(yTm / (yAbs * tdcfTone.x), 1.0);
    float angle = tdcfHl.z * 0.8 * pow(1.0 - compression, 0.5);
    float ca = cos(angle);
    float sa = sin(angle);
    if (tdcfFinite(ca) && tdcfFinite(sa)) {
      vec3 lc = tdcfLuma;
      float y = dot(lc, rgb);
      float u = rgb.r - y;
      float v = rgb.b - y;
      float ur = u * ca - v * sa;
      float vr = u * sa + v * ca;
      float t = 1.0;
      if (ur > 0.0) t = min(t, (1.0 - y) / ur);
      if (ur < 0.0) t = min(t, -y / ur);
      if (vr > 0.0) t = min(t, (1.0 - y) / vr);
      if (vr < 0.0) t = min(t, -y / vr);
      if (lc.g != 0.0) {
        float gd = -(lc.r * ur + lc.b * vr) / lc.g;
        if (gd > 0.0) t = min(t, (1.0 - y) / gd);
        if (gd < 0.0) t = min(t, -y / gd);
      }
      t = max(t, 0.0);
      rgb.r = y + t * ur;
      rgb.b = y + t * vr;
      if (lc.g != 0.0) rgb.g = y - (lc.r / lc.g) * t * ur - (lc.b / lc.g) * t * vr;
    }
  }

  if (w > 0.0 && tdcfFinite(w)) {
    float maxc = max(rgb.r, max(rgb.g, rgb.b));
    float minc = min(rgb.r, min(rgb.g, rgb.b));
    float sat = maxc > 0.0 ? (maxc - minc) / maxc : 0.0;
    float ss = (sat * sat) / (sat * sat + (1.0 - sat) * (1.0 - sat) + 1.0e-6);
    float wFinal = w;
    if (tdcfHl.x > 0.0) wFinal = min(wFinal + tdcfDesat(yExposed, 1.0, tdcfHl.y) * (tdcfHl.x * ss * 0.35), 1.0);
    float ts = min(wFinal, 1.0);
    if (tdcfFinite(ts)) rgb = rgb * (1.0 - ts) + ts;
  }

  if (tdcfHl.w != 1.0) {
    float vib = max(tdcfHl.w, 0.0);
    float gain = vib;
    if (vib > 1.0) {
      float p = 1.0 - min(tdcfSatNorm(rgb), 1.0);
      gain = 1.0 + (vib - 1.0) * (p * p);
    }
    rgb = tdcfSaturate(rgb, gain);
  }

  if (tdcfGamut.z > 0.0) {
    float maxc = max(rgb.r, max(rgb.g, rgb.b));
    float minc = min(rgb.r, min(rgb.g, rgb.b));
    float satM = maxc - minc;
    float logRel = log2(max(yAbs / 0.18, 1.0e-10));
    float wGauss = exp(-(logRel * logRel) / (2.0 * 1.85 * 1.85));
    float wMid = logRel <= 0.0 ? 1.0 : 1.328 * wGauss - 0.328;
    float pp = 1.0 - min(tdcfSatNorm(rgb), 1.0);
    float hue = 0.0;
    if (satM > 0.0) {
      if (maxc == rgb.r) hue = 60.0 * ((rgb.g - rgb.b) / satM);
      else if (maxc == rgb.g) hue = 60.0 * ((rgb.b - rgb.r) / satM + 2.0);
      else hue = 60.0 * ((rgb.r - rgb.g) / satM + 4.0);
      if (hue < 0.0) hue += 360.0;
    }
    float hueMod = 1.0 + 0.1 * cos(radians(hue - 60.0));
    rgb = tdcfSaturate(rgb, 1.0 + tdcfGamut.z * wMid * (pp * pp) * hueMod);
  }

  rgb = tdcfGamutCompress(rgb);
  if (tdcfGamut.w > 0.5) rgb = tdcfGamutInv * max(tdcfGamutFwd * rgb, vec3(0.0));

  return vec3(
    tdcfFinite(rgb.r) ? max(rgb.r, 0.0) : 0.0,
    tdcfFinite(rgb.g) ? max(rgb.g, 0.0) : 0.0,
    tdcfFinite(rgb.b) ? max(rgb.b, 0.0) : 0.0);
}
vec3 tdcfRecover(vec3 o, float lumOrig, float desatFactor) {
  float lumTm = dot(tdcfLuma, o);
  if (!(lumTm > 1.0e-6 && lumOrig > 1.0e-6)) return o;
  float base = max(slTransformPass.x * lumOrig + slTransformPass.y, 0.0);
  float detail = lumOrig - base;
  float t = min(tdcfLookMix.w, 1.0);
  float dl = max(lumOrig * 0.1 * (1.0 - t * 0.5), 1.0e-6);
  float da = abs(detail);
  if (da > dl) {
    float excess = da - dl;
    float bsteep = max(dl * 0.25 * (1.0 - t * 0.4), 0.001);
    float v = dl + excess / (excess + bsteep) * bsteep;
    detail = detail < 0.0 ? -v : v;
  }
  float lumFinal = lumTm + detail * tdcfLookMix.w * (1.0 - desatFactor) * (lumTm / lumOrig);
  if (!(lumFinal > 1.0e-6)) return o;
  return o * max(lumFinal / lumTm, 0.25);
}
vec3 tdcfProcess(vec3 c) {
  vec3 rgb = vec3(
    tdcfFinite(c.r) ? max(c.r, 0.0) : 0.0,
    tdcfFinite(c.g) ? max(c.g, 0.0) : 0.0,
    tdcfFinite(c.b) ? max(c.b, 0.0) : 0.0);
  float lumOrig = dot(tdcfLuma, rgb) * tdcfTone.x;
  float lum = max(rgb.r, max(rgb.g, rgb.b));
  float w = tdcfDesat(lum * tdcfTone.x, tdcfHl.x, tdcfHl.y);
  float desatFactor = 0.0;
  if (w > 0.0 && tdcfFinite(w)) {
    float t = min(w, 1.0);
    float ts = (t * t) / (t * t + (1.0 - t) * (1.0 - t) + 1.0e-6);
    desatFactor = ts;
    if (tdcfFinite(ts) && ts > 0.0) rgb = rgb * (1.0 - ts) + lum * ts;
  }
  vec3 o = tdcfEval(rgb);
  if (tdcfLookMix.y > 0.5) o = max(o * (1.0 - tdcfLookMix.x) + (tdcfLook * o) * tdcfLookMix.x, vec3(0.0));
  // The pre-pass runs exactly while the recovery isn't 0 (its dormantWhen),
  // but its result is only the filter of this image where core says so (float
  // targets, drawn this frame); elsewhere the recovery is off.
  if (tdcfLookMix.w > 0.0 && slTransformPassValid) o = tdcfRecover(o, lumOrig, desatFactor);
  return o;
}`, Le = "vec3 pipelineToDisplay(vec3 lin) {\n  return tdcfEncode(TDCF_2020_TO_709 * tdcfProcess(TDCF_709_TO_2020 * lin));\n}";
Number.isFinite;
function Re(e, t) {
	if (t.ssts.n <= 0) return 0;
	let n = j(t.ssts, e * t.exposureFactor) / t.ssts.nr;
	if (n = Math.max(n, 0) ** (1 / 2.4), n = Math.min(n, 1), t.contrast !== 1 || t.toePower !== 1 || t.shoulderPower !== 1) {
		let e = t.contrast, r = t.contrastPivot;
		if (n <= r) {
			let i = r > 0 ? n / r : 0, a = e * (t.toePower + (1 - t.toePower) * i);
			n = r * Math.max(n / r, 0) ** +a;
		} else {
			let i = 1 - r, a = i > 0 ? (1 - n) / i : 0, o = e * (t.shoulderPower + (1 - t.shoulderPower) * a);
			n = 1 - i * Math.max((1 - n) / i, 0) ** +o;
		}
	}
	return n;
}
function ze(e, t) {
	let n = Re(e, t);
	return t.gamma === 0 ? n : Math.min(Math.max(n, 0), 1) ** +t.gammaPower;
}
var Be = I + 1 + L;
I / Be, L / Be;
//#endregion
//#region src/detail.ts
var Ve = .05 * .05, He = x.map((e, t) => `  ${t === 0 ? "" : "else "}if (cs == ${t}) lc = vec3(${e.map(K).join(", ")});`).join("\n"), Ue = `const mat3 TDCF_PASS_709_TO_2020 = ${q(Me)};
float tdcfPassRadius() {
  float full = floor(max(4.0, 8.0 * length(uSourceSize) / 8848.0));
  return full * max(1.0 / uTexel.x, 1.0 / uTexel.y) / max(uSourceSize.x, uSourceSize.y);
}
float tdcfTap(int i, float r) {
  return clamp(r + 1.0 - abs(float(i)), 0.0, 1.0);
}
ivec2 tdcfPassSize() {
  return ivec2(round(1.0 / uTexel));
}
float tdcfLumaAt(highp ivec2 texel) {
  vec3 rgb = TDCF_PASS_709_TO_2020 * fetchInput(texel);
  rgb = vec3(
    abs(rgb.r) <= 3.0e38 ? max(rgb.r, 0.0) : 0.0,
    abs(rgb.g) <= 3.0e38 ? max(rgb.g, 0.0) : 0.0,
    abs(rgb.b) <= 3.0e38 ? max(rgb.b, 0.0) : 0.0);
  int cs = output_cs;
  vec3 lc = vec3(0.2627, 0.678, 0.0593);
${He}
  return dot(lc, rgb) * exp2(input_exposure);
}
vec2 tdcfPrevAt(highp ivec2 texel) {
  return readPrev((vec2(texel) + 0.5) * uTexel).xy;
}`, We = [
	{
		key: "input_exposure",
		glslType: "float",
		default: 0
	},
	{
		key: "output_cs",
		glslType: "int",
		default: 1
	},
	{
		key: "hl_detail_recovery",
		glslType: "float",
		default: .2
	}
], Ge = "ivec2 px = ivec2(gl_FragCoord.xy);\n  int width = tdcfPassSize().x;\n  float r = tdcfPassRadius();\n  int n = int(r) + 1;\n  float centre = tdcfLumaAt(px);\n  float s1 = 0.0;\n  float s2 = 0.0;\n  float total = 0.0;\n  for (int i = -n; i <= n; i++) {\n    int x = px.x + i;\n    float t = tdcfTap(i, r);\n    if (t <= 0.0 || x < 0 || x >= width) continue;\n    float d = tdcfLumaAt(ivec2(x, px.y)) - centre;\n    s1 += t * d;\n    s2 += t * d * d;\n    total += t;\n  }\n  c = vec3(s1 / total, s2 / total, 0.0);", Ke = `ivec2 px = ivec2(gl_FragCoord.xy);
  int height = tdcfPassSize().y;
  float r = tdcfPassRadius();
  int n = int(r) + 1;
  float centre = tdcfLumaAt(px);
  float m1 = 0.0;
  float m2 = 0.0;
  float total = 0.0;
  for (int i = -n; i <= n; i++) {
    int y = px.y + i;
    float t = tdcfTap(i, r);
    if (t <= 0.0 || y < 0 || y >= height) continue;
    vec2 row = tdcfPrevAt(ivec2(px.x, y));
    float d = tdcfLumaAt(ivec2(px.x, y)) - centre;
    m1 += t * (row.x + d);
    m2 += t * (row.y + 2.0 * d * row.x + d * d);
    total += t;
  }
  m1 /= total;
  m2 /= total;
  float variance = max(m2 - m1 * m1, 0.0);
  float mean = centre + m1;
  float a = variance / (variance + ${K(Ve)});
  c = vec3(a, mean - a * mean, 0.0);`, qe = (e) => `ivec2 px = ivec2(gl_FragCoord.xy);
  int size = tdcfPassSize().${e ? "x" : "y"};
  float r = tdcfPassRadius();
  int n = int(r) + 1;
  vec2 sum = vec2(0.0);
  float total = 0.0;
  for (int i = -n; i <= n; i++) {
    int at = px.${e ? "x" : "y"} + i;
    float t = tdcfTap(i, r);
    if (t <= 0.0 || at < 0 || at >= size) continue;
    sum += t * tdcfPrevAt(${e ? "ivec2(at, px.y)" : "ivec2(px.x, at)"});
    total += t;
  }
  c = vec3(sum / total, 0.0);`, Je = [
	{
		glsl: Ge,
		helpers: Ue,
		uniforms: We
	},
	{
		glsl: Ke,
		helpers: Ue,
		uniforms: We
	},
	{
		glsl: qe(!0),
		helpers: Ue,
		uniforms: We
	},
	{
		glsl: qe(!1),
		helpers: Ue,
		uniforms: We
	}
], J = "colorimetric-film.3dcf", Ye = "3D Colorimetric Film", Xe = Se(y);
function Ze() {
	return {
		id: J,
		name: Ye,
		description: "Tone and colour worked out in CIE XYZ: a single-stage tone scale on luminance with contrast around a pivot, chromaticity carried along and rolled off toward the spectral locus like film dyes, and bright colours bleaching to white.",
		glsl: Le,
		helpers: Ie,
		skipBaseCurve: !0,
		skipToneShoulder: !0,
		params: u(v),
		derive: {
			uniforms: m(xe, Xe),
			fn: (e) => Se(f(v, e))
		},
		prepass: {
			passes: Je,
			dormantWhen: { hl_detail_recovery: 0 }
		}
	};
}
//#endregion
//#region src/panel/controls.ts
var Y = (e, t, n, r = 100, i = 0, a = 1) => ({
	key: e,
	label: t,
	tooltip: n,
	unit: "%",
	scale: r,
	offset: i,
	step: a
}), Qe = [
	{
		key: "input_exposure",
		label: "Input exposure",
		tooltip: "Exposure before the tone scale, in EV. Positive values brighten the image and push more signal into the tone scale; negative values darken it. 0 EV leaves the reference exposure.",
		unit: "EV",
		scale: 1,
		offset: 0,
		step: .05
	},
	Y("peak_luminance", "Peak luminance", "The tone scale's peak luminance. 0% is 200 nits, the reference; -100% the softest, +100% 400 nits. Lower values give more highlight headroom with a gentler roll-off; higher values clip earlier.", 1),
	Y("contrast", "Contrast", "S-curve contrast around the pivot. -100% is the least contrast, 0% neutral, +100% the most. Negative values soften, positive values sharpen.", 50, -112.5),
	Y("contrast_pivot", "Contrast pivot", "The fulcrum of the contrast S-curve. Higher values shift it toward the shadows and brighten the image; lower values shift it toward the highlights and darken it.", 100, -50),
	Y("shoulder_power", "Shoulder power", "Highlight contrast relative to the main contrast. 0% matches it, -100% removes contrast in the highlights, +100% doubles it.", 100, -100, .1),
	Y("toe_power", "Toe power", "Shadow contrast relative to the main contrast. 0% matches it, -100% removes contrast in the shadows, +100% doubles it.", 100, -100, .1),
	Y("gamma", "Mid-tones", "Gamma of the tone curve. Moving right (+100%) brightens the image, moving left (-100%) darkens it.")
], $e = Y("look_opacity", "Look opacity", "The strength of the colour look."), et = Y("vibrance", "Vibrance", "Smart saturation: boosts pastels while protecting colours that are already saturated.", 100, -100), tt = Y("chromatic_boost", "Chromatic boost", "Accentuates the colour of the mid-tones, with a slight hue contrast in the highlights."), nt = Y("hl_hue_shift", "Abney rotation", "Hue rotation in the highlights, tied to how hard the tone scale compresses them. Positive values rotate toward cool (blue), negative toward warm (salmon). It ramps up as highlights compress, up to about 23° on clipped highlights; mid-tones and shadows stay untouched. Independent of the highlight roll-off."), rt = Y("mono_green", "Green filter", "Green filter for the monochrome look: takes an equal amount from the warm (red) X and cool (blue) Z filters, brightening green tones while darkening red and blue. 0% is off (neutral panchromatic grey).", 10, 0, .1);
function it(e, t) {
	let n = (e, t, n) => Y(e, t, n, 10, 0, .1), r = (e, t, n) => Y(e, t, n, 1, -50, .1);
	return e ? {
		x: n("chroma_x_contrast", t ? "Warm/cool filter strength" : "Warm (red) filter", t ? "Monochrome filter strength on both the warm (red) and cool (blue) chroma axes before the grey is taken. 0% is neutral panchromatic grey; the balance splits the effect between the two axes. Unlock X and Z to drive warm and cool on their own." : "Monochrome filter on the warm (red) X chroma axis before the grey is taken. 0% is neutral panchromatic grey; higher values brighten warm/red tones and darken cool/blue ones."),
		z: n("chroma_z_contrast", "Cool (blue) filter", "Monochrome filter on the cool (blue) Z chroma axis before the grey is taken. 0% is neutral; higher values brighten cool/blue tones and darken warm/red ones."),
		xPivot: r("chroma_x_pivot", "Warm filter neutral point", "Neutral point of the warm (red) filter, relative to the symmetric position (0% is symmetric)."),
		zPivot: r("chroma_z_pivot", "Cool filter neutral point", "Neutral point of the cool (blue) filter, relative to the symmetric position (0% is symmetric)."),
		balance: {
			label: "Warm/cool balance",
			tooltip: "How the balance splits the monochrome filter strength: the favoured axis keeps the full strength, the other is reduced in proportion. 0% is symmetric, +100% warm only, -100% cool only.",
			unit: "%",
			scale: 100,
			offset: 0,
			step: 1
		}
	} : {
		x: n("chroma_x_contrast", t ? "Chroma contrast" : "X-axis chroma contrast", "Contrast on the CIE X chroma offset from white, applied right after the chromaticity is scaled and before the gamut roll-off. 0% is off."),
		z: n("chroma_z_contrast", "Z-axis chroma contrast", "Contrast on the CIE Z chroma offset from white, applied right after the chromaticity is scaled and before the gamut roll-off. 0% is off."),
		xPivot: r("chroma_x_pivot", "X-axis contrast pivot", "Pivot of the X-axis chroma contrast, relative to the symmetric position (0% is symmetric)."),
		zPivot: r("chroma_z_pivot", "Z-axis contrast pivot", "Pivot of the Z-axis chroma contrast, relative to the symmetric position (0% is symmetric)."),
		balance: {
			label: "X/Z balance",
			tooltip: "How the balance splits the chroma contrast: the favoured axis keeps the full strength, the other is reduced in proportion. 0% is symmetric (X = Z), +100% X only, -100% Z only.",
			unit: "%",
			scale: 100,
			offset: 0,
			step: 1
		}
	};
}
var at = [
	Y("hl_desaturation", "Highlight roll-off", "Highlight roll-off: desaturates bright areas toward white, harder on saturated colours. 0% is off, 15% a natural roll-off, 100% the most."),
	Y("hl_detail_recovery", "Detail recovery", "Restores local contrast in the highlights that the tone mapping smoothed: a guided filter separates the original luminance's detail, which is put back after the tone mapping with gain compensation. 0% is off, 100% full recovery."),
	Y("hl_desat_threshold", "Desaturation threshold", "The luminance at which the highlight roll-off begins. Lower values desaturate earlier; higher values keep saturation longer.")
], ot = [Y("gamut_knee", "Gamut knee", "Where the chroma roll-off starts. Lower values start compressing earlier."), Y("gamut_steepness", "Gamut steepness", "How soft the chroma roll-off is. Higher values ease more gradually toward the gamut boundary.")], X = {
	look: "A colour style for the image.",
	target: "The display the image is meant for: its luma weights the vibrance and the highlight bleaching, and colours outside its primaries are pulled in. sRGB is the narrowest, Rec. 2020 the widest (nothing pulled in).",
	lock: "Lock the X and Z axes: one strength drives both, split by the balance, and the Z pivot follows the X pivot.",
	reset: "Reset the X/Z chroma sliders (contrast and pivot) to their defaults.",
	auto: "Measures the scene and sets the input exposure, peak luminance, contrast pivot, contrast, toe and shoulder, in the contrast rendering chosen beside it. Exposure, peak and pivot are the same for each rendering; only the contrast differs.",
	mode: "The contrast rendering auto adjust uses."
}, st = 200, ct = (e) => Math.min(Math.max(e, 0), 1), lt = (e) => (e - -6) / 10;
function ut(e) {
	return Array.from({ length: 201 }, (t, n) => {
		let r = -6 + 10 * n / st;
		return [lt(r), ct(e(.18 * 2 ** r))];
	});
}
function dt(e) {
	let t = se(e);
	return {
		ssts: ut((e) => Math.max(j(t.ssts, e * t.exposureFactor) / t.ssts.nr, 0) ** (1 / 2.4)),
		contrast: ut((e) => Re(e, t)),
		full: ut((e) => ze(e, t)),
		markers: [
			0,
			-3,
			2
		].map((e) => [lt(e), ct(ze(.18 * 2 ** e, t))]),
		pivot: t.contrastPivot
	};
}
var Z = 160, Q = 100;
function ft({ p: e }) {
	let t = H().ui.tokens, n = dt(e), r = ([e, t]) => `${(e * Z).toFixed(2)},${((1 - t) * Q).toFixed(2)}`, i = (e, n, i, a = t.textPrimary) => U("polyline", {
		points: e.filter(([, e]) => Number.isFinite(e)).map(r).join(" "),
		fill: "none",
		stroke: a,
		strokeOpacity: n,
		strokeWidth: i
	}), a = [...[
		.25,
		.5,
		.75
	].map((e) => U("line", {
		key: `y${e}`,
		x1: 0,
		x2: Z,
		y1: (1 - e) * Q,
		y2: (1 - e) * Q,
		stroke: t.border,
		strokeWidth: .4,
		strokeDasharray: "2 2"
	})), ...Array.from({ length: 9 }, (e, t) => -5 + t).map((e) => U("line", {
		key: `x${e}`,
		x1: lt(e) * Z,
		x2: lt(e) * Z,
		y1: 0,
		y2: Q,
		stroke: t.border,
		strokeWidth: e === 0 ? .7 : .4,
		strokeDasharray: "2 2"
	}))];
	return U("svg", {
		viewBox: `0 0 ${Z} ${Q}`,
		role: "img",
		"aria-label": "Tone curve",
		style: {
			width: "100%",
			aspectRatio: `${Z} / ${Q}`,
			background: t.surface0,
			border: `1px solid ${t.border}`,
			borderRadius: 4
		}
	}, ...a, U("line", {
		x1: 0,
		x2: Z,
		y1: (1 - n.pivot) * Q,
		y2: (1 - n.pivot) * Q,
		stroke: t.accent,
		strokeOpacity: .5,
		strokeWidth: .6,
		strokeDasharray: "3 2"
	}), i(n.ssts, .3, .8), i(n.contrast, .55, 1), i(n.full, 1, 1.4, t.accent), ...n.markers.map(([e, n], r) => U("circle", {
		key: `m${r}`,
		cx: e * Z,
		cy: (1 - n) * Q,
		r: r === 0 ? 2.2 : 1.5,
		fill: r === 0 ? t.accent : t.textSecondary
	})));
}
//#endregion
//#region src/panel/model.ts
var pt = (e, t, n) => e >= t ? e <= n ? e : n : t;
function mt(e, t) {
	return e >= t ? e > 1e-6 ? pt(1 - t / e, -1, 1) : 0 : t > 1e-6 ? pt(e / t - 1, -1, 1) : 0;
}
function ht(e, t) {
	return pt(t >= 0 ? e * (1 - t) : e / Math.max(1 + t, .001), 0, 10);
}
function gt(e, t, n) {
	if (t.chroma_x_contrast === void 0 && t.chroma_x_pivot === void 0) return t;
	let r = {
		...e,
		...t
	};
	return {
		...t,
		chroma_z_contrast: ht(r.chroma_x_contrast, n),
		chroma_z_pivot: r.chroma_x_pivot
	};
}
function _t(e, t) {
	let n = Math.max(e.chroma_x_contrast, e.chroma_z_contrast);
	return {
		chroma_x_contrast: n * Math.min(1, 1 + t),
		chroma_z_contrast: n * Math.min(1, 1 - t),
		chroma_z_pivot: e.chroma_x_pivot
	};
}
var vt = {
	chroma_x_contrast: 0,
	chroma_z_contrast: 0,
	chroma_x_pivot: 50,
	chroma_z_pivot: 50
}, yt = Ye, bt = "This photo uses another display transform. Switch to 3D Colorimetric Film to edit its settings here.", xt = "This photo uses the older processing, so Safelight's own highlight shoulder still runs before the transform. Use Update processing in Develop's status bar to give the transform the full range.", St = "Auto adjust needs a Safelight build that can measure the scene before the display transform.", Ct = "Nothing to measure: no photo is rendered yet, the frame is black, or this GPU has no float render targets.", wt = "chromaLocked", Tt = "autoMode", Et = "advancedOpen", Dt = (e) => (String(e).split(".")[1] ?? "").length, Ot = (e, t) => Number(e.toFixed(Dt(t) + 1)), $ = (e, t) => t * e.scale + e.offset, kt = (e, t) => (t - e.offset) / e.scale;
function At() {
	let e = H().stores.useDevelopStore.getState();
	e.setParam("displayTransform", J), e.commitEdit("Display transform");
}
function jt() {
	let e = H(), t = e.stores.useDevelopStore.getState();
	e.pipelines.effectiveId(t.params.displayTransform) === "colorimetric-film.3dcf" && (t.setDynParams(g(J, y)), t.commitEdit(`${Ye} reset`));
}
function Mt() {
	let e = H().ui;
	return U(e.Stack, {
		gap: 8,
		style: { padding: 12 }
	}, U("p", { style: {
		margin: 0,
		color: e.tokens.textSecondary,
		fontSize: 11
	} }, bt), U(e.Row, {
		gap: 6,
		wrap: !0
	}, U(e.Button, { onClick: At }, `Use ${Ye}`)));
}
function Nt() {
	let e = H(), { useDevelopStore: t, usePipelineStore: n } = e.stores, r = t((e) => e.params.displayTransform), i = t((e) => e.params.processVersion), a = t((e) => e.photoId);
	return n((e) => e.activeId), e.pipelines.effectiveId(r) === "colorimetric-film.3dcf" ? U(Pt, {
		key: a,
		processVersion: i
	}) : U(Mt, null);
}
function Pt({ processVersion: e }) {
	let t = H(), { useRef: n, useState: r } = t.react, i = t.ui, a = t.stores.useDevelopStore, o = t.develop.useParamScope(), [s, c] = r(() => t.settings.get(wt, !0)), [l, u] = r(() => t.settings.get(Tt, 1)), [d, p] = r(() => t.settings.get(Et, !1)), [m, y] = r(null), [x, S] = r(0), C = n(null), w = () => f(v, _(J, o.getParams())), T = w(), E = T.color_look === 11, D = Math.max(T.chroma_x_contrast, T.chroma_z_contrast), te = (e) => Math.max(e.chroma_x_contrast, e.chroma_z_contrast) > 1e-6 ? mt(e.chroma_x_contrast, e.chroma_z_contrast) : x, O = D > 1e-6 ? mt(T.chroma_x_contrast, T.chroma_z_contrast) : x, k = (e, t) => {
		let n = h(v, t);
		return g(J, h(v, s ? gt(e, n, te(e)) : n));
	}, A = (e, t) => {
		o.setParams(g(J, h(v, e))), o.commit(t);
	}, j = () => C.current ??= {
		from: w(),
		stored: o.getParams(),
		keys: /* @__PURE__ */ new Set()
	}, M = (e) => {
		let { stored: t, keys: n } = j();
		for (let t of Object.keys(e)) n.add(t);
		let r = {};
		for (let i of n) r[i] = i in e ? e[i] : t[i];
		o.setParams(r);
	}, N = (e) => {
		C.current = null, o.commit(e);
	}, P = (e, n = e.label) => {
		let r = v[e.key], i = $(e, r.min), a = $(e, r.max), o = Ot($(e, T[e.key]), e.step);
		return U("div", {
			key: e.key,
			title: `${e.tooltip} (${e.unit === "EV" ? "In EV" : "In %"}.)`
		}, U(t.components.Slider, {
			label: n,
			value: o,
			min: Math.min(i, a),
			max: Math.max(i, a),
			step: e.step,
			defaultValue: $(e, r.default),
			onChange: (t) => M(k(j().from, { [e.key]: kt(e, t) })),
			onCommit: () => N(n)
		}));
	}, F = async () => {
		y(null);
		let e = a.getState().photoId, n;
		try {
			n = await ve(t);
		} catch {
			n = "no frame";
		}
		let r = a.getState();
		if (r.photoId !== e || t.pipelines.effectiveId(r.params.displayTransform) !== "colorimetric-film.3dcf") return;
		if (n === "unsupported") return y(St);
		let i = n === "no frame" ? null : ge(n.data, n.width * n.height, l);
		if (!i) return y(Ct);
		A(i, "Auto adjust");
	}, I = it(E, s), L = T.color_look >= 1 && T.color_look <= 10, R = {
		margin: 0,
		color: i.tokens.textMuted,
		fontSize: 11
	}, ne = U("div", {
		key: "balance",
		title: `${I.balance.tooltip} (In %.)`
	}, U(t.components.Slider, {
		label: I.balance.label,
		value: Ot(O * 100, 1),
		min: -100,
		max: 100,
		step: 1,
		defaultValue: 0,
		onChange: (e) => {
			let t = Math.min(Math.max(e / 100, -1), 1);
			S(t), M(g(J, h(v, _t(j().from, t))));
		},
		onCommit: () => N(I.balance.label)
	})), re = U(i.Button, {
		key: "reset-chroma",
		size: "sm",
		variant: "ghost",
		title: X.reset,
		onClick: () => {
			S(0), A(vt, "Reset chroma contrast");
		}
	}, "Reset chroma contrast"), ie = U(i.Section, { title: "Tone" }, U(i.Stack, { gap: 6 }, U(i.Row, { gap: 6 }, U(i.Select, {
		ariaLabel: "Auto adjust rendering",
		title: X.mode,
		value: String(l),
		options: ce.map((e, t) => ({
			value: String(t),
			label: e
		})),
		onChange: (e) => {
			let n = Number(e);
			t.settings.set(Tt, n), u(n);
		}
	}), U(i.Button, {
		size: "sm",
		disabled: !t.develop.captureFloatFrame,
		title: t.develop.captureFloatFrame ? X.auto : St,
		onClick: () => void F()
	}, "Auto adjust")), ...Qe.map((e) => P(e)))), ae = U(i.Section, { title: "Colour" }, U(i.Stack, { gap: 6 }, U(i.Select, {
		ariaLabel: "Colour look",
		title: X.look,
		value: String(T.color_look),
		options: ee.map((e, t) => ({
			value: String(t),
			label: e
		})),
		onChange: (e) => A({ color_look: Number(e) }, "Colour look")
	}), L ? P($e) : null, E ? null : P(et), E ? null : P(tt), P(I.x), U("div", {
		key: "lock",
		title: X.lock
	}, U(i.Toggle, {
		checked: s,
		label: "Lock X and Z",
		onChange: (e) => {
			t.settings.set(wt, e), c(e);
		}
	})), s ? ne : P(I.xPivot), s ? null : P(I.z), s ? null : P(I.zPivot), re, E ? P(rt) : null, E ? null : P(nt))), oe = U(i.Button, {
		variant: "ghost",
		size: "sm",
		"aria-label": `${d ? "Hide" : "Show"} advanced`,
		onClick: () => {
			t.settings.set(Et, !d), p(!d);
		}
	}, d ? "Hide" : "Show"), se = U(i.Section, {
		title: "Advanced",
		right: oe
	}, d ? U(i.Stack, { gap: 6 }, U("p", { style: R }, "Highlights"), ...at.map((e) => P(e)), U("p", { style: R }, "Gamut"), ...ot.map((e) => P(e)), U(i.Select, {
		ariaLabel: "Display target",
		title: X.target,
		value: String(T.output_cs),
		options: b.map((e, t) => ({
			value: String(t),
			label: e
		})),
		onChange: (e) => A({ output_cs: Number(e) }, "Display target")
	})) : null);
	return U(i.Stack, {
		gap: 10,
		style: { padding: 12 }
	}, (e ?? 1) < 2 ? U("p", { style: R }, xt) : null, U(ft, { p: T }), ie, ae, se, m ? U("p", { style: {
		margin: 0,
		color: i.tokens.textSecondary,
		fontSize: 11
	} }, m) : null);
}
//#endregion
//#region src/index.ts
function Ft(e) {
	be(e), e.registerPipeline(Ze()), e.registerPanel({
		id: "colorimetric-film.panel",
		title: yt,
		component: Nt,
		defaultDock: {
			module: "develop",
			direction: "right",
			order: 4,
			width: 268
		},
		modules: ["develop"],
		onReset: jt
	});
}
function It() {}
//#endregion
export { Ft as activate, It as deactivate };

//# sourceMappingURL=index.js.map