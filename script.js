(function(){
  // ====== CONFIG (PROD) ======
  const KEYS_REQUIRED = 2;
  const DURATION_SEC = 11*3600 + 11*60 + 11;
  const HOLD_MS = 4700;
  const CODE_SEQ = "BARK47";

  const TG_BOT_USERNAME = "BARK47_Bot";        // fixed bot
  const VERIFY_URL = "/api/telegram-auth";     // Netlify Function endpoint

  // ====== STATE ======
  const LS = {
    keys: "bark_keys_fix_final",
    timerStart: "bark_timer_start_fix_final",
    timerEnd: "bark_timer_end_fix_final",
    armed: "bark_timer_armed_fix_final",
    finished: "bark_timer_finished_fix_final",
    tgUser: "bark_tg_user_fix_final"
  };

  let keysState = load(LS.keys) ? JSON.parse(load(LS.keys)) : {1:false,2:false};
  let armed = load(LS.armed) === "true";
  let finished = load(LS.finished) === "true";
  let timerStart = Number(load(LS.timerStart) || 0);
  let timerEnd = Number(load(LS.timerEnd) || 0);
  let tgUser = parseJSON(load(LS.tgUser));

  // ====== ELEMENTS ======
  const timerEl = byId("timer");
  const subtitleEl = byId("subtitle");
  const keysLabel = byId("keysLabel");
  const barFill = byId("barFill");
  const toastEl = byId("toast");
  const tgLogin = byId("tgLogin");
  const tgUserEl = byId("tgUser");
  const avatar = byId("avatar");
  const uname = byId("uname");
  const logoutBtn = byId("logout");

  // ====== UTIL ======
  function byId(id){return document.getElementById(id)}
  function load(k){return localStorage.getItem(k)}
  function save(k,v){localStorage.setItem(k,v)}
  function parseJSON(s){ try{return s?JSON.parse(s):null}catch(e){return null} }

  function showToast(msg){ toastEl.textContent = msg; toastEl.classList.add("show"); setTimeout(()=> toastEl.classList.remove("show"), 2200); }
  function updateProgressUI(){
    const count = Object.values(keysState).filter(Boolean).length;
    keysLabel.textContent = `Keys: ${count}/${KEYS_REQUIRED}`;
    const pct = Math.min(100, Math.round((count/KEYS_REQUIRED)*100));
    barFill.style.width = pct + "%";
  }
  function fmt(sec){ const s = Math.max(0, Math.floor(sec)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const x = s%60; const pad=n=>String(n).padStart(2,"0"); return `${pad(h)}:${pad(m)}:${pad(x)}`; }

  // ====== TIMER ======
  function startTimer(){
    if(armed) return;
    const now = Date.now();
    timerStart = now; timerEnd = now + DURATION_SEC*1000;
    armed = true; finished = false;
    save(LS.timerStart, String(timerStart));
    save(LS.timerEnd, String(timerEnd));
    save(LS.armed, "true");
    save(LS.finished, "false");
    showToast("Season 1 запущен");
    document.body.animate([{filter:"saturate(100%) brightness(100%)"},{filter:"saturate(180%) brightness(112%)"},{filter:"saturate(100%) brightness(100%)"}],{duration:520});
  }
  function tick(){
    if(!armed){ timerEl.textContent = "00:00:00"; return; }
    const now = Date.now();
    const rem = Math.max(0, Math.round((timerEnd - now)/1000));
    timerEl.textContent = fmt(rem);
    if(rem <= 0 && !finished){ finished = true; save(LS.finished, "true"); showToast("Season 1: готово"); }
  }

  // ====== EASTER EGGS ======
  let holdTimer = null;
  function onHoldStart(){
    if(holdTimer) return;
    const el = subtitleEl;
    el.textContent = "держи…";
    holdTimer = setTimeout(()=>{
      el.textContent = "неплохо. ищи дальше.";
      awardKey(1, "Ключ 1 найден: чувствую хватку.");
    }, HOLD_MS);
  }
  function onHoldEnd(){ subtitleEl.textContent = "попробуй запустить таймер"; if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; } }
  subtitleEl.addEventListener("mousedown", onHoldStart);
  subtitleEl.addEventListener("touchstart", onHoldStart, {passive:true});
  subtitleEl.addEventListener("mouseup", onHoldEnd);
  subtitleEl.addEventListener("mouseleave", onHoldEnd);
  subtitleEl.addEventListener("touchend", onHoldEnd);

  let typed = "";
  window.addEventListener("keydown", (e)=>{
    if(e.key.length !== 1) return;
    typed += e.key.toUpperCase();
    if(typed.length > CODE_SEQ.length) typed = typed.slice(-CODE_SEQ.length);
    if(typed === CODE_SEQ){ awardKey(2, "Ключ 2 найден: код принят."); typed = ""; }
  });

  function awardKey(id, msg){
    if(keysState[id]){ showToast("Уже активировано."); return; }
    keysState[id] = true; save(LS.keys, JSON.stringify(keysState)); updateProgressUI(); showToast(msg);
    const count = Object.values(keysState).filter(Boolean).length;
    if(count >= KEYS_REQUIRED && !armed){ startTimer(); }
  }

  // ====== TELEGRAM LOGIN ======
  function injectLoginWidget(){
    if(tgUser){ return; } // already logged in
    tgLogin.innerHTML = "";
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
  function removeLoginWidget(){ tgLogin.innerHTML = ""; tgLogin.classList.add("hidden"); }

  function renderUser(u){
    removeLoginWidget();
    tgUserEl.classList.remove("hidden");
    const nick = u.username ? "@"+u.username : (u.first_name || "user");
    avatar.src = u.photo_url || "";
    avatar.alt = nick;
    uname.textContent = nick;
    uname.href = u.username ? `https://t.me/${u.username}` : "#";
    logoutBtn.onclick = ()=>{ localStorage.removeItem(LS.tgUser); location.reload(); };
  }

  async function verifyWithServer(data){
    try{
      const res = await fetch(VERIFY_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) });
      if(!res.ok) throw 0;
      const json = await res.json();
      return json && json.user;
    }catch(e){ return null; }
  }

  // global callback for Telegram widget
  window.onTelegramAuth = async function(user){
    const verified = await verifyWithServer(user);
    if(!verified){ showToast("Авторизация не прошла."); return; }
    save(LS.tgUser, JSON.stringify(verified));
    tgUser = verified;
    renderUser(verified);
    showToast("Вход через Telegram выполнен");
  };

  // ====== INIT ======
  updateProgressUI();
  setInterval(tick, 1000); tick();

  if(tgUser){ renderUser(tgUser); }
  else{ injectLoginWidget(); }

})();