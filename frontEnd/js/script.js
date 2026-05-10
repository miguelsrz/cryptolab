const API_BASE = "http://localhost:8000/api";

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
  mostrarEstadoClaves("Generando…", "loading");
  limpiarPasos();

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
  ["claves", "cifrado", "descifrado"].forEach(t => {
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
  }
}

// ─────────────────────────────────────────────
// RENDER — pasos de generación de claves
// (formato genérico: array de {titulo, formula, detalle, valores})
// ─────────────────────────────────────────────
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
      <p class="step-detail">${escapar(p.detalle)}</p>
      ${renderKV(p.valores || {})}
    `,
  }));

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
    const items = [
      {
        num: 1,
        titulo: "Fórmula de cifrado ElGamal",
        formula: "c₁ = gᵏ mod p  |  c₂ = m · yᵏ mod p",
        body: `<p class="step-detail">
          Para cada carácter se elige una k aleatoria (efímera).
          <br/>• c₁ = g<sup>k</sup> mod p &nbsp;(parte pública del par)
          <br/>• c₂ = m · y<sup>k</sup> mod p &nbsp;(carácter cifrado usando la clave pública y)
          <br/>El par (c₁, c₂) es el texto cifrado del carácter.
        </p>`,
      },
      {
        num: 2,
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
    const items = [
      {
        num: 1,
        titulo: "Fórmula de descifrado ElGamal",
        formula: "s = c₁ˣ mod p  →  m = c₂ · s⁻¹ mod p",
        body: `<p class="step-detail">
          Para cada par (c₁, c₂):
          <br/>1. Se calcula el secreto compartido: s = c₁<sup>x</sup> mod p
          <br/>2. Se obtiene su inverso modular: s⁻¹
          <br/>3. El carácter original: m = c₂ · s⁻¹ mod p
        </p>`,
      },
      {
        num: 2,
        titulo: `Descifrado carácter a carácter (${pasos.length})`,
        formula: `p=${sesion.clave_privada?.p}, x=${sesion.clave_privada?.x}`,
        body: renderTablaElGamalDescifrado(pasos),
      },
    ];
    renderStepList(items);
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
      <td>${p.c2}</td>
    </tr>`
  ).join("");
  return `
    <table class="char-table">
      <thead><tr><th>Char</th><th>m</th><th>k (efímero)</th><th>c₁</th><th>c₂</th></tr></thead>
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
  if (msg) el.querySelector("p").innerHTML = msg;
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
