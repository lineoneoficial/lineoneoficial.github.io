const API_URL = "https://script.google.com/macros/s/AKfycbw1DUPJsEgVU5yhG0zsEBO9nil8OtciAc4aVnUSMEOdbWMeddfhYvU4LV7csrxnmgNdSA/exec"; 
const SESSION_KEY = "studio_pro_session";

let currentUser = null;
let tatuadoresData = [];
let calendar = null;
let currentSelection = null;
let selectedBancada = 1;

// Gerenciamento de Enter
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const loginVisible = !document.getElementById('login-screen').classList.contains('hidden');
        const modalVisible = !document.getElementById('modal-reserva').classList.contains('hidden');
        if (loginVisible) login();
        else if (modalVisible) confirmarReserva();
    }
});

async function login() {
    const pin = document.getElementById('pin-input').value.trim();
    const btn = document.getElementById('login-btn');
    if (!pin) return;

    btn.innerText = "VALIDANDO...";
    try {
        const response = await fetch(`${API_URL}?action=getTatuadores`);
        const data = await response.json();
        tatuadoresData = Array.isArray(data) ? data : [];
        const user = tatuadoresData.find(t => String(t.PIN).trim() === String(pin));

        if (user) {
            currentUser = user;
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            initApp();
        } else {
            alert("PIN INCORRETO.");
            btn.innerText = "Entrar";
        }
    } catch (e) { alert("Erro de conexão."); }
}

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    setTimeout(() => app.classList.add('opacity-100'), 50);

    const opt = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('current-day-name').innerText = new Date().toLocaleDateString('pt-BR', opt);
    document.getElementById('greeting-text').innerText = `Olá, ${currentUser.Nome.split(' ')[0]}`;
    
    if(currentUser.Foto) document.getElementById('user-avatar-top').style.backgroundImage = `url('${currentUser.Foto}')`;
    
    if (tatuadoresData.length === 0) refreshData();
    else { renderTeam(); renderCalendar(); }
}

async function refreshData() {
    const response = await fetch(`${API_URL}?action=getTatuadores`);
    tatuadoresData = await response.json();
    renderTeam(); renderCalendar();
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay',
        locale: 'pt-br',
        allDaySlot: false,
        slotMinTime: '08:00:00',
        slotMaxTime: '22:00:00',
        headerToolbar: { left: 'prev,next', center: 'title', right: '' },
        events: `${API_URL}?action=getEvents`,
        eventContent: (arg) => {
            const colors = { "1": "#FF3B30", "2": "#34C759", "3": "#007AFF", "4": "#5856D6" };
            const accent = colors[String(arg.event.extendedProps.bancada)] || "#000";
            return { html: `<div class="event-card"><div class="event-bar" style="background:${accent}"></div><div class="event-info"><span class="tatuador-nome">${arg.event.title}</span><span class="bancada-info">Bancada 0${arg.event.extendedProps.bancada}</span></div></div>` };
        },
        selectable: true,
        select: (info) => { currentSelection = info; openModal(); },
        eventClick: (info) => {
            if (String(info.event.extendedProps.tatuadorId) === String(currentUser.ID)) {
                if (confirm("Remover reserva?")) {
                    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', id: info.event.id }) });
                    setTimeout(() => calendar.refetchEvents(), 800);
                }
            }
        }
    });
    calendar.render();
}

function openModal() {
    const modal = document.getElementById('modal-reserva');
    modal.classList.remove('hidden'); modal.classList.add('flex');
    setTimeout(() => modal.querySelector('div').classList.remove('translate-y-full'), 10);
}

function closeModal() {
    const modal = document.getElementById('modal-reserva');
    modal.querySelector('div').classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 400);
}

function setBancada(n) {
    selectedBancada = n;
    document.querySelectorAll('.b-btn').forEach((btn, i) => btn.classList.toggle('active', i + 1 === n));
}

async function confirmarReserva() {
    closeModal();
    await fetch(API_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'add', tatuadorId: currentUser.ID, bancada: selectedBancada, start: currentSelection.startStr, end: currentSelection.endStr })
    });
    setTimeout(() => calendar.refetchEvents(), 800);
}

function logout() { localStorage.removeItem(SESSION_KEY); location.reload(); }

window.onload = async () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) { currentUser = JSON.parse(saved); initApp(); }
};
