const $ = (s) => document.querySelector(s),
  money = (v) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  now = new Date(),
  current = now.toISOString().slice(0, 7);
let entries = JSON.parse(localStorage.getItem("meuFinanceiro") || "[]"),
  payments = JSON.parse(
    localStorage.getItem("meuFinanceiroPayments") ||
      '["Dinheiro","PIX","Cartão de crédito","Cartão de débito"]',
  ),
  categories = JSON.parse(
    localStorage.getItem("meuFinanceiroCategories") ||
      '{"despesa":["Alimentação","Moradia","Transporte","Saúde"],"receita":["Salário","Freelance","Outros"],"investimento":["Renda fixa","Ações","Fundos"]}',
  ),
  filter = "all";
entries = entries.map((x) =>
  x.type === "fatura"
    ? {
        ...x,
        type: "despesa",
        status: "unpaid",
        paymentMethod: "Cartão de crédito",
      }
    : { ...x, status: x.type === "despesa" ? x.status || "paid" : x.status },
);
const inMonth = (x, m) => x.date.slice(0, 7) === m,
  sum = (a) => a.reduce((n, x) => n + x.amount, 0),
  notice = (t) => {
    $("#toast").textContent = t;
    $("#toast").classList.add("show");
    setTimeout(() => $("#toast").classList.remove("show"), 2200);
  };
function chart(income, expenses, result) {
  const balance = Math.abs(result);
  const total = income + expenses + balance;

  if (!total) {
    $("#monthChart").innerHTML =
      '<p class="chart-empty">Adicione movimentações para visualizar o resumo.</p>';
    return;
  }

  const incomeEnd = (income / total) * 100;
  const expenseEnd = incomeEnd + (expenses / total) * 100;
  const balanceLabel = result < 0 ? "Saldo negativo" : "Saldo líquido";
  const balanceColor = result < 0 ? "#d94d59" : "#4c8ee7";
  const gradient = `conic-gradient(#23b981 0 ${incomeEnd}%, #ef6267 ${incomeEnd}% ${expenseEnd}%, ${balanceColor} ${expenseEnd}% 100%)`;

  $("#monthChart").innerHTML = `
    <div class="pie" style="background:${gradient}">
      <div class="pie-center">
        <span>${balanceLabel}</span>
        <strong>${money(result)}</strong>
      </div>
    </div>
    <div class="pie-legend">
      <div><i class="income-dot"></i><span>Receitas</span><b>${money(income)}</b></div>
      <div><i class="expense-dot"></i><span>Despesas pagas</span><b>${money(expenses)}</b></div>
      <div><i class="${result < 0 ? "negative" : "balance-slice"}"></i><span>${balanceLabel}</span><b>${money(result)}</b></div>
    </div>`;
}
function totals() {
  let a = entries.filter((x) => inMonth(x, $("#dashboardMonth").value)),
    income = sum(a.filter((x) => x.type === "receita")),
    paid = sum(a.filter((x) => x.type === "despesa" && x.status === "paid")),
    unpaid = sum(
      a.filter((x) => x.type === "despesa" && x.status === "unpaid"),
    ),
    invest = sum(a.filter((x) => x.type === "investimento")),
    result = income - paid - invest;
  $("#incomeTotal").textContent = money(income);
  $("#expenseTotal").textContent = money(paid);
  $("#billTotal").textContent = money(unpaid);
  $("#investmentTotal").textContent = money(invest);
  $("#balance").textContent = money(result);
  $("#balanceHint").textContent =
    result < 0
      ? "Atenção: você ficou no vermelho neste mês."
      : "Você está no positivo neste mês.";
  $(".balance").classList.toggle("negative", result < 0);
  $("#monthStatus").textContent = unpaid
    ? `${money(unpaid)} pendente${unpaid === 1 ? "" : "s"}.`
    : "Sem despesas pendentes.";
  $("#summaryMessage").textContent = a.length
    ? `Resultado do mês: ${money(result)}. Despesas não pagas aparecem separadamente.`
    : "Nenhuma movimentação no mês selecionado.";
  chart(income, paid, result);
}
function card(x) {
  let icon = { receita: "↗", despesa: "↘", investimento: "◈" }[x.type],
    parcel =
      x.installmentTotal > 1
        ? ` · ${x.installmentNumber}/${x.installmentTotal}`
        : "",
    yieldText = x.yieldRate
      ? ` · rendimento: ${x.yieldRate}% (${money((x.amount * x.yieldRate) / 100)})`
      : "";
  return `<article class="record ${x.type}"><i>${icon}</i><div><strong>${x.description}</strong><small>${x.category} · ${new Date(x.date + "T12:00").toLocaleDateString("pt-BR")}${parcel}${x.paymentMethod ? " · " + x.paymentMethod : ""}${yieldText}</small></div>${x.type === "despesa" ? `<button class="status ${x.status}" data-toggle="${x.id}">${x.status === "paid" ? "Paga" : "Não paga"}</button>` : ""}<b>${x.type === "receita" ? "+ " : "− "}${money(x.amount)}</b><button data-delete="${x.id}">×</button></article>`;
}
function ui() {
  let t = $("#entryType").value;
  $("#paymentMethod").innerHTML = payments
    .map((x) => `<option>${x}</option>`)
    .join("");
  $("#paymentList").innerHTML = payments
    .map(
      (x, i) =>
        `<div class="payment-item">${x}<button data-payment="${i}">×</button></div>`,
    )
    .join("");
  $("#category").innerHTML = (categories[t] || [])
    .map((x) => `<option>${x}</option>`)
    .join("");
  $("#categoryList").innerHTML = Object.entries(categories)
    .flatMap(([type, list]) =>
      list.map(
        (x, i) =>
          `<div class="payment-item"><span>${type}: ${x}</span><button data-category-delete="${type}|${i}">×</button></div>`,
      ),
    )
    .join("");
}
function render() {
  entries.sort((a, b) => b.date.localeCompare(a.date));
  let m = $("#expenseMonth").value,
    a = entries.filter(
      (x) =>
        x.type === "despesa" &&
        inMonth(x, m) &&
        (filter === "all" || x.status === filter),
    );
  $("#despesaList").innerHTML =
    a.map(card).join("") ||
    '<p class="empty">Nenhuma despesa para este filtro e mês.</p>';
  ["receita", "investimento"].forEach(
    (t) =>
      ($("#" + t + "List").innerHTML =
        entries
          .filter((x) => x.type === t)
          .map(card)
          .join("") || '<p class="empty">Nenhum registro ainda.</p>'),
  );
  $("#recentList").innerHTML =
    entries.slice(0, 4).map(card).join("") ||
    '<p class="empty">Nenhuma movimentação registrada.</p>';
  ui();
  totals();
  localStorage.setItem("meuFinanceiro", JSON.stringify(entries));
  localStorage.setItem("meuFinanceiroPayments", JSON.stringify(payments));
  localStorage.setItem("meuFinanceiroCategories", JSON.stringify(categories));
}
function plusMonths(d, n) {
  let x = new Date(d + "T12:00");
  x.setMonth(x.getMonth() + n);
  return x.toISOString().slice(0, 10);
}
document.querySelectorAll("nav a").forEach(
  (a) =>
    (a.onclick = () => {
      document
        .querySelectorAll(".view")
        .forEach((x) => x.classList.remove("active"));
      $("#" + a.dataset.view).classList.add("active");
      document
        .querySelectorAll("nav a")
        .forEach((x) => x.classList.remove("on"));
      a.classList.add("on");
      $("#pageTitle").textContent = a.textContent;
    }),
);
document.querySelectorAll(".open").forEach(
  (b) =>
    (b.onclick = () => {
      let t = b.dataset.type;
      $("#entryForm").reset();
      $("#entryType").value = t;
      $("#formTitle").textContent = {
        receita: "Nova receita",
        despesa: "Nova despesa",
        investimento: "Novo investimento",
      }[t];
      $("#date").value = now.toISOString().slice(0, 10);
      $("#expenseFields").hidden = t !== "despesa";
      $("#investmentFields").hidden = t !== "investimento";
      $("#amountLabel").childNodes[0].nodeValue =
        t === "despesa" ? "Valor total (R$)" : "Valor (R$)";
      ui();
      $("#entryDialog").showModal();
    }),
);
$("#closeDialog").onclick = () => $("#entryDialog").close();
$("#entryForm").onsubmit = (e) => {
  e.preventDefault();
  let type = $("#entryType").value,
    amount = +$("#amount").value,
    base = {
      type,
      description: $("#description").value.trim(),
      category: $("#category").value,
      date: $("#date").value,
    },
    date = base.date;
  if (type === "investimento") base.yieldRate = +$("#yieldRate").value || 0;
  if (type === "despesa") {
    let total = Math.max(1, +$("#installments").value || 1),
      id = Date.now();
    for (let i = 0; i < total; i++)
      entries.push({
        ...base,
        id: id + i,
        date: plusMonths(date, i),
        amount: amount / total,
        status: $("#status").value,
        paymentMethod: $("#paymentMethod").value,
        installmentNumber: i + 1,
        installmentTotal: total,
      });
  } else entries.push({ ...base, id: Date.now(), amount });
  render();
  $("#entryDialog").close();
  notice("Movimentação salva com sucesso!");
};
document.addEventListener("click", (e) => {
  if (e.target.dataset.delete) {
    entries = entries.filter((x) => x.id != e.target.dataset.delete);
    render();
  }
  if (e.target.dataset.toggle) {
    let x = entries.find((x) => x.id == e.target.dataset.toggle);
    x.status = x.status === "paid" ? "unpaid" : "paid";
    render();
    notice("Status atualizado.");
  }
  if (e.target.dataset.payment !== undefined) {
    payments.splice(+e.target.dataset.payment, 1);
    render();
  }
  if (e.target.dataset.categoryDelete) {
    let [t, i] = e.target.dataset.categoryDelete.split("|");
    categories[t].splice(+i, 1);
    render();
  }
});
$("#clearData").onclick = () => {
  if (confirm("Excluir todas as movimentações?")) {
    entries = [];
    render();
  }
};
document.querySelectorAll(".filter").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      document
        .querySelectorAll(".filter")
        .forEach((x) => x.classList.toggle("on", x === b));
      render();
    }),
);
["dashboardMonth", "expenseMonth"].forEach(
  (x) => ($("#" + x).onchange = render),
);
$("#paymentForm").onsubmit = (e) => {
  e.preventDefault();
  let p = $("#paymentName").value.trim();
  if (p && !payments.includes(p)) {
    payments.push(p);
    $("#paymentName").value = "";
    render();
    notice("Forma adicionada.");
  }
};
$("#categoryForm").onsubmit = (e) => {
  e.preventDefault();
  let t = $("#categoryType").value,
    c = $("#categoryName").value.trim();
  if (c && !categories[t].includes(c)) {
    categories[t].push(c);
    $("#categoryName").value = "";
    render();
    notice("Categoria adicionada.");
  }
};
$("#downloadReport").onclick = () => {
  let m = $("#reportMonth").value,
    a = entries.filter((x) => inMonth(x, m)),
    rows = [
      ["Relatório financeiro", m],
      [],
      ["Data", "Tipo", "Descrição", "Categoria", "Rendimento (%)", "Valor"],
      ...a.map((x) => [
        x.date,
        x.type,
        x.description,
        x.category,
        x.yieldRate || "",
        x.amount.toFixed(2),
      ]),
    ],
    csv =
      "\ufeff" +
      rows
        .map((r) =>
          r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"),
        )
        .join("\n"),
    url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-${m}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
["dashboardMonth", "expenseMonth", "reportMonth"].forEach(
  (x) => ($("#" + x).value = current),
);
render();
