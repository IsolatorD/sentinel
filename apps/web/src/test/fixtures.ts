import type {
	EventDetailDto,
	EventListDto,
	IssueDetailDto,
	IssueDto,
	IssueListDto,
	ProjectDto,
	ProjectKeyDto,
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
