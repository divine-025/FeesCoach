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
const MAX_COST = 100000; // sensible upper bound
const MAX_NOTES_LENGTH = 200;
const STORAGE_KEY = "feescoach_data";

const RENEWAL_WINDOW_DAYS = 7;
const TRIAL_ALERT_WINDOW_DAYS = 7;
const BUDGET_WARNING_THRESHOLD = 80; // percent

const state = {
  subscriptions: [],
  budget: {
    monthlyBudget: null
  }
};

// Tracks which subscription is currently being edited or deleted.
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

/**
 * Saves the current state to LocalStorage.
 * Wrapped in try/catch because LocalStorage can throw
 * (private browsing mode, storage quota exceeded, disabled by browser settings).
 */
function saveState() {
  try {
    const payload = JSON.stringify({
      subscriptions: state.subscriptions,
      budget: state.budget
    });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.error("Failed to save data to LocalStorage:", error);
    // A save failure shouldn't interrupt the user's flow — the app
    // keeps working in-memory; they just risk losing data on refresh.
  }
}

/**
 * Loads saved state from LocalStorage on startup.
 * Defends against three failure modes:
 *   1. LocalStorage unavailable entirely (throws on .getItem)
 *   2. No saved data yet (getItem returns null)
 *   3. Saved data exists but is malformed/corrupted JSON or wrong shape
 */
function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("LocalStorage is unavailable:", error);
    return;
  }

  if (!raw) return; // nothing saved yet — first-time use

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Saved data is corrupted and could not be parsed:", error);
    return;
  }

  if (Array.isArray(parsed.subscriptions)) {
    state.subscriptions = parsed.subscriptions.filter(isValidStoredSubscription);
  }

  if (parsed.budget && typeof parsed.budget === "object") {
    const budgetValue = parsed.budget.monthlyBudget;
    state.budget.monthlyBudget =
      typeof budgetValue === "number" && !isNaN(budgetValue) && budgetValue >= 0
        ? budgetValue
        : null;
  }
}

/**
 * Guards against partially-corrupted subscription entries
 * (e.g., a manually edited LocalStorage blob missing fields).
 * Any entry failing this check is silently dropped rather than
 * crashing rendering later.
 */
function isValidStoredSubscription(sub) {
  return (
    sub &&
    typeof sub.id === "string" &&
    typeof sub.name === "string" &&
    typeof sub.cost === "number" &&
    !isNaN(sub.cost) &&
    (sub.billingFrequency === "monthly" || sub.billingFrequency === "yearly") &&
    typeof sub.renewalDate === "string" &&
    (sub.status === "active" || sub.status === "paused")
  );
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

/**
 * Parses an ISO date string ("YYYY-MM-DD") as a LOCAL date at midnight,
 * avoiding the UTC-shift bug that `new Date(dateString)` has.
 */
function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Returns the number of whole days between today and a given date string.
 * Negative = in the past. 0 = today. Positive = in the future.
 */
function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateString);
  target.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target - today) / msPerDay);
}

/**
 * Converts a day offset into a human-readable label.
 * Used for both renewals and trial alerts so wording stays consistent.
 */
function describeDayOffset(days) {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

const toastContainer = document.getElementById("toast-container");

/**
 * Shows a brief toast message. type: "success" | "danger" | "default"
 * Auto-dismisses after ~3 seconds, with a fade-out before removal.
 */
function showToast(message, type = "default") {
  if (!toastContainer) return; // defensive — in case the container is missing
  const toast = document.createElement("div");
  toast.className = `toast${type !== "default" ? ` toast--${type}` : ""}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast--leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3000);
}

// ==========================================
// MODAL FOCUS MANAGEMENT
// ==========================================

// Remembers which element had focus before a modal opened,
// so we can return focus there when it closes (accessibility requirement).
let lastFocusedElement = null;

/** Returns all focusable elements currently inside a container. */
function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.disabled && el.offsetParent !== null);
}

/**
 * Traps Tab/Shift+Tab focus inside the given modal element.
 * Call once when a modal opens; it self-removes when the modal closes
 * because we check `modalEl.hidden` on every keydown.
 */
function trapFocus(modalEl) {
  function handleKeydown(event) {
    if (modalEl.hidden) {
      document.removeEventListener("keydown", handleKeydown);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(modalEl);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", handleKeydown);
}

/** Call when any modal opens: remembers the trigger and starts the focus trap. */
function onModalOpen(modalEl) {
  lastFocusedElement = document.activeElement;
  trapFocus(modalEl);
}

/** Call when any modal closes: returns focus to whatever opened it. */
function onModalClose() {
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
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
    } else if (
      data.renewalDate.length > 0 &&
      !isNaN(new Date(data.renewalDate).getTime()) &&
      parseLocalDate(data.trialEndDateRaw) > parseLocalDate(data.renewalDate)
    ) {
      errors.trialEndDate = "Trial end date cannot be after the renewal date.";
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

function getActiveSubscriptions() {
  return state.subscriptions.filter(sub => sub.status === "active");
}

/** Converts any subscription's cost to its monthly equivalent. */
function getMonthlyEquivalent(sub) {
  return sub.billingFrequency === "yearly" ? sub.cost / 12 : sub.cost;
}

function calculateMonthlySpend() {
  return getActiveSubscriptions().reduce(
    (total, sub) => total + getMonthlyEquivalent(sub),
    0
  );
}

/**
 * Returns budget usage info, or null if no budget is set.
 * Centralizing this means the summary card, budget panel, and any
 * future feature all agree on the same numbers and thresholds.
 */
function calculateBudgetUsage() {
  const budget = state.budget.monthlyBudget;
  if (budget === null) return null;

  const spent = calculateMonthlySpend();
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : (spent > 0 ? 100 : 0);

  let status = "safe";
  if (spent > budget) {
    status = "over";
  } else if (percentage >= BUDGET_WARNING_THRESHOLD) {
    status = "warning";
  }

  return { budget, spent, remaining, percentage, status };
}

/**
 * Groups active subscriptions' monthly-equivalent cost by category.
 * Only returns categories with spending > 0.
 */
function getCategoryTotals() {
  const totals = {};
  getActiveSubscriptions().forEach(sub => {
    const monthly = getMonthlyEquivalent(sub);
    totals[sub.category] = (totals[sub.category] || 0) + monthly;
  });
  return Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Returns active subscriptions renewing within RENEWAL_WINDOW_DAYS,
 * sorted soonest-first, each annotated with its day offset and label.
 */
function getUpcomingRenewals() {
  return getActiveSubscriptions()
    .map(sub => ({ subscription: sub, days: daysUntil(sub.renewalDate) }))
    .filter(entry => entry.days >= 0 && entry.days <= RENEWAL_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
    .map(entry => ({
      ...entry,
      label: `Renews ${describeDayOffset(entry.days)}`
    }));
}

/**
 * Returns trial subscriptions worth alerting about: either ending soon
 * (within TRIAL_ALERT_WINDOW_DAYS) or already expired. Trials far in the
 * future are intentionally excluded.
 */
function getTrialAlerts() {
  return state.subscriptions
    .filter(sub => sub.status === "active" && sub.isTrial && sub.trialEndDate)
    .map(sub => ({ subscription: sub, days: daysUntil(sub.trialEndDate) }))
    .filter(entry => entry.days <= TRIAL_ALERT_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
    .map(entry => ({
      ...entry,
      label: entry.days < 0
        ? "Trial expired"
        : `Trial ends ${describeDayOffset(entry.days)}`
    }));
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
  showToast(`${subscription.name} added.`, "success");
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
  showToast(`${subscription.name} updated.`, "success");
}

function deleteSubscription(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  state.subscriptions = state.subscriptions.filter(sub => sub.id !== id);
  afterStateChange();
  if (subscription) showToast(`${subscription.name} deleted.`, "danger");
}

function pauseSubscription(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  subscription.status = "paused";
  subscription.updatedAt = new Date().toISOString();
  afterStateChange();
  showToast(`${subscription.name} paused.`);
}

function resumeSubscription(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  subscription.status = "active";
  subscription.updatedAt = new Date().toISOString();
  afterStateChange();
  showToast(`${subscription.name} resumed.`, "success");
}

// Central hook: every CRUD action funnels through here,
// implementing the Update State -> Save -> Recalculate -> Render pattern.
function afterStateChange() {
  saveState();
  renderAll();
}

/**
 * Checks if a subscription name (case-insensitive) already exists,
 * excluding the subscription currently being edited (if any).
 * Used for a soft duplicate warning, not a hard validation block.
 */
function isDuplicateSubscriptionName(name, excludeId) {
  return state.subscriptions.some(sub =>
    sub.name.toLowerCase() === name.toLowerCase() && sub.id !== excludeId
  );
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
  onModalOpen(dom.subscriptionModalOverlay);
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
  onModalOpen(dom.subscriptionModalOverlay);
  dom.subNameInput.focus();
}

function closeSubscriptionModal() {
  dom.subscriptionModalOverlay.hidden = true;
  dom.subscriptionForm.reset();
  dom.trialEndDateField.hidden = true;
  clearSubscriptionFormErrors();
  editingSubscriptionId = null;
  onModalClose();
}

function openDeleteModal(id) {
  const subscription = state.subscriptions.find(sub => sub.id === id);
  if (!subscription) return;
  deletingSubscriptionId = id;
  dom.deleteModalMessage.textContent = `Delete ${subscription.name}? This can't be undone.`;
  dom.deleteModalOverlay.hidden = false;
  onModalOpen(dom.deleteModalOverlay);
  dom.confirmDeleteBtn.focus();
}

function closeDeleteModal() {
  dom.deleteModalOverlay.hidden = true;
  deletingSubscriptionId = null;
  onModalClose();
}

// ==========================================
// DASHBOARD RENDERING
// ==========================================

function renderSummaryCards() {
  const monthlySpend = calculateMonthlySpend();
  const activeCount = getActiveSubscriptions().length;
  const budgetUsage = calculateBudgetUsage();

  dom.summaryMonthlySpend.textContent = formatMoney(monthlySpend);
  dom.summaryActiveCount.textContent = activeCount;

  if (budgetUsage === null) {
    dom.summaryBudgetStatus.textContent = "Not set";
  } else {
    const statusLabels = { safe: "On track", warning: "Approaching limit", over: "Over budget" };
    dom.summaryBudgetStatus.textContent = statusLabels[budgetUsage.status];
  }
}

function renderBudgetPanel() {
  const budgetUsage = calculateBudgetUsage();
  const hasBudget = budgetUsage !== null;

  dom.budgetPanelContent.hidden = !hasBudget;
  dom.budgetEmptyState.hidden = hasBudget;

  if (!hasBudget) return;

  const clampedPercentage = Math.min(budgetUsage.percentage, 100);

  dom.budgetProgressFill.style.width = `${clampedPercentage}%`;
  dom.budgetProgressBar.setAttribute("aria-valuenow", Math.round(budgetUsage.percentage));

  dom.budgetProgressFill.classList.remove(
    "budget-progress__fill--warning",
    "budget-progress__fill--danger"
  );

  const badgeClasses = {
    safe: ["badge--safe", "Safe"],
    warning: ["badge--warning", "Warning"],
    over: ["badge--danger", "Over Budget"]
  };
  const [badgeClass, badgeLabel] = badgeClasses[budgetUsage.status];

  dom.budgetStatusBadge.className = `badge ${badgeClass}`;
  dom.budgetStatusBadge.textContent = badgeLabel;

  if (budgetUsage.status === "warning") {
    dom.budgetProgressFill.classList.add("budget-progress__fill--warning");
  } else if (budgetUsage.status === "over") {
    dom.budgetProgressFill.classList.add("budget-progress__fill--danger");
  }

  const remainingText = budgetUsage.remaining >= 0
    ? `${formatMoney(budgetUsage.remaining)} remaining`
    : `${formatMoney(Math.abs(budgetUsage.remaining))} over budget`;

  dom.budgetSummaryText.textContent =
    `${formatMoney(budgetUsage.spent)} of ${formatMoney(budgetUsage.budget)} used ` +
    `(${Math.round(budgetUsage.percentage)}%) · ${remainingText}`;
}

function renderRenewals() {
  const renewals = getUpcomingRenewals();
  dom.renewalsList.innerHTML = "";
  dom.renewalsEmpty.hidden = renewals.length > 0;

  renewals.forEach(entry => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = entry.subscription.name;

    const labelSpan = document.createElement("span");
    labelSpan.className = "alert-list__label";
    labelSpan.textContent = entry.label;

    li.appendChild(nameSpan);
    li.appendChild(labelSpan);
    dom.renewalsList.appendChild(li);
  });
}

function renderTrials() {
  const trialAlerts = getTrialAlerts();
  dom.trialsPanel.hidden = trialAlerts.length === 0;
  dom.trialsList.innerHTML = "";

  trialAlerts.forEach(entry => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = entry.subscription.name;

    const labelSpan = document.createElement("span");
    labelSpan.className = "alert-list__label";
    labelSpan.textContent = entry.label;
    if (entry.days < 0) {
      labelSpan.classList.add("alert-list__label--expired");
    }

    li.appendChild(nameSpan);
    li.appendChild(labelSpan);
    dom.trialsList.appendChild(li);
  });
}

// ==========================================
// CHART / VISUALIZATION
// ==========================================

const CHART_COLORS = [
  "#0ea5e9", // sky blue (primary)
  "#f59e0b", // amber
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16"  // lime
];

const CHART_SIZE = 200;
const CHART_STROKE_WIDTH = 28;
const CHART_RADIUS = (CHART_SIZE - CHART_STROKE_WIDTH) / 2;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

function renderChart() {
  const categoryTotals = getCategoryTotals();
  const hasData = categoryTotals.length > 0;

  dom.chartEmpty.hidden = hasData;
  dom.chartContainer.innerHTML = "";
  dom.chartLegend.innerHTML = "";

  if (!hasData) return;

  const total = categoryTotals.reduce((sum, entry) => sum + entry.amount, 0);

  const svg = buildDonutSvg(categoryTotals, total);
  dom.chartContainer.appendChild(svg);

  categoryTotals.forEach((entry, index) => {
    const percentage = (entry.amount / total) * 100;
    dom.chartLegend.appendChild(
      buildLegendItem(entry.category, entry.amount, percentage, CHART_COLORS[index % CHART_COLORS.length])
    );
  });
}

/**
 * Builds the SVG donut chart element using the stroke-dasharray technique:
 * each circle segment shows only its slice of the total circumference,
 * offset to continue where the previous slice ended.
 */
function buildDonutSvg(categoryTotals, total) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${CHART_SIZE} ${CHART_SIZE}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Spending by category: ${categoryTotals.map(e => `${e.category} ${formatMoney(e.amount)}`).join(", ")}`
  );

  const center = CHART_SIZE / 2;

  // Background track (full ring, faint) so partial data doesn't look broken
  const track = document.createElementNS(svgNS, "circle");
  track.setAttribute("cx", center);
  track.setAttribute("cy", center);
  track.setAttribute("r", CHART_RADIUS);
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "#e2e8f0");
  track.setAttribute("stroke-width", CHART_STROKE_WIDTH);
  svg.appendChild(track);

  // Single category = a full ring in one color
  if (categoryTotals.length === 1) {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", center);
    circle.setAttribute("cy", center);
    circle.setAttribute("r", CHART_RADIUS);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", CHART_COLORS[0]);
    circle.setAttribute("stroke-width", CHART_STROKE_WIDTH);
    svg.appendChild(circle);
    return svg;
  }

  // Multiple categories: each gets a dash-array segment,
  // rotated -90deg so the first slice starts at 12 o'clock.
  let offsetSoFar = 0;
  categoryTotals.forEach((entry, index) => {
    const fraction = entry.amount / total;
    const segmentLength = fraction * CHART_CIRCUMFERENCE;

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", center);
    circle.setAttribute("cy", center);
    circle.setAttribute("r", CHART_RADIUS);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", CHART_COLORS[index % CHART_COLORS.length]);
    circle.setAttribute("stroke-width", CHART_STROKE_WIDTH);
    circle.setAttribute("stroke-dasharray", `${segmentLength} ${CHART_CIRCUMFERENCE - segmentLength}`);
    circle.setAttribute("stroke-dashoffset", -offsetSoFar);
    circle.setAttribute("transform", `rotate(-90 ${center} ${center})`);
    circle.setAttribute("stroke-linecap", "butt");

    svg.appendChild(circle);
    offsetSoFar += segmentLength;
  });

  return svg;
}

/** Builds one legend row: colored swatch + category name + amount + percentage. */
function buildLegendItem(category, amount, percentage, color) {
  const li = document.createElement("li");

  const swatch = document.createElement("span");
  swatch.className = "chart-legend__swatch";
  swatch.style.backgroundColor = color;

  const text = document.createElement("span");
  text.textContent = `${category} — ${formatMoney(amount)} (${Math.round(percentage)}%)`;

  li.appendChild(swatch);
  li.appendChild(text);
  return li;
}

// ==========================================
// SUBSCRIPTION LIST RENDERING
// ==========================================

function createSubscriptionCard(subscription) {
  const card = document.createElement("div");
  card.className = "subscription-card" + (subscription.status === "paused" ? " subscription-card--paused" : "");

  const monthlyCost = getMonthlyEquivalent(subscription);

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
// Called after every state change. Keeps the whole UI in sync from one place.

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

  // On-blur validation for immediate feedback
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

    // Soft duplicate-name warning (not a hard validation block)
    if (isDuplicateSubscriptionName(result.data.name, editingSubscriptionId)) {
      const proceed = confirm(
        `You already have a subscription named "${result.data.name}". Add it anyway?`
      );
      if (!proceed) return;
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
    showToast("Budget updated.", "success");
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