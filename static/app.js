
window.addEventListener("load", () => {
  console.log("StockMaison V2.4");
  console.log("Html5Qrcode chargé :", typeof Html5Qrcode !== "undefined");
});


let products = [];
let scanner = null;
let scannerRunning = false;

const $ = id => document.getElementById(id);

async function api(url, opt = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opt.headers || {}) },
    ...opt
  });
  if (!r.ok) {
    let msg = "Erreur";
    try { msg = (await r.json()).detail || msg; } catch {}
    throw Error(msg);
  }
  return r.json();
}

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function fmt(n) {
  n = Number(n);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("fr-FR");
}

async function load() {
  products = await api("/api/products");
  render();
}

function render() {
  const q = $("search").value.toLowerCase();
  const data = products.filter(p =>
    [p.name, p.brand, p.category, p.barcode].some(v =>
      String(v || "").toLowerCase().includes(q)
    )
  );

  $("products").innerHTML = "";

  data.forEach(p => {
    const d = document.createElement("div");
    d.className = "product";
    d.innerHTML = `
      <div class="productTop">
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="">`
          : `<div class="ph">📦</div>`}
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="muted">${esc(p.brand || p.category)}</div>
          <span class="badge ${p.low_stock ? "low" : ""}">
            ${p.low_stock ? "À acheter" : "Stock OK"}
          </span>
        </div>
      </div>
      <p><span class="qty">${fmt(p.quantity)}</span> ${esc(p.unit)} · seuil ${fmt(p.minimum)}</p>
      <div class="actions">
        <button class="consume" data-a="consume" data-id="${p.id}">− Utiliser</button>
        <button data-a="add" data-id="${p.id}">+ Ajouter</button>
        <button data-a="delete" data-id="${p.id}">✕</button>
      </div>`;
    $("products").appendChild(d);
  });

  $("empty").style.display = products.length ? "none" : "block";

  const low = products.filter(p => p.low_stock);
  $("s1").textContent = products.length;
  $("s2").textContent = low.length;
  $("s3").textContent = low.length;

  $("shopping").innerHTML = low.length ? "" : "<p>Rien à acheter pour le moment.</p>";
  low.forEach(p => {
    $("shopping").insertAdjacentHTML(
      "beforeend",
      `<div class="item">
        <div>
          <b>${esc(p.name)}</b>
          <div class="muted">reste ${fmt(p.quantity)} ${esc(p.unit)}</div>
        </div>
        <b>Acheter ${fmt(p.to_buy)} ${esc(p.unit)}</b>
      </div>`
    );
  });
}

document.querySelectorAll("nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach(x =>
      x.classList.toggle("active", x === b)
    );
    document.querySelectorAll(".tab").forEach(x =>
      x.classList.toggle("active", x.id === b.dataset.tab)
    );
  };
});

$("search").oninput = render;

$("products").onclick = async ev => {
  const b = ev.target.closest("[data-a]");
  if (!b) return;

  const id = b.dataset.id;
  const a = b.dataset.a;

  if (a === "delete") {
    if (!confirm("Supprimer ce produit ?")) return;
    await api(`/api/products/${id}`, { method: "DELETE" });
  } else {
    await api(`/api/products/${id}/${a}`, {
      method: "POST",
      body: JSON.stringify({ amount: 1 })
    });
  }

  await load();
};

$("form").onsubmit = async ev => {
  ev.preventDefault();

  const o = Object.fromEntries(new FormData(ev.target));
  ["quantity", "minimum", "target_quantity"].forEach(k => o[k] = Number(o[k]));

  await api("/api/products", {
    method: "POST",
    body: JSON.stringify(o)
  });

  ev.target.reset();
  await load();
  document.querySelector('[data-tab="stock"]').click();
};

async function lookup(code) {
  code = String(code || "").replace(/\D/g, "");
  if (!code) return;

  $("barcode").value = code;
  $("preview").innerHTML = "Recherche...";

  try {
    const r = await api(`/api/barcode/${code}`);
    const p = r.product;

    if (!p) {
      $("preview").innerHTML =
        '<div class="found">❓ Produit inconnu : renseigne son nom une fois.</div>';
      return;
    }

    $("name").value = p.name || "";
    $("brand").value = p.brand || "";
    $("category").value = p.category || "Autre";
    $("unit").value = p.unit || "unité(s)";
    $("image_url").value = p.image_url || "";

    $("preview").innerHTML = `
      <div class="found">
        ${p.image_url ? `<img src="${esc(p.image_url)}">` : "📦"}
        <div>
          <b>${esc(p.name)}</b>
          <div>${esc(p.brand || "")}</div>
          <small>Source : ${r.source}</small>
        </div>
      </div>`;
  } catch (e) {
    $("preview").textContent = e.message;
  }
}

$("lookup").onclick = () => lookup($("barcode").value);



let availableCameras = [];
let permissionProbeStream = null;
let quaggaRunning = false;
let lastCandidate = { code: "", at: 0, count: 0 };

function formatCameraLabel(label, index) {
  const clean = (label || "").trim();
  return clean || `Caméra ${index + 1}`;
}

function chooseRearCamera(cameras) {
  if (!cameras.length) return null;
  const words = ["back", "rear", "environment", "arrière", "arriere", "world"];
  return cameras.find(c => words.some(w => (c.label || "").toLowerCase().includes(w)))
      || cameras[cameras.length - 1];
}

function stopPermissionProbe() {
  if (permissionProbeStream) {
    permissionProbeStream.getTracks().forEach(t => t.stop());
    permissionProbeStream = null;
  }
}

async function detectCameras() {
  const select = $("cameraSelect");
  if (!select) {
    $("status").textContent = "Erreur interface : cameraSelect absent.";
    return [];
  }
  select.innerHTML = '<option value="">Demande d’accès caméra...</option>';

  if (!navigator.mediaDevices?.getUserMedia) {
    $("status").textContent = "getUserMedia indisponible dans ce navigateur.";
    return [];
  }

  try {
    permissionProbeStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    const devices = await navigator.mediaDevices.enumerateDevices();
    stopPermissionProbe();

    availableCameras = devices.filter(d => d.kind === "videoinput").map((d,i)=>({
      id:d.deviceId,
      label:formatCameraLabel(d.label,i)
    }));

    select.innerHTML = "";
    if (!availableCameras.length) {
      select.innerHTML = '<option value="">Aucune caméra détectée</option>';
      $("status").textContent = "Autorisation obtenue mais aucune caméra détectée.";
      return [];
    }

    availableCameras.forEach((c,i)=>{
      const o=document.createElement("option");
      o.value=c.id; o.textContent=`${i+1}. ${c.label}`; select.appendChild(o);
    });
    const preferred=chooseRearCamera(availableCameras);
    if (preferred) select.value=preferred.id;
    $("status").textContent=`${availableCameras.length} caméra(s) détectée(s).`;
    return availableCameras;
  } catch(e) {
    stopPermissionProbe();
    $("status").textContent=`Erreur caméra — ${e?.name || "Erreur"}: ${e?.message || e}`;
    return [];
  }
}

async function openScan() {
  $("scanner").showModal();
  $("warning").style.display = window.isSecureContext ? "none" : "block";
  $("status").textContent = "Recherche des caméras...";
  await detectCameras();
}

$("scanOpen").onclick=openScan;
$("scanOpen2").onclick=openScan;

function stopQuagga() {
  stopPermissionProbe();
  if (typeof Quagga !== "undefined" && quaggaRunning) {
    try { Quagga.stop(); } catch {}
  }
  if (typeof Quagga !== "undefined") {
    try { Quagga.offDetected(); } catch {}
    try { Quagga.offProcessed(); } catch {}
  }
  quaggaRunning=false;
  const reader=$("reader");
  if (reader) reader.innerHTML="";
}

$("close").onclick=()=>{ stopQuagga(); $("scanner").close(); };

async function got(code) {
  if (!code) return;
  stopQuagga();
  if ($("scanner").open) $("scanner").close();
  document.querySelector('[data-tab="courses"]').click();
  await lookup(code);
}

$("manualGo").onclick=()=>got($("manual").value);

function acceptableBarcode(code) {
  if (!code) return false;
  const clean=String(code).trim();
  return clean.length >= 6 && clean.length <= 32;
}

function confirmDetection(code) {
  const now=Date.now();
  if (lastCandidate.code === code && now-lastCandidate.at < 1600) {
    lastCandidate.count += 1;
  } else {
    lastCandidate={code,at:now,count:1};
  }
  lastCandidate.at=now;
  return lastCandidate.count >= 2;
}

$("startCamera").onclick=async()=>{
  if (!window.isSecureContext) {
    $("status").textContent="La page doit être ouverte en HTTPS.";
    return;
  }
  if (typeof Quagga === "undefined") {
    $("status").textContent="La bibliothèque Quagga2 n'est pas chargée. Relance start_https.ps1.";
    return;
  }
  if (!availableCameras.length) await detectCameras();
  const cameraId=$("cameraSelect").value;
  if (!cameraId) { $("status").textContent="Aucune caméra sélectionnée."; return; }

  stopQuagga();
  const selected=availableCameras.find(c=>c.id===cameraId);
  $("status").textContent=`Initialisation de ${selected?.label || "la caméra"}...`;
  lastCandidate={code:"",at:0,count:0};

  const config={
    inputStream:{
      name:"Live",
      type:"LiveStream",
      target:document.querySelector("#reader"),
      constraints:{
        deviceId:{exact:cameraId},
        width:{min:640,ideal:1280,max:1920},
        height:{min:480,ideal:720,max:1080}
      },
      area:{top:"8%",right:"4%",left:"4%",bottom:"8%"}
    },
    locator:{patchSize:"medium",halfSample:true},
    decoder:{
      readers:[
        "ean_reader",
        "ean_8_reader",
        "upc_reader",
        "upc_e_reader",
        "code_128_reader",
        "code_39_reader"
      ]
    },
    locate:true,
    frequency:15,
    numOfWorkers:0
  };

  Quagga.init(config, err=>{
    if (err) {
      $("status").textContent=`Erreur Quagga2 — ${err?.name || "Erreur"}: ${err?.message || err}`;
      console.error(err);
      return;
    }
    quaggaRunning=true;
    Quagga.start();
    $("status").textContent="Scanner actif. Approche le code-barres jusqu’à ce qu’il occupe une grande partie de l’image.";

    Quagga.onDetected(result=>{
      const code=result?.codeResult?.code;
      const format=result?.codeResult?.format || "code-barres";
      if (!acceptableBarcode(code)) return;
      $("status").textContent=`Lecture ${format} : ${code} — confirmation...`;
      if (confirmDetection(code)) got(code);
    });
  });
};

$("cameraSelect").addEventListener("change",()=>{
  if (quaggaRunning) {
    stopQuagga();
    $("status").textContent="Caméra changée. Appuie sur Démarrer la caméra.";
  }
});

$("photo").onchange=ev=>{
  const file=ev.target.files?.[0];
  if (!file) return;
  if (typeof Quagga === "undefined") {
    $("status").textContent="Quagga2 n'est pas chargé.";
    return;
  }
  stopQuagga();
  const url=URL.createObjectURL(file);
  $("status").textContent="Analyse de la photo...";
  Quagga.decodeSingle({
    src:url,
    locate:true,
    inputStream:{size:1280},
    locator:{patchSize:"medium",halfSample:false},
    decoder:{readers:["ean_reader","ean_8_reader","upc_reader","upc_e_reader","code_128_reader","code_39_reader"]},
    numOfWorkers:0
  }, result=>{
    URL.revokeObjectURL(url);
    const code=result?.codeResult?.code;
    if (code) got(code);
    else $("status").textContent="Aucun code-barres détecté sur cette photo.";
  });
  ev.target.value="";
};


setInterval(load, 5000);
load();
