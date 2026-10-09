import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CATEGORIES = {
  expense: ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Education", "Rent", "Other"],
  income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Other"]
};

let currentUser = null;
let transactions = [];
let budgets = [];
let editingId = null;
let currentType = "expense";
let charts = {};

// ---------- AUTH ----------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  document.getElementById("user-name").textContent = user.displayName || "User";
  document.getElementById("user-email").textContent = user.email;
  document.getElementById("avatar").textContent = (user.displayName || user.email)[0].toUpperCase();
  loadData();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// ---------- FIRESTORE LISTENERS ----------
function loadData() {
  // Transactions
  const txnQ = query(collection(db, "transactions"), where("uid", "==", currentUser.uid));
  onSnapshot(txnQ, (snap) => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderAll();
  });

  // Budgets
  const budQ = query(collection(db, "budgets"), where("uid", "==", currentUser.uid));
  onSnapshot(budQ, (snap) => {
    budgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBudgets();
  });
}

// ---------- NAVIGATION ----------
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    const view = item.dataset.view;

    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    document.getElementById(`view-${view}`).classList.remove("hidden");

    document.getElementById("view-title").textContent =
      view.charAt(0).toUpperCase() + view.slice(1);

    if (view === "analytics") renderAnalytics();
  });
});

// ---------- MODAL ----------
const modal = document.getElementById("modal");
const txnForm = document.getElementById("txn-form");
const amountInput = document.getElementById("txn-amount");
const descInput = document.getElementById("txn-desc");
const catSelect = document.getElementById("txn-category");
const dateInput = document.getElementById("txn-date");

function populateCategories(type) {
  catSelect.innerHTML = "";
  CATEGORIES[type].forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });
}

function openModal(txn = null) {
  editingId = txn?.id || null;
  currentType = txn?.type || "expense";
  document.getElementById("modal-title").textContent = txn ? "Edit Transaction" : "Add Transaction";

  document.querySelectorAll(".type-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.type === currentType)
  );
  populateCategories(currentType);

  amountInput.value = txn ? txn.amount : "";
  descInput.value = txn ? txn.description : "";
  catSelect.value = txn ? txn.category : CATEGORIES[currentType][0];
  dateInput.value = txn ? txn.date : new Date().toISOString().slice(0, 10);

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  txnForm.reset();
  editingId = null;
}

document.getElementById("open-modal").addEventListener("click", () => openModal());
document.getElementById("cancel-btn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentType = btn.dataset.type;
    document.querySelectorAll(".type-btn").forEach(b =>
      b.classList.toggle("active", b === btn)
    );
    populateCategories(currentType);
  });
});

// ---------- SAVE TRANSACTION ----------
txnForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    uid: currentUser.uid,
    type: currentType,
    amount: parseFloat(amountInput.value),
    description: descInput.value.trim(),
    category: catSelect.value,
    date: dateInput.value,
    createdAt: new Date().toISOString()
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "transactions", editingId), data);
    } else {
      await addDoc(collection(db, "transactions"), data);
    }
    closeModal();
  } catch (err) {
    alert("Error saving: " + err.message);
  }
});

// ---------- RENDER ----------
function renderAll() {
  renderStats();
  renderRecent();
  renderAllList();
}

function renderStats() {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? ((income - expense) / income * 100) : 0;

  document.getElementById("stat-balance").textContent = `₹${balance.toFixed(2)}`;
  document.getElementById("stat-income").textContent = `₹${income.toFixed(2)}`;
  document.getElementById("stat-expense").textContent = `₹${expense.toFixed(2)}`;
  document.getElementById("stat-savings").textContent = `${savingsRate.toFixed(0)}%`;
  document.getElementById("stat-count").textContent = `${transactions.length} transactions`;
}

function createTxnElement(t) {
  const li = document.createElement("li");
  li.className = `txn-item ${t.type}`;
  li.innerHTML = `
    <div class="txn-left">
      <div class="txn-icon">${t.type === "income" ? "↑" : "↓"}</div>
      <div>
        <p class="txn-desc">${escapeHtml(t.description)}</p>
        <small class="txn-meta">${t.category} • ${formatDate(t.date)}</small>
      </div>
    </div>
    <div class="txn-right">
      <span class="txn-amount ${t.type}">${t.type === "income" ? "+" : "-"}₹${t.amount.toFixed(2)}</span>
      <div class="txn-actions">
        <button class="icon-btn edit" title="Edit">✏️</button>
        <button class="icon-btn delete" title="Delete">🗑️</button>
      </div>
    </div>
  `;

  li.querySelector(".edit").addEventListener("click", () => openModal(t));
  li.querySelector(".delete").addEventListener("click", async () => {
    if (confirm("Delete this transaction?")) {
      await deleteDoc(doc(db, "transactions", t.id));
    }
  });

  return li;
}

function renderRecent() {
  const list = document.getElementById("recent-list");
  list.innerHTML = "";
  const recent = transactions.slice(0, 5);
  if (!recent.length) {
    list.innerHTML = `<p class="empty">No transactions yet. Add your first one!</p>`;
    return;
  }
  recent.forEach(t => list.appendChild(createTxnElement(t)));
}

function renderAllList() {
  const list = document.getElementById("all-list");
  const search = document.getElementById("search").value.toLowerCase();
  const typeFilter = document.getElementById("filter-type").value;
  const catFilter = document.getElementById("filter-category").value;
  const sortBy = document.getElementById("sort-by").value;

  // Populate category filter
  const catSelectFilter = document.getElementById("filter-category");
  if (catSelectFilter.options.length <= 1) {
    const allCats = [...new Set(transactions.map(t => t.category))];
    allCats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      catSelectFilter.appendChild(opt);
    });
  }

  let filtered = transactions.filter(t => {
    if (search && !t.description.toLowerCase().includes(search)) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (catFilter !== "all" && t.category !== catFilter) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === "date-desc") return new Date(b.date) - new Date(a.date);
    if (sortBy === "date-asc") return new Date(a.date) - new Date(b.date);
    if (sortBy === "amount-desc") return b.amount - a.amount;
    if (sortBy === "amount-asc") return a.amount - b.amount;
    return 0;
  });

  list.innerHTML = "";
  if (!filtered.length) {
    list.innerHTML = `<p class="empty">No matching transactions.</p>`;
    return;
  }
  filtered.forEach(t => list.appendChild(createTxnElement(t)));
}

// ---------- CHARTS ----------
function renderAnalytics() {
  const expenses = transactions.filter(t => t.type === "expense");

  // Category breakdown
  const catTotals = {};
  expenses.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  if (charts.category) charts.category.destroy();
  charts.category = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(catTotals),
      datasets: [{
        data: Object.values(catTotals),
        backgroundColor: ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6","#f97316"]
      }]
    },
    options: { plugins: { legend: { labels: { color: "#cbd5e1" } } } }
  });

  // Monthly trend (last 6 months)
  const months = [];
  const monthLabels = [];
  const incData = [];
  const expData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(key);
    monthLabels.push(d.toLocaleString("default", { month: "short" }));

    const monthTxns = transactions.filter(t => t.date.startsWith(key));
    incData.push(monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0));
    expData.push(monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  }

  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [
        { label: "Income", data: incData, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", tension: 0.4, fill: true },
        { label: "Expense", data: expData, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", tension: 0.4, fill: true }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#cbd5e1" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } }
      }
    }
  });
}

// Overview mini chart
function renderOverviewChart() {
  const expenses = transactions.filter(t => t.type === "expense");
  const catTotals = {};
  expenses.forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.amount);

  if (charts.overview) charts.overview.destroy();
  charts.overview = new Chart(document.getElementById("overviewChart"), {
    type: "pie",
    data: {
      labels: Object.keys(catTotals).length ? Object.keys(catTotals) : ["No data"],
      datasets: [{
        data: Object.values(catTotals).length ? Object.values(catTotals) : [1],
        backgroundColor: ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6"]
      }]
    },
    options: { plugins: { legend: { labels: { color: "#cbd5e1" } } } }
  });
}

// ---------- BUDGETS ----------
document.getElementById("add-budget").addEventListener("click", async () => {
  const category = prompt("Category (e.g. Food):");
  if (!category) return;
  const limit = parseFloat(prompt("Monthly limit (₹):"));
  if (!limit) return;

  await addDoc(collection(db, "budgets"), {
    uid: currentUser.uid,
    category,
    limit
  });
});

function renderBudgets() {
  const container = document.getElementById("budget-list");
  if (!budgets.length) {
    container.innerHTML = `<p class="empty">No budgets set. Click "New Budget" to get started.</p>`;
    return;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = transactions.filter(t =>
    t.type === "expense" && t.date.startsWith(currentMonth)
  );

  container.innerHTML = "";
  budgets.forEach(b => {
    const spent = monthExpenses
      .filter(t => t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    const pct = Math.min((spent / b.limit) * 100, 100);
    const over = spent > b.limit;

    const div = document.createElement("div");
    div.className = "budget-item";
    div.innerHTML = `
      <div class="budget-info">
        <span class="budget-cat">${b.category}</span>
        <span class="budget-nums ${over ? "over" : ""}">₹${spent.toFixed(0)} / ₹${b.limit}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-fill ${over ? "over" : ""}" style="width:${pct}%"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ---------- HELPERS ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Filters
document.getElementById("search").addEventListener("input", renderAllList);
document.getElementById("filter-type").addEventListener("change", renderAllList);
document.getElementById("filter-category").addEventListener("change", renderAllList);
document.getElementById("sort-by").addEventListener("change", renderAllList);

// Hook overview chart into render pipeline
const originalRenderAll = renderAll;
renderAll = function() {
  originalRenderAll();
  renderOverviewChart();
};