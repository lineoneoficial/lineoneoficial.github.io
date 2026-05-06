const API_URL = "https://script.google.com/macros/s/AKfycbw1DUPJsEgVU5yhG0zsEBO9nil8OtciAc4aVnUSMEOdbWMeddfhYvU4LV7csrxnmgNdSA/exec"; 
const SESSION_KEY = "studio_pro_final_v1";

let currentUser = null;
let tatuadoresData = [];
let calendar = null;
let currentSelection = null;
let selectedBancada = 1;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!document.getElementById('login-screen').classList.contains('hidden')) login();
        else if (!document.getElementById('modal-reserva').classList.contains('hidden')) confirmarReserva();
    }
});

async function login() {
    const pin = document.getElementById('pin-input').value.trim();
    const btn = document.getElementById('login-btn');
    if (!pin) return;

    btn.innerText = "AUTENTICANDO...";
    try {
        const res = await fetch(`${API_URL}?action=getTatuadores`);
        tatuadoresData = await res.json();
        const user = tatuadoresData.find(t => String(t.PIN).trim() === String(pin));

        if (user) {
            currentUser = user;
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            initApp();
        } else {
            alert("PIN INVÁLIDO");
            btn.innerText = "Autenticar";
        }
    } catch (e) { alert("Falha na conexão."); btn.innerText = "Autenticar"; }
}

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    setTimeout(() => app.classList.add('opacity-100'), 50);

    document.getElementById('greeting-text').innerText = `Olá, ${currentUser.Nome.split(' ')[0]}`;
    if(currentUser.Foto) document.getElementById('user-avatar-top').style.backgroundImage = `url('${currentUser.Foto}')`;
    
    const opt = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('current-day-label').innerText = new Date().toLocaleDateString('pt-BR', opt);

    if (tatuadoresData.length === 0) fetchTeam();
    renderCalendar();
}

async function fetchTeam() {
    const res = await fetch(`${API_URL}?action=getTatuadores`);
    tatuadoresData = await res.json();
    renderTeam();
}

function formatarDataVisor(dataStr) {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + 
           data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const isDesktop = window.innerWidth >= 1024;

    calendar = new FullCalendar.Calendar(calendarEl, {
        views: { timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 Dias' } },
        initialView: isDesktop ? 'timeGridThreeDay' : 'timeGridDay',
        locale: 'pt-br',
        allDaySlot: false,
        slotMinTime: '08:00:00',
        slotMaxTime: '22:00:00',
        nowIndicator: true,
        headerToolbar: { 
            left: isDesktop ? 'prev,next today' : 'prev,next', 
            center: 'title', 
            right: isDesktop ? 'timeGridDay,timeGridThreeDay' : '' 
        },
        events: `${API_URL}?action=getEvents`,
        
        eventContent: (arg) => {
            const colors = { "1": "#10b981", "2": "#6366f1", "3": "#f59e0b", "4": "#f43f5e" };
            const accent = colors[String(arg.event.extendedProps.bancada)] || "#64748b";
            return { 
                html: `
                <div class="event-widget">
                    <div class="event-color-bar" style="background-color: ${accent}"></div>
                    <div class="event-content">
                        <div class="event-time" style="color: ${accent}">${arg.timeText}</div>
                        <h5>${arg.event.title}</h5>
                        <span>Estação 0${arg.event.extendedProps.bancada}</span>
                    </div>
                </div>` 
            };
        },
        selectable: true,
        select: (info) => { 
            currentSelection = info; 
            document.getElementById('cliente-nome').value = '';
            document.getElementById('horario-inicio').value = formatarDataVisor(info.startStr);
            document.getElementById('horario-fim').value = formatarDataVisor(info.endStr);
            openModal(); 
        },
        eventClick: (info) => {
            if (String(info.event.extendedProps.tatuadorId) === String(currentUser.ID)) {
                if (confirm("Remover esta reserva?")) {
                    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', id: info.event.id }) });
                    setTimeout(() => calendar.refetchEvents(), 800);
                }
            } else {
                alert(`Reservado por/para: ${info.event.title}\nEstação: 0${info.event.extendedProps.bancada}\nHorário: ${info.timeText}`);
            }
        }
    });
    calendar.render();
}

function switchView(view) {
    const vAgenda = document.getElementById('view-agenda');
    const vTeam = document.getElementById('view-team');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    if (view === 'team') {
        vAgenda.classList.add('hidden'); vTeam.classList.remove('hidden');
        document.querySelector('button[onclick*="team"]').classList.add('active');
        renderTeam();
    } else {
        vTeam.classList.add('hidden'); vAgenda.classList.remove('hidden');
        document.querySelector('button[onclick*="agenda"]').classList.add('active');
        calendar.updateSize();
    }
}

function renderTeam() {
    const list = document.getElementById('team-list');
    list.innerHTML = tatuadoresData.map(t => `
        <div class="flex items-center gap-5 p-5 lg:p-6 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <img src="${t.Foto || 'https://via.placeholder.com/150'}" class="w-[72px] h-[72px] lg:w-[80px] lg:h-[80px] rounded-[1.5rem] object-cover border border-slate-100">
            <div class="flex-grow">
                <h4 class="font-black uppercase text-[1.1rem] lg:text-xl tracking-tighter text-slate-800 leading-tight">${t.Nome}</h4>
                <a href="${t.Instagram}" target="_blank" class="inline-block text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg mt-1 hover:bg-indigo-600 hover:text-white transition-colors">Instagram ↗</a>
            </div>
        </div>
    `).join('');
}

function openModal() {
    const m = document.getElementById('modal-reserva');
    const sheet = document.getElementById('modal-sheet');
    m.classList.remove('hidden'); m.classList.add('flex');
    setTimeout(() => {
        sheet.classList.remove('opacity-0');
        if (window.innerWidth >= 1024) sheet.classList.remove('lg:translate-y-10', 'lg:scale-95');
        else sheet.classList.remove('translate-y-full');
    }, 10);
}

function closeModal() {
    const m = document.getElementById('modal-reserva');
    const sheet = document.getElementById('modal-sheet');
    if (window.innerWidth >= 1024) sheet.classList.add('lg:translate-y-10', 'lg:scale-95', 'opacity-0');
    else sheet.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 400);
}

function setBancada(n) {
    selectedBancada = n;
    document.querySelectorAll('.b-btn').forEach((btn, i) => btn.classList.toggle('active', i + 1 === n));
}

async function confirmarReserva() {
    const clienteInput = document.getElementById('cliente-nome').value.trim();
    if (!clienteInput) { alert("Informe o Nome do Cliente."); document.getElementById('cliente-nome').focus(); return; }

    closeModal();
    await fetch(API_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'add', tatuadorId: currentUser.ID, cliente: clienteInput, bancada: selectedBancada, start: currentSelection.startStr, end: currentSelection.endStr })
    });
    setTimeout(() => calendar.refetchEvents(), 800);
}

function logout() { localStorage.removeItem(SESSION_KEY); location.reload(); }

window.onload = () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) { currentUser = JSON.parse(saved); initApp(); }
};

window.addEventListener('resize', () => {
    if (calendar && !document.getElementById('view-agenda').classList.contains('hidden')) calendar.updateSize();
});
