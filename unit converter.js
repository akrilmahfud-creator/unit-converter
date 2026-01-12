// ===== SOUND SYSTEM =====
let soundEnabled = true;

const clickSound = new Audio("sounds/click.mp3");
const successSound = new Audio("sounds/success.mp3");
const errorSound = new Audio("sounds/error.mp3");

// volume ideal
clickSound.volume = 0.4;
successSound.volume = 0.6;
errorSound.volume = 0.6;

function playSound(sound) {
  if (!soundEnabled) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}
const soundToggle = document.getElementById("soundToggle");

if (soundToggle) {
  soundToggle.addEventListener("change", function () {
    soundEnabled = this.checked;
  });
}

/* ========== Config ========== */
var units = {
  length: ["mm","cm","inch","m","km"],
  weight: ["Gram","ons","Kg","q","Ton"],
  temperature: ["Celcius (c)","Fahrenheit (f)","Kelvin (k)"],
  currency: [ "USD","IDR","JPY","EUR","GBP","KRW","CNY","SGD","MYR","AUD","SAR"],
  time: ["Second","Minute","Hour","Day"],
  data: ["byte","kb","mb","gb","tb"],
  area: ["mm2","cm2","m2","km2","ha"],
  volume: ["ml","l","m3"],
  speed: ["m/s","km/h","mph"],
};
var currencyNames = {
  USD: "US Dollar",
  IDR: "Rupiah Indonesia",
  JPY: "Yen Jepang",
  EUR: "Euro",
  GBP: "Pound Sterling",
  KRW: "Won Korea",
  CNY: "Yuan China",
  SGD: "Dollar Singapura",
  MYR: "Ringgit Malaysia",
  AUD: "Dollar Australia",
  SAR: "Riyal Arab Saudi"
};
var conversionRates = {
  length: { inch:0.0254, mm:0.001, cm:0.01, m:1, km:1000 },
  weight: { gram:0.001, ons:0.1, kg:1, q:100, ton:1000 },
  area: { mm2:0.000001, cm2:0.0001, m2:1, km2:1000000, ha:10000},
  volume: { ml: 0.000001, l:0.001, m3:1},
  speed: { "m/s":1, "km/h":0.277778, mph:0.44704}
};

var HISTORY_KEY = "uc_history_v1";
var MAX_HISTORY = 10;

var chart = null;

/* ========== DOM refs ========== */
var inputValue = document.getElementById("inputValue");
var categorySel = document.getElementById("category");
var fromSel = document.getElementById("fromUnit");
var toSel = document.getElementById("toUnit");
var convertBtn = document.getElementById("convertBtn");
var swapBtn = document.getElementById("swapBtn");
var copyBtn = document.getElementById("copyBtn");
var clearHistoryBtn = document.getElementById("clearHistoryBtn");
var resultEl = document.getElementById("result");
var rateInfoEl = document.getElementById("rateInfo");
var historyList = document.getElementById("historyList");
var startBtn = document.getElementById("startBtn");
var welcomeScreen = document.getElementById("welcome-screen");
var appMain = document.querySelector("main.app");
var resultCanvas = document.getElementById("resultChart");

/* ========== Helpers ========== */
function normalize(u) {
  if (!u) return "";
  return String(u).trim().toLowerCase().replace(/\s+/g, "");
}
function label(u) {
  if (!u) return "";
  var k = normalize(u);
  var map = { kg:"Kilogram", mm:"Milimeter", cm:"Centimeter", m:"Meter", km:"Kilometer", inch:"Inch", byte:"Byte", kb:"Kilobyte", mb:"Megabyte", gb:"Gigabyte", tb:"Terabyte", ons:"Ons", q:"Quintal", 
  mm2: "Milimeter Persegi (mm²)",
  cm2: "Centimeter Persegi (cm²)",
  m2: "Meter Persegi (m²)",
  km2: "Kilometer Persegi (km²)",
  ha: "Hektar (ha)",

  // VOLUME
  ml: "Mililiter (ml)",
  l: "Liter (l)",
  m3: "Meter Kubik (m³)",

  // KECEPATAN
  "m/s": "Meter per Detik (m/s)",
  "km/h": "Kilometer per Jam (km/jam)",
  mph: "Mil per Jam (mph)"
  };
  if (map[k]) return map[k];
  if (u.length <= 3) return u.toUpperCase();
  return u.charAt(0).toUpperCase() + u.slice(1);
}
function fmtNumber(n) {
  if (typeof n !== "number" || !isFinite(n)) return String(n);
  if (Math.abs(n) >= 1) return Number.parseFloat(n.toFixed(6)).toLocaleString();
  return Number.parseFloat(n.toPrecision(6)).toString();
}

/* ========== Initialization ========== */
document.addEventListener("DOMContentLoaded", function() {
  if (appMain) { appMain.style.display = "none"; }
  if (categorySel) { categorySel.addEventListener("change", updateUnits); }
  updateUnits();
  renderHistory();
});

/* ========== Update dropdowns ========== */
function updateUnits() {
  var category = (categorySel && categorySel.value) ? categorySel.value : "length";
  var list = units[category] || [];

  if (!fromSel || !toSel) return;

  fromSel.innerHTML = "";
  toSel.innerHTML = "";

  for (var i = 0; i < list.length; i++) {
  var u = list[i];
  var text = label(u);

  // khusus currency tampilkan kode + nama
  if (category === "currency" && currencyNames[u]) {
    text = u + " - " + currencyNames[u];
  }

  var opt1 = document.createElement("option");
  opt1.value = u;
  opt1.textContent = text;
  fromSel.appendChild(opt1);

  var opt2 = document.createElement("option");
  opt2.value = u;
  opt2.textContent = text;
  toSel.appendChild(opt2);
}

  if (toSel.options.length > 1) toSel.selectedIndex = 1;
  if (resultEl) resultEl.textContent = "Hasil akan muncul di sini";
  if (rateInfoEl) rateInfoEl.textContent = "";
  if (chart) { chart.destroy(); chart = null; }
}

/* ========== Convert handler ========== */
if (convertBtn) {
  convertBtn.addEventListener("click", function() {
    playSound(clickSound);
    convert();
  });
}

function convert() {
  var raw = parseFloat(inputValue.value);
  var category = (categorySel && categorySel.value) ? categorySel.value : "length";
  var from = (fromSel && fromSel.value) ? fromSel.value : "";
  var to = (toSel && toSel.value) ? toSel.value : "";

  if (isNaN(raw)) {
    if (resultEl) resultEl.textContent = "Masukkan angka valid.";
    return;
  }

  if (rateInfoEl) rateInfoEl.textContent = "";

  var resultValue = null;

  try {
    // LENGTH
    if (category === "length") {
      var ratesL = conversionRates.length;
      if (!ratesL[normalize(from)] || !ratesL[normalize(to)]) throw new Error("Satuan panjang tidak tersedia.");
      var baseL = raw * ratesL[normalize(from)]; // meters
      resultValue = baseL / ratesL[normalize(to)];
    }

    // WEIGHT
    else if (category === "weight") {
      var ratesW = conversionRates.weight;
      if (!ratesW[normalize(from)] || !ratesW[normalize(to)]) throw new Error("Satuan berat tidak tersedia.");
      var baseW = raw * ratesW[normalize(from)]; // kg
      resultValue = baseW / ratesW[normalize(to)];
    }
    // AREA
    else if (category === "area") {
      var ratesA = conversionRates.area;
      var nf = normalize(from);
      var nt = normalize(to);
      if (!ratesA[nf] || !ratesA[nt]) throw new Error("Satuan luas tidak tersedia.");
      resultValue = raw * (ratesA[nf] / ratesA[nt]);
    }

    // VOLUME
    else if (category === "volume") {
      var ratesV = conversionRates.volume;
      var nf = normalize(from);
      var nt = normalize(to);
      if (!ratesV[nf] || !ratesV[nt]) throw new Error("Satuan volume tidak tersedia.");
      resultValue = raw * (ratesV[nf] / ratesV[nt]);
    }

    // SPEED
    else if (category === "speed") {
      var ratesS = conversionRates.speed;
      var nf = normalize(from);
      var nt = normalize(to);
      if (!ratesS[nf] || !ratesS[nt]) throw new Error("Satuan kecepatan tidak tersedia.");
      resultValue = raw * (ratesS[nf] / ratesS[nt]);
    }

    // TEMPERATURE
    else if (category === "temperature") {
      resultValue = convertTemperature(raw, from, to);
    }

    // CURRENCY (online)
    else if (category === "currency") {
      if (!navigator.onLine) 
        resultEl.textContent = "Mengambil kurs...";
      resultValue = convertCurrencySync(raw, from, to, function(err, value, rateText) {  
        if (err) {
          resultEl.textContent = "Anda sedang offline. konversi mata uang tidak tersedia.";
          rateInfoEl.textContent = "Sumber kurs membutuhkan koneksi internet.";
          playSound(errorSound); //suara eror
        } else {
          if (rateInfoEl) rateInfoEl.textContent = rateText;
          // show final result
          if (typeof value === "number") {
            displayResult(raw, from, to, value);
            addHistoryEntry(raw, from, to, value, category);
            renderHistory();
            playSound(successSound); //suara sukses
          }
        }
      });
      // currency branch returns asynchronously via callback above
      return;
    }

    // TIME
    else if (category === "time") {
      var toSec = { second:1, minute:60, hour:3600, day:86400 };
      var nf = normalize(from);
      var nt = normalize(to);
      if (typeof toSec[nf] === "undefined" || typeof toSec[nt] === "undefined") throw new Error("Satuan waktu tidak dikenali.");
      resultValue = raw * (toSec[nf] / toSec[nt]);
      if (rateInfoEl) rateInfoEl.textContent = "1 " + label(nt) + " = " + (toSec[nt] / toSec[nf]) + " " + label(nf);
    }

    // DATA
    else if (category === "data") {
      var base = 1024;
      var toByte = {
        byte: 1,
        kb: Math.pow(base,1),
        mb: Math.pow(base,2),
        gb: Math.pow(base,3),
        tb: Math.pow(base,4)
      };
      var nf2 = normalize(from);
      var nt2 = normalize(to);
      if (typeof toByte[nf2] === "undefined" || typeof toByte[nt2] === "undefined") throw new Error("Satuan data tidak dikenali.");
      resultValue = raw * (toByte[nf2] / toByte[nt2]);
      if (rateInfoEl) rateInfoEl.textContent = "Basis: " + base + " — 1 " + label(nt2) + " = " + (toByte[nt2] / toByte[nf2]).toLocaleString() + " " + label(nf2);
    }

    // final validation
    if (resultValue == null || isNaN(resultValue)) {
      if (resultEl) resultEl.textContent = "Terjadi kesalahan konversi (hasil tidak valid).";
      return;
    }

    // display, history, chart
    displayResult(raw, from, to, resultValue);
    addHistoryEntry(raw, from, to, resultValue, category);
    renderHistory();

  } catch (err) {
    console.error(err);
    if (resultEl) resultEl.textContent = "Terjadi kesalahan: " + (err.message || err);
    if (rateInfoEl) rateInfoEl.textContent = "";
  }
}

/* ========== Currency: fetch but without template literals (async) ========== */
function convertCurrencySync(value, from, to, cb) {
  // builds URL via string concatenation
  try {
    var endpoint = "https://open.er-api.com/v6/latest/" + from;
    fetch(endpoint, {cache: "no-store"})
    .then(function(res) {
      if (!res.ok) {
        cb(new Error("API error: " + res.status));
        return;
      }
      res.json().then(function(data) {
        if (!data || !data.rates) { cb(new Error("Respon API tidak valid.")); return; }
        var rate = data.rates[to];
        if (typeof rate === "undefined") { cb(new Error("Kurs untuk " + to + " tidak tersedia.")); return; }
        var now = new Date().toLocaleString();
        var rateText = 
        "1 " + from + " = " + rate + " " + to +
        " | Sumber: ExchangeRate-Api (open.er-api.com)"+
        " | Update: " + now;
        var result = value * rate;
        cb(null, result, rateText);
      }).catch(function(e) { cb(e); });
    }).catch(function(e) { cb(e); });
  } catch (e) {
    cb(e);
  }
}

/* ========== Display helper ========== */
function displayResult(raw, from, to, value, silent) {
  if (resultEl) {
    resultEl.textContent = fmtNumber(raw) + " " + label(from) + " = " + fmtNumber(value) + " " + label(to);
  }
  if (!silent) {
  playSound(successSound);
  }
}

function convertTemperature(v, from, to) {
  var f = normalize(from);
  var t = normalize(to);
  var c;

  // ke Celcius dulu
  if (f.includes("celcius")) {
    c = v;
  } else if (f.includes("fahrenheit")) {
    c = (v - 32) * 5 / 9;
  } else if (f.includes("kelvin")) {
    c = v - 273.15;
  } else {
    throw new Error("Satuan suhu tidak dikenali");
  }

  // dari Celcius ke target
  if (t.includes("celcius")) return c;
  if (t.includes("fahrenheit")) return (c * 9 / 5) + 32;
  if (t.includes("kelvin")) return c + 273.15;

  throw new Error("Satuan suhu tidak dikenali");
}

/* ========== History (localStorage) ========== */
function loadHistory() {
  try {
    var raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn("loadHistory error", e);
    return [];
  }
}
function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (e) { console.warn("saveHistory error", e); }
}
function addHistoryEntry(entryInput, from, to, resultVal, categoryName) {
  try {
    var entry = { timestamp: Date.now(), input: entryInput, from: from, to: to, result: resultVal, category: categoryName };
    var arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > MAX_HISTORY) arr.length = MAX_HISTORY;
    saveHistory(arr);
  } catch (e) { console.warn(e); }
}
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

/* ========== Render history ========== */
function renderHistory() {
  if (!historyList) return;
  var items = loadHistory();
  historyList.innerHTML = "";
  if (!items || items.length === 0) {
    historyList.innerHTML = "<div class=\"muted\">Belum ada riwayat.</div>";
    return;
  }
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var el = document.createElement("div");
    el.className = "history-item";

    var left = document.createElement("div"); left.className = "left";
    var icon = document.createElement("div"); icon.className = "small-icon";
    icon.textContent = getIconLetter(it.category);

    var main = document.createElement("div");
    var title = document.createElement("div");
    var dispRes = (typeof it.result === "number" && !isNaN(it.result)) ? fmtNumber(it.result) : "—";
    title.textContent = fmtNumber(it.input) + " " + label(it.from) + " → " + dispRes + " " + label(it.to);

    var meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = new Date(it.timestamp).toLocaleString() + " • " + capitalize(it.category);

    main.appendChild(title); main.appendChild(meta);
    left.appendChild(icon); left.appendChild(main);

    var right = document.createElement("div");
    var copy = document.createElement("button");
    copy.className = "btn ghost";
    copy.textContent = "Copy";
    (function(textToCopy, btnElem){
      btnElem.addEventListener("click", function(){
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy);
        } else {
          // fallback
          var ta = document.createElement("textarea");
          ta.value = textToCopy;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch(e){ console.warn(e); }
          document.body.removeChild(ta);
        }
        btnElem.textContent = "Copied";
        setTimeout(function(){ btnElem.textContent = "Copy"; }, 1200);
      });
    })(fmtNumber(it.input) + " " + label(it.from) + " = " + dispRes + " " + label(it.to), copy);

    right.appendChild(copy);
    el.appendChild(left); el.appendChild(right);
    historyList.appendChild(el);
  }
}

/* ========== Utilities ========== */
function capitalize(s) { if (!s) return ""; return s.charAt(0).toUpperCase() + s.slice(1); }
function getIconLetter(cat) {
  if (cat === "length") return "📏";
  if (cat === "weight") return "⚖";
  if (cat === "temperature") return "🌡";
  if (cat === "currency") return "💱";
  if (cat === "time") return "⏱";
  if (cat === "data") return "💾";
  if (cat === "area") return "📐";
  if (cat === "volume") return "🧊";
  if (cat === "speed") return "🚀";
  return "•";
}

/* ========== Controls: swap, copy result, clear history ========= */
if (swapBtn) swapBtn.addEventListener("click", function(){
  playSound(clickSound);
  if (!fromSel || !toSel) return;
  var a = fromSel.selectedIndex; var b = toSel.selectedIndex;
  fromSel.selectedIndex = b; toSel.selectedIndex = a;
});

if (copyBtn) copyBtn.addEventListener("click", function(){
  playSound(clickSound);
  var txt = resultEl ? resultEl.textContent : "";
  if (!txt) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt);
  } else {
    var ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch(e) { console.warn(e); }
    document.body.removeChild(ta);
  }
  copyBtn.textContent = "Tersalin";
  setTimeout(function(){ copyBtn.textContent = "Salin Hasil"; }, 1200);
});

if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", function(){
  playSound(clickSound);
  if (confirm("Hapus semua riwayat konversi?")) clearHistory();
});

/* ========== Welcome screen handler ========= */
if (startBtn) startBtn.addEventListener("click", function(){
  playSound(clickSound);
  if (welcomeScreen) {
    welcomeScreen.classList.add("hidden");
    setTimeout(function(){
      welcomeScreen.style.display = "none";
      if (appMain) appMain.style.display = "block";
      updateUnits();
      if (chart){
        chart.resize();
      }
    }, 400);
  } else {
    if (appMain) appMain.style.display = "block";
    updateUnits();
  }
});
var themeBtn = document.getElementById("themeToggle");

if (themeBtn) {
  themeBtn.addEventListener("click", function () {
    playSound(clickSound);
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
      themeBtn.textContent = "☀ Light";
      localStorage.setItem("theme", "dark");
    } else {
      themeBtn.textContent = "🌙 Dark";
      localStorage.setItem("theme", "light");
    }
  });
}
var savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark");
  if (themeBtn) themeBtn.textContent = "☀ Light";
}
document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("inputValue");
  var upBtn = document.querySelector(".spin .up");
  var downBtn = document.querySelector(".spin .down");

  if (!input || !upBtn || !downBtn) return;

upBtn.addEventListener("click", function () {
  playSound(clickSound);
  input.value = Number(input.value || 0) + 1;
});

downBtn.addEventListener("click", function () {
  playSound(clickSound);
  input.value = Number(input.value || 0) - 1;
});
});
var aboutBtn = document.getElementById("aboutBtn");
var aboutModal = document.getElementById("aboutModal");
var closeAbout = document.getElementById("closeAbout");

if (aboutBtn && aboutModal) {
  aboutBtn.addEventListener("click", function () {
    playSound(clickSound);
    aboutModal.classList.remove("hidden");
  });
}

if (closeAbout && aboutModal) {
  closeAbout.addEventListener("click", function () {
    playSound(clickSound);
    aboutModal.classList.add("hidden");
  });
}

// klik area gelap untuk tutup
var overlay = aboutModal ? aboutModal.querySelector(".modal-overlay") : null;
if (overlay && aboutModal) {
  overlay.addEventListener("click", function () {
    aboutModal.classList.add("hidden");
  });
}
