import type { Translations } from "./en";

// El tipo `Translations` obliga a que esta traducción tenga las mismas claves que el inglés.
type Deep<T> = { [K in keyof T]: T[K] extends string ? string : Deep<T[K]> };

export const es: Deep<Translations> = {
	common: {
		appName: "Sentinel",
		loading: "Cargando…",
		retry: "Reintentar",
		cancel: "Cancelar",
		save: "Guardar cambios",
		saving: "Guardando…",
		create: "Crear",
		creating: "Creando…",
		delete: "Eliminar",
		copy: "Copiar",
		copied: "Copiado",
		back: "Volver",
		close: "Cerrar",
		language: "Idioma",
		menu: "Menú",
		optional: "opcional",
		or: "o",
		genericError: "Algo salió mal",
		genericErrorHint:
			"Intenta de nuevo. Si el problema continúa, revisa tu conexión.",
	},
	auth: {
		login: {
			title: "Inicia sesión en Sentinel",
			subtitle: "Sigue los errores y mantén tus apps saludables.",
			email: "Correo electrónico",
			password: "Contraseña",
			submit: "Iniciar sesión",
			submitting: "Iniciando sesión…",
			google: "Continuar con Google",
			noAccount: "¿No tienes una cuenta?",
			signUpLink: "Crea una",
			invalidCredentials: "Correo o contraseña incorrectos.",
		},
		register: {
			title: "Crea tu cuenta",
			subtitle: "Empieza a seguir errores en minutos.",
			name: "Nombre completo",
			email: "Correo electrónico",
			password: "Contraseña",
			passwordHint: "Al menos 8 caracteres.",
			submit: "Crear cuenta",
			submitting: "Creando cuenta…",
			haveAccount: "¿Ya tienes una cuenta?",
			signInLink: "Inicia sesión",
			emailTaken: "Ya existe una cuenta con este correo.",
		},
		brand: {
			tagline: "Detecta los errores antes que tus usuarios.",
			description:
				"Agrupa, prioriza y corrige los errores que importan, con el contexto para reproducirlos.",
		},
		validation: {
			required: "Este campo es obligatorio.",
			email: "Ingresa un correo válido.",
			passwordLength: "Usa al menos 8 caracteres.",
		},
	},
	onboarding: {
		title: "Te damos la bienvenida a Sentinel",
		subtitle: "Configuremos tu primer proyecto.",
		org: {
			title: "Crea tu organización",
			description: "Las organizaciones agrupan tus proyectos y a tu equipo.",
			name: "Nombre de la organización",
			placeholder: "Acme S.A.",
		},
		project: {
			title: "Crea tu primer proyecto",
			description: "Un proyecto representa una app que quieres monitorear.",
			name: "Nombre del proyecto",
			placeholder: "Mi app web",
			platform: "Plataforma",
		},
		install: {
			title: "Instala el SDK",
			description:
				"Agrega este código a tu app. Los errores aparecerán apenas ocurran.",
			cta: "Ir a los issues",
		},
		steps: {
			org: "Organización",
			project: "Proyecto",
			install: "Instalación",
		},
	},
	nav: {
		issues: "Issues",
		projects: "Proyectos",
		releases: "Releases",
		members: "Miembros",
		alerts: "Alertas",
		tokens: "Tokens de API",
		settings: "Configuración",
		signOut: "Cerrar sesión",
		switchOrganization: "Cambiar de organización",
		createOrganization: "Crear organización",
		project: "Proyecto",
		allProjects: "Todos los proyectos",
		account: "Cuenta",
		main: "Navegación principal",
	},
	platforms: {
		javascript: "JavaScript",
		react: "React",
		node: "Node.js",
		"react-native": "React Native",
		python: "Python",
		other: "Otra",
	},
	projects: {
		title: "Proyectos",
		subtitle: "Cada proyecto es una app que envía errores a Sentinel.",
		create: "Crear proyecto",
		emptyTitle: "Todavía no hay proyectos",
		emptyDescription:
			"Crea un proyecto para obtener una DSN y empezar a recibir errores.",
		createDialog: {
			title: "Crear proyecto",
			name: "Nombre del proyecto",
			platform: "Plataforma",
		},
		open: "Ver issues",
		loadError: "No se pudieron cargar los proyectos.",
	},
	issues: {
		title: "Issues",
		tabs: {
			unresolved: "Sin resolver",
			resolved: "Resueltos",
			ignored: "Ignorados",
			all: "Todos",
		},
		searchPlaceholder: "Buscar por título o culprit…",
		filters: {
			environment: "Entorno",
			allEnvironments: "Todos los entornos",
			release: "Release",
			allReleases: "Todas las releases",
			assignee: "Responsable",
			allAssignees: "Todos",
			assignedToMe: "Asignados a mí",
			unassigned: "Sin asignar",
		},
		assignedTo: "Asignado a {{name}}",
		regression: "Regresión",
		regressionIn: "Regresión en {{release}}",
		sort: {
			label: "Ordenar por",
			asc: "Ascendente",
			desc: "Descendente",
			lastSeen: "Última vez visto",
			firstSeen: "Primera vez visto",
			events: "Eventos",
		},
		columns: {
			issue: "Issue",
			events: "Eventos",
			users: "Usuarios",
			lastSeen: "Última vez",
		},
		firstSeen: "Visto por primera vez {{when}}",
		levels: {
			fatal: "Fatal",
			error: "Error",
			warning: "Advertencia",
			info: "Info",
			debug: "Debug",
		},
		status: {
			unresolved: "Sin resolver",
			resolved: "Resuelto",
			ignored: "Ignorado",
		},
		empty: {
			title: "Todavía no hay issues",
			description: "Cuando tu app envíe su primer error, aparecerá acá.",
			installHint: "Ver cómo instalar el SDK",
		},
		emptyFiltered: {
			title: "Ningún issue coincide con los filtros",
			description: "Prueba con otra búsqueda o estado.",
			clear: "Limpiar filtros",
		},
		pagination: {
			label: "Paginación",
			showing: "{{from}}–{{to}} de {{total}}",
			previous: "Anterior",
			next: "Siguiente",
		},
		loadError: "No se pudieron cargar los issues.",
	},
	issue: {
		back: "Volver a los issues",
		actions: {
			resolve: "Resolver",
			ignore: "Ignorar",
			reopen: "Reabrir",
			resolveNextRelease: "En la próxima release",
			resolveInRelease: "En {{release}}",
			resolveOptions: "Más formas de resolver",
			delete: "Eliminar",
		},
		deleteDialog: {
			title: "¿Eliminar este issue?",
			description:
				"El issue y todos sus eventos se borrarán de forma permanente. No se puede deshacer.",
		},
		stats: {
			events: "Eventos",
			users: "Usuarios",
			firstSeen: "Primera vez",
			lastSeen: "Última vez",
			firstRelease: "Primera release",
			lastRelease: "Última release",
		},
		resolution: {
			next: "Resuelto en la próxima release (después de {{release}})",
			inRelease: "Resuelto en {{release}}",
		},
		regression: {
			title: "Regresión",
			description: "Este issue estaba resuelto y volvió a ocurrir.",
			descriptionIn:
				"Este issue estaba resuelto y volvió a ocurrir en {{release}}.",
		},
		tabs: {
			details: "Detalles",
			events: "Eventos",
			activity: "Actividad",
			label: "Secciones del issue",
		},
		assignee: {
			label: "Responsable",
			unassigned: "Sin asignar",
		},
		stackTrace: {
			showCode: "Mostrar código",
			hideCode: "Ocultar código",
			title: "Stack trace",
			showAll: "Mostrar {{count}} frames más",
			inAppOnly: "Mostrar solo tu código",
			noStack: "No se capturó un stack trace para este evento.",
			causedBy: "Causado por",
			inApp: "Tu código",
		},
		breadcrumbs: {
			title: "Breadcrumbs",
			empty: "No se registraron breadcrumbs antes de este evento.",
		},
		tags: {
			title: "Tags",
			empty: "Sin tags.",
		},
		context: {
			title: "Contexto",
			release: "Release",
			environment: "Entorno",
			user: "Usuario",
			email: "Correo",
			browser: "Navegador",
			os: "Sistema operativo",
			url: "URL",
			platform: "Plataforma",
			ip: "Dirección IP",
		},
		eventNav: {
			title: "Evento {{id}}",
			latest: "Último",
			older: "Anterior",
			newer: "Siguiente",
			recorded: "Registrado {{when}}",
		},
		events: {
			empty: "Sin eventos.",
			time: "Hora",
			message: "Evento",
			release: "Release",
			user: "Usuario",
			view: "Ver",
		},
		rawPayload: "Evento sin procesar",
		unreadable:
			"Este evento tiene un formato inesperado. Se muestran los datos sin procesar.",
		notFound: "Issue no encontrado",
		notFoundHint: "Puede haberse eliminado o pertenecer a otro proyecto.",
		loadError: "No se pudo cargar el issue.",
	},
	tokens: {
		title: "Tokens de API",
		subtitle:
			"Los tokens permiten que tu CI suba source maps a Sentinel. Pertenecen a la organización y no caducan hasta que los revoques.",
		name: "Nombre del token",
		namePlaceholder: "p. ej. GitHub Actions",
		create: "Crear token",
		createdAt: "Creado",
		lastUsed: "Último uso",
		neverUsed: "Sin usar",
		revoke: "Revocar",
		empty: {
			title: "Todavía no hay tokens de API",
			description: "Crea uno para subir source maps desde tu CI.",
		},
		createdDialog: {
			title: "Tu nuevo token",
			description:
				"Cópialo ahora y guárdalo como secreto en tu CI. No podrás volver a verlo.",
			done: "Listo",
		},
		revokeDialog: {
			title: "¿Revocar {{name}}?",
			description:
				"Todo lo que use este token dejará de funcionar de inmediato.",
		},
		forbidden: "Solo los owners y admins pueden gestionar los tokens de API.",
		loadError: "No se pudieron cargar los tokens.",
	},
	members: {
		pageTitle: "Miembros",
		title: "Personas de esta organización",
		subtitle: "Invita a tu equipo y elige qué puede hacer cada persona.",
		you: "Tú",
		joined: "Se unió",
		changeRole: "Cambiar el rol de",
		remove: "Quitar",
		forbidden: "Solo los owners y admins pueden gestionar los miembros.",
		loadError: "No se pudieron cargar los miembros.",
		roles: { owner: "Owner", admin: "Admin", member: "Miembro" },
		removeDialog: {
			title: "¿Quitar a {{name}}?",
			description:
				"Perderá el acceso a esta organización y a todos sus proyectos. Sus comentarios anteriores se conservan.",
		},
		invite: {
			button: "Invitar",
			title: "Invitar a una persona de tu equipo",
			description:
				"Le enviaremos por correo un enlace para unirse a esta organización.",
			email: "Correo electrónico",
			role: "Rol",
			send: "Enviar invitación",
			alreadyInvited:
				"Esa persona ya tiene una invitación pendiente o ya es miembro.",
		},
		pending: {
			title: "Invitaciones pendientes",
			expires: "caduca",
			resend: "Reenviar",
			resent: "Invitación enviada de nuevo.",
			cancel: "Cancelar la invitación a",
			loadError: "No se pudieron cargar las invitaciones.",
			empty: {
				title: "No hay invitaciones pendientes",
				description:
					"Las invitaciones que envíes aparecerán aquí hasta que se acepten.",
			},
		},
	},
	invitation: {
		title: "Te han invitado",
		subtitle: "Únete a tu equipo en Sentinel.",
		description:
			"{{inviter}} te invitó a unirte a {{organization}} como {{role}}.",
		accept: "Aceptar invitación",
		decline: "Rechazar",
		notFound: "Esta invitación no existe o ya caducó.",
		notPending: "Esta invitación ya se usó o fue cancelada.",
		wrongAccount:
			"Esta invitación se envió a un correo distinto del de tu sesión ({{email}}). Inicia sesión con la cuenta invitada para aceptarla.",
		switchAccount: "Iniciar sesión con otra cuenta",
		goHome: "Ir a Sentinel",
	},
	activity: {
		someone: "Alguien",
		commentLabel: "Comentario",
		placeholder: "Escribe un comentario…",
		shortcut: "Ctrl/⌘ + Enter para enviar",
		comment: "Comentar",
		edit: "Editar comentario",
		edited: "editado",
		delete: "Eliminar comentario",
		empty:
			"Todavía no hay nada. Aquí aparecerán los comentarios y los cambios de este issue.",
		loadError: "No se pudo cargar la actividad.",
		deleteDialog: {
			title: "¿Eliminar este comentario?",
			description: "No se puede deshacer.",
		},
		events: {
			resolved: "{{who}} resolvió este issue",
			resolvedInRelease:
				"{{who}} resolvió este issue en la release {{release}}",
			resolvedNextRelease:
				"{{who}} resolvió este issue para la próxima release después de {{release}}",
			reopened: "{{who}} reabrió este issue",
			ignored: "{{who}} ignoró este issue",
			assigned: "{{who}} asignó este issue a {{to}}",
			assignedSelf: "{{who}} se asignó este issue",
			unassigned: "{{who}} quitó la asignación de {{from}}",
			reassigned: "{{who}} reasignó este issue de {{from}} a {{to}}",
			generic: "{{who}} actualizó este issue",
		},
	},
	alerts: {
		title: "Alertas",
		subtitle:
			"Recibe un aviso cuando algo requiera atención: un issue nuevo, una regresión o un pico de errores.",
		forbidden: "Solo los owners y admins pueden gestionar las alertas.",
		tabs: { rules: "Reglas", channels: "Canales", history: "Historial" },
		duration: {
			minutes_one: "{{count}} minuto",
			minutes_other: "{{count}} minutos",
			hours_one: "{{count}} hora",
			hours_other: "{{count}} horas",
			days_one: "{{count}} día",
			days_other: "{{count}} días",
		},
		rules: {
			create: "Crear regla",
			edit: "Editar regla",
			delete: "Eliminar regla",
			toggle: "Activar o desactivar",
			disabled: "Desactivada",
			notifies: "Avisa a:",
			levelFrom: "{{level}} o más grave",
			needChannel:
				"Crea primero un canal: una regla necesita un lugar al que enviar sus avisos.",
			loadError: "No se pudieron cargar las reglas.",
			empty: {
				title: "Todavía no hay reglas de alerta",
				description:
					"Crea una regla para recibir un aviso cuando algo requiera atención.",
			},
			triggers: {
				new_issue: "Aparece un issue nuevo",
				regression: "Un issue resuelto vuelve a ocurrir",
				frequency: "Un issue ocurre demasiado seguido",
			},
			summary: {
				new_issue: "Cuando aparece un issue nuevo",
				regression: "Cuando un issue resuelto vuelve a ocurrir",
				frequency: "Cuando un issue tiene {{count}} eventos en {{window}}",
			},
			dialog: {
				createTitle: "Crear regla de alerta",
				editTitle: "Editar regla de alerta",
				name: "Nombre",
				trigger: "Avísame cuando",
				threshold: "Eventos",
				window: "En",
				thresholdInvalid: "Indica un número entero entre 1 y 100000.",
				environment: "Entorno",
				environmentHint: "Opcional. Vacío significa todos.",
				minLevel: "Nivel mínimo",
				anyLevel: "Cualquier nivel",
				cooldown: "Espera entre avisos",
				cooldownHint:
					"Tiempo mínimo entre dos avisos de esta regla para el mismo issue.",
				noCooldown: "Sin espera",
				channels: "Enviar a",
				channelsRequired: "Elige al menos un canal.",
				enabled: "Regla activada",
			},
			deleteDialog: {
				title: "¿Eliminar la regla {{name}}?",
				description:
					"Dejará de enviar avisos. Los avisos anteriores se conservan en el historial.",
			},
		},
		channels: {
			create: "Crear canal",
			delete: "Eliminar canal",
			toggle: "Activar o desactivar",
			test: "Enviar prueba",
			testSent: "Prueba enviada. Mira el resultado en la pestaña Historial.",
			emailDisabled:
				"Este servidor no tiene correo configurado, así que los canales de email no pueden entregar. Pide al administrador que configure SMTP_URL.",
			nMembers_one: "{{count}} miembro",
			nMembers_other: "{{count}} miembros",
			loadError: "No se pudieron cargar los canales.",
			types: { email: "Email", webhook: "Webhook", slack: "Slack" },
			empty: {
				title: "Todavía no hay canales",
				description:
					"Un canal es el lugar al que se envían los avisos: un email, un webhook o Slack.",
			},
			dialog: {
				title: "Crear canal",
				type: "Tipo",
				name: "Nombre",
				url: "URL",
				urlHint: {
					webhook: "Sentinel envía un POST JSON firmado a esta URL.",
					slack:
						"La URL de un webhook entrante de Slack (también sirve para Discord y Teams en modo Slack).",
				},
				urlInvalid:
					"Indica una URL http:// o https:// válida, sin credenciales.",
				recipients: "Destinatarios",
				allMembers: "Todos los miembros de la organización",
				selectedMembers: "Solo algunos miembros",
				recipientsRequired: "Elige al menos un miembro.",
			},
			secretDialog: {
				title: "Secreto de firma",
				description:
					"Cópialo ahora. Se usa para firmar cada petición y no podrás volver a verlo.",
				verify:
					'Cada petición lleva X-Sentinel-Signature: sha256=HMAC-SHA256(secreto, "<timestamp>.<cuerpo>"), con el timestamp en X-Sentinel-Timestamp.',
				done: "Listo",
			},
			deleteDialog: {
				title: "¿Eliminar el canal {{name}}?",
				description:
					"Las reglas que lo usan dejarán de avisarle. Los avisos anteriores se conservan en el historial.",
			},
		},
		history: {
			loadError: "No se pudo cargar el historial.",
			test: "Aviso de prueba",
			attempts_one: "{{count}} intento",
			attempts_other: "{{count}} intentos",
			columns: {
				when: "Cuándo",
				status: "Estado",
				channel: "Canal",
				alert: "Alerta",
			},
			status: { pending: "Pendiente", sent: "Enviado", failed: "Fallido" },
			empty: {
				title: "Todavía no se ha enviado ninguna alerta",
				description:
					"Las alertas y las pruebas aparecerán aquí, con su resultado.",
			},
		},
	},
	releases: {
		title: "Releases",
		subtitle:
			"Cada versión de tu app que ha reportado eventos. Se registran automáticamente.",
		columns: {
			version: "Versión",
			created: "Vista por primera vez",
			events: "Eventos",
			newIssues: "Issues nuevos",
			files: "Archivos",
		},
		files: {
			open: "Archivos de la release",
			title: "Archivos de la release {{version}}",
			description:
				"Los source maps permiten que Sentinel muestre tu código original en lugar del bundle minificado.",
			empty:
				"Todavía no hay archivos para esta release. Súbelos antes de desplegar: solo se traducen los eventos que llegan después.",
			upload: "Súbelos desde tu CI con la CLI:",
			cli: "Terminal",
			delete: "Eliminar",
			forbidden: "Solo los owners y admins pueden eliminar archivos.",
			loadError: "No se pudieron cargar los archivos.",
		},
		viewIssues: "Ver issues",
		empty: {
			title: "Todavía no hay releases",
			description:
				"Indica una release al inicializar el SDK y aparecerá aquí con su primer evento.",
		},
		delete: "Eliminar",
		deleteDialog: {
			title: "¿Eliminar la release {{version}}?",
			description:
				"La release se quita de esta lista. Sus eventos se conservan.",
		},
		forbidden: "Solo los owners y admins pueden eliminar releases.",
		loadError: "No se pudieron cargar las releases.",
	},
	settings: {
		title: "Configuración del proyecto",
		general: {
			title: "General",
			name: "Nombre del proyecto",
			platform: "Plataforma",
			saved: "Cambios guardados.",
		},
		keys: {
			title: "Claves de cliente (DSN)",
			description:
				"Los SDK usan una DSN para enviar eventos a este proyecto. Evita publicarla en repositorios públicos.",
			label: "Etiqueta",
			create: "Crear clave",
			defaultLabel: "Nueva clave",
			active: "Activa",
			revoked: "Revocada",
			revoke: "Revocar",
			enable: "Activar",
			delete: "Eliminar",
			dsn: "DSN",
			deleteConfirm:
				"¿Eliminar esta clave? Las apps que la usan dejarán de enviar eventos.",
		},
		install: {
			title: "Instala el SDK",
			description: "Usa uno de estos fragmentos en tu app.",
			npm: "npm",
			script: "Etiqueta script",
			install: "Instalación",
			configure: "Configuración",
		},
		danger: {
			title: "Zona de peligro",
			description:
				"Eliminar un proyecto borra de forma permanente sus claves, issues y eventos.",
			delete: "Eliminar proyecto",
			dialogTitle: "Eliminar proyecto",
			dialogDescription:
				"Esto elimina el proyecto y todos sus datos de forma permanente. Para confirmar, escribe su nombre.",
			confirmLabel: "Nombre del proyecto",
		},
		forbidden: "Solo los owners y admins pueden cambiar esta configuración.",
	},
	notFound: {
		title: "Página no encontrada",
		description: "La página que buscas no existe o no tienes acceso a ella.",
		home: "Ir al inicio",
	},
};
