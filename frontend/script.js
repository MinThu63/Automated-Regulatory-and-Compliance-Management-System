// ==================== STATE ====================
let allAlerts = [];
let trendChart = null;
let currentUser = null;
let regCurrentPage = 1;
let regTotalPages = 1;
let regSearchQuery = '';
const API_BASE = 'http://localhost:3000';
const ITEMS_PER_PAGE = 10;

// Pagination state for all tabs
let alertsPage = 1;
let changesPage = 1;
let impactPage = 1;
let impactFilter = '';
let tasksPage = 1;
let gapsPage = 1;
let sourcesPage = 1;
let policiesPage = 1;
let auditPage = 1;

// ==================== GENERIC PAGINATION HELPER ====================

function renderPagination(containerId, currentPage, totalItems, onPageChange) {
  var totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (totalItems <= ITEMS_PER_PAGE) return; // No pagination needed

  var nav = document.createElement('nav');
  nav.innerHTML = '<ul class="pagination pagination-sm justify-content-center mb-0"></ul>';
  var ul = nav.querySelector('ul');

  // Previous button
  var prevLi = document.createElement('li');
  prevLi.className = 'page-item' + (currentPage <= 1 ? ' disabled' : '');
  prevLi.innerHTML = '<a class="page-link" href="#">Previous</a>';
  prevLi.addEventListener('click', function(e) { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); });
  ul.appendChild(prevLi);

  // Page numbers
  for (var i = 1; i <= totalPages; i++) {
    var li = document.createElement('li');
    li.className = 'page-item' + (i === currentPage ? ' active' : '');
    li.innerHTML = '<a class="page-link" href="#">' + i + '</a>';
    (function(pageNum) {
      li.addEventListener('click', function(e) { e.preventDefault(); onPageChange(pageNum); });
    })(i);
    ul.appendChild(li);
  }

  // Next button
  var nextLi = document.createElement('li');
  nextLi.className = 'page-item' + (currentPage >= totalPages ? ' disabled' : '');
  nextLi.innerHTML = '<a class="page-link" href="#">Next</a>';
  nextLi.addEventListener('click', function(e) { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); });
  ul.appendChild(nextLi);

  container.appendChild(nav);
}

function paginateArray(arr, page) {
  var start = (page - 1) * ITEMS_PER_PAGE;
  return arr.slice(start, start + ITEMS_PER_PAGE);
}

// ==================== PRINT REPORT ====================

async function printReport() {
  try {
    var printContent = document.getElementById('printContent');
    printContent.innerHTML = '<p style="color:#666;">Generating report...</p>';
    document.getElementById('printDate').textContent = 'Generated: ' + new Date().toLocaleString();

    // Fetch all data for the report
    var [summaryResp, categoriesResp, changesResp, tasksResp, gapsResp] = await Promise.all([
      fetch(API_BASE + '/api/dashboard/summary'),
      fetch(API_BASE + '/api/dashboard/categories'),
      fetch(API_BASE + '/api/regulation-changes'),
      fetch(API_BASE + '/api/tasks'),
      fetch(API_BASE + '/api/compliance-gaps')
    ]);

    var summary = await summaryResp.json();
    var categories = await categoriesResp.json();
    var changes = await changesResp.json();
    var tasks = await tasksResp.json();
    var gaps = await gapsResp.json();

    var html = '';

    // Section 1: Executive Summary
    html += '<h3 style="margin-top:20px; border-bottom:1px solid #ccc; padding-bottom:8px;">1. Executive Summary</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Alerts</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.total || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Unread Alerts</strong></td><td style="padding:8px; border:1px solid #ddd; color:red;">' + (summary.unread || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Immediate Action Required</strong></td><td style="padding:8px; border:1px solid #ddd; color:red;">' + (summary.immediate || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Review Recommended</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.review || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Informational</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.informational || 0) + '</td></tr>';
    html += '</table>';

    // Section 2: Regulatory Changes by Category
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">2. Regulatory Changes by Category</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr style="background:#f5f5f5;"><th style="padding:8px; border:1px solid #ddd; text-align:left;">Category</th><th style="padding:8px; border:1px solid #ddd; text-align:left;">Changes Detected</th></tr>';
    categories.forEach(function(c) {
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">' + c.category + '</td><td style="padding:8px; border:1px solid #ddd;">' + c.change_count + '</td></tr>';
    });
    html += '</table>';

    // Section 3: High-Impact Changes
    var highImpact = changes.filter(function(c) { return c.impact_score === 'Critical' || c.impact_score === 'High'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">3. High-Impact Changes (' + highImpact.length + ')</h3>';
    if (highImpact.length === 0) {
      html += '<p style="color:#666;">No high-impact changes detected.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Regulation</th><th style="padding:6px; border:1px solid #ddd;">Impact</th><th style="padding:6px; border:1px solid #ddd;">Details</th></tr>';
      highImpact.forEach(function(c) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + c.regulation_title + '</td><td style="padding:6px; border:1px solid #ddd; font-weight:bold; color:' + (c.impact_score === 'Critical' ? 'red' : 'orange') + ';">' + c.impact_score + '</td><td style="padding:6px; border:1px solid #ddd;">' + (c.semantic_differences || '').substring(0, 100) + '</td></tr>';
      });
      html += '</table>';
    }

    // Section 4: Outstanding Tasks
    var pendingTasks = tasks.filter(function(t) { return t.status !== 'Completed'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">4. Outstanding Tasks (' + pendingTasks.length + ')</h3>';
    if (pendingTasks.length === 0) {
      html += '<p style="color:#666;">All tasks completed.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Task</th><th style="padding:6px; border:1px solid #ddd;">Assignee</th><th style="padding:6px; border:1px solid #ddd;">Deadline</th><th style="padding:6px; border:1px solid #ddd;">Status</th></tr>';
      pendingTasks.forEach(function(t) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + t.title + '</td><td style="padding:6px; border:1px solid #ddd;">' + t.assignee + '</td><td style="padding:6px; border:1px solid #ddd;">' + formatDate(t.deadline) + '</td><td style="padding:6px; border:1px solid #ddd;">' + t.status + '</td></tr>';
      });
      html += '</table>';
    }

    // Section 5: Open Compliance Gaps
    var openGaps = gaps.filter(function(g) { return g.status !== 'Remediated'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">5. Open Compliance Gaps (' + openGaps.length + ')</h3>';
    if (openGaps.length === 0) {
      html += '<p style="color:#666;">All gaps remediated.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Regulation</th><th style="padding:6px; border:1px solid #ddd;">Policy</th><th style="padding:6px; border:1px solid #ddd;">Gap</th><th style="padding:6px; border:1px solid #ddd;">Status</th></tr>';
      openGaps.forEach(function(g) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + g.regulation_title + '</td><td style="padding:6px; border:1px solid #ddd;">' + g.policy_name + '</td><td style="padding:6px; border:1px solid #ddd;">' + (g.gap_description || '').substring(0, 80) + '</td><td style="padding:6px; border:1px solid #ddd;">' + g.status + '</td></tr>';
      });
      html += '</table>';
    }

    // Footer
    html += '<div style="margin-top:40px; padding-top:15px; border-top:1px solid #ccc; font-size:0.75rem; color:#999; text-align:center;">';
    html += 'This report was auto-generated by the GLDB Compliance Portal. For internal use only. Confidential.';
    html += '</div>';

    printContent.innerHTML = html;

    // Trigger print
    setTimeout(function() { window.print(); }, 300);
  } catch (err) {
    showToast('Failed to generate print report', 'danger');
  }
}

// ==================== DARK MODE ====================

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  var btn = document.getElementById('darkModeBtn');
  if (document.body.classList.contains('dark-mode')) {
    btn.textContent = '☀️';
    localStorage.setItem('darkMode', 'true');
  } else {
    btn.textContent = '🌙';
    localStorage.setItem('darkMode', 'false');
  }
}

function loadDarkModePreference() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').textContent = '☀️';
  }
}

// ==================== WELCOME BANNER ====================

async function showWelcomeBanner() {
  if (!currentUser) return;
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) return;
    var summary = await response.json();
    document.getElementById('welcomeText').textContent = 'Welcome back, ' + currentUser.username + '!';
    document.getElementById('welcomeSummary').textContent = 'You have ' + (summary.unread || 0) + ' unread alerts and ' + (summary.immediate || 0) + ' requiring immediate action.';
    document.getElementById('welcomeBanner').classList.remove('d-none');
  } catch (err) { /* silent */ }
}

// ==================== LAST SYNCED ====================

function updateLastSynced() {
  var el = document.getElementById('lastSyncedTime');
  if (el) {
    el.textContent = 'Last synced: ' + new Date().toLocaleString();
  }
}

// ==================== EXPORT CSV ====================

function exportTableCSV(type) {
  var data = [];
  var filename = type + '_export.csv';

  if (type === 'alerts') {
    data = allAlerts;
    var csv = 'Alert ID,Regulation Title,Severity Level,Status\n';
    data.forEach(function(row) {
      csv += row.alert_id + ',"' + (row.title || '').replace(/"/g, '""') + '","' + row.severity_level + '","' + row.status + '"\n';
    });
    downloadCSV(csv, filename);
  }
}

function downloadCSV(csv, filename) {
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  showToast('CSV exported successfully', 'success');
}

// ==================== SIDEBAR BADGES ====================

async function updateSidebarBadges() {
  try {
    var [alertsResp, tasksResp, gapsResp] = await Promise.all([
      fetch(API_BASE + '/api/dashboard/summary'),
      fetch(API_BASE + '/api/tasks'),
      fetch(API_BASE + '/api/compliance-gaps')
    ]);
    if (alertsResp.ok) {
      var summary = await alertsResp.json();
      var alertBadge = document.querySelector('.sidebar .nav-link:nth-child(1) .nav-badge');
      if (!alertBadge) {
        var firstLink = document.querySelector('.sidebar .nav-link:nth-child(1)');
        if (firstLink) {
          var badge = document.createElement('span');
          badge.className = 'nav-badge badge bg-danger';
          badge.id = 'sidebarAlertBadge';
          badge.textContent = summary.unread || 0;
          firstLink.appendChild(badge);
        }
      } else {
        alertBadge.textContent = summary.unread || 0;
      }
    }
  } catch (err) { /* silent */ }
}

// ==================== LOGIN ====================

function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value;
  var password = document.getElementById('loginPassword').value;
  var loginError = document.getElementById('loginError');
  loginError.classList.add('d-none');

  fetch(API_BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  })
  .then(function(response) { return response.json().then(function(data) { return { ok: response.ok, data: data }; }); })
  .then(function(result) {
    if (!result.ok) {
      loginError.textContent = result.data.error || 'Login failed';
      loginError.classList.remove('d-none');
      return;
    }
    currentUser = result.data.user;
    document.getElementById('loginOverlay').classList.add('d-none');
    document.getElementById('headerUserBadge').textContent = currentUser.username + ' (' + currentUser.role + ')';
    document.getElementById('logoutBtn').classList.remove('d-none');
    loadAlerts();
    loadSummary();
    showWelcomeBanner();
    updateSidebarBadges();
    updateLastSynced();
    loadDarkModePreference();
  })
  .catch(function() {
    loginError.textContent = 'Cannot connect to server. Is the backend running?';
    loginError.classList.remove('d-none');
  });
}

function logout() {
  currentUser = null;
  document.getElementById('loginOverlay').classList.remove('d-none');
  document.getElementById('headerUserBadge').textContent = '';
  document.getElementById('logoutBtn').classList.add('d-none');
  document.getElementById('loginForm').reset();
}

// ==================== TOAST NOTIFICATION ====================

function showToast(message, type) {
  var toast = document.getElementById('toastNotification');
  var toastMsg = document.getElementById('toastMessage');
  toastMsg.textContent = message;
  toast.className = 'toast align-items-center border-0 text-bg-' + (type || 'success');
  var bsToast = new bootstrap.Toast(toast, { delay: 3000 });
  bsToast.show();
}

// ==================== LOADING SPINNER ====================

function showLoading(containerId) {
  var container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading data...</p></div>';
  }
}

function showEmpty(containerId, message) {
  var container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">' + (message || 'No data found.') + '</td></tr>';
  }
}

// ==================== HELPER FUNCTIONS ====================

function getSeverityClass(severity) {
  if (severity === 'Immediate Action Required') return 'bg-danger';
  if (severity === 'Review Recommended') return 'bg-warning text-dark';
  if (severity === 'Informational') return 'bg-info';
  return 'bg-secondary';
}

function getTaskStatusClass(status) {
  if (status === 'Pending') return 'bg-warning text-dark';
  if (status === 'In Progress') return 'bg-primary';
  if (status === 'Completed') return 'bg-success';
  return 'bg-secondary';
}

function getGapStatusClass(status) {
  if (status === 'Open') return 'bg-danger';
  if (status === 'In Review') return 'bg-warning text-dark';
  if (status === 'Remediated') return 'bg-success';
  return 'bg-secondary';
}

function isDeadlineUrgent(deadline) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return deadlineDate <= threeDaysFromNow;
}

function showError(message) {
  var errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.remove('d-none');
}

function hideError() {
  var errorMsg = document.getElementById('errorMsg');
  errorMsg.classList.add('d-none');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ==================== VIEW SWITCHING (Task 3.1) ====================

function showView(viewName) {
  // Hide welcome banner when navigating
  var welcomeBanner = document.getElementById('welcomeBanner');
  if (welcomeBanner && viewName !== 'alerts') welcomeBanner.classList.add('d-none');

  // Hide all views
  document.querySelectorAll('[id^="view-"]').forEach(function (v) {
    v.classList.add('d-none');
  });
  // Show target view
  document.getElementById('view-' + viewName).classList.remove('d-none');
  // Update sidebar active state
  document.querySelectorAll('.sidebar .nav-link').forEach(function (link) {
    link.classList.remove('active', 'bg-primary', 'rounded');
  });
  // Find the clicked link and make it active
  var links = document.querySelectorAll('.sidebar .nav-link');
  var viewIndex = { alerts: 0, reports: 1, tasks: 2, gaps: 3, sources: 4, regulations: 5, changes: 6, impact: 7, policies: 8, audit: 9 };
  if (links[viewIndex[viewName]]) {
    links[viewIndex[viewName]].classList.add('active', 'bg-primary', 'rounded');
  }
  // Load data for the view
  if (viewName === 'alerts') { loadAlerts(); loadSummary(); }
  if (viewName === 'reports') { loadCategories(); loadTrends(); loadReportsSummary(); loadSeverityPieChart(); loadCategoryBarChart(); loadImpactDoughnutChart(); loadTaskStatusChart(); }
  if (viewName === 'tasks') { loadTasks(); }
  if (viewName === 'gaps') { loadGaps(); }
  if (viewName === 'sources') { loadSources(); }
  if (viewName === 'regulations') { loadRegulations(); loadSourcesDropdown(); }
  if (viewName === 'changes') { loadChanges(); }
  if (viewName === 'impact') { loadImpact(); }
  if (viewName === 'policies') { loadPolicies(); }
  if (viewName === 'audit') { loadAuditLogs(); loadUsersDropdown(); }
}

// ==================== ALERTS VIEW (Task 3.3) ====================

async function loadAlerts() {
  try {
    showLoading('alertsBody');
    var response = await fetch(API_BASE + '/api/alerts');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    allAlerts = await response.json();
    if (allAlerts.length === 0) {
      showEmpty('alertsBody', 'No alerts found.');
    } else {
      renderAlerts(allAlerts);
    }
    hideError();
  } catch (err) {
    showError('Unable to load alert data. Please try again later.');
  }
}

async function loadSummary() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var summary = await response.json();
    document.getElementById('cardTotal').textContent = summary.total || 0;
    document.getElementById('cardUnread').textContent = summary.unread || 0;
    document.getElementById('cardImmediate').textContent = summary.immediate || 0;
    document.getElementById('cardReview').textContent = summary.review || 0;
    document.getElementById('cardInformational').textContent = summary.informational || 0;
  } catch (err) {
    showError('Unable to load summary data. Please try again later.');
  }
}

function renderAlerts(alerts) {
  var tbody = document.getElementById('alertsBody');
  tbody.innerHTML = '';

  if (alerts.length === 0) {
    showEmpty('alertsBody', 'No alerts found.');
    document.getElementById('alertsPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(alerts, alertsPage);

  pageData.forEach(function (alert) {
    var tr = document.createElement('tr');

    // Alert ID
    var tdId = document.createElement('td');
    tdId.textContent = alert.alert_id;
    tr.appendChild(tdId);

    // Regulation Title
    var tdTitle = document.createElement('td');
    tdTitle.textContent = alert.title;
    tr.appendChild(tdTitle);

    // Severity Badge
    var tdSeverity = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge ' + getSeverityClass(alert.severity_level);
    badge.textContent = alert.severity_level;
    tdSeverity.appendChild(badge);
    tr.appendChild(tdSeverity);

    // Status
    var tdStatus = document.createElement('td');
    tdStatus.textContent = alert.status;
    tr.appendChild(tdStatus);

    // Actions - Status dropdown
    var tdActions = document.createElement('td');
    var select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.setAttribute('aria-label', 'Change alert status');

    ['Unread', 'Read', 'Dismissed'].forEach(function (statusOption) {
      var option = document.createElement('option');
      option.value = statusOption;
      option.textContent = statusOption;
      if (alert.status === statusOption) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', function () {
      updateAlertStatus(alert.alert_id, this.value);
    });

    tdActions.appendChild(select);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  // Render pagination
  renderPagination('alertsPagination', alertsPage, alerts.length, function(page) {
    alertsPage = page;
    renderAlerts(alerts);
  });
}

async function updateAlertStatus(alertId, newStatus) {
  try {
    var response = await fetch(API_BASE + '/api/alerts/' + alertId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!response.ok) throw new Error('Failed to update alert status');
    // Update local data
    allAlerts = allAlerts.map(function (a) {
      if (a.alert_id === alertId) {
        return Object.assign({}, a, { status: newStatus });
      }
      return a;
    });
    applyFilters();
    loadSummary();
    showToast('Alert status updated to ' + newStatus, 'success');
  } catch (err) {
    showError('Failed to update alert status. Please try again.');
    showToast('Failed to update alert status', 'danger');
  }
}

// ==================== FILTERING (Task 3.6) ====================

function applyFilters() {
  var severityFilter = document.getElementById('filterSeverity').value;
  var statusFilter = document.getElementById('filterStatus').value;
  var filtered = allAlerts;

  if (severityFilter) {
    filtered = filtered.filter(function (a) {
      return a.severity_level === severityFilter;
    });
  }
  if (statusFilter) {
    filtered = filtered.filter(function (a) {
      return a.status === statusFilter;
    });
  }
  alertsPage = 1; // Reset to page 1 when filtering
  renderAlerts(filtered);
}

// ==================== REPORTS VIEW (Task 3.8) ====================

function showReportTab(tabName) {
  // Hide all report pages
  document.querySelectorAll('[id^="reportPage-"]').forEach(function(el) { el.classList.add('d-none'); });
  // Show target page
  document.getElementById('reportPage-' + tabName).classList.remove('d-none');
  // Update tab active state
  document.querySelectorAll('[id^="reportTab-"]').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('reportTab-' + tabName).classList.add('active');
}

async function loadCategories() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/categories');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var categories = await response.json();
    var tbody = document.getElementById('categoriesBody');
    tbody.innerHTML = '';

    categories.forEach(function (cat) {
      var tr = document.createElement('tr');

      var tdCategory = document.createElement('td');
      tdCategory.textContent = cat.category;
      tr.appendChild(tdCategory);

      var tdCount = document.createElement('td');
      tdCount.textContent = cat.change_count;
      tr.appendChild(tdCount);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load category data. Please try again later.');
  }
}

async function loadTrends() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/trends');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var trends = await response.json();

    var ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trends.map(function (d) { return d.date; }),
        datasets: [{
          label: 'Alerts',
          data: trends.map(function (d) { return d.count; }),
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    showError('Unable to load trend data. Please try again later.');
  }
}

async function loadReportsSummary() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var summary = await response.json();
    var container = document.getElementById('complianceStatus');
    container.innerHTML = '';

    // Unread/Total ratio as progress bar
    var total = summary.total || 0;
    var unread = summary.unread || 0;
    var readPercent = total > 0 ? Math.round(((total - unread) / total) * 100) : 0;

    var ratioDiv = document.createElement('div');
    ratioDiv.className = 'mb-3';
    ratioDiv.innerHTML =
      '<h6 class="fw-semibold">Alert Review Progress</h6>' +
      '<p class="text-muted mb-1">' + (total - unread) + ' of ' + total + ' alerts reviewed (' + readPercent + '%)</p>' +
      '<div class="progress" style="height: 20px;">' +
        '<div class="progress-bar bg-success" role="progressbar" style="width: ' + readPercent + '%;" aria-valuenow="' + readPercent + '" aria-valuemin="0" aria-valuemax="100">' + readPercent + '%</div>' +
      '</div>';
    container.appendChild(ratioDiv);

    // Severity distribution as colored badges with counts
    var distDiv = document.createElement('div');
    distDiv.className = 'mt-3';
    distDiv.innerHTML =
      '<h6 class="fw-semibold">Severity Distribution</h6>' +
      '<span class="badge bg-danger me-2">Immediate: ' + (summary.immediate || 0) + '</span>' +
      '<span class="badge bg-warning text-dark me-2">Review: ' + (summary.review || 0) + '</span>' +
      '<span class="badge bg-info me-2">Informational: ' + (summary.informational || 0) + '</span>';
    container.appendChild(distDiv);
  } catch (err) {
    showError('Unable to load compliance status. Please try again later.');
  }
}

// ==================== ADDITIONAL REPORT CHARTS ====================

var severityPieChart = null;
var categoryBarChart = null;
var impactDoughnutChart = null;
var taskStatusChart = null;

async function loadSeverityPieChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) return;
    var summary = await response.json();

    var ctx = document.getElementById('severityPieChart').getContext('2d');
    if (severityPieChart) severityPieChart.destroy();

    severityPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Immediate Action Required', 'Review Recommended', 'Informational'],
        datasets: [{
          data: [summary.immediate || 0, summary.review || 0, summary.informational || 0],
          backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15 } }
        }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadCategoryBarChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/categories');
    if (!response.ok) return;
    var categories = await response.json();

    var ctx = document.getElementById('categoryBarChart').getContext('2d');
    if (categoryBarChart) categoryBarChart.destroy();

    var colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1', '#0dcaf0', '#fd7e14', '#20c997'];

    categoryBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories.map(function(c) { return c.category; }),
        datasets: [{
          label: 'Regulation Changes',
          data: categories.map(function(c) { return c.change_count; }),
          backgroundColor: categories.map(function(_, i) { return colors[i % colors.length]; }),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadImpactDoughnutChart() {
  try {
    var response = await fetch(API_BASE + '/api/regulation-changes');
    if (!response.ok) return;
    var changes = await response.json();

    var counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    changes.forEach(function(c) { if (counts.hasOwnProperty(c.impact_score)) counts[c.impact_score]++; });

    var ctx = document.getElementById('impactDoughnutChart').getContext('2d');
    if (impactDoughnutChart) impactDoughnutChart.destroy();

    impactDoughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [counts.Critical, counts.High, counts.Medium, counts.Low],
          backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15 } }
        }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadTaskStatusChart() {
  try {
    var response = await fetch(API_BASE + '/api/tasks');
    if (!response.ok) return;
    var tasks = await response.json();

    var counts = { Pending: 0, 'In Progress': 0, Completed: 0 };
    tasks.forEach(function(t) { if (counts.hasOwnProperty(t.status)) counts[t.status]++; });

    var ctx = document.getElementById('taskStatusChart').getContext('2d');
    if (taskStatusChart) taskStatusChart.destroy();

    taskStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Pending', 'In Progress', 'Completed'],
        datasets: [{
          label: 'Tasks',
          data: [counts.Pending, counts['In Progress'], counts.Completed],
          backgroundColor: ['#ffc107', '#0d6efd', '#198754'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (err) { /* silent */ }
}

// ==================== TASKS VIEW (Task 3.9 + 5.8 Enhanced) ====================

async function loadTasks() {
  try {
    showLoading('tasksBody');
    var response = await fetch(API_BASE + '/api/tasks');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var tasks = await response.json();
    var tbody = document.getElementById('tasksBody');
    tbody.innerHTML = '';

    // Populate user dropdown
    try {
      var usersResp = await fetch(API_BASE + '/api/users');
      if (usersResp.ok) {
        var users = await usersResp.json();
        var taskUserSelect = document.getElementById('taskUserSelect');
        taskUserSelect.innerHTML = '<option value="">Select user...</option>';
        users.forEach(function (u) {
          var opt = document.createElement('option');
          opt.value = u.user_id;
          opt.textContent = u.username;
          taskUserSelect.appendChild(opt);
        });
      }
    } catch (e) { /* dropdown population failed silently */ }

    // Populate alert dropdown
    try {
      var alertsResp = await fetch(API_BASE + '/api/alerts');
      if (alertsResp.ok) {
        var alertsList = await alertsResp.json();
        var taskAlertSelect = document.getElementById('taskAlertSelect');
        taskAlertSelect.innerHTML = '<option value="">None</option>';
        alertsList.forEach(function (a) {
          var opt = document.createElement('option');
          opt.value = a.alert_id;
          opt.textContent = a.title || ('Alert #' + a.alert_id);
          taskAlertSelect.appendChild(opt);
        });
      }
    } catch (e) { /* dropdown population failed silently */ }

    tasks.forEach(function (task) {
      var tr = document.createElement('tr');

      // Highlight urgent deadlines
      if (isDeadlineUrgent(task.deadline)) {
        tr.classList.add('table-danger');
      }

      var tdTitle = document.createElement('td');
      tdTitle.textContent = task.title;
      tr.appendChild(tdTitle);

      var tdDesc = document.createElement('td');
      tdDesc.textContent = task.description || '';
      tr.appendChild(tdDesc);

      var tdAssignee = document.createElement('td');
      tdAssignee.textContent = task.assignee;
      tr.appendChild(tdAssignee);

      var tdDeadline = document.createElement('td');
      tdDeadline.textContent = formatDate(task.deadline);
      tr.appendChild(tdDeadline);

      // Status dropdown
      var tdStatus = document.createElement('td');
      var statusSelect = document.createElement('select');
      statusSelect.className = 'form-select form-select-sm';
      statusSelect.setAttribute('aria-label', 'Change task status');
      ['Pending', 'In Progress', 'Completed'].forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (task.status === s) opt.selected = true;
        statusSelect.appendChild(opt);
      });
      statusSelect.addEventListener('change', function () {
        updateTaskStatus(task.task_id, this.value);
      });
      tdStatus.appendChild(statusSelect);
      tr.appendChild(tdStatus);

      // Actions - Delete button
      var tdActions = document.createElement('td');
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deleteTask(task.task_id);
      });
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load task data. Please try again later.');
  }
}

async function submitTask(e) {
  e.preventDefault();
  try {
    var title = document.getElementById('taskTitleInput').value;
    var description = document.getElementById('taskDescInput').value;
    var assigned_to = document.getElementById('taskUserSelect').value;
    var deadline = document.getElementById('taskDeadlineInput').value;
    var alert_id = document.getElementById('taskAlertSelect').value;

    var body = { assigned_to: assigned_to, title: title, deadline: deadline };
    if (description) body.description = description;
    if (alert_id) body.alert_id = alert_id;

    var response = await fetch(API_BASE + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to create task');
    document.getElementById('taskForm').reset();
    loadTasks();
    showToast('Task created successfully', 'success');
  } catch (err) {
    showError('Failed to create task. Please try again.');
    showToast('Failed to create task', 'danger');
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    var response = await fetch(API_BASE + '/api/tasks/' + taskId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (!response.ok) throw new Error('Failed to update task status');
    loadTasks();
  } catch (err) {
    showError('Failed to update task status. Please try again.');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    var response = await fetch(API_BASE + '/api/tasks/' + taskId, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete task');
    loadTasks();
  } catch (err) {
    showError('Failed to delete task. Please try again.');
  }
}

// ==================== GAPS VIEW (Task 3.11 + 5.7 Enhanced) ====================

async function loadGaps() {
  try {
    showLoading('gapsBody');
    var response = await fetch(API_BASE + '/api/compliance-gaps');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var gaps = await response.json();
    var tbody = document.getElementById('gapsBody');
    tbody.innerHTML = '';

    // Populate regulation dropdown
    try {
      var regsResp = await fetch(API_BASE + '/api/regulations');
      if (regsResp.ok) {
        var regs = await regsResp.json();
        var gapRegSelect = document.getElementById('gapRegSelect');
        gapRegSelect.innerHTML = '<option value="">Select regulation...</option>';
        regs.forEach(function (r) {
          var opt = document.createElement('option');
          opt.value = r.reg_id;
          opt.textContent = r.title;
          gapRegSelect.appendChild(opt);
        });
      }
    } catch (e) { /* dropdown population failed silently */ }

    // Populate policy dropdown
    try {
      var polResp = await fetch(API_BASE + '/api/internal-policies');
      if (polResp.ok) {
        var policies = await polResp.json();
        var gapPolicySelect = document.getElementById('gapPolicySelect');
        gapPolicySelect.innerHTML = '<option value="">Select policy...</option>';
        policies.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.policy_id;
          opt.textContent = p.policy_name;
          gapPolicySelect.appendChild(opt);
        });
      }
    } catch (e) { /* dropdown population failed silently */ }

    gaps.forEach(function (gap) {
      var tr = document.createElement('tr');

      var tdReg = document.createElement('td');
      tdReg.textContent = gap.regulation_title;
      tr.appendChild(tdReg);

      var tdPolicy = document.createElement('td');
      tdPolicy.textContent = gap.policy_name;
      tr.appendChild(tdPolicy);

      var tdDesc = document.createElement('td');
      tdDesc.textContent = gap.gap_description;
      tr.appendChild(tdDesc);

      // Status dropdown
      var tdStatus = document.createElement('td');
      var statusSelect = document.createElement('select');
      statusSelect.className = 'form-select form-select-sm';
      statusSelect.setAttribute('aria-label', 'Change gap status');
      ['Open', 'In Review', 'Remediated'].forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (gap.status === s) opt.selected = true;
        statusSelect.appendChild(opt);
      });
      statusSelect.addEventListener('change', function () {
        updateGapStatus(gap.gap_id, this.value);
      });
      tdStatus.appendChild(statusSelect);
      tr.appendChild(tdStatus);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(gap.identified_at);
      tr.appendChild(tdDate);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load compliance gap data. Please try again later.');
  }
}

async function submitGap(e) {
  e.preventDefault();
  try {
    var reg_id = document.getElementById('gapRegSelect').value;
    var policy_id = document.getElementById('gapPolicySelect').value;
    var gap_description = document.getElementById('gapDescInput').value;

    var response = await fetch(API_BASE + '/api/compliance-gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_id: reg_id, policy_id: policy_id, gap_description: gap_description })
    });
    if (!response.ok) throw new Error('Failed to create gap');
    document.getElementById('gapForm').reset();
    loadGaps();
    showToast('Compliance gap created successfully', 'success');
  } catch (err) {
    showError('Failed to create compliance gap. Please try again.');
    showToast('Failed to create gap', 'danger');
  }
}

async function updateGapStatus(gapId, status) {
  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps/' + gapId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (!response.ok) throw new Error('Failed to update gap status');
    loadGaps();
  } catch (err) {
    showError('Failed to update gap status. Please try again.');
  }
}

// ==================== SOURCES VIEW (Task 5.2) ====================

async function loadSources() {
  try {
    showLoading('sourcesBody');
    var response = await fetch(API_BASE + '/api/regulatory-sources');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var sources = await response.json();
    var tbody = document.getElementById('sourcesBody');
    tbody.innerHTML = '';

    if (sources.length === 0) {
      showEmpty('sourcesBody', 'No regulatory sources found.');
      return;
    }

    sources.forEach(function (source) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = source.source_name;
      tr.appendChild(tdName);

      var tdUrl = document.createElement('td');
      tdUrl.textContent = source.base_url;
      tr.appendChild(tdUrl);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(source.created_at);
      tr.appendChild(tdDate);

      var tdActions = document.createElement('td');
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-warning btn-sm me-1';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function() { editSource(source); });
      tdActions.appendChild(editBtn);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function() { deleteSource(source.source_id); });
      tdActions.appendChild(deleteBtn);

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load sources data. Please try again later.');
  }
}

function editSource(source) {
  document.getElementById('editSourceSection').classList.remove('d-none');
  document.getElementById('editSourceName').value = source.source_name || '';
  document.getElementById('editSourceUrl').value = source.base_url || '';
  document.getElementById('editSourceId').value = source.source_id;
}

async function submitSourceEdit() {
  try {
    var id = document.getElementById('editSourceId').value;
    var source_name = document.getElementById('editSourceName').value;
    var base_url = document.getElementById('editSourceUrl').value;
    var body = {};
    if (source_name) body.source_name = source_name;
    if (base_url) body.base_url = base_url;

    var response = await fetch(API_BASE + '/api/regulatory-sources/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update source');
    document.getElementById('editSourceSection').classList.add('d-none');
    loadSources();
    showToast('Source updated successfully', 'success');
  } catch (err) {
    showToast('Failed to update source', 'danger');
  }
}

function cancelSourceEdit() {
  document.getElementById('editSourceSection').classList.add('d-none');
}

async function deleteSource(sourceId) {
  if (!confirm('Are you sure you want to delete this source? This will also delete all regulations linked to it.')) return;
  try {
    var response = await fetch(API_BASE + '/api/regulatory-sources/' + sourceId, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete source');
    loadSources();
    showToast('Source deleted successfully', 'success');
  } catch (err) {
    showToast('Failed to delete source', 'danger');
  }
}

async function submitSource(e) {
  e.preventDefault();
  try {
    var source_name = document.getElementById('sourceNameInput').value;
    var base_url = document.getElementById('sourceUrlInput').value;

    var response = await fetch(API_BASE + '/api/regulatory-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_name: source_name, base_url: base_url })
    });
    if (!response.ok) throw new Error('Failed to create source');
    document.getElementById('sourceForm').reset();
    loadSources();
    showToast('Regulatory source added successfully', 'success');
  } catch (err) {
    showError('Failed to create source. Please try again.');
    showToast('Failed to create source', 'danger');
  }
}

// ==================== REGULATIONS VIEW (Task 5.3) ====================

var editRegId = null;

async function loadRegulations() {
  try {
    showLoading('regulationsBody');
    var url = API_BASE + '/api/regulations?page=' + regCurrentPage + '&limit=20';
    if (regSearchQuery) url += '&search=' + encodeURIComponent(regSearchQuery);
    var response = await fetch(url);
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var result = await response.json();
    var regulations = result.data || result;
    var tbody = document.getElementById('regulationsBody');
    tbody.innerHTML = '';

    if (regulations.length === 0) {
      showEmpty('regulationsBody', 'No regulations found.');
      return;
    }

    // Update pagination controls using renderPagination
    if (result.totalPages) {
      regTotalPages = result.totalPages;
      var totalItems = result.total || 0;
      renderPagination('regPagination', regCurrentPage, totalItems, function(page) {
        regCurrentPage = page;
        loadRegulations();
      });
    }

    regulations.forEach(function (reg) {
      var tr = document.createElement('tr');

      var tdTitle = document.createElement('td');
      tdTitle.textContent = reg.title;
      tr.appendChild(tdTitle);

      var tdSource = document.createElement('td');
      tdSource.textContent = reg.source_name;
      tr.appendChild(tdSource);

      var tdCategory = document.createElement('td');
      tdCategory.textContent = reg.category;
      tr.appendChild(tdCategory);

      var tdVersion = document.createElement('td');
      tdVersion.textContent = reg.version;
      tr.appendChild(tdVersion);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(reg.published_date);
      tr.appendChild(tdDate);

      var tdActions = document.createElement('td');
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-warning btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        editRegulation(reg);
      });
      tdActions.appendChild(editBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load regulations data. Please try again later.');
  }
}

async function loadSourcesDropdown() {
  try {
    var response = await fetch(API_BASE + '/api/regulatory-sources');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var sources = await response.json();

    var regSourceSelect = document.getElementById('regSourceSelect');
    regSourceSelect.innerHTML = '<option value="">Select source...</option>';
    sources.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.source_id;
      opt.textContent = s.source_name;
      regSourceSelect.appendChild(opt);
    });

    var editRegSourceSelect = document.getElementById('editRegSourceSelect');
    editRegSourceSelect.innerHTML = '<option value="">Select source...</option>';
    sources.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.source_id;
      opt.textContent = s.source_name;
      editRegSourceSelect.appendChild(opt);
    });
  } catch (err) {
    showError('Unable to load sources for dropdown. Please try again later.');
  }
}

async function submitRegulation(e) {
  e.preventDefault();
  try {
    var source_id = document.getElementById('regSourceSelect').value;
    var title = document.getElementById('regTitleInput').value;
    var category = document.getElementById('regCategoryInput').value;
    var content = document.getElementById('regContentInput').value;
    var version = document.getElementById('regVersionInput').value;
    var published_date = document.getElementById('regDateInput').value;

    var body = { source_id: source_id, title: title, category: category, content: content };
    if (version) body.version = version;
    if (published_date) body.published_date = published_date;

    var response = await fetch(API_BASE + '/api/regulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to create regulation');
    document.getElementById('regulationForm').reset();
    loadRegulations();
  } catch (err) {
    showError('Failed to create regulation. Please try again.');
  }
}

function editRegulation(reg) {
  document.getElementById('editRegSection').classList.remove('d-none');
  document.getElementById('editRegTitle').value = reg.title || '';
  document.getElementById('editRegCategory').value = reg.category || '';
  document.getElementById('editRegContent').value = reg.content || '';
  document.getElementById('editRegVersion').value = reg.version || '';
  document.getElementById('editRegDate').value = reg.published_date ? reg.published_date.substring(0, 10) : '';
  document.getElementById('editRegId').value = reg.reg_id;
  editRegId = reg.reg_id;
}

async function submitRegulationEdit() {
  try {
    var id = editRegId || document.getElementById('editRegId').value;
    var title = document.getElementById('editRegTitle').value;
    var category = document.getElementById('editRegCategory').value;
    var content = document.getElementById('editRegContent').value;
    var version = document.getElementById('editRegVersion').value;
    var published_date = document.getElementById('editRegDate').value;

    var body = {};
    if (title) body.title = title;
    if (category) body.category = category;
    if (content) body.content = content;
    if (version) body.version = version;
    if (published_date) body.published_date = published_date;

    var response = await fetch(API_BASE + '/api/regulations/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update regulation');
    document.getElementById('editRegSection').classList.add('d-none');
    editRegId = null;
    loadRegulations();
  } catch (err) {
    showError('Failed to update regulation. Please try again.');
  }
}

function cancelRegulationEdit() {
  document.getElementById('editRegSection').classList.add('d-none');
  editRegId = null;
}

// ==================== REGULATIONS PAGINATION & SEARCH ====================

function changeRegPage(delta) {
  regCurrentPage += delta;
  if (regCurrentPage < 1) regCurrentPage = 1;
  if (regCurrentPage > regTotalPages) regCurrentPage = regTotalPages;
  loadRegulations();
}

function searchRegulations() {
  regSearchQuery = document.getElementById('regSearchInput').value;
  regCurrentPage = 1;
  loadRegulations();
}

function clearRegSearch() {
  document.getElementById('regSearchInput').value = '';
  regSearchQuery = '';
  regCurrentPage = 1;
  loadRegulations();
}

// ==================== CHANGES VIEW (Task 5.4) ====================

function getImpactClass(impact) {
  if (impact === 'Critical') return 'bg-danger';
  if (impact === 'High') return 'bg-warning text-dark';
  if (impact === 'Medium') return 'bg-info';
  if (impact === 'Low') return 'bg-success';
  return 'bg-secondary';
}

var allChangesData = [];
var changesFilter = '';

async function loadChanges() {
  try {
    showLoading('changesBody');
    var response = await fetch(API_BASE + '/api/regulation-changes');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    allChangesData = await response.json();
    renderChangesTable();
  } catch (err) {
    showError('Unable to load regulation changes. Please try again later.');
  }
}

function filterChanges(level) {
  changesFilter = level;
  changesPage = 1;
  renderChangesTable();
}

function renderChangesTable() {
  var changes = allChangesData;

  // Apply impact filter
  if (changesFilter) {
    changes = changes.filter(function(c) { return c.impact_score === changesFilter; });
  }

  var tbody = document.getElementById('changesBody');
  tbody.innerHTML = '';

  if (changes.length === 0) {
    showEmpty('changesBody', 'No regulation changes found for the selected filter.');
    document.getElementById('changesPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(changes, changesPage);

  pageData.forEach(function (change) {
    var tr = document.createElement('tr');

    var tdTitle = document.createElement('td');
    tdTitle.textContent = change.regulation_title;
    tr.appendChild(tdTitle);

    var tdPrev = document.createElement('td');
    tdPrev.textContent = change.previous_version;
    tr.appendChild(tdPrev);

    var tdNew = document.createElement('td');
    tdNew.textContent = change.new_version;
    tr.appendChild(tdNew);

    var tdImpact = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge ' + getImpactClass(change.impact_score);
    badge.textContent = change.impact_score;
    tdImpact.appendChild(badge);
    tr.appendChild(tdImpact);

    var tdDiff = document.createElement('td');
    tdDiff.textContent = change.semantic_differences;
    tr.appendChild(tdDiff);

    var tdDate = document.createElement('td');
    tdDate.textContent = formatDate(change.detected_at);
    tr.appendChild(tdDate);

    tbody.appendChild(tr);
  });

  renderPagination('changesPagination', changesPage, changes.length, function(page) {
    changesPage = page;
    renderChangesTable();
  });
}

// ==================== IMPACT VIEW (Task 5.5) ====================

var allImpactData = [];

async function loadImpact() {
  try {
    var response = await fetch(API_BASE + '/api/regulation-changes');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var changes = await response.json();
    allImpactData = changes;

    // Compute counts per impact level
    var counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    changes.forEach(function (c) {
      if (counts.hasOwnProperty(c.impact_score)) {
        counts[c.impact_score]++;
      }
    });

    document.getElementById('impactCritical').textContent = counts.Critical;
    document.getElementById('impactHigh').textContent = counts.High;
    document.getElementById('impactMedium').textContent = counts.Medium;
    document.getElementById('impactLow').textContent = counts.Low;

    renderImpactTable();
  } catch (err) {
    showError('Unable to load impact data. Please try again later.');
  }
}

function filterImpact(level) {
  impactFilter = level;
  impactPage = 1;
  renderImpactTable();
}

function renderImpactTable() {
  var changes = allImpactData;

  // Apply filter
  if (impactFilter) {
    changes = changes.filter(function(c) { return c.impact_score === impactFilter; });
  }

  // Sort by severity: Critical > High > Medium > Low
  var IMPACT_ORDER = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
  changes.sort(function (a, b) {
    return (IMPACT_ORDER[a.impact_score] || 4) - (IMPACT_ORDER[b.impact_score] || 4);
  });

  var tbody = document.getElementById('impactBody');
  tbody.innerHTML = '';

  if (changes.length === 0) {
    showEmpty('impactBody', 'No impact data found for the selected filter.');
    document.getElementById('impactPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(changes, impactPage);

  pageData.forEach(function (change) {
    var tr = document.createElement('tr');

    if (change.impact_score === 'Critical') {
      tr.classList.add('table-danger');
    } else if (change.impact_score === 'High') {
      tr.classList.add('table-warning');
    }

    var tdTitle = document.createElement('td');
    tdTitle.textContent = change.regulation_title;
    tr.appendChild(tdTitle);

    var tdVersion = document.createElement('td');
    tdVersion.textContent = change.previous_version + ' → ' + change.new_version;
    tr.appendChild(tdVersion);

    var tdImpact = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge ' + getImpactClass(change.impact_score);
    badge.textContent = change.impact_score;
    tdImpact.appendChild(badge);
    tr.appendChild(tdImpact);

    var tdDiff = document.createElement('td');
    tdDiff.textContent = change.semantic_differences;
    tr.appendChild(tdDiff);

    var tdDate = document.createElement('td');
    tdDate.textContent = formatDate(change.detected_at);
    tr.appendChild(tdDate);

    tbody.appendChild(tr);
  });

  renderPagination('impactPagination', impactPage, changes.length, function(page) {
    impactPage = page;
    renderImpactTable();
  });
}

// ==================== POLICIES VIEW (Task 5.6) ====================

async function loadPolicies() {
  try {
    showLoading('policiesBody');
    var response = await fetch(API_BASE + '/api/internal-policies');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var policies = await response.json();
    var tbody = document.getElementById('policiesBody');
    tbody.innerHTML = '';

    if (policies.length === 0) {
      showEmpty('policiesBody', 'No policies found.');
      return;
    }

    policies.forEach(function (policy) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = policy.policy_name;
      tr.appendChild(tdName);

      var tdDesc = document.createElement('td');
      tdDesc.textContent = policy.description;
      tr.appendChild(tdDesc);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(policy.last_updated);
      tr.appendChild(tdDate);

      var tdActions = document.createElement('td');
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-warning btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () {
        editPolicy(policy);
      });
      tdActions.appendChild(editBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load policies data. Please try again later.');
  }
}

async function submitPolicy(e) {
  e.preventDefault();
  try {
    var policy_name = document.getElementById('policyNameInput').value;
    var description = document.getElementById('policyDescInput').value;

    var response = await fetch(API_BASE + '/api/internal-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_name: policy_name, description: description })
    });
    if (!response.ok) throw new Error('Failed to create policy');
    document.getElementById('policyForm').reset();
    loadPolicies();
    showToast('Policy created successfully', 'success');
  } catch (err) {
    showError('Failed to create policy. Please try again.');
    showToast('Failed to create policy', 'danger');
  }
}

function editPolicy(policy) {
  document.getElementById('editPolicySection').classList.remove('d-none');
  document.getElementById('editPolicyName').value = policy.policy_name || '';
  document.getElementById('editPolicyDesc').value = policy.description || '';
  document.getElementById('editPolicyId').value = policy.policy_id;
}

async function submitPolicyEdit() {
  try {
    var id = document.getElementById('editPolicyId').value;
    var policy_name = document.getElementById('editPolicyName').value;
    var description = document.getElementById('editPolicyDesc').value;

    var body = {};
    if (policy_name) body.policy_name = policy_name;
    if (description) body.description = description;

    var response = await fetch(API_BASE + '/api/internal-policies/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update policy');
    document.getElementById('editPolicySection').classList.add('d-none');
    loadPolicies();
    showToast('Policy updated successfully', 'success');
  } catch (err) {
    showError('Failed to update policy. Please try again.');
    showToast('Failed to update policy', 'danger');
  }
}

function cancelPolicyEdit() {
  document.getElementById('editPolicySection').classList.add('d-none');
}

// ==================== AUDIT TRAIL VIEW (Task 5.9) ====================

async function loadAuditLogs(filters) {
  try {
    showLoading('auditBody');
    var url = API_BASE + '/api/audit-logs';
    if (filters) {
      var params = [];
      if (filters.user_id) params.push('user_id=' + encodeURIComponent(filters.user_id));
      if (filters.action_type) params.push('action_type=' + encodeURIComponent(filters.action_type));
      if (filters.target_table) params.push('target_table=' + encodeURIComponent(filters.target_table));
      if (filters.start_date) params.push('start_date=' + encodeURIComponent(filters.start_date));
      if (filters.end_date) params.push('end_date=' + encodeURIComponent(filters.end_date));
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
    }

    var response = await fetch(url);
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var logs = await response.json();
    var tbody = document.getElementById('auditBody');
    tbody.innerHTML = '';

    logs.forEach(function (log) {
      var tr = document.createElement('tr');

      var tdUser = document.createElement('td');
      tdUser.textContent = log.username;
      tr.appendChild(tdUser);

      var tdAction = document.createElement('td');
      tdAction.textContent = log.action_type;
      tr.appendChild(tdAction);

      var tdTable = document.createElement('td');
      tdTable.textContent = log.target_table;
      tr.appendChild(tdTable);

      var tdTarget = document.createElement('td');
      tdTarget.textContent = log.target_id;
      tr.appendChild(tdTarget);

      var tdDesc = document.createElement('td');
      tdDesc.textContent = log.description;
      tr.appendChild(tdDesc);

      var tdTime = document.createElement('td');
      tdTime.textContent = formatDate(log.timestamp);
      tr.appendChild(tdTime);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load audit logs. Please try again later.');
  }
}

async function loadUsersDropdown() {
  try {
    var response = await fetch(API_BASE + '/api/users');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var users = await response.json();
    var auditUserSelect = document.getElementById('auditUserSelect');
    auditUserSelect.innerHTML = '<option value="">All Users</option>';
    users.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.user_id;
      opt.textContent = u.username;
      auditUserSelect.appendChild(opt);
    });
  } catch (err) {
    showError('Unable to load users for dropdown. Please try again later.');
  }
}

function applyAuditFilters() {
  var filters = {};
  var userId = document.getElementById('auditUserSelect').value;
  var actionType = document.getElementById('auditActionType').value;
  var targetTable = document.getElementById('auditTargetTable').value;
  var startDate = document.getElementById('auditStartDate').value;
  var endDate = document.getElementById('auditEndDate').value;

  if (userId) filters.user_id = userId;
  if (actionType) filters.action_type = actionType;
  if (targetTable) filters.target_table = targetTable;
  if (startDate) filters.start_date = startDate;
  if (endDate) filters.end_date = endDate;

  loadAuditLogs(filters);
}

function clearAuditFilters() {
  document.getElementById('auditUserSelect').value = '';
  document.getElementById('auditActionType').value = '';
  document.getElementById('auditTargetTable').value = '';
  document.getElementById('auditStartDate').value = '';
  document.getElementById('auditEndDate').value = '';
  loadAuditLogs();
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function () {
  // Attach login handler
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Attach filter event listeners
  document.getElementById('filterSeverity').addEventListener('change', applyFilters);
  document.getElementById('filterStatus').addEventListener('change', applyFilters);

  // Attach form submit handlers for new views
  document.getElementById('sourceForm').addEventListener('submit', submitSource);
  document.getElementById('regulationForm').addEventListener('submit', submitRegulation);
  document.getElementById('gapForm').addEventListener('submit', submitGap);
  document.getElementById('taskForm').addEventListener('submit', submitTask);

  // Attach click handlers for regulation edit
  document.getElementById('editRegUpdateBtn').addEventListener('click', submitRegulationEdit);
  document.getElementById('editRegCancelBtn').addEventListener('click', cancelRegulationEdit);

  // Attach handlers for policy CRUD
  document.getElementById('policyForm').addEventListener('submit', submitPolicy);
  document.getElementById('editPolicyUpdateBtn').addEventListener('click', submitPolicyEdit);
  document.getElementById('editPolicyCancelBtn').addEventListener('click', cancelPolicyEdit);

  // Attach handlers for source edit
  document.getElementById('editSourceUpdateBtn').addEventListener('click', submitSourceEdit);
  document.getElementById('editSourceCancelBtn').addEventListener('click', cancelSourceEdit);

  // Attach click handlers for audit filters
  document.getElementById('auditApplyBtn').addEventListener('click', applyAuditFilters);
  document.getElementById('auditClearBtn').addEventListener('click', clearAuditFilters);
});
