import type {
	EventDetailDto,
	EventListDto,
	IssueDetailDto,
	IssueDto,
	IssueListDto,
	PerformanceOverviewDto,
	ProjectDto,
	ProjectKeyDto,
	SampleDetailDto,
	SampleListDto,
	StatsDto,
	TransactionGroupDto,
	TransactionListDto,
} from "@sentinel/shared";

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

export const user = { id: "u1", name: "Ana Pérez", email: "ana@example.com" };
export const org = { id: "org-1", name: "Acme", slug: "acme", logo: null };

export const KEY_ID = "22222222-2222-4222-8222-222222222222";
export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const ISSUE_ID = "33333333-3333-4333-8333-333333333333";
export const EVENT_ID = "44444444-4444-4444-8444-444444444444";
export const OLDER_EVENT_ID = "55555555-5555-4555-8555-555555555555";

export const key: ProjectKeyDto = {
	id: KEY_ID,
	projectId: PROJECT_ID,
	label: "Default",
	publicKey: "0123456789abcdef0123456789abcdef",
	isActive: true,
	dsn: "http://0123456789abcdef0123456789abcdef@localhost:3000/11111111-1111-4111-8111-111111111111",
	createdAt: ago(600),
};

export const project: ProjectDto = {
	id: PROJECT_ID,
	organizationId: org.id,
	name: "Storefront",
	slug: "storefront",
	platform: "react",
	createdAt: ago(600),
	keys: [key],
};

export const issue = (over: Partial<IssueDto> = {}): IssueDto => ({
	id: ISSUE_ID,
	projectId: PROJECT_ID,
	fingerprint: "abc123",
	title: "TypeError: Cannot read properties of undefined",
	culprit: "computeTotal (Cart.js:42)",
	type: "TypeError",
	level: "error",
	status: "unresolved",
	assignee: null,
	firstRelease: "2.3.0",
	lastRelease: "2.4.0",
	resolvedRelease: null,
	resolvedInclusive: false,
	regressedAt: null,
	regressedInRelease: null,
	eventCount: 18,
	userCount: 7,
	firstSeen: ago(4000),
	lastSeen: ago(25),
	...over,
});

export const issueList = (
	items: IssueDto[] = [issue()],
	total = items.length,
): IssueListDto => ({
	items,
	total,
	limit: 25,
	offset: 0,
	trends: {},
});

export const eventPayload = {
	level: "error",
	release: "2.4.0",
	environment: "production",
	platform: "javascript",
	user: { id: "user_103", email: "user_103@example.com" },
	tags: { feature: "checkout", handled: "false" },
	request: { url: "https://shop.acme.dev/cart" },
	contexts: {
		browser: { name: "Chrome", version: "126.0.0" },
		os: { name: "macOS" },
	},
	exception: {
		values: [
			{
				type: "Error",
				value: "Card processor timeout",
				stacktrace: {
					frames: [
						{
							filename: "https://cdn.x.com/stripe.js",
							function: "request",
							lineno: 204,
							in_app: false,
						},
					],
				},
			},
			{
				type: "TypeError",
				value: "Cannot read properties of undefined",
				stacktrace: {
					frames: [
						{
							filename:
								"https://shop.acme.dev/node_modules/react-dom/react-dom.js",
							function: "beginWork",
							lineno: 18412,
							in_app: false,
						},
						{
							filename: "https://shop.acme.dev/assets/Cart.js",
							function: "CartPage",
							lineno: 88,
							colno: 10,
							in_app: true,
						},
						{
							filename: "https://shop.acme.dev/assets/Cart.js",
							function: "computeTotal",
							lineno: 42,
							colno: 17,
							in_app: true,
						},
					],
				},
			},
		],
	},
	breadcrumbs: [
		{
			category: "navigation",
			timestamp: ago(30),
			data: {
				from: "https://shop.acme.dev/",
				to: "https://shop.acme.dev/cart",
			},
		},
		{ category: "ui.click", timestamp: ago(29), message: "button.checkout" },
		{
			category: "fetch",
			level: "error",
			timestamp: ago(28),
			data: {
				method: "POST",
				url: "https://shop.acme.dev/api/pay",
				status_code: 500,
			},
		},
	],
	_client: { ip: "127.0.0.1" },
};

export const event = (over: Partial<EventDetailDto> = {}): EventDetailDto => ({
	id: EVENT_ID,
	issueId: ISSUE_ID,
	timestamp: ago(25),
	receivedAt: ago(25),
	level: "error",
	type: "TypeError",
	message: "Cannot read properties of undefined",
	release: "2.4.0",
	environment: "production",
	platform: "javascript",
	userIdentifier: "user_103",
	payload: eventPayload,
	...over,
});

export const issueDetail = (
	over: Partial<IssueDetailDto> = {},
): IssueDetailDto => ({
	...issue(),
	latestEvent: event(),
	...over,
});

export const eventList = (): EventListDto => {
	const { payload: _p, ...latest } = event();
	return {
		items: [latest, { ...latest, id: OLDER_EVENT_ID, timestamp: ago(300) }],
		total: 2,
		limit: 50,
		offset: 0,
	};
};

/** Serie de estadísticas de 24 h (24 puntos); `events` rellena la hora más reciente. */
export const stats = (
	over: Partial<StatsDto> = {},
	events = [0, 0, 3, 5],
): StatsDto => ({
	period: "24h",
	bucketMinutes: 60,
	from: "2026-10-08T16:00:00.000Z",
	to: "2026-10-09T15:42:00.000Z",
	totalEvents: events.reduce((a, b) => a + b, 0),
	points: events.map((n, i) => ({
		start: new Date(Date.UTC(2026, 9, 9, 12 + i)).toISOString(),
		events: n,
		users: Math.min(n, 2),
	})),
	...over,
});

export const transactionGroup = (
	over: Partial<TransactionGroupDto> = {},
): TransactionGroupDto => ({
	name: "/checkout",
	op: "pageload",
	count: 120,
	p50: 640,
	p95: 2400,
	p99: 4100,
	errorRate: 0.05,
	tpm: 0.083,
	lastSeen: ago(3),
	...over,
});

export const transactionList = (
	items: TransactionGroupDto[] = [
		transactionGroup(),
		transactionGroup({ name: "/home", count: 40, p50: 300, errorRate: 0 }),
	],
	total = items.length,
): TransactionListDto => ({ items, total, limit: 25, offset: 0 });

export const overview = (
	over: Partial<PerformanceOverviewDto> = {},
): PerformanceOverviewDto => ({
	period: "24h",
	bucketMinutes: 60,
	from: "2026-10-08T16:00:00.000Z",
	to: "2026-10-09T15:42:00.000Z",
	summary: {
		count: 160,
		p50: 520,
		p95: 2400,
		p99: 4100,
		errorRate: 0.0375,
		tpm: 0.111,
	},
	vitals: {
		lcp: { p75: 2100, samples: 150, rating: "good" },
		cls: { p75: 0.3, samples: 90, rating: "poor" },
	},
	points: [0, 1, 2, 3].map((i) => ({
		start: new Date(Date.UTC(2026, 9, 9, 12 + i)).toISOString(),
		count: i === 1 ? 0 : 40,
		errors: i === 3 ? 2 : 0,
		p50: i === 1 ? null : 500 + i * 20,
		p95: i === 1 ? null : 2000 + i * 100,
	})),
	...over,
});

export const sample = (over: Partial<SampleListDto["items"][number]> = {}) => ({
	id: "5a3f8f8e-1111-4a2b-8c3d-aaaaaaaaaaaa",
	traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
	timestamp: ago(5),
	durationMs: 3800,
	status: "ok",
	release: "2.4.0",
	environment: "production",
	user: "user_103",
	...over,
});

export const sampleList = (
	items: SampleListDto["items"] = [
		sample(),
		sample({ id: "5a3f8f8e-2222-4a2b-8c3d-bbbbbbbbbbbb", durationMs: 900 }),
	],
): SampleListDto => ({ items });

export const sampleDetail = (
	over: Partial<SampleDetailDto> = {},
): SampleDetailDto => ({
	...sample(),
	name: "/checkout",
	op: "pageload",
	spanId: "00f067aa0ba902b7",
	platform: "javascript",
	measurements: {
		lcp: { value: 2100, unit: "millisecond" },
		cls: { value: 0.3 },
	},
	tags: {},
	spans: [
		{
			spanId: "b9c7c989f97918e1",
			parentSpanId: "00f067aa0ba902b7",
			op: "http.client",
			description: "GET /api/cart",
			offsetMs: 100,
			durationMs: 1200,
			status: "ok",
			depth: 1,
			data: null,
		},
		{
			spanId: "a1a1a1a1a1a1a1a1",
			parentSpanId: "b9c7c989f97918e1",
			op: "db.query",
			description: "select 1",
			offsetMs: 200,
			durationMs: 300,
			status: "internal_error",
			depth: 2,
			data: null,
		},
	],
	...over,
});
