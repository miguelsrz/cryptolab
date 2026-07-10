import json
from router import manejar_ruta
 
ALLOWED_ORIGIN = "*"
 
HEADERS = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
}
 
def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}
 
    ruta = event.get("path", "/")
    if not ruta or ruta == "/":
        ruta = event.get("rawPath", "/")
 
    # Esto extrae solo el segmento final (/claves, /encriptar, /desencriptar)
    for segmento in ["/claves", "/encriptar", "/desencriptar", "/reloj"]:
        if ruta.endswith(segmento):
            ruta = segmento
            break
 
    try:
        body = json.loads(event.get("body") or "{}")
        resultado = manejar_ruta(ruta, body)
        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps(resultado)
        }
    except ValueError as e:
        return {
            "statusCode": 400,
            "headers": HEADERS,
            "body": json.dumps({"error": str(e)})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": "Error interno del servidor"})
        }