const API_BASE = "/api";

// Estado de la sesión actual
const sesion = {
  metodo: "rsa",
  clave_publica: null,
  clave_privada: null,
  parametros: null,   // p, q, phi — para la explicación didáctica
};

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  cargarClaves();

  document.getElementById("metodo").addEventListener("change", (e) => {
    sesion.metodo = e.target.value;
    sesion.clave_publica = null;
    sesion.clave_privada = null;
    cargarClaves();
  });
});

// ─────────────────────────────────────────────
// CLAVES — pedir al backend al cargar la página
// ─────────────────────────────────────────────

async function cargarClaves() {
  mostrarEstadoClaves("Generando claves...", "loading");

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

    mostrarEstadoClaves("Claves listas ✓", "ok");
    actualizarInfoClaves();

  } catch (error) {
    mostrarEstadoClaves("Error al generar claves", "error");
    console.error(error);
  }
}

// ─────────────────────────────────────────────
// ENCRIPTAR
// ─────────────────────────────────────────────

async function encriptar() {
  const password    = document.getElementById("password").value.trim();
  const resultadoDiv = document.getElementById("resultado");
  const errorDiv    = document.getElementById("error");

  resultadoDiv.classList.add("hidden");
  errorDiv.classList.add("hidden");

  if (!password) {
    mostrarError("Por favor ingresa la contraseña.");
    return;
  }
  if (!sesion.clave_publica) {
    mostrarError("Las claves aún no están listas. Espera un momento.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/encriptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metodo:        sesion.metodo,
        password:      password,
        clave_publica: sesion.clave_publica,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error en la encriptación");

    // Guardar cifrado en sesion para poder desencriptar
    sesion.ultimo_cifrado = data.encrypted;

    document.getElementById("resultado-texto").textContent =
      JSON.stringify(data.encrypted);
    resultadoDiv.classList.remove("hidden");

    // Hook para la explicación didáctica (implementar más adelante)
    // mostrarExplicacion(password, data.encrypted, sesion);

  } catch (error) {
    mostrarError("Error: " + error.message);
  }
}

// ─────────────────────────────────────────────
// DESENCRIPTAR
// ─────────────────────────────────────────────

async function desencriptar() {
  const errorDiv = document.getElementById("error");
  errorDiv.classList.add("hidden");

  if (!sesion.ultimo_cifrado) {
    mostrarError("No hay texto cifrado. Encripta primero.");
    return;
  }
  if (!sesion.clave_privada) {
    mostrarError("No hay clave privada en sesión.");
    return;
  }

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

    document.getElementById("resultado-descifrado").textContent = data.decrypted;
    document.getElementById("resultado-descifrado-container").classList.remove("hidden");

  } catch (error) {
    mostrarError("Error: " + error.message);
  }
}

// ─────────────────────────────────────────────
// UI — helpers
// ─────────────────────────────────────────────

function mostrarError(msg) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = msg;
  errorDiv.classList.remove("hidden");
}

function mostrarEstadoClaves(msg, tipo) {
  const el = document.getElementById("estado-claves");
  if (!el) return;
  el.textContent = msg;
  el.className = {
    loading: "text-yellow-500 text-xs",
    ok:      "text-green-500 text-xs",
    error:   "text-red-500 text-xs",
  }[tipo] || "";
}

function actualizarInfoClaves() {
  // Muestra la clave pública en la UI (nunca la privada)
  const el = document.getElementById("info-clave-publica");
  if (!el || !sesion.clave_publica) return;
  const { e, n } = sesion.clave_publica;
  el.textContent = `e = ${e},  n = ${n}`;
}

// ─────────────────────────────────────────────
// HOOK EXPLICACIÓN DIDÁCTICA
// Descomentar y completar cuando implementes la sección explicativa
// ─────────────────────────────────────────────

// function mostrarExplicacion(password, cifrado, sesion) {
//   const { clave_publica, clave_privada, parametros, metodo } = sesion;
//   // Aquí tendrás acceso a:
//   //   parametros.p, parametros.q, parametros.phi
//   //   clave_publica.e, clave_publica.n
//   //   password (texto original)
//   //   cifrado  (lista de enteros)
//   // Úsalos para generar la explicación paso a paso con valores reales
// }
