'use strict';

/* ==========================================================================
   MINDGAUGE — SCRIPT
   Sections: 1. Config  2. DOM refs  3. Theme toggle  4. Mobile nav
   5. Scroll spy / header state  6. Validation rules  7. Form handling
   8. API calls  9. Result rendering (dial)  10. Init
   ========================================================================== */

/* ---------- 1. CONFIG ---------- */
const API_BASE_URL = 'https://mental-health-score-0teb.onrender.com';
const DIAL_CIRCUMFERENCE = 2 * Math.PI * 92; // matches r="92" in the SVG dials
const SCORE_MAX = 10;

/* ---------- 2. DOM REFERENCES ---------- */
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const siteHeader = document.getElementById('siteHeader');

const form = document.getElementById('predictForm');
const submitBtn = document.getElementById('submitBtn');
const resetBtn = document.getElementById('resetBtn');
const retryBtn = document.getElementById('retryBtn');

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const resultEmpty = document.getElementById('resultEmpty');
const resultContent = document.getElementById('resultContent');
const resultError = document.getElementById('resultError');
const resultErrorMsg = document.getElementById('resultErrorMsg');
const resultDial = document.getElementById('resultDial');
const resultValue = document.getElementById('resultValue');
const resultLabel = document.getElementById('resultLabel');
const resultDesc = document.getElementById('resultDesc');
const resultBreakdown = document.getElementById('resultBreakdown');

let lastPayload = null; // remembers the last submitted payload so "Try again" can retry it

/* ---------- 3. THEME TOGGLE ---------- */
function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function initTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

themeToggle.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ---------- 4. MOBILE NAV ---------- */
function closeMenu() {
  navLinks.classList.remove('is-open');
  menuToggle.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('is-open');
  menuToggle.classList.toggle('is-open', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

/* ---------- 5. SCROLL SPY / HEADER STATE ---------- */
function updateActiveNavLink() {
  const sections = ['top', 'assess', 'result', 'insights', 'about']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  let currentId = 'top';
  const scrollPos = window.scrollY + 140;

  sections.forEach((section) => {
    if (section.offsetTop <= scrollPos) currentId = section.id;
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.getAttribute('href') === `#${currentId}`;
    link.classList.toggle('active', isActive);
  });
}

window.addEventListener('scroll', () => {
  window.requestAnimationFrame(updateActiveNavLink);
}, { passive: true });

/* ---------- 6. VALIDATION RULES ----------
   Mirrors the constraints defined in the FastAPI Pydantic model exactly,
   so a value that passes here is guaranteed to pass server-side too. */
const VALIDATORS = {
  age: (v) => {
    const n = Number(v);
    if (v === '' || Number.isNaN(n)) return 'Enter your age.';
    if (!Number.isInteger(n)) return 'Age must be a whole number.';
    if (n < 10 || n > 100) return 'Age must be between 10 and 100.';
    return '';
  },
  gender: (v) => (v ? '' : 'Select a gender.'),
  country: (v) => (v.trim().length > 0 ? '' : 'Enter your country.'),
  academic_level: (v) => (v ? '' : 'Select your academic level.'),
  most_used_platform: (v) => (v ? '' : 'Select a platform.'),
  purpose_of_use: (v) => (v ? '' : 'Select a purpose.'),
  avg_daily_usage_hours: (v) => rangeValidator(v, 0, 24, 'Usage hours'),
  daily_unlocks: (v) => {
    const n = Number(v);
    if (v === '' || Number.isNaN(n)) return 'Enter daily unlocks.';
    if (!Number.isInteger(n)) return 'Unlocks must be a whole number.';
    if (n < 0) return 'Unlocks cannot be negative.';
    return '';
  },
  study_hours: (v) => rangeValidator(v, 0, 24, 'Study hours'),
  physical_activity_hours: (v) => rangeValidator(v, 0, 24, 'Activity hours'),
  sleep_hours_per_night: (v) => rangeValidator(v, 0, 24, 'Sleep hours'),
  stress_level: (v) => (v ? '' : 'Select a stress level.'),
};

function rangeValidator(v, min, max, label) {
  const n = Number(v);
  if (v === '' || Number.isNaN(n)) return `Enter ${label.toLowerCase()}.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return '';
}

function validateField(name, value) {
  const validator = VALIDATORS[name];
  return validator ? validator(value) : '';
}

function showFieldError(name, message) {
  const input = document.getElementById(name);
  const errorEl = document.getElementById(`err-${name}`);
  const field = input.closest('.field');
  if (message) {
    field.classList.add('has-error');
    errorEl.textContent = message;
  } else {
    field.classList.remove('has-error');
    errorEl.textContent = '';
  }
}

function validateForm(formData) {
  let isValid = true;
  const errors = {};
  Object.keys(VALIDATORS).forEach((name) => {
    const value = formData.get(name) ?? '';
    const message = validateField(name, value);
    showFieldError(name, message);
    if (message) {
      isValid = false;
      errors[name] = message;
    }
  });
  return { isValid, errors };
}

/* Live validation as the user types/selects, once a field has been touched */
Object.keys(VALIDATORS).forEach((name) => {
  const el = document.getElementById(name);
  if (!el) return;
  el.addEventListener('blur', () => showFieldError(name, validateField(name, el.value)));
  el.addEventListener('input', () => {
    if (el.closest('.field').classList.contains('has-error')) {
      showFieldError(name, validateField(name, el.value));
    }
  });
});

/* ---------- 7. FORM HANDLING ---------- */
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const { isValid } = validateForm(formData);

  if (!isValid) {
    const firstError = form.querySelector('.field.has-error input, .field.has-error select');
    if (firstError) firstError.focus();
    return;
  }

  const payload = buildPayload(formData);
  lastPayload = payload;
  await submitPrediction(payload);
});

resetBtn.addEventListener('click', () => {
  form.reset();
  Object.keys(VALIDATORS).forEach((name) => showFieldError(name, ''));
  showEmptyState();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

retryBtn.addEventListener('click', () => {
  if (lastPayload) submitPrediction(lastPayload);
});

/** Converts validated FormData into the exact JSON shape expected by StudentData */
function buildPayload(formData) {
  return {
    age: parseInt(formData.get('age'), 10),
    gender: formData.get('gender'),
    country: formData.get('country').trim(),
    academic_level: formData.get('academic_level'),
    most_used_platform: formData.get('most_used_platform'),
    purpose_of_use: formData.get('purpose_of_use'),
    avg_daily_usage_hours: parseFloat(formData.get('avg_daily_usage_hours')),
    daily_unlocks: parseInt(formData.get('daily_unlocks'), 10),
    study_hours: parseFloat(formData.get('study_hours')),
    physical_activity_hours: parseFloat(formData.get('physical_activity_hours')),
    sleep_hours_per_night: parseFloat(formData.get('sleep_hours_per_night')),
    stress_level: formData.get('stress_level'),
  };
}

/* ---------- 8. API CALLS ---------- */
async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
    if (!response.ok) throw new Error('Non-200 response');
    setApiStatus(true);
  } catch (err) {
    setApiStatus(false);
  }
}

function setApiStatus(isOnline) {
  statusDot.classList.toggle('online', isOnline);
  statusDot.classList.toggle('offline', !isOnline);
  statusText.textContent = isOnline
    ? 'Connected to prediction API'
    : `API unreachable at ${API_BASE_URL} — start your FastAPI server`;
}

async function submitPrediction(payload) {
  setButtonLoading(true);
  hideAllResultStates();

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await safeReadDetail(response);
      throw new Error(detail || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    setApiStatus(true);
    renderResult(data.predicted_mental_health_score, payload);
  } catch (err) {
    setApiStatus(false);
    showErrorState(err.message);
  } finally {
    setButtonLoading(false);
  }
}

async function safeReadDetail(response) {
  try {
    const body = await response.json();
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => d.msg).join(' ');
    }
    return body.detail || '';
  } catch {
    return '';
  }
}

function setButtonLoading(isLoading) {
  submitBtn.dataset.loading = String(isLoading);
  submitBtn.disabled = isLoading;
}

/* ---------- 9. RESULT RENDERING (DIAL) ---------- */
function hideAllResultStates() {
  resultEmpty.hidden = true;
  resultContent.hidden = true;
  resultError.hidden = true;
}

function showEmptyState() {
  hideAllResultStates();
  resultEmpty.hidden = false;
  resultDial.style.strokeDashoffset = DIAL_CIRCUMFERENCE;
}

function showErrorState(message) {
  hideAllResultStates();
  resultError.hidden = false;
  if (message) {
    resultErrorMsg.textContent = message;
  }
}

function getScoreProfile(score) {
  if (score < 4) {
    return {
      label: 'Needs attention',
      desc: 'Your habits suggest elevated strain. Consider reducing screen time and prioritizing sleep and activity.',
      color: 'var(--color-danger)',
    };
  }
  if (score < 6) {
    return {
      label: 'Fair',
      desc: 'A mixed picture — some habits are supportive, others may be working against your wellbeing.',
      color: 'var(--color-accent-strong)',
    };
  }
  if (score < 8) {
    return {
      label: 'Good',
      desc: 'Your lifestyle habits are broadly supportive of healthy wellbeing. Keep up the balance.',
      color: 'var(--color-sage)',
    };
  }
  return {
    label: 'Excellent',
    desc: 'Your habits point to strong overall wellbeing. Great balance across screen time, sleep and activity.',
    color: 'var(--color-success)',
  };
}

function renderResult(score, payload) {
  hideAllResultStates();
  resultContent.hidden = false;

  const clamped = Math.max(0, Math.min(SCORE_MAX, score));
  const ratio = clamped / SCORE_MAX;
  const offset = DIAL_CIRCUMFERENCE * (1 - ratio);
  const profile = getScoreProfile(clamped);

  resultDial.style.stroke = profile.color;
  // Force a reflow so the transition always plays, even for repeat submissions
  resultDial.style.strokeDashoffset = DIAL_CIRCUMFERENCE;
  requestAnimationFrame(() => {
    resultDial.style.strokeDashoffset = offset;
  });

  animateNumber(resultValue, clamped);
  resultLabel.textContent = profile.label;
  resultLabel.style.color = profile.color;
  resultDesc.textContent = profile.desc;

  resultBreakdown.innerHTML = '';
  const items = [
    ['Sleep', `${payload.sleep_hours_per_night}h / night`],
    ['Screen time', `${payload.avg_daily_usage_hours}h / day`],
    ['Study', `${payload.study_hours}h / day`],
    ['Stress level', payload.stress_level],
  ];
  items.forEach(([label, value]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${label}</span><span>${value}</span>`;
    resultBreakdown.appendChild(li);
  });

  resultContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Animates the numeric score counting up smoothly */
function animateNumber(el, target) {
  const duration = 800;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = (eased * target).toFixed(1);
    el.textContent = value;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- 10. INIT ---------- */
function init() {
  initTheme();
  showEmptyState();
  updateActiveNavLink();
  checkApiHealth();
  document.getElementById('footerYear').textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', init);
