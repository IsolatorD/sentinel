"""Backend de demostración con el SDK de Python (Flask).

    packages/sdk-python/.venv/bin/python examples/python-demo/server.py --dsn <dsn> [--port 5602]

Pruébalo con la demo del navegador (examples/browser-demo): su botón "Llamar al backend Python" hace una
petición aquí con la cabecera `traceparent`, y las dos transacciones salen unidas en la misma traza.
"""

import argparse
import random
import time

import sentinel_sdk
from flask import Flask, jsonify

parser = argparse.ArgumentParser()
parser.add_argument("--dsn", required=True, help="la DSN de tu proyecto")
parser.add_argument("--port", type=int, default=5602)
args = parser.parse_args()

sentinel_sdk.init(
    args.dsn,
    release="python-demo@1.0.0",
    environment="demo",
    traces_sample_rate=1.0,
    debug=True,
)

app = Flask(__name__)
sentinel_sdk.setup_flask(app)


@app.after_request
def cors(response):
    # CORS abierto solo para la demo; `traceparent` debe estar permitido para que el navegador lo envíe.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "traceparent, content-type"
    return response


@app.route("/api/orders/<int:order_id>", methods=["GET", "OPTIONS"])
def order(order_id):
    # Cada paso aparece como un span en la cascada.
    with sentinel_sdk.start_span("db.query", "select * from orders where id = %s"):
        time.sleep(0.06 + random.random() * 0.06)
        if order_id == 0:
            raise LookupError("el pedido 0 no existe en la base de datos")
    with sentinel_sdk.start_span("cache.set", "guardar en caché"):
        time.sleep(0.015)
    return jsonify(id=order_id, total=99.9)


@app.route("/api/slow", methods=["GET", "OPTIONS"])
@sentinel_sdk.trace("work", "cálculo pesado")
def slow():
    time.sleep(0.8)
    return jsonify(slow=True)


if __name__ == "__main__":
    print(f"backend de demo en http://localhost:{args.port}")
    app.run(port=args.port)
