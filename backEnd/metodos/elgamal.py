"""
metodos/elgamal.py

Cifrado de clave pública ElGamal.
Interfaz estándar del proyecto:
  - generar_claves()            → dict con publica, privada, parametros, pasos_claves
  - encriptar(password, clave)  → dict con encrypted, pasos
  - desencriptar(cifrado, clave)→ dict con decrypted, pasos

Sin dependencias externas: usa solo aritmética modular, igual que rsa.py.
"""

import random


# ─────────────────────────────────────────────
# Primalidad
# ─────────────────────────────────────────────

def es_primo(n: int) -> bool:
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


def primo_aleatorio(minimo: int = 10_000, maximo: int = 50_000) -> int:
    while True:
        candidato = random.randint(minimo, maximo)
        if es_primo(candidato):
            return candidato


# ─────────────────────────────────────────────
# Aritmética modular
# ─────────────────────────────────────────────

def potencia_modular(base: int, exp: int, mod: int) -> int:
    resultado = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            resultado = (resultado * base) % mod
        exp //= 2
        base = (base * base) % mod
    return resultado


def inverso_modular(a: int, p: int) -> int:
    return potencia_modular(a, p - 2, p)


# ─────────────────────────────────────────────
# Generador (raíz primitiva mod p)
# ─────────────────────────────────────────────

def encontrar_generador(p: int) -> int:
    phi = p - 1
    factores = set()
    temp = phi
    d = 2
    while d * d <= temp:
        while temp % d == 0:
            factores.add(d)
            temp //= d
        d += 1
    if temp > 1:
        factores.add(temp)

    for g in range(2, p):
        if all(potencia_modular(g, phi // q, p) != 1 for q in factores):
            return g
    return 2


# ─────────────────────────────────────────────
# Interfaz estándar
# ─────────────────────────────────────────────

def generar_claves() -> dict:
    p = primo_aleatorio(10_000, 50_000)
    g = encontrar_generador(p)
    x = random.randint(2, p - 2)
    y = potencia_modular(g, x, p)

    pasos_claves = [
        {
            "titulo": "Elegir un primo grande p",
            "formula": "p ∈ ℙ",
            "detalle": f"Se elige aleatoriamente el primo p = {p}. Este es el módulo del grupo cíclico.",
            "valores": {"p": p}
        },
        {
            "titulo": "Encontrar un generador g",
            "formula": "g es raíz primitiva mod p",
            "detalle": (
                f"Se busca g tal que genere todo el grupo (ℤ/pℤ)*. "
                f"Esto significa que g^k mod p recorre todos los valores 1..{p-1}. "
                f"Generador encontrado: g = {g}"
            ),
            "valores": {"g": g}
        },
        {
            "titulo": "Elegir clave privada x",
            "formula": "x ∈ [2, p−2]  (secreto)",
            "detalle": f"Se elige aleatoriamente el entero secreto x = {x}. Solo el receptor lo conoce.",
            "valores": {"x": x}
        },
        {
            "titulo": "Calcular clave pública y",
            "formula": "y = g^x mod p",
            "detalle": f"y = {g}^{x} mod {p} = {y}. Este valor es público.",
            "valores": {"y": y}
        },
        {
            "titulo": "Claves generadas",
            "formula": "Pública: (p, g, y)  |  Privada: (p, x)",
            "detalle": f"Clave pública: (p={p}, g={g}, y={y}) — Clave privada: (p={p}, x={x})",
            "valores": {"publica": f"(p={p}, g={g}, y={y})", "privada": f"(p={p}, x={x})"}
        },
    ]

    return {
        "publica":      {"p": p, "g": g, "y": y},
        "privada":      {"p": p, "x": x},
        "parametros":   {"p": p, "g": g, "x": x, "y": y},
        "pasos_claves": pasos_claves,
    }


def encriptar(password: str, clave_publica: dict) -> dict:
    p = int(clave_publica["p"])
    g = int(clave_publica["g"])
    y = int(clave_publica["y"])

    cifrado = []
    pasos = []

    for caracter in password:
        m = ord(caracter)
        if m >= p:
            raise ValueError(
                f"El carácter '{caracter}' (unicode={m}) supera p={p}. "
                "Genera claves más grandes."
            )
        k  = random.randint(2, p - 2)
        c1 = potencia_modular(g, k, p)
        yk = potencia_modular(y, k, p)
        c2 = (m * yk) % p

        cifrado.append([c1, c2])
        pasos.append({
            "caracter": caracter,
            "m": m,
            "k": k,
            "c1_formula": f"{g}^{k} mod {p}",
            "c1": c1,
            "yk_formula": f"{y}^{k} mod {p}",
            "yk": yk,
            "c2_formula": f"{m} × {yk} mod {p}",
            "c2": c2,
            "detalle": (
                f"'{caracter}' → m={m}, k={k} aleatorio | "
                f"c1 = {g}^{k} mod {p} = {c1} | "
                f"c2 = {m} × {y}^{k} mod {p} = {m} × {yk} mod {p} = {c2}"
            )
        })

    return {"encrypted": cifrado, "pasos": pasos}


def desencriptar(cifrado: list, clave_privada: dict) -> dict:
    p = int(clave_privada["p"])
    x = int(clave_privada["x"])

    texto = ""
    pasos = []

    for c1, c2 in cifrado:
        s     = potencia_modular(c1, x, p)
        s_inv = inverso_modular(s, p)
        m     = (c2 * s_inv) % p
        caracter = chr(m)
        texto += caracter
        pasos.append({
            "c1": c1, "c2": c2,
            "s_formula": f"{c1}^{x} mod {p}",
            "s": s,
            "s_inv": s_inv,
            "m_formula": f"{c2} × {s_inv} mod {p}",
            "m": m,
            "caracter": caracter,
            "detalle": (
                f"c1={c1}, c2={c2} | "
                f"s = {c1}^{x} mod {p} = {s} | "
                f"s⁻¹ = {s_inv} | "
                f"m = {c2} × {s_inv} mod {p} = {m} → '{caracter}'"
            )
        })

    return {"decrypted": texto, "pasos": pasos}
