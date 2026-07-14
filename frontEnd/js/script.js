const API_BASE = "/api";

// Estado de la sesión
const sesion = {
  metodo:        "elgamal",
  clave_publica: null,
  clave_privada: null,
  parametros:    null,
  pasos_claves:  null,   // pasos generación de claves
  ultimo_cifrado: null,
  pasos_cifrado:  null,  // pasos de encriptación
  pasos_descifrado: null,
  texto_plano:      null, // texto que el usuario cifró por última vez
  texto_descifrado: null, // texto recuperado en el último descifrado
  relojPuntosCifrado: [], // puntos (m, c1, yk, c2) acumulados para el reloj real
};

// Tab activa
let tabActiva = "claves";

// INICIALIZACIÓN
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
    sesion.relojPuntosCifrado = [];
    relojCifradoModo   = "paso";
    relojCifradoIndice = -1;

    document.getElementById("resultado").classList.remove("visible");
    document.getElementById("resultado-descifrado-container").classList.remove("visible");
    document.getElementById("error").classList.remove("visible");

    cargarClaves();
    
  });

  // Enter en el input de password
  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") encriptar();
  });

  // ===== MENÚ HAMBURGUESA =====
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.querySelector('.section-switcher');

  if (menuToggle && navMenu) {
    console.log('Botón y menú encontrados');

    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      navMenu.classList.toggle('open');
      console.log('Clases del menú:', navMenu.classList);
    });

    // Cerrar al hacer clic en un botón
    navMenu.querySelectorAll('.switch-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navMenu.classList.remove('open');
      });
    });
  } else {
    console.warn('No se encontró el botón o el menú');
  }

});

function mostrarSeccion(seccion) {
  ["intro", "app"].forEach(s => {
    document.getElementById(`seccion-${s}`).classList.toggle("active", s === seccion);
    document.getElementById(`switch-${s}`).classList.toggle("active", s === seccion);
  });
}

function mostrarModoIntro(modo) {
  ["simetrico", "asimetrico"].forEach(m => {
    document.getElementById(`toggle-${m}`).classList.toggle("active", m === modo);
    document.getElementById(`escena-${m}`).style.display = m === modo ? "flex" : "none";
    document.getElementById(`intro-explicacion-${m}`).style.display = m === modo ? "block" : "none";
  });
}

// CLAVES
async function cargarClaves() {
  const btn = document.getElementById("btn-generar-claves");
  if (btn) { btn.disabled = true; btn.textContent = "Generando…"; }

  mostrarEstadoClaves("Generando…", "loading");
  limpiarPasos();

  // Las claves anteriores dejan de servir, se invalida cualquier cifrado/descifrado previo.
  sesion.ultimo_cifrado    = null;
  sesion.pasos_cifrado     = null;
  sesion.pasos_descifrado  = null;
  sesion.texto_plano       = null;
  sesion.texto_descifrado  = null;
  sesion.relojPuntosCifrado = [];
  relojCifradoModo   = "paso";
  relojCifradoIndice = -1;
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

    mostrarEstadoClaves("Claves listas", "ok");
    actualizarInfoClaves();

    // Mostrar pasos de generación de claves automáticamente
    cambiarTab("claves");

  } catch (error) {
    mostrarEstadoClaves("Error", "error");
    console.error(error);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Generar nuevas claves"; }
  }
}

// ENCRIPTAR
async function encriptar() {
  const password     = document.getElementById("password").value.trim();
  const resultadoDiv = document.getElementById("resultado");
  const errorDiv     = document.getElementById("error");
  const btn          = document.getElementById("btn-encriptar");

  resultadoDiv.classList.remove("visible");
  document.getElementById("resultado-descifrado-container").classList.remove("visible");
  errorDiv.classList.remove("visible");

  if (!password) { mostrarError("Por favor ingresa un texto/contraseña."); return; }
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
 
// DESENCRIPTAR
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
 
// TABS
function cambiarTab(tab) {
  tabActiva = tab;

  // Actualizar clases de tabs
  ["claves", "cifrado", "descifrado", "teoria"].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle("active", t === tab);
  });

  // Mostrar los pasos correspondientes
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


// RENDERIZADO DE TEORIA
// Variables con el ID del video para tener forma mas facil de actualizar si acaso
const YOUTUBE_RSA_ID = "CMe0COxZxb0";
const YOUTUBE_AES_ID = "tzj1RoqRnv0";
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
            Elgamal en 1985. A diferencia de RSA, que basa su seguridad en la dificultad de
            <b>factorizar</b> un número grande, ElGamal basa toda su seguridad en la dificultad
            de resolver el <span class="hl">Problema del Logaritmo Discreto (PLD)</span> dentro
            de un <b>grupo cíclico finito</b>.
          </p>
          <p class="step-detail">
            Esto conecta la <b>teoría de grupos</b>
            vista durante el curso con una aplicación real de seguridad informática, ya que cada operación
            de cifrado y descifrado es una manipulación algebraica de elementos
            de un grupo.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "El grupo multiplicativo ℤ*ₚ",
        formula: "ℤ<sub>p</sub><sup>*</sup> = {1, 2, ..., p−1}",
        body: `
          <p class="step-detail">
            Se parte de un número <b>primo p</b>. Con él se forma el conjunto de todos los
            enteros entre 1 y p−1, dotado de la operación <b>multiplicación módulo p</b>.
            Ese conjunto con esa operación es el grupo <span class="hl">ℤ<sub>p</sub><sup>*</sup></span>,
            donde ocurre todo ElGamal.
          </p>
          <p class="step-detail">
            Como p es primo, ningún elemento de 1 a p−1 comparte factores con p, así que todos
            son invertibles. Por esta razón se descarta el 0, no tiene
            inverso multiplicativo y rompería la estructura de grupo.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Verificación de los 4 axiomas de grupo",
        formula: "(G, ·) es grupo ⟺ cierre, asociatividad, neutro e inversos",
        body: `
          <p class="step-detail">
            Para que ℤ<sub>p</sub><sup>*</sup> sea formalmente un <b>grupo</b> deben cumplirse
            cuatro propiedades:
          </p>
          <p class="step-detail">
            <span class="hl-green">1. Cierre:</span> a·b mod p siempre pertenece a {1,...,p−1}.
            <br/><span class="hl-green">2. Asociatividad:</span> (a·b)·c ≡ a·(b·c) (mod p).
            <br/><span class="hl-green">3. Elemento neutro:</span> existe 1 tal que a·1 ≡ a (mod p).
            <br/><span class="hl-green">4. Inversos:</span> todo a tiene un único a⁻¹ tal que
            a·a⁻¹ ≡ 1 (mod p) que se garantiza por el <b>Pequeño Teorema de Fermat</b>
            , a<sup>p−2</sup> ≡ a⁻¹ mod p (porque p es primo).
          </p>
          <p class="step-detail">
            Al cumplirse las cuatro, ℤ<sub>p</sub><sup>*</sup> es un <b>grupo abeliano finito</b>.
            Esta es la estructura que ElGamal necesita para que cifrar y descifrar sean
            operaciones inversas bien definidas.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "Grupos cíclicos, generadores y el Teorema de Lagrange",
        formula: "⟨g⟩ = ℤ<sub>p</sub><sup>*</sup>   ⟺   orden(g) = p − 1",
        body: `
          <p class="step-detail">
            ℤ<sub>p</sub><sup>*</sup> siempre es <b>cíclico</b> ya que existe al menos un elemento
            <b>g</b>, llamado <span class="hl">generador</span>, cuyas potencias
            g¹, g², g³, ... recorren <b>todo</b> el grupo antes de repetirse. El orden del grupo
            es |ℤ<sub>p</sub><sup>*</sup>| = p−1.
          </p>
          <p class="step-detail">
            Encontrar g de forma eficiente usa el <b>Teorema de Lagrange</b>, en un grupo finito
            el orden de cualquier elemento debe dividir al orden del grupo. Por lo tanto, factorizamos
            φ = p−1 en sus primos q y verificar que g<sup>φ/q</sup> ≠ 1 (mod p) para
            cada uno. Si ninguno llega a colapsar a 1, g genera todo el grupo.
          </p>
        `,
      },
      {
        num: 5,
        titulo: "El Problema del Logaritmo Discreto (PLD)",
        formula: "Es fácil realizar y = gˣ mod p , pero es difícil: recuperar x desde (g, p, y)",
        body: `
          <p class="step-detail">
            Toda la seguridad de ElGamal se reduce a la asimetría de calcular y = g<sup>x</sup>
            mod p , esto es <b>rápido</b> (exponenciación modular con complejidad O(log x)), pero el proceso inverso
            de encontrar x conociendo solo y, p y g, <b>no tiene un algoritmo eficiente conocido</b>
            para p suficientemente grande.
          </p>
          <p class="step-detail">
            Esta dificultad computacional es lo que protege
            la clave privada x, incluso si toda la clave pública (p, g, y) es de dominio público.
          </p>
        `,
      },
      {
        num: 6,
        titulo: "¿Por qué ElGamal es un cifrado probabilístico?",
        formula: "k efímero y aleatorio hace que un mismo mensaje tenga cifrados distintos",
        body: `
          <p class="step-detail">
            A diferencia de RSA (que es determinista), ElGamal introduce un exponente <b>k</b> aleatorio
            y efímero en <b>cada</b> operación de cifrado. Esto hace que cifrar el mismo mensaje
            dos veces con la misma clave pública produzca resultados completamente distintos.
          </p>
          <p class="step-detail">
            Esta propiedad se llama <span class="hl">seguridad semántica</span>, un atacante que
            observa el cifrado no puede saber si dos criptogramas corresponden al mismo mensaje
            original, siendo una ventaja de seguridad importante frente a esquemas
            deterministas.
          </p>
        `,
      },
      {
        num: 7,
        titulo: "(Extra) Video recomendado",
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
            "Píldora formativa: ¿Cómo funciona el algoritmo de ElGamal?" 
          </p>
        `,
      },
    ];
  } else if (metodo === "rsa") {
    items = [
      {
        num: 1,
        titulo: "¿Qué es RSA y por qué usa teoría de números?",
        formula: "",
        body: `
          <p class="step-detail">
            <b>RSA</b> es un criptosistema de <b>clave pública</b> propuesto por Ronald Linn
            Rivest, Adi Shamir y Leonard Adleman en 1977. A diferencia de ElGamal, que basa su
            seguridad en el logaritmo discreto dentro de un grupo cíclico, RSA basa toda su
            seguridad en la dificultad de <span class="hl">factorizar un número entero grande
            en sus dos factores primos</span>.
          </p>
          <p class="step-detail">
            Esto lo convierte en el ejemplo perfecto para conectar la <b>teoría de números</b>
            vista en el curso con una aplicación real de seguridad informática: además de
            cifrar mensajes, RSA se usa ampliamente para hacer <b>firmas digitales</b>.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "El módulo n y el grupo (ℤ/nℤ)*",
        formula: "n = p × q   →   φ(n) = (p−1)(q−1)",
        body: `
          <p class="step-detail">
            Se parte de dos números <b>primos grandes p y q</b>, distintos entre sí, cuyo
            producto define el <b>módulo n = p·q</b>. A diferencia de ElGamal, aquí n <b>no es
            primo</b>, así que el conjunto de elementos invertibles módulo n no es {1,...,n−1}
            completo, sino el grupo <span class="hl">(ℤ/nℤ)*</span> formado solo por los
            elementos coprimos con n.
          </p>
          <p class="step-detail">
            El tamaño de ese grupo es <b>φ(n) = (p−1)(q−1)</b>, la función φ de Euler. La
            seguridad de RSA descansa en la <b>asimetría computacional</b> de la factorización:
            multiplicar p y q es directo, pero recuperarlos solo a partir de n es
            computacionalmente inviable para n suficientemente grande.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Elección de e y relación con la clave privada d",
        formula: "e · d ≡ 1 (mod φ(n))",
        body: `
          <p class="step-detail">
            Se elige un exponente público <b>e</b> tal que 1 &lt; e &lt; φ(n) y
            <b>mcd(e, φ(n)) = 1</b> (coprimos entre sí), lo que garantiza que e sea invertible
            módulo φ(n). La clave pública es el par <b>(e, n)</b>.
          </p>
          <p class="step-detail">
            La clave privada <b>d</b> es, precisamente, el <b>inverso modular</b> de e:
            <span class="hl">e · d ≡ 1 (mod φ(n))</span>. Cifrar y descifrar son entonces
            exponenciaciones modulares inversas: c = m<sup>e</sup> mod n para cifrar,
            m = c<sup>d</sup> mod n para descifrar.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "Algoritmo Extendido de Euclides y el Teorema de Euler",
        formula: "d ≡ e⁻¹ (mod φ(n))",
        body: `
          <p class="step-detail">
            A diferencia de ElGamal (que invierte vía el <b>Pequeño Teorema de Fermat</b>,
            porque trabaja módulo un <b>primo</b>), RSA trabaja módulo n = p·q, que <b>no es
            primo</b>. Por eso necesita el <b>Algoritmo Extendido de Euclides</b> para calcular
            el inverso modular de e y obtener d.
          </p>
          <p class="step-detail">
            La corrección del descifrado se apoya en el <b>Teorema de Euler</b>: para todo m
            coprimo con n, se cumple m<sup>φ(n)</sup> ≡ 1 (mod n). De ahí se deduce que
            (m<sup>e</sup>)<sup>d</sup> = m<sup>ed</sup> ≡ m (mod n), lo cual es la generalización compuesta del
            razonamiento que en ElGamal se hace con Fermat sobre un módulo primo.
          </p>
        `,
      },
      {
        num: 5,
        titulo: "El Problema de la Factorización",
        formula: "Fácil: n = p × q    |    Difícil: recuperar p, q solo desde n",
        body: `
          <p class="step-detail">
            Toda la seguridad de RSA se reduce a esta asimetría: calcular n = p·q es
            <b>rápido</b>, pero el proceso inverso de encontrar p y q conociendo solo n, <b>no
            tiene un algoritmo eficiente conocido</b> para n suficientemente grande (miles de
            bits).
          </p>
          <p class="step-detail">
            Esta dificultad computacional (y no un secreto de implementación) es lo que protege
            la clave privada d, incluso si toda la clave pública (e, n) es de dominio público.
            Si un atacante lograra factorizar n, podría reconstruir φ(n) y de ahí calcular d.
          </p>
        `,
      },
      {
        num: 6,
        titulo: "¿Por qué RSA (en su forma básica) es determinista?",
        formula: "mismo mensaje + misma clave pública → mismo cifrado",
        body: `
          <p class="step-detail">
            A diferencia de ElGamal (probabilístico, con un exponente k aleatorio en cada
            cifrado), el <b>RSA de libro de texto</b> es <b>determinista</b>: cifrar el mismo
            mensaje m dos veces con la misma clave pública (e, n) produce siempre el mismo
            criptograma c = m<sup>e</sup> mod n.
          </p>
          <p class="step-detail">
            Esto es una <b>debilidad</b> frente a la seguridad semántica de ElGamal: un
            atacante puede detectar mensajes repetidos. Por eso, en la práctica, RSA <b>nunca</b>
            se usa así; se combina con esquemas de <span class="hl">relleno aleatorio</span>
            como OAEP, que añaden aleatoriedad antes de cifrar para lograr seguridad semántica.
          </p>
        `,
      },
      {
        num: 7,
        titulo: "(Extra) Video recomendado",
        formula: "",
        body: `
          <p class="step-detail">
            Para reforzar visualmente estos conceptos, recomendamos el siguiente video:
          </p>
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/${YOUTUBE_RSA_ID}" 
            title="YouTube video player" frameborder="0" allowfullscreen 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>
          <p class="video-caption">
            "Píldora formativa: ¿Cómo funciona el algoritmo RSA?"
          </p>
        `,
      },
    ];
  } else if (metodo === "aes") {
    items = [
      {
        num: 1,
        titulo: "¿Qué es AES y qué estructura algebraica usa?",
        formula: "",
        body: `
          <p class="step-detail">
            <b>AES</b> (Advanced Encryption Standard) es un algoritmo de cifrado
            <b>simétrico</b>, estandarizado por el NIST en 2001 a partir de la propuesta
            Rijndael de Joan Daemen y Vincent Rijmen. A diferencia de RSA y ElGamal, que son
            de <b>clave pública</b> y basan su seguridad en un problema matemático difícil,
            AES usa la <b>misma clave secreta</b> para cifrar y descifrar, y su seguridad
            depende del tamaño de esa clave y de cuánto mezcla la información.
          </p>
          <p class="step-detail">
            Esto lo convierte en el ejemplo perfecto para ver que las <b>matemáticas
            discretas</b> no se limitan a ℤ<sub>p</sub><sup>*</sup>: AES trabaja sobre el
            conjunto de <span class="hl">bytes GF(2⁸)</span>, donde los mismos conceptos de
            grupo e inverso vuelven a aparecer, solo que con otra operación.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "El conjunto de bytes GF(2⁸)",
        formula: "GF(2⁸) = {0, 1, ..., 255}   con suma = XOR",
        body: `
          <p class="step-detail">
            Se parte de un <b>byte</b> (8 bits), que puede tomar 256 valores distintos: de 0 a
            255. Dotado de una suma y una multiplicación adecuadas (que se explican en los
            siguientes items), este conjunto se denota <span class="hl">GF(2⁸)</span> y es el
            escenario donde ocurren todas las operaciones internas de AES.
          </p>
          <p class="step-detail">
            A diferencia de ℤ<sub>p</sub><sup>*</sup>, donde el módulo es un <b>número primo</b>,
            aquí el "módulo" es un polinomio especial. Esa diferencia es la razón matemática por
            la que en AES la suma no es la suma normal de enteros, sino un <b>XOR bit a bit</b>.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Verificación de los 4 axiomas de grupo (con XOR)",
        formula: "(GF(2⁸), ⊕) es grupo ⟺ cierre + asociatividad + neutro + inversos",
        body: `
          <p class="step-detail">
            Para que GF(2⁸) con la operación XOR sea formalmente un <b>grupo</b> deben
            cumplirse cuatro propiedades:
          </p>
          <p class="step-detail">
            <span class="hl-green">1. Cierre:</span> a⊕b siempre es otro byte de 8 bits.
            <br/><span class="hl-green">2. Asociatividad:</span> (a⊕b)⊕c = a⊕(b⊕c).
            <br/><span class="hl-green">3. Elemento neutro:</span> existe 0 tal que a⊕0 = a.
            <br/><span class="hl-green">4. Inversos:</span> todo a tiene un único inverso, y
            resulta ser <b>él mismo</b>: a⊕a = 0.
          </p>
          <p class="step-detail">
            Al cumplirse las cuatro, (GF(2⁸), ⊕) es un <b>grupo abeliano finito</b>: es lo que
            permite que la operación <b>AddRoundKey</b> de AES (un XOR entre datos y clave) se
            deshaga aplicando exactamente la misma operación una segunda vez.
          </p>
        `,
      },
      {
        num: 4,
        titulo: "El grupo multiplicativo GF(2⁸)* y la S-box",
        formula: "GF(2⁸)* = {1, 2, ..., 255}   ⟺   grupo cíclico de orden 255",
        body: `
          <p class="step-detail">
            Igual que en ElGamal, al quitar el 0 de GF(2⁸) se obtiene un grupo multiplicativo
            <span class="hl">GF(2⁸)*</span>, cíclico, de orden 255. Todo byte distinto de cero
            tiene un único <b>inverso multiplicativo</b>, calculado con una versión del
            <b>Algoritmo Extendido de Euclides</b> adaptada a esta estructura.
          </p>
          <p class="step-detail">
            Esta operación de "tomar el inverso" es la base de <b>SubBytes</b>, el paso de AES
            que sustituye cada byte por otro mediante una tabla fija llamada <b>S-box</b>. Es
            el mismo tipo de cálculo que usa RSA para obtener d a partir de e, solo que aquí se
            aplica a los propios datos que se están cifrando, no a la clave.
          </p>
        `,
      },
      {
        num: 5,
        titulo: "¿Por qué AES-256 es difícil de romper por fuerza bruta?",
        formula: "Fácil: cifrar con la clave    |    Difícil: probar las 2²⁵⁶ claves posibles",
        body: `
          <p class="step-detail">
            A diferencia de RSA y ElGamal, la seguridad de AES no depende de resolver un
            problema matemático elegante, sino de que la clave de <b>256 bits</b> tiene
            <b>2²⁵⁶ valores posibles</b>: una cifra tan enorme que ni con toda la capacidad de
            cómputo mundial actual sería viable probarlas todas.
          </p>
          <p class="step-detail">
            A esto se suma que cada una de las <b>14 rondas</b> de AES-256 combina SubBytes,
            ShiftRows, MixColumns y AddRoundKey, de forma que cambiar un solo bit de entrada
            cambia, en promedio, la mitad de los bits de salida (<b>efecto avalancha</b>), lo
            que impide encontrar atajos matemáticos frente a la fuerza bruta.
          </p>
        `,
      },
      {
        num: 6,
        titulo: "¿Por qué AES-256-CBC necesita un IV?",
        formula: "Cᵢ = E_k(Pᵢ ⊕ Cᵢ₋₁)      C₀ = IV",
        body: `
          <p class="step-detail">
            A diferencia de ElGamal (probabilístico por naturaleza), AES por sí solo es
            <b>determinista</b>. Por eso el modo <b>CBC</b> introduce un
            <span class="hl">Vector de Inicialización (IV)</span> aleatorio, que se combina con
            el primer bloque antes de cifrar, y cada bloque siguiente se combina con el
            criptograma del bloque anterior.
          </p>
          <p class="step-detail">
            Esto hace que cifrar el mismo mensaje dos veces con la misma clave, pero distinto
            IV, produzca resultados completamente distintos, la misma seguridad semántica que
            ElGamal logra con su exponente k aleatorio, pero resuelta aquí encadenando bloques
            en vez de aleatorizando cada cifrado desde cero.
          </p>
        `,
      },
      {
        num: 7,
        titulo: "(Extra) Video recomendado",
        formula: "",
        body: `
          <p class="step-detail">
            Para reforzar visualmente estos conceptos, recomendamos el siguiente video:
          </p>
          <div class="video-embed">
            <iframe src="https://www.youtube.com/embed/${YOUTUBE_AES_ID}"
              title="YouTube video player" frameborder="0" allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>
          <p class="video-caption">
            "Píldora formativa: ¿Cómo se cifra con el algoritmo AES?"
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
      <p class="step-detail">${formatMath(p.detalle)}</p>
      ${renderKV(p.valores || {})}
    `,
  }));

  // Reloj modular didáctico
  if (sesion.metodo === "elgamal") {
    const pasoGrupo = items.find(
      (it) => it.titulo && (it.titulo.includes("Grupo cíclico") || it.titulo.includes("generador"))
    );
    if (pasoGrupo) {
      pasoGrupo.body += `
        <div class="reloj-wrap">
          <div class="reloj-toggle-row">
            <button class="btn-interactive" id="reloj-didactico-toggle" onclick="toggleRelojDidactico()">
              Ver en el reloj modular ↗
            </button>
          </div>
          <div class="reloj-svg-container" id="reloj-didactico-container">
            <div id="reloj-didactico-svg"></div>
            <div class="reloj-toggle-row" style="justify-content:flex-start; margin-top:.6rem;">
              <button class="btn-interactive" id="reloj-didactico-btn-play" onclick="animarOrbitaDidactica()">
                ▶ Recorrer la órbita de g
              </button>
              <button class="btn-interactive" onclick="toggleRelojDidactico(true)">
                Otro grupo (p distinto)
              </button>
            </div>
            <p class="reloj-caption" id="reloj-didactico-caption">
              Cada punto del reloj es un elemento de ℤ<sub>p</sub><sup>*</sup>. Pulsa "Recorrer la órbita" para
              ver cómo <b>g</b> visita cada posición, una a una, antes de volver a 1.
            </p>
          </div>
        </div>
      `;
    }
  }

  // Calculadora de exponenciación modular
  if (sesion.metodo === "elgamal" && sesion.parametros) {
    const { g, x, p: pMod } = sesion.parametros;
    items.push({
      num: items.length + 1,
      titulo: "Interactivo: prueba tú mismo la exponenciación modular rápida",
      formula: "",
      body: `
        <p class="step-detail">
          Este es el mismo algoritmo de <b>cuadrado y multiplicación</b> que el sistema usa
          internamente para calcular g<sup>x</sup> mod p. Cambia los valores para observar cómo el
          exponente se procesa <b>bit a bit</b> en lugar de multiplicar uno por uno.
        </p>
        <div class="interactive-box">
          <div class="interactive-label">Calculadora paso a paso</div>
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

// RENDERIZADO DE PASOS DE CIFRADO
function renderPasosCifrado(pasos, metodo) {
  if (!pasos || pasos.length === 0) {
    mostrarPlaceholder("Encripta un texto para ver los pasos de cifrado.");
    return;
  }
  ocultarPlaceholder();

  if (metodo === "rsa") {
    // RSA
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
        titulo: "El grupo cíclico donde ocurre el cifrado",
        formula: `p=${pPub}, g=${gPub}, y=${yPub}`,
        body: `
          ${resumenTexto}
          <p class="step-detail">
            El cifrado ocurre íntegramente dentro del grupo cíclico multiplicativo
            <b>ℤ<sub>p</sub><sup>*</sup></b> generado por <span class="hl">g=${gPub}</span> módulo
            <span class="hl">p=${pPub}</span>. Cada valor c₁, yᵏ, c₂ que se calcula es un
            elemento de ese mismo grupo, así que todas las operaciones (multiplicación,
            exponenciación, inversión) respetan sus propiedades algebraicas.
          </p>
          <p class="step-detail">
            Para <b>cada carácter</b> del mensaje se elige un exponente
            <span class="hl">k efímero y aleatorio</span>, uno distinto incluso si el
            carácter se repite. Esto es lo que hace de ElGamal un cifrado
            <b>probabilístico</b> ya que el mismo mensaje cifrado dos veces con la misma clave
            pública produce criptogramas completamente distintos.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "Calcular c₁, la huella pública",
        formula: "c₁ = gᵏ mod p",
        body: `
          <p class="step-detail">
            c₁ = g<sup>k</sup> mod p = <span class="hl">${gPub}</span><sup>k</sup> mod
            <span class="hl">${pPub}</span> es la <b>huella pública</b> del k secreto,
            expresada como un elemento del grupo generado por g. Cualquiera que vea c₁ no
            puede recuperar k sin resolver el Problema del Logaritmo Discreto.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Calcular el 'secreto compartido' yᵏ y enmascarar el mensaje",
        formula: "yᵏ mod p   →   c₂ = m · yᵏ mod p",
        body: `
          <p class="step-detail">
            y<sup>k</sup> mod p = <span class="hl">${yPub}</span><sup>k</sup> mod
            <span class="hl">${pPub}</span> es el <b>"secreto compartido"</b> efímero. Notamos
            esta igualdad importante: y<sup>k</sup> = (g<sup>x</sup>)<sup>k</sup> =
            (g<sup>k</sup>)<sup>x</sup> = c₁ˣ. Esta conmutatividad de exponentes es
            lo que permitirá al receptor reconstruir y<sup>k</sup> más adelante
            <b>sin conocer k</b>, usando su clave privada x sobre c₁.
          </p>
          <p class="step-detail">
            Finalmente, c₂ = m · y<sup>k</sup> mod p "enmascara" el mensaje multiplicándolo
            por ese secreto compartido dentro del grupo. El par <b>(c₁, c₂)</b> es el texto
            cifrado del carácter. La seguridad de todo esto depende de que, sin conocer x ni
            k, calcular y<sup>k</sup> a partir de y, p, g y c₁ es tan difícil como resolver
            el PLD.
          </p>
        `,
      },
      {
        num: 4,
        titulo: `Cifrado carácter a carácter (${pasos.length} carácter${pasos.length !== 1 ? "es" : ""})`,
        formula: `p=${sesion.clave_publica?.p}, g=${sesion.clave_publica?.g}, y=${sesion.clave_publica?.y}`,
        body: renderTablaElGamalCifrado(pasos),
      },
      {
        num: 5,
        titulo: "Interactivo: cifra el mismo carácter con distintos k",
        formula: "",
        body: `
          <p class="step-detail">
            Prueba cifrar el <b>mismo carácter varias veces</b>, cada clic genera un nuevo
            k aleatorio y verás cómo (c₁, c₂) cambia por completo aunque m sea idéntico
          </p>
          <div class="interactive-box">
            <div class="interactive-label">Simulador de re-cifrado</div>
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

            <div class="reloj-wrap">
              <div class="reloj-toggle-row">
                <button class="btn-interactive" id="reloj-cifrado-toggle" onclick="toggleRelojCifrado()">
                  Ver cifrado en el reloj ↗
                </button>
              </div>
              <div class="reloj-svg-container" id="reloj-cifrado-container">
                <p class="reloj-caption" style="margin-top:0;">
                  Grupo <b>ℤ<sub>${pPub}</sub><sup>*</sup></b>. El reloj representa este grupo cíclico completo
                  (p=${pPub} posiciones), aunque solo se marcan los puntos de los caracteres
                  que cifres.
                </p>
                <div id="reloj-cifrado-svg"></div>
                <div class="reloj-legend" id="reloj-cifrado-legend"></div>
                <div class="reloj-toggle-row" style="justify-content:space-between; margin-top:.7rem;">
                  <div>
                    <button class="btn-interactive" id="reloj-cifrado-btn-prev" onclick="navegarRelojCifrado(-1)">◀ Anterior</button>
                    <button class="btn-interactive" id="reloj-cifrado-btn-next" onclick="navegarRelojCifrado(1)">Siguiente ▶</button>
                  </div>
                  <button class="btn-interactive" id="reloj-cifrado-btn-modo" onclick="alternarModoRelojCifrado()">
                    Ver todos juntos
                  </button>
                </div>
                <p class="interactive-note" id="reloj-cifrado-contador"></p>
                <p class="reloj-caption">
                  <b>Paso a paso.</b> Muestra un carácter a la vez con sus 4 puntos: m (mensaje),
                  c₁ (huella de k), yᵏ (secreto compartido) y c₂ (con borde, el resultado). Y las
                  líneas punteadas que conectan m y yᵏ con c₂, mostrando la operación
                  <b>c₂ = m · yᵏ mod p</b> visualmente. <b>Ver todos juntos:</b> oculta ese detalle y solo marca
                  el c₂ final de cada carácter cifrado, para ver de un vistazo cómo se distribuye
                  todo el texto cifrado sobre el reloj.
                </p>
              </div>
            </div>
          </div>
        `,
      }
    ];
    renderStepList(items);
  }
  else if (metodo === "aes") {
    // AES
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

// RENDERIZADO DE PASOS DE DESCIFRADO
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
        titulo: "Reconstruir el 'secreto compartido' sin conocer k",
        formula: `s = c₁^${xPriv ?? "x"} mod ${pPriv ?? "p"}`,
        body: `
          ${resumenTexto}
          <p class="step-detail">
            Como c₁ = g<sup>k</sup>, se cumple c₁<sup>x</sup> = (g<sup>k</sup>)<sup>x</sup> =
            (g<sup>x</sup>)<sup>k</sup> = y<sup>k</sup>. El receptor llega al <b>mismo</b>
            valor y<sup>k</sup> que usó quien cifró, pero aplicando su exponente secreto
            <span class="hl">x=${xPriv}</span> sobre c₁ en vez de aplicar k sobre y. No se
            necesitó conocer k.
          </p>
        `,
      },
      {
        num: 2,
        titulo: "Invertir el secreto dentro del grupo ℤ*ₚ",
        formula: `s⁻¹ ≡ s^(${pPriv ? pPriv + "−2" : "p−2"}) mod ${pPriv ?? "p"}`,
        body: `
          <p class="step-detail">
            Todo elemento de ℤ<sub>p</sub><sup>*</sup> tiene un <b>único</b> inverso multiplicativo (uno de
            los 4 axiomas de grupo que se verificó antes). Se calcula por medio del
            <span class="hl">Pequeño Teorema de Fermat</span>: s⁻¹ = s<sup>p−2</sup> mod
            <span class="hl">${pPriv}</span>, reutilizando la misma rutina de exponenciación
            modular rápida.
          </p>
        `,
      },
      {
        num: 3,
        titulo: "Cancelar el 'enmascaramiento' y recuperar el mensaje",
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
        titulo: `Descifrado carácter a carácter (${pasos.length})`,
        formula: `p=${sesion.clave_privada?.p}, x=${sesion.clave_privada?.x}`,
        body: renderTablaElGamalDescifrado(pasos),
      },
      {
        num: 5,
        titulo: "Interactivo: revela la cancelación algebraica paso a paso",
        formula: "",
        body: `
          <p class="step-detail">
            Elige uno de los pares (c₁, c₂) que se acaban de descifrar y revela cada paso
            de la cancelación con los números reales de esta sesión.
          </p>
          <div class="interactive-box">
            <div class="interactive-label">Simulador de descifrado</div>
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
              <span class="reveal-step" id="reveal-s">s = c₁ˣ mod p = ...</span><br/>
              <span class="reveal-step" id="reveal-sinv">s⁻¹ = ...</span><br/>
              <span class="reveal-step" id="reveal-m">m = c₂ · s⁻¹ mod p = ... → carácter: ...</span>
            </div>
          </div>
        `,
      }
    ];
    renderStepList(items);

    // Poblar el selector con los pares reales.
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

// TABLAS POR MÉTODO
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
 
// RENDERIZADO DE LISTA DE PASOS
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
          ${item.formula ? `<span class="step-formula">${formatMath(item.formula)}</span>` : ""}
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
  const item = head.parentElement;
  const yaAbierto = item.classList.contains("open");
  item.parentElement.querySelectorAll(".step-item.open").forEach(el => el.classList.remove("open"));
  if (!yaAbierto) item.classList.add("open");
}

// SIMULADORES INTERACTIVOS
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
  return potenciaModularJS(a, p - 2, p);
}

// Muestra bit a bit del algoritmo de cuadrado y multiplicación
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

//  Calculadora de exponenciación modular 
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
      ${base}<sup>${exp}</sup> mod ${mod} = <b style="color:var(--purple)">${resultado}</b>
      &nbsp;, calculado en ${filas.length} iteración${filas.length !== 1 ? "es" : ""} en vez de ${exp} multiplicaciones directas.
    </p>
  `;
}

//  Volver a cifrar el mismo carácter con distinto k 
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

  const k  = Math.floor(Math.random() * (p - 3)) + 2; // k pertenece a [2, p-2]
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

  sesion.relojPuntosCifrado.push({ caracter, m, k, c1, yk, c2 });
  renderRelojCifrado();
}

function limpiarSimuladorCifrado() {
  const tbody = document.getElementById("simk-tabla-body");
  const tabla = document.getElementById("simk-tabla");
  const nota  = document.getElementById("simk-nota");
  if (tbody) tbody.innerHTML = "";
  if (tabla) tabla.style.display = "none";
  if (nota)  nota.textContent = "";

  sesion.relojPuntosCifrado = [];
  relojCifradoModo   = "paso";
  relojCifradoIndice = -1;
  renderRelojCifrado();
}

// RELOJ MODULAR PARA ELGAMAL
function esPrimoJS(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

function encontrarGeneradorJS(p) {
  const phi = p - 1;
  let temp = phi;
  const factores = new Set();
  let d = 2;
  while (d * d <= temp) {
    while (temp % d === 0) { factores.add(d); temp = Math.floor(temp / d); }
    d++;
  }
  if (temp > 1) factores.add(temp);

  for (let g = 2; g < p; g++) {
    let generador = true;
    for (const q of factores) {
      if (potenciaModularJS(g, Math.floor(phi / q), p) === 1) { generador = false; break; }
    }
    if (generador) return g;
  }
  return 2;
}

// Esto convierte una posición 1..moduloVisual en un ángulo en grados
function anguloParaJS(posicion, moduloVisual) {
  const fraccion = (((posicion % moduloVisual) + moduloVisual) % moduloVisual) / moduloVisual;
  return fraccion * 360 - 90;
}

function puntoEnCirculoJS(anguloGrados, cx, cy, radio) {
  const rad = (anguloGrados * Math.PI) / 180;
  return { x: cx + radio * Math.cos(rad), y: cy + radio * Math.sin(rad) };
}

//  Reloj didáctico en la pestaña de Claves
function construirRelojDidacticoJS() {
  const candidatos = [];
  for (let n = 11; n <= 30; n++) if (esPrimoJS(n)) candidatos.push(n);
  const p = candidatos[Math.floor(Math.random() * candidatos.length)];
  const phi = p - 1;
  const g = encontrarGeneradorJS(p);

  const orbita = [];
  let valor = 1;
  for (let paso = 1; paso <= phi; paso++) {
    valor = (valor * g) % p;
    orbita.push({ paso, valor });
  }
  return { p, phi, g, orbita };
}

function renderizarRelojDidactico(clock) {
  const size = 260, c = size / 2, r = size / 2 - 34;
  const { p, orbita } = clock;

// Todas las posiciones del grupo como marcas de fondo
  const marcas = [];
  for (let v = 1; v < p; v++) {
    const pt = puntoEnCirculoJS(anguloParaJS(v, p), c, c, r);
    marcas.push(`<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="var(--border)" />`);
  }

  const puntosOrbita = orbita.map((o) => {
    const pt = puntoEnCirculoJS(anguloParaJS(o.valor, p), c, c, r);
    return { ...o, x: pt.x, y: pt.y };
  });

  let segmentos = "";
  for (let i = 1; i < puntosOrbita.length; i++) {
    const prev = puntosOrbita[i - 1], cur = puntosOrbita[i];
    segmentos += `<line id="orb-seg-${i}" x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${cur.x.toFixed(1)}" y2="${cur.y.toFixed(1)}" stroke="var(--purple)" stroke-width="1.5" opacity="0" />`;
  }

  const puntosHtml = puntosOrbita.map((pt, i) => `
    <circle id="orb-pt-${i}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="5"
      fill="var(--surface)" stroke="var(--purple)" stroke-width="1.5" opacity="0" />
  `).join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="260" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--border)" stroke-width="1.5" />
      ${marcas.join("")}
      ${segmentos}
      ${puntosHtml}
    </svg>
  `;
}

let _relojDidacticoActual = null;

function toggleRelojDidactico(forzarNuevo) {
  const cont = document.getElementById("reloj-didactico-container");
  const btn  = document.getElementById("reloj-didactico-toggle");
  if (!cont) return;

  const yaAbierto = cont.classList.contains("visible");

  if (forzarNuevo === true) {
    _relojDidacticoActual = construirRelojDidacticoJS();
    document.getElementById("reloj-didactico-svg").innerHTML = renderizarRelojDidactico(_relojDidacticoActual);
    reiniciarCaptionDidactico();
    if (!yaAbierto) { cont.classList.add("visible"); if (btn) btn.textContent = "Ocultar reloj modular"; }
    return;
  }

  cont.classList.toggle("visible");
  const abierto = cont.classList.contains("visible");
  if (btn) btn.textContent = abierto ? "Ocultar reloj modular" : "Ver en el reloj modular ↗";

  if (abierto) {
    _relojDidacticoActual = construirRelojDidacticoJS();
    document.getElementById("reloj-didactico-svg").innerHTML = renderizarRelojDidactico(_relojDidacticoActual);
    reiniciarCaptionDidactico();
  }
}

function reiniciarCaptionDidactico() {
  const caption = document.getElementById("reloj-didactico-caption");
  const btnPlay = document.getElementById("reloj-didactico-btn-play");
  if (caption) {
    caption.innerHTML = `Cada punto del reloj es un elemento de ℤ<sub>${_relojDidacticoActual.p}</sub><sup>*</sup>.
      Pulsa "Recorrer la órbita" para ver cómo <b>g=${_relojDidacticoActual.g}</b> visita cada
      posición, una a una, antes de volver a 1.`;
  }
  if (btnPlay) { btnPlay.disabled = false; btnPlay.textContent = "▶ Recorrer la órbita de g"; }
}

function animarOrbitaDidactica() {
  const clock = _relojDidacticoActual;
  if (!clock) return;
  const btn = document.getElementById("reloj-didactico-btn-play");
  const caption = document.getElementById("reloj-didactico-caption");

  document.querySelectorAll('[id^="orb-pt-"]').forEach((el) => el.setAttribute("opacity", "0"));
  document.querySelectorAll('[id^="orb-seg-"]').forEach((el) => el.setAttribute("opacity", "0"));
  if (btn) btn.disabled = true;

  let i = 0;
  const total = clock.orbita.length;

  function paso() {
    if (i >= total) {
      if (btn) { btn.disabled = false; btn.textContent = "↺ Repetir recorrido"; }
      if (caption) {
        caption.innerHTML = `g=${clock.g} recorrió las <b>${clock.phi}</b> posiciones del reloj
          sin repetir ninguna antes de volver a 1, eso confirma que es un generador de ℤ<sub>${clock.p}</sub><sup>*</sup>.`;
      }
      return;
    }
    const pt = document.getElementById(`orb-pt-${i}`);
    if (pt) pt.setAttribute("opacity", "1");
    if (i > 0) {
      const seg = document.getElementById(`orb-seg-${i}`);
      if (seg) seg.setAttribute("opacity", ".85");
    }
    if (caption) {
      caption.innerHTML = `Paso ${i + 1}: g<sup>${i + 1}</sup> mod ${clock.p} =
        <b>${clock.orbita[i].valor}</b>`;
    }
    i++;
    setTimeout(paso, 420);
  }
  paso();
}

//  Cifrado en el reloj de la pestaña Cifrado
const PALETA_RELOJ_CIFRADO = ["var(--accent)", "var(--yellow)", "var(--green)", "var(--purple)", "var(--red)"];

let relojCifradoModo   = "paso"; // "paso" o "todos"
let relojCifradoIndice = -1;     // índice del carácter mostrado en modo "paso"

function _puntoCifradoSvg(p, c, r, pc, color, radioM = 5) {
  const ptM  = puntoEnCirculoJS(anguloParaJS(pc.m,  p), c, c, r);
  const ptC1 = puntoEnCirculoJS(anguloParaJS(pc.c1, p), c, c, r);
  const ptYk = puntoEnCirculoJS(anguloParaJS(pc.yk, p), c, c, r);
  const ptC2 = puntoEnCirculoJS(anguloParaJS(pc.c2, p), c, c, r);

  const lineas = `
    <line x1="${ptM.x.toFixed(1)}"  y1="${ptM.y.toFixed(1)}"  x2="${ptC2.x.toFixed(1)}" y2="${ptC2.y.toFixed(1)}" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 3" opacity=".7" />
    <line x1="${ptYk.x.toFixed(1)}" y1="${ptYk.y.toFixed(1)}" x2="${ptC2.x.toFixed(1)}" y2="${ptC2.y.toFixed(1)}" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 3" opacity=".7" />
  `;
  const puntos = `
    <circle cx="${ptC1.x.toFixed(1)}" cy="${ptC1.y.toFixed(1)}" r="3" fill="${color}" opacity=".55"><title>c₁=${pc.c1}</title></circle>
    <circle cx="${ptYk.x.toFixed(1)}" cy="${ptYk.y.toFixed(1)}" r="3.5" fill="${color}" opacity=".8"><title>yᵏ=${pc.yk}</title></circle>
    <circle cx="${ptC2.x.toFixed(1)}" cy="${ptC2.y.toFixed(1)}" r="5" fill="${color}" stroke="var(--text)" stroke-width="1"><title>c₂=${pc.c2}</title></circle>
    <circle cx="${ptM.x.toFixed(1)}"  cy="${ptM.y.toFixed(1)}"  r="${radioM}" fill="${color}"><title>'${escapar(pc.caracter)}' → m=${pc.m}</title></circle>
    <text x="${ptM.x.toFixed(1)}" y="${(ptM.y - 9).toFixed(1)}" font-size="10" fill="${color}" text-anchor="middle" font-weight="700">${escapar(pc.caracter)}</text>
  `;
  return lineas + puntos;
}

// Modo "todos": dibuja solo los c₂ finales, cada uno con el color de su carácter
function _puntoC2Svg(p, c, r, pc, color) {
  const ptC2 = puntoEnCirculoJS(anguloParaJS(pc.c2, p), c, c, r);
  return `
    <circle cx="${ptC2.x.toFixed(1)}" cy="${ptC2.y.toFixed(1)}" r="5.5" fill="${color}" stroke="var(--text)" stroke-width="1">
      <title>'${escapar(pc.caracter)}' → c₂=${pc.c2}</title>
    </circle>
    <text x="${ptC2.x.toFixed(1)}" y="${(ptC2.y - 9).toFixed(1)}" font-size="10" fill="${color}" text-anchor="middle" font-weight="700">${escapar(pc.caracter)}</text>
  `;
}

function renderizarRelojCifrado(p, puntosCifrado, modo, indice) {
  const size = 260, c = size / 2, r = size / 2 - 34;
  const base = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="2 4" />`;

  if (!puntosCifrado || puntosCifrado.length === 0) {
    return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="260" xmlns="http://www.w3.org/2000/svg">${base}</svg>`;
  }

  let contenido = "";
  if (modo === "todos") {
    // Todos los c₂ juntos, cada uno con el color de su carácter
    puntosCifrado.forEach((pc, idx) => {
      contenido += _puntoC2Svg(p, c, r, pc, PALETA_RELOJ_CIFRADO[idx % PALETA_RELOJ_CIFRADO.length]);
    });
  } else {
    // Un carácter a la vez, con detalle completo
    const idx = Math.max(0, Math.min(indice, puntosCifrado.length - 1));
    contenido = _puntoCifradoSvg(p, c, r, puntosCifrado[idx], "var(--purple)", 6);
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="260" xmlns="http://www.w3.org/2000/svg">
      ${base}
      ${contenido}
    </svg>
  `;
}

function renderRelojCifrado() {
  const svgDiv    = document.getElementById("reloj-cifrado-svg");
  const contador  = document.getElementById("reloj-cifrado-contador");
  const leyenda   = document.getElementById("reloj-cifrado-legend");
  const btnModo   = document.getElementById("reloj-cifrado-btn-modo");
  const btnPrev   = document.getElementById("reloj-cifrado-btn-prev");
  const btnNext   = document.getElementById("reloj-cifrado-btn-next");
  if (!svgDiv) return;

  const { p } = sesion.clave_publica || {};
  const puntos = sesion.relojPuntosCifrado || [];

  if (!p) {
    svgDiv.innerHTML = `<p class="interactive-note">Genera las claves primero.</p>`;
    if (leyenda) leyenda.innerHTML = "";
    return;
  }
  if (puntos.length === 0) {
    svgDiv.innerHTML = renderizarRelojCifrado(p, [], "paso", -1);
    if (contador) contador.textContent = `Usa "Cifrar con nuevo k" arriba para ver los puntos aquí.`;
    if (leyenda) leyenda.innerHTML = "";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (btnModo) btnModo.disabled = true;
    return;
  }

  if (btnModo) btnModo.disabled = false;

  if (relojCifradoIndice < 0 || relojCifradoIndice > puntos.length - 1) {
    relojCifradoIndice = puntos.length - 1; // mostrar el último cifrado por defecto
  }

  svgDiv.innerHTML = renderizarRelojCifrado(p, puntos, relojCifradoModo, relojCifradoIndice);

  if (relojCifradoModo === "todos") {
    if (contador) contador.textContent = `Mostrando los c₂ (resultado final) de los ${puntos.length} carácter${puntos.length !== 1 ? "es" : ""} cifrados hasta ahora.`;
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (leyenda) {
      leyenda.innerHTML = puntos.map((pc, idx) => {
        const color = PALETA_RELOJ_CIFRADO[idx % PALETA_RELOJ_CIFRADO.length];
        return `<span><span class="dot" style="background:${color}"></span>'${escapar(pc.caracter)}' → c₂=${pc.c2}</span>`;
      }).join("");
    }
  } else {
    const pc = puntos[relojCifradoIndice];
    if (contador) {
      contador.innerHTML = `Carácter ${relojCifradoIndice + 1} / ${puntos.length}: '<b>${escapar(pc.caracter)}</b>'
        → m=${pc.m}, k=${pc.k}, c₁=${pc.c1}, yᵏ=${pc.yk}, c₂=${pc.c2}`;
    }
    if (btnPrev) btnPrev.disabled = relojCifradoIndice <= 0;
    if (btnNext) btnNext.disabled = relojCifradoIndice >= puntos.length - 1;
    if (leyenda) {
      leyenda.innerHTML = `
        <span><span class="dot" style="background:var(--purple)"></span>m (mensaje)</span>
        <span><span class="dot" style="background:var(--purple)"></span>c₁ / yᵏ</span>
        <span><span class="dot" style="background:var(--purple)"></span>c₂ (resultado)</span>
      `;
    }
  }
}

function navegarRelojCifrado(direccion) {
  const puntos = sesion.relojPuntosCifrado || [];
  if (puntos.length === 0) return;
  relojCifradoIndice = Math.max(0, Math.min(relojCifradoIndice + direccion, puntos.length - 1));
  renderRelojCifrado();
}

function alternarModoRelojCifrado() {
  const btn = document.getElementById("reloj-cifrado-btn-modo");
  relojCifradoModo = relojCifradoModo === "paso" ? "todos" : "paso";
  if (btn) btn.textContent = relojCifradoModo === "paso" ? "Ver todos juntos" : "Volver a paso a paso";
  renderRelojCifrado();
}

function toggleRelojCifrado() {
  const cont = document.getElementById("reloj-cifrado-container");
  const btn  = document.getElementById("reloj-cifrado-toggle");
  if (!cont) return;

  cont.classList.toggle("visible");
  const abierto = cont.classList.contains("visible");
  if (btn) btn.textContent = abierto ? "Ocultar reloj de cifrado" : "Ver cifrado en el reloj ↗";
  if (abierto) renderRelojCifrado();
}

//  Revelar la cancelación paso a paso 
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
  if (elS)    elS.innerHTML    = `s = c₁ˣ mod p = ...`;
  if (elSinv) elSinv.innerHTML = `s⁻¹ = ...`;
  if (elM)    elM.innerHTML    = `m = c₂ · s⁻¹ mod p = ... → carácter: ...`;
}

function revelarPaso(numero) {
  const { p, x } = sesion.clave_privada || {};
  if (!p || !x || revelado.c1 === null) return;

  const elS    = document.getElementById("reveal-s");
  const elSinv = document.getElementById("reveal-sinv");
  const elM    = document.getElementById("reveal-m");

  if (numero === 1) {
    revelado.s = potenciaModularJS(revelado.c1, x, p);
    elS.innerHTML = `s = c₁ˣ mod p = ${revelado.c1}<sup>${x}</sup> mod ${p} = <b>${revelado.s}</b>`;
    elS.classList.add("revealed");
  } else if (numero === 2) {
    if (revelado.s === null) { revelarPaso(1); }
    revelado.s_inv = inversoModularJS(revelado.s, p);
    elSinv.innerHTML = `s⁻¹ = ${revelado.s}<sup>${p - 2}</sup> mod ${p} = <b>${revelado.s_inv}</b>`;
    elSinv.classList.add("revealed");
  } else if (numero === 3) {
    if (revelado.s_inv === null) { revelarPaso(2); }
    revelado.m = (revelado.c2 * revelado.s_inv) % p;
    const caracter = String.fromCharCode(revelado.m);
    elM.innerHTML = `m = c₂ · s⁻¹ mod p = ${revelado.c2} × ${revelado.s_inv} mod ${p} = <b>${revelado.m}</b> → carácter: <b>'${escapar(caracter)}'</b>`;
    elM.classList.add("revealed");
  }
}
 
// HELPERS DE LA INTERFAZ
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

function formatMath(str) {
  if (!str) return str;
  return String(str)
    .replace(/\(ℤ\/(\d+)ℤ\)\*/g, "ℤ<sub>$1</sub><sup>*</sup>")
    .replace(/\(ℤ\/pℤ\)\*/g, "ℤ<sub>p</sub><sup>*</sup>")
    .replace(/\^\(([^()]+)\)/g, "<sup>$1</sup>")
    .replace(/\^(-?[0-9a-zA-Zφπ]+)/g, "<sup>$1</sup>");
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