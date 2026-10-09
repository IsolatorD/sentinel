export interface UserAgentInfo {
	browser?: { name: string; version?: string };
	os?: { name: string };
}

// Orden importa: Edge y Opera también dicen "Chrome"; Chrome también dice "Safari".
const BROWSERS: Array<[string, RegExp]> = [
	["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
	["Opera", /(?:OPR|Opera)\/([\d.]+)/],
	["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
	["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
	["Safari", /Version\/([\d.]+).*Safari/],
];

const SYSTEMS: Array<[string, RegExp]> = [
	["Windows", /Windows/],
	["Android", /Android/],
	["iOS", /iPhone|iPad|iPod/],
	["macOS", /Mac OS X|Macintosh/],
	["Linux", /Linux|X11/],
];

export function parseUserAgent(ua: string | undefined): UserAgentInfo {
	if (!ua) return {};
	const info: UserAgentInfo = {};
	for (const [name, re] of BROWSERS) {
		const m = re.exec(ua);
		if (m) {
			info.browser = { name, version: m[1] };
			break;
		}
	}
	for (const [name, re] of SYSTEMS) {
		if (re.test(ua)) {
			info.os = { name };
			break;
		}
	}
	return info;
}
