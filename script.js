const API_URL = "https://script.google.com/macros/s/AKfycbw1DUPJsEgVU5yhG0zsEBO9nil8OtciAc4aVnUSMEOdbWMeddfhYvU4LV7csrxnmgNdSA/exec"; 
let currentUser = null;
let tatuadoresData = [];

/**
 * FUNÇÕES DE LOGIN E SESSÃO
 */
async function login() {
    const pin = document.getElementById('pin-input').value;
    const btn = document.getElementById('login-btn');
    btn.innerText = "...";

    try {
        const response = await fetch(`${API_URL}?action=getTatuadores`);
        tatuadoresData = await response.json();
        const user = tatuadoresData.find(t => String(t.PIN) === String(pin));

        if (user) {
            currentUser = user;
            localStorage.setItem('studio_session', JSON.stringify(user));
            initApp();
        } else {
            alert("PIN Inválido");
            btn.innerText = "Acessar";
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor.");
        btn.innerText = "Acessar";
    }
}

function initApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    // Atualiza Perfil Ativo
    document.getElementById('user-name-main').innerText = currentUser.Nome;
    if(currentUser.Foto) {
        document.getElementById('user-photo-main').style.backgroundImage = `url('${currentUser.Foto}')`;
    }
    
    renderTeam();
    renderCalendar();
}

function logout() {
    localStorage.removeItem('studio_session');
    location.reload();
}

/**
 * RENDERIZAÇÃO DA SIDEBAR
 */
function renderTeam() {
    const container = document.getElementById('team-list');
    container.innerHTML = tatuadoresData.map(t => `
        <div class="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-all border border-transparent hover:border-zinc-100">
            <img src="${t.Foto || 'https://via.placeholder.com/80'}" class="w-10 h-10 rounded-xl object-cover grayscale">
            <div class="flex-grow">
                <p class="text-xs font-bold uppercase tracking-tight">${t.Nome}</p>
                <a href="${t.Instagram}" target="_blank" class="text-[0.6rem] font-bold text-zinc-400 hover:text-black uppercase">Instagram ↗</a>
            </div>
        </div>
    `).join('');
}

/**
 * CONFIGURAÇÃO DO CALENDÁRIO
 */
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay',
        locale: 'pt-br',
        allDaySlot: false,
        slotMinTime: '08:00:00',
        slotMaxTime: '22:00:00',
        nowIndicator: true,
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'timeGridDay,dayGridMonth' 
        },
        events: `${API_URL}?action=getEvents`,
        
        eventContent: function(arg) {
            return {
                html: `
                    <div class="flex flex-col h-full">
                        <span class="bancada-tag">Bancada ${arg.event.extendedProps.bancada}</span>
                        <div class="font-bold text-[0.7rem] uppercase leading-none truncate">${arg.event.title}</div>
                    </div>
                `
            };
        },

        selectable: true,
        select: async function(info) {
            const b = prompt("ESCOLHA A BANCADA (1, 2, 3 ou 4):");
            if (["1","2","3","4"].includes(b)) {
                await fetch(API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify({
                        action: 'add',
                        tatuadorId: currentUser.ID,
                        bancada: b,
                        start: info.startStr,
                        end: info.endStr
                    })
                });
                setTimeout(() => calendar.refetchEvents(), 800);
            }
        },

        eventClick: async function(info) {
            if (String(info.event.extendedProps.tatuadorId) === String(currentUser.ID)) {
                if (confirm("Apagar este agendamento?")) {
                    await fetch(API_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        body: JSON.stringify({ action: 'delete', id: info.event.id })
                    });
                    setTimeout(() => calendar.refetchEvents(), 800);
                }
            } else {
                alert("Você só pode gerenciar seus próprios horários.");
            }
        }
    });
    calendar.render();
}

/**
 * INICIALIZAÇÃO AO CARREGAR PÁGINA
 */
window.onload = async () => {
    const saved = localStorage.getItem('studio_session');
    if (saved) {
        try {
            const response = await fetch(`${API_URL}?action=getTatuadores`);
            tatuadoresData = await response.json();
            currentUser = JSON.parse(saved);
            initApp();
        } catch (e) {
            console.error("Falha ao restaurar sessão:", e);
            localStorage.removeItem('studio_session');
        }
    }
};
