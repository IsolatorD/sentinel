// Código de la demo. Se sirve como archivo externo para que los stack traces
// tengan nombres de archivo y números de línea reales.
const $ = (id) => document.getElementById(id);
const log = (msg) => {
	$("log").textContent =
		`${new Date().toLocaleTimeString()}  ${msg}\n${$("log").textContent}`;
};

const params = new URLSearchParams(location.search);
$("dsn").value =
	params.get("dsn") ?? localStorage.getItem("sentinel-demo-dsn") ?? "";

function computeTotal(cart) {
	// Bug a propósito: cart.items puede ser undefined.
	return cart.items.reduce((sum, item) => sum + item.price, 0);
}

function checkout(orderId) {
	return computeTotal({ orderId });
}

$("init").addEventListener("click", () => {
	const dsn = $("dsn").value.trim();
	localStorage.setItem("sentinel-demo-dsn", dsn);
	const client = Sentinel.init({
		dsn,
		release: "demo@1.0.0",
		environment: "demo",
		debug: true,
		// Rendimiento: mide la carga de página, las navegaciones y cada fetch/XHR.
		tracesSampleRate: 1,
		tags: { app: "browser-demo" },
	});
	log(
		client.enabled
			? "SDK inicializado"
			: "DSN inválida: el SDK quedó desactivado",
	);
});

$("throw-uncaught").addEventListener("click", () => {
	setTimeout(function brokenHandler() {
		checkout(1234);
	}, 0);
	log("lanzada excepción no capturada");
});

$("reject-error").addEventListener("click", () => {
	Promise.reject(new RangeError("el pago fue rechazado"));
	log("promesa rechazada con Error");
});

$("reject-string").addEventListener("click", () => {
	Promise.reject("rechazo con un string");
	log("promesa rechazada con string");
});

$("capture-handled").addEventListener("click", () => {
	try {
		checkout(99);
	} catch (error) {
		const id = Sentinel.captureException(error, {
			tags: { feature: "checkout" },
			extra: { orderId: 99 },
		});
		log(`captureException -> ${id}`);
	}
});

$("capture-cause").addEventListener("click", () => {
	try {
		try {
			throw new Error("conexión perdida con la base de datos");
		} catch (cause) {
			throw new Error("no se pudo guardar el pedido", { cause });
		}
	} catch (error) {
		log(`captureException (con causa) -> ${Sentinel.captureException(error)}`);
	}
});

$("capture-message").addEventListener("click", () => {
	log(
		`captureMessage -> ${Sentinel.captureMessage("Checkout completado", "info")}`,
	);
});

$("group-5").addEventListener("click", () => {
	// Mismo bug con distintos datos: el servidor debe agruparlos en un solo issue.
	for (let orderId = 1000; orderId < 1005; orderId++) {
		try {
			checkout(orderId);
		} catch (error) {
			error.message = `${error.message} (pedido ${orderId})`;
			Sentinel.captureException(error);
		}
	}
	log("enviados 5 errores del mismo bug");
});

$("set-user").addEventListener("click", () => {
	Sentinel.setUser({ id: "user_42", email: "ana@example.com" });
	log("usuario configurado");
});

$("do-fetch").addEventListener("click", async () => {
	const res = await fetch("/health?probe=1");
	log(`fetch /health -> ${res.status}`);
	console.log("probe terminado", { status: res.status });
});

$("do-nav").addEventListener("click", () => {
	history.pushState({}, "", "/checkout?step=2");
	log("navegación a /checkout");
});

// ---------- Rendimiento ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

$("perf-trace").addEventListener("click", async () => {
	// Una transacción propia con spans anidados: se ve como una cascada en "Rendimiento".
	const tx = Sentinel.startTransaction({
		name: "importar-pedidos",
		op: "task",
	});
	await Sentinel.trace("parse", "leer el archivo", () => sleep(120));
	await Sentinel.trace("validate", "validar filas", async () => {
		await sleep(60);
		await Sentinel.trace("db.query", "buscar duplicados", () => sleep(90));
	});
	await Sentinel.trace("save", "guardar", () => sleep(150));
	tx?.setMeasurement("rows", 1200);
	tx?.finish();
	log("transacción importar-pedidos enviada");
});

$("perf-slow-fetch").addEventListener("click", async () => {
	// Es del mismo origen: el SDK añade la cabecera traceparent y crea un span http.client.
	const tx = Sentinel.startTransaction({ name: "/lento", op: "navigation" });
	const res = await fetch("/slow?ms=900");
	tx?.finish();
	log(`fetch /slow -> ${res.status} (900 ms, con span y traceparent)`);
});
