// Fuente de verdad de las claves de traducción: `es.ts` debe tener exactamente la misma forma.
export const en = {
	common: {
		appName: "Sentinel",
		loading: "Loading…",
		retry: "Try again",
		cancel: "Cancel",
		save: "Save changes",
		saving: "Saving…",
		create: "Create",
		creating: "Creating…",
		delete: "Delete",
		copy: "Copy",
		copied: "Copied",
		back: "Back",
		close: "Close",
		theme: "Theme",
		themes: { system: "System", light: "Light", dark: "Dark" },
		language: "Language",
		menu: "Menu",
		optional: "optional",
		or: "or",
		genericError: "Something went wrong",
		genericErrorHint:
			"Please try again. If the problem persists, check your connection.",
	},
	auth: {
		login: {
			title: "Sign in to Sentinel",
			subtitle: "Track errors and keep your apps healthy.",
			email: "Email",
			password: "Password",
			emailNotVerified:
				"Verify your email address to sign in. We sent you a link.",
			resendVerification: "Resend the verification email",
			submit: "Sign in",
			submitting: "Signing in…",
			google: "Continue with Google",
			noAccount: "Don't have an account?",
			signUpLink: "Create one",
			invalidCredentials: "Incorrect email or password.",
		},
		register: {
			title: "Create your account",
			subtitle: "Start tracking errors in minutes.",
			name: "Full name",
			email: "Email",
			password: "Password",
			passwordHint: "At least 8 characters.",
			submit: "Create account",
			submitting: "Creating account…",
			haveAccount: "Already have an account?",
			signInLink: "Sign in",
			emailTaken: "An account with this email already exists.",
		},
		brand: {
			tagline: "Catch errors before your users do.",
			description:
				"Group, triage and fix the bugs that matter, with the context to reproduce them.",
		},
		validation: {
			required: "This field is required.",
			email: "Enter a valid email address.",
			passwordLength: "Use at least 8 characters.",
		},
	},
	onboarding: {
		title: "Welcome to Sentinel",
		subtitle: "Let's get your first project set up.",
		org: {
			title: "Create your organization",
			description: "Organizations group your projects and your team.",
			name: "Organization name",
			placeholder: "Acme Inc.",
		},
		project: {
			title: "Create your first project",
			description: "A project represents one app you want to monitor.",
			name: "Project name",
			placeholder: "My web app",
			platform: "Platform",
		},
		install: {
			title: "Install the SDK",
			description:
				"Add this code to your app. Errors will start appearing as soon as they happen.",
			cta: "Go to issues",
		},
		steps: {
			org: "Organization",
			project: "Project",
			install: "Install",
		},
	},
	nav: {
		overview: "Overview",
		issues: "Issues",
		performance: "Performance",
		projects: "Projects",
		releases: "Releases",
		members: "Members",
		alerts: "Alerts",
		tokens: "API tokens",
		settings: "Settings",
		signOut: "Sign out",
		switchOrganization: "Switch organization",
		createOrganization: "Create organization",
		project: "Project",
		allProjects: "All projects",
		account: "Account",
		assignEmailOn: "Assignment emails: on",
		assignEmailOff: "Assignment emails: off",
		main: "Main navigation",
	},
	platforms: {
		javascript: "JavaScript",
		react: "React",
		node: "Node.js",
		"react-native": "React Native",
		python: "Python",
		other: "Other",
	},
	projects: {
		title: "Projects",
		subtitle: "Every project is an app that sends errors to Sentinel.",
		create: "Create project",
		emptyTitle: "No projects yet",
		emptyDescription:
			"Create a project to get a DSN and start receiving errors.",
		createDialog: {
			title: "Create project",
			name: "Project name",
			platform: "Platform",
		},
		open: "Open issues",
		loadError: "Could not load the projects.",
	},
	performance: {
		title: "Performance",
		subtitle:
			"How fast your app is for real users: load times, slow requests and Web Vitals. Turn it on in the SDK with tracesSampleRate.",
		filters: { search: "Search transactions" },
		summary: {
			transactions: "Transactions",
			p50: "p50",
			p95: "p95",
			p99: "p99",
			errorRate: "Error rate",
			throughput: "Throughput",
			transactionsCount_one: "{{count}} transaction",
			transactionsCount_other: "{{count}} transactions",
			perMinute: "{{value}} / min",
		},
		overview: {
			empty: "No transactions in this period.",
			loadError: "Couldn't load the performance data.",
		},
		chart: {
			label: "Latency over time",
			p50: "Median (p50)",
			p95: "p95",
			tooltip: "{{count}} transactions · p50 {{p50}} · p95 {{p95}}",
		},
		vitals: {
			title: "Web Vitals",
			subtitle:
				"The 75th percentile of real page loads, rated with Google's thresholds.",
			names: {
				lcp: "Largest Contentful Paint",
				cls: "Cumulative Layout Shift",
				inp: "Interaction to Next Paint",
				fcp: "First Contentful Paint",
				ttfb: "Time to First Byte",
			},
			rating: {
				good: "Good",
				"needs-improvement": "Needs improvement",
				poor: "Poor",
			},
			samples_one: "{{formatted}} measurement",
			samples_other: "{{formatted}} measurements",
		},
		table: {
			columns: {
				name: "Transaction",
				count: "Count",
				p50: "p50",
				p95: "p95",
				errorRate: "Errors",
				tpm: "Per min",
				lastSeen: "Last seen",
			},
			loadError: "Couldn't load the transactions.",
			empty: {
				title: "No transactions yet",
				description:
					"Enable performance in the SDK (tracesSampleRate) and they will show up here as pages load.",
			},
			emptyFiltered: {
				title: "No transactions match",
				description: "Try another period or remove some filters.",
			},
		},
		transaction: {
			back: "All transactions",
			samples: "Examples",
			slowest: "Slowest",
			recent: "Most recent",
		},
		samples: {
			columns: {
				when: "When",
				duration: "Duration",
				status: "Status",
				release: "Release",
				environment: "Environment",
			},
			loadError: "Couldn't load the examples.",
			empty: "No examples in this period",
			emptyHint: "Pick a longer period or remove the filters.",
		},
		trace: {
			title: "Trace",
			subtitle:
				"Everything that happened during one request, across the browser and your servers, and the errors it caused.",
			back: "Performance",
			timeline: "Timeline",
			total: "Total: {{value}}",
			errors: "Errors in this trace",
			noErrors: "No errors were captured during this trace.",
			errorsIn_one: "{{count}} error",
			errorsIn_other: "{{count}} errors",
			loadError: "Couldn't load this trace.",
		},
		sample: {
			back: "Back to the transaction",
			loadError: "Couldn't load this transaction.",
			duration: "Duration",
			status: "Status",
			op: "Type",
			user: "User",
			platform: "Platform",
			traceId: "Trace",
			measurements: "Measurements",
			waterfall: "Waterfall",
			spans_one: "{{count}} span",
			spans_other: "{{count}} spans",
			trace: {
				title: "Trace",
				summary:
					"{{transactions}} transactions and {{errors}} errors in the same trace.",
				view: "View trace",
			},
			noSpans:
				"This transaction has no spans: only its total duration was measured.",
		},
	},
	public: {
		nav: {
			label: "Main",
			features: "Features",
			sdks: "SDKs",
			traces: "Traces",
			architecture: "Architecture",
			docs: "Docs",
		},
		signIn: "Sign in",
		signUp: "Create account",
		openApp: "Open the app",
		footer: {
			tagline:
				"Error tracking and performance monitoring you can run yourself: know what breaks and what is slow before your users tell you.",
			product: "Product",
			api: "API reference",
			built: "Built with",
			stack: "NestJS, PostgreSQL, Redis, React, TypeScript, Python.",
		},
	},
	landing: {
		hero: {
			badge: "Error tracking and performance, self-hosted",
			title: "Know what breaks, and what is slow, before your users tell you",
			subtitle:
				"Sentinel groups every error into one issue with its full context, measures how fast your app really is, and follows a single request from the browser to your servers.",
			cta: "Create a free account",
			docs: "Read the docs",
			note: "SDKs for JavaScript, React, Node.js, Python and React Native.",
		},
		preview: {
			issues: "Issues",
			performance: "Performance",
		},
		features: {
			title: "Everything you need to keep an app healthy",
			subtitle:
				"From the first exception to the slow request behind it, in one place and with the context to fix it.",
			errors: {
				title: "Errors grouped into issues",
				body: "Thousands of events become a handful of issues, with stack trace, breadcrumbs, release, environment and the users affected.",
			},
			performance: {
				title: "Performance and Web Vitals",
				body: "p50, p95 and p99 per transaction, error rate, throughput, and LCP, CLS, INP, FCP and TTFB rated with Google's thresholds.",
			},
			traces: {
				title: "Traces across services",
				body: "One request, followed from the browser to your backend. Jump from an error to the trace it happened in.",
			},
			sourcemaps: {
				title: "Source maps",
				body: "Minified bundles, even Hermes ones in React Native, show your original code. Maps are private: they never leave the server.",
			},
			alerts: {
				title: "Alerts where you work",
				body: "New issue, regression or frequency rules, delivered by email, a signed webhook or Slack, with a cooldown so they never flood you.",
			},
			releases: {
				title: "Releases and regressions",
				body: "See which release introduced an issue, and get reopened automatically when a resolved one comes back in a newer version.",
			},
			teams: {
				title: "Built for teams",
				body: "Organizations with roles, invitations by email, issue assignment, comments with activity history and API tokens for your CI.",
			},
			privacy: {
				title: "Privacy by default",
				body: "Passwords, tokens and card numbers are scrubbed before anything is stored. Your data stays on your infrastructure.",
			},
		},
		how: {
			title: "How it works",
			install: {
				title: "Install an SDK",
				body: "Add a few lines to your app. The SDK captures errors and measures requests without ever breaking your code.",
			},
			collect: {
				title: "Events arrive instantly",
				body: "The API answers right away and a queue hands the event to a worker that symbolicates, groups and stores it.",
			},
			act: {
				title: "Triage and fix",
				body: "Open the issue, see what happened and to whom, assign it, and get notified when it comes back.",
			},
		},
		sdks: {
			title: "One SDK for each place your code runs",
			subtitle:
				"All of them share the same core and the same contract with the server, so they behave the same way.",
			javascript: {
				summary: "For any web page, with a bundler or a plain script tag.",
				points: {
					one: "Captures uncaught errors and unhandled promise rejections",
					two: "Breadcrumbs for clicks, navigation, console and network",
					three: "Page load, navigation, requests and Web Vitals",
				},
			},
			react: {
				summary:
					"Everything in the browser SDK, plus React-aware error handling.",
				points: {
					one: "ErrorBoundary that sends the component stack",
					two: "React 19 root error handlers",
					three: "Profiler that measures how long a tree takes to mount",
				},
			},
			node: {
				summary: "For servers on Node.js: Express, Fastify, Nest and more.",
				points: {
					one: "Uncaught errors flushed before the process exits",
					two: "One transaction per request, named by its route",
					three: "Continues the trace that starts in the browser",
				},
			},
			python: {
				summary: "For ASGI and WSGI apps: FastAPI, Flask, Django and more.",
				points: {
					one: "No dependencies: only the standard library",
					two: "Per-request scope that works with threads and asyncio",
					three: "Spans for requests and httpx, and traces that continue",
				},
			},
			"react-native": {
				summary: "For iOS and Android apps built with React Native.",
				points: {
					one: "Fatal errors are sent before the app closes",
					two: "App start, screens and network requests",
					three: "Original code through the source maps of your bundle",
				},
			},
		},
		traces: {
			title: "Follow a request from the browser to the database",
			subtitle:
				"A trace id travels with every request, so what the browser measured and what your server did end up in the same timeline.",
			nodes: {
				browser: {
					title: "Browser",
					body: "Starts the trace and adds the traceparent header to your API calls.",
					code: "fetch /api/orders",
				},
				api: {
					title: "Your API",
					body: "Continues the same trace and measures the request and its steps.",
					code: "POST /api/orders",
				},
				db: {
					title: "Database",
					body: "Each query becomes a span, so you see where the time went.",
					code: "db.query insert into orders",
				},
			},
			note: "is shared by every transaction of the request.",
			items: {
				link: {
					title: "From error to trace",
					body: "Every error knows the trace it happened in: one click to see everything around it.",
				},
				waterfall: {
					title: "Waterfall of spans",
					body: "Nested spans with their duration show which step is slow, not just that something is.",
				},
				errors: {
					title: "Errors on both sides",
					body: "A frontend failure and the backend exception behind it appear together.",
				},
			},
		},
		architecture: {
			title: "Built to be understood",
			subtitle:
				"A small, honest architecture: every event takes the same short path and each piece does one thing.",
			flow: {
				sdk: {
					title: "SDKs",
					body: "Capture and send over HTTP with retries.",
				},
				api: {
					title: "API",
					body: "Validates, scrubs and answers 202 at once.",
				},
				queue: {
					title: "Queue",
					body: "Redis and BullMQ decouple intake from processing.",
				},
				worker: {
					title: "Worker",
					body: "Symbolicates, fingerprints, groups and alerts.",
				},
				db: {
					title: "PostgreSQL",
					body: "Issues, events, transactions and spans.",
				},
				web: {
					title: "Dashboard",
					body: "React app with live data and trends.",
				},
			},
			stack: "Stack",
			note: "A pnpm and Turborepo monorepo, with one schema (Zod) as the single source of truth for the API, the SDKs and the dashboard, and end-to-end tests that run the real API and worker.",
		},
		cta: {
			title: "Start catching problems before your users do",
			subtitle:
				"Create an account, add the SDK to your app and see your first event in minutes.",
		},
	},
	docs: {
		title: "Documentation",
		subtitle: "Everything to go from zero to your first traced error.",
		toc: "On this page",
		sections: {
			quickstart: "Quickstart",
			sdks: "SDKs",
			sourcemaps: "Source maps",
			tracing: "Traces and performance",
			alerts: "Alerts",
			api: "Ingestion API",
		},
		quickstart: {
			intro: "Five steps, a few minutes.",
			steps: {
				account: {
					title: "Create an account and an organization",
					body: "Sign up with email or Google. The first organization is created for you.",
				},
				project: {
					title: "Create a project",
					body: "A project is one app you want to monitor. Pick its platform.",
				},
				dsn: {
					title: "Copy the DSN",
					body: "It is in the project settings, and it is the only thing the SDK needs: the key and the project id in one URL.",
				},
				install: {
					title: "Install the SDK",
					body: "Add it to your app and call init with the DSN, the release and the environment.",
				},
				verify: {
					title: "Trigger an error",
					body: "Throw one on purpose. It shows up in Issues within seconds, with its stack trace and context.",
				},
			},
		},
		sdks: {
			intro:
				"Pick the SDK for where your code runs. They all share the same options and behavior.",
			platform: "Platform",
			package: "Package",
			requires: "Requires",
		},
		sourcemaps: {
			intro:
				"Upload the source maps of every build so errors show your original code instead of the minified bundle.",
			points: {
				release: "The release must match the one you pass to init.",
				before:
					"Upload before you deploy: only events that arrive afterwards are symbolicated.",
				private:
					"Do not publish the .map files on your server: Sentinel does not need them there.",
				mobile:
					"In React Native the bundle (index.android.bundle, main.jsbundle) is matched whatever path the app is installed in.",
			},
		},
		tracing: {
			intro:
				"Set tracesSampleRate to turn performance on. Page loads, navigations, requests and Web Vitals are then measured on their own, and a trace id links the browser to your backend.",
			browser: "Browser",
			server: "Server",
			outro:
				"By default the traceparent header is only sent to the URLs you list, so your traces are not shared with third parties.",
		},
		alerts: {
			intro:
				"Alert rules run in the worker as events arrive, with a cooldown per rule so a storm of errors sends one notification, not thousands.",
			rules: "Rules",
			channels: "Channels",
			ruleItems: {
				new_issue: "A new issue appears.",
				regression: "A resolved issue comes back in a newer release.",
				frequency: "An issue happens more than N times in a time window.",
				p95_above:
					"The p95 latency of your transactions goes above a threshold (for the whole project or one transaction).",
				error_rate_above:
					"The share of failing transactions goes above a threshold.",
			},
			channelItems: {
				email: "Email to the members you choose, in each member's language.",
				webhook:
					"A webhook signed with HMAC-SHA256, protected against requests to private addresses.",
				slack: "A message in a Slack channel through an incoming webhook.",
			},
		},
		api: {
			intro:
				"The SDKs are thin clients of a public HTTP API. If your language has no SDK yet, you can send events yourself.",
			endpoints: {
				events: "Send an error or a message.",
				transactions: "Send a performance transaction with its spans.",
			},
			outro:
				"Authenticate with the DSN key in the X-Sentinel-Key header. The answer is 202 at once, and the event is processed in the background. The full reference is in",
		},
	},
	overview: {
		title: "Overview",
		loadError: "Couldn't load the overview.",
		noData: "No data in this period.",
		noComparison: "no earlier data",
		change: "{{value}}% vs previous period",
		unknown: "Unknown",
		other: "Other",
		topIssues: "Issues with the most events",
		slowest: "Slowest transactions (p95)",
		byLevel: "Events by level",
		byEnvironment: "Events by environment",
		byRelease: "Events by release",
		tiles: {
			events: "Events",
			users: "Users affected",
			newIssues: "New issues",
			resolved: "Resolved",
			transactions: "Transactions",
			p95: "p95",
			errorRate: "Error rate",
		},
		charts: {
			events: "Events over time",
			transactions: "Transactions over time",
		},
	},
	trend: {
		projectTitle: "Events",
		issueTitle: "Occurrences",
		events_one: "{{count}} event",
		events_other: "{{count}} events",
		empty: "No events in this period",
		loadError: "Couldn't load the chart.",
		chartLabel: "Events over time ({{period}})",
		period: {
			label: "Period",
			"24h": "24 h",
			"7d": "7 days",
			"30d": "30 days",
		},
	},
	issues: {
		title: "Issues",
		tabs: {
			unresolved: "Unresolved",
			resolved: "Resolved",
			ignored: "Ignored",
			all: "All",
		},
		searchPlaceholder: "Search by title or culprit…",
		filters: {
			environment: "Environment",
			allEnvironments: "All environments",
			release: "Release",
			allReleases: "All releases",
			assignee: "Assignee",
			allAssignees: "Everyone",
			assignedToMe: "Assigned to me",
			unassigned: "Unassigned",
		},
		assignedTo: "Assigned to {{name}}",
		regression: "Regression",
		regressionIn: "Regression in {{release}}",
		sort: {
			label: "Sort by",
			asc: "Ascending",
			desc: "Descending",
			lastSeen: "Last seen",
			firstSeen: "First seen",
			events: "Events",
		},
		columns: {
			issue: "Issue",
			events: "Events",
			users: "Users",
			lastSeen: "Last seen",
			trend: "Last 24 h",
		},
		trendLabel: "Events per hour over the last 24 hours",
		firstSeen: "First seen {{when}}",
		levels: {
			fatal: "Fatal",
			error: "Error",
			warning: "Warning",
			info: "Info",
			debug: "Debug",
		},
		status: {
			unresolved: "Unresolved",
			resolved: "Resolved",
			ignored: "Ignored",
		},
		empty: {
			title: "No issues yet",
			description: "Once your app sends its first error, it will show up here.",
			installHint: "See how to install the SDK",
		},
		emptyFiltered: {
			title: "No issues match your filters",
			description: "Try a different search or status.",
			clear: "Clear filters",
		},
		pagination: {
			label: "Pagination",
			showing: "{{from}}–{{to}} of {{total}}",
			previous: "Previous",
			next: "Next",
		},
		loadError: "Could not load the issues.",
	},
	issue: {
		trace: {
			title: "Trace",
			description:
				"This error happened during a traced request. See what else happened in it.",
			view: "View trace",
		},
		back: "Back to issues",
		actions: {
			resolve: "Resolve",
			ignore: "Ignore",
			reopen: "Reopen",
			resolveNextRelease: "In the next release",
			resolveInRelease: "In {{release}}",
			resolveOptions: "More ways to resolve",
			delete: "Delete",
		},
		deleteDialog: {
			title: "Delete this issue?",
			description:
				"The issue and all its events will be permanently deleted. This can't be undone.",
		},
		stats: {
			events: "Events",
			users: "Users",
			firstSeen: "First seen",
			lastSeen: "Last seen",
			firstRelease: "First release",
			lastRelease: "Last release",
		},
		resolution: {
			next: "Resolved in the next release (after {{release}})",
			inRelease: "Resolved in {{release}}",
		},
		regression: {
			title: "Regression",
			description: "This issue was resolved and happened again.",
			descriptionIn:
				"This issue was resolved and happened again in {{release}}.",
		},
		tabs: {
			details: "Details",
			events: "Events",
			activity: "Activity",
			label: "Issue sections",
		},
		ticket: {
			create: "Create Jira ticket",
			unlink: "Unlink ticket",
			opensInJira: "(opens in Jira)",
		},
		assignee: {
			label: "Assignee",
			unassigned: "Unassigned",
		},
		stackTrace: {
			showCode: "Show code",
			hideCode: "Hide code",
			title: "Stack trace",
			showAll: "Show {{count}} more frames",
			inAppOnly: "Show only your code",
			noStack: "No stack trace was captured for this event.",
			causedBy: "Caused by",
			inApp: "In app",
		},
		breadcrumbs: {
			title: "Breadcrumbs",
			empty: "No breadcrumbs were recorded before this event.",
		},
		tags: {
			title: "Tags",
			empty: "No tags.",
		},
		context: {
			title: "Context",
			release: "Release",
			environment: "Environment",
			user: "User",
			email: "Email",
			browser: "Browser",
			os: "OS",
			url: "URL",
			platform: "Platform",
			ip: "IP address",
		},
		eventNav: {
			title: "Event {{id}}",
			latest: "Latest",
			older: "Older",
			newer: "Newer",
			recorded: "Recorded {{when}}",
		},
		events: {
			empty: "No events.",
			time: "Time",
			message: "Event",
			release: "Release",
			user: "User",
			view: "View",
		},
		rawPayload: "Raw event",
		unreadable: "This event has an unexpected format. Showing the raw data.",
		notFound: "Issue not found",
		notFoundHint: "It may have been deleted, or it belongs to another project.",
		loadError: "Could not load the issue.",
	},
	tokens: {
		title: "API tokens",
		subtitle:
			"Tokens let your CI upload source maps to Sentinel. They belong to the organization and never expire until you revoke them.",
		name: "Token name",
		namePlaceholder: "e.g. GitHub Actions",
		create: "Create token",
		createdAt: "Created",
		lastUsed: "Last used",
		neverUsed: "Never used",
		revoke: "Revoke",
		empty: {
			title: "No API tokens yet",
			description: "Create one to upload source maps from your CI.",
		},
		createdDialog: {
			title: "Your new token",
			description:
				"Copy it now and store it as a secret in your CI. You won't be able to see it again.",
			done: "Done",
		},
		revokeDialog: {
			title: "Revoke {{name}}?",
			description: "Anything using this token will stop working immediately.",
		},
		forbidden: "Only owners and admins can manage API tokens.",
		loadError: "Could not load the tokens.",
	},
	members: {
		pageTitle: "Members",
		title: "People in this organization",
		subtitle: "Invite your team and choose what each person can do.",
		you: "You",
		joined: "Joined",
		changeRole: "Change role of",
		remove: "Remove",
		forbidden: "Only owners and admins can manage members.",
		loadError: "Could not load the members.",
		roles: { owner: "Owner", admin: "Admin", member: "Member" },
		removeDialog: {
			title: "Remove {{name}}?",
			description:
				"They will lose access to this organization and all its projects. Their past comments are kept.",
		},
		invite: {
			button: "Invite",
			title: "Invite a teammate",
			description: "We will email them a link to join this organization.",
			email: "Email",
			role: "Role",
			send: "Send invitation",
			alreadyInvited:
				"That person already has a pending invitation or is already a member.",
		},
		pending: {
			title: "Pending invitations",
			expires: "expires",
			resend: "Resend",
			cancel: "Cancel invitation to",
			loadError: "Could not load the invitations.",
			empty: {
				title: "No pending invitations",
				description:
					"Invitations you send show up here until they are accepted.",
			},
		},
	},
	invitation: {
		title: "You have been invited",
		subtitle: "Join your team on Sentinel.",
		description:
			"{{inviter}} invited you to join {{organization}} as {{role}}.",
		accept: "Accept invitation",
		decline: "Decline",
		notFound: "This invitation does not exist or has expired.",
		notPending: "This invitation was already used or cancelled.",
		wrongAccount:
			"This invitation was sent to a different email address than the one you are signed in with ({{email}}). Sign in with the invited account to accept it.",
		switchAccount: "Sign in with another account",
		goHome: "Go to Sentinel",
	},
	activity: {
		someone: "Someone",
		commentLabel: "Comment",
		placeholder: "Write a comment…",
		shortcut: "Ctrl/⌘ + Enter to send",
		comment: "Comment",
		edit: "Edit comment",
		edited: "edited",
		delete: "Delete comment",
		empty:
			"Nothing here yet. Comments and changes to this issue will show up here.",
		loadError: "Could not load the activity.",
		deleteDialog: {
			title: "Delete this comment?",
			description: "This cannot be undone.",
		},
		events: {
			resolved: "{{who}} resolved this issue",
			resolvedInRelease: "{{who}} resolved this issue in release {{release}}",
			resolvedNextRelease:
				"{{who}} resolved this issue for the next release after {{release}}",
			reopened: "{{who}} reopened this issue",
			ignored: "{{who}} ignored this issue",
			assigned: "{{who}} assigned this issue to {{to}}",
			assignedSelf: "{{who}} assigned this issue to themselves",
			unassigned: "{{who}} unassigned {{from}}",
			reassigned: "{{who}} reassigned this issue from {{from}} to {{to}}",
			ticketCreated: "{{who}} created ticket {{key}}",
			ticketUnlinked: "{{who}} unlinked ticket {{key}}",
			generic: "{{who}} updated this issue",
		},
	},
	tour: {
		next: "Next",
		back: "Back",
		done: "Done",
		progress: "{{current}} of {{total}}",
		replay: "Show the guided tour",
		welcome: {
			org: {
				title: "Your organization",
				body: "Switch between organizations or create a new one here. Each one has its own projects, members and settings.",
			},
			project: {
				title: "Projects",
				body: "A project is one app that sends errors to Sentinel. Pick the one you want to look at.",
			},
			nav: {
				title: "Everything about a project",
				body: "Issues are the errors, grouped. Releases show what each version brought, Alerts tell you when something needs attention, and Settings has your DSN.",
			},
			user: {
				title: "Your account",
				body: "Change the language or sign out. You can repeat this tour from this menu whenever you want.",
			},
		},
		issues: {
			filters: {
				title: "Find what matters",
				body: "Filter by status, environment, release or assignee, search by text and change the order.",
			},
			list: {
				title: "Your issues",
				body: "Each row is an error with all its occurrences grouped. Click one to see its stack trace, who is affected and what led to it.",
			},
		},
		performance: {
			overview: {
				title: "How fast it is",
				body: "The median (p50) is what a typical visit feels like; p95 is what the slowest 1 in 20 suffers. Watch the gap between them.",
			},
			vitals: {
				title: "Web Vitals",
				body: "Google's measures of real user experience. Green is good, yellow needs work, red hurts your users (and your search ranking).",
			},
			table: {
				title: "Transactions",
				body: "Every page or operation, with its percentiles and error rate. Sort by p95 to find the slowest, and open one to see a waterfall of what took the time.",
			},
		},
		issueDetail: {
			header: {
				title: "The issue at a glance",
				body: "Resolve it, ignore it or reopen it. You can even say it will be fixed in a release: if it comes back later, it is flagged as a regression.",
			},
			assignee: {
				title: "Who is on it",
				body: "Assign the issue to someone on your team so nothing falls through the cracks.",
			},
			tabs: {
				title: "Details, events and activity",
				body: "Browse every occurrence, or use Activity to comment and see who changed what.",
			},
			stack: {
				title: "Where it failed",
				body: "The stack trace shows the code path. With source maps uploaded you see your original code, not the minified bundle.",
			},
		},
	},
	notices: {
		verificationSent: "Verification email sent",
		organizationCreated: "Organization created",
		invitationSent: "Invitation sent",
		invitationResent: "Invitation sent again",
		invitationCancelled: "Invitation cancelled",
		invitationAccepted: "You joined the organization",
		invitationDeclined: "Invitation declined",
		memberRemoved: "Member removed",
		roleUpdated: "Role updated",
	},
	verifyEmail: {
		title: "Check your inbox",
		subtitle: "One more step to activate your account.",
		sent: "We sent a verification link to {{email}}. Open it to activate your account.",
		noEmail:
			"Open the verification link we emailed you to activate your account.",
		resend: "Resend the email",
		resendIn: "Resend in {{seconds}} s",
		backToLogin: "Back to sign in",
	},
	emailVerified: {
		title: "Email verified",
		subtitle: "Your account is ready.",
		ok: "Thanks! Your email address is verified and you are signed in.",
		continue: "Continue to Sentinel",
		errorTitle: "We could not verify your email",
		errors: {
			invalid: "This link is not valid. It may have been used already.",
			expired: "This link has expired.",
			generic: "Something went wrong while verifying your email.",
		},
		resendIntro: "Enter your email address and we will send you a new link.",
		email: "Email",
		resend: "Send a new link",
	},
	alerts: {
		title: "Alerts",
		subtitle:
			"Get notified when something needs attention: a new issue, a regression or a spike of errors.",
		forbidden: "Only owners and admins can manage alerts.",
		tabs: { rules: "Rules", channels: "Channels", history: "History" },
		duration: {
			minutes_one: "{{count}} minute",
			minutes_other: "{{count}} minutes",
			hours_one: "{{count}} hour",
			hours_other: "{{count}} hours",
			days_one: "{{count}} day",
			days_other: "{{count}} days",
		},
		rules: {
			create: "Create rule",
			edit: "Edit rule",
			delete: "Delete rule",
			toggle: "Enable or disable",
			disabled: "Disabled",
			notifies: "Notifies:",
			allTransactions: "all transactions",
			levelFrom: "{{level}} or worse",
			needChannel:
				"Create a channel first: a rule needs somewhere to send its alerts.",
			loadError: "Could not load the rules.",
			empty: {
				title: "No alert rules yet",
				description:
					"Create a rule to be notified when something needs attention.",
			},
			triggers: {
				new_issue: "A new issue appears",
				regression: "An issue comes back after being resolved",
				frequency: "An issue happens too often",
				p95_above: "Transactions get slow (p95 latency)",
				error_rate_above: "Transactions fail too often (error rate)",
			},
			summary: {
				new_issue: "When a new issue appears",
				regression: "When a resolved issue comes back",
				frequency: "When an issue has {{count}} events in {{window}}",
				p95_above:
					"When the p95 of {{transaction}} is above {{value}} ms within {{window}}",
				error_rate_above:
					"When the error rate of {{transaction}} is above {{value}}% within {{window}}",
			},
			dialog: {
				latency: "p95 above (ms)",
				errorRate: "Error rate above (%)",
				latencyInvalid:
					"Enter a whole number of milliseconds between 1 and {{max}}.",
				errorRateInvalid: "Enter a whole percentage between 1 and 100.",
				transaction: "Transaction (optional)",
				transactionHint:
					"Leave empty to watch all the transactions of the project. At least 10 transactions in the window are needed to alert.",
				createTitle: "Create alert rule",
				editTitle: "Edit alert rule",
				name: "Name",
				trigger: "Alert me when",
				threshold: "Events",
				window: "Within",
				thresholdInvalid: "Enter a whole number between 1 and 100000.",
				environment: "Environment",
				environmentHint: "Optional. Empty means all.",
				minLevel: "Minimum level",
				anyLevel: "Any level",
				cooldown: "Wait between alerts",
				cooldownHint:
					"Minimum time between two alerts of this rule for the same issue.",
				noCooldown: "No wait",
				channels: "Send to",
				channelsRequired: "Choose at least one channel.",
				enabled: "Rule enabled",
			},
			deleteDialog: {
				title: "Delete rule {{name}}?",
				description:
					"It will stop sending alerts. Past alerts stay in the history.",
			},
		},
		channels: {
			create: "Create channel",
			delete: "Delete channel",
			toggle: "Enable or disable",
			test: "Send test",
			testSent: "Test sent. Check the result in the History tab.",
			emailDisabled:
				"This server has no email configured, so email channels cannot deliver. Ask the administrator to set SMTP_URL.",
			nMembers_one: "{{count}} member",
			nMembers_other: "{{count}} members",
			loadError: "Could not load the channels.",
			types: { email: "Email", webhook: "Webhook", slack: "Slack" },
			empty: {
				title: "No channels yet",
				description:
					"A channel is where alerts are sent: an email, a webhook or Slack.",
			},
			dialog: {
				title: "Create channel",
				type: "Type",
				name: "Name",
				url: "URL",
				urlHint: {
					webhook: "Sentinel sends a signed JSON POST to this URL.",
					slack:
						"An incoming webhook URL from Slack (it also works with Discord and Teams in Slack mode).",
				},
				urlInvalid:
					"Enter a valid http:// or https:// URL, without credentials.",
				recipients: "Recipients",
				allMembers: "All members of the organization",
				selectedMembers: "Only some members",
				recipientsRequired: "Choose at least one member.",
			},
			secretDialog: {
				title: "Signing secret",
				description:
					"Copy it now. It is used to sign every request and you will not be able to see it again.",
				verify:
					'Each request carries X-Sentinel-Signature: sha256=HMAC-SHA256(secret, "<timestamp>.<body>"), with the timestamp in X-Sentinel-Timestamp.',
				done: "Done",
			},
			deleteDialog: {
				title: "Delete channel {{name}}?",
				description:
					"Rules that use it will stop notifying it. Past alerts stay in the history.",
			},
		},
		history: {
			loadError: "Could not load the history.",
			test: "Test alert",
			attempts_one: "{{count}} attempt",
			attempts_other: "{{count}} attempts",
			columns: {
				when: "When",
				status: "Status",
				channel: "Channel",
				alert: "Alert",
			},
			status: { pending: "Pending", sent: "Sent", failed: "Failed" },
			empty: {
				title: "No alerts sent yet",
				description: "Alerts and tests will show up here, with their result.",
			},
		},
	},
	releases: {
		title: "Releases",
		subtitle:
			"Every version of your app that has reported events. They are registered automatically.",
		columns: {
			version: "Version",
			created: "First seen",
			events: "Events",
			newIssues: "New issues",
			files: "Files",
		},
		files: {
			open: "Files of release",
			title: "Files of release {{version}}",
			description:
				"Source maps let Sentinel show your original code instead of the minified bundle.",
			empty:
				"No files uploaded for this release yet. Upload them before deploying, because only events that arrive afterwards are translated.",
			upload: "Upload them from your CI with the CLI:",
			cli: "Terminal",
			delete: "Delete",
			forbidden: "Only owners and admins can delete files.",
			loadError: "Could not load the files.",
		},
		viewIssues: "View issues",
		empty: {
			title: "No releases yet",
			description:
				"Set a release when you initialize the SDK and it will show up here with its first event.",
		},
		delete: "Delete",
		deleteDialog: {
			title: "Delete release {{version}}?",
			description:
				"The release is removed from this list. Its events are kept.",
		},
		forbidden: "Only owners and admins can delete releases.",
		loadError: "Could not load the releases.",
	},
	settings: {
		title: "Project settings",
		nav: {
			label: "Settings sections",
			general: "General",
			keys: "Keys and install",
			limits: "Data and limits",
			integrations: "Integrations",
			danger: "Danger zone",
		},
		general: {
			title: "General",
			name: "Project name",
			platform: "Platform",
			saved: "Changes saved.",
		},
		keys: {
			title: "Client keys (DSN)",
			description:
				"SDKs use a DSN to send events to this project. Keep it out of public repositories if you can.",
			label: "Label",
			create: "Create key",
			defaultLabel: "New key",
			active: "Active",
			revoked: "Revoked",
			revoke: "Revoke",
			enable: "Enable",
			delete: "Delete",
			dsn: "DSN",
			deleteConfirm: "Delete this key? Apps using it will stop sending events.",
		},
		jira: {
			title: "Jira",
			connected: "Connected",
			description:
				"Connect the project to Jira Cloud so anyone can create a ticket from an issue. The API token is stored encrypted and never shown again.",
			siteUrl: "Jira site",
			siteUrlHint:
				"Your Jira Cloud address, like https://your-team.atlassian.net.",
			email: "Account email",
			apiToken: "API token",
			apiTokenHint:
				"Create one in your Atlassian account settings, under Security, API tokens.",
			apiTokenKeep: "Leave empty to keep the saved token.",
			projectKey: "Project key",
			issueType: "Issue type",
			connect: "Connect",
			update: "Save changes",
			disconnect: "Disconnect",
			saved: "Jira connection saved.",
		},
		limits: {
			title: "Data and limits",
			thisMonth: "This month",
			events: "Events",
			transactions: "Transactions",
			usedNoLimit: "{{used}} (no limit)",
			usedOfQuota: "{{used}} of {{quota}}",
			resets: "Counters reset on {{date}} (UTC).",
			retention: "Data retention",
			retentionHint:
				"Events and transactions older than this are deleted every night. Issues with nothing left in this period go with them.",
			days: "{{count}} days",
			eventQuota: "Monthly events limit",
			transactionQuota: "Monthly transactions limit",
			quotaHint:
				"Leave empty for no limit. Past the limit, new data is rejected until the month resets.",
			noLimit: "No limit",
			invalidQuota: "Enter a whole number of at least 1, or leave it empty.",
			saved: "Limits saved.",
			exceeded: "This project reached its monthly limit of {{what}}.",
			exceededHint:
				"New data is being rejected until {{date}}, or until you raise the limit.",
			manage: "Manage limits",
		},
		install: {
			title: "Install the SDK",
			description: "Use one of these snippets in your app.",
			npm: "npm",
			script: "Script tag",
			pip: "pip",
			http: "HTTP API",
			install: "Install",
			configure: "Configure",
			hint: {
				javascript:
					"Use the browser SDK, either with a bundler or with a script tag.",
				react:
					"The React SDK includes the browser SDK and adds an error boundary that reports render errors with their component stack.",
				node: "The Node.js SDK captures uncaught errors and measures every request your server handles, continuing traces that start in the browser.",
				"react-native":
					"The React Native SDK captures JavaScript errors (fatal ones are sent before the app closes), and measures app start, screens and network requests. Upload your source maps to see the original code.",
				python:
					"The Python SDK captures uncaught errors and measures every request your ASGI or WSGI app handles (FastAPI, Flask, Django...), continuing traces that start in the browser.",
				other:
					"Send events to the ingest API from any language. You can change the platform in the General section of the settings.",
			},
		},
		danger: {
			title: "Danger zone",
			description:
				"Deleting a project permanently removes its keys, issues and events.",
			delete: "Delete project",
			dialogTitle: "Delete project",
			dialogDescription:
				"This permanently deletes the project and all of its data. To confirm, type its name.",
			confirmLabel: "Project name",
		},
		forbidden: "Only owners and admins can change these settings.",
	},
	routeError: {
		offline: {
			title: "Can't reach the server",
			description:
				"The server isn't responding (it may be starting up or you may be offline). We'll keep trying and this page will load as soon as it answers.",
		},
		generic: {
			title: "Something went wrong",
			description: "This page couldn't be loaded. Try again.",
		},
	},
	notFound: {
		title: "Page not found",
		description:
			"The page you're looking for doesn't exist or you don't have access to it.",
		home: "Go to the start page",
	},
} as const;

export type Translations = typeof en;
