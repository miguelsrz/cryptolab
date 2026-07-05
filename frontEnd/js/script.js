const API_BASE = "/api";

// ─────────────────────────────────────────────
// Estado de la sesión
// ─────────────────────────────────────────────
const sesion = {
  metodo:        "rsa",
  clave_publica: null,
  clave_privada: null,
  parametros:    null,
  pasos_claves:  null,   // pasos generación de claves
  ultimo_cifrado: null,
  pasos_cifrado:  null,  // pasos de encriptación
  pasos_descifrado: null,
  texto_plano:      null, // texto que el usuario cifró por última vez
  texto_descifrado: null, // texto recuperado en el último descifrado
};

// Tab activa
let tabActiva = "claves";

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  cargarClaves();

  document.getElementById("metodo").addEventListener("change", (e) => {
    sesion.metodo         = e.target.value;
    sesion.clave_publica  = null;
    sesion.clave_privada  = null;
    sesion.ultimo_cifrado = null;
    sesion.pasos_claves   = null;
    sesion.pasos_cifrado  = null;
    sesion.pasos_descifrado = null;
    sesion.texto_plano      = null;
    sesion.texto_descifrado = null;

    document.getElementById("resultado").classList.remove("visible");
    document.getElementById("resultado-descifrado-container").classList.remove("visible");
    document.getElementById("error").classList.remove("visible");

    cargarClaves();
  });

  // Enter en el input de password
  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") encriptar();
  });
});

// ─────────────────────────────────────────────
// CLAVES
// ─────────────────────────────────────────────
async function cargarClaves() {
  const btn = document.getElementById("btn-generar-claves");
  if (btn) { btn.disabled = true; btn.textContent = "Generando…"; }

  mostrarEstadoClaves("Generando…", "loading");
  limpiarPasos();

  // Las claves anteriores dejan de servir: se invalida cualquier cifrado/descifrado previo.
  sesion.ultimo_cifrado    = null;
  sesion.pasos_cifrado     = null;
  sesion.pasos_descifrado  = null;
  sesion.texto_plano       = null;
  sesion.texto_descifrado  = null;
  document.getElementById("resultado").classList.remove("visible");
  document.getElementById("resultado-descifrado-container").classList.remove("visible");
  document.getElementById("error").classList.remove("visible");

  try {
    const response = await fetch(`${API_BASE}/claves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metodo: sesion.metodo }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error al generar claves");

    sesion.clave_publica = data.publica;
    sesion.clave_privada = data.privada;
    sesion.parametros    = data.parametros;
    sesion.pasos_claves  = data.pasos_claves || [];

    mostrarEstadoClaves("Claves listas ✓", "ok");
    actualizarInfoClaves();

    // Mostrar pasos de generación de claves automáticamente
    cambiarTab("claves");

  } catch (error) {
    mostrarEstadoClaves("Error ✗", "error");
    console.error(error);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Generar nuevas claves"; }
  }
}

// ─────────────────────────────────────────────
// ENCRIPTAR
// ─────────────────────────────────────────────
async function encriptar() {
  const password     = document.getElementById("password").value.trim();
  const resultadoDiv = document.getElementById("resultado");
  const errorDiv     = document.getElementById("error");
  const btn          = document.getElementById("btn-encriptar");

  resultadoDiv.classList.remove("visible");
  document.getElementById("resultado-descifrado-container").classList.remove("visible");
  errorDiv.classList.remove("visible");

  if (!password) { mostrarError("Por favor ingresa un texto."); return; }
  if (!sesion.clave_publica) { mostrarError("Las claves aún no están listas."); return; }

  btn.disabled = true;
  btn.textContent = "Cifrando…";

  try {
    const response = await fetch(`${API_BASE}/encriptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metodo:        sesion.metodo,
        password,
        clave_publica: sesion.clave_publica,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la encriptación");

    sesion.ultimo_cifrado = data.encrypted;
    sesion.pasos_cifrado  = data.pasos || [];
    sesion.texto_plano    = password;

    document.getElementById("resultado-texto").textContent =
      JSON.stringify(data.encrypted);
    resultadoDiv.classList.add("visible");

    cambiarTab("cifrado");

  } catch (error) {
    mostrarError("Error: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Encriptar";
  }
}

// ─────────────────────────────────────────────
// DESENCRIPTAR
// ─────────────────────────────────────────────
async function desencriptar() {
  const errorDiv = document.getElementById("error");
  errorDiv.classList.remove("visible");

  if (!sesion.ultimo_cifrado) { mostrarError("Encripta un texto primero."); return; }
  if (!sesion.clave_privada)  { mostrarError("No hay clave privada en sesión."); return; }

  try {
    const response = await fetch(`${API_BASE}/desencriptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metodo:        sesion.metodo,
        cifrado:       sesion.ultimo_cifrado,
        clave_privada: sesion.clave_privada,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la desencriptación");

    sesion.pasos_descifrado = data.pasos || [];
    sesion.texto_descifrado = data.decrypted;

    document.getElementById("resultado-descifrado").textContent = data.decrypted;
    document.getElementById("resultado-descifrado-container").classList.add("visible");

    cambiarTab("descifrado");

  } catch (error) {
    mostrarError("Error: " + error.message);
  }
}

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
function cambiarTab(tab) {
  tabActiva = tab;

  // Actualizar clases de tabs
  ["claves", "cifrado", "descifrado", "teoria"].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle("active", t === tab);
  });

  // Mostrar pasos correspondientes
  switch (tab) {
    case "claves":
      renderPasosClaves(sesion.pasos_claves || []);
      break;
    case "cifrado":
      renderPasosCifrado(sesion.pasos_cifrado || [], sesion.metodo);
      break;
    case "descifrado":
      renderPasosDescifrado(sesion.pasos_descifrado || [], sesion.metodo);
      break;
    case "teoria":
      renderTeoria(sesion.metodo);
      break;
  }
}

// ─────────────────────────────────────────────
// RENDER — pestaña Teoría
// ─────────────────────────────────────────────

// ID del video de YouTube a mostrar en la teoría de ElGamal.
// "Píldora formativa 42: ¿Cómo funciona el algoritmo de ElGamal?" (UPM / Thoth).
// Cámbialo aquí si el equipo decide usar otro video.
const YOUTUBE_ELGAMAL_ID = "N3ANaOi9gAc";

function renderTeoria(metodo) {
  ocultarPlaceholder();

  let items = [];

  if (metodo === "elgamal") {
    items = [
      {
        num: 1,
        titulo: "¿Qué es ElGamal y por qué usa teoría de grupos?",
        formula: "",
        body: `
          <p class="step-detail">
            <b>ElGamal</b> es un criptosistema de <b>clave pública</b> propuesto por Taher
            Elgamal en 1984. A diferencia de RSA, que basa su seguridad en la dificultad de
            <b>factorizar</b> un número grande, ElGamal basa toda su seguridad en la dificultad
            de resolver el <span class="hl">Problema del Logaritmo Discreto (PLD)</span> dentro
            de un <b>grupo cíclico finito</b>.
          </p>
          <p class="step-detail">
            Esto lo convierte en el ejemplo perfecto para conectar la <b>teoría de grupos</b>
            vista en el curso con una aplicación real de seguridad informática: cada operación
            de cifrado y descifrado es, literalmente, una manipulación algebraica de elementos
            de un grupo.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "El campo finito 𝔽ₚ y el grupo multiplicativo (ℤ/pℤ)*",
        formula: "𝔽ₚ = ℤ/pℤ   →   (ℤ/pℤ)* = {1, 2, ..., p−1}",
        body: `
          <p class="step-detail">
            Se parte de un número <b>primo p</b>, que define el campo finito 𝔽ₚ. De ese campo
            se extrae el conjunto de sus elementos <b>distintos de cero</b>: {1, 2, ..., p−1}.
            Dotado de la operación <b>multiplicación módulo p</b>, este conjunto forma el grupo
            <span class="hl">(ℤ/pℤ)*</span>, que es el escenario donde ocurre todo ElGamal.
          </p>
          <p class="step-detail">
            Como p es primo, ningún elemento de 1 a p−1 comparte factores con p, así que todos
            son invertibles. Esa es la razón matemática por la que se descarta el 0: no tiene
            inverso multiplicativo y rompería la estructura de grupo.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Verificación de los 4 axiomas de grupo",
        formula: "(G, ·) es grupo ⟺ cierre + asociatividad + neutro + inversos",
        body: `
          <p class="step-detail">
            Para que (ℤ/pℤ)* sea formalmente un <b>grupo</b> deben cumplirse cuatro
            propiedades:
          </p>
          <p class="step-detail">
            <span class="hl-green">1. Cierre:</span> a·b mod p siempre pertenece a {1,...,p−1}.
            <br/><span class="hl-green">2. Asociatividad:</span> (a·b)·c ≡ a·(b·c) (mod p).
            <br/><span class="hl-green">3. Elemento neutro:</span> existe 1 tal que a·1 ≡ a (mod p).
            <br/><span class="hl-green">4. Inversos:</span> todo a tiene un único a⁻¹ tal que
            a·a⁻¹ ≡ 1 (mod p), garantizado por el <b>Pequeño Teorema de Fermat</b>
            (a^(p−2) ≡ a⁻¹ mod p, porque p es primo).
          </p>
          <p class="step-detail">
            Al cumplirse las cuatro, (ℤ/pℤ)* es un <b>grupo abeliano finito</b>: exactamente
            la estructura que ElGamal necesita para que cifrar y descifrar sean operaciones
            inversas bien definidas.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "Grupos cíclicos, generadores y el Teorema de Lagrange",
        formula: "⟨g⟩ = (ℤ/pℤ)*   ⟺   orden(g) = p − 1",
        body: `
          <p class="step-detail">
            (ℤ/pℤ)* siempre es <b>cíclico</b>: existe al menos un elemento <b>g</b>, llamado
            <span class="hl">generador o raíz primitiva</span>, cuyas potencias g¹, g², g³, ...
            recorren <b>todo</b> el grupo antes de repetirse. El orden del grupo es |(ℤ/pℤ)*| = p−1.
          </p>
          <p class="step-detail">
            Encontrar g de forma eficiente usa el <b>Teorema de Lagrange</b>: en un grupo finito,
            el orden de cualquier elemento debe dividir al orden del grupo. Por lo tanto, basta
            factorizar φ = p−1 en sus primos q y verificar que g^(φ/q) ≠ 1 (mod p) para cada uno;
            si ninguno colapsa a 1, g genera necesariamente todo el grupo.
          </p>
        `,
      },
      {
        num: 5,
        titulo: "El Problema del Logaritmo Discreto (PLD)",
        formula: "Fácil: y = gˣ mod p    |    Difícil: recuperar x desde (g, p, y)",
        body: `
          <p class="step-detail">
            Toda la seguridad de ElGamal se reduce a esta asimetría: calcular y = g<sup>x</sup>
            mod p es <b>rápido</b> (exponenciación modular, O(log x)), pero el proceso inverso —
            encontrar x conociendo solo g, p y y— <b>no tiene un algoritmo eficiente conocido</b>
            para p suficientemente grande.
          </p>
          <p class="step-detail">
            Esta dificultad computacional (y no un secreto de implementación) es lo que protege
            la clave privada x, incluso si toda la clave pública (p, g, y) es de dominio público.
          </p>
        `,
      },
      {
        num: 6,
        titulo: "¿Por qué ElGamal es un cifrado probabilístico?",
        formula: "k efímero y aleatorio → mismo mensaje, cifrados distintos",
        body: `
          <p class="step-detail">
            A diferencia de RSA (determinista), ElGamal introduce un exponente <b>k</b> aleatorio
            y efímero en <b>cada</b> operación de cifrado. Esto hace que cifrar el mismo mensaje
            dos veces con la misma clave pública produzca resultados completamente distintos.
          </p>
          <p class="step-detail">
            Esta propiedad se llama <span class="hl">seguridad semántica</span>: un atacante que
            observa el cifrado no puede saber si dos criptogramas corresponden al mismo mensaje
            original, lo cual es una ventaja de seguridad importante frente a esquemas
            deterministas.
          </p>
        `,
      },
      {
        num: 7,
        titulo: "Video recomendado",
        formula: "",
        body: `
          <p class="step-detail">
            Para reforzar visualmente estos conceptos, recomendamos el siguiente video:
          </p>
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/${YOUTUBE_ELGAMAL_ID}"
              title="Video explicativo de ElGamal" allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>
          <p class="video-caption">
            "Píldora formativa: ¿Cómo funciona el algoritmo de ElGamal?" — si el equipo prefiere
            otro video, solo hay que reemplazar el ID en la constante
            <code>YOUTUBE_ELGAMAL_ID</code> al inicio de script.js.
          </p>
        `,
      },
    ];
  } else if (metodo === "rsa") {
    items = [
      {
        num: 1,
        titulo: "Fundamento de RSA: factorización de enteros",
        formula: "n = p × q   —   difícil recuperar p, q solo desde n",
        body: `
          <p class="step-detail">
            La seguridad de <b>RSA</b> descansa en la <b>asimetría computacional</b> de la
            factorización: multiplicar dos primos grandes p y q es directo, pero factorizar
            su producto n de vuelta en p y q es computacionalmente inviable para n grande.
          </p>
          <p class="step-detail">
            La clave pública (e, n) y la privada (d, n) se relacionan mediante
            <span class="hl">e · d ≡ 1 (mod φ(n))</span>, donde φ(n) = (p−1)(q−1) es la
            función Toziente de Euler.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "Algoritmo Extendido de Euclides",
        formula: "d ≡ e⁻¹ (mod φ(n))",
        body: `
          <p class="step-detail">
            A diferencia de ElGamal (que invierte vía Fermat, porque trabaja módulo un
            <b>primo</b>), RSA trabaja módulo n = p·q, que <b>no es primo</b>. Por eso necesita
            el <b>Algoritmo Extendido de Euclides</b> para calcular el inverso modular de e.
          </p>
        `,
      },
    ];
  } else if (metodo === "aes") {
    items = [
      {
        num: 1,
        titulo: "Fundamento de AES: campos de Galois GF(2⁸)",
        formula: "AES-256-CBC",
        body: `
          <p class="step-detail">
            <b>AES</b> es un cifrado <b>simétrico</b> de bloque: la misma clave cifra y
            descifra. Sus transformaciones internas (como la S-Box) operan sobre un
            <span class="hl">Campo de Galois GF(2⁸)</span>, donde cada byte se interpreta como
            un polinomio con coeficientes en ℤ₂.
          </p>
          <p class="step-detail">
            El modo <b>CBC</b> encadena los bloques cifrados (cada bloque se combina con XOR
            contra el anterior antes de cifrarse), evitando que bloques idénticos de texto
            plano produzcan el mismo cifrado.
          </p>
        `,
      },
    ];
  }

  renderStepList(items);
}


function renderPasosClaves(pasos) {
  if (!pasos || pasos.length === 0) {
    mostrarPlaceholder();
    return;
  }
  ocultarPlaceholder();

  const items = pasos.map((p, i) => ({
    num:     i + 1,
    titulo:  p.titulo,
    formula: p.formula,
    body:    `
      <p class="step-detail">${p.detalle}</p>
      ${renderKV(p.valores || {})}
    `,
  }));

  // Widget interactivo adicional solo para ElGamal: calculadora de
  // exponenciación modular rápida (cuadrado y multiplicación), prellenada
  // con los valores reales de la sesión (g, x, p).
  if (sesion.metodo === "elgamal" && sesion.parametros) {
    const { g, x, p: pMod } = sesion.parametros;
    items.push({
      num: items.length + 1,
      titulo: "Interactivo: prueba tú mismo la exponenciación modular rápida",
      formula: "",
      body: `
        <p class="step-detail">
          Este es el mismo algoritmo de <b>cuadrado y multiplicación</b> que el sistema usa
          internamente para calcular g^x mod p. Cambia los valores y observa cómo el exponente
          se procesa <b>bit a bit</b> en lugar de multiplicar uno por uno.
        </p>
        <div class="interactive-box">
          <div class="interactive-label">🧮 Calculadora paso a paso</div>
          <div class="interactive-row">
            <label>Base
              <input type="number" id="expdemo-base" value="${g ?? 2}" />
            </label>
            <label>Exponente
              <input type="number" id="expdemo-exp" value="${x ?? 5}" />
            </label>
            <label>Módulo
              <input type="number" id="expdemo-mod" value="${pMod ?? 23}" />
            </label>
            <button class="btn-interactive" onclick="ejecutarExpModDemo()" style="align-self:flex-end;">Calcular</button>
          </div>
          <div id="expdemo-resultado" class="interactive-result"></div>
        </div>
      `,
    });
  }

  renderStepList(items);
}

// ─────────────────────────────────────────────
// RENDER — pasos de cifrado
// ─────────────────────────────────────────────
function renderPasosCifrado(pasos, metodo) {
  if (!pasos || pasos.length === 0) {
    mostrarPlaceholder("Encripta un texto para ver los pasos de cifrado.");
    return;
  }
  ocultarPlaceholder();

  if (metodo === "rsa") {
    // RSA: tabla por caracter
    const items = [
      {
        num: 1,
        titulo: "Fórmula de cifrado RSA",
        formula: "c ≡ mᵉ (mod n)",
        body: `<p class="step-detail">
          Cada carácter se convierte a su código ASCII (m) y se eleva al exponente público e,
          módulo n. El resultado c es el carácter cifrado.
        </p>`,
      },
      {
        num: 2,
        titulo: `Cifrado carácter a carácter (${pasos.length} carácter${pasos.length !== 1 ? "es" : ""})`,
        formula: `e = ${sesion.clave_publica?.e}, n = ${sesion.clave_publica?.n}`,
        body: renderTablaRSACifrado(pasos),
      },
    ];
    renderStepList(items);
  }
  else if (metodo === "elgamal") {
    const { p: pPub, g: gPub, y: yPub } = sesion.clave_publica || {};
    const texto = sesion.texto_plano;
    const resumenTexto = texto
      ? `<p class="step-detail">
           Mensaje que se está cifrando: <b style="color:var(--purple)">"${escapar(texto)}"</b>
           (${pasos.length} carácter${pasos.length !== 1 ? "es" : ""}), con la clave pública
           actual <span class="hl">p=${pPub}, g=${gPub}, y=${yPub}</span>.
         </p>`
      : "";

    const items = [
      {
        num: 1,
        titulo: "1. El grupo cíclico donde ocurre el cifrado",
        formula: `p=${pPub}, g=${gPub}, y=${yPub}`,
        body: `
          ${resumenTexto}
          <p class="step-detail">
            El cifrado ocurre íntegramente dentro del grupo cíclico multiplicativo
            <b>(ℤ/pℤ)*</b> generado por <span class="hl">g=${gPub}</span> módulo
            <span class="hl">p=${pPub}</span>. Cada valor que se calcula —c₁, yᵏ, c₂— es un
            elemento de ese mismo grupo, así que todas las operaciones (multiplicación,
            exponenciación, inversión) respetan sus propiedades algebraicas.
          </p>
          <p class="step-detail">
            Para <b>cada carácter</b> del mensaje se elige un exponente
            <span class="hl">k efímero y aleatorio</span> — uno distinto incluso si el
            carácter se repite. Esto es lo que hace de ElGamal un cifrado
            <b>probabilístico</b>: el mismo mensaje cifrado dos veces con la misma clave
            pública produce criptogramas completamente distintos.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "2. Calcular c₁ — la huella pública del secreto efímero",
        formula: "c₁ = gᵏ mod p",
        body: `
          <p class="step-detail">
            c₁ = g<sup>k</sup> mod p = <span class="hl">${gPub}</span><sup>k</sup> mod
            <span class="hl">${pPub}</span> es la <b>huella pública</b> del secreto efímero k,
            expresada como un elemento del grupo generado por g. Cualquiera que vea c₁ no
            puede recuperar k sin resolver el Problema del Logaritmo Discreto.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "3. Calcular el secreto compartido yᵏ y enmascarar el mensaje",
        formula: "yᵏ mod p   →   c₂ = m · yᵏ mod p",
        body: `
          <p class="step-detail">
            y<sup>k</sup> mod p = <span class="hl">${yPub}</span><sup>k</sup> mod
            <span class="hl">${pPub}</span> es el <b>secreto compartido</b> efímero. Nótese
            la igualdad clave: y<sup>k</sup> = (g<sup>x</sup>)<sup>k</sup> =
            (g<sup>k</sup>)<sup>x</sup> = c₁ˣ. Esta conmutatividad de exponentes es
            justamente lo que permitirá al receptor reconstruir y<sup>k</sup> más adelante
            <b>sin conocer k</b>, usando su clave privada x sobre c₁.
          </p>
          <p class="step-detail">
            Finalmente, c₂ = m · y<sup>k</sup> mod p "enmascara" el mensaje multiplicándolo
            por ese secreto compartido dentro del grupo. El par <b>(c₁, c₂)</b> es el texto
            cifrado del carácter. La seguridad de todo esto depende de que, sin conocer x ni
            k, calcular y<sup>k</sup> a partir de g, p, y y c₁ es tan difícil como resolver
            el PLD.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "Interactivo: cifra el mismo carácter con distintos k",
        formula: "",
        body: `
          <p class="step-detail">
            Prueba cifrar el <b>mismo carácter varias veces</b>: cada clic genera un nuevo
            k aleatorio y verás cómo (c₁, c₂) cambia por completo aunque m sea idéntico —
            esa es la propiedad probabilística en acción.
          </p>
          <div class="interactive-box">
            <div class="interactive-label">🎲 Simulador de re-cifrado</div>
            <div class="interactive-row">
              <label>Carácter
                <input type="text" id="simk-char" class="char-input" maxlength="1" value="A" />
              </label>
              <button class="btn-interactive" onclick="simularCifradoK()" style="align-self:flex-end;">
                Cifrar con nuevo k
              </button>
              <button class="btn-interactive" onclick="limpiarSimuladorCifrado()" style="align-self:flex-end;">
                Limpiar
              </button>
            </div>
            <table class="char-table" id="simk-tabla" style="display:none;">
              <thead><tr><th>k (nuevo)</th><th>c₁=gᵏ</th><th>yᵏ</th><th>c₂</th></tr></thead>
              <tbody id="simk-tabla-body"></tbody>
            </table>
            <p class="interactive-note" id="simk-nota"></p>
          </div>
        `,
      },
      {
        num: 5,
        titulo: `Cifrado carácter a carácter (${pasos.length} carácter${pasos.length !== 1 ? "es" : ""})`,
        formula: `p=${sesion.clave_publica?.p}, g=${sesion.clave_publica?.g}, y=${sesion.clave_publica?.y}`,
        body: renderTablaElGamalCifrado(pasos),
      },
    ];
    renderStepList(items);
  }
  else if (metodo === "aes") {
    // AES: pasos de proceso (genéricos)
    const items = pasos.map((p, i) => ({
      num:     i + 1,
      titulo:  p.titulo,
      formula: "",
      body: `
        <p class="step-detail">${escapar(p.detalle)}</p>
        ${renderKV(p.valores || {})}
      `,
    }));
    renderStepList(items);
  }
}

// ─────────────────────────────────────────────
// RENDER — pasos de descifrado
// ─────────────────────────────────────────────
function renderPasosDescifrado(pasos, metodo) {
  if (!pasos || pasos.length === 0) {
    mostrarPlaceholder("Desencripta para ver los pasos.");
    return;
  }
  ocultarPlaceholder();

  if (metodo === "rsa") {
    const items = [
      {
        num: 1,
        titulo: "Fórmula de descifrado RSA",
        formula: "m ≡ cᵈ (mod n)",
        body: `<p class="step-detail">
          Cada valor cifrado c se eleva a la clave privada d, módulo n.
          El resultado es el código ASCII original del carácter.
        </p>`,
      },
      {
        num: 2,
        titulo: `Descifrado carácter a carácter (${pasos.length})`,
        formula: `d = ${sesion.clave_privada?.d}, n = ${sesion.clave_privada?.n}`,
        body: renderTablaRSADescifrado(pasos),
      },
    ];
    renderStepList(items);
  }
  else if (metodo === "elgamal") {
    const { p: pPriv, x: xPriv } = sesion.clave_privada || {};
    const textoDesc = sesion.texto_descifrado;
    const resumenTexto = textoDesc
      ? `<p class="step-detail">
           Mensaje recuperado: <b style="color:var(--purple)">"${escapar(textoDesc)}"</b>
           (${pasos.length} carácter${pasos.length !== 1 ? "es" : ""}), usando la clave
           privada actual <span class="hl">p=${pPriv}, x=${xPriv}</span>.
         </p>`
      : "";

    const items = [
      {
        num: 1,
        titulo: "1. Reconstruir el secreto compartido sin conocer k",
        formula: `s = c₁^${xPriv ?? "x"} mod ${pPriv ?? "p"}`,
        body: `
          ${resumenTexto}
          <p class="step-detail">
            Como c₁ = g<sup>k</sup>, se cumple c₁<sup>x</sup> = (g<sup>k</sup>)<sup>x</sup> =
            (g<sup>x</sup>)<sup>k</sup> = y<sup>k</sup>. El receptor llega al <b>mismo</b>
            valor y<sup>k</sup> que usó quien cifró, pero aplicando su exponente secreto
            <span class="hl">x=${xPriv}</span> sobre c₁ en vez de aplicar k sobre y. Nunca
            necesitó conocer k.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "2. Invertir el secreto dentro del grupo (ℤ/pℤ)*",
        formula: `s⁻¹ ≡ s^(${pPriv ? pPriv + "−2" : "p−2"}) mod ${pPriv ?? "p"}`,
        body: `
          <p class="step-detail">
            Todo elemento de (ℤ/pℤ)* tiene un <b>único</b> inverso multiplicativo (uno de
            los 4 axiomas de grupo verificados antes). Se calcula vía el
            <span class="hl">Pequeño Teorema de Fermat</span>: s⁻¹ = s<sup>p−2</sup> mod
            <span class="hl">${pPriv}</span>, reutilizando la misma rutina de exponenciación
            modular rápida.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "3. Cancelar el enmascaramiento y recuperar el mensaje",
        formula: "m = c₂ · s⁻¹ mod p",
        body: `
          <p class="step-detail">
            Como c₂ = m · y<sup>k</sup>, al multiplicar por (y<sup>k</sup>)⁻¹ el factor se
            <b>cancela algebraicamente</b>: y<sup>k</sup> · (y<sup>k</sup>)⁻¹ ≡ 1 (mod
            ${pPriv ?? "p"}). Queda expuesto el mensaje original m, que se traduce de vuelta
            al carácter mediante su código ASCII.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "Interactivo: revela la cancelación algebraica paso a paso",
        formula: "",
        body: `
          <p class="step-detail">
            Elige uno de los pares (c₁, c₂) que se acaban de descifrar y revela cada paso
            de la cancelación con los números reales de esta sesión.
          </p>
          <div class="interactive-box">
            <div class="interactive-label">🔓 Simulador de descifrado</div>
            <div class="interactive-row">
              <label>Par (c₁, c₂) del mensaje
                <select id="reveal-select" onchange="prepararRevelado()"></select>
              </label>
            </div>
            <div class="interactive-row">
              <button class="btn-interactive" onclick="revelarPaso(1)">Paso 1: calcular s</button>
              <button class="btn-interactive" onclick="revelarPaso(2)">Paso 2: invertir s</button>
              <button class="btn-interactive" onclick="revelarPaso(3)">Paso 3: obtener m</button>
            </div>
            <div class="interactive-result">
              <span class="reveal-step" id="reveal-s">s = c₁ˣ mod p = —</span><br/>
              <span class="reveal-step" id="reveal-sinv">s⁻¹ = —</span><br/>
              <span class="reveal-step" id="reveal-m">m = c₂ · s⁻¹ mod p = — → carácter: —</span>
            </div>
          </div>
        `,
      },
      {
        num: 5,
        titulo: `Descifrado carácter a carácter (${pasos.length})`,
        formula: `p=${sesion.clave_privada?.p}, x=${sesion.clave_privada?.x}`,
        body: renderTablaElGamalDescifrado(pasos),
      },
    ];
    renderStepList(items);

    // Poblar el selector del simulador de revelado con los pares reales.
    setTimeout(() => poblarSelectorRevelado(pasos), 0);
  }
  else if (metodo === "aes") {
    const items = pasos.map((p, i) => ({
      num:     i + 1,
      titulo:  p.titulo,
      formula: "",
      body: `
        <p class="step-detail">${escapar(p.detalle)}</p>
        ${renderKV(p.valores || {})}
      `,
    }));
    renderStepList(items);
  }
}

// ─────────────────────────────────────────────
// TABLAS POR MÉTODO
// ─────────────────────────────────────────────

function renderTablaRSACifrado(pasos) {
  const filas = pasos.map(p =>
    `<tr>
      <td class="char-col">'${escapar(p.caracter)}'</td>
      <td>${p.m}</td>
      <td>${escapar(p.formula)}</td>
      <td>${p.resultado}</td>
    </tr>`
  ).join("");
  return `
    <table class="char-table">
      <thead><tr><th>Char</th><th>ASCII (m)</th><th>Operación</th><th>Cifrado (c)</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function renderTablaRSADescifrado(pasos) {
  const filas = pasos.map(p =>
    `<tr>
      <td>${p.cifrado}</td>
      <td>${escapar(p.formula)}</td>
      <td>${p.m}</td>
      <td class="char-col">'${escapar(p.caracter)}'</td>
    </tr>`
  ).join("");
  return `
    <table class="char-table">
      <thead><tr><th>Cifrado (c)</th><th>Operación</th><th>ASCII (m)</th><th>Char</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function renderTablaElGamalCifrado(pasos) {
  const filas = pasos.map(p =>
    `<tr>
      <td class="char-col">'${escapar(p.caracter)}'</td>
      <td>${p.m}</td>
      <td>${p.k}</td>
      <td>${p.c1}</td>
      <td>${p.yk}</td>
      <td>${p.c2}</td>
    </tr>`
  ).join("");
  return `
    <table class="char-table">
      <thead><tr><th>Char</th><th>m</th><th>k (efímero)</th><th>c₁=gᵏ</th><th>yᵏ (secreto)</th><th>c₂</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function renderTablaElGamalDescifrado(pasos) {
  const filas = pasos.map(p =>
    `<tr>
      <td>${p.c1}</td>
      <td>${p.c2}</td>
      <td>${p.s}</td>
      <td>${p.s_inv}</td>
      <td>${p.m}</td>
      <td class="char-col">'${escapar(p.caracter)}'</td>
    </tr>`
  ).join("");
  return `
    <table class="char-table">
      <thead><tr><th>c₁</th><th>c₂</th><th>s=c₁ˣ</th><th>s⁻¹</th><th>m</th><th>Char</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// ─────────────────────────────────────────────
// RENDER — lista de pasos genérica con accordion
// ─────────────────────────────────────────────
function renderStepList(items) {
  const container = document.getElementById("step-list");
  container.innerHTML = "";

  items.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "step-item";
    el.innerHTML = `
      <div class="step-head" onclick="toggleStep(this)">
        <div class="step-num">${item.num}</div>
        <div class="step-title-group">
          <div class="step-title">${item.titulo}</div>
          ${item.formula ? `<span class="step-formula">${escapar(item.formula)}</span>` : ""}
        </div>
        <svg class="step-chevron" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="step-body">${item.body}</div>
    `;
    container.appendChild(el);

    // Animar entrada escalonada
    setTimeout(() => {
      el.classList.add("show");
      // Abrir el primero automáticamente
      if (idx === 0) {
        el.classList.add("open");
      }
    }, idx * 60);
  });
}

function toggleStep(head) {
  head.parentElement.classList.toggle("open");
}

// ─────────────────────────────────────────────
// SIMULADORES INTERACTIVOS (matemática en el cliente)
// Reimplementan, en JS, las mismas rutinas de elgamal.py
// (aritmética modular pequeña, segura como Number en JS).
// ─────────────────────────────────────────────

function potenciaModularJS(base, exp, mod) {
  let resultado = 1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) resultado = (resultado * b) % mod;
    e = Math.floor(e / 2);
    b = (b * b) % mod;
  }
  return resultado;
}

function inversoModularJS(a, p) {
  // Válido porque p es primo (Pequeño Teorema de Fermat), igual que en el backend.
  return potenciaModularJS(a, p - 2, p);
}

// Traza bit a bit del algoritmo de cuadrado y multiplicación,
// para mostrar visualmente cómo se calcula base^exp mod mod.
function expModTraceJS(base, exp, mod) {
  const filas = [];
  let resultado = 1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  let i = 1;
  while (e > 0) {
    const bit = e % 2;
    const antes = resultado;
    if (bit === 1) resultado = (resultado * b) % mod;
    filas.push({ iter: i, bit, base_actual: b, antes, despues: resultado });
    b = (b * b) % mod;
    e = Math.floor(e / 2);
    i++;
  }
  return { resultado, filas };
}

// ── Widget 1 (pestaña Claves): calculadora de exponenciación modular ──
function ejecutarExpModDemo() {
  const base = parseInt(document.getElementById("expdemo-base").value, 10);
  const exp  = parseInt(document.getElementById("expdemo-exp").value, 10);
  const mod  = parseInt(document.getElementById("expdemo-mod").value, 10);
  const out  = document.getElementById("expdemo-resultado");

  if (!Number.isFinite(base) || !Number.isFinite(exp) || !Number.isFinite(mod) || mod <= 0 || exp < 0) {
    out.innerHTML = `<p class="interactive-note">Ingresa valores válidos (módulo &gt; 0, exponente ≥ 0).</p>`;
    return;
  }

  const { resultado, filas } = expModTraceJS(base, exp, mod);
  const filasHtml = filas.map(f => `
    <tr>
      <td>${f.iter}</td>
      <td>${f.bit}</td>
      <td>${f.base_actual}</td>
      <td>${f.antes} ${f.bit === 1 ? `× ${f.base_actual} mod ${mod}` : "(sin cambio)"} = <b>${f.despues}</b></td>
    </tr>
  `).join("");

  out.innerHTML = `
    <table class="char-table">
      <thead><tr><th>Iter.</th><th>Bit</th><th>base²ⁱ mod m</th><th>Resultado acumulado</th></tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <p class="interactive-note">
      ${base}^${exp} mod ${mod} = <b style="color:var(--purple)">${resultado}</b>
      &nbsp;— calculado en ${filas.length} iteración${filas.length !== 1 ? "es" : ""} en vez de ${exp} multiplicaciones directas.
    </p>
  `;
}

// ── Widget 2 (pestaña Cifrado): re-cifrar el mismo carácter con distinto k ──
function simularCifradoK() {
  const charInput = document.getElementById("simk-char");
  const caracter  = (charInput.value || "A").slice(0, 1);
  const m = caracter.charCodeAt(0);

  const { p, g, y } = sesion.clave_publica || {};
  const nota = document.getElementById("simk-nota");

  if (!p || !g || !y) {
    nota.textContent = "Genera las claves primero.";
    return;
  }
  if (m >= p) {
    nota.textContent = `El carácter '${caracter}' (ASCII ${m}) supera p=${p}. Elige otro carácter.`;
    return;
  }
  nota.textContent = "";

  const k  = Math.floor(Math.random() * (p - 3)) + 2; // k ∈ [2, p-2]
  const c1 = potenciaModularJS(g, k, p);
  const yk = potenciaModularJS(y, k, p);
  const c2 = (m * yk) % p;

  const tabla = document.getElementById("simk-tabla");
  const tbody = document.getElementById("simk-tabla-body");
  tabla.style.display = "table";

  const fila = document.createElement("tr");
  fila.innerHTML = `<td>${k}</td><td>${c1}</td><td>${yk}</td><td>${c2}</td>`;
  tbody.appendChild(fila);

  nota.innerHTML = `Carácter <b>'${escapar(caracter)}'</b> (m=${m}) cifrado con k=${k} nuevo.
    Vuelve a cifrar el mismo carácter y compara: el par (c₁, c₂) cambiará cada vez.`;
}

function limpiarSimuladorCifrado() {
  const tbody = document.getElementById("simk-tabla-body");
  const tabla = document.getElementById("simk-tabla");
  const nota  = document.getElementById("simk-nota");
  if (tbody) tbody.innerHTML = "";
  if (tabla) tabla.style.display = "none";
  if (nota)  nota.textContent = "";
}

// ── Widget 3 (pestaña Descifrado): revelar la cancelación paso a paso ──
let revelado = { c1: null, c2: null, s: null, s_inv: null, m: null };

function poblarSelectorRevelado(pasos) {
  const select = document.getElementById("reveal-select");
  if (!select || !pasos || pasos.length === 0) return;

  select.innerHTML = pasos.map((p, i) =>
    `<option value="${i}">#${i + 1} — (c₁=${p.c1}, c₂=${p.c2}) → '${escapar(p.caracter)}'</option>`
  ).join("");

  prepararRevelado();
}

function prepararRevelado() {
  const select = document.getElementById("reveal-select");
  if (!select || !sesion.pasos_descifrado) return;

  const idx = parseInt(select.value, 10) || 0;
  const paso = sesion.pasos_descifrado[idx];
  if (!paso) return;

  revelado = { c1: paso.c1, c2: paso.c2, s: null, s_inv: null, m: null, caracter: paso.caracter };

  // Reiniciar visualización
  ["reveal-s", "reveal-sinv", "reveal-m"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("revealed");
  });
  const elS = document.getElementById("reveal-s");
  const elSinv = document.getElementById("reveal-sinv");
  const elM = document.getElementById("reveal-m");
  if (elS)    elS.innerHTML    = `s = c₁ˣ mod p = —`;
  if (elSinv) elSinv.innerHTML = `s⁻¹ = —`;
  if (elM)    elM.innerHTML    = `m = c₂ · s⁻¹ mod p = — → carácter: —`;
}

function revelarPaso(numero) {
  const { p, x } = sesion.clave_privada || {};
  if (!p || !x || revelado.c1 === null) return;

  const elS    = document.getElementById("reveal-s");
  const elSinv = document.getElementById("reveal-sinv");
  const elM    = document.getElementById("reveal-m");

  if (numero === 1) {
    revelado.s = potenciaModularJS(revelado.c1, x, p);
    elS.innerHTML = `s = c₁ˣ mod p = ${revelado.c1}^${x} mod ${p} = <b>${revelado.s}</b>`;
    elS.classList.add("revealed");
  } else if (numero === 2) {
    if (revelado.s === null) { revelarPaso(1); }
    revelado.s_inv = inversoModularJS(revelado.s, p);
    elSinv.innerHTML = `s⁻¹ = ${revelado.s}^${p - 2} mod ${p} = <b>${revelado.s_inv}</b>`;
    elSinv.classList.add("revealed");
  } else if (numero === 3) {
    if (revelado.s_inv === null) { revelarPaso(2); }
    revelado.m = (revelado.c2 * revelado.s_inv) % p;
    const caracter = String.fromCharCode(revelado.m);
    elM.innerHTML = `m = c₂ · s⁻¹ mod p = ${revelado.c2} × ${revelado.s_inv} mod ${p} = <b>${revelado.m}</b> → carácter: <b>'${escapar(caracter)}'</b>`;
    elM.classList.add("revealed");
  }
}

// ─────────────────────────────────────────────
// HELPERS de UI
// ─────────────────────────────────────────────
function renderKV(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "";
  const chips = entries.map(([k, v]) =>
    `<span class="kv"><span>${k}:</span>${escapar(String(v))}</span>`
  ).join("");
  return `<div class="step-values">${chips}</div>`;
}

function escapar(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function limpiarPasos() {
  document.getElementById("step-list").innerHTML = "";
  mostrarPlaceholder();
}

function mostrarPlaceholder(msg) {
  const el = document.getElementById("steps-placeholder");
  document.getElementById("step-list").innerHTML = ""; // evita que quede contenido de otra pestaña
  if (msg) el.querySelector("p").innerHTML = msg;
  else el.querySelector("p").innerHTML = "Los pasos aparecerán aquí<br/>después de generar las claves o cifrar.";
  el.style.display = "flex";
}

function ocultarPlaceholder() {
  document.getElementById("steps-placeholder").style.display = "none";
}

function mostrarError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.classList.add("visible");
}

function mostrarEstadoClaves(msg, tipo) {
  const el = document.getElementById("estado-claves");
  if (!el) return;
  el.textContent = msg;
  el.className = "badge badge-" + tipo;
}

function actualizarInfoClaves() {
  const labelEl = document.getElementById("label-clave-publica");
  const infoEl  = document.getElementById("info-clave-publica");
  if (!infoEl || !sesion.clave_publica) return;

  switch (sesion.metodo) {
    case "rsa": {
      const { e, n } = sesion.clave_publica;
      labelEl.textContent = "Clave pública (e, n)";
      infoEl.textContent  = `e = ${e},  n = ${n}`;
      break;
    }
    case "aes": {
      const preview = sesion.clave_publica.key.slice(0, 20) + "…";
      labelEl.textContent = "Clave simétrica (256 bits, hex)";
      infoEl.textContent  = preview;
      break;
    }
    case "elgamal": {
      const { p, g, y } = sesion.clave_publica;
      labelEl.textContent = "Clave pública (p, g, y)";
      infoEl.textContent  = `p=${p}, g=${g}, y=${y}`;
      break;
    }
    default:
      infoEl.textContent = JSON.stringify(sesion.clave_publica);
  }
}