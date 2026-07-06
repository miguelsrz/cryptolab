"""
metodos/reloj_modular.py

Genera los datos necesarios para que el FRONTEND dibuje un "reloj modular"
que representa el grupo cíclico (ℤ/pℤ)* y el generador g de ElGamal.

Este módulo NO genera imágenes ni HTML: solo arma un dict con toda la
información numérica y textual ya calculada, lista para json.dumps().
El frontend (Canvas/SVG/D3, etc.) se encarga de dibujar el reloj a partir
de este JSON.

────────────────────────────────────────────────────────────────
¿Por qué DOS relojes?
────────────────────────────────────────────────────────────────
En producción, p de ElGamal puede ser hasta ~50.000. Dibujar un reloj con
50.000 marcas no comunica nada (no se ve nada, no se puede seguir la
animación). Por eso este módulo entrega:

  1. "reloj_didactico": un grupo pequeño (p chico, ej. 23) generado
     on-the-fly SOLO para fines visuales. Aquí sí se puede pintar el
     reloj completo con las p-1 posiciones y ver cómo el generador g
     "recorre" todas ellas antes de volver a 1. Este reloj es el que
     enseña el concepto de grupo cíclico y generador.

  2. "reloj_real": usa el p, g, x, y REALES de la clave que ya generó
     elgamal.generar_claves(). Como no se puede pintar cada punto,
     se muestrean solo los primeros N pasos de la órbita de g
     (por defecto 12) más los puntos relevantes del cifrado
     (k, c1 = g^k mod p, y^k mod p, c2). El reloj real se dibuja como
     un círculo con marcas solo en los ángulos de esos puntos
     muestreados, indicando "..." para el resto del grupo.

Ambos comparten el mismo esquema de "puntos" para que el frontend use
un solo componente de dibujo para los dos casos.
────────────────────────────────────────────────────────────────
"""

import math
import random

from .elgamal import (
    es_primo,
    potencia_modular,
    encontrar_generador,
    inverso_modular,
)


# ─────────────────────────────────────────────
# Utilidades geométricas
# ─────────────────────────────────────────────

def _angulo_para(posicion: int, modulo_visual: int) -> float:
    """
    Convierte una posición 1..modulo_visual en un ángulo en grados,
    empezando arriba (12 en punto) y avanzando en sentido horario,
    como un reloj de verdad.
    """
    fraccion = (posicion % modulo_visual) / modulo_visual
    return (fraccion * 360.0) - 90.0  # -90 para que la posición 0 quede arriba


def _punto_en_circulo(angulo_grados: float, radio: float = 1.0):
    rad = math.radians(angulo_grados)
    return {"x": round(radio * math.cos(rad), 4), "y": round(radio * math.sin(rad), 4)}


# ─────────────────────────────────────────────
# 1) RELOJ DIDÁCTICO — grupo pequeño para enseñar el concepto
# ─────────────────────────────────────────────

def _generar_grupo_pequeno(minimo: int = 11, maximo: int = 30) -> int:
    """Primo pequeño para que el reloj didáctico sea legible (pocas marcas)."""
    candidatos = [n for n in range(minimo, maximo + 1) if es_primo(n)]
    return random.choice(candidatos)


def construir_reloj_didactico(p: int = None) -> dict:
    """
    Construye el reloj completo de un grupo (ℤ/pℤ)* pequeño, mostrando:
      - Las p-1 posiciones del reloj (1, 2, ..., p-1)
      - El generador g encontrado
      - La órbita COMPLETA de g: g¹, g², g³, ... hasta volver a 1
      - Un candidato que NO es generador, para contraste (opcional)

    Devuelve un dict serializable a JSON con toda la info que el
    frontend necesita para dibujar el reloj y animar la órbita.
    """
    if p is None:
        p = _generar_grupo_pequeno()

    phi = p - 1
    g = encontrar_generador(p)

    # Órbita completa del generador: g^1, g^2, ..., g^phi (=1)
    orbita = []
    valor = 1
    for paso in range(1, phi + 1):
        valor = (valor * g) % p
        orbita.append({
            "paso": paso,
            "formula": f"{g}^{paso} mod {p}",
            "valor": valor,
            "angulo": round(_angulo_para(valor, p), 2),
            "punto": _punto_en_circulo(_angulo_para(valor, p)),
        })

    # Buscar un NO-generador para contraste didáctico (si existe alguno != g)
    no_generador = None
    for candidato in range(2, p):
        if candidato == g:
            continue
        orden = _orden_de_elemento(candidato, p, phi)
        if orden < phi:
            no_generador = {
                "valor": candidato,
                "orden": orden,
                "detalle": (
                    f"El elemento {candidato} tiene orden {orden} (no {phi}), "
                    f"es decir, sus potencias solo visitan {orden} de las {phi} "
                    f"posiciones del reloj antes de repetirse. Por eso NO es generador."
                ),
            }
            break

    # Todas las marcas del reloj (1..p-1), para dibujar el círculo completo
    marcas = []
    for posicion in range(1, p):
        marcas.append({
            "valor": posicion,
            "angulo": round(_angulo_para(posicion, p), 2),
            "punto": _punto_en_circulo(_angulo_para(posicion, p)),
        })

    return {
        "tipo": "didactico",
        "p": p,
        "phi": phi,
        "g": g,
        "marcas": marcas,              # las p-1 posiciones del reloj
        "orbita_generador": orbita,    # secuencia completa g^1..g^phi
        "no_generador_ejemplo": no_generador,
        "explicacion": (
            f"Este reloj de {phi} posiciones representa el grupo cíclico "
            f"(ℤ/{p}ℤ)* = {{1, 2, ..., {phi}}}. El generador g={g} recorre "
            f"las {phi} posiciones del reloj sin repetir ninguna antes de "
            f"volver a 1, dando toda la vuelta exactamente en {phi} pasos."
        ),
    }


def _orden_de_elemento(a: int, p: int, phi: int) -> int:
    """Menor k>0 tal que a^k ≡ 1 (mod p). Útil solo para el ejemplo didáctico
    (grupos pequeños), por eso la búsqueda lineal es aceptable aquí."""
    valor = a % p
    k = 1
    while valor != 1:
        valor = (valor * a) % p
        k += 1
    return k


# ─────────────────────────────────────────────
# 2) RELOJ REAL — usa p, g, x, y reales de la clave generada
# ─────────────────────────────────────────────

def construir_reloj_real(clave_publica: dict, pasos_a_mostrar: int = 12) -> dict:
    """
    A partir de la clave pública REAL (p, g, y) ya generada por
    elgamal.generar_claves(), arma los datos para dibujar un reloj de p
    posiciones, pero solo con marcas en los primeros `pasos_a_mostrar`
    puntos de la órbita de g (dibujar las p-1 marcas reales no sirve
    visualmente porque p puede ser decenas de miles).

    El frontend debe dibujar el círculo "vacío" (sin decenas de miles de
    marcas) y resaltar únicamente los puntos que vienen en 'orbita_muestra'.
    """
    p = int(clave_publica["p"])
    g = int(clave_publica["g"])
    y = int(clave_publica["y"])
    phi = p - 1

    orbita_muestra = []
    valor = 1
    for paso in range(1, pasos_a_mostrar + 1):
        valor = (valor * g) % p
        orbita_muestra.append({
            "paso": paso,
            "formula": f"{g}^{paso} mod {p}",
            "valor": valor,
            "angulo": round(_angulo_para(valor, p), 2),
            "punto": _punto_en_circulo(_angulo_para(valor, p)),
        })

    # Punto de la clave pública y = g^x mod p (x es secreto, no se muestra)
    punto_y = {
        "valor": y,
        "angulo": round(_angulo_para(y, p), 2),
        "punto": _punto_en_circulo(_angulo_para(y, p)),
    }

    return {
        "tipo": "real",
        "p": p,
        "phi": phi,
        "g": g,
        "y": y,
        "pasos_mostrados": pasos_a_mostrar,
        "orbita_muestra": orbita_muestra,   # primeros N puntos de la órbita real
        "punto_clave_publica": punto_y,     # dónde cae y en el reloj
        "explicacion": (
            f"Este reloj representa (ℤ/{p}ℤ)*, con {phi} posiciones en total. "
            f"Como {phi} es demasiado grande para dibujar cada marca, se muestran "
            f"solo los primeros {pasos_a_mostrar} pasos de la órbita del generador "
            f"g={g}: g¹, g², ..., g^{pasos_a_mostrar} mod {p}. El resto del reloj "
            f"se representa como una línea continua (el generador seguiría "
            f"recorriendo las {phi} posiciones sin repetir)."
        ),
    }


def construir_reloj_cifrado(password: str, clave_publica: dict, clave_privada: dict = None,
                             max_caracteres: int = 5) -> dict:
    """
    Además de la órbita del generador, muestra sobre el MISMO reloj real
    los puntos que participan en el cifrado de cada carácter:
      - m  (mensaje, el carácter como código ASCII)
      - k  (exponente efímero elegido al azar)
      - c1 = g^k mod p
      - yk = y^k mod p (secreto compartido efímero)
      - c2 = m * yk mod p

    Solo se procesan hasta `max_caracteres` para no saturar el reloj.
    Reutiliza encriptar() de elgamal para no duplicar lógica, pero aquí
    se recalculan los mismos valores para poder ubicarlos en el reloj
    con su ángulo (encriptar() no expone los ángulos porque no conoce
    del concepto de "reloj").
    """
    p = int(clave_publica["p"])
    g = int(clave_publica["g"])
    y = int(clave_publica["y"])

    puntos_cifrado = []
    for caracter in password[:max_caracteres]:
        m = ord(caracter)
        if m >= p:
            continue  # se omite en el reloj; el error real ya lo lanza encriptar()
        k = random.randint(2, p - 2)
        c1 = potencia_modular(g, k, p)
        yk = potencia_modular(y, k, p)
        c2 = (m * yk) % p

        def _marca(valor, etiqueta):
            ang = _angulo_para(valor, p)
            return {
                "valor": valor,
                "etiqueta": etiqueta,
                "angulo": round(ang, 2),
                "punto": _punto_en_circulo(ang),
            }

        puntos_cifrado.append({
            "caracter": caracter,
            "k": k,
            "m":  _marca(m,  "m (mensaje)"),
            "c1": _marca(c1, "c₁ = g^k mod p"),
            "yk": _marca(yk, "y^k mod p (secreto compartido)"),
            "c2": _marca(c2, "c₂ = m·y^k mod p (cifrado)"),
        })

    return {
        "tipo": "cifrado_sobre_reloj",
        "p": p,
        "g": g,
        "y": y,
        "puntos_por_caracter": puntos_cifrado,
        "resumen_c2": [
            {"caracter": pc["caracter"], "valor": pc["c2"]["valor"], "punto": pc["c2"]["punto"]}
            for pc in puntos_cifrado
        ],
        "explicacion": (
            "Cada carácter cifrado agrega 4 puntos al reloj: el mensaje m, "
            "el valor público c₁ (huella del secreto efímero k), el secreto "
            "compartido y^k, y el resultado final c₂. Nota cómo c₂ depende "
            "de multiplicar m por y^k: por eso el receptor necesita reconstruir "
            "y^k (usando su clave privada x) para poder despejar m."
        ),
    }


# ─────────────────────────────────────────────
# Interfaz de alto nivel para el router
# ─────────────────────────────────────────────

def generar_datos_reloj(body: dict) -> dict:
    
    """
    Punto de entrada único para la ruta /reloj.

    body esperado (todos los campos opcionales salvo cuando se pide cifrado):
    {
        "clave_publica": {"p":.., "g":.., "y":..}   # si no viene, se generan claves nuevas
        "password": "texto a cifrar"                 # opcional, para animar el cifrado
        "pasos_reales": 12                            # opcional, cuántos pasos mostrar en el reloj real
        "incluir_didactico": true                     # opcional, default true
    }
    """
    from . import elgamal as _elgamal

    incluir_didactico = body.get("incluir_didactico", True)
    pasos_reales = int(body.get("pasos_reales", 12))
    password = body.get("password")

    clave_publica = body.get("clave_publica")
    clave_privada = None
    if not clave_publica:
        claves = _elgamal.generar_claves()
        clave_publica = claves["publica"]
        clave_privada = claves["privada"]

    resultado = {
        "reloj_real": construir_reloj_real(clave_publica, pasos_a_mostrar=pasos_reales),
    }

    if incluir_didactico:
        resultado["reloj_didactico"] = construir_reloj_didactico()

    if password:
        resultado["reloj_cifrado"] = construir_reloj_cifrado(
            password, clave_publica, clave_privada
        )

    # Se devuelven también las claves usadas, por si el frontend las necesita
    resultado["clave_publica_usada"] = clave_publica
    if clave_privada:
        resultado["clave_privada_generada"] = clave_privada

    return resultado
