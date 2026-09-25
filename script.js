const $ = (s) => document.querySelector(s);
const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const now = new Date();
const current = now.toISOString().slice(0, 7);
const supabase = window.supabase.createClient("https://sbwtvvtyjtzouokugrxb.supabase.co", "sb_publishable_ao5ts1bdB_9sSXpaL_HBKQ_e6jaVZ-N");
let authMode = "login";
let activeUser = null;
let entries = JSON.parse(localStorage.getItem("meuFinanceiro") || "[]");
let payments = JSON.parse(localStorage.getItem("meuFinanceiroPayments") || '["Dinheiro","PIX","Cartão de crédito","Cartão de débito"]');
let categories = JSON.parse(localStorage.getItem("meuFinanceiroCategories") || '{"despesa":["Alimentação","Moradia","Transporte","Saúde"],"receita":["Salário","Freelance","Outros"],"investimento":["Renda fixa","Ações","Fundos"]}');
let filter = "all";

entries = entries.map((entry) => entry.type === "fatura" ? { ...entry, type: "despesa", status: "unpaid", paymentMethod: "Cartão de crédito" } : { ...entry, status: entry.type === "despesa" ? entry.status || "paid" : entry.status });
const inMonth = (entry, month) => entry.date.slice(0, 7) === month;
const sum = (items) => items.reduce((total, item) => total + Number(item.amount), 0);
function notice(text) { $("#toast").textContent = text; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 2200); }
function save() { localStorage.setItem("meuFinanceiro", JSON.stringify(entries)); localStorage.setItem("meuFinanceiroPayments", JSON.stringify(payments)); localStorage.setItem("meuFinanceiroCategories", JSON.stringify(categories)); if (activeUser?.id) void syncRemote(); }
async function syncRemote() { const userId = activeUser.id; const { error: removeError } = await supabase.from("finance_entries").delete().eq("user_id", userId); if (removeError) return console.error(removeError); const rows = entries.map((entry) => ({ id: String(entry.id), user_id: userId, data: entry })); if (rows.length) { const { error } = await supabase.from("finance_entries").insert(rows); if (error) return console.error(error); } const { error } = await supabase.from("finance_settings").upsert({ user_id: userId, payments, categories }); if (error) console.error(error); }
async function loadRemote() { const [{ data: rows, error: entriesError }, { data: settings, error: settingsError }] = await Promise.all([supabase.from("finance_entries").select("data").eq("user_id", activeUser.id), supabase.from("finance_settings").select("payments,categories").eq("user_id", activeUser.id).maybeSingle()]); if (entriesError || settingsError) { notice("Não foi possível sincronizar seus dados agora."); return; } if (rows?.length) entries = rows.map((row) => row.data); else if (entries.length) await syncRemote(); if (settings) { payments = settings.payments || payments; categories = settings.categories || categories; } else await syncRemote(); }

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach((button) => button.classList.toggle("on", button.dataset.authMode === mode));
  $(".register-only").hidden = mode !== "register";
  $("#authName").required = mode === "register";
  $("#authSubmit").textContent = mode === "register" ? "Criar conta e entrar" : "Entrar na plataforma";
  $("#authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("#authMessage").textContent = "";
}
function showApp() {
  $("#authScreen").hidden = true; $("#app").hidden = false;
  $("#pageTitle").textContent = `Olá, ${(activeUser.name || activeUser.email).split(" ")[0]} 👋`;
  render();
}
document.querySelectorAll(".auth-tab").forEach((button) => button.onclick = () => setAuthMode(button.dataset.authMode));
$("#loginForm").onsubmit = (event) => {
  event.preventDefault();
  const email = $("#authEmail").value.trim().toLowerCase();
  const password = $("#authPassword").value;
  const users = JSON.parse(localStorage.getItem(authKey) || "[]");
  if (authMode === "register") {
    if (users.some((user) => user.email === email)) { $("#authMessage").textContent = "Já existe uma conta com este e-mail."; return; }
    activeUser = { name: $("#authName").value.trim(), email, password };
    users.push(activeUser); localStorage.setItem(authKey, JSON.stringify(users));
  } else {
    activeUser = users.find((user) => user.email === email && user.password === password);
    if (!activeUser) { $("#authMessage").textContent = "E-mail ou senha não encontrados. Crie uma conta para continuar."; return; }
  }
  localStorage.setItem("meuFinanceiroSession", JSON.stringify(activeUser)); showApp();
};
$("#logout").onclick = () => { localStorage.removeItem("meuFinanceiroSession"); activeUser = null; $("#app").hidden = true; $("#authScreen").hidden = false; $("#loginForm").reset(); setAuthMode("login"); };

async function showApp() {
  document.body.classList.remove("login-open");
  $("#authScreen").hidden = true; $("#app").hidden = false;
  $("#pageTitle").textContent = `Olá, ${(activeUser.name || activeUser.email).split(" ")[0]} 👋`;
  await loadRemote();
  render();
}
$("#loginForm").onsubmit = async (event) => {
  event.preventDefault();
  const email = $("#authEmail").value.trim().toLowerCase();
  const password = $("#authPassword").value;
  if (authMode === "register") {
    const name = $("#authName").value.trim();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) { $("#authMessage").textContent = error.message; return; }
    if (!data.session) { $("#authMessage").textContent = "Conta criada. Confirme seu e-mail para entrar."; return; }
    activeUser = { id: data.user.id, email, name };
    await supabase.from("profiles").upsert({ id: activeUser.id, name });
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { $("#authMessage").textContent = "E-mail ou senha inválidos."; return; }
    activeUser = { id: data.user.id, email: data.user.email, name: data.user.user_metadata.name || data.user.email };
  }
  await supabase.from("profiles").upsert({ id: activeUser.id, name: activeUser.name || "" });
  await showApp();
};
$("#logout").onclick = async () => { await supabase.auth.signOut(); activeUser = null; document.body.classList.add("login-open"); $("#app").hidden = true; $("#authScreen").hidden = false; $("#loginForm").reset(); setAuthMode("login"); };

function chart(income, paid, investments, result) {
  const movements = [{ label: "Receitas", value: income, color: "#23b981" }, { label: "Despesas pagas", value: paid, color: "#ef6267" }, { label: "Investimentos", value: investments, color: "#4c8ee7" }];
  const total = sum(movements);
  if (!total) { $("#monthChart").innerHTML = '<p class="chart-empty">Adicione movimentações para visualizar o resumo.</p>'; return; }
  let point = 0;
  const slices = movements.map((item) => { const start = point; point += item.value / total * 100; return `${item.color} ${start}% ${point}%`; }).join(", ");
  $("#monthChart").innerHTML = `<div class="pie" style="background:conic-gradient(${slices})"><div class="pie-center"><span>Saldo do mês</span><strong class="${result < 0 ? "negative-text" : ""}">${money(result)}</strong></div></div><div class="pie-legend">${movements.map((item) => `<div><i style="background:${item.color}"></i><span>${item.label}</span><b>${money(item.value)}</b><small>${Math.round(item.value / total * 100)}%</small></div>`).join("")}</div>`;
}
function totals() {
  const selected = entries.filter((entry) => inMonth(entry, $("#dashboardMonth").value));
  const income = sum(selected.filter((entry) => entry.type === "receita"));
  const paid = sum(selected.filter((entry) => entry.type === "despesa" && entry.status === "paid"));
  const unpaid = sum(selected.filter((entry) => entry.type === "despesa" && entry.status === "unpaid"));
  const investments = sum(selected.filter((entry) => entry.type === "investimento"));
  const result = income - paid - investments;
  $("#incomeTotal").textContent = money(income); $("#expenseTotal").textContent = money(paid); $("#billTotal").textContent = money(unpaid); $("#investmentTotal").textContent = money(investments); $("#balance").textContent = money(result);
  $("#balanceHint").textContent = result < 0 ? "Atenção: você ficou no vermelho neste mês." : "Você está no positivo neste mês.";
  $(".balance").classList.toggle("negative", result < 0);
  $("#monthStatus").textContent = unpaid ? `${money(unpaid)} em despesas pendentes.` : "Sem despesas pendentes.";
  $("#summaryMessage").textContent = selected.length ? `Saldo atual: ${money(result)}. O gráfico mostra a distribuição das movimentações registradas.` : "Nenhuma movimentação no mês selecionado.";
  chart(income, paid, investments, result);
}
function card(entry) {
  const icon = { receita: "↗", despesa: "↘", investimento: "◈" }[entry.type];
  const parcel = entry.installmentTotal > 1 ? ` · ${entry.installmentNumber}/${entry.installmentTotal}` : "";
  const yieldText = entry.yieldRate ? ` · rendimento: ${entry.yieldRate}% (${money(entry.amount * entry.yieldRate / 100)})` : "";
  const payment = entry.type === "despesa" ? `<button class="status ${entry.status}" data-toggle="${entry.id}" title="${entry.status === "paid" ? "Desfazer pagamento" : "Marcar como paga"}">${entry.status === "paid" ? "✓ Paga" : "Pagar agora"}</button>` : "";
  return `<article class="record ${entry.type}"><i>${icon}</i><div><strong>${entry.description}</strong><small>${entry.category} · ${new Date(entry.date + "T12:00").toLocaleDateString("pt-BR")}${parcel}${entry.paymentMethod ? " · " + entry.paymentMethod : ""}${yieldText}</small></div>${payment}<b>${entry.type === "receita" ? "+ " : "− "}${money(entry.amount)}</b><button aria-label="Excluir ${entry.description}" data-delete="${entry.id}">×</button></article>`;
}
function ui() {
  const type = $("#entryType").value;
  $("#paymentMethod").innerHTML = payments.map((item) => `<option>${item}</option>`).join("");
  $("#paymentList").innerHTML = payments.map((item, index) => `<div class="payment-item">${item}<button data-payment="${index}">×</button></div>`).join("");
  $("#category").innerHTML = (categories[type] || []).map((item) => `<option>${item}</option>`).join("");
  $("#categoryList").innerHTML = Object.entries(categories).flatMap(([type, list]) => list.map((item, index) => `<div class="payment-item"><span>${type}: ${item}</span><button data-category-delete="${type}|${index}">×</button></div>`)).join("");
}
function render() {
  entries.sort((a, b) => b.date.localeCompare(a.date));
  const month = $("#expenseMonth").value;
  const expenses = entries.filter((entry) => entry.type === "despesa" && inMonth(entry, month) && (filter === "all" || filter === "installments" ? (filter !== "installments" || entry.installmentTotal > 1) : entry.status === filter));
  $("#despesaList").innerHTML = expenses.map(card).join("") || '<p class="empty">Nenhuma despesa para este filtro e mês.</p>';
  ["receita", "investimento"].forEach((type) => $("#" + type + "List").innerHTML = entries.filter((entry) => entry.type === type).map(card).join("") || '<p class="empty">Nenhum registro ainda.</p>');
  $("#recentList").innerHTML = entries.slice(0, 4).map(card).join("") || '<p class="empty">Nenhuma movimentação registrada.</p>';
  ui(); totals(); save();
}
function plusMonths(date, amount) { const value = new Date(date + "T12:00"); value.setMonth(value.getMonth() + amount); return value.toISOString().slice(0, 10); }
document.querySelectorAll("nav a").forEach((link) => link.onclick = () => { document.querySelectorAll(".view").forEach((view) => view.classList.remove("active")); $("#" + link.dataset.view).classList.add("active"); document.querySelectorAll("nav a").forEach((item) => item.classList.remove("on")); link.classList.add("on"); $("#pageTitle").textContent = link.textContent; });
document.querySelectorAll(".open").forEach((button) => button.onclick = () => { const type = button.dataset.type; $("#entryForm").reset(); $("#entryType").value = type; $("#formTitle").textContent = ({ receita: "Nova receita", despesa: "Nova despesa", investimento: "Novo investimento" })[type]; $("#date").value = now.toISOString().slice(0, 10); $("#expenseFields").hidden = type !== "despesa"; $("#investmentFields").hidden = type !== "investimento"; $("#amountLabel").childNodes[0].nodeValue = type === "despesa" ? "Valor total (R$)" : "Valor (R$)"; ui(); $("#entryDialog").showModal(); });
$("#closeDialog").onclick = () => $("#entryDialog").close();
$("#entryForm").onsubmit = (event) => { event.preventDefault(); const type = $("#entryType").value; const amount = +$("#amount").value; const base = { type, description: $("#description").value.trim(), category: $("#category").value, date: $("#date").value }; if (type === "investimento") base.yieldRate = +$("#yieldRate").value || 0; if (type === "despesa") { const total = Math.max(1, +$("#installments").value || 1); const id = Date.now(); for (let index = 0; index < total; index++) entries.push({ ...base, id: id + index, date: plusMonths(base.date, index), amount: amount / total, status: $("#status").value, paymentMethod: $("#paymentMethod").value, installmentNumber: index + 1, installmentTotal: total }); } else entries.push({ ...base, id: Date.now(), amount }); render(); $("#entryDialog").close(); notice("Movimentação salva com sucesso!"); };
document.addEventListener("click", (event) => { const target = event.target; if (target.dataset.delete) { entries = entries.filter((entry) => entry.id != target.dataset.delete); render(); notice("Movimentação excluída."); } if (target.dataset.toggle) { const entry = entries.find((item) => item.id == target.dataset.toggle); entry.status = entry.status === "paid" ? "unpaid" : "paid"; render(); notice(entry.status === "paid" ? "Pagamento confirmado!" : "Pagamento desfeito."); } if (target.dataset.payment !== undefined) { payments.splice(+target.dataset.payment, 1); render(); } if (target.dataset.categoryDelete) { const [type, index] = target.dataset.categoryDelete.split("|"); categories[type].splice(+index, 1); render(); } });
$("#clearData").onclick = () => { if (confirm("Excluir todas as movimentações?")) { entries = []; render(); notice("Movimentações excluídas."); } };
document.querySelectorAll(".filter").forEach((button) => button.onclick = () => { filter = button.dataset.filter; document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("on", item === button)); render(); });
["dashboardMonth", "expenseMonth"].forEach((id) => $("#" + id).onchange = render);
$("#paymentForm").onsubmit = (event) => { event.preventDefault(); const payment = $("#paymentName").value.trim(); if (payment && !payments.includes(payment)) { payments.push(payment); $("#paymentName").value = ""; render(); notice("Forma adicionada."); } };
$("#categoryForm").onsubmit = (event) => { event.preventDefault(); const type = $("#categoryType").value; const category = $("#categoryName").value.trim(); if (category && !categories[type].includes(category)) { categories[type].push(category); $("#categoryName").value = ""; render(); notice("Categoria adicionada."); } };
$("#downloadReport").onclick = () => { const month = $("#reportMonth").value; const rows = [["Relatório financeiro", month], [], ["Data", "Tipo", "Descrição", "Categoria", "Status", "Parcelas", "Valor"], ...entries.filter((entry) => inMonth(entry, month)).map((entry) => [entry.date, entry.type, entry.description, entry.category, entry.status || "", entry.installmentTotal ? `${entry.installmentNumber}/${entry.installmentTotal}` : "", entry.amount.toFixed(2)])]; const csv = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `relatorio-${month}.csv`; link.click(); URL.revokeObjectURL(url); };
["dashboardMonth", "expenseMonth", "reportMonth"].forEach((id) => $("#" + id).value = current);
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) return;
  const user = session.user;
  activeUser = { id: user.id, email: user.email, name: user.user_metadata.name || user.email };
  showApp();
});
if (!activeUser) document.body.classList.add("login-open");
