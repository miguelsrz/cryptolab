import json
from router import manejar_ruta
 
ALLOWED_ORIGIN = "https://discretas.miguelsrz.com"
 
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
 
    # Extraer solo el segmento final (/claves, /encriptar, /desencriptar)
    # sin importar el stage (pruebarsa, prod, dev) ni el prefijo /api
    # Ejemplos que maneja:
    #   /pruebarsa/api/encriptar  → /encriptar
    #   /api/encriptar            → /encriptar
    #   /encriptar                → /encriptar
    for segmento in ["/claves", "/encriptar", "/desencriptar"]:
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