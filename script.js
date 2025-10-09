// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD3ZGKwF8j16t5LtbibAqucUmrZykUT_BQ",
    authDomain: "cadastro-sejuv.firebaseapp.com",
    projectId: "cadastro-sejuv",
    storageBucket: "cadastro-sejuv.firebasestorage.app",
    messagingSenderId: "5134638204",
    appId: "1:5134638204:web:a5de746c1370447ad5fdf9",
    measurementId: "G-DHVJXVKENB"
};

// Inicialização do Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variáveis globais
let locais = [];
let eventos = [];
let usuarioLogado = null;
let ultimoBackup = null;
let localEditando = null;
let eventoEditando = null;
let eventosFiltradosModal = [];
let emEdicao = false;

// Função para mostrar/ocultar tela de carregamento
function showLoading(show = true) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        if (show) {
            loadingScreen.classList.remove('loading-hidden');
        } else {
            loadingScreen.classList.add('loading-hidden');
        }
    }
}

// Desabilitar/habilitar botões durante operações
function setButtonsState(disabled = true) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        if (!button.id || !button.id.includes('cancel')) {
            button.disabled = disabled;
        }
    });
}

// Verificar autenticação em todas as páginas
function checkAuth() {
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (!usuarioSalvo && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
        window.location.href = 'index.html';
        return false;
    }
    
    if (usuarioSalvo) {
        usuarioLogado = JSON.parse(usuarioSalvo);
        atualizarInterfaceUsuario();
        return true;
    }
    
    return false;
}

// Atualizar interface com informações do usuário
function atualizarInterfaceUsuario() {
    if (usuarioLogado) {
        document.querySelectorAll('#currentUser').forEach(el => {
            if (el) el.textContent = usuarioLogado.email;
        });
    }
}

// Carregar dados do Firebase
function carregarDados() {
    if (!checkAuth()) return;
    
    try {
        // Configurar listeners em tempo real para os dados
        db.collection('locais').onSnapshot((snapshot) => {
            locais = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (typeof atualizarSelectLocais === 'function') atualizarSelectLocais();
            if (typeof carregarLocais === 'function') carregarLocais();
            
            // Atualizar dashboard se estiver visível
            if (document.getElementById('todosDadosCount')) {
                document.getElementById('todosDadosCount').textContent = `${locais.length} locais`;
            }
        });

        db.collection('eventos').onSnapshot((snapshot) => {
            eventos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (typeof carregarEventosParaEdicao === 'function') carregarEventosParaEdicao();
        });
        
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        mostrarMensagem("Erro ao carregar dados. Verifique sua conexão.", "erro");
    }
}

// Funções de autenticação
async function fazerLogin(e) {
    if (e) e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    
    try {
        showLoading(true);
        setButtonsState(true);
        
        const userCredential = await auth.signInWithEmailAndPassword(email, senha);
        usuarioLogado = userCredential.user;
        
        localStorage.setItem('usuarioLogado', JSON.stringify({
            email: usuarioLogado.email,
            uid: usuarioLogado.uid
        }));
        
        await carregarDados();
        
        atualizarInterfaceUsuario();
        mostrarMensagem('Login realizado com sucesso!', 'sucesso');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    } catch (error) {
        console.error("Erro no login:", error);
        mostrarMensagem('Email ou senha incorretos!', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

function logout() {
    auth.signOut();
    usuarioLogado = null;
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}

// Funções para a página de adicionar dados
function showForm(tipo) {
    document.getElementById('localForm').classList.add('hidden');
    document.getElementById('eventoForm').classList.add('hidden');
    document.getElementById(tipo + 'Form').classList.remove('hidden');
}

function hideForms() {
    document.getElementById('localForm').classList.add('hidden');
    document.getElementById('eventoForm').classList.add('hidden');
    document.getElementById('cadastroLocalForm').reset();
    document.getElementById('cadastroEventoForm').reset();
    
    const submitLocalButton = document.querySelector('#cadastroLocalForm button[type="submit"]');
    if (submitLocalButton) {
        submitLocalButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Local';
        submitLocalButton.onclick = function(e) {
            e.preventDefault();
            adicionarLocal(e);
        };
    }
    
    const submitEventoButton = document.querySelector('#cadastroEventoForm button[type="submit"]');
    if (submitEventoButton) {
        submitEventoButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Evento';
        submitEventoButton.onclick = function(e) {
            e.preventDefault();
            adicionarEvento(e);
        };
    }
    
    const cancelButtons = document.querySelectorAll('.btn-cancel');
    cancelButtons.forEach(button => button.remove());
    
    localEditando = null;
    eventoEditando = null;
    emEdicao = false;
}

// Atualizar select de locais no formulário de eventos
function atualizarSelectLocais() {
    const select = document.getElementById('localEvento');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um local</option>';
    
    locais.forEach(local => {
        const option = document.createElement('option');
        option.value = local.id;
        option.textContent = local.nome;
        select.appendChild(option);
    });
}

// Funções de CRUD para locais
async function adicionarLocal(e) {
    if (e) e.preventDefault();
    
    showLoading(true);
    setButtonsState(true);
    
    try {
        const novoLocal = {
            nome: document.getElementById('nomeLocal').value,
            endereco: document.getElementById('enderecoLocal').value,
            responsavel: document.getElementById('responsavelLocal').value,
            contato: document.getElementById('contatoLocal').value,
            capacidade: document.getElementById('capacidadeLocal').value || null,
            dataCriacao: new Date().toISOString(),
            criadoPor: usuarioLogado.email,
            ultimaAtualizacao: new Date().toISOString()
        };
        
        await db.collection('locais').add(novoLocal);
        
        document.getElementById('cadastroLocalForm').reset();
        mostrarMensagem('Local adicionado com sucesso!', 'sucesso');
        
        hideForms();
    } catch (error) {
        console.error("Erro ao adicionar local:", error);
        mostrarMensagem('Erro ao adicionar local.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

async function adicionarEvento(e) {
    if (e) e.preventDefault();
    
    showLoading(true);
    setButtonsState(true);
    
    try {
        const localId = document.getElementById('localEvento').value;
        const localSelecionado = locais.find(l => l.id === localId);
        
        if (!localSelecionado) {
            mostrarMensagem('Selecione um local válido.', 'erro');
            return;
        }
        
        const horarioInicio = document.getElementById('horarioInicio').value;
        const horarioFim = document.getElementById('horarioFim').value;
        
        if (horarioFim <= horarioInicio) {
            mostrarMensagem('O horário de término deve ser após o horário de início.', 'erro');
            return;
        }
        
        const novoEvento = {
            localId: localId,
            localNome: localSelecionado.nome,
            escola: document.getElementById('escolaEvento').value,
            diaSemana: document.getElementById('diaSemanaEvento').value,
            horarioInicio: horarioInicio,
            horarioFim: horarioFim,
            responsavel: document.getElementById('responsavelEvento').value,
            contato: document.getElementById('contatoEvento').value,
            observacoes: document.getElementById('observacoesEvento').value || '',
            dataCriacao: new Date().toISOString(),
            criadoPor: usuarioLogado.email,
            ultimaAtualizacao: new Date().toISOString()
        };
        
        await db.collection('eventos').add(novoEvento);
        
        document.getElementById('cadastroEventoForm').reset();
        document.getElementById('horarioInicio').value = "08:00";
        document.getElementById('horarioFim').value = "17:00";
        
        mostrarMensagem('Evento adicionado com sucesso!', 'sucesso');
        hideForms();
    } catch (error) {
        console.error("Erro ao adicionar evento:", error);
        mostrarMensagem('Erro ao adicionar evento.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

// Funções para a página de todos os dados - CORRIGIDAS
function carregarLocais() {
    const tbody = document.querySelector('#tabelaLocais tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (locais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum local encontrado.</td></tr>';
        return;
    }
    
    const locaisFiltrados = aplicarFiltrosLocais();
    
    if (locaisFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum local encontrado com os filtros aplicados.</td></tr>';
        return;
    }
    
    locaisFiltrados.forEach((local, index) => {
        const eventosLocal = eventos.filter(e => e.localId === local.id);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${local.nome}</strong></td>
            <td>${local.endereco}</td>
            <td>${local.responsavel}</td>
            <td><span class="badge">${eventosLocal.length} evento(s)</span></td>
            <td>
                <button class="btn-info btn-small" onclick="mostrarDetalhesLocal('${local.id}')"><i class="fas fa-eye"></i> Ver</button>
                <button class="btn-edit btn-small" onclick="editarLocal('${local.id}')"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete btn-small" onclick="excluirLocal('${local.id}')"><i class="fas fa-trash"></i> Excluir</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function aplicarFiltrosLocais() {
    const termoPesquisa = document.getElementById('pesquisaDados').value.toLowerCase();
    const filtroDia = document.getElementById('filtroDiaSemana').value;
    const filtroHorario = document.getElementById('filtroHorario').value;
    
    return locais.filter(local => {
        // Filtro por pesquisa
        if (termoPesquisa) {
            const textoBusca = `${local.nome} ${local.endereco} ${local.responsavel}`.toLowerCase();
            if (!textoBusca.includes(termoPesquisa)) {
                return false;
            }
        }
        
        // Filtro por dia da semana
        if (filtroDia) {
            const eventosLocal = eventos.filter(e => e.localId === local.id && e.diaSemana === filtroDia);
            if (eventosLocal.length === 0) {
                return false;
            }
        }
        
        // Filtro por horário
        if (filtroHorario) {
            const eventosLocal = eventos.filter(e => e.localId === local.id);
            const temEventoNoHorario = eventosLocal.some(evento => {
                const horaInicio = parseInt(evento.horarioInicio.split(':')[0]);
                if (filtroHorario === 'manha' && horaInicio >= 6 && horaInicio < 12) return true;
                if (filtroHorario === 'tarde' && horaInicio >= 12 && horaInicio < 18) return true;
                if (filtroHorario === 'noite' && horaInicio >= 18 && horaInicio < 23) return true;
                return false;
            });
            if (!temEventoNoHorario) return false;
        }
        
        return true;
    });
}

function filtrarDados() {
    carregarLocais();
}

function limparPesquisaDados() {
    document.getElementById('pesquisaDados').value = '';
    document.getElementById('filtroDiaSemana').value = '';
    document.getElementById('filtroHorario').value = '';
    carregarLocais();
}

// CORREÇÃO: Função editarLocal corrigida
async function editarLocal(localId) {
    if (emEdicao) {
        mostrarMensagem('Finalize a edição atual antes de editar outro item.', 'alerta');
        return;
    }
    
    try {
        const local = locais.find(l => l.id === localId);
        if (!local) return;
        
        // CORREÇÃO: Navegar para a página de adicionar dados com o parâmetro correto
        window.location.href = 'adicionar-dados.html?editLocal=' + localId;
        
    } catch (error) {
        console.error("Erro ao editar local:", error);
        mostrarMensagem('Erro ao carregar dados para edição.', 'erro');
    }
}

// CORREÇÃO: Função carregarLocalParaEdicao corrigida
function carregarLocalParaEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const localId = urlParams.get('editLocal');
    
    if (localId) {
        const local = locais.find(l => l.id === localId);
        if (local) {
            showForm('local');
            emEdicao = true;
            localEditando = localId;
            
            // Preencher formulário com dados do local
            document.getElementById('nomeLocal').value = local.nome;
            document.getElementById('enderecoLocal').value = local.endereco;
            document.getElementById('responsavelLocal').value = local.responsavel;
            document.getElementById('contatoLocal').value = local.contato || '';
            document.getElementById('capacidadeLocal').value = local.capacidade || '';
            
            // Alterar o botão para "Atualizar"
            const submitButton = document.querySelector('#cadastroLocalForm button[type="submit"]');
            submitButton.innerHTML = '<i class="fas fa-save"></i> Atualizar Local';
            
            // CORREÇÃO: Remover event listener antigo e adicionar novo
            submitButton.replaceWith(submitButton.cloneNode(true));
            const newSubmitButton = document.querySelector('#cadastroLocalForm button[type="submit"]');
            newSubmitButton.innerHTML = '<i class="fas fa-save"></i> Atualizar Local';
            newSubmitButton.onclick = function(e) {
                e.preventDefault();
                atualizarLocal(localId);
            };
            
            // Adicionar botão de cancelar
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn-cancel';
            cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancelar';
            cancelButton.onclick = function(e) {
                e.preventDefault();
                hideForms();
                window.history.replaceState({}, document.title, window.location.pathname);
            };
            
            newSubmitButton.parentNode.appendChild(cancelButton);
        }
    }
}

async function atualizarLocal(localId) {
    showLoading(true);
    setButtonsState(true);
    
    try {
        const localAtualizado = {
            nome: document.getElementById('nomeLocal').value,
            endereco: document.getElementById('enderecoLocal').value,
            responsavel: document.getElementById('responsavelLocal').value,
            contato: document.getElementById('contatoLocal').value,
            capacidade: document.getElementById('capacidadeLocal').value || null,
            ultimaAtualizacao: new Date().toISOString()
        };
        
        await db.collection('locais').doc(localId).update(localAtualizado);
        
        mostrarMensagem('Local atualizado com sucesso!', 'sucesso');
        
        setTimeout(() => {
            window.location.href = 'todos-dados.html';
        }, 1000);
        
    } catch (error) {
        console.error("Erro ao atualizar local:", error);
        mostrarMensagem('Erro ao atualizar local.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

async function excluirLocal(localId) {
    if (confirm('Tem certeza que deseja excluir este local? Todos os eventos associados também serão excluídos.')) {
        showLoading(true);
        setButtonsState(true);
        
        try {
            await db.collection('locais').doc(localId).delete();
            
            const eventosParaExcluir = eventos.filter(e => e.localId === localId);
            for (const evento of eventosParaExcluir) {
                await db.collection('eventos').doc(evento.id).delete();
            }
            
            mostrarMensagem('Local excluído com sucesso!', 'sucesso');
        } catch (error) {
            console.error("Erro ao excluir local:", error);
            mostrarMensagem('Erro ao excluir local.', 'erro');
        } finally {
            showLoading(false);
            setButtonsState(false);
        }
    }
}

// Funções para editar eventos
async function editarEvento(eventoId) {
    if (emEdicao) {
        mostrarMensagem('Finalize a edição atual antes de editar outro item.', 'alerta');
        return;
    }
    
    try {
        window.location.href = 'adicionar-dados.html?editEvento=' + eventoId;
        
    } catch (error) {
        console.error("Erro ao editar evento:", error);
        mostrarMensagem('Erro ao carregar dados para edição.', 'erro');
    }
}

function carregarEventosParaEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get('editEvento');
    
    if (eventoId) {
        const evento = eventos.find(e => e.id === eventoId);
        if (evento) {
            showForm('evento');
            emEdicao = true;
            eventoEditando = eventoId;
            
            document.getElementById('localEvento').value = evento.localId;
            document.getElementById('escolaEvento').value = evento.escola;
            document.getElementById('diaSemanaEvento').value = evento.diaSemana;
            document.getElementById('horarioInicio').value = evento.horarioInicio;
            document.getElementById('horarioFim').value = evento.horarioFim;
            document.getElementById('responsavelEvento').value = evento.responsavel;
            document.getElementById('contatoEvento').value = evento.contato || '';
            document.getElementById('observacoesEvento').value = evento.observacoes || '';
            
            const submitButton = document.querySelector('#cadastroEventoForm button[type="submit"]');
            submitButton.innerHTML = '<i class="fas fa-save"></i> Atualizar Evento';
            
            submitButton.replaceWith(submitButton.cloneNode(true));
            const newSubmitButton = document.querySelector('#cadastroEventoForm button[type="submit"]');
            newSubmitButton.innerHTML = '<i class="fas fa-save"></i> Atualizar Evento';
            newSubmitButton.onclick = function(e) {
                e.preventDefault();
                atualizarEvento(eventoId);
            };
            
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn-cancel';
            cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancelar';
            cancelButton.onclick = function(e) {
                e.preventDefault();
                hideForms();
                window.history.replaceState({}, document.title, window.location.pathname);
            };
            
            newSubmitButton.parentNode.appendChild(cancelButton);
        }
    }
}

async function atualizarEvento(eventoId) {
    showLoading(true);
    setButtonsState(true);
    
    try {
        const localId = document.getElementById('localEvento').value;
        const localSelecionado = locais.find(l => l.id === localId);
        
        if (!localSelecionado) {
            mostrarMensagem('Selecione um local válido.', 'erro');
            return;
        }
        
        const horarioInicio = document.getElementById('horarioInicio').value;
        const horarioFim = document.getElementById('horarioFim').value;
        
        if (horarioFim <= horarioInicio) {
            mostrarMensagem('O horário de término deve ser após o horário de início.', 'erro');
            return;
        }
        
        const eventoAtualizado = {
            localId: localId,
            localNome: localSelecionado.nome,
            escola: document.getElementById('escolaEvento').value,
            diaSemana: document.getElementById('diaSemanaEvento').value,
            horarioInicio: horarioInicio,
            horarioFim: horarioFim,
            responsavel: document.getElementById('responsavelEvento').value,
            contato: document.getElementById('contatoEvento').value,
            observacoes: document.getElementById('observacoesEvento').value || '',
            ultimaAtualizacao: new Date().toISOString()
        };
        
        await db.collection('eventos').doc(eventoId).update(eventoAtualizado);
        
        mostrarMensagem('Evento atualizado com sucesso!', 'sucesso');
        
        setTimeout(() => {
            window.location.href = 'todos-dados.html';
        }, 1000);
    } catch (error) {
        console.error("Erro ao atualizar evento:", error);
        mostrarMensagem('Erro ao atualizar evento.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

async function excluirEvento(eventoId) {
    if (confirm('Tem certeza que deseja excluir este evento?')) {
        showLoading(true);
        setButtonsState(true);
        
        try {
            await db.collection('eventos').doc(eventoId).delete();
            
            mostrarMensagem('Evento excluído com sucesso!', 'sucesso');
            
            const modal = document.getElementById('detalhesModal');
            if (modal) {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao excluir evento:", error);
            mostrarMensagem('Erro ao excluir evento.', 'erro');
        } finally {
            showLoading(false);
            setButtonsState(false);
        }
    }
}

// MELHORIA: Função mostrarDetalhesLocal melhorada
function mostrarDetalhesLocal(localId) {
    const local = locais.find(l => l.id === localId);
    if (!local) return;
    
    const eventosLocal = eventos.filter(e => e.localId === localId);
    eventosFiltradosModal = [...eventosLocal];
    
    let eventosHTML = '';
    if (eventosLocal.length > 0) {
        // Agrupar eventos por dia da semana
        const eventosPorDia = {};
        eventosLocal.forEach(evento => {
            if (!eventosPorDia[evento.diaSemana]) {
                eventosPorDia[evento.diaSemana] = [];
            }
            eventosPorDia[evento.diaSemana].push(evento);
        });
        
        eventosHTML = `<h3>Eventos Cadastrados (${eventosLocal.length})</h3>`;
        
        // Ordenar dias da semana
        const ordemDias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
        
        ordemDias.forEach(dia => {
            if (eventosPorDia[dia]) {
                eventosHTML += `<div class="dia-section">
                    <h4><i class="fas fa-calendar-day"></i> ${dia}</h4>
                    <div class="eventos-dia" id="eventos-${dia.replace(' ', '')}">`;
                
                eventosPorDia[dia].forEach(evento => {
                    eventosHTML += `
                        <div class="evento-card">
                            <div class="evento-header">
                                <h5>${evento.escola}</h5>
                                <span class="horario-badge">${evento.horarioInicio} - ${evento.horarioFim}</span>
                            </div>
                            <div class="evento-info">
                                <p><i class="fas fa-user"></i> <strong>Responsável:</strong> ${evento.responsavel}</p>
                                <p><i class="fas fa-phone"></i> <strong>Contato:</strong> ${evento.contato || 'Não informado'}</p>
                                ${evento.observacoes ? `<p><i class="fas fa-sticky-note"></i> <strong>Observações:</strong> ${evento.observacoes}</p>` : ''}
                            </div>
                            <div class="evento-actions">
                                <button class="btn-edit btn-small" onclick="editarEvento('${evento.id}')"><i class="fas fa-edit"></i> Editar</button>
                                <button class="btn-delete btn-small" onclick="excluirEvento('${evento.id}')"><i class="fas fa-trash"></i> Excluir</button>
                            </div>
                        </div>
                    `;
                });
                
                eventosHTML += '</div></div>';
            }
        });
    } else {
        eventosHTML = '<p class="no-events">Nenhum evento cadastrado para este local.</p>';
    }
    
    const modal = document.getElementById('detalhesModal');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalConteudo');
    
    modalTitulo.textContent = local.nome;
    
    modalConteudo.innerHTML = `
        <div class="local-details">
            <div class="detail-item">
                <i class="fas fa-map-marker-alt"></i>
                <div>
                    <strong>Endereço:</strong>
                    <span>${local.endereco}</span>
                </div>
            </div>
            <div class="detail-item">
                <i class="fas fa-user-tie"></i>
                <div>
                    <strong>Responsável:</strong>
                    <span>${local.responsavel}</span>
                </div>
            </div>
            <div class="detail-item">
                <i class="fas fa-phone"></i>
                <div>
                    <strong>Contato:</strong>
                    <span>${local.contato || 'Não informado'}</span>
                </div>
            </div>
            ${local.capacidade ? `
            <div class="detail-item">
                <i class="fas fa-users"></i>
                <div>
                    <strong>Capacidade:</strong>
                    <span>${local.capacidade} pessoas</span>
                </div>
            </div>` : ''}
        </div>
        ${eventosHTML}
    `;
    
    modal.style.display = 'block';
}

function filtrarEventosModal() {
    const termoPesquisa = document.getElementById('pesquisaEventosModal').value.toLowerCase();
    const filtroDia = document.getElementById('filtroDiaModal').value;
    
    const eventosLista = document.querySelectorAll('.eventos-dia');
    
    if (!eventosLista) return;
    
    let eventosEncontrados = 0;
    
    eventosLista.forEach(diaContainer => {
        const eventosDia = diaContainer.querySelectorAll('.evento-card');
        let eventosVisiveis = 0;
        
        eventosDia.forEach(eventoCard => {
            const textoEvento = eventoCard.textContent.toLowerCase();
            const diaEvento = eventoCard.closest('.dia-section').querySelector('h4').textContent;
            
            let deveMostrar = true;
            
            // Filtro por pesquisa
            if (termoPesquisa && !textoEvento.includes(termoPesquisa)) {
                deveMostrar = false;
            }
            
            // Filtro por dia
            if (filtroDia && !diaEvento.includes(filtroDia)) {
                deveMostrar = false;
            }
            
            if (deveMostrar) {
                eventoCard.style.display = 'block';
                eventosVisiveis++;
                eventosEncontrados++;
            } else {
                eventoCard.style.display = 'none';
            }
        });
        
        // Mostrar/ocultar seção do dia baseado nos eventos visíveis
        const diaSection = diaContainer.closest('.dia-section');
        if (eventosVisiveis > 0) {
            diaSection.style.display = 'block';
        } else {
            diaSection.style.display = 'none';
        }
    });
    
    // Mostrar mensagem se nenhum evento for encontrado
    const noEventsMsg = document.querySelector('.no-events');
    if (noEventsMsg) {
        noEventsMsg.style.display = eventosEncontrados === 0 ? 'block' : 'none';
    }
}

function limparPesquisaEventosModal() {
    document.getElementById('pesquisaEventosModal').value = '';
    document.getElementById('filtroDiaModal').value = '';
    filtrarEventosModal();
}

// Funções de backup e exportação (mantidas originais)
async function fazerBackupJSON() {
    try {
        showLoading(true);
        setButtonsState(true);
        
        const backupName = document.getElementById('backupName').value || 'backup-dados';
        
        const dataStr = JSON.stringify({
            locais: locais,
            eventos: eventos,
            dataBackup: new Date().toISOString(),
            versao: '1.0'
        }, null, 2);
        
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `${backupName}-${new Date().toISOString().slice(0,10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        ultimoBackup = new Date().toISOString();
        localStorage.setItem('ultimoBackup', ultimoBackup);
        verificarBackupStatus();
        
        mostrarMensagem('Backup JSON criado com sucesso!', 'sucesso');
    } catch (error) {
        console.error("Erro ao criar backup:", error);
        mostrarMensagem('Erro ao criar backup.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

function exportarParaExcel() {
    if (typeof XLSX === 'undefined') {
        mostrarMensagem('Biblioteca de exportação não carregada.', 'erro');
        return;
    }
    
    if (locais.length === 0) {
        mostrarMensagem('Não há dados para exportar!', 'erro');
        return;
    }
    
    showLoading(true);
    setButtonsState(true);
    
    try {
        const dadosExportacao = [];
        
        locais.forEach(local => {
            dadosExportacao.push({
                'Tipo': 'Local',
                'Nome': local.nome,
                'Endereço': local.endereco,
                'Responsável': local.responsavel,
                'Contato': local.contato || '',
                'Capacidade': local.capacidade || '',
                'Data de Criação': new Date(local.dataCriacao).toLocaleString('pt-BR'),
                'Última Atualização': new Date(local.ultimaAtualizacao || local.dataCriacao).toLocaleString('pt-BR')
            });
        });
        
        eventos.forEach(evento => {
            dadosExportacao.push({
                'Tipo': 'Evento',
                'Local': evento.localNome,
                'Escola/Grupo': evento.escola,
                'Dia da Semana': evento.diaSemana,
                'Horário Início': evento.horarioInicio,
                'Horário Término': evento.horarioFim,
                'Responsável': evento.responsavel,
                'Contato': evento.contato || '',
                'Observações': evento.observacoes || '',
                'Data de Criação': new Date(evento.dataCriacao).toLocaleString('pt-BR'),
                'Última Atualização': new Date(evento.ultimaAtualizacao || evento.dataCriacao).toLocaleString('pt-BR')
            });
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
        
        XLSX.writeFile(workbook, `dados-sistema-${new Date().toISOString().slice(0,10)}.xlsx`);
        
        mostrarMensagem('Planilha Excel exportada com sucesso!', 'sucesso');
    } catch (error) {
        console.error("Erro ao exportar para Excel:", error);
        mostrarMensagem('Erro ao exportar para Excel.', 'erro');
    } finally {
        showLoading(false);
        setButtonsState(false);
    }
}

async function restaurarBackup() {
    const fileInput = document.getElementById('restoreFile');
    const file = fileInput.files[0];
    
    if (!file) {
        mostrarMensagem('Selecione um arquivo JSON para restaurar!', 'erro');
        return;
    }
    
    showLoading(true);
    setButtonsState(true);
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.locais || !Array.isArray(dados.locais)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            if (!confirm(`Tem certeza que deseja restaurar ${dados.locais.length} locais e ${dados.eventos?.length || 0} eventos? Todos os dados atuais serão substituídos.`)) {
                return;
            }
            
            await limparDadosFirebase();
            
            for (const local of dados.locais) {
                await db.collection('locais').add(local);
            }
            
            if (dados.eventos && Array.isArray(dados.eventos)) {
                for (const evento of dados.eventos) {
                    await db.collection('eventos').add(evento);
                }
            }
            
            mostrarMensagem(`Backup restaurado com sucesso! ${dados.locais.length} locais e ${dados.eventos?.length || 0} eventos importados.`, 'sucesso');
            
            fileInput.value = '';
            
        } catch (error) {
            console.error(error);
            mostrarMensagem('Erro ao processar arquivo: ' + error.message, 'erro');
        } finally {
            showLoading(false);
            setButtonsState(false);
        }
    };
    reader.readAsText(file);
}

async function limparDadosFirebase() {
    try {
        const eventosSnapshot = await db.collection('eventos').get();
        for (const doc of eventosSnapshot.docs) {
            await db.collection('eventos').doc(doc.id).delete();
        }
        
        const locaisSnapshot = await db.collection('locais').get();
        for (const doc of locaisSnapshot.docs) {
            await db.collection('locais').doc(doc.id).delete();
        }
    } catch (error) {
        console.error("Erro ao limpar dados:", error);
        throw new Error("Não foi possível limpar os dados atuais");
    }
}

function atualizarEstatisticas() {
    const estatisticasDiv = document.getElementById('estatisticas');
    if (!estatisticasDiv) return;
    
    const totalLocais = locais.length;
    const totalEventos = eventos.length;
    
    if (totalLocais === 0) {
        estatisticasDiv.innerHTML = '<p>Nenhum local cadastrado ainda.</p>';
        return;
    }
    
    let localMaisEventos = null;
    let maxEventos = 0;
    
    for (const local of locais) {
        const eventosLocal = eventos.filter(e => e.localId === local.id).length;
        if (eventosLocal > maxEventos) {
            maxEventos = eventosLocal;
            localMaisEventos = local.nome;
        }
    }
    
    estatisticasDiv.innerHTML = `
        <p><strong>Total de locais:</strong> ${totalLocais}</p>
        <p><strong>Total de eventos:</strong> ${totalEventos}</p>
        <p><strong>Local com mais eventos:</strong> ${localMaisEventos || 'Nenhum'} (${maxEventos} eventos)</p>
    `;
}

function verificarBackupStatus() {
    const backupStatusDiv = document.getElementById('backupStatus');
    if (!backupStatusDiv) return;
    
    if (!ultimoBackup) {
        backupStatusDiv.innerHTML = '<p><strong>Status de backup:</strong> Nenhum backup realizado ainda. É recomendado fazer backup regularmente.</p>';
        backupStatusDiv.className = 'alerta';
        return;
    }
    
    const dataBackup = new Date(ultimoBackup);
    const diasDesdeBackup = Math.floor((new Date() - dataBackup) / (1000 * 60 * 60 * 24));
    
    if (diasDesdeBackup > 7) {
        backupStatusDiv.innerHTML = `<p><strong>Status de backup:</strong> Seu último backup foi há ${diasDesdeBackup} dias. É altamente recomendado fazer um novo backup.</p>`;
        backupStatusDiv.className = 'erro';
    } else if (diasDesdeBackup > 3) {
        backupStatusDiv.innerHTML = `<p><strong>Status de backup:</strong> Seu último backup foi há ${diasDesdeBackup} dias. Considere fazer um novo backup em breve.</p>`;
        backupStatusDiv.className = 'alerta';
    } else {
        backupStatusDiv.innerHTML = `<p><strong>Status de backup:</strong> Seu último backup foi há ${diasDesdeBackup} dias. Está em dia!</p>`;
        backupStatusDiv.className = 'sucesso';
    }
}

function mostrarMensagem(texto, tipo) {
    const mensagensExistentes = document.querySelectorAll('.mensagem');
    mensagensExistentes.forEach(msg => msg.remove());
    
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `mensagem ${tipo}`;
    
    let icone = '';
    if (tipo === 'sucesso') icone = '<i class="fas fa-check-circle"></i> ';
    if (tipo === 'erro') icone = '<i class="fas fa-exclamation-circle"></i> ';
    if (tipo === 'alerta') icone = '<i class="fas fa-exclamation-triangle"></i> ';
    
    mensagemDiv.innerHTML = icone + texto;
    
    const container = document.querySelector('.content .card') || document.querySelector('.content');
    if (container) {
        container.prepend(mensagemDiv);
        
        setTimeout(() => {
            if (mensagemDiv.parentNode) {
                mensagemDiv.remove();
            }
        }, 5000);
    }
}

// Configurar modal
function setupModal() {
    const modal = document.getElementById('detalhesModal');
    if (!modal) return;
    
    const span = document.getElementsByClassName('close')[0];
    
    span.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

// Inicialização do sistema
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', fazerLogin);
    }
    
    const cadastroLocalForm = document.getElementById('cadastroLocalForm');
    if (cadastroLocalForm) {
        cadastroLocalForm.addEventListener('submit', adicionarLocal);
    }
    
    const cadastroEventoForm = document.getElementById('cadastroEventoForm');
    if (cadastroEventoForm) {
        cadastroEventoForm.addEventListener('submit', adicionarEvento);
    }
    
    setupModal();
    
    if (usuarioLogado) {
        carregarDados();
        
        const urlParams = new URLSearchParams(window.location.search);
        const editLocalId = urlParams.get('editLocal');
        const editEventoId = urlParams.get('editEvento');
        
        if (editLocalId) {
            carregarLocalParaEdicao();
        } else if (editEventoId) {
            carregarEventosParaEdicao();
        }
        
        if (window.location.pathname.includes('backup')) {
            atualizarEstatisticas();
            verificarBackupStatus();
        }
    }
});
