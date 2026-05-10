"""
server_local.py — Solo para desarrollo local (no va en AWS).
Instala automáticamente las dependencias necesarias antes de arrancar.
"""

import subprocess
import sys


# ─────────────────────────────────────────────
# Auto-instalación de dependencias
# ─────────────────────────────────────────────

def instalar(paquete: str, import_name: str = None):
    """Instala el paquete si no está disponible."""
    nombre = import_name or paquete
    try:
        __import__(nombre)
        print(f"  ✓ {paquete} ya está instalado")
    except ImportError:
        print(f"  📦 Instalando {paquete}...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", paquete],
            stdout=subprocess.DEVNULL
        )
        print(f"  ✓ {paquete} instalado correctamente")


print("\n🔍 Verificando dependencias...")
instalar("flask")
instalar("cryptography")
print("✅ Dependencias listas\n")


# ─────────────────────────────────────────────
# Servidor Flask (simulador de AWS Lambda)
# ─────────────────────────────────────────────

from flask import Flask, request
from lambda_function import lambda_handler

app = Flask(__name__)


@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'OPTIONS'])
@app.route('/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def simulador_aws(path):
    evento_simulado = {
        "httpMethod": request.method,
        "path": "/" + path,
        "body": request.get_data(as_text=True)
    }
    respuesta_lambda = lambda_handler(evento_simulado, None)
    return (
        respuesta_lambda.get('body', ''),
        respuesta_lambda.get('statusCode', 200),
        respuesta_lambda.get('headers', {})
    )


if __name__ == '__main__':
    print("🚀 Servidor local en http://localhost:8000")
    print("   Rutas disponibles: /api/claves  /api/encriptar  /api/desencriptar\n")
    app.run(port=8000, debug=True)
