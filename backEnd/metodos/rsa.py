"""
metodos/rsa.py

Interfaz estándar que todo método debe cumplir:
  - generar_claves()            → dict con publica, privada, parametros
  - encriptar(password, clave)  → dict con encrypted
  - desencriptar(cifrado, clave)→ dict con decrypted
"""

import random


# ─────────────────────────────────────────────
# Primalidad
# ─────────────────────────────────────────────

def es_primo(n):
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    for i in range(3, int(n**0.5) + 1, 2):
        if n % i == 0:
            return False
    return True

def primo_aleatorio(minimo=200, maximo=1000):
    while True:
        candidato = random.randint(minimo, maximo)
        if es_primo(candidato):
            return candidato


# ─────────────────────────────────────────────
# Algoritmo de Euclides
# ─────────────────────────────────────────────

def mcd(a, b):
    while b:
        a, b = b, a % b
    return a

def euclides_extendido(a, b):
    if b == 0:
        return a, 1, 0
    g, x1, y1 = euclides_extendido(b, a % b)
    return g, y1, x1 - (a // b) * y1

def inverso_modular(e, phi):
    g, x, _ = euclides_extendido(e, phi)
    if g != 1:
        raise ValueError(f"Inverso modular no existe: mcd({e},{phi})={g}")
    return x % phi


# ─────────────────────────────────────────────
# Exponenciación modular
# ─────────────────────────────────────────────

def potencia_modular(base, exp, mod):
    resultado = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            resultado = (resultado * base) % mod
        exp //= 2
        base = (base * base) % mod
    return resultado


# ─────────────────────────────────────────────
# Interfaz estándar
# ─────────────────────────────────────────────

def generar_claves():
    while True:
        p = primo_aleatorio(200, 1000)
        q = primo_aleatorio(200, 1000)
        if p != q and p * q > 65536:
            break

    n   = p * q
    phi = (p - 1) * (q - 1)
    e   = 3
    while mcd(e, phi) != 1:
        e += 2
    d = inverso_modular(e, phi)

    return {
        "publica":    {"e": e, "n": n},
        "privada":    {"d": d, "n": n},
        "parametros": {"p": p, "q": q, "phi": phi},
    }

def encriptar(password: str, clave_publica: dict) -> dict:
    e = int(clave_publica["e"])
    n = int(clave_publica["n"])
    cifrado = []
    for caracter in password:
        m = ord(caracter)
        if m >= n:
            raise ValueError(
                f"El carácter '{caracter}' (unicode={m}) supera n={n}. "
                "Genera claves más grandes."
            )
        cifrado.append(potencia_modular(m, e, n))
    return {"encrypted": cifrado}

def desencriptar(cifrado: list, clave_privada: dict) -> dict:
    d = int(clave_privada["d"])
    n = int(clave_privada["n"])
    texto = "".join(chr(potencia_modular(c, d, n)) for c in cifrado)
    return {"decrypted": texto}
