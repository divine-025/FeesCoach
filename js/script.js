// ==========================================
// APPLICATION STATE
// ==========================================

const CATEGORIES = [
  "Entertainment",
  "Software",
  "Fitness",
  "Utilities",
  "Education",
  "Gaming",
  "Productivity",
  "Other"
];

const state = {
  subscriptions: [],
  budget: {
    monthlyBudget: null
  }
};

// Tracks which subscription is currently being edited or deleted.
// null means "no subscription targeted" (e.g., we're adding a new one).
let editingSubscriptionId = null;
let deletingSubscriptionId = null;

// ==========================================
// DOM ELEMENTS
// ==========================================

const dom = {
  addSubscriptionBtn: document.getElementById("add-subscription-btn"),

  summaryMonthlySpend: document.getElementById("summary-monthly-spend"),
  summaryActiveCount: document.getElementById("summary-active-count"),
  summaryBudgetStatus: document.getElementById("summary-budget-status"),

  editBudgetBtn: document.getElementById("edit-budget-btn"),
  budgetPanelContent: document.getElementById("budget-panel-content"),
  budgetEmptyState: document.getElementById("budget-empty-state"),
  budgetProgressBar: document.getElementById("budget-progress-bar"),
  budgetProgressFill: document.getElementById("budget-progress-fill"),
  budgetSummaryText: document.getElementById("budget-summary-text"),
  budgetStatusBadge: document.getElementById("budget-status-badge"),
  budgetForm: document.getElementById("budget-form"),
  budgetInput: document.getElementById("budget-input"),
  budgetInputError: document.getElementById("budget-input-error"),
  cancelBudgetBtn: document.getElementById("cancel-budget-btn"),

  renewalsList: document.getElementById("renewals-list"),
  renewalsEmpty: document.getElementById("renewals-empty"),
  trialsPanel: document.getElementById("trials-panel"),
  trialsList: document.getElementById("trials-list"),

  chartContainer: document.getElementById("chart-container"),
  chartLegend: document.getElementById("chart-legend"),
  chartEmpty: document.getElementById("chart-empty"),

  subscriptionsGrid: document.getElementById("subscriptions-grid"),
  subscriptionsEmpty: document.getElementById("subscriptions-empty"),
  emptyAddBtn: document.getElementById("empty-add-btn"),

  subscriptionModalOverlay: document.getElementById("subscription-modal-overlay"),
  subscriptionModalHeading: document.getElementById("subscription-modal-heading"),
  closeSubscriptionModalBtn: document.getElementById("close-subscription-modal"),
  cancelSubscriptionFormBtn: document.getElementById("cancel-subscription-form"),
  subscriptionForm: document.getElementById("subscription-form"),
  subIdInput: document.getElementById("subscription-id"),
  subNameInput: document.getElementById("sub-name"),
  subCategoryInput: document.getElementById("sub-category"),
  subCostInput: document.getElementById("sub-cost"),
  subRenewalDateInput: document.getElementById("sub-renewal-date"),
  subIsTrialCheckbox: document.getElementById("sub-is-trial"),
  trialEndDateField: document.getElementById("trial-end-date-field"),
  subTrialEndDateInput: document.getElementById("sub-trial-end-date"),
  subNotesInput: document.getElementById("sub-notes"),

  deleteModalOverlay: document.getElementById("delete-modal-overlay"),
  deleteModalMessage: document.getElementById("delete-modal-message"),
  closeDeleteModalBtn: document.getElementById("close-delete-modal"),
  cancelDeleteBtn: document.getElementById("cancel-delete-btn"),
  confirmDeleteBtn: document.getElementById("confirm-delete-btn")
};

// ==========================================
// LOCAL STORAGE
// ==========================================
// Real implementation comes in Phase 9.

function saveState() {
  // Placeholder — Phase 9.
}

function loadState() {
  // Placeholder — Phase 9.
}

// ==========================================
// UTILITIES
// ==========================================

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

// ==========================================
// VALIDATION
// ==========================================
// Full rules come in Phase 8. For now: just enough to prevent empty submits.

function getBasicSubscriptionFormData() {
  return {
    id: dom.subIdInput.value || null,
    name: dom.subNameInput.value.trim(),
    category: dom.subCategoryInput.value,
    cost: parseFloat(dom.subCostInput.value),
    billingFrequency: dom.subscriptionForm.querySelector('input[name="billingFrequency"]:checked').value,
    renewalDate: dom.subRenewalDateInput.value,
    isTrial: dom.subIsTrialCheckbox.checked,
    trialEndDate: dom.subIsTrialCheckbox.checked ? dom.subTrialEndDateInput.value : null,
    notes: dom.subNotesInput.value.trim()
  };
}

function isBasicFormValid(data) {
  return (
    data.name.length > 0 &&
    data.category.length > 0 &&
    !isNaN(data.cost) &&
    data.cost > 0 &&
    data.renewalDate.length > 0
  );
}

// ==========================================
// CALCULATIONS
// ==========================================
// Full implementation comes in Phase 10.

function getActiveSubscriptions() {
  return state.subscriptions.filter(sub => sub.status === "active");
}

function calculateMonthlySpend() {
  return getActiveSubscriptions().reduce((total, sub) => {
    const monthlyCost = sub.billingFrequency === "yearly" ? sub.cost / 12 : sub.cost;
    return total + monthlyCost;
  }, 0);
}

// ==========================================
// SUBSCRIPTION OPERATIONS (CRUD)
// ==========================================

function addSubscription(data) {
  const now = new Date().toISOString();
  const subscription = {
    id: generateId(),
    name: data.name,
    category: data.category,
    cost: data.cost,
    billingFrequency: data.billingFrequency,
    renewalDate: data.renewalDate,
    status: "active",
    isTrial: data.isTrial,
    trialEndDate: data.trialEndDate,
    notes: data.notes,
    createdAt: now,
    updatedAt: now
  };
  state.subscriptions.push(subscription);
  afterStateChange();
}

function updateSubscription(id, data) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;

  subscription.name = data.name;
  subscription.category = data.category;
  subscription.cost = data.cost;
  subscription.billingFrequency = data.billingFrequency;
  subscription.renewalDate = data.renewalDate;
  subscription.isTrial = data.isTrial;
  subscription.trialEndDate = data.trialEndDate;
  subscription.notes = data.notes;
  subscription.updatedAt = new Date().toISOString();

  afterStateChange();
}

function deleteSubscription(id) {
  state.subscriptions = state.subscriptions.filter(sub => sub.id !== id);
  afterStateChange();
}

function pauseSubscription(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  subscription.status = "paused";
  subscription.updatedAt = new Date().toISOString();
  afterStateChange();
}

function resumeSubscription(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  subscription.status = "active";
  subscription.updatedAt = new Date().toISOString();
  afterStateChange();
}

// Central hook: every CRUD action funnels through here,
// implementing the Update State -> Save -> Recalculate -> Render pattern.
function afterStateChange() {
  saveState();
  renderAll();
}

// ==========================================
// MODAL CONTROLS
// ==========================================

function openAddSubscriptionModal() {
  editingSubscriptionId = null;
  dom.subscriptionForm.reset();
  dom.subIdInput.value = "";
  dom.trialEndDateField.hidden = true;
  dom.subscriptionModalHeading.textContent = "Add Subscription";
  dom.subscriptionModalOverlay.hidden = false;
  dom.subNameInput.focus();
}

function openEditSubscriptionModal(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;

  editingSubscriptionId = id;

  dom.subIdInput.value = subscription.id;
  dom.subNameInput.value = subscription.name;
  dom.subCategoryInput.value = subscription.category;
  dom.subCostInput.value = subscription.cost;
  dom.subscriptionForm.querySelector(
    `input[name="billingFrequency"][value="${subscription.billingFrequency}"]`
  ).checked = true;
  dom.subRenewalDateInput.value = subscription.renewalDate;
  dom.subIsTrialCheckbox.checked = subscription.isTrial;
  dom.trialEndDateField.hidden = !subscription.isTrial;
  dom.subTrialEndDateInput.value = subscription.trialEndDate || "";
  dom.subNotesInput.value = subscription.notes || "";

  dom.subscriptionModalHeading.textContent = "Edit Subscription";
  dom.subscriptionModalOverlay.hidden = false;
  dom.subNameInput.focus();
}

function closeSubscriptionModal() {
  dom.subscriptionModalOverlay.hidden = true;
  dom.subscriptionForm.reset();
  dom.trialEndDateField.hidden = true;
  editingSubscriptionId = null;
}

function openDeleteModal(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  deletingSubscriptionId = id;
  dom.deleteModalMessage.textContent = `Delete ${subscription.name}? This can't be undone.`;
  dom.deleteModalOverlay.hidden = false;
}

function closeDeleteModal() {
  dom.deleteModalOverlay.hidden = true;
  deletingSubscriptionId = null;
}

// ==========================================
// DASHBOARD RENDERING
// ==========================================

function renderSummaryCards() {
  const monthlySpend = calculateMonthlySpend();
  const activeCount = getActiveSubscriptions().length;

  dom.summaryMonthlySpend.textContent = formatMoney(monthlySpend);
  dom.summaryActiveCount.textContent = activeCount;

  dom.summaryBudgetStatus.textContent =
    state.budget.monthlyBudget === null ? "Not set" : "Tracking";
}

function renderBudgetPanel() {
  const hasBudget = state.budget.monthlyBudget !== null;
  dom.budgetPanelContent.hidden = !hasBudget;
  dom.budgetEmptyState.hidden = hasBudget;
  // Full progress bar / status logic comes in Phase 10.
}

function renderRenewals() {
  // Full logic comes in Phase 10.
  const hasRenewals = false;
  dom.renewalsList.innerHTML = "";
  dom.renewalsEmpty.hidden = hasRenewals;
}

function renderTrials() {
  // Full logic comes in Phase 10.
  const hasTrials = false;
  dom.trialsPanel.hidden = !hasTrials;
  dom.trialsList.innerHTML = "";
}

// ==========================================
// CHART / VISUALIZATION
// ==========================================

function renderChart() {
  // Full chart implementation comes in Phase 12.
  const hasSubscriptions = state.subscriptions.length > 0;
  dom.chartEmpty.hidden = hasSubscriptions;
  dom.chartContainer.innerHTML = "";
  dom.chartLegend.innerHTML = "";
}

// ==========================================
// SUBSCRIPTION LIST RENDERING
// ==========================================

function createSubscriptionCard(subscription) {
  const card = document.createElement("div");
  card.className = "subscription-card" + (subscription.status === "paused" ? " subscription-card--paused" : "");

  const monthlyCost = subscription.billingFrequency === "yearly"
    ? subscription.cost / 12
    : subscription.cost;

  const costLabel = subscription.billingFrequency === "yearly"
    ? `${formatMoney(subscription.cost)}/yr · ${formatMoney(monthlyCost)}/mo`
    : `${formatMoney(subscription.cost)}/mo`;

  // --- Top row: name + cost ---
  const topRow = document.createElement("div");
  topRow.className = "subscription-card__top";

  const nameEl = document.createElement("span");
  nameEl.className = "subscription-card__name";
  nameEl.textContent = subscription.name;

  const costEl = document.createElement("span");
  costEl.className = "subscription-card__cost";
  costEl.textContent = costLabel;

  topRow.appendChild(nameEl);
  topRow.appendChild(costEl);

  // --- Meta row: category + renewal date ---
  const metaEl = document.createElement("p");
  metaEl.className = "subscription-card__meta";
  metaEl.textContent = `${subscription.category} · Renews ${subscription.renewalDate}`;

  // --- Badges row ---
  const badgesRow = document.createElement("div");
  badgesRow.className = "subscription-card__badges";

  if (subscription.status === "paused") {
    const pausedBadge = document.createElement("span");
    pausedBadge.className = "badge badge--neutral";
    pausedBadge.textContent = "Paused";
    badgesRow.appendChild(pausedBadge);
  }

  if (subscription.isTrial) {
    const trialBadge = document.createElement("span");
    trialBadge.className = "badge badge--warning";
    trialBadge.textContent = `Trial ends ${subscription.trialEndDate}`;
    badgesRow.appendChild(trialBadge);
  }

  // --- Actions row ---
  const actionsRow = document.createElement("div");
  actionsRow.className = "subscription-card__actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn--secondary btn--small";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openEditSubscriptionModal(subscription.id));

  const pauseResumeBtn = document.createElement("button");
  pauseResumeBtn.type = "button";
  pauseResumeBtn.className = "btn btn--secondary btn--small";
  pauseResumeBtn.textContent = subscription.status === "paused" ? "Resume" : "Pause";
  pauseResumeBtn.addEventListener("click", () => {
    if (subscription.status === "paused") {
      resumeSubscription(subscription.id);
    } else {
      pauseSubscription(subscription.id);
    }
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn--danger btn--small";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => openDeleteModal(subscription.id));

  actionsRow.appendChild(editBtn);
  actionsRow.appendChild(pauseResumeBtn);
  actionsRow.appendChild(deleteBtn);

  // --- Assemble card ---
  card.appendChild(topRow);
  card.appendChild(metaEl);
  if (badgesRow.children.length > 0) card.appendChild(badgesRow);
  card.appendChild(actionsRow);

  return card;
}

function renderSubscriptions() {
  const hasSubscriptions = state.subscriptions.length > 0;
  dom.subscriptionsEmpty.hidden = hasSubscriptions;
  dom.subscriptionsGrid.innerHTML = "";

  state.subscriptions.forEach(subscription => {
    dom.subscriptionsGrid.appendChild(createSubscriptionCard(subscription));
  });
}

// ==========================================
// MASTER RENDER FUNCTION
// ==========================================

function renderAll() {
  renderSummaryCards();
  renderBudgetPanel();
  renderRenewals();
  renderTrials();
  renderChart();
  renderSubscriptions();
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function attachEventListeners() {
  dom.addSubscriptionBtn.addEventListener("click", openAddSubscriptionModal);
  dom.emptyAddBtn.addEventListener("click", openAddSubscriptionModal);

  dom.closeSubscriptionModalBtn.addEventListener("click", closeSubscriptionModal);
  dom.cancelSubscriptionFormBtn.addEventListener("click", closeSubscriptionModal);

  dom.subscriptionModalOverlay.addEventListener("click", (event) => {
    if (event.target === dom.subscriptionModalOverlay) {
      closeSubscriptionModal();
    }
  });

  dom.subIsTrialCheckbox.addEventListener("change", () => {
    dom.trialEndDateField.hidden = !dom.subIsTrialCheckbox.checked;
  });

  dom.subscriptionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = getBasicSubscriptionFormData();

    if (!isBasicFormValid(data)) {
      // Real field-by-field validation messages come in Phase 8.
      alert("Please fill in all required fields with valid values.");
      return;
    }

    if (editingSubscriptionId) {
      updateSubscription(editingSubscriptionId, data);
    } else {
      addSubscription(data);
    }

    closeSubscriptionModal();
  });

  dom.editBudgetBtn.addEventListener("click", () => {
    dom.budgetForm.hidden = false;
  });

  dom.cancelBudgetBtn.addEventListener("click", () => {
    dom.budgetForm.hidden = true;
  });

  dom.budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    // Full budget save logic comes in Phase 8/10 (with proper validation).
    const value = parseFloat(dom.budgetInput.value);
    if (isNaN(value) || value < 0) {
      dom.budgetInputError.textContent = "Enter a valid budget amount.";
      return;
    }
    dom.budgetInputError.textContent = "";
    state.budget.monthlyBudget = value;
    dom.budgetForm.hidden = true;
    afterStateChange();
  });

  dom.closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
  dom.cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  dom.deleteModalOverlay.addEventListener("click", (event) => {
    if (event.target === dom.deleteModalOverlay) {
      closeDeleteModal();
    }
  });

  dom.confirmDeleteBtn.addEventListener("click", () => {
    if (deletingSubscriptionId) {
      deleteSubscription(deletingSubscriptionId);
    }
    closeDeleteModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!dom.subscriptionModalOverlay.hidden) closeSubscriptionModal();
      if (!dom.deleteModalOverlay.hidden) closeDeleteModal();
    }
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
  loadState();
  attachEventListeners();
  renderAll();
  console.log("FeesCoach initialized.");
}

document.addEventListener("DOMContentLoaded", init);