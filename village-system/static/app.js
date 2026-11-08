const appRoot = document.getElementById("app");
const toastEl = document.getElementById("toast");
const state = { user: null, panchayats: [], data: null, intelligence: null, page: "Overview", map: null, complaintLocationMap: null, voiceRecognition: null, authMode: "login" };
const STATUSES = ["Submitted", "In review", "In progress", "Resolved", "Rejected"];
const glyphs = {
  Overview: "⌂", Complaints: "☷", "Issue map": "⌖", "Public budgets": "▤",
  "Development works": "⌁", "School services": "⌂", "Health camps": "✚",
  "Scheme guide": "◇", "Public satisfaction": "★", Reports: "▥", "Officer accounts": "♙", "Panchayat directory": "⌖", Notifications: "♧",
  "SmartGram AI Intelligence Dashboard": "✳"
};
const descriptions = {
  Overview: "A clearer picture of the services and work in your community.",
  Complaints: "Report an issue or follow its progress from submission to resolution.",
  "Issue map": "See reported issues by location to support better field planning.",
  "Public budgets": "Understand published development allocations and progress.",
  "Development works": "Follow local projects, inspections and community feedback.",
  "School services": "Keep local school facilities and meal feedback in view.",
  "Health camps": "Find a camp near you or publish an upcoming community service.",
  "Scheme guide": "Find potential scheme matches, review application steps and compare local information.",
  "Public satisfaction": "Rate completed work, share private service feedback and review public satisfaction summaries.",
  Reports: "Review platform activity and download a summary for your records.",
  "SmartGram AI Intelligence Dashboard": "Review complaint patterns, photo findings and local development priorities for your Gram Panchayat.",
  "Officer accounts": "Create Panchayat officer accounts and review assigned coverage.",
  "Panchayat directory": "Maintain Gram Panchayat records used throughout the service.",
  Notifications: "Updates on reports and local service activity."
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
async function loadPublicBudgets() {
  const target = document.getElementById("public-budget-list");
  if (!target) return;
  try {
    const budgets = await api("/api/public/budgets");
    const allocated = budgets.reduce((sum, item) => sum + Number(item.allocated), 0);
    const spent = budgets.reduce((sum, item) => sum + Number(item.spent), 0);
    const summary = document.getElementById("budget-summary");
    if (summary) summary.innerHTML = `${statCard("Published allocations", budgets.length, "Budget entries available", "▤")}${statCard("Total allocated", currency(allocated), "Across published entries", "₹")}${statCard("Recorded expenditure", currency(spent), "Across published entries", "↗")}${statCard("Balance recorded", currency(Math.max(0, allocated - spent)), "Allocation less recorded spend", "◫")}`;
    target.innerHTML = budgetTable(budgets);
  }
  catch (error) { target.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtAppointmentTime(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "—";
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const local = new Date(year, month - 1, day, hour, minute);
  return local.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit"
  });
}
function panchayatDirectoryPage() {
  return `${heading("Platform records", "Panchayat directory", `<button class="btn btn-primary" id="add-panchayat">＋ Add Gram Panchayat</button>`)}
    <div class="notice">The initial directory was imported from the supplied Karnataka LGD Panchayat file. You can update or add local records here; records are retained when referenced by accounts or services.</div>
    <section class="panel"><div class="panel-head"><div><h2>Karnataka Gram Panchayats</h2><p class="panel-subtitle">${state.panchayats.length.toLocaleString("en-IN")} records</p></div><input id="panchayat-search" class="input" style="max-width:290px" placeholder="Search name, taluk, district or LGD code"></div><div id="directory-list"></div><div class="panel-head panel-rule"><span class="panel-subtitle" id="directory-count"></span><div><button class="btn btn-outline btn-sm" id="directory-prev">← Previous</button> <button class="btn btn-outline btn-sm" id="directory-next">Next →</button></div></div></section>`;
}
function bindPanchayatDirectory() {
  let page = 0;
  const pageSize = 50;
  const search = document.getElementById("panchayat-search");
  const draw = () => {
    const query = search.value.trim().toLowerCase();
    const matches = state.panchayats.filter(p => !query || `${p.name} ${p.district} ${p.taluk} ${p.lgd_code}`.toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.max(0, Math.min(page, pages - 1));
    const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
    document.getElementById("directory-list").innerHTML = table(visible, [
      { label: "Gram Panchayat", render: p => `<div class="td-title">${esc(p.name)}</div><div class="td-sub">LGD ${esc(p.lgd_code)}</div>` },
      { label: "District", key: "district" }, { label: "Taluk", key: "taluk" },
      { label: "", render: p => `<button class="btn btn-outline btn-sm" data-edit-panchayat="${p.id}">Edit</button>` }
    ], "No Panchayats match that search.");
    document.getElementById("directory-count").textContent = `${matches.length.toLocaleString("en-IN")} matching · Page ${page + 1} of ${pages}`;
    document.getElementById("directory-prev").disabled = page === 0;
    document.getElementById("directory-next").disabled = page >= pages - 1;
    document.querySelectorAll("[data-edit-panchayat]").forEach(button => button.addEventListener("click", () => {
      panchayatModal(state.panchayats.find(p => p.id === Number(button.dataset.editPanchayat)));
    }));
  };
  search.addEventListener("input", () => { page = 0; draw(); });
  document.getElementById("directory-prev").addEventListener("click", () => { page--; draw(); });
  document.getElementById("directory-next").addEventListener("click", () => { page++; draw(); });
  draw();
}
function panchayatModal(record = null) {
  const editing = Boolean(record);
  modal(editing ? "Update Gram Panchayat" : "Add Gram Panchayat", editing ? "Keep its LGD code, district and taluk details accurate." : "Add a record to the Panchayat directory.", `<form id="panchayat-form" class="form-grid">
    ${field("LGD code", "lgd_code", "text", true, "Official local government code", record?.lgd_code || "")}
    ${field("Gram Panchayat name", "name", "text", true, "Name", record?.name || "")}
    ${field("District", "district", "text", true, "District", record?.district || "")}
    ${field("Taluk", "taluk", "text", true, "Taluk", record?.taluk || "")}
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">${editing ? "Save changes" : "Add Panchayat"} →</button></div></form>`);
  const form = document.getElementById("panchayat-form");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await api(editing ? `/api/admin/panchayats/${record.id}` : "/api/admin/panchayats", {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(getFormData(form))
      });
      state.panchayats = await api("/api/panchayats");
      closeModal(); showToast(editing ? "Panchayat record updated." : "Panchayat added.");
      await refresh();
    } catch (error) { showToast(error.message); } finally { submit.disabled = false; }
  });
}
function currency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}
async function api(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const config = { ...options, headers: { ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } };
  const response = await fetch(url, config);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    if (response.status === 404 && url.startsWith("/api/") && !contentType.includes("application/json")) {
      throw new Error(`The running server does not recognize ${config.method || "GET"} ${url}. Restart or redeploy the Flask backend, then refresh this page.`);
    }
    throw new Error(body.error || `Request failed (${response.status}) for ${config.method || "GET"} ${url}.`);
  }
  return body;
}
function panchayatOptions(selected = "", district = "") {
  return state.panchayats.filter(p => !district || p.district === district)
    .map(p => `<option value="${p.id}" ${String(p.id) === String(selected) ? "selected" : ""}>${esc(p.name)} · ${esc(p.taluk)}</option>`).join("");
}
function talukOptions(district, selected = "") {
  const taluks = [...new Set(state.panchayats.filter(p => p.district === district).map(p => p.taluk))].sort();
  return taluks.map(taluk => `<option value="${esc(taluk)}" ${taluk === selected ? "selected" : ""}>${esc(taluk)}</option>`).join("");
}
function districtOptions(selected = "") {
  return [...new Set(state.panchayats.map(p => p.district))].sort()
    .map(d => `<option value="${esc(d)}" ${d === selected ? "selected" : ""}>${esc(d)}</option>`).join("");
}
function panchayatLabel(id) {
  const p = state.panchayats.find(item => item.id === Number(id));
  return p ? `${p.name}, ${p.district}` : "Gram Panchayat";
}
function statusBadge(status) {
  return `<span class="badge badge-${esc(String(status).toLowerCase().replaceAll(" ", "-"))}">${esc(status)}</span>`;
}
function statCard(label, value, note, icon) {
  return `<article class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${esc(value)}</div><div class="stat-note">${note}</div></article>`;
}
function empty(message, icon = "◌") {
  return `<div class="empty"><span class="empty-icon">${icon}</span>${esc(message)}</div>`;
}
function modal(title, subtitle, content) {
  document.querySelector(".modal-backdrop")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="modal-close" aria-label="Close dialog">×</button></div><div class="modal-content">${content}</div></div></div>`);
  document.querySelector(".modal-close").addEventListener("click", closeModal);
  document.querySelector(".modal-backdrop").addEventListener("click", e => { if (e.target.classList.contains("modal-backdrop")) closeModal(); });
}
function closeModal() {
  state.voiceRecognition?.stop();
  state.voiceRecognition = null;
  window.speechSynthesis?.cancel();
  state.complaintLocationMap?.remove();
  state.complaintLocationMap = null;
  document.querySelector(".modal-backdrop")?.remove();
}
function field(label, name, type = "text", required = true, placeholder = "", value = "") {
  return `<div class="field"><label for="${esc(name)}">${esc(label)}${required ? " *" : ""}</label><input class="input" id="${esc(name)}" name="${esc(name)}" type="${esc(type)}" ${required ? "required" : ""} placeholder="${esc(placeholder)}" value="${esc(value)}"></div>`;
}
function selectField(label, name, options, required = true) {
  return `<div class="field"><label for="${esc(name)}">${esc(label)}${required ? " *" : ""}</label><select class="select" id="${esc(name)}" name="${esc(name)}" ${required ? "required" : ""}>${options}</select></div>`;
}
function textArea(label, name, placeholder, required = true, rows = 4) {
  return `<div class="field full"><label for="${esc(name)}">${esc(label)}${required ? " *" : ""}</label><textarea class="textarea" id="${esc(name)}" name="${esc(name)}" rows="${rows}" ${required ? "required" : ""} placeholder="${esc(placeholder)}"></textarea></div>`;
}
function getFormData(form) { return Object.fromEntries(new FormData(form).entries()); }
function bindForm(id, endpoint, method, success, transform = x => x) {
  const form = document.getElementById(id);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await api(endpoint, { method, body: JSON.stringify(transform(getFormData(form))) });
      closeModal();
      showToast(success);
      await refresh();
    } catch (error) {
      showToast(error.message);
    } finally { submit.disabled = false; }
  });
}
function refreshData() {
  return api("/api/dashboard").then(data => { state.data = data; state.user = data.user; });
}
async function refresh() {
  await refreshData();
  renderApp();
}

function renderAuth() {
  appRoot.innerHTML = `<div class="auth-page">
    <section class="auth-brand">
      <div class="brand"><div class="brand-mark">S</div><div><div class="brand-name">smartgram</div><div class="brand-caption">VILLAGE, MOVING FORWARD</div></div></div>
      <div class="eyebrow">Good governance, closer to home</div>
      <h1>Small actions.<br><span>Stronger villages.</span></h1>
      <p>A shared space for community voices, local services and the people working to make village life better.</p>
      <div class="auth-feature"><span>✳</span><span>Report local problems and follow every update.</span></div>
      <div class="auth-feature"><span>↗</span><span>Explore public works, budgets and health camps.</span></div>
      <div class="auth-feature"><span>⌖</span><span>Connected to Gram Panchayats across Karnataka.</span></div>
    </section>
    <section class="auth-form-side"><div class="auth-card">
      <div class="eyebrow">SMARTGRAM COMMUNITY PORTAL</div><h2>${state.authMode === "login" ? "Welcome back" : "Join your community"}</h2>
      <p>${state.authMode === "login" ? "Sign in to continue to your village workspace." : "Create a citizen account to report and follow local services."}</p>
      <div class="auth-tabs"><button class="auth-tab ${state.authMode === "login" ? "active" : ""}" data-auth="login">Sign in</button><button class="auth-tab ${state.authMode === "register" ? "active" : ""}" data-auth="register">Create account</button></div>
      <form id="auth-form">
        ${state.authMode === "register" ? `${field("Your name", "name", "text", true, "e.g. Ananya Rao")}${field("Email address", "email", "email", true, "you@example.com")}${field("Create password (10+ characters)", "password", "password", true, "At least 10 characters")}
          <div class="field"><label for="district">District *</label><select class="select" id="district" required><option value="">Choose district</option>${districtOptions()}</select></div>
          <div class="field"><label for="panchayat_id">Gram Panchayat *</label><select class="select" id="panchayat_id" name="panchayat_id" required disabled><option value="">Choose a district first</option></select></div>`
          : `${field("Email address", "email", "email", true, "you@example.com")}${field("Password", "password", "password", true, "Your password")}`}
        <p id="auth-error" class="error-text"></p><button class="btn btn-primary" type="submit" style="width:100%;margin-top:5px">${state.authMode === "login" ? "Sign in to SmartGram →" : "Create citizen account →"}</button>
      </form>
      <div class="demo-box"><strong>Try a demo workspace</strong><br>Local demo password: SmartGram@123
        <div class="demo-links"><button data-demo="citizen">Citizen</button><button data-demo="officer">Panchayat officer</button><button data-demo="admin">Administrator</button></div>
      </div>
    </div></section>
  </div>`;
  document.querySelectorAll("[data-auth]").forEach(button => button.addEventListener("click", () => { state.authMode = button.dataset.auth; renderAuth(); }));
  const district = document.getElementById("district");
  district?.addEventListener("change", () => {
    const select = document.getElementById("panchayat_id");
    select.innerHTML = `<option value="">Choose Gram Panchayat</option>${panchayatOptions("", district.value)}`;
    select.disabled = !district.value;
  });
  document.querySelectorAll("[data-demo]").forEach(button => button.addEventListener("click", async () => {
    const emails = { citizen: "citizen@smartgram.local", officer: "officer@smartgram.local", admin: "admin@smartgram.local" };
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ email: emails[button.dataset.demo], password: "SmartGram@123" }) });
      await refresh();
    } catch (error) { showToast(error.message); }
  }));
  document.getElementById("auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const formData = getFormData(event.currentTarget);
    const endpoint = state.authMode === "login" ? "/api/login" : "/api/register";
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify(formData) });
      await refresh();
    } catch (error) { document.getElementById("auth-error").textContent = error.message; }
  });
}

function navItems() {
  const role = state.user.role;
  const common = ["Overview", "Complaints", "Issue map", "Public budgets", "Development works", "School services", "Health camps"];
  common.push("Scheme guide");
  common.push("Public satisfaction");
  if (role === "officer") common.push("SmartGram AI Intelligence Dashboard");
  if (role === "citizen" || role === "officer") common.push("Notifications");
  if (role !== "citizen") common.push("Reports");
  if (role === "admin") common.push("Officer accounts");
  if (role === "admin") common.push("Panchayat directory");
  return common;
}
function renderApp() {
  if (!state.user || !state.data) return renderAuth();
  const name = state.user.name.split(" ")[0];
  appRoot.innerHTML = `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark">S</div><div><div class="brand-name">smartgram</div><div class="brand-caption">VILLAGE, MOVING FORWARD</div></div></div>
      <div class="nav-label">Workspace</div><nav class="nav-list">${navItems().map(item => `<button class="nav-item ${state.page === item ? "active" : ""}" data-page="${esc(item)}"><span class="nav-icon">${glyphs[item]}</span>${esc(item)}</button>`).join("")}</nav>
      <div class="sidebar-bottom"><div class="help-card"><strong>Need a hand?</strong>Use the complaint tracker to stay in the loop. Your Panchayat team will post updates here.</div>
        <div class="profile"><div class="avatar">${esc(state.user.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase())}</div><div><div class="profile-name">${esc(state.user.name)}</div><div class="profile-role">${esc(state.user.role)}${state.user.panchayat_name ? ` · ${esc(state.user.panchayat_name)}` : ""}</div></div><button class="logout" title="Sign out" aria-label="Sign out">↪</button></div>
      </div>
    </aside>
    <section class="content">
      <header class="topbar"><div style="display:flex;align-items:center"><button class="mobile-toggle" aria-label="Open menu">☰</button><span class="mobile-brand"><span class="brand-mark">S</span> smartgram</span><div class="crumb">Workspace <span style="padding:0 6px">/</span><strong>${esc(state.page)}</strong></div></div>
        <div class="top-actions"><span class="today">${new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date())}</span>${state.user.role === "citizen" ? `<button class="btn btn-soft btn-sm voice-assistant-launch" id="voice-assistant-launch">🎙 Voice help</button><button class="notification-button" title="Notifications" aria-label="Notifications">♧${state.data.notifications.some(n => !n.read) ? '<span class="notification-dot"></span>' : ""}</button>` : ""}</div>
      </header><main class="main-content" id="page-content"></main>
      <div class="footer-note">SmartGram · A community-first village development portal</div>
    </section>
  </div>`;
  document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => {
    state.page = button.dataset.page;
    document.getElementById("sidebar").classList.remove("open");
    renderApp();
  }));
  document.querySelector(".mobile-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.querySelector(".logout").addEventListener("click", logout);
  document.querySelector(".notification-button")?.addEventListener("click", () => { state.page = "Notifications"; renderApp(); });
  document.getElementById("voice-assistant-launch")?.addEventListener("click", () => voiceAssistantModal());
  renderPage();
}
function heading(kicker, title, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(descriptions[state.page] || "")}</p></div>${action}</div>`;
}
function table(rows, columns, emptyMessage) {
  if (!rows.length) return empty(emptyMessage);
  return `<div class="table-wrap"><table><thead><tr>${columns.map(col => `<th>${esc(col.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(col => `<td>${col.render ? col.render(row) : esc(row[col.key] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function complaintTable(rows, canUpdate) {
  return table(rows, [
    { label: "Complaint", render: row => `<div class="td-title">#${row.id} · ${esc(row.title)}</div><div class="td-sub">${esc(row.category)} · ${esc(row.location)}${row.image_filename ? " · Photo attached" : ""}</div>` },
    { label: "Panchayat", render: row => `<div>${esc(row.panchayat_name || panchayatLabel(row.panchayat_id))}</div>${row.reporter ? `<div class="td-sub">by ${esc(row.reporter)}</div>` : ""}` },
    { label: "Status", render: row => statusBadge(row.status) },
    { label: "Updated", render: row => fmtDate(row.updated_at) },
    { label: "", render: row => `${canUpdate ? `<button class="btn btn-outline btn-sm" data-complaint="${row.id}" data-update="true">Update</button> <button class="btn btn-soft btn-sm" data-assignment="${row.id}">Assign</button>` : `<button class="btn btn-outline btn-sm" data-complaint="${row.id}">Track</button>`}` }
  ], "No complaints here yet.");
}
function overviewPage() {
  const { summary, complaints, budgets, projects, camps, notifications } = state.data;
  const citizen = state.user.role === "citizen";
  const openAction = citizen
    ? `<button class="btn btn-primary" id="new-complaint">＋ Report an issue</button>`
    : `<button class="btn btn-soft" id="get-suggestions">✳ AI village report</button>`;
  const intro = citizen
    ? `<section class="welcome"><div><div class="eyebrow">YOUR COMMUNITY, YOUR VOICE</div><h2>Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${esc(state.user.name.split(" ")[0])}.</h2><p>Your reports and local services, all in one place.</p></div><div class="welcome-icon">🌱</div></section>`
    : "";
  return `${heading("Community snapshot", "Your village at a glance", openAction)}${intro}
    <div class="stat-grid">${statCard("Total complaints", summary.complaints, citizen ? "Reports you have submitted" : "Across your workspace", "☷")}${statCard("Needs attention", summary.open, "Not yet resolved or closed", "◷")}${statCard("Resolved", summary.resolved, "Marked resolved by the Panchayat", "✓")}${statCard("Karnataka Panchayats", summary.panchayats.toLocaleString("en-IN"), "Available in the directory", "⌖")}</div>
    <div id="suggestions-box"></div>
    <div class="grid-two"><section class="panel"><div class="panel-head"><div><h2>Recent complaints</h2><p class="panel-subtitle">A little progress adds up.</p></div><button class="btn btn-outline btn-sm" data-goto="Complaints">All complaints</button></div>${complaintTable(complaints.slice(0, 5), !citizen)}</section>
    <section class="panel"><div class="panel-head"><div><h2>Community services</h2><p class="panel-subtitle">Published updates from your Panchayat.</p></div></div><div class="panel-body"><div class="list-stack">
      <div class="list-item"><div class="list-item-top"><div><div class="td-title">Development works</div><div class="td-sub">${projects.length} projects listed</div></div><span class="badge">${projects.filter(p => p.status === "In progress").length} active</span></div></div>
      <div class="list-item"><div class="list-item-top"><div><div class="td-title">Public allocations</div><div class="td-sub">${budgets.length} budget updates</div></div><span class="badge">${currency(budgets.reduce((sum, b) => sum + Number(b.allocated), 0))}</span></div></div>
      <div class="list-item"><div class="list-item-top"><div><div class="td-title">Health camps</div><div class="td-sub">${camps.length} upcoming or published</div></div><span class="badge">${notifications.filter(n => !n.read).length} new updates</span></div></div>
    </div></div></section></div>`;
}
function complaintsPage() {
  const citizen = state.user.role === "citizen";
  const action = citizen ? `<button class="btn btn-primary" id="new-complaint">＋ New complaint</button>` : "";
  return `${heading("Community voice", "Complaints", action)}${citizen ? `<div class="notice">If an issue marked resolved is still not fixed, open its tracker and choose “Report still unresolved” to send it back for Panchayat review.</div>` : ""}<section class="panel"><div class="panel-head"><div><h2>${citizen ? "Your reports" : "Panchayat reports"}</h2><p class="panel-subtitle">${citizen ? "Follow each report and review the action history." : "Review assigned reports and share a status update."}</p></div><div class="filters"><select class="select" id="complaint-filter"><option value="">All statuses</option>${["Submitted", "In review", "In progress", "Resolved", "Rejected"].map(s => `<option>${s}</option>`).join("")}</select></div></div><div id="complaint-list"></div></section>`;
}
function mapPage() {
  const geo = state.data.complaints.filter(c => c.latitude != null && c.longitude != null);
  return `${heading("Find patterns", "Community issue map")}<div class="notice">Only reports with optional location coordinates appear as pins. Map tiles come from OpenStreetMap; do not enter anyone's private or sensitive location.</div><section class="panel"><div class="panel-head"><div><h2>Reported locations</h2><p class="panel-subtitle">${geo.length} mapped of ${state.data.complaints.length} reports</p></div></div><div class="panel-body"><div id="issue-map" class="map">${geo.length ? "" : '<div class="map-empty">No complaints have map coordinates yet.<br>Citizens can add latitude and longitude when reporting an issue.</div>'}</div></div></section>
    <div class="grid-equal" style="margin-top:16px"><section class="panel"><div class="panel-head"><div><h2>Reports by category</h2><p class="panel-subtitle">Based on the complaints visible to your account.</p></div></div><div class="panel-body">${categoryBars(state.data.complaints)}</div></section><section class="panel"><div class="panel-head"><div><h2>Location notes</h2><p class="panel-subtitle">Reported village names and current status.</p></div></div><div class="panel-body list-stack">${state.data.complaints.slice(0, 5).map(c => `<div class="list-item"><div class="list-item-top"><div><div class="td-title">${esc(c.location)}</div><div class="td-sub">#${c.id} · ${esc(c.category)}</div></div>${statusBadge(c.status)}</div></div>`).join("") || empty("New reports will appear here.")}</div></section></div>`;
}
function categoryBars(complaints) {
  const count = Object.fromEntries(["Village", "School", "Health"].map(c => [c, complaints.filter(r => r.category === c).length]));
  const max = Math.max(1, ...Object.values(count));
  return Object.entries(count).map(([key, value]) => `<div style="margin:14px 0"><div class="list-item-top"><span class="td-title">${key} issues</span><span class="td-sub">${value}</span></div><div class="progress-track"><div class="progress-bar" style="width:${value / max * 100}%"></div></div></div>`).join("");
}
function budgetsPage() {
  const budgets = state.data.budgets;
  const total = budgets.reduce((s, b) => s + Number(b.allocated), 0);
  const spent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const canEdit = state.user.role !== "citizen";
  return `${heading("Open information", "Public budgets", canEdit ? `<button class="btn btn-primary" id="add-budget">＋ Publish allocation</button>` : "")}
    <div class="notice">This page shows data entered by authorized Panchayat staff. Empty lists mean no budget information has been published in SmartGram yet; verify official figures with your local Panchayat.</div>
    <div class="stat-grid" id="budget-summary">${statCard("Published allocations", budgets.length, "Loading public entries", "▤")}${statCard("Total allocated", currency(total), "Loading public entries", "₹")}${statCard("Recorded expenditure", currency(spent), "Loading public entries", "↗")}${statCard("Balance recorded", currency(Math.max(0, total - spent)), "Loading public entries", "◫")}</div>
    <section class="panel"><div class="panel-head"><div><h2>Development allocations</h2><p class="panel-subtitle">Allocation, recorded expenditure and work progress.</p></div></div><div id="public-budget-list">${empty("Loading public budget information…")}</div></section>`;
}
function budgetTable(budgets) {
  return table(budgets, [
      { label: "Work / allocation", render: b => `<div class="td-title">${esc(b.title)}</div><div class="td-sub">${esc(b.panchayat_name)} · ${esc(b.district || "")}</div>` },
      { label: "Financial year", key: "financial_year" }, { label: "Allocated", render: b => currency(b.allocated) },
      { label: "Spent", render: b => currency(b.spent) },
      { label: "Progress", render: b => `<div>${b.progress}%</div><div class="progress-track"><div class="progress-bar" style="width:${b.progress}%"></div></div>` },
      { label: "Updated", render: b => fmtDate(b.updated_at) }
    ], "No allocations have been published yet.");
}
function projectsPage() {
  const projects = state.data.projects, canEdit = state.user.role !== "citizen";
  return `${heading("Local action", "Development works", canEdit ? `<button class="btn btn-primary" id="add-project">＋ Add development work</button>` : "")}
    <div class="notice">Project progress is supplied by the responsible Panchayat. Inspection notes and evidence links help the community follow up; a link is not independently verified by this portal. Citizens can rate completed work; comments are shared privately with Panchayat staff.</div>
    <div class="grid-equal">${projects.length ? projects.map(p => `<article class="panel"><div class="panel-head"><div><h2>${esc(p.title)}</h2><p class="panel-subtitle">${esc(p.panchayat_name)} · Updated ${fmtDate(p.updated_at)}</p></div>${statusBadge(p.status)}</div><div class="panel-body"><p class="field-note">${esc(p.description)}</p><div class="list-item-top"><span class="td-sub">Work progress</span><strong>${p.progress}%</strong></div><div class="progress-track"><div class="progress-bar" style="width:${p.progress}%"></div></div><div class="satisfaction-rating">${p.rating_count ? `★ ${Number(p.average_rating).toFixed(1)} / 5 · ${p.rating_count} ${p.rating_count === 1 ? "rating" : "ratings"}` : "No citizen ratings yet"}</div><div style="margin-top:14px;display:flex;gap:7px;flex-wrap:wrap">${canEdit ? `<button class="btn btn-soft btn-sm" data-inspect="${p.id}">＋ Record inspection</button>` : p.status === "Completed" ? `<button class="btn btn-soft btn-sm" data-rate-project="${p.id}">${p.my_rating ? "Update your rating" : "Rate completed work"}</button>` : ""}<button class="btn btn-outline btn-sm" data-inspection-history="${p.id}">Inspection history</button></div></div></article>`).join("") : `<section class="panel">${empty("No development works have been added yet.", "⌁")}</section>`}</div>`;
}
function reopenComplaintModal(complaintId) {
  modal("Report issue still unresolved", `Complaint #${complaintId}`, `<div class="notice">This sends the resolved complaint back to the Panchayat as “In review”. Officers will be notified.</div><form id="reopen-complaint-form" class="form-grid">${textArea("What remains unresolved?", "reason", "Explain what still needs attention.", true, 3)}<div class="field full form-actions"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Reopen complaint →</button></div></form>`);
  document.querySelector("#reopen-complaint-form [data-close]").addEventListener("click", closeModal);
  document.getElementById("reopen-complaint-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api(`/api/complaints/${complaintId}/reopen`, { method: "POST", body: JSON.stringify({ reason: form.elements.reason.value }) });
      closeModal();
      showToast("Complaint reopened. Panchayat staff have been notified.");
      await refresh();
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
}
async function projectFeedbackModal(id) {
  const project = state.data.projects.find(item => item.id === Number(id));
  if (!project || project.status !== "Completed") return showToast("Only completed work in your Gram Panchayat can be rated.");
  modal(project.my_rating ? "Update your rating" : "Rate completed work", project.title, `<div class="notice">Your rating contributes to the public average. Written comments are shared privately with Panchayat staff.</div><form id="project-feedback-form" class="form-grid">${selectField("Your rating", "rating", [1, 2, 3, 4, 5].map(rating => `<option value="${rating}" ${Number(project.my_rating || 5) === rating ? "selected" : ""}>${rating} ${rating === 1 ? "star" : "stars"}</option>`).join(""))}<div class="field full"><label for="project-feedback-note">What went well or needs improvement? <small>(optional)</small></label><textarea class="textarea" id="project-feedback-note" name="note" rows="3" maxlength="1000" placeholder="Share a helpful, respectful comment.">${esc(project.my_feedback || "")}</textarea></div><div class="field full form-actions"><button class="btn btn-primary" type="submit">${project.my_rating ? "Update rating" : "Submit rating"}</button></div></form>`);
  document.getElementById("project-feedback-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api(`/api/projects/${project.id}/feedback`, { method: "PUT", body: JSON.stringify({ rating: Number(form.elements.rating.value), note: form.elements.note.value }) });
      closeModal();
      showToast("Your project rating was saved.");
      await refresh();
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
}
async function loadSatisfactionReports() {
  try {
    const result = await api("/api/public/satisfaction");
    const { rating_count: ratingCount, average_rating: averageRating, citizen_count: citizenCount } = result.summary;
    document.getElementById("satisfaction-summary").innerHTML =
      `${statCard("Ratings received", ratingCount, "Across completed work and services", "★")}${statCard("Average satisfaction", averageRating == null ? "—" : `${Number(averageRating).toFixed(1)} / 5`, "Across all public ratings", "☆")}${statCard("Citizens represented", citizenCount, "Unique contributors", "♙")}`;
    document.getElementById("service-satisfaction-list").innerHTML = table(result.services, [
      { label: "Government service", key: "service_name" },
      { label: "Gram Panchayat", render: row => `${esc(row.panchayat_name)}<div class="td-sub">${esc(row.district)}</div>` },
      { label: "Average rating", render: row => `★ ${Number(row.average_rating).toFixed(1)} / 5` },
      { label: "Responses", key: "rating_count" }
    ], "No citizen service ratings have been submitted yet.");
    document.getElementById("project-satisfaction-list").innerHTML = table(result.projects, [
      { label: "Completed development work", key: "project_title" },
      { label: "Gram Panchayat", render: row => `${esc(row.panchayat_name)}<div class="td-sub">${esc(row.district)}</div>` },
      { label: "Average rating", render: row => `★ ${Number(row.average_rating).toFixed(1)} / 5` },
      { label: "Responses", key: "rating_count" }
    ], "No completed works have received a citizen rating yet.");
  } catch (error) {
    for (const id of ["service-satisfaction-list", "project-satisfaction-list"]) {
      const target = document.getElementById(id);
      if (target) target.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
    }
    return;
  }
  const serviceFeedbackForm = document.getElementById("service-feedback-form");
  if (serviceFeedbackForm && serviceFeedbackForm.dataset.bound !== "true") {
    serviceFeedbackForm.dataset.bound = "true";
    let savedFeedback;
    try { savedFeedback = await api("/api/services/feedback/mine"); }
    catch (error) { showToast(error.message); return; }
    const populateServiceFeedback = () => {
      const saved = savedFeedback.find(item => item.service_name === serviceFeedbackForm.elements.service_name.value);
      serviceFeedbackForm.elements.rating.value = String(saved?.rating || 5);
      serviceFeedbackForm.elements.note.value = saved?.note || "";
      serviceFeedbackForm.querySelector('[type="submit"]').textContent = saved ? "Update service feedback →" : "Send service feedback →";
    };
    serviceFeedbackForm.elements.service_name.addEventListener("change", populateServiceFeedback);
    populateServiceFeedback();
    serviceFeedbackForm.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api("/api/services/feedback", { method: "POST", body: JSON.stringify({ service_name: form.elements.service_name.value, rating: Number(form.elements.rating.value), note: form.elements.note.value }) });
        showToast("Your service feedback was sent to Panchayat staff.");
        const saved = savedFeedback.find(item => item.service_name === form.elements.service_name.value);
        if (saved) {
          saved.rating = Number(form.elements.rating.value);
          saved.note = form.elements.note.value;
        } else {
          savedFeedback.push({ service_name: form.elements.service_name.value, rating: Number(form.elements.rating.value), note: form.elements.note.value });
        }
        populateServiceFeedback();
        await loadSatisfactionReports();
      } catch (error) { showToast(error.message); }
      finally { button.disabled = false; }
    });
  }
  if (state.user.role !== "citizen") {
    try {
      const feedback = await api("/api/feedback/inbox");
      document.getElementById("feedback-inbox-list").innerHTML = table(feedback, [
        { label: "Feedback", render: row => `<div class="td-title">${esc(row.target_type === "project" ? row.project_title : row.service_name)}</div><div style="max-width:380px;white-space:normal">${esc(row.note || "Rating only")}</div>` },
        { label: "Gram Panchayat", key: "panchayat_name" },
        { label: "Rating", render: row => `★ ${row.rating} / 5` },
        { label: "Citizen", key: "citizen_name" },
        { label: "Received", render: row => fmtDate(row.created_at) }
      ], "No citizen feedback has been submitted yet.");
    } catch (error) {
      document.getElementById("feedback-inbox-list").innerHTML = `<div class="notice">${esc(error.message)}</div>`;
    }
  }
}
function satisfactionPage() {
  const citizen = state.user.role === "citizen";
  return `${heading("Community voice", "Public satisfaction")}
    <div class="notice">Public reports show anonymous rating totals and averages only. Written feedback is shared with authorized Panchayat staff, not published with your name.</div>
    <div class="stat-grid" id="satisfaction-summary">${statCard("Ratings received", "…", "Across completed work and services", "★")}${statCard("Average satisfaction", "…", "Out of five", "☆")}${statCard("Citizens represented", "…", "Unique contributors", "♙")}</div>
    ${citizen ? `<section class="panel" style="margin-bottom:17px"><div class="panel-head"><div><h2>Feedback about government services</h2><p class="panel-subtitle">Tell your Panchayat how a local service is working.</p></div></div><div class="panel-body"><form id="service-feedback-form" class="form-grid">${selectField("Service", "service_name", ["Panchayat office", "Water & sanitation", "Roads & streetlights", "School services", "Health services", "Waste collection", "Other government service"].map(service => `<option>${esc(service)}</option>`).join(""))}${selectField("Your rating", "rating", [1, 2, 3, 4, 5].map(rating => `<option value="${rating}">${rating} ${rating === 1 ? "star" : "stars"}</option>`).join(""))}<div class="field full"><label for="service-feedback-note">What went well or needs improvement? <small>(optional · private to Panchayat staff)</small></label><textarea class="textarea" id="service-feedback-note" name="note" rows="3" maxlength="1000" placeholder="Share a helpful, respectful comment."></textarea></div><div class="field full form-actions"><button class="btn btn-primary" type="submit">Send service feedback →</button></div></form></div></section>` : ""}
    <section class="panel" style="margin-bottom:17px"><div class="panel-head"><div><h2>Service satisfaction</h2><p class="panel-subtitle">Average citizen rating by service and Gram Panchayat.</p></div></div><div id="service-satisfaction-list">${empty("Loading public ratings…")}</div></section>
    <section class="panel"><div class="panel-head"><div><h2>Completed development work</h2><p class="panel-subtitle">Ratings submitted by citizens for completed projects.</p></div></div><div id="project-satisfaction-list">${empty("Loading public ratings…")}</div></section>
    ${citizen ? "" : `<section class="panel" style="margin-top:17px"><div class="panel-head"><div><h2>Panchayat feedback inbox</h2><p class="panel-subtitle">Written comments are visible only to authorized staff.</p></div></div><div id="feedback-inbox-list">${empty("Loading feedback…")}</div></section>`}`;
}
function schoolsPage() {
  const schools = state.data.schools, canEdit = state.user.role !== "citizen";
  return `${heading("Learning & wellbeing", "School services", canEdit ? `<button class="btn btn-primary" id="add-school">＋ Add school information</button>` : "")}
    <div class="notice">School facilities and midday-meal feedback are community service information, not a substitute for official school records.</div>
    <section class="panel"><div class="panel-head"><div><h2>Local schools</h2><p class="panel-subtitle">${schools.length} school records available</p></div></div>${table(schools, [
      { label: "School", render: s => `<div class="td-title">${esc(s.name)}</div><div class="td-sub">${esc(s.village)}</div>` },
      { label: "Gram Panchayat", key: "panchayat_name" },
      { label: "Facilities", render: s => `<div style="max-width:320px;white-space:normal">${esc(s.facilities)}</div>` },
      { label: "Midday meal feedback", render: s => `<div style="max-width:260px;white-space:normal">${esc(s.meal_feedback || "No feedback recorded")}</div>` },
      { label: "Updated", render: s => fmtDate(s.updated_at) }
    ], "No school service information has been added yet.")}</section>`;
}
function campsPage() {
  const camps = state.data.camps, citizen = state.user.role === "citizen";
  return `${heading("Care, close to home", "Health camps", !citizen ? `<button class="btn btn-primary" id="add-camp">＋ Publish a health camp</button>` : "")}
    <div class="notice">Get a recommended appointment time based on open slots and current registrations. Confirm the time with the camp team if you need to change it.</div>
    <div class="grid-equal">${camps.length ? camps.map(c => `<article class="panel"><div class="panel-head"><div><div class="eyebrow">${fmtDate(c.camp_date)} · ${esc(c.camp_time)}</div><h2>${esc(c.title)}</h2><p class="panel-subtitle">${esc(c.panchayat_name)} · ${esc(c.location)}</p></div><span class="stat-icon">✚</span></div><div class="panel-body"><div class="list-item"><div class="td-sub">Doctors / staff</div><div class="td-title" style="margin-top:4px">${esc(c.doctors)}</div></div><div class="list-item" style="margin-top:8px"><div class="td-sub">Services</div><div class="td-title" style="margin-top:4px">${esc(c.services)}</div></div><div class="list-item-top" style="margin-top:12px"><span class="td-sub">Registrations</span><strong>${c.registrations} / ${c.capacity}</strong></div><div class="progress-track"><div class="progress-bar" style="width:${Math.min(100, c.registrations / c.capacity * 100)}%"></div></div>${c.slots.length ? `<div class="camp-slot-strip"><span>${c.slots.length} appointment times</span><span>${c.slots.reduce((sum, slot) => sum + slot.available, 0)} seats available</span></div>` : `<div class="camp-schedule-warning">Appointment times have not been set by the Panchayat yet.</div>`}${c.my_slot ? `<div class="camp-booked">✓ You are registered · ${fmtAppointmentTime(c.my_slot)}</div>` : citizen ? `<button class="btn btn-primary btn-sm" style="margin-top:13px" data-camp-register="${c.id}" ${c.slots.length ? "" : "disabled"}>${c.slots.length ? "✳ Get a check-up time" : "Appointment times unavailable"}</button>` : !c.slots.length ? `<button class="btn btn-soft btn-sm" style="margin-top:13px" data-camp-schedule="${c.id}">Set appointment times</button>` : ""}</div></article>`).join("") : `<section class="panel">${empty("No health camps have been published yet.", "✚")}</section>`}</div>`;
}
function schemePage() {
  const canManage = state.user.role !== "citizen";
  const schemes = state.data.schemes || [];
  const categories = schemeCategoryOptions();
  return `${heading("Local information & starting points", "Scheme guide", canManage ? `<button class="btn btn-primary" id="add-scheme">＋ Add local scheme</button>` : "")}
    <div class="notice">This guide offers preliminary matches, not a government eligibility decision. Exact personal details are not saved; check history stores only age and income bands and belongs to your account. Confirm current rules and application dates with the responsible official office.</div>
    <section class="panel" style="margin-bottom:17px"><div class="panel-head"><div><h2>Local schemes & services</h2><p class="panel-subtitle">Verified scheme information for ${state.user.role === "admin" ? "Karnataka Gram Panchayats" : esc(state.user.panchayat_name || "your Gram Panchayat")}.</p></div></div><div class="panel-body">
      <div class="scheme-filters"><input class="input" id="scheme-search" type="search" placeholder="Search scheme name or details"><select class="select" id="scheme-category-filter">${categories}</select></div>
      <div class="scheme-compare-bar"><span class="field-note">Select two schemes to compare.</span><button class="btn btn-outline btn-sm" id="compare-schemes" disabled>Compare selected</button></div>
      <div id="scheme-comparison"></div><div class="scheme-cards" id="local-schemes-list">${schemes.length ? schemes.map(scheme => schemeCard(scheme, canManage)).join("") : empty(canManage ? "No local scheme information has been added yet." : "No verified local scheme information has been published for this Gram Panchayat yet.", "◇")}</div>
    </div></section>
    <section class="panel" style="margin-bottom:17px"><div class="panel-head"><div><h2>Find relevant schemes</h2><p class="panel-subtitle">Compare your broad details with structured age and income rules; other conditions need manual review.</p></div></div><div class="panel-body"><form id="scheme-form" class="form-grid">
      ${field("Age", "age", "number", true, "e.g. 34")}${field("Approximate annual household income (₹)", "annual_income", "number", true, "e.g. 150000")}
      ${selectField("Area of interest", "category", `<option value="all">All categories</option><option value="education">Education</option><option value="agriculture">Agriculture</option><option value="housing">Housing</option><option value="health">Health</option><option value="employment">Employment</option><option value="water">Water & basic services</option><option value="other">Other</option>`)}
      <div class="field full"><button class="btn btn-primary" type="submit">Check possible matches →</button></div></form>
      <div id="scheme-results"></div></div></section>
    <section class="panel"><div class="panel-head"><div><h2>Previous checks</h2><p class="panel-subtitle">Only broad age and income bands are retained for this signed-in account.</p></div><button class="btn btn-outline btn-sm" id="clear-scheme-history">Clear history</button></div><div class="panel-body"><div id="scheme-history">${empty("Loading your previous checks…")}</div></div></section>`;
}
function schemeCategoryOptions(selected = "all") {
  const labels = { all: "All categories", education: "Education", agriculture: "Agriculture", housing: "Housing", health: "Health", employment: "Employment", livelihood: "Employment", water: "Water & basic services", other: "Other" };
  return `<option value="all" ${selected === "all" ? "selected" : ""}>All categories</option>${Object.entries(labels).filter(([key]) => key !== "all" && key !== "livelihood").map(([key, label]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${label}</option>`).join("")}`;
}
function schemeCard(scheme, canManage = false) {
  const category = {
    housing: "Housing", livelihood: "Employment", employment: "Employment", agriculture: "Agriculture",
    health: "Health", education: "Education", water: "Water", other: "Other"
  }[scheme.category] || "Other";
  const docItems = String(scheme.documents || "").split(/[\n,;]+/).map(item => item.replace(/^[\s•*-]+/, "").trim()).filter(Boolean);
  return `<article class="scheme-card" data-scheme-card="${scheme.id}"><div class="list-item-top"><div><span class="badge">${esc(category)}</span> <span class="badge ${scheme.verified_at ? "badge-resolved" : "badge-medium"}">${scheme.verified_at ? "Verified by staff" : "Unverified"}</span><div class="td-sub" style="margin-top:7px">${esc(scheme.panchayat_name)} · ${esc(scheme.district)}</div></div><span class="td-sub">Updated ${fmtDate(scheme.updated_at)}</span></div>
    <h3>${esc(scheme.title)}</h3><p>${esc(scheme.description)}</p>
    <details><summary>Eligibility, benefits & application</summary><div class="scheme-detail"><strong>Eligibility information</strong><p>${esc(scheme.eligibility)}</p><strong>Structured criteria</strong><p>${scheme.min_age != null ? `Minimum age: ${scheme.min_age}. ` : ""}${scheme.max_age != null ? `Maximum age: ${scheme.max_age}. ` : ""}${scheme.max_annual_income != null ? `Maximum annual household income: ${currency(scheme.max_annual_income)}. ` : ""}${scheme.min_age == null && scheme.max_age == null && scheme.max_annual_income == null ? "No structured age or income rules provided." : ""}</p><strong>Benefits</strong><p>${esc(scheme.benefits)}</p><strong>Documents checklist</strong><div class="document-checklist">${(docItems.length ? docItems : ["Ask the Panchayat office for the current document list."]).map((item, index) => `<label><input type="checkbox" data-doc-check="${scheme.id}-${index}"> ${esc(item)}</label>`).join("")}</div><strong>How to apply</strong><p>${esc(scheme.application_info)}</p>${scheme.official_url ? `<a href="${esc(scheme.official_url)}" target="_blank" rel="noopener noreferrer">Official information ↗</a>` : ""}${scheme.verified_at ? `<p class="field-note">Marked verified by ${esc(scheme.verified_by_name || "Panchayat staff")} · ${fmtDate(scheme.verified_at)}</p>` : ""}</div></details>
    <div class="scheme-card-actions">${canManage ? `<button class="btn btn-outline btn-sm" data-edit-scheme="${scheme.id}">Edit</button>${scheme.verified_at ? "" : `<button class="btn btn-soft btn-sm" data-verify-scheme="${scheme.id}">Verify information</button>`}` : ""}<label class="scheme-compare-check"><input type="checkbox" data-compare-scheme="${scheme.id}"> Compare</label>${scheme.verified_at ? `<button class="btn btn-outline btn-sm" data-ask-scheme="${scheme.id}">Ask scheme assistant</button>` : ""}</div>
  </article>`;
}
function reportsPage() {
  return `${heading("System-wide view", "Administration reports", `<button class="btn btn-outline" id="download-report">↓ Download CSV</button>`)}<div id="reports-content"><div class="panel">${empty("Loading the latest report…")}</div></div>`;
}
function officerIntelligencePage() {
  const panchayat = state.user.panchayat_name || "Your Gram Panchayat";
  return `${heading("Officer workspace", "SmartGram AI Intelligence Dashboard", `<span class="badge">${esc(panchayat)}</span>`)}
    <div class="stat-grid" id="intelligence-summary">${empty("Loading local complaint data…")}</div>
    <div class="grid-equal">
      <section class="panel"><div class="panel-head"><div><h2>Complaint Trends</h2><p class="panel-subtitle">Monthly reports, categories and unresolved issues.</p></div></div><div class="panel-body"><div id="intelligence-trends">${empty("Loading complaint trends…")}</div><div id="intelligence-categories"></div></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Image Detection</h2><p class="panel-subtitle">Review photos attached to local complaints. Analysis is advisory.</p></div></div><div class="panel-body"><div id="intelligence-images">${empty("Loading complaint photos…")}</div></div></section>
    </div>
    <section class="panel intelligence-recommendations"><div class="panel-head"><div><h2>AI Recommendations</h2><p class="panel-subtitle">Priorities based on open complaint patterns.</p></div><button class="btn btn-outline btn-sm" id="refresh-intelligence-recommendations">Refresh analysis</button></div><div class="panel-body" id="intelligence-recommendations">${empty("Preparing local recommendations…", "✳")}</div></section>
    <section class="panel intelligence-actions"><div class="panel-head"><div><h2>Officer Actions</h2><p class="panel-subtitle">Review open complaints and post a status update for residents.</p></div><button class="btn btn-outline btn-sm" data-goto="Complaints">All complaints</button></div><div id="intelligence-actions">${empty("Loading open complaints…")}</div></section>`;
}
function officersPage() {
  return `${heading("Access management", "Officer accounts", `<button class="btn btn-primary" id="add-officer">＋ Create officer account</button>`)}
    <div class="notice">Officer accounts can access complaint and service records only for their assigned Gram Panchayat. Administrator accounts are reserved for platform oversight.</div><section class="panel"><div class="panel-head"><div><h2>Platform accounts</h2><p class="panel-subtitle">Citizen and officer access overview.</p></div></div><div id="accounts-list">${empty("Loading accounts…")}</div></section>`;
}
function notificationsPage() {
  if (state.user.role === "officer") {
    return `${heading("Community updates", "Notifications", `<span class="badge">${esc(state.user.panchayat_name || "Your Gram Panchayat")}</span>`)}
      <section class="panel notification-compose-panel"><div class="panel-head"><div><h2>Send a Panchayat notice</h2><p class="panel-subtitle">This message will be sent to citizen accounts in your assigned Gram Panchayat.</p></div></div>
        <div class="panel-body"><form id="officer-notification-form" class="form-grid">
          <div class="field full"><label for="officer-notification-message">Notice message *</label><textarea class="textarea" id="officer-notification-message" name="message" rows="4" maxlength="1000" required placeholder="Share a service update, important date or community announcement."></textarea><small>Up to 1,000 characters. All citizens in ${esc(state.user.panchayat_name || "your Gram Panchayat")} will receive this in their notifications.</small></div>
          <div class="field full form-actions"><button class="btn btn-primary" type="submit">Send notification →</button></div>
        </form></div>
      </section>
      <section class="panel"><div class="panel-head"><div><h2>Recent notices</h2><p class="panel-subtitle">Notices sent to citizens in your Gram Panchayat.</p></div></div><div class="panel-body"><div id="officer-notification-history">${empty("Loading notices…", "♧")}</div></div></section>`;
  }
  return `${heading("Stay in the loop", "Notifications", `<button class="btn btn-outline" id="mark-read">Mark all as read</button>`)}<section class="panel"><div class="panel-head"><div><h2>Recent updates</h2><p class="panel-subtitle">Complaint progress updates sent by your Panchayat.</p></div></div><div class="panel-body"><div class="notification-list">${state.data.notifications.length ? state.data.notifications.map(n => `<div class="notification" style="${n.read ? "opacity:.67" : ""}">${n.read ? "" : '<span class="badge" style="margin-right:7px">New</span>'}${esc(n.message)}<time>${fmtDate(n.created_at)}</time></div>`).join("") : empty("No updates to show right now.", "♧")}</div></div></section>`;
}
function renderPage() {
  const content = document.getElementById("page-content");
  const pages = {
    Overview: overviewPage, Complaints: complaintsPage, "Issue map": mapPage,
    "Public budgets": budgetsPage, "Development works": projectsPage, "School services": schoolsPage,
    "Health camps": campsPage, "Scheme guide": schemePage, "Public satisfaction": satisfactionPage, Reports: reportsPage,
    "SmartGram AI Intelligence Dashboard": officerIntelligencePage,
    "Officer accounts": officersPage, "Panchayat directory": panchayatDirectoryPage, Notifications: notificationsPage
  };
  content.innerHTML = (pages[state.page] || overviewPage)();
  bindPageActions();
}
function bindPageActions() {
  document.getElementById("new-complaint")?.addEventListener("click", complaintModal);
  document.getElementById("add-budget")?.addEventListener("click", budgetModal);
  document.getElementById("add-project")?.addEventListener("click", projectModal);
  document.getElementById("add-school")?.addEventListener("click", schoolModal);
  document.getElementById("add-scheme")?.addEventListener("click", () => schemeModal());
  document.getElementById("add-camp")?.addEventListener("click", campModal);
  document.getElementById("add-officer")?.addEventListener("click", officerModal);
  document.getElementById("add-panchayat")?.addEventListener("click", () => panchayatModal());
  document.getElementById("get-suggestions")?.addEventListener("click", loadSuggestions);
  document.getElementById("refresh-intelligence-recommendations")?.addEventListener("click", loadIntelligenceRecommendations);
  document.getElementById("complaint-filter")?.addEventListener("change", renderComplaintList);
  document.querySelectorAll("[data-complaint]").forEach(button => button.addEventListener("click", () => {
    const complaint = state.data.complaints.find(c => c.id === Number(button.dataset.complaint));
    if (button.dataset.update === "true") updateComplaintModal(complaint);
    else showComplaintHistory(complaint);
  }));
  document.querySelectorAll("[data-assignment]").forEach(button => button.addEventListener("click", () => {
    const complaint = state.data.complaints.find(c => c.id === Number(button.dataset.assignment));
    if (complaint) assignComplaintModal(complaint);
  }));
  document.querySelectorAll("[data-goto]").forEach(button => button.addEventListener("click", () => { state.page = button.dataset.goto; renderApp(); }));
  document.querySelectorAll("[data-camp-register]").forEach(button => button.addEventListener("click", () => registerCamp(button.dataset.campRegister)));
  document.querySelectorAll("[data-camp-schedule]").forEach(button => button.addEventListener("click", () => campScheduleModal(button.dataset.campSchedule)));
  document.querySelectorAll("[data-inspect]").forEach(button => button.addEventListener("click", () => inspectionModal(button.dataset.inspect)));
  document.querySelectorAll("[data-rate-project]").forEach(button => button.addEventListener("click", () => projectFeedbackModal(button.dataset.rateProject)));
  document.querySelectorAll("[data-inspection-history]").forEach(button => button.addEventListener("click", () => showInspectionHistory(button.dataset.inspectionHistory)));
  document.getElementById("scheme-form")?.addEventListener("submit", submitScheme);
  document.getElementById("scheme-search")?.addEventListener("input", renderLocalSchemes);
  document.getElementById("scheme-category-filter")?.addEventListener("change", renderLocalSchemes);
  document.getElementById("compare-schemes")?.addEventListener("click", compareSelectedSchemes);
  document.getElementById("clear-scheme-history")?.addEventListener("click", clearSchemeHistory);
  document.querySelectorAll("[data-edit-scheme]").forEach(button => button.addEventListener("click", () => {
    const scheme = state.data.schemes.find(item => item.id === Number(button.dataset.editScheme));
    if (scheme) schemeModal(scheme);
  }));
  document.querySelectorAll("[data-verify-scheme]").forEach(button => button.addEventListener("click", () => verifyScheme(button.dataset.verifyScheme)));
  document.querySelectorAll("[data-ask-scheme]").forEach(button => button.addEventListener("click", () => schemeAssistantModal(button.dataset.askScheme)));
  document.querySelectorAll("[data-compare-scheme]").forEach(input => input.addEventListener("change", updateCompareButton));
  if (state.page === "Scheme guide") loadSchemeHistory();
  document.getElementById("mark-read")?.addEventListener("click", markNotifications);
  document.getElementById("officer-notification-form")?.addEventListener("submit", sendOfficerNotification);
  if (state.page === "Notifications" && state.user.role === "officer") loadOfficerNotifications();
  if (state.page === "Complaints") renderComplaintList();
  if (state.page === "Issue map") drawMap();
  if (state.page === "Reports") loadReports();
  if (state.page === "Officer accounts") loadAccounts();
  if (state.page === "Panchayat directory") bindPanchayatDirectory();
  if (state.page === "Public budgets") loadPublicBudgets();
  if (state.page === "Public satisfaction") loadSatisfactionReports();
  if (state.page === "SmartGram AI Intelligence Dashboard" && state.user.role === "officer") loadOfficerIntelligence();
}
async function loadOfficerIntelligence(loadRecommendations = true) {
  const summary = document.getElementById("intelligence-summary");
  if (!summary) return;
  try {
    const data = await api("/api/officer/intelligence");
    state.intelligence = data;
    summary.innerHTML =
      `${statCard("Total complaints", data.total_complaints, "Reports in your Panchayat", "☷")}${statCard("Needs attention", data.open_complaints, "Unresolved or in progress", "◷")}${statCard("Photo reports", data.image_count, "Photos attached to complaints", "▧")}${statCard("Active categories", data.categories.length, "Categories with reports", "⌖")}`;
    const trendPoints = data.monthly.map((item, index) => {
      const x = 44 + (index * 512 / Math.max(1, data.monthly.length - 1));
      const y = 145 - (item.count / Math.max(1, ...data.monthly.map(month => month.count))) * 105;
      return { ...item, x, y };
    });
    document.getElementById("intelligence-trends").innerHTML = trendPoints.length
      ? `<svg class="intelligence-chart" viewBox="0 0 600 205" role="img" aria-label="Line chart showing monthly complaint counts">
          <title>Monthly complaints over the last six months</title>
          ${[40, 75, 110, 145].map(y => `<line class="intelligence-chart-grid" x1="30" y1="${y}" x2="570" y2="${y}"></line>`).join("")}
          <polyline class="intelligence-chart-line" points="${trendPoints.map(point => `${point.x},${point.y}`).join(" ")}"></polyline>
          ${trendPoints.map(point => `<circle class="intelligence-chart-point" cx="${point.x}" cy="${point.y}" r="5"></circle><text class="intelligence-chart-value" x="${point.x}" y="${point.y - 12}">${point.count}</text><text class="intelligence-chart-label" x="${point.x}" y="174">${esc(point.label)}</text>`).join("")}
        </svg>`
      : empty("No monthly complaint data is available yet.");
    const categoryColors = ["#198754", "#25845D", "#9BC5A7"];
    const categoryTotal = data.categories.reduce((total, item) => total + item.count, 0);
    let categoryDegrees = 0;
    const categorySegments = data.categories.map((item, index) => {
      const start = categoryDegrees;
      categoryDegrees += categoryTotal ? item.count / categoryTotal * 360 : 0;
      return `${categoryColors[index % categoryColors.length]} ${start}deg ${categoryDegrees}deg`;
    });
    document.getElementById("intelligence-categories").innerHTML = data.categories.length
      ? `<div class="intelligence-category-list"><div class="intelligence-category-content">
          <div class="intelligence-doughnut" role="img" aria-label="Doughnut chart of complaint categories" style="background:conic-gradient(${categorySegments.join(",")})"></div>
          <div class="intelligence-category-legend">${data.categories.map((item, index) => `<div class="intelligence-category-item"><span class="intelligence-category-dot" style="background:${categoryColors[index % categoryColors.length]}"></span><span>${esc(item.category)}<br><small>${item.unresolved} unresolved</small></span><strong>${item.count}</strong></div>`).join("")}</div>
        </div></div>`
      : `<div class="intelligence-empty">${empty("No complaint categories to show.")}</div>`;
    document.getElementById("intelligence-images").innerHTML = data.image_complaints.length
      ? `<div class="intelligence-photo-list">${data.image_complaints.map(item => `<article class="intelligence-photo">
          <img src="/api/complaints/${item.id}/image" alt="Photo attached to complaint ${item.id}" loading="lazy">
          <div class="intelligence-photo-content"><div class="list-item-top"><strong>#${item.id} · ${esc(item.title)}</strong>${statusBadge(item.status)}</div>
            <div class="td-sub">${esc(item.category)} · ${esc(item.location)}</div>
            ${item.analysis_issue_type ? `<div class="intelligence-finding"><strong>AI finding:</strong> ${esc(item.analysis_issue_type)} <span class="badge">Confidence: ${esc(item.analysis_confidence)}</span><p>${esc(item.analysis_description)}</p><span class="td-sub">Analyzed ${fmtDate(item.analyzed_at)} · Verify before acting.</span></div>` : `<p class="td-sub intelligence-not-analyzed">No AI finding yet. Analysis sends this photo to the configured AI service.</p>`}
            <button class="btn btn-outline btn-sm" data-intelligence-analyze="${item.id}">${item.analysis_issue_type ? "Analyze again" : "Analyze photo"}</button>
          </div></article>`).join("")}</div>`
      : empty("No complaint photos have been uploaded for this Gram Panchayat.", "▧");
    document.getElementById("intelligence-actions").innerHTML = data.active_complaints.length
      ? table(data.active_complaints, [
        { label: "Complaint", render: item => `<div class="td-title">#${item.id} · ${esc(item.title)}</div><div class="td-sub">${esc(item.category)} · ${esc(item.location)}</div>` },
        { label: "Status", render: item => statusBadge(item.status) },
        { label: "Last updated", render: item => fmtDate(item.updated_at) },
        { label: "", render: item => `<button class="btn btn-outline btn-sm" data-intelligence-update="${item.id}">Review / update</button>` }
      ], "No open complaints.")
      : empty("No open complaints need officer action right now.", "✓");
    document.querySelectorAll("[data-intelligence-analyze]").forEach(button => button.addEventListener("click", async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Analyzing…";
      try {
        await api(`/api/officer/complaints/${button.dataset.intelligenceAnalyze}/image-analysis`, { method: "POST", body: JSON.stringify({}) });
        showToast("Photo findings saved for officer review.");
        await loadOfficerIntelligence(false);
      } catch (error) {
        showToast(error.message);
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }));
    document.querySelectorAll("[data-intelligence-update]").forEach(button => button.addEventListener("click", () => {
      const complaint = data.active_complaints.find(item => item.id === Number(button.dataset.intelligenceUpdate));
      if (complaint) updateComplaintModal(complaint);
    }));
    if (loadRecommendations) await loadIntelligenceRecommendations();
  } catch (error) {
    summary.innerHTML = `<div class="notice intelligence-load-error">${esc(error.message)}</div>`;
    document.getElementById("intelligence-trends").innerHTML = "";
    document.getElementById("intelligence-categories").innerHTML = "";
    document.getElementById("intelligence-images").innerHTML = "";
    document.getElementById("intelligence-actions").innerHTML = "";
  }
}
async function loadIntelligenceRecommendations() {
  const target = document.getElementById("intelligence-recommendations");
  if (!target) return;
  target.innerHTML = empty("Reviewing complaint patterns…", "✳");
  try {
    const report = await api("/api/ai/village-report", { method: "POST", body: JSON.stringify({}) });
    const priority = report.priority === "High" ? "high" : report.priority === "Medium" ? "medium" : "low";
    target.innerHTML = `<div class="intelligence-report-head"><div><div class="eyebrow">${esc(report.source)} · ${report.analyzed_complaints} active complaints</div><strong>${esc(report.summary)}</strong></div><span class="badge badge-${priority}">${esc(report.priority)}</span></div>
      ${report.issues.length ? `<div class="intelligence-recommendation-list">${report.issues.map(issue => `<article class="intelligence-recommendation"><div class="list-item-top"><strong>${esc(issue.detected_issue)}</strong><span class="badge badge-${issue.priority.toLowerCase()}">${esc(issue.priority)} priority</span></div><div class="td-sub">${esc(issue.village)} · ${esc(issue.category)} · ${issue.count} open report${issue.count === 1 ? "" : "s"}</div><ul>${issue.recommendations.map(item => `<li>${esc(item)}</li>`).join("")}</ul></article>`).join("")}</div>` : `<div class="intelligence-empty">${empty("There are no active complaints to inform development priorities.", "✳")}</div>`}
      <p class="field-note">${esc(report.review_note)}</p>`;
  } catch (error) {
    target.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  }
}
function renderLocalSchemes() {
  const search = document.getElementById("scheme-search");
  const category = document.getElementById("scheme-category-filter");
  const list = document.getElementById("local-schemes-list");
  if (!list) return;
  document.getElementById("scheme-comparison").replaceChildren();
  const query = search.value.trim().toLocaleLowerCase();
  const selectedCategory = category.value;
  const canManage = state.user.role !== "citizen";
  const schemes = (state.data.schemes || []).filter(scheme => {
    const text = `${scheme.title} ${scheme.description} ${scheme.eligibility} ${scheme.benefits} ${scheme.panchayat_name} ${scheme.category}`.toLocaleLowerCase();
    const matchesText = !query || text.includes(query);
    const matchesCategory = selectedCategory === "all" || scheme.category === selectedCategory ||
      (selectedCategory === "employment" && scheme.category === "livelihood");
    return matchesText && matchesCategory;
  });
  list.innerHTML = schemes.length ? schemes.map(scheme => schemeCard(scheme, canManage)).join("") :
    empty(query || selectedCategory !== "all" ? "No schemes match your search." : "No verified local scheme information has been published yet.", "◇");
  bindSchemeCardActions();
  updateCompareButton();
}
function bindSchemeCardActions() {
  document.querySelectorAll("[data-edit-scheme]").forEach(button => button.addEventListener("click", () => {
    const scheme = state.data.schemes.find(item => item.id === Number(button.dataset.editScheme));
    if (scheme) schemeModal(scheme);
  }));
  document.querySelectorAll("[data-verify-scheme]").forEach(button => button.addEventListener("click", () => verifyScheme(button.dataset.verifyScheme)));
  document.querySelectorAll("[data-ask-scheme]").forEach(button => button.addEventListener("click", () => schemeAssistantModal(button.dataset.askScheme)));
  document.querySelectorAll("[data-compare-scheme]").forEach(input => input.addEventListener("change", updateCompareButton));
}
function updateCompareButton() {
  const selected = [...document.querySelectorAll("[data-compare-scheme]:checked")];
  if (selected.length > 2) {
    selected[selected.length - 1].checked = false;
    showToast("Choose up to two schemes to compare.");
  }
  const button = document.getElementById("compare-schemes");
  if (button) button.disabled = document.querySelectorAll("[data-compare-scheme]:checked").length !== 2;
}
function compareSelectedSchemes() {
  const ids = [...document.querySelectorAll("[data-compare-scheme]:checked")].map(input => Number(input.dataset.compareScheme));
  const schemes = ids.map(id => state.data.schemes.find(item => item.id === id)).filter(Boolean);
  if (schemes.length !== 2) return showToast("Select exactly two schemes to compare.");
  const rows = [
    ["Category", scheme => scheme.category],
    ["Eligibility information", scheme => scheme.eligibility],
    ["Age criteria", scheme => `Minimum: ${scheme.min_age ?? "not specified"} · Maximum: ${scheme.max_age ?? "not specified"}`],
    ["Maximum annual household income", scheme => scheme.max_annual_income == null ? "Not specified" : currency(scheme.max_annual_income)],
    ["Benefits", scheme => scheme.benefits],
    ["Documents", scheme => scheme.documents],
    ["How to apply", scheme => scheme.application_info],
  ];
  document.getElementById("scheme-comparison").innerHTML = `<section class="scheme-comparison"><div class="list-item-top"><h2>Scheme comparison</h2><button class="btn btn-outline btn-sm" id="close-scheme-comparison">Close</button></div><div class="scheme-compare-grid"><div></div>${schemes.map(scheme => `<strong>${esc(scheme.title)}<span class="td-sub">${esc(scheme.panchayat_name)}</span></strong>`).join("")}${rows.map(([label, render]) => `<strong>${esc(label)}</strong>${schemes.map(scheme => `<div>${esc(render(scheme))}</div>`).join("")}`).join("")}</div></section>`;
  document.getElementById("close-scheme-comparison").addEventListener("click", () => {
    document.getElementById("scheme-comparison").replaceChildren();
  });
}
async function verifyScheme(id) {
  const button = document.querySelector(`[data-verify-scheme="${id}"]`);
  if (button) button.disabled = true;
  try {
    await api(`/api/schemes/${id}/verify`, { method: "POST", body: JSON.stringify({}) });
    await refresh();
    showToast("Scheme marked verified for citizen display.");
  } catch (error) {
    showToast(error.message);
    if (button) button.disabled = false;
  }
}
function voiceRecognitionError(error) {
  const messages = {
    "not-allowed": "Microphone access was denied. Allow microphone access or type your question.",
    "service-not-allowed": "This browser does not allow speech recognition. You can type instead.",
    "no-speech": "No speech was detected. Try again or type your question.",
    "audio-capture": "No microphone was found. Connect a microphone or type instead."
  };
  return messages[error] || `Speech recognition failed (${error}). You can type instead.`;
}
function listenForQuestion(language, onTranscript, onStateChange = () => {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return showToast("Speech recognition is not available in this browser. You can type instead.");
  state.voiceRecognition?.stop();
  const recognition = new SpeechRecognition();
  recognition.lang = language === "kn" ? "kn-IN" : "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state.voiceRecognition = recognition;
  recognition.onstart = () => onStateChange(true);
  recognition.onresult = event => onTranscript(event.results[0][0].transcript);
  recognition.onerror = event => showToast(voiceRecognitionError(event.error));
  recognition.onend = () => {
    if (state.voiceRecognition === recognition) state.voiceRecognition = null;
    onStateChange(false);
  };
  try {
    recognition.start();
    showToast(`Listening in ${language === "kn" ? "Kannada" : "English"}…`);
  } catch (error) {
    state.voiceRecognition = null;
    onStateChange(false);
    showToast(`Could not start voice input: ${error.message}`);
  }
}
function speakAssistantAnswer(text, language) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    showToast("Spoken playback is not available in this browser.");
    return false;
  }
  const languagePrefix = language === "kn" ? "kn" : "en";
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(item => item.lang.toLowerCase().startsWith(languagePrefix));
  if (language === "kn" && !voice) {
    showToast("A Kannada speech voice is not installed in this browser. You can still read the answer.");
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "kn" ? "kn-IN" : "en-IN";
  if (voice) utterance.voice = voice;
  utterance.onerror = () => showToast("The answer could not be played aloud. You can read it on screen.");
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
function voiceAssistantModal(initialId = "") {
  const schemes = (state.data.schemes || []).filter(item => item.verified_at);
  if (!schemes.length) return showToast("There are no verified local schemes to explain yet. You can still report a complaint using voice.");
  const options = schemes.map(scheme => `<option value="${scheme.id}" ${Number(initialId) === scheme.id ? "selected" : ""}>${esc(scheme.title)} · ${esc(scheme.panchayat_name)}</option>`).join("");
  modal("Voice assistant", "Ask about local schemes in English or Kannada.", `<div class="notice">Speak or type a question. Your browser transcribes speech, then SmartGram answers from the selected verified scheme record. Confirm current details with your Panchayat office.</div>
    <form id="scheme-assistant-form">
      ${selectField("Scheme information", "scheme_id", options)}
      <div class="voice-assistant-controls">
        <div class="field"><label for="assistant-language">Language</label><select class="select" id="assistant-language" name="language"><option value="en">English</option><option value="kn">ಕನ್ನಡ (Kannada)</option></select></div>
        <button class="btn btn-outline" type="button" id="assistant-mic">🎙 Ask by voice</button>
      </div>
      <div class="field"><label for="scheme-question">Your question</label><textarea id="scheme-question" name="question" class="textarea" required maxlength="500" rows="3" placeholder="Ask about benefits, documents or how to apply."></textarea></div>
      <div class="field-note">Voice transcription uses your browser's speech service. Audio is not stored by SmartGram. Kannada spoken answers require the optional AI service and an installed Kannada speech voice.</div>
      <button class="btn btn-primary" type="submit">Get an explanation →</button>
      <div id="scheme-assistant-answer" aria-live="polite"></div>
    </form>`);
  const form = document.getElementById("scheme-assistant-form");
  const mic = document.getElementById("assistant-mic");
  let submitAfterVoice = false;
  let receivedVoiceTranscript = false;
  mic.addEventListener("click", () => {
    submitAfterVoice = true;
    receivedVoiceTranscript = false;
    listenForQuestion(form.elements.language.value, transcript => {
      receivedVoiceTranscript = true;
      form.elements.question.value = transcript;
      form.requestSubmit();
    }, listening => {
      mic.disabled = listening;
      mic.textContent = listening ? "Listening…" : "🎙 Ask by voice";
      if (!listening && !receivedVoiceTranscript) submitAfterVoice = false;
    });
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const answerBox = document.getElementById("scheme-assistant-answer");
    const language = form.elements.language.value;
    const speakWhenReady = submitAfterVoice;
    submitAfterVoice = false;
    submit.disabled = true;
    answerBox.innerHTML = `<div class="empty">Preparing an explanation…</div>`;
    try {
      const result = await api("/api/schemes/assistant", {
        method: "POST",
        body: JSON.stringify({
          scheme_id: Number(form.elements.scheme_id.value),
          question: form.elements.question.value,
          language
        })
      });
      const answerText = Array.isArray(result.sections)
        ? result.sections.map(section => `${section.title}. ${section.text}`).join(". ")
        : result.answer;
      const canSpeak = result.language === language;
      const answerContent = Array.isArray(result.sections)
        ? `<div class="scheme-assistant-sections">${result.sections.map(section => `<section><strong>${esc(section.title)}</strong><p>${esc(section.text)}</p></section>`).join("")}</div>`
        : `<p>${esc(result.answer)}</p>`;
      const playback = canSpeak ? `<button class="btn btn-outline btn-sm" type="button" id="speak-scheme-answer">🔊 Listen to answer</button>` : `<div class="field-note">Kannada answers need the optional AI service; this local summary is in English.</div>`;
      answerBox.innerHTML = `<div class="scheme-assistant-answer"><div class="eyebrow">${esc(result.source)}</div>${answerContent}${result.advisory ? `<div class="field-note">${esc(result.advisory)}</div>` : ""}${playback}</div>`;
      document.getElementById("speak-scheme-answer")?.addEventListener("click", () => speakAssistantAnswer(answerText, result.language));
      if (speakWhenReady && canSpeak) speakAssistantAnswer(answerText, result.language);
    } catch (error) {
      answerBox.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
    } finally { submit.disabled = false; }
  });
}
function schemeAssistantModal(id) {
  voiceAssistantModal(id);
}
async function loadSchemeHistory() {
  const target = document.getElementById("scheme-history");
  if (!target) return;
  try {
    const { history } = await api("/api/schemes/history");
    target.innerHTML = history.length ? `<div class="list-stack">${history.map(item => `<article class="list-item"><div class="list-item-top"><strong>${esc(item.category === "all" ? "All categories" : item.category)}</strong><time class="td-sub">${fmtDate(item.created_at)}</time></div><p>Profile bands: ${esc(item.age_band)} years · ${esc(item.income_band)}</p><p>${item.results.map(result => `${esc(result.name)} — ${esc(result.match_status)}`).join("<br>")}</p></article>`).join("")}</div>` : empty("No previous checks yet.", "⌕");
  } catch (error) { target.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
async function clearSchemeHistory() {
  try {
    await api("/api/schemes/history", { method: "DELETE" });
    await loadSchemeHistory();
    showToast("Your scheme-check history was cleared.");
  } catch (error) { showToast(error.message); }
}
function renderComplaintList() {
  const filter = document.getElementById("complaint-filter")?.value;
  const rows = state.data.complaints.filter(c => !filter || c.status === filter);
  document.getElementById("complaint-list").innerHTML = complaintTable(rows, state.user.role !== "citizen");
  document.querySelectorAll("[data-complaint]").forEach(button => button.addEventListener("click", () => {
    const complaint = rows.find(c => c.id === Number(button.dataset.complaint));
    button.dataset.update === "true" ? updateComplaintModal(complaint) : showComplaintHistory(complaint);
  }));
  document.querySelectorAll("[data-assignment]").forEach(button => button.addEventListener("click", () => {
    const complaint = rows.find(c => c.id === Number(button.dataset.assignment));
    if (complaint) assignComplaintModal(complaint);
  }));
}
function drawMap() {
  const points = state.data.complaints.filter(c => c.latitude != null && c.longitude != null);
  if (!points.length || !window.L) return;
  state.map?.remove();
  state.map = L.map("issue-map").setView([points[0].latitude, points[0].longitude], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.map);
  const markers = points.map(c => L.marker([c.latitude, c.longitude]).bindPopup(`<strong>${esc(c.title)}</strong><br>${esc(c.category)} · ${esc(c.status)}<br>${esc(c.location)}${c.image_filename ? `<br><a href="/api/complaints/${c.id}/image" target="_blank" rel="noopener noreferrer">View attached photo</a>` : ""}`).addTo(state.map));
  if (markers.length > 1) state.map.fitBounds(L.featureGroup(markers).getBounds().pad(.15));
  setTimeout(() => state.map?.invalidateSize(), 50);
}
function complaintModal() {
  modal("Report a local issue", "Tell your Gram Panchayat what needs attention.", `<form id="complaint-form" class="form-grid">
    ${selectField("District", "district", `<option value="">Choose district</option>${districtOptions(state.user.district || "")}`)}
    <div class="field"><label for="panchayat_id">Gram Panchayat *</label><select class="select" id="panchayat_id" name="panchayat_id" required ${state.user.panchayat_id ? "disabled" : "disabled"}><option value="">Choose a district first</option></select></div>
    ${selectField("Service category", "category", `<option value="">Choose one</option><option>Village</option><option>School</option><option>Health</option>`)}
    ${field("Village / issue location", "location", "text", true, "Village or nearby landmark")}
    ${field("Short title", "title", "text", true, "e.g. Streetlight not working")}
    <div class="field" style="align-self:end"><label for="complaint-voice-language">Voice language</label><div class="voice-input-row"><select class="select" id="complaint-voice-language"><option value="en">English</option><option value="kn">ಕನ್ನಡ (Kannada)</option></select><button class="btn btn-outline btn-sm" type="button" id="voice-button">🎙 Speak</button></div><button class="btn btn-soft btn-sm" type="button" id="classify-button">✳ Suggest a category</button><span class="field-note">Your browser transcribes speech; review the text before sending. SmartGram does not store audio.</span></div>
    ${textArea("What is the problem?", "description", "Describe the issue and how it affects your community.", true, 4)}
    <div class="field full"><label for="problem-image">Problem photo <small>(optional · JPG, PNG, GIF or WebP · up to 5 MB)</small></label><input class="input" id="problem-image" name="image" type="file" accept="image/jpeg,image/png,image/gif,image/webp"><div id="image-preview" class="image-preview" hidden></div><div class="image-analysis-actions"><button class="btn btn-soft btn-sm" type="button" id="analyze-image" disabled>✳ Analyze photo with AI</button><span class="field-note">Suggestions require server AI configuration and must be reviewed.</span></div><div id="image-analysis-result"></div></div>
    <div class="field full"><div class="map-picker-heading"><label>Pin the problem location <small>(optional)</small></label><button class="btn btn-outline btn-sm" type="button" id="use-current-location">◎ Use my location</button></div><div id="complaint-location-map" class="map complaint-location-map"></div><div id="map-selection-note" class="field-note">Click the map to add a pin, or use your current location. The pin is shared with the complaint.</div></div>
    <div class="field"><label for="latitude">Latitude <small>(optional map pin)</small></label><input class="input" id="latitude" name="latitude" type="number" step="any" min="-90" max="90" placeholder="Select on map or enter manually"></div>
    <div class="field"><label for="longitude">Longitude <small>(optional map pin)</small></label><input class="input" id="longitude" name="longitude" type="number" step="any" min="-180" max="180" placeholder="Select on map or enter manually"></div>
    <div class="field full field-note">Only share a location appropriate for a public community report. Do not include sensitive personal information or photos of people without permission.</div>
    <div class="field full form-actions"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Submit report →</button></div></form>`);
  const form = document.getElementById("complaint-form"), district = form.elements.district, panchayat = form.elements.panchayat_id;
  if (state.user.panchayat_id) {
    district.value = state.user.district;
    district.disabled = true;
    panchayat.innerHTML = panchayatOptions(state.user.panchayat_id, state.user.district);
    panchayat.disabled = true;
  } else {
    district.addEventListener("change", () => { panchayat.innerHTML = `<option value="">Choose a Gram Panchayat</option>${panchayatOptions("", district.value)}`; panchayat.disabled = !district.value; });
  }
  form.querySelector("[data-close]").addEventListener("click", closeModal);
  form.querySelector("#voice-button").addEventListener("click", voiceInput);
  form.querySelector("#classify-button").addEventListener("click", classifyComplaint);
  form.querySelector("#analyze-image").addEventListener("click", analyzeComplaintImage);
  const locationMap = initializeComplaintLocationMap();
  state.complaintLocationMap = locationMap.map;
  form.querySelector("#use-current-location").addEventListener("click", () => {
    if (!navigator.geolocation) return showToast("Location is not available in this browser. You can pin the map or enter coordinates.");
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      form.elements.latitude.value = latitude.toFixed(6);
      form.elements.longitude.value = longitude.toFixed(6);
      locationMap.setPin(latitude, longitude, true);
      document.getElementById("map-selection-note").textContent = "Your current location is pinned. Check the marker before submitting.";
    }, error => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access was denied. You can pin the map or enter coordinates instead."
        : "Could not get your location. You can pin the map or enter coordinates instead.";
      showToast(message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  form.elements.latitude.addEventListener("change", () => {
    const lat = Number(form.elements.latitude.value), lon = Number(form.elements.longitude.value);
    if (form.elements.latitude.value && form.elements.longitude.value && Number.isFinite(lat) && Number.isFinite(lon)) locationMap.setPin(lat, lon, true);
  });
  form.elements.longitude.addEventListener("change", () => {
    const lat = Number(form.elements.latitude.value), lon = Number(form.elements.longitude.value);
    if (form.elements.latitude.value && form.elements.longitude.value && Number.isFinite(lat) && Number.isFinite(lon)) locationMap.setPin(lat, lon, true);
  });
  form.querySelector("#problem-image").addEventListener("change", previewComplaintImage);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const complaint = new FormData(form);
      complaint.set("panchayat_id", panchayat.value);
      await api("/api/complaints", { method: "POST", body: complaint });
      closeModal(); showToast("Your report has been sent to the Panchayat."); await refresh();
    } catch (error) { showToast(error.message); } finally { submit.disabled = false; }
  });
}
function initializeComplaintLocationMap() {
  const container = document.getElementById("complaint-location-map");
  if (!window.L) {
    container.innerHTML = '<div class="map-empty">Map could not be loaded. You can enter latitude and longitude below.</div>';
    return { map: null, setPin: () => {} };
  }
  const map = L.map(container).setView([15.3173, 75.7139], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  let marker = null;
  const setPin = (latitude, longitude, pan = false) => {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    if (!marker) {
      marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLatLng();
        document.getElementById("latitude").value = point.lat.toFixed(6);
        document.getElementById("longitude").value = point.lng.toFixed(6);
      });
    } else {
      marker.setLatLng([latitude, longitude]);
    }
    if (pan) map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
  };
  map.on("click", event => {
    setPin(event.latlng.lat, event.latlng.lng);
    document.getElementById("latitude").value = event.latlng.lat.toFixed(6);
    document.getElementById("longitude").value = event.latlng.lng.toFixed(6);
    document.getElementById("map-selection-note").textContent = "Location pinned. Drag the marker to adjust it.";
  });
  requestAnimationFrame(() => map.invalidateSize());
  return { map, setPin, remove: () => map.remove() };
}
function previewComplaintImage(event) {
  const file = event.currentTarget.files[0];
  const preview = document.getElementById("image-preview");
  const analysisButton = document.getElementById("analyze-image");
  const analysisResult = document.getElementById("image-analysis-result");
  analysisResult.replaceChildren();
  analysisButton.disabled = !file;
  if (!file) {
    preview.hidden = true;
    preview.replaceChildren();
    return;
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
    event.currentTarget.value = "";
    preview.hidden = true;
    preview.replaceChildren();
    showToast("Choose a JPG, PNG, GIF or WebP image up to 5 MB.");
    return;
  }
  const image = document.createElement("img");
  image.src = URL.createObjectURL(file);
  image.alt = "Preview of the problem photo";
  image.onload = () => URL.revokeObjectURL(image.src);
  preview.replaceChildren(image, Object.assign(document.createElement("span"), {
    textContent: `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`
  }));
  preview.hidden = false;
}
async function analyzeComplaintImage() {
  const input = document.getElementById("problem-image");
  const file = input.files[0];
  if (!file) return showToast("Choose a problem photo first.");
  const button = document.getElementById("analyze-image");
  const resultBox = document.getElementById("image-analysis-result");
  button.disabled = true;
  button.textContent = "Analyzing photo…";
  resultBox.replaceChildren();
  try {
    const formData = new FormData();
    formData.append("image", file);
    const result = await api("/api/complaints/analyze-image", { method: "POST", body: formData });
    resultBox.innerHTML = `<section class="image-analysis-card">
      <div class="list-item-top"><div><span class="eyebrow">${esc(result.source)}</span><strong>${esc(result.issue_type)}</strong></div><span class="badge badge-${result.confidence === "high" ? "resolved" : result.confidence === "medium" ? "medium" : "submitted"}">${esc(result.confidence)} confidence</span></div>
      <p>${esc(result.description)}</p><p class="field-note">${esc(result.advisory)}</p>
      <button class="btn btn-outline btn-sm" type="button" id="apply-image-suggestion">Use these suggestions</button>
    </section>`;
    document.getElementById("apply-image-suggestion").addEventListener("click", () => {
      document.getElementById("category").value = result.category;
      const title = document.getElementById("title");
      const description = document.getElementById("description");
      if (!title.value.trim()) title.value = result.title;
      if (!description.value.trim()) description.value = result.description;
      showToast("Photo suggestions applied. Review and edit before submitting.");
    });
  } catch (error) {
    resultBox.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  } finally {
    button.disabled = !input.files.length;
    button.textContent = "✳ Analyze photo with AI";
  }
}
async function classifyComplaint() {
  const text = `${document.getElementById("title").value} ${document.getElementById("description").value}`.trim();
  if (!text) return showToast("Add a short title or describe the issue first.");
  const button = document.getElementById("classify-button");
  button.disabled = true;
  try {
    const result = await api("/api/classify", { method: "POST", body: JSON.stringify({ text }) });
    document.getElementById("category").value = result.category;
    showToast(`${result.source}: ${result.category}. Please review the suggestion.`);
  } catch (error) { showToast(error.message); } finally { button.disabled = false; }
}
function voiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return showToast("Speech recognition is not available in this browser. You can type your report instead.");
  const recognition = new SpeechRecognition();
  const language = document.getElementById("complaint-voice-language")?.value || "en";
  recognition.lang = language === "kn" ? "kn-IN" : "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = event => {
    const description = document.getElementById("description");
    description.value = `${description.value}${description.value ? " " : ""}${event.results[0][0].transcript}`;
    description.focus();
    showToast("Voice transcription added. Please review it before submitting.");
  };
  recognition.onerror = event => showToast(voiceRecognitionError(event.error));
  recognition.onend = () => {
    if (state.voiceRecognition === recognition) state.voiceRecognition = null;
  };
  state.voiceRecognition = recognition;
  try {
    recognition.start();
    showToast(`Listening in ${language === "kn" ? "Kannada" : "English"}… speak your complaint now.`);
  } catch (error) {
    state.voiceRecognition = null;
    showToast(`Could not start voice input: ${error.message}`);
  }
}
async function updateComplaintModal(complaint) {
  let updates = [];
  try { updates = await api(`/api/complaints/${complaint.id}/updates`); } catch (error) { return showToast(error.message); }
  modal(`Update complaint #${complaint.id}`, complaint.title, `<div class="notice">Submitted by ${esc(complaint.reporter || state.user.name)} · ${esc(complaint.location)}<br>${esc(complaint.description)}</div>
    ${complaint.image_filename ? `<img class="complaint-photo" src="/api/complaints/${complaint.id}/image" alt="Photo attached to complaint ${complaint.id}">` : ""}
    ${complaint.feedback_rating ? `<div class="notice">Citizen resolution feedback: ${"★".repeat(complaint.feedback_rating)}${"☆".repeat(5 - complaint.feedback_rating)}${complaint.feedback_note ? `<br>${esc(complaint.feedback_note)}` : ""}</div>` : ""}
    <div class="list-stack" style="margin-bottom:15px">${updates.map(u => `<div class="list-item"><div class="list-item-top"><strong>${statusBadge(u.status)}</strong><span class="td-sub">${fmtDate(u.created_at)} · ${esc(u.updated_by)}</span></div><p>${esc(u.note)}</p></div>`).join("")}</div>
    <form id="update-form" class="form-grid">${selectField("New status", "status", STATUSES.map(s => `<option ${s === complaint.status ? "selected" : ""}>${s}</option>`).join(""))}${textArea("Action note", "note", "Share a clear, respectful progress update.", true, 3)}<div class="field full form-actions"><button class="btn btn-primary" type="submit">Save update →</button></div></form>`);
  bindForm("update-form", `/api/complaints/${complaint.id}`, "PATCH", "Complaint update shared.");
}
async function assignComplaintModal(complaint) {
  try {
    const officers = await api(`/api/complaints/${complaint.id}/officers`);
    if (!officers.length) return showToast("No officers are registered for this Gram Panchayat yet.");
    const options = officers.map(officer => `<option value="${officer.id}" ${officer.id === complaint.assigned_officer_id ? "selected" : ""}>${esc(officer.name)}${officer.id === state.user.id ? " (you)" : ""}</option>`).join("");
    modal(`Assign complaint #${complaint.id}`, complaint.title, `<div class="notice">Current assignee: ${esc(complaint.assigned_officer_name || "Not assigned")}</div><form id="assignment-form" class="form-grid">${selectField("Assign to officer", "officer_id", options)}<div class="field full form-actions"><button class="btn btn-primary" type="submit">Save assignment →</button></div></form>`);
    bindForm("assignment-form", `/api/complaints/${complaint.id}/assignment`, "PATCH", "Complaint assignment updated.", data => ({ officer_id: Number(data.officer_id) }));
  } catch (error) { showToast(error.message); }
}
async function showComplaintHistory(complaint) {
  try {
    const tracking = await api(`/api/complaints/${complaint.id}/tracking`);
    complaint = tracking.complaint;
    const updates = tracking.updates;
    const received = updates.find(update => update.status === "Submitted");
    const assigned = updates.slice().reverse().find(update => update.status === "Assigned");
    const workStarted = updates.find(update => update.status === "In progress");
    const resolved = updates.slice().reverse().find(update => update.status === "Resolved");
    const milestones = [
      ["Complaint received", received, true],
      ["Assigned to officer", assigned, Boolean(complaint.assigned_officer_id)],
      ["Work in progress", workStarted, Boolean(workStarted || resolved)],
      ["Resolved", resolved, complaint.status === "Resolved"]
    ];
    const timeline = `<ol class="complaint-timeline">${milestones.map(([label, event, complete]) => `<li class="${complete ? "complete" : ""}"><strong>${label}</strong><span>${event ? `${fmtDate(event.created_at)} · ${esc(event.updated_by)}` : complete && label === "Assigned to officer" ? esc(complaint.assigned_officer_name || "Assigned") : "Not yet reached"}</span></li>`).join("")}</ol>`;
    const feedbackSummary = complaint.feedback_rating ? `<div class="notice">Your feedback: ${"★".repeat(complaint.feedback_rating)}${"☆".repeat(5 - complaint.feedback_rating)}${complaint.feedback_note ? `<br>${esc(complaint.feedback_note)}` : ""}<br><small>Updated ${fmtDate(complaint.feedback_updated_at)}</small></div>` : "";
    const feedbackForm = state.user.role === "citizen" && complaint.status === "Resolved"
      ? `<form id="complaint-feedback-form" class="form-grid">${selectField("Rate the resolution (1–5)", "rating", [1, 2, 3, 4, 5].map(rating => `<option value="${rating}" ${Number(complaint.feedback_rating || 5) === rating ? "selected" : ""}>${rating} ${rating === 1 ? "star" : "stars"}</option>`).join(""))}<div class="field full"><label for="feedback-note">Feedback <small>(optional)</small></label><textarea class="textarea" id="feedback-note" name="note" rows="3" maxlength="1000" placeholder="Share how the resolution went.">${esc(complaint.feedback_note || "")}</textarea></div><div class="field full form-actions"><button class="btn btn-primary" type="submit">${complaint.feedback_rating ? "Update feedback" : "Send feedback"}</button></div></form>`
      : "";
    const unresolvedAction = state.user.role === "citizen" && complaint.status === "Resolved"
      ? `<div class="form-actions"><button class="btn btn-outline" type="button" id="report-unresolved">Report still unresolved</button></div>`
      : "";
    modal(`Track complaint #${complaint.id}`, complaint.title, `<div class="notice">${esc(complaint.category)} · ${esc(complaint.location)} · ${statusBadge(complaint.status)}<br><br>${esc(complaint.description)}<br><br>Assigned officer: ${esc(complaint.assigned_officer_name || "Awaiting assignment")}</div>${complaint.image_filename ? `<img class="complaint-photo" src="/api/complaints/${complaint.id}/image" alt="Photo attached to complaint ${complaint.id}">` : ""}<h3>Progress</h3>${timeline}<h3>Update history</h3><div class="list-stack">${updates.map(u => `<div class="list-item"><div class="list-item-top">${statusBadge(u.status)}<span class="td-sub">${fmtDate(u.created_at)}</span></div><p>${esc(u.note)} · ${esc(u.updated_by)}</p></div>`).join("") || empty("No updates have been recorded yet.")}</div>${feedbackSummary}${feedbackForm}${unresolvedAction}`);
    document.getElementById("report-unresolved")?.addEventListener("click", () => reopenComplaintModal(complaint.id));
    document.getElementById("complaint-feedback-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api(`/api/complaints/${complaint.id}/feedback`, { method: "PUT", body: JSON.stringify({ rating: Number(form.elements.rating.value), note: form.elements.note.value }) });
        closeModal();
        showToast("Thank you. Your resolution feedback was saved.");
        await refresh();
      } catch (error) { showToast(error.message); }
      finally { button.disabled = false; }
    });
  } catch (error) { showToast(error.message); }
}
function scopeSelector(id = "panchayat_id", selected = "") {
  return `<div class="field full"><label for="${id}">Gram Panchayat *</label><select class="select" name="${id}" id="${id}" required><option value="">Choose Gram Panchayat</option>${panchayatOptions(selected)}</select></div>`;
}
function budgetModal() {
  modal("Publish a budget update", "Share clear, factual public information.", `<form id="budget-form" class="form-grid">
    ${state.user.role === "admin" ? scopeSelector("panchayat_id") : `<input type="hidden" name="panchayat_id" value="${state.user.panchayat_id}"><div class="field full"><label>Assigned Gram Panchayat</label><div class="input">${esc(state.user.panchayat_name)}</div></div>`}
    ${field("Financial year", "financial_year", "text", true, "2025–26")}${field("Work / allocation title", "title", "text", true, "e.g. Village road improvement")}
    ${field("Allocated amount (₹)", "allocated", "number", true, "500000")}${field("Expenditure recorded (₹)", "spent", "number", true, "0")}
    ${field("Work progress (%)", "progress", "number", true, "0")}
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Publish budget information →</button></div></form>`);
  bindForm("budget-form", "/api/budgets", "POST", "Budget update published.", d => ({ ...d, allocated: Number(d.allocated), spent: Number(d.spent), progress: Number(d.progress) }));
}
function projectModal() {
  modal("Add development work", "Create a public record that can be updated with inspections.", `<form id="project-form" class="form-grid">
    ${state.user.role === "admin" ? scopeSelector() : `<input type="hidden" name="panchayat_id" value="${state.user.panchayat_id}"><div class="field full"><label>Assigned Gram Panchayat</label><div class="input">${esc(state.user.panchayat_name)}</div></div>`}
    ${field("Project title", "title", "text", true, "e.g. Community water point")}
    ${textArea("Description", "description", "What is planned? Keep details factual.", true, 3)}
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Add project →</button></div></form>`);
  bindForm("project-form", "/api/projects", "POST", "Development work added.");
}
function schoolModal() {
  modal("Add school information", "Record school facilities and community meal feedback.", `<form id="school-form" class="form-grid">
    ${state.user.role === "admin" ? scopeSelector() : `<input type="hidden" name="panchayat_id" value="${state.user.panchayat_id}"><div class="field full"><label>Assigned Gram Panchayat</label><div class="input">${esc(state.user.panchayat_name)}</div></div>`}
    ${field("School name", "name", "text", true, "School name")}${field("Village", "village", "text", true, "Village")}
    ${textArea("Facilities / infrastructure", "facilities", "Classrooms, drinking water, sanitation…", true, 3)}
    ${textArea("Midday-meal feedback", "meal_feedback", "Optional community feedback.", false, 3)}
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Save school information →</button></div></form>`);
  bindForm("school-form", "/api/schools", "POST", "School information saved.");
}
function schemeModal(scheme = null) {
  const editing = Boolean(scheme);
  const scope = editing
    ? `<input type="hidden" name="panchayat_id" value="${scheme.panchayat_id}"><div class="field full"><label>Gram Panchayat</label><div class="input">${esc(scheme.panchayat_name)} · ${esc(scheme.district)}</div></div>`
    : state.user.role === "admin" ? scopeSelector() : `<input type="hidden" name="panchayat_id" value="${state.user.panchayat_id}"><div class="field full"><label>Assigned Gram Panchayat</label><div class="input">${esc(state.user.panchayat_name)}</div></div>`;
  const categoryOptions = '<option value="">Choose category</option><option value="housing">Housing</option><option value="agriculture">Agriculture</option><option value="employment">Employment & livelihood</option><option value="health">Health</option><option value="education">Education</option><option value="water">Water & basic services</option><option value="other">Other</option>';
  const selectedCategory = scheme?.category === "livelihood" ? "employment" : scheme?.category || "";
  modal(editing ? "Edit local scheme information" : "Add local scheme information", editing
    ? "Updates clear its verified mark, so a staff member must verify it again before citizens see the change."
    : "Share a clear, current overview for residents. Do not promise eligibility or benefits.",
  `<form id="scheme-add-form" class="form-grid">
    ${scope}
    ${field("Scheme name", "title", "text", true, "Official scheme or service name", scheme?.title || "")}
    ${selectField("Category", "category", categoryOptions.replace(`value="${selectedCategory}"`, `value="${selectedCategory}" selected`))}
    ${textArea("Short description", "description", "What does this scheme or service offer?", true, 3)}
    ${textArea("Eligibility information", "eligibility", "Summarize official eligibility requirements. Mention that final eligibility must be verified.", true, 3)}
    ${field("Minimum age (optional)", "min_age", "number", false, "No minimum", scheme?.min_age ?? "")}
    ${field("Maximum age (optional)", "max_age", "number", false, "No maximum", scheme?.max_age ?? "")}
    ${field("Maximum annual household income (optional ₹)", "max_annual_income", "number", false, "No income limit entered", scheme?.max_annual_income ?? "")}
    ${textArea("Benefits", "benefits", "Describe benefits without guaranteeing approval.", true, 3)}
    ${textArea("Documents to ask about", "documents", "Separate documents with commas or new lines.", true, 3)}
    ${textArea("How to apply / Panchayat contact", "application_info", "Where should residents ask questions or apply? Include current office guidance.", true, 3)}
    ${field("Official information link", "official_url", "url", false, "https://…", scheme?.official_url || "")}
    <div class="field full field-note">Structured rules are advisory and must match the official scheme criteria. Scheme information stays hidden from citizens until verified by Panchayat staff.</div>
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">${editing ? "Save changes" : "Add scheme"} →</button></div></form>`);
  if (scheme) {
    const form = document.getElementById("scheme-add-form");
    ["description", "eligibility", "benefits", "documents", "application_info"].forEach(name => {
      form.elements[name].value = scheme[name] || "";
    });
  }
  bindForm("scheme-add-form", editing ? `/api/schemes/${scheme.id}` : "/api/schemes",
    editing ? "PATCH" : "POST", editing ? "Scheme updated. It needs verification again." : "Local scheme information added.");
}
function campModal() {
  modal("Publish a health camp", "Let residents know what is available and when.", `<form id="camp-form" class="form-grid">
    ${state.user.role === "admin" ? scopeSelector() : `<input type="hidden" name="panchayat_id" value="${state.user.panchayat_id}"><div class="field full"><label>Assigned Gram Panchayat</label><div class="input">${esc(state.user.panchayat_name)}</div></div>`}
    ${field("Camp name", "title", "text", true, "Community health check-up")}
    ${field("Date", "camp_date", "date")}${field("Start time", "start_time", "time")}
    ${field("End time", "end_time", "time")}
    ${field("Village / venue", "location", "text", true, "Village, venue")}
    ${field("Doctors / staff", "doctors", "text", true, "Staff details")}
    ${textArea("Available services", "services", "Consultations, screenings…", true, 3)}
    ${field("Maximum registrations", "capacity", "number", true, "50")}
    ${selectField("Appointment length", "slot_minutes", '<option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">60 minutes</option>')}
    ${field("People per appointment time", "slot_capacity", "number", true, "10")}
    <div class="field full field-note">Appointment times are created between the start and end times. The per-time capacity cannot exceed the camp’s maximum registrations.</div>
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Publish health camp →</button></div></form>`);
  bindForm("camp-form", "/api/camps", "POST", "Health camp published with appointment times.", d => ({
    ...d, capacity: Number(d.capacity), slot_minutes: Number(d.slot_minutes), slot_capacity: Number(d.slot_capacity)
  }));
}
function campScheduleModal(campId) {
  const camp = state.data.camps.find(item => item.id === Number(campId));
  if (!camp) return showToast("Health camp not found.");
  modal("Set appointment times", `Publish reservable times for ${camp.title}. Existing registrations will be assigned in order.`, `<div class="notice">Camp date: ${fmtDate(camp.camp_date)} · Maximum registrations: ${camp.capacity}</div><form id="camp-schedule-form" class="form-grid">
    ${field("Start time", "start_time", "time", true, "", camp.start_time || "")}
    ${field("End time", "end_time", "time", true, "", camp.end_time || "")}
    ${selectField("Appointment length", "slot_minutes", `<option value="15" ${camp.slot_minutes === 15 ? "selected" : ""}>15 minutes</option><option value="30" ${camp.slot_minutes === 30 ? "selected" : ""}>30 minutes</option><option value="60" ${camp.slot_minutes === 60 ? "selected" : ""}>60 minutes</option>`)}
    ${field("People per appointment time", "slot_capacity", "number", true, "10", camp.slot_capacity || 10)}
    <div class="field full field-note">Schedule changes are disabled after appointments have been reserved.</div>
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Publish appointment times →</button></div></form>`);
  bindForm("camp-schedule-form", `/api/camps/${campId}/schedule`, "PATCH", "Appointment times are ready for registration.", d => ({
    ...d, slot_minutes: Number(d.slot_minutes), slot_capacity: Number(d.slot_capacity)
  }));
}
function inspectionModal(projectId) {
  modal("Record a work inspection", "Keep notes objective and include evidence links only when they are public and appropriate.", `<form id="inspection-form" class="form-grid">
    ${selectField("Project status", "status", ["Planned", "In progress", "Completed", "Needs attention"].map(s => `<option>${s}</option>`).join(""))}
    ${field("Observed progress (%)", "progress", "number", true, "e.g. 35")}
    ${textArea("Inspection notes", "notes", "What was observed? What follow-up is needed?", true, 3)}
    ${field("Evidence link", "evidence_url", "url", false, "https://…")}
    ${textArea("Citizen feedback", "citizen_feedback", "Optional feedback for this work.", false, 2)}
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Save inspection →</button></div></form>`);
  bindForm("inspection-form", `/api/projects/${projectId}/inspections`, "POST", "Inspection recorded.", d => ({ ...d, progress: Number(d.progress) }));
}
async function showInspectionHistory(projectId) {
  try {
    const rows = await api(`/api/projects/${projectId}/inspections`);
    modal("Inspection history", "Development work notes and public follow-up.", rows.length ? `<div class="list-stack">${rows.map(i => `<div class="list-item"><div class="list-item-top"><strong>${i.progress}% complete</strong><span class="td-sub">${fmtDate(i.created_at)} · ${esc(i.inspector)}</span></div><p>${esc(i.notes)}</p>${i.evidence_url ? `<p><a href="${esc(i.evidence_url)}" target="_blank" rel="noopener noreferrer">Open evidence link ↗</a></p>` : ""}${i.citizen_feedback ? `<p>Community feedback: ${esc(i.citizen_feedback)}</p>` : ""}</div>`).join("")}</div>` : empty("No inspection notes have been added yet."));
  } catch (error) { showToast(error.message); }
}
function officerModal() {
  modal("Create an officer account", "The account can access one assigned Panchayat only.", `<form id="officer-form" class="form-grid">
    ${field("Officer name", "name", "text", true, "Full name")}${field("Email address", "email", "email", true, "officer@example.org")}
    ${field("Temporary password (10+ characters)", "password", "password", true, "Set a temporary password")}
    ${selectField("District", "district", `<option value="">Choose a district</option>${districtOptions()}`)}
    <div class="field"><label for="taluk">Taluk *</label><select class="select" id="taluk" name="taluk" required disabled><option value="">Choose a district first</option></select></div>
    <div class="field full"><label for="panchayat_id">Gram Panchayat *</label><select class="select" id="panchayat_id" name="panchayat_id" required disabled><option value="">Choose a taluk first</option></select></div>
    <div class="field full form-actions"><button class="btn btn-primary" type="submit">Create officer account →</button></div></form>`);
  const form = document.getElementById("officer-form");
  const district = form.elements.district;
  const taluk = form.elements.taluk;
  const panchayat = form.elements.panchayat_id;
  district.addEventListener("change", () => {
    taluk.innerHTML = `<option value="">Choose a taluk</option>${talukOptions(district.value)}`;
    taluk.disabled = !district.value;
    panchayat.innerHTML = '<option value="">Choose a taluk first</option>';
    panchayat.disabled = true;
  });
  taluk.addEventListener("change", () => {
    panchayat.innerHTML = `<option value="">Choose a Gram Panchayat</option>${state.panchayats
      .filter(p => p.district === district.value && p.taluk === taluk.value)
      .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}`;
    panchayat.disabled = !taluk.value;
  });
  bindForm("officer-form", "/api/admin/officers", "POST", "Officer account created.");
}
async function loadSuggestions() {
  if (state.user.role === "admin") {
    modal("Choose a Gram Panchayat", "The report analyzes active complaints for one village jurisdiction.", `<form id="village-report-form" class="form-grid">
      ${selectField("District", "district", `<option value="">Choose a district</option>${districtOptions()}`)}
      <div class="field"><label for="taluk">Taluk *</label><select class="select" id="taluk" name="taluk" required disabled><option value="">Choose a district first</option></select></div>
      <div class="field full"><label for="panchayat_id">Gram Panchayat *</label><select class="select" id="panchayat_id" name="panchayat_id" required disabled><option value="">Choose a taluk first</option></select></div>
      <div class="field full form-actions"><button class="btn btn-primary" type="submit">Analyze complaints →</button></div></form>`);
    const form = document.getElementById("village-report-form");
    const district = form.elements.district;
    const taluk = form.elements.taluk;
    const panchayat = form.elements.panchayat_id;
    district.addEventListener("change", () => {
      taluk.innerHTML = `<option value="">Choose a taluk</option>${talukOptions(district.value)}`;
      taluk.disabled = !district.value;
      panchayat.innerHTML = '<option value="">Choose a taluk first</option>';
      panchayat.disabled = true;
    });
    taluk.addEventListener("change", () => {
      panchayat.innerHTML = `<option value="">Choose a Gram Panchayat</option>${state.panchayats
        .filter(item => item.district === district.value && item.taluk === taluk.value)
        .map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}`;
      panchayat.disabled = !taluk.value;
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const selectedPanchayat = panchayat.value;
      closeModal();
      fetchVillageReport(selectedPanchayat);
    });
    return;
  }
  fetchVillageReport(state.user.panchayat_id);
}
async function fetchVillageReport(panchayatId) {
  const box = document.getElementById("suggestions-box");
  if (!box) return;
  box.innerHTML = `<section class="panel" style="margin-bottom:17px"><div class="panel-body" style="padding-top:16px">${empty("Reviewing local complaint patterns…", "✳")}</div></section>`;
  try {
    const result = await api("/api/ai/village-report", {
      method: "POST", body: JSON.stringify({ panchayat_id: panchayatId })
    });
    const priorityClass = result.priority === "High" ? "high" : result.priority === "Medium" ? "medium" : "low";
    const issueCards = result.issues.length ? result.issues.map(issue => `<article class="village-issue">
      <div class="village-issue-head"><div><span class="eyebrow">${esc(issue.village)} · ${esc(issue.category)}</span><h3>${esc(issue.detected_issue)}</h3></div><span class="badge badge-${issue.priority.toLowerCase()}">${esc(issue.priority)} priority</span></div>
      <div class="village-issue-count">${issue.count} active complaint${issue.count === 1 ? "" : "s"} in this area</div>
      <ul>${issue.recommendations.map(recommendation => `<li>${esc(recommendation)}</li>`).join("")}</ul>
    </article>`).join("") : empty("There are no active complaints to analyze for this Gram Panchayat.", "✳");
    box.innerHTML = `<section class="panel village-report">
      <div class="panel-head"><div><div class="eyebrow">AI VILLAGE REPORT · ${esc(result.source)}</div><h2>${esc(result.panchayat.name)} · ${esc(result.panchayat.district)}</h2><p class="panel-subtitle">${esc(result.panchayat.taluk)} · ${result.analyzed_complaints} active complaints analyzed</p></div><span class="badge badge-${priorityClass}">${esc(result.priority)} priority</span></div>
      <div class="panel-body">
        <div class="village-summary"><div class="td-sub">DETECTED ISSUE</div><strong>${esc(result.detected_issue)}</strong><div class="td-sub" style="margin-top:7px">AFFECTED AREA</div><strong>${esc(result.affected_area)}</strong><p>${esc(result.summary)}</p></div>
        <div class="eyebrow" style="margin-top:18px">Recommended officer review</div>
        <div class="village-issues">${issueCards}</div>
        <p class="field-note" style="margin:14px 0 0">${esc(result.review_note)}</p>
      </div>
    </section>`;
  } catch (error) { box.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
async function registerCamp(id) {
  const button = document.querySelector(`[data-camp-register="${id}"]`);
  if (button) button.disabled = true;
  try {
    const suggestion = await api(`/api/camps/${id}/recommend-slot`, { method: "POST", body: JSON.stringify({}) });
    modal("Your suggested check-up time", suggestion.camp_title, `<div class="appointment-suggestion">
      <div class="eyebrow">${esc(suggestion.source)}</div>
      <div class="appointment-time">${esc(fmtAppointmentTime(suggestion.starts_at))}</div>
      <div class="td-sub">${esc(suggestion.location)} · ${suggestion.registered} of ${suggestion.capacity} places currently booked for this time</div>
      <p>${esc(suggestion.reason)}</p>
    </div><div class="notice">${esc(suggestion.advisory)}</div><div class="form-actions"><button class="btn btn-outline" type="button" data-close>Choose later</button><button class="btn btn-primary" type="button" id="confirm-camp-slot">Confirm this time →</button></div>`);
    document.querySelector("[data-close]").addEventListener("click", closeModal);
    document.getElementById("confirm-camp-slot").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try {
        await api(`/api/camps/${id}/register`, {
          method: "POST", body: JSON.stringify({ slot_id: suggestion.slot_id })
        });
        closeModal(); showToast(`Registered for ${fmtAppointmentTime(suggestion.starts_at)}.`); await refresh();
      } catch (error) {
        closeModal(); showToast(error.message);
        if (button) button.disabled = false;
        if (error.message.includes("full") || error.message.includes("available")) await registerCamp(id);
      }
    });
  } catch (error) {
    showToast(error.message);
    if (button) button.disabled = false;
  }
}
async function submitScheme(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const result = await api("/api/schemes/check", { method: "POST", body: JSON.stringify(getFormData(form)) });
    const results = result.results.length ? result.results.map(item => `<article class="scheme-match-card">
      <div class="list-item-top"><div><span class="badge ${item.match_status.startsWith("May not") ? "badge-high" : item.match_status.startsWith("May match") ? "badge-resolved" : "badge-medium"}">${esc(item.match_status)}</span><span class="badge">${esc(item.category)}</span><h3>${esc(item.name)}</h3></div>${item.panchayat_name ? `<span class="td-sub">${esc(item.panchayat_name)}</span>` : ""}</div>
      <p>${esc(item.guidance)}</p><ul>${item.match_reasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>
      ${item.benefits ? `<p><strong>Benefits:</strong> ${esc(item.benefits)}</p>` : ""}
      ${item.documents ? `<strong>Document checklist</strong><div class="document-checklist">${item.documents.split(/[\n,;]+/).map((text, index) => text.trim()).filter(Boolean).map((text, index) => `<label><input type="checkbox" data-result-doc="${item.scheme_id}-${index}"> ${esc(text.replace(/^[\s•*-]+/, ""))}</label>`).join("")}</div>` : ""}
      ${item.application_info ? `<p><strong>How to apply:</strong> ${esc(item.application_info)}</p>` : ""}
      ${item.scheme_id ? `<button class="btn btn-outline btn-sm" data-match-assistant="${item.scheme_id}">Ask scheme assistant</button>` : ""}
      <p class="field-note">${esc(item.note)}</p></article>`).join("") : empty("No scheme records match that category yet. Try another category or check with your local office.", "◇");
    document.getElementById("scheme-results").innerHTML = `<section class="panel scheme-results-panel"><div class="panel-head"><div><h2>Possible matches and recommendations</h2><p class="panel-subtitle">Broad profile used: ${esc(result.profile_used.age_band)} years · ${esc(result.profile_used.income_band)} · ${esc(result.profile_used.interest)}</p></div></div><div class="panel-body"><div class="scheme-match-list">${results}</div></div></section>`;
    document.querySelectorAll("[data-match-assistant]").forEach(button => button.addEventListener("click", () => schemeAssistantModal(button.dataset.matchAssistant)));
    await loadSchemeHistory();
  } catch (error) {
    showToast(error.message);
  } finally { submit.disabled = false; }
}
async function markNotifications() {
  try { await api("/api/notifications/read", { method: "POST" }); await refresh(); showToast("Notifications marked as read."); }
  catch (error) { showToast(error.message); }
}
async function loadOfficerNotifications() {
  const target = document.getElementById("officer-notification-history");
  if (!target) return;
  try {
    const announcements = await api("/api/officer/notifications");
    target.innerHTML = announcements.length
      ? `<div class="notification-list">${announcements.map(item => `<article class="notification"><div class="notification-message">${esc(item.message)}</div><time>Sent by ${esc(item.officer_name)} · ${fmtDate(item.created_at)} · ${item.recipient_count} citizen${item.recipient_count === 1 ? "" : "s"} notified</time></article>`).join("")}</div>`
      : empty("No notices have been sent yet.", "♧");
  } catch (error) {
    target.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  }
}
async function sendOfficerNotification(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const result = await api("/api/officer/notifications", {
      method: "POST",
      body: JSON.stringify({ message: form.elements.message.value })
    });
    form.reset();
    await loadOfficerNotifications();
    showToast(`Notification sent to ${result.recipient_count} citizen${result.recipient_count === 1 ? "" : "s"}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}
async function loadReports() {
  try {
    const report = await api("/api/admin/reports");
    const max = Math.max(1, ...report.by_panchayat.map(x => x.complaints));
    document.getElementById("reports-content").innerHTML = `<div class="stat-grid">${statCard("Accounts", report.totals.users, "Citizens, officers and admins", "♙")}${statCard("Complaints", report.totals.complaints, "All recorded reports", "☷")}${statCard("Budget entries", report.totals.budgets, "Published allocations", "▤")}${statCard("Development works", report.totals.projects, "Projects recorded", "⌁")}</div>
      <div class="grid-equal"><section class="panel"><div class="panel-head"><div><h2>Complaints by status</h2><p class="panel-subtitle">System-wide current status counts.</p></div></div><div class="panel-body">${report.complaints_by_status.length ? report.complaints_by_status.map(r => `<div style="margin:12px 0"><div class="list-item-top"><span>${statusBadge(r.status)}</span><strong>${r.count}</strong></div></div>`).join("") : empty("No complaint activity yet.")}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Complaints by service</h2><p class="panel-subtitle">The categories chosen by residents.</p></div></div><div class="panel-body">${report.complaints_by_category.length ? report.complaints_by_category.map(r => `<div style="margin:12px 0"><div class="list-item-top"><span>${esc(r.category)}</span><strong>${r.count}</strong></div></div>`).join("") : empty("No category data yet.")}</div></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Most active Panchayats</h2><p class="panel-subtitle">Complaint counts for Panchayats with reported activity.</p></div></div>${table(report.by_panchayat, [{ label: "Gram Panchayat", render: r => `<div class="td-title">${esc(r.name)}</div><div class="td-sub">${esc(r.district)}</div>` }, { label: "Complaints", key: "complaints" }, { label: "Resolved", key: "resolved" }, { label: "Resolution rate", render: r => `${r.complaints ? Math.round(r.resolved / r.complaints * 100) : 0}%` }], "No Panchayat activity yet.")}</section>`;
    document.getElementById("download-report").onclick = () => {
      const csvRows = [["Gram Panchayat", "District", "Complaints", "Resolved"], ...report.by_panchayat.map(r => [r.name, r.district, r.complaints, r.resolved])];
      const blob = new Blob([csvRows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "smartgram-panchayat-report.csv"; link.click(); URL.revokeObjectURL(link.href);
    };
  } catch (error) { document.getElementById("reports-content").innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
async function loadAccounts() {
  try {
    const users = await api("/api/admin/users");
    document.getElementById("accounts-list").innerHTML = table(users, [
      { label: "Account", render: u => `<div class="td-title">${esc(u.name)}</div><div class="td-sub">${esc(u.email)}</div>` },
      { label: "Role", render: u => `<span class="badge">${esc(u.role)}</span>` },
      { label: "Assigned Panchayat", render: u => u.panchayat_name ? esc(u.panchayat_name) : "Platform-wide" }
    ], "No accounts available.");
  } catch (error) { document.getElementById("accounts-list").innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
async function logout() {
  await api("/api/logout", { method: "POST" });
  state.user = null; state.data = null; state.page = "Overview"; state.authMode = "login";
  renderAuth();
}
async function init() {
  try {
    const [directory, me] = await Promise.all([api("/api/panchayats"), api("/api/me")]);
    state.panchayats = directory;
    if (me.user) await refresh();
    else renderAuth();
  } catch (error) {
    appRoot.innerHTML = `<main class="auth-form-side"><section class="auth-card"><div class="eyebrow">SMARTGRAM</div><h2>We couldn't start the portal</h2><p>${esc(error.message)}</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></section></main>`;
  }
}
init();
