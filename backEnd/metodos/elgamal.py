"""
metodos/elgamal.py

Cifrado de clave pública ElGamal

Interfaz
  - generar_claves()             , dict con publica, privada, parametros, pasos_claves
  - encriptar(password, clave)   , dict con encrypted, pasos
  - desencriptar(cifrado, clave) , dict con decrypted, pasos

Sin dependencias externas ya que solo usa aritmética modular y teoría de grupos finitos
"""

import random

# --------------- Primalidad ---------------
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


# --------------- Aritmética modular ---------------
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


# --------------- Generador. Raíz primitiva mod p ---------------
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

    # Probar candidatos desde 2 hasta encontrar uno que cumpla g^(phi/q) != 1 para todo q primo | phi
    for g in range(2, p):
        if all(potencia_modular(g, phi // q, p) != 1 for q in factores):
            return g
    return 2



# --------------- Interfaz estándar ---------------
def generar_claves() -> dict:
    p = primo_aleatorio(10_000, 50_000)
    g = encontrar_generador(p)
    x = random.randint(2, p - 2)        # clave privada
    y = potencia_modular(g, x, p)       # clave publica

    phi = p - 1  # orden del grupo (ℤ/pℤ)*

    pasos_claves = [
        {
            "titulo": "Elegir un primo grande p (orden del grupo)",
            "formula": "p ∈ ℙ  →  |(ℤ/pℤ)*| = p − 1",
            "detalle": (
                f"<p class='step-detail'>Se elige aleatoriamente el primo <b style='color:var(--purple)'>p = {p}</b>. "
                f"Este primo define el módulo del grupo y, de paso, su orden o cardinalidad: "
                f"<span class='hl'>|(ℤ/pℤ)*| = p − 1 = {phi}</span> elementos.</p>"
                f"<p class='step-detail'>Todo lo que sigue (generador, exponentes, dificultad del "
                f"ataque) depende de este valor.</p>"
            ),
            "valores": {"p": p, "orden del grupo": phi}
        },
        {
            "titulo": "Grupo cíclico y elemento generador",
            "formula": "(ℤ/pℤ)* es cíclico  ⟺  ∃ g : ⟨g⟩ = (ℤ/pℤ)*",
            "detalle": (
                "<p class='step-detail'>Un resultado clásico de teoría de grupos garantiza que "
                "(ℤ/pℤ)* es siempre <b>cíclico</b>. Existe al menos un elemento g, llamado "
                "<span class='hl'>generador</span>, cuyas potencias "
                "g¹, g², g³, ..., g^(p−1) recorren TODOS los elementos de {1, ..., p−1} sin "
                "repetir antes de volver a 1.</p>"
                "<p class='step-detail'>Ese subconjunto generado por g, denotado ⟨g⟩, coincide "
                "con todo el grupo. Trabajar sobre un grupo cíclico es lo que permite parametrizar "
                "cada elemento como una potencia de g, que es exactamente la base del logaritmo "
                "discreto.</p>"
            ),
            "valores": {}
        },
        {
            "titulo": "Encontrar un generador g, el Teorema de Lagrange",
            "formula": "g es generador  ⟺  g^(φ/q) ≠ 1 (mod p)  ∀ primo q | φ",
            "detalle": (
                f"<p class='step-detail'>Buscar un generador exhaustivamente "
                f"sería costoso. En su lugar se usa el "
                f"<b>Teorema de Lagrange</b>: en un grupo finito, el orden de cualquier elemento "
                f"debe dividir al orden del grupo, <span class='hl'>φ = p−1 = {phi}</span>.</p>"
                f"<p class='step-detail'>Por lo tanto, si g NO genera todo el grupo, su orden es "
                f"necesariamente un divisor propio de φ, expresable como φ/q para algún primo q "
                f"que divide a φ. Basta factorizar φ y verificar que g^(φ/q) ≠ 1 (mod p) para cada "
                f"uno. Si ninguna potencia colapsa a 1, g genera todo el grupo. "
                f"Se halla el generador: <b style='color:var(--purple)'>g = {g}</b>.</p>"
            ),
            "valores": {"g": g}
        },
        {
            "titulo": "Elegir clave privada x, el Problema del Logaritmo Discreto",
            "formula": "x ∈ [2, p−2]  (secreto, uniformemente aleatorio)",
            "detalle": (
                f"<p class='step-detail'>Se elige aleatoriamente el entero secreto "
                f"<b style='color:var(--purple)'>x = {x}</b>, el exponente que solo conoce el "
                f"receptor. Su seguridad no depende de ocultar un algoritmo, sino de una "
                f"asimetría computacional real.</p>"
                f"<p class='step-detail'>Calcular y = gˣ mod p es rápido (exponenciación modular, es decir "
                f"O(log x) multiplicaciones), pero recuperar x conociendo únicamente y, p y g "
                f"(el <span class='hl'>Problema del Logaritmo Discreto (PLD)</span>) no tiene un "
                f"algoritmo eficiente conocido para p grande. Toda la seguridad de ElGamal se "
                f"reduce, en última instancia, a la dificultad de este problema sobre el grupo "
                f"cíclico (ℤ/pℤ)*.</p>"
            ),
            "valores": {"x": x}
        },
        {
            "titulo": "Calcular clave pública y",
            "formula": "y = g^x mod p",
            "detalle": (
                f"<p class='step-detail'>y = {g}<sup>{x}</sup> mod {p} = "
                f"<b style='color:var(--purple)'>{y}</b>. Este valor es "
                f"<span class='hl-green'>público</span>.</p>"
            ),
            "valores": {"y": y}
        },
        {
            "titulo": "Claves generadas",
            "formula": "Pública: (p, g, y)  |  Privada: (p, x)",
            "detalle": (
                f"<p class='step-detail'>Clave <span class='hl-green'>pública</span>: "
                f"(p={p}, g={g}, y={y}) | Clave <span class='hl'>privada</span>: (p={p}, x={x})</p>"
            ),
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
        k  = random.randint(2, p - 2)          # efímero
        c1 = potencia_modular(g, k, p)        # g^k mod p
        yk = potencia_modular(y, k, p)        # y^k mod p (secreto compartido)
        c2 = (m * yk) % p                     # m * y^k mod p

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
                f"'{caracter}' → m={m} (código ASCII, el elemento del grupo a cifrar). "
                f"Se elige un k efímero distinto para CADA carácter (k={k}), lo que hace que "
                f"el mismo carácter repetido en el mensaje produzca pares (c₁, c₂) distintos: "
                f"esta es la propiedad probabilística de ElGamal. "
                f"c₁ = g^k mod p = {g}^{k} mod {p} = {c1} actúa como la 'huella pública' del "
                f"secreto efímero k, expresada dentro del mismo grupo cíclico. "
                f"El secreto compartido efímero es y^k mod p = {y}^{k} mod {p} = {yk} "
                f"(nótese que y^k = (g^x)^k = (g^k)^x = c1^x , esta igualdad es la que permite "
                f"reconstruir y^k en el descifrado sin conocer k). "
                f"Finalmente c₂ = m × y^k mod p = {m} × {yk} mod {p} = {c2} 'enmascara' el "
                f"mensaje multiplicándolo por ese secreto compartido dentro del grupo."
            )
        })

    return {"encrypted": cifrado, "pasos": pasos}


def desencriptar(cifrado: list, clave_privada: dict) -> dict:
    p = int(clave_privada["p"])
    x = int(clave_privada["x"])

    texto = ""
    pasos = []

    for c1, c2 in cifrado:
        s     = potencia_modular(c1, x, p)    # (g^k)^x = g^(kx) = y^k
        s_inv = inverso_modular(s, p)         # inverso de s en el grupo
        m     = (c2 * s_inv) % p              # m = c2 * s^{-1}
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
                f"Paso 1 , Reconstruir el secreto compartido sin conocer k: "
                f"s = c₁ˣ mod p = {c1}^{x} mod {p} = {s}. "
                f"Esto funciona porque c₁ = gᵏ, entonces c₁ˣ = (gᵏ)ˣ = (gˣ)ᵏ = yᵏ: "
                f"el receptor llega al mismo valor y^k que usó quien cifró, solo que aplicando "
                f"su exponente secreto x sobre c₁ en vez de aplicar k sobre y. "
                f"Paso 2 , Invertir el secreto compartido dentro del grupo (ℤ/pℤ)*: "
                f"como todo elemento del grupo tiene inverso multiplicativo único, se calcula "
                f"s⁻¹ = {s_inv} (aquí, vía Fermat: s^(p−2) mod p). "
                f"Paso 3 , Cancelar el enmascaramiento: "
                f"m = c₂ × s⁻¹ mod p = {c2} × {s_inv} mod {p} = {m}. "
                f"Como c₂ = m × yᵏ, al multiplicar por (yᵏ)⁻¹ el factor se cancela algebraicamente "
                f"(yᵏ × (yᵏ)⁻¹ ≡ 1) y queda expuesto el mensaje original m, que corresponde al "
                f"carácter '{caracter}'."
            )
        })

    return {"decrypted": texto, "pasos": pasos}