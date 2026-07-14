"""
metodos/rsa.py

Interfaz estándar que todo método debe cumplir:
  - generar_claves()            → dict con publica, privada, parametros, pasos_claves
  - encriptar(password, clave)  → dict con encrypted, pasos
  - desencriptar(cifrado, clave)→ dict con decrypted, pasos
"""

import random

#  ------------------ Primalidad ------------------

# Comprueba si un número es primo (división por tentativa hasta raíz cuadrada)
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

# Genera un primo aleatorio en el rango [minimo, maximo]
def primo_aleatorio(minimo=200, maximo=1000):
    while True:
        candidato = random.randint(minimo, maximo)
        if es_primo(candidato):
            return candidato

# ------------------ Algoritmo de Euclides ------------------

# Máximo común divisor (Euclides iterativo)
def mcd(a, b):
    while b:
        a, b = b, a % b
    return a

# Algoritmo de Euclides extendido: devuelve (g, x, y) tal que a*x + b*y = g = mcd(a,b)
def euclides_extendido(a, b):
    if b == 0:
        return a, 1, 0
    g, x1, y1 = euclides_extendido(b, a % b)
    return g, y1, x1 - (a // b) * y1

# Inverso modular de e módulo phi (usando Euclides extendido)
def inverso_modular(e, phi):
    g, x, _ = euclides_extendido(e, phi)
    if g != 1:
        raise ValueError(f"Inverso modular no existe: mcd({e},{phi})={g}")
    return x % phi

# ------------------ Exponenciación modular ------------------

# Exponenciación binaria rápida: calcula (base^exp) % mod de forma eficiente
def potencia_modular(base, exp, mod):
    resultado = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            resultado = (resultado * base) % mod
        exp //= 2
        base = (base * base) % mod
    return resultado

# ------------------ Interfaz estándar ------------------

def generar_claves():
    # Generar dos primos distintos y con producto suficientemente grande
    # Se asegura que n > 65536 para poder cifrar caracteres Unicode básicos
    while True:
        p = primo_aleatorio(200, 1000)
        q = primo_aleatorio(200, 1000)
        if p != q and p * q > 65536:
            break

    n   = p * q                     # Módulo público
    phi = (p - 1) * (q - 1)         # Función de Euler
    e   = 3                         # Exponente público (común por eficiencia)
    # Asegurar que e sea coprimo con phi
    while mcd(e, phi) != 1:
        e += 2
    d = inverso_modular(e, phi)     # Exponente privado (inverso de e módulo phi)

    # Pasos didácticos para mostrar en el frontend
    pasos_claves = [
        {
            "titulo": "Elegir dos primos grandes",
            "formula": "p, q ∈ ℙ",
            "detalle": f"Se eligen aleatoriamente dos números primos: p = {p} y q = {q}",
            "valores": {"p": p, "q": q}
        },
        {
            "titulo": "Calcular el módulo n",
            "formula": "n = p × q",
            "detalle": f"n = {p} × {q} = {n}",
            "valores": {"n": n}
        },
        {
            "titulo": "Calcular la función de Euler φ(n)",
            "formula": "φ(n) = (p − 1)(q − 1)",
            "detalle": f"φ({n}) = ({p} − 1) × ({q} − 1) = {p-1} × {q-1} = {phi}",
            "valores": {"phi": phi}
        },
        {
            "titulo": "Elegir exponente público e",
            "formula": "1 < e < φ(n),  mcd(e, φ(n)) = 1",
            "detalle": f"Se busca e tal que sea coprimo con φ(n) = {phi}. Resultado: e = {e}",
            "valores": {"e": e}
        },
        {
            "titulo": "Calcular clave privada d",
            "formula": "d ≡ e⁻¹ (mod φ(n))",
            "detalle": f"d es el inverso modular de e = {e} módulo φ(n) = {phi}. Resultado: d = {d}",
            "valores": {"d": d}
        },
        {
            "titulo": "Claves generadas",
            "formula": "Pública: (e, n)  |  Privada: (d, n)",
            "detalle": f"Clave pública: (e={e}, n={n}) — Clave privada: (d={d}, n={n})",
            "valores": {"publica": f"(e={e}, n={n})", "privada": f"(d={d}, n={n})"}
        },
    ]

    return {
        "publica":      {"e": e, "n": n},
        "privada":      {"d": d, "n": n},
        "parametros":   {"p": p, "q": q, "phi": phi},
        "pasos_claves": pasos_claves,
    }


def encriptar(password: str, clave_publica: dict) -> dict:
    # Extraer clave pública
    e = int(clave_publica["e"])
    n = int(clave_publica["n"])
    cifrado = []
    pasos = []

    # Cifrar cada carácter por separado (cifrado de bloque elemental)
    for caracter in password:
        m = ord(caracter)                # Convertir carácter a su código numérico
        if m >= n:
            raise ValueError(
                f"El carácter '{caracter}' (unicode={m}) supera n={n}. "
                "Genera claves más grandes."
            )
        c = potencia_modular(m, e, n)    # c = m^e mod n
        cifrado.append(c)
        pasos.append({
            "caracter": caracter,
            "m": m,
            "formula": f"{m}^{e} mod {n}",
            "resultado": c,
            "detalle": f"'{caracter}' → ASCII={m} → {m}^{e} mod {n} = {c}"
        })

    return {"encrypted": cifrado, "pasos": pasos}


def desencriptar(cifrado: list, clave_privada: dict) -> dict:
    # Extraer clave privada
    d = int(clave_privada["d"])
    n = int(clave_privada["n"])
    pasos = []
    texto = ""

    # Descifrar cada número del bloque cifrado
    for c in cifrado:
        m = potencia_modular(c, d, n)    # m = c^d mod n
        caracter = chr(m)                # Convertir número a carácter
        texto += caracter
        pasos.append({
            "cifrado": c,
            "formula": f"{c}^{d} mod {n}",
            "m": m,
            "caracter": caracter,
            "detalle": f"c={c} → {c}^{d} mod {n} = {m} → '{caracter}'"
        })

    return {"decrypted": texto, "pasos": pasos}