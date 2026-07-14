from metodos import rsa
from metodos import elgamal
from metodos import reloj_modular

# AES requiere la librería 'cryptography'. Se importa con manejo de error
# para que los otros métodos sigan funcionando si no está instalada.
try:
    from metodos import aes
    _aes_disponible = True
except ImportError:
    _aes_disponible = False
    print("[router] AVISO: 'cryptography' no está instalada. AES no disponible.")
    print("         Ejecuta: pip install cryptography")

# Diccionario que asocia cada método con su módulo correspondiente
METODOS = {
    "rsa":     rsa,
    "elgamal": elgamal,
    # "vigenere": vigenere,  # Pendiente de implementación
}

# Solo incluimos AES si la libreria esta disponible
if _aes_disponible:
    METODOS["aes"] = aes

def manejar_ruta(ruta: str, body: dict):
    # Extraemos el método del body, por defecto rsa (solo aplica en caso de error de frontEnd)
    metodo_key = body.get("metodo", "rsa")
    metodo = METODOS.get(metodo_key)

    # Ruta /claves: generación de par de llaves
    if ruta == "/claves":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        return metodo.generar_claves()

    # Ruta /encriptar: cifrado de la contraseña
    if ruta == "/encriptar":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        password = body.get("password", "")
        if not password:
            raise ValueError("El campo 'password' es requerido")
        clave_publica = body.get("clave_publica", {})
        return metodo.encriptar(password, clave_publica)

    # Ruta /desencriptar: descifrado del mensaje
    if ruta == "/desencriptar":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        cifrado = body.get("cifrado")
        if not cifrado:
            raise ValueError("El campo 'cifrado' es requerido")
        clave_privada = body.get("clave_privada", {})
        return metodo.desencriptar(cifrado, clave_privada)

    # Ruta /reloj: exclusiva de ElGamal, genera datos del reloj modular
    if ruta == "/reloj":
        return reloj_modular.generar_datos_reloj(body)

    # Si la ruta no coincide con ninguna de las anteriores
    raise ValueError(f"Ruta '{ruta}' no encontrada")