const API_URL = "https://script.google.com/macros/s/AKfycbw1DUPJsEgVU5yhG0zsEBO9nil8OtciAc4aVnUSMEOdbWMeddfhYvU4LV7csrxnmgNdSA/exec";
const SESSION_KEY = "studio_os_final_release_v7";

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
            const colors = { "1": "#059669", "2": "#4f46e5", "3": "#d97706", "4": "#e11d48" };
            const accent = colors[String(arg.event.extendedProps.bancada)] || "#475569";

            return {
                html: `
                <div class="event-widget" style="border-left: 6px solid ${accent}; background: #ffffff; border-right: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                    <div class="event-content">
                        <div class="event-header">
                            <span class="badge-bancada" style="background-color: ${accent}; color: #ffffff;">St. 0${arg.event.extendedProps.bancada}</span>
                            <span class="time-text" style="color: #475569;">${arg.timeText}</span>
                        </div>
                        <h5 class="event-title" style="color: #0f172a;">${arg.event.title}</h5>
                    </div>
                </div>`
            };
        },
        selectable: true,
        select: (info) => {
            document.getElementById('cliente-nome').value = '';

            const dateStr = info.startStr.substring(0, 10);
            const startHHMM = info.start.toTimeString().substring(0, 5);
            const endHHMM = info.end.toTimeString().substring(0, 5);

            document.getElementById('data-reserva').value = dateStr;
            document.getElementById('horario-inicio').value = startHHMM;
            document.getElementById('horario-fim').value = endHHMM;
            document.getElementById('label-horario-selecionado').innerText = "Data Selecionada no Calendário";

            openModal();
        },
        eventClick: (info) => {
            const ev = info.event;
            const isOwner = String(ev.extendedProps.tatuadorId) === String(currentUser.ID);
            const colors = { "1": "#059669", "2": "#4f46e5", "3": "#d97706", "4": "#e11d48" };
            const accent = colors[String(ev.extendedProps.bancada)] || "#475569";

            // CORREÇÃO: Pegando o horário exato do evento e forçando a formatação
            const startHHMM = ev.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const endHHMM = ev.end ? ev.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '??:??';

            document.getElementById('view-cliente-nome').innerText = ev.title;

            // Agora o horário aparece cravado (Ex: 14:00 - 18:00)
            document.getElementById('view-horario').innerText = `${startHHMM} - ${endHHMM}`;

            const badge = document.getElementById('view-bancada-badge');
            badge.innerText = `Bancada 0${ev.extendedProps.bancada}`;
            badge.style.backgroundColor = accent;
            badge.style.color = '#ffffff';

            const btnDelete = document.getElementById('btn-delete-reserva');
            if (isOwner) {
                btnDelete.classList.remove('hidden');
                btnDelete.onclick = async () => {
                    closeViewModal();
                    ev.setProp('backgroundColor', '#f1f5f9');
                    await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', id: ev.id }) });
                    setTimeout(() => calendar.refetchEvents(), 800);
                };
            } else {
                btnDelete.classList.add('hidden');
            }
            openViewModal();
        }
    });
    calendar.render();
}

function clickAddReserva() {
    document.getElementById('cliente-nome').value = '';

    const now = new Date();
    // Ajuste de fuso horário local
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

    const dateStr = localISOTime.split('T')[0];
    document.getElementById('data-reserva').value = dateStr;

    const startH = String(now.getHours()).padStart(2, '0') + ":00";
    const endH = String(now.getHours() + 1).padStart(2, '0') + ":00";

    document.getElementById('horario-inicio').value = startH;
    document.getElementById('horario-fim').value = endH;
    document.getElementById('label-horario-selecionado').innerText = "Agendamento Manual";

    openModal();
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

// LÓGICA ROBUSTA DOS MODAIS
function openModal() {
    const m = document.getElementById('modal-reserva');
    const backdrop = document.getElementById('backdrop-reserva');
    const sheet = document.getElementById('modal-sheet');

    m.classList.remove('hidden'); void m.offsetWidth;
    backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100');
    sheet.classList.remove('translate-y-full', 'lg:translate-y-10', 'lg:scale-95', 'opacity-0');
    sheet.classList.add('translate-y-0', 'lg:translate-y-0', 'lg:scale-100', 'opacity-100');
}

function closeModal() {
    const m = document.getElementById('modal-reserva');
    const backdrop = document.getElementById('backdrop-reserva');
    const sheet = document.getElementById('modal-sheet');

    backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0');
    sheet.classList.remove('translate-y-0', 'lg:translate-y-0', 'lg:scale-100', 'opacity-100');
    sheet.classList.add('translate-y-full', 'lg:translate-y-10', 'lg:scale-95', 'opacity-0');
    setTimeout(() => { m.classList.add('hidden'); }, 300);
}

function openViewModal() {
    const m = document.getElementById('modal-view-reserva');
    const backdrop = document.getElementById('backdrop-view');
    const sheet = document.getElementById('modal-view-sheet');

    m.classList.remove('hidden'); void m.offsetWidth;
    backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100');
    sheet.classList.remove('translate-y-full', 'lg:translate-y-10', 'lg:scale-95', 'opacity-0');
    sheet.classList.add('translate-y-0', 'lg:translate-y-0', 'lg:scale-100', 'opacity-100');
}

function closeViewModal() {
    const m = document.getElementById('modal-view-reserva');
    const backdrop = document.getElementById('backdrop-view');
    const sheet = document.getElementById('modal-view-sheet');

    backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0');
    sheet.classList.remove('translate-y-0', 'lg:translate-y-0', 'lg:scale-100', 'opacity-100');
    sheet.classList.add('translate-y-full', 'lg:translate-y-10', 'lg:scale-95', 'opacity-0');
    setTimeout(() => { m.classList.add('hidden'); }, 300);
}

function setBancada(n) {
    selectedBancada = n;
    const botoes = document.querySelectorAll('.bancada-btn');

    botoes.forEach((btn, i) => {
        if (i + 1 === n) {
            // Estilo do botão SELECIONADO (Roxo Sólido)
            btn.className = "bancada-btn bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02] border-2 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all";
        } else {
            // Estilo do botão INATIVO (Cinza Claro)
            btn.className = "bancada-btn bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 border-2 p-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all";
        }
    });
}

// VALIDAÇÃO RIGOROSA E SALVAMENTO
async function confirmarReserva() {
    const clienteInput = document.getElementById('cliente-nome').value.trim();
    const dataReserva = document.getElementById('data-reserva').value;
    const timeInicio = document.getElementById('horario-inicio').value;
    const timeFim = document.getElementById('horario-fim').value;

    if (!clienteInput) { alert("⚠️ O NOME DO CLIENTE é obrigatório."); document.getElementById('cliente-nome').focus(); return; }
    if (!dataReserva) { alert("⚠️ A DATA da reserva é obrigatória."); document.getElementById('data-reserva').focus(); return; }
    if (!timeInicio) { alert("⚠️ O HORÁRIO DE INÍCIO é obrigatório."); document.getElementById('horario-inicio').focus(); return; }
    if (!timeFim) { alert("⚠️ O HORÁRIO DE FIM é obrigatório."); document.getElementById('horario-fim').focus(); return; }
    if (!selectedBancada) { alert("⚠️ Selecione uma ESTAÇÃO DE TRABALHO."); return; }

    const btnSalvar = document.querySelector('button[onclick="confirmarReserva()"]');
    const textoOriginal = btnSalvar.innerText;
    btnSalvar.innerText = "SALVANDO...";
    btnSalvar.disabled = true;

    const startISO = `${dataReserva}T${timeInicio}:00`;
    const endISO = `${dataReserva}T${timeFim}:00`;

    try {
        await fetch(API_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: 'add', tatuadorId: currentUser.ID, cliente: clienteInput, bancada: selectedBancada, start: startISO, end: endISO })
        });
        closeModal();
        setTimeout(() => calendar.refetchEvents(), 800);
    } catch (e) {
        alert("Erro ao salvar. Verifique sua conexão.");
    } finally {
        btnSalvar.innerText = textoOriginal;
        btnSalvar.disabled = false;
    }
}

function logout() { localStorage.removeItem(SESSION_KEY); location.reload(); }

window.onload = () => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) { currentUser = JSON.parse(saved); initApp(); }
};

window.addEventListener('resize', () => {
    if (calendar && !document.getElementById('view-agenda').classList.contains('hidden')) calendar.updateSize();
});
