from metodos import rsa
# from metodos import vigenere  ← importa aquí cuando lo implementes

# ─────────────────────────────────────────────
# Registro de métodos disponibles
# Para agregar uno nuevo:
#   1. Crea metodos/nuevo.py con generar_claves, encriptar, desencriptar
#   2. Importa arriba
#   3. Agrégalo a METODOS con su key
# ─────────────────────────────────────────────

METODOS = {
    "rsa": rsa,
    # "vigenere": vigenere,
}

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

    raise ValueError(f"Ruta '{ruta}' no encontrada")
