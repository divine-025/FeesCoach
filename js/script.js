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

const MAX_NAME_LENGTH = 60;
const MAX_COST = 100000; // sensible upper bound — no subscription costs $100k/mo
const MAX_NOTES_LENGTH = 200;

const state = {
  subscriptions: [],
  budget: {
    monthlyBudget: null
  }
};

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

  // Error spans
  subNameError: document.getElementById("sub-name-error"),
  subCategoryError: document.getElementById("sub-category-error"),
  subCostError: document.getElementById("sub-cost-error"),
  subFrequencyError: document.getElementById("sub-frequency-error"),
  subRenewalDateError: document.getElementById("sub-renewal-date-error"),
  subTrialEndDateError: document.getElementById("sub-trial-end-date-error"),

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
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

// ==========================================
// VALIDATION
// ==========================================

/**
 * Reads raw values from the subscription form.
 * No parsing/trimming decisions happen here — just extraction.
 */
function getSubscriptionFormData() {
  const frequencyInput = dom.subscriptionForm.querySelector('input[name="billingFrequency"]:checked');
  return {
    id: dom.subIdInput.value || null,
    name: dom.subNameInput.value.trim(),
    category: dom.subCategoryInput.value,
    costRaw: dom.subCostInput.value,
    billingFrequency: frequencyInput ? frequencyInput.value : "",
    renewalDate: dom.subRenewalDateInput.value,
    isTrial: dom.subIsTrialCheckbox.checked,
    trialEndDateRaw: dom.subTrialEndDateInput.value,
    notes: dom.subNotesInput.value.trim()
  };
}

/**
 * Validates the full subscription form.
 * Returns { valid: boolean, errors: { fieldName: message }, data: parsedData }
 */
function validateSubscriptionForm(data) {
  const errors = {};

  // --- Name ---
  if (data.name.length === 0) {
    errors.name = "Name is required.";
  } else if (data.name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  // --- Category ---
  if (!CATEGORIES.includes(data.category)) {
    errors.category = "Please select a valid category.";
  }

  // --- Cost ---
  const cost = parseFloat(data.costRaw);
  if (data.costRaw.trim().length === 0 || isNaN(cost)) {
    errors.cost = "Cost is required and must be a number.";
  } else if (cost <= 0) {
    errors.cost = "Cost must be greater than zero.";
  } else if (cost > MAX_COST) {
    errors.cost = `Cost must be less than ${formatMoney(MAX_COST)}.`;
  }

  // --- Billing frequency ---
  if (data.billingFrequency !== "monthly" && data.billingFrequency !== "yearly") {
    errors.frequency = "Please select a billing frequency.";
  }

  // --- Renewal date ---
  if (data.renewalDate.length === 0) {
    errors.renewalDate = "Renewal date is required.";
  } else if (isNaN(new Date(data.renewalDate).getTime())) {
    errors.renewalDate = "Please enter a valid date.";
  }

  // --- Trial end date (only relevant if isTrial is checked) ---
  let trialEndDate = null;
  if (data.isTrial) {
    if (data.trialEndDateRaw.length === 0) {
      errors.trialEndDate = "Trial end date is required when marking as a free trial.";
    } else if (isNaN(new Date(data.trialEndDateRaw).getTime())) {
      errors.trialEndDate = "Please enter a valid trial end date.";
    } else {
      trialEndDate = data.trialEndDateRaw;
    }
  }

  const parsedData = {
    id: data.id,
    name: data.name,
    category: data.category,
    cost: cost,
    billingFrequency: data.billingFrequency,
    renewalDate: data.renewalDate,
    isTrial: data.isTrial,
    trialEndDate: trialEndDate,
    notes: data.notes.slice(0, MAX_NOTES_LENGTH)
  };

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: parsedData
  };
}

/** Clears all inline error messages in the subscription form. */
function clearSubscriptionFormErrors() {
  dom.subNameError.textContent = "";
  dom.subCategoryError.textContent = "";
  dom.subCostError.textContent = "";
  dom.subFrequencyError.textContent = "";
  dom.subRenewalDateError.textContent = "";
  dom.subTrialEndDateError.textContent = "";
}

/** Renders an errors object (from validateSubscriptionForm) into the form's error spans. */
function showSubscriptionFormErrors(errors) {
  dom.subNameError.textContent = errors.name || "";
  dom.subCategoryError.textContent = errors.category || "";
  dom.subCostError.textContent = errors.cost || "";
  dom.subFrequencyError.textContent = errors.frequency || "";
  dom.subRenewalDateError.textContent = errors.renewalDate || "";
  dom.subTrialEndDateError.textContent = errors.trialEndDate || "";
}

/** Validates and shows an error for a single field — used for on-blur feedback. */
function validateSingleField(fieldName) {
  const data = getSubscriptionFormData();
  const result = validateSubscriptionForm(data);

  // Only show/clear the one field's error, so we don't yell about
  // fields the user hasn't reached yet.
  switch (fieldName) {
    case "name":
      dom.subNameError.textContent = result.errors.name || "";
      break;
    case "category":
      dom.subCategoryError.textContent = result.errors.category || "";
      break;
    case "cost":
      dom.subCostError.textContent = result.errors.cost || "";
      break;
    case "renewalDate":
      dom.subRenewalDateError.textContent = result.errors.renewalDate || "";
      break;
    case "trialEndDate":
      dom.subTrialEndDateError.textContent = result.errors.trialEndDate || "";
      break;
  }
}

/** Validates the budget input. Returns { valid, error, value }. */
function validateBudgetInput(rawValue) {
  const value = parseFloat(rawValue);
  if (rawValue.trim().length === 0 || isNaN(value)) {
    return { valid: false, error: "Budget is required and must be a number.", value: null };
  }
  if (value < 0) {
    return { valid: false, error: "Budget cannot be negative.", value: null };
  }
  if (value > MAX_COST) {
    return { valid: false, error: `Budget must be less than ${formatMoney(MAX_COST)}.`, value: null };
  }
  return { valid: true, error: "", value };
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
  clearSubscriptionFormErrors();
  dom.subscriptionModalHeading.textContent = "Add Subscription";
  dom.subscriptionModalOverlay.hidden = false;
  dom.subNameInput.focus();
}

function openEditSubscriptionModal(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;

  editingSubscriptionId = id;
  clearSubscriptionFormErrors();

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
  clearSubscriptionFormErrors();
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
  const hasRenewals = false; // Phase 10
  dom.renewalsList.innerHTML = "";
  dom.renewalsEmpty.hidden = hasRenewals;
}

function renderTrials() {
  const hasTrials = false; // Phase 10
  dom.trialsPanel.hidden = !hasTrials;
  dom.trialsList.innerHTML = "";
}

// ==========================================
// CHART / VISUALIZATION
// ==========================================

function renderChart() {
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

  const metaEl = document.createElement("p");
  metaEl.className = "subscription-card__meta";
  metaEl.textContent = `${subscription.category} · Renews ${subscription.renewalDate}`;

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
    if (!dom.subIsTrialCheckbox.checked) {
      dom.subTrialEndDateError.textContent = "";
    }
  });

  // --- On-blur validation for immediate feedback ---
  dom.subNameInput.addEventListener("blur", () => validateSingleField("name"));
  dom.subCategoryInput.addEventListener("change", () => validateSingleField("category"));
  dom.subCostInput.addEventListener("blur", () => validateSingleField("cost"));
  dom.subRenewalDateInput.addEventListener("blur", () => validateSingleField("renewalDate"));
  dom.subTrialEndDateInput.addEventListener("blur", () => validateSingleField("trialEndDate"));

  dom.subscriptionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const rawData = getSubscriptionFormData();
    const result = validateSubscriptionForm(rawData);

    if (!result.valid) {
      showSubscriptionFormErrors(result.errors);
      // Move focus to the first invalid field so keyboard/screen-reader
      // users land exactly where the problem is.
      const firstErrorField = Object.keys(result.errors)[0];
      const fieldToFocus = {
        name: dom.subNameInput,
        category: dom.subCategoryInput,
        cost: dom.subCostInput,
        frequency: dom.subscriptionForm.querySelector('input[name="billingFrequency"]'),
        renewalDate: dom.subRenewalDateInput,
        trialEndDate: dom.subTrialEndDateInput
      }[firstErrorField];
      if (fieldToFocus) fieldToFocus.focus();
      return;
    }

    clearSubscriptionFormErrors();

    if (editingSubscriptionId) {
      updateSubscription(editingSubscriptionId, result.data);
    } else {
      addSubscription(result.data);
    }

    closeSubscriptionModal();
  });

  dom.editBudgetBtn.addEventListener("click", () => {
    dom.budgetInputError.textContent = "";
    dom.budgetForm.hidden = false;
    dom.budgetInput.focus();
  });

  dom.cancelBudgetBtn.addEventListener("click", () => {
    dom.budgetForm.hidden = true;
    dom.budgetInputError.textContent = "";
  });

  dom.budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = validateBudgetInput(dom.budgetInput.value);

    if (!result.valid) {
      dom.budgetInputError.textContent = result.error;
      dom.budgetInput.focus();
      return;
    }

    dom.budgetInputError.textContent = "";
    state.budget.monthlyBudget = result.value;
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