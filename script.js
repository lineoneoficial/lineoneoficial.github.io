// ==================== Configuration ====================
const CONFIG = {
  SHEET_API_URL: 'YOUR_GOOGLE_SCRIPT_URL_HERE',
  TATUADORES: ['Carlos', 'Mariana', 'Rafael', 'Carla'],
  BANCADAS: [1, 2, 3, 4],
  COLORS: {
    Carlos: '#e74c3c',
    Mariana: '#9b59b6',
    Rafael: '#3498db',
    Carla: '#1abc9c'
  }
};

// ==================== State ====================
let calendar;
let currentFilter = 'all';
let currentEvent = null;

// ==================== LocalStorage ====================
function getStoredEmail() {
  return localStorage.getItem('tatuadorEmail');
}

function setStoredEmail(email) {
  localStorage.setItem('tatuadorEmail', email);
  updateLoginUI();
}

function clearStoredEmail() {
  localStorage.removeItem('tatuadorEmail');
  updateLoginUI();
}

// ==================== UI Functions ====================
function updateLoginUI() {
  const email = getStoredEmail();
  const loginBtn = document.getElementById('loginBtn');
  const userInfo = document.getElementById('userInfo');
  const userEmail = document.getElementById('userEmail');

  if (email) {
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    userEmail.textContent = email;
  } else {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    userEmail.textContent = '';
  }
}

function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (email) {
    setStoredEmail(email);
    closeLoginModal();
    document.getElementById('loginEmail').value = '';
  }
}

function logout() {
  clearStoredEmail();
}

function openBookingModal(eventData = null) {
  const modal = document.getElementById('bookingModal');
  const title = document.getElementById('bookingModalTitle');
  const editId = document.getElementById('editEventId');

  if (eventData) {
    title.textContent = 'Editar Agendamento';
    editId.value = eventData.id;

    document.getElementById('clientName').value = eventData.title.split(' - ')[0] || '';
    document.getElementById('tatuador').value = eventData.extendedProps?.tatuador || '';
    document.getElementById('bancada').value = eventData.extendedProps?.bancada || '';

    const start = new Date(eventData.start);
    document.getElementById('bookingDate').value = start.toISOString().split('T')[0];
    document.getElementById('bookingTime').value = start.toTimeString().slice(0, 5);

    const end = new Date(eventData.end);
    const duration = (end - start) / (1000 * 60 * 60);
    document.getElementById('duration').value = duration;
  } else {
    title.textContent = 'Novo Agendamento';
    editId.value = '';
    e.target.reset();
  }

  modal.classList.remove('hidden');
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
  document.querySelector('#bookingModal form').reset();
}

function openEventModal(event) {
  currentEvent = event;
  const modal = document.getElementById('eventModal');

  document.getElementById('eventTitle').textContent = event.title;
  document.getElementById('eventClient').textContent = event.title.split(' - ')[0] || 'N/A';
  document.getElementById('eventTatuador').textContent = event.extendedProps?.tatuador || 'N/A';
  document.getElementById('eventBancada').textContent = `Bancada ${event.extendedProps?.bancada || 'N/A'}`;
  document.getElementById('eventTime').textContent = `${formatTime(event.start)} - ${formatTime(event.end)}`;
  document.getElementById('eventEmail').textContent = event.extendedProps?.emailCriador || 'N/A';

  const email = getStoredEmail();
  const actions = document.getElementById('eventActions');

  if (email && email === event.extendedProps?.emailCriador) {
    actions.classList.remove('hidden');
  } else {
    actions.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
  currentEvent = null;
}

function editEvent() {
  if (currentEvent) {
    closeEventModal();
    openBookingModal(currentEvent);
  }
}

function deleteEvent() {
  if (currentEvent && confirm('Tem certeza que deseja excluir este agendamento?')) {
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const filtered = events.filter(e => e.id !== currentEvent.id);
    localStorage.setItem('events', JSON.stringify(filtered));

    closeEventModal();
    calendar.refetchEvents();
    updateDailyList();
  }
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR');
}

// ==================== Filter Functions ====================
function filterBancada(bancada) {
  currentFilter = bancada;

  document.querySelectorAll('.bancada-btn').forEach(btn => {
    if (btn.dataset.bancada === String(bancada)) {
      btn.classList.add('bg-gold-500', 'text-dark-900');
      btn.classList.remove('bg-dark-600', 'hover:bg-dark-500');
    } else {
      btn.classList.remove('bg-gold-500', 'text-dark-900');
      btn.classList.add('bg-dark-600', 'hover:bg-dark-500');
    }
  });

  calendar.refetchEvents();
  updateDailyList();
}

function getFilteredEvents(events) {
  if (currentFilter === 'all') return events;

  return events.filter(event => {
    const bancada = parseInt(event.extendedProps?.bancada);
    return bancada === parseInt(currentFilter);
  });
}

// ==================== Calendar ====================
function initCalendar() {
  const calendarEl = document.getElementById('calendar');

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    locale: 'pt-br',
    firstDay: 0,
    allDaySlot: false,
    slotMinTime: '08:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    expandRows: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3,
    weekends: true,
    events: fetchEvents,
    eventClick: handleEventClick,
    select: handleDateSelect,
    eventDidMount: function(info) {
      const tatuador = info.event.extendedProps?.tatuador;
      if (tatuador) {
        info.el.classList.add(`tatuador-${tatuador.toLowerCase()}`);
      }
    }
  });

  calendar.render();
  updateDailyList();
}

async function fetchEvents(info, successCallback, failureCallback) {
  try {
    let events = [];

    const stored = localStorage.getItem('events');
    if (stored) {
      events = JSON.parse(stored);
    }

    // Placeholder for Google Sheets API
    // Uncomment below when you have your Google Script URL
    /*
    const response = await fetch(CONFIG.SHEET_API_URL + '?action=getEvents');
    if (response.ok) {
      const data = await response.json();
      events = data.events || [];
    }
    */

    events = events.map(event => ({
      ...event,
      backgroundColor: CONFIG.COLORS[event.extendedProps?.tatuador] || '#d4af37',
      borderColor: CONFIG.COLORS[event.extendedProps?.tatuador] || '#d4af37'
    }));

    successCallback(getFilteredEvents(events));
  } catch (error) {
    console.error('Error fetching events:', error);
    failureCallback(error);
  }
}

function handleEventClick(info) {
  const event = {
    id: info.event.id,
    title: info.event.title,
    start: info.event.start,
    end: info.event.end,
    extendedProps: info.event.extendedProps
  };
  openEventModal(event);
}

function handleDateSelect(info) {
  const email = getStoredEmail();
  if (!email) {
    alert('Por favor, faça login para criar agendamentos.');
    return;
  }

  document.getElementById('bookingDate').value = info.startStr.split('T')[0];
  document.getElementById('bookingTime').value = info.startStr.split('T')[1]?.slice(0, 5) || '09:00';

  openBookingModal();
}

async function handleBooking(e) {
  e.preventDefault();

  const clientName = document.getElementById('clientName').value.trim();
  const tatuador = document.getElementById('tatuador').value;
  const bancada = document.getElementById('bancada').value;
  const date = document.getElementById('bookingDate').value;
  const time = document.getElementById('bookingTime').value;
  const duration = parseInt(document.getElementById('duration').value);
  const editId = document.getElementById('editEventId').value;

  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);

  const email = getStoredEmail();
  const eventData = {
    id: editId || 'evt_' + Date.now(),
    title: `${clientName} - ${tatuador}`,
    start: start.toISOString(),
    end: end.toISOString(),
    backgroundColor: CONFIG.COLORS[tatuador],
    borderColor: CONFIG.COLORS[tatuador],
    extendedProps: {
      tatuador,
      bancada,
      emailCriador: email
    }
  };

  let events = JSON.parse(localStorage.getItem('events') || '[]');

  if (editId) {
    events = events.map(evt => evt.id === editId ? eventData : evt);
  } else {
    events.push(eventData);
  }

  localStorage.setItem('events', JSON.stringify(events));

  // Placeholder for Google Sheets API
  // Uncomment below when you have your Google Script URL
  /*
  if (editId) {
    await fetch(CONFIG.SHEET_API_URL + '?action=updateEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
  } else {
    await fetch(CONFIG.SHEET_API_URL + '?action=createEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
  }
  */

  closeBookingModal();
  calendar.refetchEvents();
  updateDailyList();
}

// ==================== Daily List ====================
function updateDailyList() {
  const container = document.getElementById('dailyArtists');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const stored = localStorage.getItem('events');
  if (!stored) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum artista agendado hoje</p>';
    return;
  }

  const events = JSON.parse(stored);
  const todayEvents = getFilteredEvents(events).filter(event => {
    const eventDate = new Date(event.start);
    return eventDate >= today && eventDate < tomorrow;
  });

  if (todayEvents.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum artista agendado hoje</p>';
    return;
  }

  todayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

  const tatuadoresUnicos = [...new Set(todayEvents.map(e => e.extendedProps?.tatuador))];

  container.innerHTML = tatuadoresUnicos.map(tatuador => {
    const artistEvents = todayEvents.filter(e => e.extendedProps?.tatuador === tatuador);
    const firstEvent = artistEvents[0];

    return `
      <div class="bg-dark-700 rounded-lg p-4 border border-dark-500">
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-500 text-xl font-bold">
            ${tatuador.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1">
            <h3 class="font-semibold">${tatuador}</h3>
            <p class="text-sm text-gray-400">${artistEvents.length} agendamento(s)</p>
            <p class="text-sm text-gold-500">Bancada ${firstEvent.extendedProps?.bancada}</p>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-dark-500">
          ${artistEvents.map(evt => `
            <div class="flex justify-between items-center text-sm py-1">
              <span>${evt.title.split(' - ')[0]}</span>
              <span class="text-gray-400">${formatTime(evt.start)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function tatuadoresUnicos(events) {
  const seen = new Set();
  return events.filter(event => {
    const tatuador = event.extendedProps?.tatuador;
    if (seen.has(tatuador)) {
      return false;
    }
    seen.add(tatuador);
    return true;
  }).map(e => e.extendedProps?.tatuador);
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', function() {
  initCalendar();
  updateLoginUI();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeBookingModal();
    closeEventModal();
  }
});