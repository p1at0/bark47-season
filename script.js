(function(){
  // ====== CONFIG (CLIENT-ONLY) ======
  const KEYS_REQUIRED = 2;
  const DURATION_SEC = 11*3600 + 11*60 + 11;
  const HOLD_MS = 4700;
  const CODE_SEQ = "BARK47";

  const TG_BOT_USERNAME = window.__BARK_TG__?.BOT_USERNAME || "BARK47_Bot";
  const BOT_TOKEN = window.__BARK_TG__?.BOT_TOKEN || ""; // Embedded per user request

  // ====== STATE ======
  const LS = {
    keys: "bark_keys_tg_client",
    timerStart: "bark_timer_start_tg_client",
    timerEnd: "bark_timer_end_tg_client",
    armed: "bark_timer_armed_tg_client",
    finished: "bark_timer_finished_tg_client",
    tgUser: "bark_tg_user_client"
  };

  let keysState = loadKeysState();
  let armed = localStorage.getItem(LS.armed) === "true";
  let finished = localStorage.getItem(LS.finished) === "true";
  let timerStart = Number(localStorage.getItem(LS.timerStart) || 0);
  let timerEnd = Number(localStorage.getItem(LS.timerEnd) || 0);
  let tgUser = loadTgUser();

  // ====== ELEMENTS ======
  const timerEl = document.getElementById("timer");
  const subtitleEl = document.getElementById("subtitle");
  const keysLabel = document.getElementById("keysLabel");
  const barFill = document.getElementById("barFill");
  const toastEl = document.getElementById("toast");
  const tgLogin = document.getElementById("tgLogin");
  const tgUserEl = document.getElementById("tgUser");
  const avatar = document.getElementById("avatar");
  const uname = document.getElementById("uname");
  const logoutBtn = document.getElementById("logout");

  // ====== UTILS ======
  function loadKeysState(){ try{ const raw = localStorage.getItem(LS.keys); if(raw) return JSON.parse(raw);}catch(e){} return {1:false,2:false}; }
  function saveKeysState(){ localStorage.setItem(LS.keys, JSON.stringify(keysState)); }
  function loadTgUser(){ try{const raw = localStorage.getItem(LS.tgUser); return raw? JSON.parse(raw): null;}catch(e){return null;} }
  function saveTgUser(u){ localStorage.setItem(LS.tgUser, JSON.stringify(u)); }
  function clearTgUser(){ localStorage.removeItem(LS.tgUser); }
  function showToast(msg){ toastEl.textContent = msg; toastEl.classList.add("show"); setTimeout(()=> toastEl.classList.remove("show"), 2200); }
  function updateProgressUI(){
    const count = Object.values(keysState).filter(Boolean).length;
    keysLabel.textContent = `Keys: ${count}/${KEYS_REQUIRED}`;
    const pct = Math.min(100, Math.round((count/KEYS_REQUIRED)*100));
    barFill.style.width = pct + "%";
  }
  function fmt(sec){
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const x = s%60;
    const pad = n => String(n).padStart(2,"0");
    return `${pad(h)}:${pad(m)}:${pad(x)}`;
  }

  // ====== TIMER ======
  function startTimer(){
    if(armed) return;
    const now = Date.now();
    timerStart = now;
    timerEnd = now + DURATION_SEC*1000;
    armed = true; finished = false;
    localStorage.setItem(LS.timerStart, String(timerStart));
    localStorage.setItem(LS.timerEnd, String(timerEnd));
    localStorage.setItem(LS.armed, "true");
    localStorage.setItem(LS.finished, "false");
    showToast("Season 1 запущен");
    glitch();
  }
  function glitch(){
    document.body.animate([
      { filter: "saturate(100%) brightness(100%)" },
      { filter: "saturate(180%) brightness(112%)" },
      { filter: "saturate(100%) brightness(100%)" }
    ], { duration: 520 });
  }
  function tick(){
    if(!armed){ timerEl.textContent = "00:00:00"; return; }
    const now = Date.now();
    const rem = Math.max(0, Math.round((timerEnd - now)/1000));
    timerEl.textContent = fmt(rem);
    if(rem <= 0 && !finished){ finished = true; localStorage.setItem(LS.finished, "true"); showToast("Season 1: готово"); }
  }

  // ====== EASTER EGGS ======
  // #1: long press on subtitle
  let holdTimer = null;
  function onHoldStart(){
    if(holdTimer) return;
    const el = document.getElementById("subtitle");
    el.textContent = "держи…";
    holdTimer = setTimeout(()=>{
      el.textContent = "неплохо. ищи дальше.";
      awardKey(1, "Ключ 1 найден: чувствую хватку.");
    }, HOLD_MS);
  }
  function onHoldEnd(){
    const el = document.getElementById("subtitle");
    el.textContent = "попробуй запустить таймер";
    if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
  }
  subtitleEl.addEventListener("mousedown", onHoldStart);
  subtitleEl.addEventListener("touchstart", onHoldStart, {passive:true});
  subtitleEl.addEventListener("mouseup", onHoldEnd);
  subtitleEl.addEventListener("mouseleave", onHoldEnd);
  subtitleEl.addEventListener("touchend", onHoldEnd);

  // #2: type BARK47
  let typed = "";
  window.addEventListener("keydown", (e)=>{
    if(e.key.length !== 1) return;
    typed += e.key.toUpperCase();
    if(typed.length > CODE_SEQ.length) typed = typed.slice(-CODE_SEQ.length);
    if(typed === CODE_SEQ){ awardKey(2, "Ключ 2 найден: код принят."); typed = ""; }
  });

  function awardKey(id, message){
    if(keysState[id]){ showToast("Уже активировано."); return; }
    keysState[id] = true; saveKeysState(); updateProgressUI(); showToast(message);
    const count = Object.values(keysState).filter(Boolean).length;
    if(count >= KEYS_REQUIRED && !armed){ startTimer(); }
  }

  // ====== LOCKED CARDS ======
  Array.from(document.querySelectorAll(".card.locked")).forEach(card=>{
    card.addEventListener("click", ()=>{
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      showToast("Запусти Season 1, чтобы войти.");
    });
    card.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); card.click(); }
    });
    card.setAttribute("tabindex","0");
    card.setAttribute("aria-disabled","true");
  });

  // ====== TELEGRAM LOGIN (CLIENT VERIFY) ======
  function renderLoginWidget(){
    tgLogin.innerHTML = ""; // reset
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", TG_BOT_USERNAME);
    s.setAttribute("data-size", "medium");
    s.setAttribute("data-userpic", "true");
    s.setAttribute("data-onauth", "onTelegramAuth");
    s.setAttribute("data-request-access", "write");
    tgLogin.appendChild(s);
  }

  function renderUser(u){
    tgLogin.classList.add("hidden");
    tgUserEl.classList.remove("hidden");
    const nick = u.username ? "@"+u.username : (u.first_name || "user");
    avatar.src = u.photo_url || "";
    avatar.alt = nick;
    uname.textContent = nick;
    uname.href = u.username ? `https://t.me/${u.username}` : "#";
    logoutBtn.onclick = ()=>{ clearTgUser(); location.reload(); };
  }

  // Helpers
  function toHex(buffer){
    const b = new Uint8Array(buffer);
    let s = ""; for (let i=0;i<b.length;i++){ s += b[i].toString(16).padStart(2,'0'); }
    return s;
  }
  async function sha256(buf){ return await crypto.subtle.digest("SHA-256", buf); }
  async function hmacSha256(keyRaw, messageBuf){
    const key = await crypto.subtle.importKey("raw", keyRaw, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
    return await crypto.subtle.sign("HMAC", key, messageBuf);
  }

  async function verifyClient(data){
    try{
      if(!BOT_TOKEN){ return false; }
      const { hash, ...fields } = data;
      const check = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join("\\n");
      // secret = SHA256(BOT_TOKEN)
      const enc = new TextEncoder();
      const secret = await sha256(enc.encode(BOT_TOKEN));
      const sig = await hmacSha256(secret, enc.encode(check));
      const hex = toHex(sig);
      if (hex !== String(hash)) return false;
      const now = Math.floor(Date.now()/1000);
      const authDate = Number(fields.auth_date || 0);
      if (!authDate || now - authDate > 86400) return false;
      return true;
    }catch(e){
      console.error("verify error", e);
      return false;
    }
  }

  window.onTelegramAuth = async function(user){
    const ok = await verifyClient(user);
    if(!ok){ showToast("Авторизация не прошла."); return; }
    saveTgUser(user);
    renderUser(user);
    showToast("Вход через Telegram выполнен");
  };

  // Init
  updateProgressUI();
  setInterval(tick, 1000);
  tick();

  if(tgUser){ renderUser(tgUser); }
  else{ renderLoginWidget(); }

})();