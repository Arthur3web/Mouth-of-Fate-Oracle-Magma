// ============ КОНФИГ ============
// Фиксированная комната — оба устройства автоматически в одной сессии.
// Если когда-нибудь понадобится несколько независимых установок,
// здесь можно сделать ручной ввод кода — но пока YAGNI.
const ROOM = "mof-default";

// ============ ВЫБОР РОЛИ ============
const params = new URLSearchParams(location.search);

// ?reset=1 — сбросить запомненную роль (на случай если перепутал устройство)
if (params.get("reset") === "1") {
  localStorage.removeItem("role");
}

// ?role=display|remote — переопределяет выбор и сохраняет.
// Удобно для закладок / PWA-ярлыков на главном экране.
const urlRole = params.get("role");
if (urlRole === "display" || urlRole === "remote") {
  localStorage.setItem("role", urlRole);
}

let role = localStorage.getItem("role") || "remote";

if (!role) {
  // Лендинг — ждём клика по «Вулкан» или «Пульт»
  document.body.className = "mode-picker";
  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosen = btn.getAttribute("data-role");
      localStorage.setItem("role", chosen);
      location.reload();
    });
  });
} else {
  document.body.className = "mode-" + role;
  startApp();
}

// Кнопка «сменить роль» — доступна в обоих рабочих режимах
const switchBtn = document.getElementById("switchRoleBtn");
if (switchBtn) {
  switchBtn.addEventListener("click", () => {
    if (!confirm("Сменить роль этого устройства?")) return;
    localStorage.removeItem("role");
    location.href = location.pathname;
  });
}

// ============ ПРИЛОЖЕНИЕ ============
function startApp() {
  // ----- предсказания -----
  const predictions = [
    "Звезды упадут именно на Вашу дорогу.",
    "Пламя подтверждает. Задуманное сбудется.",
    "Тени сгущаются там, где Вы ждёте.",
    "Все придёт в свое время. Судьба подскажет.",
    "Лепесток летит к воде. Всё идёт как надо.",
    "Пламя колеблется. Сейчас не время.",
    "Ветер дует в обратную сторону. Пока не время.",
    "Тени расходятся, не встретившись с Вами.",
    "След обрывается у старого камня. Нужно подождать.",
    "Луна убывает. Время подождать.",
    "Пламя мерцает между двух углей. Выбор за Вами.",
    "Ветер затих. Ждите следующего знака.",
    "Тени смешались. Сейчас не разобраться.",
    "Туман стелется по тропе. Ждите, когда рассеется.",
    "Река течёт спокойно. Доверьтесь времени.",
    "Длинный путь начинается с первого шага.",
    "Путь открыт перед Вами. Действуйте.",
    "Терпение принесёт неожиданный дар.",
    "Даже капля способна изменить камень.",
    "Судьба благосклонна к чистому сердцу.",
    "Огонь советует рискнуть. Действуйте.",
    "Ваша энергия способна изменить ход событий.",
    "Решение близко. Не бойтесь перемен.",
    "Присмотритесь. Судьба говорит символами.",
    "Ветер переменится. Пока не время."
  ];

  function getRandomPrediction() {
    return predictions[Math.floor(Math.random() * predictions.length)];
  }

  // ----- счётчик -----
  let totalPredictions = parseInt(
    localStorage.getItem("totalPredictions") || "0",
    10,
  );
  const totalCountEl = document.getElementById("totalCount");
  const totalNounEl = document.getElementById("totalNoun");

  function pluralPeople(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return "человек";
    if (mod10 === 1) return "человек";
    if (mod10 >= 2 && mod10 <= 4) return "человека";
    return "человек";
  }

  function setTotalCount(n) {
    if (totalCountEl) totalCountEl.innerText = n;
    if (totalNounEl) totalNounEl.innerText = pluralPeople(n);
  }

  setTotalCount(totalPredictions);

  // ----- показ -----
  const frame = document.getElementById("frame");
  const predictionText = document.getElementById("predictionText");

  function renderPrediction(text, count) {
    if (typeof count === "number") {
      totalPredictions = count;
      localStorage.setItem("totalPredictions", totalPredictions);
      setTotalCount(totalPredictions);
    }
    frame.classList.remove("visible");
    frame.classList.remove("idle");
    void frame.offsetWidth;
    predictionText.innerText = text;
    frame.classList.add("visible");
  }

  // ----- звук -----
  function playSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = 120;
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.8);
      osc.stop(ctx.currentTime + 0.8);
      setTimeout(() => ctx.close(), 1000);
    } catch (e) {}
  }

  // ----- статус -----
  const statusEl = document.getElementById("status");
  function setStatus(text, cls = "") {
    if (!statusEl) return;
    statusEl.className = "status " + cls;
    statusEl.innerText = text;
  }

  // --- ОРАКУЛ: статусы подключения вулкана ---
  function setOracleStatus(state) {
    // state: 'no-connection', 'connected', 'ready'
    if (state === "no-connection") {
      setStatus("Оракул спит...", "err");
    } else if (state === "connected") {
      setStatus("Оракул проснулся...", "ok");
    } else if (state === "ready") {
      setStatus("Оракул ожидает гостя...", "ok");
    }
  }

  // ----- PeerJS -----
  // Пульт = хост, Вулкан = клиент. Оба знают фиксированный hostId по ROOM.
  const hostId = `mof-oracle-${ROOM}-host`;
  const myId =
    role === "remote"
      ? hostId
      : `mof-oracle-${ROOM}-d-${Math.random().toString(36).slice(2, 8)}`;
  const peer = new Peer(myId, { debug: 1 });

  const liveConns = new Set();

  peer.on("error", (err) => {
    console.warn("peer error", err);
    if (err.type === "unavailable-id" && role === "remote") {
      // Кто-то уже занял Пульта в этой комнате.
      // Возможно, второе устройство тоже выбрало «Пульт» по ошибке —
      // даём осмысленное сообщение вместо тихого reload.
      setStatus("пульт уже занят другим устройством", "err");
      setTimeout(() => location.reload(), 6000);
    } else if (err.type === "peer-unavailable" && role === "display") {
      console.log("[oracle] пульт не в сети — жду…");
      setTimeout(connectToHost, 3000);
    } else if (role === "remote") {
      setOracleStatus("no-connection");
    }
  });

  if (role === "remote") {
    // === ПУЛЬТ: хост, кнопка, ждёт вулкан ===
    peer.on("open", () => {
      setOracleStatus("no-connection");
    });
    peer.on("connection", (conn) => {
      liveConns.add(conn);
      setOracleStatus("connected");
      document.getElementById("getPredictionBtn").disabled = false;
      conn.on("open", () => {
        setOracleStatus("ready");
      });
      const cleanup = () => {
        if (!liveConns.has(conn)) return;
        liveConns.delete(conn);
        if (liveConns.size === 0) {
          setOracleStatus("no-connection");
          document.getElementById("getPredictionBtn").disabled = true;
        }
      };
      conn.on("close", cleanup);
      conn.on("error", cleanup);
    });

    document
      .getElementById("getPredictionBtn")
      .addEventListener("click", () => {
        const openConns = Array.from(liveConns).filter((c) => c.open);
        if (openConns.length === 0) {
          setOracleStatus("no-connection");
          return;
        }
        const text = getRandomPrediction();
        totalPredictions += 1;
        localStorage.setItem("totalPredictions", totalPredictions);
        setTotalCount(totalPredictions);
        openConns.forEach((conn) =>
          conn.send({
            type: "prediction",
            text,
            count: totalPredictions,
          }),
        );
        playSound();
      });
  }

  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const roleRemoteBtn = document.getElementById("roleRemoteBtn");
  const roleDisplayBtn = document.getElementById("roleDisplayBtn");
  const clearCacheBtn = document.getElementById("clearCacheBtn");

  function updateMenuButtons() {
    const currentRole = role || "remote";
    roleRemoteBtn.classList.toggle("active", currentRole === "remote");
    roleDisplayBtn.classList.toggle("active", currentRole === "display");
  }

  menuBtn.addEventListener("click", () => {
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
    updateMenuButtons();
  });

  roleRemoteBtn.addEventListener("click", () => {
    if (role === "remote") {
      menu.style.display = "none";
      return;
    }
    localStorage.setItem("role", "remote");
    location.reload();
  });

  roleDisplayBtn.addEventListener("click", () => {
    if (role === "display") {
      menu.style.display = "none";
      return;
    }
    localStorage.setItem("role", "display");
    location.reload();
  });

  clearCacheBtn.addEventListener("click", async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn("[oracle] не удалось полностью очистить кэш", e);
    }
    location.href = location.pathname;
  });

  function connectToHost() {
    console.log("[oracle] подключаюсь к пульту…");
    const conn = peer.connect(hostId, { reliable: true });
    conn.on("open", () => {
      console.log("[oracle] подключено к пульту ✓");
    });
    conn.on("close", () => {
      console.log("[oracle] связь потеряна, переподключаюсь…");
      setTimeout(connectToHost, 2000);
    });
    conn.on("error", (e) => {
      console.warn("[oracle] ошибка связи", e);
    });
    conn.on("data", (data) => {
      if (data && data.type === "prediction") {
        playSound();
        renderPrediction(data.text, data.count);
      }
    });
  }

  if (role === "display") {
    peer.on("open", () => {
      connectToHost();
    });
  }
}

// ============ SERVICE WORKER ============
// Когда обновляется код, новый SW делает skipWaiting + clients.claim,
// и эта страница сама перезагружается, чтобы подхватить свежую версию.
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    if (!hadController) return; // первая регистрация — не перезагружаем
    refreshing = true;
    console.log("[oracle] новая версия SW, перезагружаюсь");
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => reg.update())
      .catch(() => {});
  });
}
