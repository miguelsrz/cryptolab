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

# ─────────────────────────────────────────────
# Registro de métodos disponibles
# Para agregar uno nuevo:
#   1. Crea metodos/nuevo.py con generar_claves, encriptar, desencriptar
#   2. Importa arriba
#   3. Agrégalo a METODOS con su key
# ─────────────────────────────────────────────

METODOS = {
    "rsa":     rsa,
    "elgamal": elgamal,
    # "vigenere": vigenere,
}

if _aes_disponible:
    METODOS["aes"] = aes

def manejar_ruta(ruta: str, body: dict):
    metodo_key = body.get("metodo", "rsa")
    metodo = METODOS.get(metodo_key)

    if ruta == "/claves":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        return metodo.generar_claves()

    if ruta == "/encriptar":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        password = body.get("password", "")
        if not password:
            raise ValueError("El campo 'password' es requerido")
        clave_publica = body.get("clave_publica", {})
        return metodo.encriptar(password, clave_publica)

    if ruta == "/desencriptar":
        if not metodo:
            raise ValueError(f"Método desconocido: {metodo_key}")
        cifrado = body.get("cifrado")
        if not cifrado:
            raise ValueError("El campo 'cifrado' es requerido")
        clave_privada = body.get("clave_privada", {})
        return metodo.desencriptar(cifrado, clave_privada)

    if ruta == "/reloj":
        # Ruta exclusiva de ElGamal: arma los datos del reloj modular
        # (grupo cíclico + generador) para que el frontend los dibuje.
        # No depende de METODOS/metodo_key porque solo aplica a ElGamal.
        return reloj_modular.generar_datos_reloj(body)

    raise ValueError(f"Ruta '{ruta}' no encontrada")
