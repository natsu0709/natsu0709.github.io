// =====================================================
//  共通バグ報告ウィジェット
//  各ゲームの HTML に下の1行を足すだけで使える：
//  <script type="module" src="/bugreport.js?game=BANJO"></script>
//
//  ・右下に🐞ボタンが出る（ゲームの邪魔なら ?game=BANJO&button=0 で非表示）
//  ・ゲーム内の好きなボタンから開くなら  window.BugReport.open()
//  ・独自UIから直接送るなら          await window.BugReport.send("本文")
// =====================================================
import { firebaseConfig, SDK } from "./bug-config.js";

const params = new URL(import.meta.url).searchParams;
const GAME = (params.get("game") || document.title || "unknown").slice(0, 40);
const SHOW_BUTTON = params.get("button") !== "0";
const MAX = 1000;          // 最大文字数
const COOLDOWN = 30_000;   // 連投防止（30秒）

let dbPromise;
function db() {
  if (!dbPromise) dbPromise = (async () => {
    const { initializeApp, getApps } = await import(`${SDK}/firebase-app.js`);
    const fs = await import(`${SDK}/firebase-firestore.js`);
    // ゲーム側のFirebaseとぶつからないよう名前付きアプリで初期化
    const app = getApps().find(a => a.name === "bugreport") || initializeApp(firebaseConfig, "bugreport");
    return { db: fs.getFirestore(app), fs };
  })();
  return dbPromise;
}

async function send(text) {
  text = String(text || "").trim().slice(0, MAX);
  if (!text) throw new Error("内容を入力してください");
  let last = 0;
  try { last = Number(localStorage.getItem("bugreport_last") || 0); } catch {}
  if (Date.now() - last < COOLDOWN) throw new Error("少し時間をおいてから送ってください");
  const { db: d, fs } = await db();
  await fs.addDoc(fs.collection(d, "bugReports"), {
    game: GAME,
    text,
    page: location.href.slice(0, 300),
    ua: navigator.userAgent.slice(0, 300),
    createdAt: fs.serverTimestamp(),
    done: false
  });
  try { localStorage.setItem("bugreport_last", String(Date.now())); } catch {}
}

// ---------- UI（Shadow DOMでゲームのCSSと干渉しない） ----------
const host = document.createElement("div");
host.style.cssText = "position:fixed;z-index:2147483000;inset:auto 0 0 auto";
const root = host.attachShadow({ mode: "open" });
root.innerHTML = `
<style>
  *{box-sizing:border-box;font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif}
  .fab{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));
    width:44px;height:44px;border-radius:50%;border:1px solid #33334a;background:#0f0f17cc;
    color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 6px 20px #0008}
  .bg{position:fixed;inset:0;background:#000a;display:none;align-items:center;justify-content:center;padding:16px}
  .bg.on{display:flex}
  .box{width:100%;max-width:420px;background:#0f0f17;color:#f2f2f7;border:1px solid #2a2a3a;border-radius:16px;padding:20px}
  h2{margin:0 0 4px;font-size:18px}
  p{margin:0 0 12px;color:#8a8aa3;font-size:13px}
  textarea{width:100%;height:140px;resize:vertical;background:#07070b;color:#f2f2f7;border:1px solid #2a2a3a;
    border-radius:10px;padding:12px;font-size:16px}
  textarea:focus{outline:none;border-color:#d4ff3a}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px}
  .cnt{font-size:12px;color:#8a8aa3}
  button.b{border:0;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer}
  .cancel{background:#22222f;color:#f2f2f7}
  .send{background:#d4ff3a;color:#07070b}
  .send:disabled{opacity:.5}
  .msg{margin-top:10px;font-size:13px;min-height:1em}
</style>
${SHOW_BUTTON ? `<button class="fab" title="バグ報告">🐞</button>` : ""}
<div class="bg">
  <div class="box" role="dialog" aria-label="バグ報告">
    <h2>🐞 バグ報告</h2>
    <p>どの画面で・何をしたら・どうなったかを書いてください。</p>
    <textarea maxlength="${MAX}" placeholder="例）ルーム作成ボタンを押すと画面が真っ白になる"></textarea>
    <div class="msg"></div>
    <div class="row">
      <span class="cnt">0 / ${MAX}</span>
      <span><button class="b cancel">閉じる</button> <button class="b send">送信</button></span>
    </div>
  </div>
</div>`;
const $ = s => root.querySelector(s);
const bg = $(".bg"), ta = $("textarea"), msg = $(".msg"), sendBtn = $(".send");

function open() { bg.classList.add("on"); msg.textContent = ""; setTimeout(() => ta.focus(), 50); }
function close() { bg.classList.remove("on"); }
// ゲームのキー操作に入力が吸われないように
["keydown", "keyup", "keypress"].forEach(t => ta.addEventListener(t, e => e.stopPropagation()));
ta.addEventListener("input", () => { $(".cnt").textContent = `${ta.value.length} / ${MAX}`; });
$(".cancel").onclick = close;
bg.addEventListener("click", e => { if (e.target === bg) close(); });
$(".fab")?.addEventListener("click", open);
sendBtn.onclick = async () => {
  sendBtn.disabled = true; msg.style.color = "#8a8aa3"; msg.textContent = "送信中…";
  try {
    await send(ta.value);
    ta.value = ""; $(".cnt").textContent = `0 / ${MAX}`;
    msg.style.color = "#d4ff3a"; msg.textContent = "送信しました。ありがとう！";
    setTimeout(close, 1200);
  } catch (e) {
    msg.style.color = "#ff6b8a"; msg.textContent = e.message || "送信に失敗しました";
  } finally { sendBtn.disabled = false; }
};

(document.body ? Promise.resolve() : new Promise(r => addEventListener("DOMContentLoaded", r)))
  .then(() => document.body.appendChild(host));

window.BugReport = { open, close, send };
