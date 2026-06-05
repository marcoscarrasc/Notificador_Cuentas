// State management
let bills = [];
let settings = {};
let whatsappStatus = { status: 'DISCONNECTED', qr: '', connectionInfo: null };
let currentFilter = 'all';
let currentTab = 'dashboard';
let isEditing = false;

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const whatsappQuickStatus = document.getElementById('whatsapp-quick-status');

// Stat Elements
const statPendingAmount = document.getElementById('stat-pending-amount');
const statPendingCount = document.getElementById('stat-pending-count');
const statOverdueAmount = document.getElementById('stat-overdue-amount');
const statOverdueCount = document.getElementById('stat-overdue-count');
const statPaidAmount = document.getElementById('stat-paid-amount');
const statPaidCount = document.getElementById('stat-paid-count');

// Dashboard Elements
const upcomingBillsList = document.getElementById('upcoming-bills-list');
const whatsappDashboardPanel = document.getElementById('whatsapp-dashboard-panel');
const linkViewAllBills = document.getElementById('link-view-all-bills');

// Bills Table Elements
const billsTableBody = document.getElementById('bills-table-body');
const billSearchInput = document.getElementById('bill-search');
const filterBtns = document.querySelectorAll('.filter-btn');

// Settings Elements
const settingsForm = document.getElementById('settings-form');
const settingsCurrency = document.getElementById('settings-currency');
const settingsTime = document.getElementById('settings-time');
const settingsDefaultPhone = document.getElementById('settings-default-phone');
const settingsNotifyDue = document.getElementById('settings-notify-due');
const settingsDaysBefore = document.getElementById('settings-days-before');
const settingsTemplate = document.getElementById('settings-template');
const varBadges = document.querySelectorAll('.var-badge');
const testMessageForm = document.getElementById('test-message-form');
const testPhoneInput = document.getElementById('test-phone');
const testMessageInput = document.getElementById('test-message');

// WhatsApp Dedicated Tab Elements
const whatsappFullPanel = document.getElementById('whatsapp-full-panel');

// Modal Elements
const billModal = document.getElementById('bill-modal');
const billForm = document.getElementById('bill-form');
const billIdInput = document.getElementById('bill-id');
const billNameInput = document.getElementById('bill-name');
const billAmountInput = document.getElementById('bill-amount');
const billDueDateInput = document.getElementById('bill-due-date');
const billPhoneInput = document.getElementById('bill-phone');
const modalTitle = document.getElementById('modal-title');
const btnOpenAddModal = document.getElementById('btn-open-add-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

// Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle2';
  if (type === 'error') iconName = 'alert-triangle';
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <i data-lucide="${iconName}"></i>
      <span class="toast-message">${message}</span>
    </div>
    <button class="btn-close" onclick="this.parentElement.remove()">
      <i data-lucide="x"></i>
    </button>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Auto remove toast
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Navigation & Tab Switching
function switchTab(tabId) {
  currentTab = tabId;
  
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Dynamic Header Updates
  if (tabId === 'dashboard') {
    pageTitle.textContent = 'Panel de Control';
    pageSubtitle.textContent = 'Monitorea tus pagos pendientes y alertas de WhatsApp.';
  } else if (tabId === 'bills') {
    pageTitle.textContent = 'Gestionar Cuentas';
    pageSubtitle.textContent = 'Agrega, edita y registra tus cuentas pendientes o pagadas.';
  } else if (tabId === 'settings') {
    pageTitle.textContent = 'Configuración';
    pageSubtitle.textContent = 'Ajusta los parámetros de las notificaciones de WhatsApp.';
  } else if (tabId === 'whatsapp') {
    pageTitle.textContent = 'Conexión de WhatsApp';
    pageSubtitle.textContent = 'Vincular tu cuenta por medio de WhatsApp Web.';
  }
  
  lucide.createIcons();
}

// Attach Tab Listeners
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tabId = item.getAttribute('data-tab');
    switchTab(tabId);
  });
});

linkViewAllBills.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('bills');
});

// Modal Logic
function openModal(editMode = false, bill = null) {
  isEditing = editMode;
  billModal.classList.add('open');
  
  if (editMode && bill) {
    modalTitle.textContent = 'Editar Cuenta';
    billIdInput.value = bill.id;
    billNameInput.value = bill.name;
    billAmountInput.value = bill.amount;
    billDueDateInput.value = bill.dueDate;
    billPhoneInput.value = bill.phoneNumber || '';
  } else {
    modalTitle.textContent = 'Agregar Nueva Cuenta';
    billForm.reset();
    billIdInput.value = '';
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    billDueDateInput.value = today;
  }
}

function closeModal() {
  billModal.classList.remove('open');
  billForm.reset();
  isEditing = false;
}

btnOpenAddModal.addEventListener('click', () => openModal(false));
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

// Close modal when clicking outside content
billModal.addEventListener('click', (e) => {
  if (e.target === billModal) {
    closeModal();
  }
});

// API Calls
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Algo salió mal');
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error (${url}):`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

// Fetch all initial data
async function loadAllData() {
  try {
    const [billsData, settingsData] = await Promise.all([
      apiFetch('/api/bills'),
      apiFetch('/api/settings')
    ]);
    
    bills = billsData;
    settings = settingsData;
    
    renderDashboard();
    renderBillsTable();
    populateSettingsForm();
  } catch (err) {
    console.error('Error al cargar datos iniciales:', err);
  }
}

// Date helpers
function getDaysRemaining(dueDateStr) {
  const today = new Date(new Date().toISOString().split('T')[0]);
  const dueDate = new Date(dueDateStr);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatDateDisplay(dateStr) {
  // dateStr is YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getMonthShort(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const monthIndex = parseInt(parts[1], 10) - 1;
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[monthIndex] || '';
}

function getDayNum(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  return parts[2];
}

// Stats Calculation and Rendering
function renderDashboard() {
  const currency = settings.currency || 'S/.';
  
  // Calculate statistics
  let pendingAmount = 0;
  let pendingCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let paidAmount = 0;
  let paidCount = 0;

  bills.forEach(bill => {
    const amt = parseFloat(bill.amount) || 0;
    if (bill.status === 'paid') {
      paidAmount += amt;
      paidCount++;
    } else {
      const days = getDaysRemaining(bill.dueDate);
      if (days < 0) {
        overdueAmount += amt;
        overdueCount++;
      } else {
        pendingAmount += amt;
        pendingCount++;
      }
    }
  });

  // Update Stats DOM
  statPendingAmount.textContent = `${currency} ${pendingAmount.toFixed(2)}`;
  statPendingCount.textContent = `${pendingCount} cuenta${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`;
  
  statOverdueAmount.textContent = `${currency} ${overdueAmount.toFixed(2)}`;
  statOverdueCount.textContent = `${overdueCount} cuenta${overdueCount === 1 ? '' : 's'} vencida${overdueCount === 1 ? '' : 's'}`;

  statPaidAmount.textContent = `${currency} ${paidAmount.toFixed(2)}`;
  statPaidCount.textContent = `${paidCount} cuenta${paidCount === 1 ? '' : 's'} pagada${paidCount === 1 ? '' : 's'}`;

  // Populate Dashboard Upcoming Bills
  const upcomingBills = bills
    .filter(b => b.status === 'pending')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  if (upcomingBills.length === 0) {
    upcomingBillsList.innerHTML = `
      <div class="py-4 text-center text-muted">
        <i data-lucide="check-circle" style="width: 36px; height: 36px; margin-bottom: 0.5rem; display: block; margin-left: auto; margin-right: auto; color: var(--color-paid);"></i>
        <p>¡Todo al día! No hay cuentas pendientes.</p>
      </div>
    `;
  } else {
    upcomingBillsList.innerHTML = upcomingBills.map(bill => {
      const days = getDaysRemaining(bill.dueDate);
      let statusTag = '';
      
      if (days < 0) {
        statusTag = `<span class="status-tag overdue">Vencida</span>`;
      } else if (days === 0) {
        statusTag = `<span class="status-tag overdue">Vence Hoy</span>`;
      } else {
        statusTag = `<span class="status-tag pending">En ${days} día${days === 1 ? '' : 's'}</span>`;
      }

      return `
        <div class="bill-preview-item">
          <div class="item-left">
            <div class="item-badge-date">
              <span class="day">${getDayNum(bill.dueDate)}</span>
              <span class="month">${getMonthShort(bill.dueDate)}</span>
            </div>
            <div class="item-title-block">
              <h4>${bill.name}</h4>
              <p><i data-lucide="phone"></i> ${bill.phoneNumber || settings.defaultPhoneNumber || 'No configurado'}</p>
            </div>
          </div>
          <div class="item-right">
            <span class="item-amount">${currency} ${bill.amount.toFixed(2)}</span>
            ${statusTag}
          </div>
        </div>
      `;
    }).join('');
  }
  lucide.createIcons();
}

// Render Bills Table
function renderBillsTable() {
  const currency = settings.currency || 'S/.';
  const searchTerm = billSearchInput.value.toLowerCase();
  
  let filteredBills = bills.filter(bill => {
    // Search text filter
    const matchesSearch = bill.name.toLowerCase().includes(searchTerm);
    if (!matchesSearch) return false;
    
    // Status button filter
    if (currentFilter === 'all') return true;
    if (currentFilter === 'paid') return bill.status === 'paid';
    
    const days = getDaysRemaining(bill.dueDate);
    if (currentFilter === 'pending') return bill.status === 'pending' && days >= 0;
    if (currentFilter === 'overdue') return bill.status === 'pending' && days < 0;
    
    return true;
  });

  // Sort: Pending/Overdue first, then by date (soonest first). Paid last.
  filteredBills.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  if (filteredBills.length === 0) {
    billsTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">No se encontraron cuentas con los filtros actuales.</td>
      </tr>
    `;
    return;
  }

  billsTableBody.innerHTML = filteredBills.map(bill => {
    const days = getDaysRemaining(bill.dueDate);
    let daysBadge = '';
    let statusClass = '';
    let statusLabel = '';
    let actionsHtml = '';

    if (bill.status === 'paid') {
      daysBadge = `<span class="days-badge ok">Pagado</span>`;
      statusClass = 'paid';
      statusLabel = 'Pagado';
      actionsHtml = `
        <button class="action-btn btn-unpay-action" title="Marcar como Pendiente" onclick="toggleBillStatus('${bill.id}', 'pending')">
          <i data-lucide="rotate-ccw"></i>
        </button>
      `;
    } else {
      statusClass = days < 0 ? 'overdue' : 'pending';
      statusLabel = days < 0 ? 'Vencido' : 'Pendiente';
      
      if (days < 0) {
        daysBadge = `<span class="days-badge critical">Hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}</span>`;
      } else if (days === 0) {
        daysBadge = `<span class="days-badge critical">Vence Hoy</span>`;
      } else {
        daysBadge = `<span class="days-badge ${days <= 2 ? 'warning' : 'ok'}">${days} día${days === 1 ? '' : 's'}</span>`;
      }

      actionsHtml = `
        <button class="action-btn btn-pay-action" title="Marcar como Pagado" onclick="toggleBillStatus('${bill.id}', 'paid')">
          <i data-lucide="check"></i>
        </button>
      `;
    }

    // Check notification status tags
    const notifiedDueTag = bill.notifiedDueDate 
      ? `<span class="notif-tag yes" title="${bill.notificationLog?.find(l=>l.type.includes('vence hoy'))?.timestamp || ''}">Hoy</span>` 
      : `<span class="notif-tag no">Hoy</span>`;
      
    const notifiedBeforeTag = bill.notifiedDaysBefore 
      ? `<span class="notif-tag yes" title="${bill.notificationLog?.find(l=>l.type.includes('vence en'))?.timestamp || ''}">Anticip.</span>` 
      : `<span class="notif-tag no">Anticip.</span>`;

    const recipientPhone = bill.phoneNumber || settings.defaultPhoneNumber || '';
    const formattedRecipient = recipientPhone ? `+${recipientPhone.replace(/\D/g, '')}` : '<span class="text-muted">Ninguno</span>';

    return `
      <tr>
        <td style="font-weight: 600;">${bill.name}</td>
        <td style="font-weight: 600;">${currency} ${bill.amount.toFixed(2)}</td>
        <td>${formatDateDisplay(bill.dueDate)}</td>
        <td>${daysBadge}</td>
        <td>${formattedRecipient}</td>
        <td>
          <div style="display: flex; gap: 0.25rem;">
            ${notifiedBeforeTag}
            ${notifiedDueTag}
          </div>
        </td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="table-actions">
            ${actionsHtml}
            <button class="action-btn btn-edit-action" title="Editar Cuenta" onclick="editBill('${bill.id}')">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn btn-delete-action" title="Eliminar Cuenta" onclick="deleteBill('${bill.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

// Search and filter interactions
billSearchInput.addEventListener('input', renderBillsTable);

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-filter');
    renderBillsTable();
  });
});

// Bill status toggling (Paid / Pending)
window.toggleBillStatus = async function(id, newStatus) {
  try {
    const updated = await apiFetch(`/api/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    // Update local state
    const index = bills.findIndex(b => b.id === id);
    if (index !== -1) {
      bills[index] = updated;
      renderDashboard();
      renderBillsTable();
      showToast(`Cuenta marcada como ${newStatus === 'paid' ? 'PAGADA' : 'PENDIENTE'}.`, 'success');
    }
  } catch (err) {
    console.error('Error al cambiar estado de cuenta:', err);
  }
};

// Edit Bill Click Handler
window.editBill = function(id) {
  const bill = bills.find(b => b.id === id);
  if (bill) {
    openModal(true, bill);
  }
};

// Delete Bill Click Handler
window.deleteBill = async function(id) {
  const bill = bills.find(b => b.id === id);
  if (!bill) return;
  
  if (confirm(`¿Estás seguro de eliminar la cuenta "${bill.name}"?`)) {
    try {
      await apiFetch(`/api/bills/${id}`, { method: 'DELETE' });
      bills = bills.filter(b => b.id !== id);
      renderDashboard();
      renderBillsTable();
      showToast(`Cuenta "${bill.name}" eliminada.`, 'info');
    } catch (err) {
      console.error('Error al eliminar cuenta:', err);
    }
  }
};

// Submit Bill Form
billForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    name: billNameInput.value,
    amount: parseFloat(billAmountInput.value),
    dueDate: billDueDateInput.value,
    phoneNumber: billPhoneInput.value
  };

  try {
    if (isEditing) {
      const id = billIdInput.value;
      const updated = await apiFetch(`/api/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const index = bills.findIndex(b => b.id === id);
      if (index !== -1) bills[index] = updated;
      showToast('Cuenta actualizada con éxito.', 'success');
    } else {
      const created = await apiFetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      bills.push(created);
      showToast('Cuenta agregada con éxito.', 'success');
    }

    closeModal();
    renderDashboard();
    renderBillsTable();
  } catch (err) {
    console.error('Error al guardar la cuenta:', err);
  }
});

// Settings Logic
function populateSettingsForm() {
  settingsCurrency.value = settings.currency || 'S/.';
  settingsTime.value = settings.notificationTime || '09:00';
  settingsDefaultPhone.value = settings.defaultPhoneNumber || '';
  settingsNotifyDue.checked = settings.notifyOnDueDate;
  settingsDaysBefore.value = settings.notifyDaysBefore || 0;
  settingsTemplate.value = settings.messageTemplate || '';
}

// Append variables to template textarea
varBadges.forEach(badge => {
  badge.addEventListener('click', () => {
    const variable = badge.getAttribute('data-var');
    const cursorPos = settingsTemplate.selectionStart;
    const text = settingsTemplate.value;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos, text.length);
    
    settingsTemplate.value = before + variable + after;
    settingsTemplate.focus();
    // Move cursor after the inserted variable
    settingsTemplate.selectionStart = cursorPos + variable.length;
    settingsTemplate.selectionEnd = cursorPos + variable.length;
  });
});

// Save Settings Form
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    currency: settingsCurrency.value,
    notificationTime: settingsTime.value,
    defaultPhoneNumber: settingsDefaultPhone.value,
    notifyOnDueDate: settingsNotifyDue.checked,
    notifyDaysBefore: parseInt(settingsDaysBefore.value, 10),
    messageTemplate: settingsTemplate.value
  };

  try {
    const updated = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    settings = updated;
    showToast('Configuración guardada correctamente.', 'success');
    renderDashboard();
    renderBillsTable();
  } catch (err) {
    console.error('Error al guardar configuración:', err);
  }
});

// Test WhatsApp Message
testMessageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    phone: testPhoneInput.value,
    message: testMessageInput.value
  };
  
  const btn = document.getElementById('btn-send-test');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; margin: 0; display: inline-block; vertical-align: middle;"></div> Enviando...';

  try {
    const res = await apiFetch('/api/whatsapp/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.success) {
      showToast('¡Mensaje de prueba enviado con éxito!', 'success');
    }
  } catch (err) {
    console.error('Error al enviar mensaje de prueba:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    lucide.createIcons();
  }
});

// WhatsApp connection polling
async function checkWhatsAppStatus() {
  try {
    const statusData = await fetch('/api/whatsapp/status').then(r => r.json());
    whatsappStatus = statusData;
    
    updateWhatsAppUI();
  } catch (err) {
    console.error('Error al consultar estado de WhatsApp:', err);
  }
}

// Action to logout WhatsApp
window.logoutWhatsApp = async function() {
  if (confirm('¿Estás seguro de desconectar WhatsApp? Deberás escanear el código QR nuevamente.')) {
    try {
      showToast('Desconectando WhatsApp...', 'info');
      await apiFetch('/api/whatsapp/logout', { method: 'POST' });
      checkWhatsAppStatus();
    } catch (err) {
      console.error(err);
    }
  }
};

function updateWhatsAppUI() {
  const { status, qr, connectionInfo } = whatsappStatus;
  
  // 1. Update quick badge top right
  whatsappQuickStatus.className = 'whatsapp-badge';
  
  if (status === 'CONNECTED') {
    whatsappQuickStatus.classList.add('connected');
    whatsappQuickStatus.querySelector('.badge-text').textContent = `WhatsApp: Conectado (${connectionInfo?.pushname || 'Usuario'})`;
    testPhoneInput.placeholder = settings.defaultPhoneNumber || 'Ej. 51999999999';
  } else if (status === 'QR_RECEIVED') {
    whatsappQuickStatus.classList.add('disconnected');
    whatsappQuickStatus.querySelector('.badge-text').textContent = 'WhatsApp: QR Disponible';
  } else if (status === 'CONNECTING') {
    whatsappQuickStatus.classList.add('connecting');
    whatsappQuickStatus.querySelector('.badge-text').textContent = 'WhatsApp: Conectando...';
  } else {
    whatsappQuickStatus.classList.add('disconnected');
    whatsappQuickStatus.querySelector('.badge-text').textContent = 'WhatsApp: Desconectado';
  }

  // 2. Update Dashboard Quick Panel
  if (whatsappDashboardPanel) {
    if (status === 'CONNECTED') {
      whatsappDashboardPanel.innerHTML = `
        <div class="whatsapp-status-icon connected">
          <i data-lucide="check-check"></i>
        </div>
        <div class="whatsapp-connected-info">
          <h4>WhatsApp Conectado</h4>
          <p class="text-muted">Recibirás alertas en tu WhatsApp de forma automatizada.</p>
          <p style="font-weight: 600; font-size: 0.9rem;">Sesión: ${connectionInfo?.pushname || ''} (+${connectionInfo?.wid || ''})</p>
        </div>
      `;
    } else if (status === 'QR_RECEIVED') {
      whatsappDashboardPanel.innerHTML = `
        <div class="qr-code-wrapper">
          <img src="${qr}" alt="WhatsApp QR Code">
        </div>
        <p class="text-muted" style="font-size: 0.82rem; max-width: 250px; margin: 0 auto 0.5rem;">Escanea este código QR con WhatsApp en tu celular (Dispositivos Vinculados) para activar.</p>
        <div class="whatsapp-badge connecting" style="padding: 0.25rem 0.75rem;">
          <div class="badge-dot"></div>
          <span class="badge-text" style="font-size: 0.75rem;">Esperando escaneo...</span>
        </div>
      `;
    } else if (status === 'CONNECTING') {
      whatsappDashboardPanel.innerHTML = `
        <div class="spinner" style="width: 36px; height: 36px;"></div>
        <h4 style="margin-top: 1rem;">Cargando WhatsApp Web...</h4>
        <p class="text-muted" style="font-size: 0.85rem; max-width: 250px;">Esto puede tomar un momento mientras se inicia el navegador virtual en segundo plano.</p>
      `;
    } else {
      whatsappDashboardPanel.innerHTML = `
        <div class="whatsapp-status-icon disconnected">
          <i data-lucide="message-square-off"></i>
        </div>
        <h4>WhatsApp Desconectado</h4>
        <p class="text-muted mb-4">La vinculación con WhatsApp no está activa.</p>
        <button class="btn btn-primary" onclick="switchTab('whatsapp')">Configurar Conexión</button>
      `;
    }
  }

  // 3. Update Dedicated WhatsApp Tab Panel
  if (whatsappFullPanel) {
    if (status === 'CONNECTED') {
      whatsappFullPanel.innerHTML = `
        <div class="whatsapp-connection-flow">
          <div class="whatsapp-status-icon connected">
            <i data-lucide="message-square"></i>
          </div>
          <h3 style="margin-bottom: 0.5rem;">¡Tu cuenta está vinculada!</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">Los recordatorios de cuentas se enviarán de manera automática desde tu número.</p>
          
          <div class="step-instructions" style="margin-bottom: 2rem;">
            <h5>Detalles de la Conexión</h5>
            <ol style="list-style: none; padding-left: 0;">
              <li><strong>Nombre de perfil:</strong> ${connectionInfo?.pushname || 'No disponible'}</li>
              <li><strong>Número de WhatsApp:</strong> +${connectionInfo?.wid || 'No disponible'}</li>
              <li><strong>Almacenamiento de sesión:</strong> Persistido localmente (no tendrás que escanear de nuevo al reiniciar).</li>
            </ol>
          </div>
          
          <button class="btn btn-danger" onclick="logoutWhatsApp()">
            <i data-lucide="log-out"></i> Cerrar Sesión de WhatsApp
          </button>
        </div>
      `;
    } else if (status === 'QR_RECEIVED') {
      whatsappFullPanel.innerHTML = `
        <div class="whatsapp-connection-flow">
          <div class="qr-code-wrapper">
            <img src="${qr}" alt="WhatsApp QR Code">
          </div>
          <h3 style="margin-bottom: 0.5rem; color: var(--color-whatsapp)">Escanear Código QR</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">Vincula tu teléfono escaneando el código superior desde tu aplicación móvil.</p>
          
          <div class="step-instructions">
            <h5>Instrucciones de vinculación</h5>
            <ol>
              <li>Abre <strong>WhatsApp</strong> en tu teléfono.</li>
              <li>Toca el icono de <strong>Menú</strong> (tres puntos en Android) o entra a <strong>Configuración</strong> (en iPhone).</li>
              <li>Selecciona la opción de <strong>Dispositivos vinculados</strong>.</li>
              <li>Toca en <strong>Vincular un dispositivo</strong> y apunta tu cámara hacia el código QR de esta pantalla.</li>
            </ol>
          </div>
        </div>
      `;
    } else if (status === 'CONNECTING') {
      whatsappFullPanel.innerHTML = `
        <div class="whatsapp-connection-flow">
          <div class="spinner" style="width: 42px; height: 42px; margin-bottom: 1.5rem;"></div>
          <h3>Cargando el motor de WhatsApp Web...</h3>
          <p class="text-muted" style="max-width: 400px; margin-top: 0.5rem;">Iniciando una instancia automatizada del navegador web. Por favor espera unos segundos.</p>
        </div>
      `;
    } else {
      // DISCONNECTED or ERROR
      whatsappFullPanel.innerHTML = `
        <div class="whatsapp-connection-flow">
          <div class="whatsapp-status-icon disconnected">
            <i data-lucide="alert-circle"></i>
          </div>
          <h3>WhatsApp Desconectado</h3>
          <p class="text-muted" style="max-width: 400px; margin-bottom: 2rem;">Hubo un error al iniciar la sesión o se cerró manualmente. El sistema reintentará conectarse automáticamente.</p>
          <div class="spinner" style="width: 20px; height: 20px; display: inline-block;"></div>
          <span class="text-muted" style="font-size: 0.9rem; margin-left: 0.5rem; vertical-align: middle;">Reconectando...</span>
        </div>
      `;
    }
  }

  lucide.createIcons();
}

// Initial setup on window load
window.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  
  // Start polling WhatsApp status every 3 seconds
  checkWhatsAppStatus();
  setInterval(checkWhatsAppStatus, 3000);
});
