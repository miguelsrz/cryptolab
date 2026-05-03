import json

ALLOWED_ORIGIN = "https://discretas.miguelsrz.com"

HEADERS = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
}

def lambda_handler(event, context):
    
    body = json.loads(event.get('body', '{}'))

    password = body.get('password', '')
    key = body.get('key', '')

    # Encriptación. Se concatena, contraseña + llave
    encrypted = password + key

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({ 'encrypted': encrypted })
    }