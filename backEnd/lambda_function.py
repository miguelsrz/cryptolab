import json
from router import manejar_ruta

# Configuración CORS: permitimos cualquier origen, métodos POST y OPTIONS
ALLOWED_ORIGIN = "*"

HEADERS = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
}

def lambda_handler(event, context):
    # Respuesta para solicitudes preflight (OPTIONS)
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}

    # Obtenemos la ruta solicitada
    ruta = event.get("path", "/")
    if not ruta or ruta == "/":
        ruta = event.get("rawPath", "/")

    # Normalizamos: extraemos solo el segmento final que nos interesa
    for segmento in ["/claves", "/encriptar", "/desencriptar", "/reloj"]:
        if ruta.endswith(segmento):
            ruta = segmento
            break

    try:
        # Parseamos el cuerpo de la petición
        body = json.loads(event.get("body") or "{}")
        resultado = manejar_ruta(ruta, body)

        # Respuesta exitosa
        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps(resultado)
        }
    except ValueError as e:
        # Error de formato en el body o datos inválidos
        return {
            "statusCode": 400,
            "headers": HEADERS,
            "body": json.dumps({"error": str(e)})
        }
    except Exception as e:
        # Cualquier otro error inesperado
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": "Error interno del servidor"})
        }