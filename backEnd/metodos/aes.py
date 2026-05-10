"""
metodos/aes.py

Cifrado simétrico AES-256-CBC.
Interfaz estándar del proyecto:
  - generar_claves()            → dict con publica, privada, parametros, pasos_claves
  - encriptar(password, clave)  → dict con encrypted, pasos
  - desencriptar(cifrado, clave)→ dict con decrypted, pasos

Dependencia: pip install cryptography
"""

import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding


# ─────────────────────────────────────────────
# Interfaz estándar
# ─────────────────────────────────────────────

def generar_claves():
    """
    AES es simétrico: la misma clave sirve para cifrar y descifrar.
    """
    key = os.urandom(32)       # 256 bits
    key_hex = key.hex()

    pasos_claves = [
        {
            "titulo": "Cifrado simétrico AES-256-CBC",
            "formula": "AES: Advanced Encryption Standard",
            "detalle": (
                "AES es un cifrado de bloque simétrico. "
                "La misma clave secreta se usa para cifrar y descifrar. "
                "El modo CBC (Cipher Block Chaining) encadena los bloques para mayor seguridad."
            ),
            "valores": {}
        },
        {
            "titulo": "Generar clave secreta de 256 bits",
            "formula": "K ∈ {0,1}²⁵⁶  (aleatoria)",
            "detalle": (
                f"Se genera una clave aleatoria de 32 bytes (256 bits). "
                f"Vista como hexadecimal (primeros 32 chars): {key_hex[:32]}..."
            ),
            "valores": {"bits": 256, "bytes": 32, "key_preview": key_hex[:16] + "..."}
        },
        {
            "titulo": "Vector de Inicialización (IV)",
            "formula": "IV ∈ {0,1}¹²⁸  (aleatorio por mensaje)",
            "detalle": (
                "Cada vez que se cifra un mensaje se genera un IV aleatorio de 16 bytes (128 bits). "
                "El IV garantiza que el mismo texto con la misma clave produzca cifrados distintos. "
                "Se incluye en el resultado junto al texto cifrado."
            ),
            "valores": {"iv_bits": 128, "iv_bytes": 16}
        },
        {
            "titulo": "Padding PKCS#7",
            "formula": "len(datos_pad) ≡ 0 (mod 16)",
            "detalle": (
                "AES opera en bloques de 16 bytes. "
                "Si el mensaje no es múltiplo de 16, se añaden bytes de relleno (padding). "
                "PKCS#7 rellena con el valor N, donde N = bytes que faltan."
            ),
            "valores": {"block_size": 128}
        },
        {
            "titulo": "Modo CBC — Cipher Block Chaining",
            "formula": "Cᵢ = E_K(Pᵢ ⊕ Cᵢ₋₁),  C₀ = IV",
            "detalle": (
                "Cada bloque de texto plano (Pᵢ) se combina con XOR con el bloque cifrado anterior (Cᵢ₋₁) "
                "antes de ser cifrado. Esto encadena los bloques y evita patrones repetidos."
            ),
            "valores": {}
        },
    ]

    return {
        "publica":      {"key": key_hex},
        "privada":      {"key": key_hex},
        "parametros":   {"bits": 256, "modo": "AES-256-CBC"},
        "pasos_claves": pasos_claves,
    }


def encriptar(password: str, clave_publica: dict) -> dict:
    key = bytes.fromhex(clave_publica["key"])
    iv  = os.urandom(16)

    # Padding PKCS7
    padder      = padding.PKCS7(128).padder()
    datos       = password.encode("utf-8")
    datos_pad   = padder.update(datos) + padder.finalize()

    bytes_añadidos = len(datos_pad) - len(datos)

    cipher    = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ct        = encryptor.update(datos_pad) + encryptor.finalize()

    # Bloques cifrados para el paso a paso
    bloques = []
    for i in range(0, len(ct), 16):
        bloque_hex = ct[i:i+16].hex()
        bloques.append(bloque_hex)

    pasos = [
        {
            "titulo": "Texto original",
            "detalle": f"Mensaje: \"{password}\" ({len(datos)} bytes / {len(datos)*8} bits)",
            "valores": {"texto": password, "bytes": len(datos)}
        },
        {
            "titulo": "Padding PKCS#7 aplicado",
            "detalle": (
                f"El texto ocupa {len(datos)} bytes. "
                f"Se añaden {bytes_añadidos} byte(s) de padding para completar {len(datos_pad)} bytes "
                f"({len(datos_pad)//16} bloque(s) de 16 bytes)."
            ),
            "valores": {"bytes_originales": len(datos), "bytes_con_padding": len(datos_pad), "padding": bytes_añadidos}
        },
        {
            "titulo": "Vector de Inicialización (IV) generado",
            "detalle": f"IV aleatorio de 128 bits: {iv.hex()}",
            "valores": {"iv": iv.hex()}
        },
        {
            "titulo": f"Cifrado CBC — {len(bloques)} bloque(s) de 128 bits",
            "detalle": (
                f"Cada bloque de texto plano se hace XOR con el bloque anterior (o IV) "
                f"y luego se cifra con AES-256."
            ),
            "valores": {"bloques": bloques, "num_bloques": len(bloques)}
        },
        {
            "titulo": "Resultado final",
            "detalle": f"Se almacena IV + texto cifrado en hexadecimal.",
            "valores": {"iv": iv.hex(), "ct": ct.hex()[:32] + ("..." if len(ct.hex()) > 32 else "")}
        },
    ]

    return {
        "encrypted": {"iv": iv.hex(), "ct": ct.hex()},
        "pasos": pasos,
    }


def desencriptar(cifrado: dict, clave_privada: dict) -> dict:
    key = bytes.fromhex(clave_privada["key"])
    iv  = bytes.fromhex(cifrado["iv"])
    ct  = bytes.fromhex(cifrado["ct"])

    cipher    = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    datos_pad = decryptor.update(ct) + decryptor.finalize()

    unpadder = padding.PKCS7(128).unpadder()
    datos    = unpadder.update(datos_pad) + unpadder.finalize()

    pasos = [
        {
            "titulo": "Leer IV y texto cifrado",
            "detalle": f"IV: {iv.hex()} | Texto cifrado ({len(ct)} bytes): {ct.hex()[:32]}...",
            "valores": {"iv": iv.hex()}
        },
        {
            "titulo": "Descifrado AES-CBC",
            "detalle": f"Se descifra cada bloque con la misma clave, luego se aplica XOR con el bloque anterior.",
            "valores": {}
        },
        {
            "titulo": "Quitar padding PKCS#7",
            "detalle": f"Se eliminan los bytes de relleno. Resultado: {len(datos)} byte(s).",
            "valores": {"bytes": len(datos)}
        },
        {
            "titulo": "Texto recuperado",
            "detalle": f"Decodificando UTF-8: \"{datos.decode('utf-8')}\"",
            "valores": {"texto": datos.decode("utf-8")}
        },
    ]

    return {"decrypted": datos.decode("utf-8"), "pasos": pasos}
