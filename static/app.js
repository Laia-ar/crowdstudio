// ==========================================
// CrowdStudio - Aplicación SPA
// ==========================================

const API_URL = '/api';

// Estado global
// Obtener token de localStorage, limpiar si es inválido
const storedToken = localStorage.getItem('token');
const validToken = storedToken && storedToken !== 'null' && storedToken !== 'undefined' ? storedToken : null;

const state = {
    user: null,
    token: validToken,
    projects: [],
    currentView: 'home',
    selectedProject: null
};

// ==========================================
// Utilidades
// ==========================================

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amount);
}

function getStatusBadge(status) {
    const badges = {
        'open': '<span class="badge badge-open">Abierto</span>',
        'in_progress': '<span class="badge badge-progress">En Progreso</span>',
        'completed': '<span class="badge badge-completed">Completado</span>',
        'commercialized': '<span class="badge badge-commercialized">Comercializado</span>',
        'draft': '<span class="badge badge-pending">Borrador</span>',
        'pending': '<span class="badge badge-pending">Pendiente</span>',
        'accepted': '<span class="badge badge-accepted">Aceptado</span>',
        'rejected': '<span class="badge badge-rejected">Rechazado</span>',
        'validated': '<span class="badge badge-accepted">Validado</span>'
    };
    return badges[status] || `<span class="badge badge-pending">${status}</span>`;
}

async function api(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    // Debug: mostrar si tenemos token
    console.log('API Call:', endpoint, 'Token:', state.token ? 'Presente' : 'No hay token');
    
    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...options.headers
        },
        ...options
    };
    
    // Agregar Authorization header si hay token
    if (state.token) {
        config.headers['Authorization'] = `Bearer ${state.token}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.body)) {
            params.append(key, value);
        }
        config.body = params.toString();
    }
    
    console.log('Request headers:', config.headers);

    try {
        const response = await fetch(url, config);
        console.log('Response status:', response.status);
        
        if (response.status === 401) {
            console.error('Error 401: No autenticado');
            showNotification('Sesión expirada o no válida. Por favor ingresa nuevamente.', 'error');
            logout();
            return null;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Error en la petición');
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 2000; max-width: 400px;';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// ==========================================
// Vistas
// ==========================================

function renderLayout(content) {
    const isLoggedIn = !!state.token;
    const isAdmin = state.user?.role === 'admin';

    return `
        <header>
            <div class="container">
                <div class="logo" onclick="navigateTo('home')">🎬 CrowdStudio</div>
                <nav>
                    <a onclick="navigateTo('projects')">Proyectos</a>
                    <a onclick="navigateTo('how-it-works')">Cómo funciona</a>
                    ${isLoggedIn ? `
                        ${isAdmin ? `<a onclick="navigateTo('admin')">Admin</a>` : ''}
                        <a onclick="navigateTo('my-projects')">Mis Proyectos</a>
                        <span style="color: var(--gray-600);">${state.user?.full_name}</span>
                        <button class="btn btn-outline btn-sm" onclick="logout()">Salir</button>
                    ` : `
                        <button class="btn btn-primary btn-sm" onclick="navigateTo('login')">Ingresar</button>
                        <button class="btn btn-outline btn-sm" onclick="navigateTo('register')">Registrarse</button>
                    `}
                </nav>
            </div>
        </header>
        <main>
            <div class="container">
                ${content}
            </div>
        </main>
        <footer>
            <div class="container">
                <p>CrowdStudio - Productora Audiovisual Descentralizada &copy; 2024</p>
            </div>
        </footer>
    `;
}

function renderHome() {
    return renderLayout(`
        <div class="hero">
            <div class="container">
                <h1>Crea cine, series y arte juntos</h1>
                <p>Una productora audiovisual descentralizada donde la comunidad decide, aprende y construye obras colectivamente. 
                   Tu voz cuenta y tu voto decide.</p>
                <button class="btn btn-primary" style="font-size: 1.1rem; padding: 0.75rem 2rem;" 
                        onclick="navigateTo('projects')">
                    Explorar Proyectos
                </button>
            </div>
        </div>
        
        <div class="section">
            <h2 class="section-title">Proyectos Activos</h2>
            <div id="public-projects-grid" class="grid">
                <div class="empty-state">Cargando proyectos...</div>
            </div>
        </div>
        
        <div class="section">
            <h2 class="section-title" style="text-align: center;">Crear colectivamente significa...</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
                <div class="card" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🗳️</div>
                    <h3>Participar en las decisiones</h3>
                    <p>Desde el guión hasta el destino de los excedentes: profesionales y mecenas tienen el mismo derecho de voto.</p>
                </div>
                <div class="card" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎓</div>
                    <h3>Aprender del proceso</h3>
                    <p>Accedé a las reuniones de cada área, curioseá cómo se construye una obra y formate en el camino.</p>
                </div>
                <div class="card" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🤝</div>
                    <h3>Ser dueño de lo creado</h3>
                    <p>Aportá tu trabajo, equipos o recursos y recibí compensación justa cuando el proyecto se comercialice.</p>
                </div>
            </div>
        </div>
    `);
}

function renderHowItWorks() {
    return renderLayout(`
        <div class="section">
            <h1 class="section-title">Cómo funciona CrowdStudio</h1>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">🎬 1. Proyectos culturales abiertos</h3>
                <p>Se proponen proyectos (películas, documentales, series, libros, canciones) con objetivos claros, presupuesto teórico y roles necesarios. El guión y las decisiones clave salen de la comunidad.</p>
            </div>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">👥 2. Participación como profesional o mecenas</h3>
                <p><strong>Tu voz cuenta y tu voto decide.</strong> Podés sumarte aportando horas de trabajo, equipos, locaciones o recursos económicos. Todos los aportes validados te convierten en miembro con derecho a voto en ese proyecto.</p>
            </div>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">🎓 3. Espacios de trabajo por área + instancias presenciales</h3>
                <p>Cada rubro creativo y técnico tiene su espacio de trabajo virtual y una agenda abierta. La comunidad puede curiosear reuniones, aprender del proceso y participar en encuentros presenciales cuando el proyecto lo permita.</p>
            </div>
            
            <div class="card" style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">💵 4. Distribución económica transparente</h3>
                <p>Cuando el proyecto se comercializa:</p>
                <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                    <li><strong>Paso 1:</strong> Se compensa a quienes trabajaron según contribuciones auditadas.</li>
                    <li><strong>Paso 2:</strong> Si hay excedente, la comunidad vota su destino:
                        <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                            <li>Nuevos proyectos</li>
                            <li>Sostenimiento de la comunidad</li>
                            <li>Mejoras de plataforma</li>
                            <li>Actividades presenciales / formación</li>
                        </ul>
                    </li>
                </ul>
            </div>
            
            <div class="card" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white;">
                <h3 style="margin-bottom: 1rem;">¿Quiénes forman la comunidad?</h3>
                <p>Profesionales y mecenas con el <strong>mismo derecho de participación y voto</strong>. Ser miembro no es solo registrarse: significa que hiciste un aporte concreto a un proyecto y que tus decisiones cuentan.</p>
            </div>
        </div>
    `);
}

function renderLogin() {
    return renderLayout(`
        <div style="max-width: 400px; margin: 2rem auto;">
            <div class="card">
                <h2 class="card-title">Iniciar Sesión</h2>
                <form onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" name="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Ingresar
                    </button>
                </form>
                <p style="text-align: center; margin-top: 1rem; font-size: 0.875rem;">
                    ¿No tienes cuenta? <a href="#" onclick="navigateTo('register')" style="color: var(--primary);">Regístrate</a>
                </p>
                <div class="alert alert-info" style="margin-top: 1rem; font-size: 0.875rem;">
                    <strong>Cuenta admin demo:</strong><br>
                    Email: admin@platform.com<br>
                    Contraseña: admin123
                </div>
            </div>
        </div>
    `);
}

function renderRegister() {
    return renderLayout(`
        <div style="max-width: 400px; margin: 2rem auto;">
            <div class="card">
                <h2 class="card-title">Crear Cuenta</h2>
                <form onsubmit="handleRegister(event)">
                    <div class="form-group">
                        <label>Nombre completo</label>
                        <input type="text" name="full_name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" name="password" class="form-control" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Registrarse
                    </button>
                </form>
                <p style="text-align: center; margin-top: 1rem; font-size: 0.875rem;">
                    ¿Ya tienes cuenta? <a href="#" onclick="navigateTo('login')" style="color: var(--primary);">Ingresa</a>
                </p>
            </div>
        </div>
    `);
}

function renderProjects() {
    return renderLayout(`
        <div class="section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h1 class="section-title" style="margin: 0;">Proyectos</h1>
                ${state.user?.role === 'admin' ? `
                    <button class="btn btn-primary" onclick="showCreateProjectModal()">
                        + Nuevo Proyecto
                    </button>
                ` : ''}
            </div>
            <div id="projects-grid" class="grid">
                <div class="empty-state">Cargando proyectos...</div>
            </div>
        </div>
    `);
}

function renderProjectDetail(projectId) {
    return renderLayout(`
        <div class="section">
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('projects')" style="margin-bottom: 1rem;">
                ← Volver a proyectos
            </button>
            <div id="project-detail">
                <div class="empty-state">Cargando proyecto...</div>
            </div>
        </div>
    `);
}

function renderMyProjects() {
    return renderLayout(`
        <div class="section">
            <h1 class="section-title">Mis Proyectos</h1>
            <div id="my-projects-content">
                <div class="empty-state">Cargando...</div>
            </div>
        </div>
    `);
}

function renderAdmin() {
    return renderLayout(`
        <div class="section">
            <h1 class="section-title">Panel de Administración</h1>
            
            <div class="tabs">
                <div class="tab active" onclick="showAdminTab('projects')">Proyectos</div>
                <div class="tab" onclick="showAdminTab('users')">Usuarios</div>
            </div>
            
            <div id="admin-content">
                <div class="empty-state">Cargando...</div>
            </div>
        </div>
    `);
}

// ==========================================
// Handlers
// ==========================================

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();
    formData.append('username', form.email.value);
    formData.append('password', form.password.value);

    try {
        const data = await api('/token', {
            method: 'POST',
            body: formData,
            headers: {}
        });
        
        if (data) {
            state.token = data.access_token;
            state.user = data.user;
            localStorage.setItem('token', state.token);
            showNotification('Sesión iniciada correctamente', 'success');
            navigateTo('projects');
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/register', {
            method: 'POST',
            body: {
                email: form.email.value,
                password: form.password.value,
                full_name: form.full_name.value
            }
        });
        
        showNotification('Cuenta creada. Ahora puedes iniciar sesión.', 'success');
        navigateTo('login');
    } catch (error) {
        console.error(error);
    }
}

async function handleCreateProject(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/projects', {
            method: 'POST',
            body: {
                title: form.title.value,
                description: form.description.value,
                type: form.type.value,
                objectives: form.objectives.value,
                budget_theoretical: form.budget.value
            }
        });
        
        closeModal();
        showNotification('Proyecto creado correctamente', 'success');
        loadProjects();
    } catch (error) {
        console.error(error);
    }
}

async function handleCreateRole(e, projectId) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api(`/projects/${projectId}/roles`, {
            method: 'POST',
            body: {
                title: form.title.value,
                description: form.description.value,
                tasks: form.tasks.value,
                deliverables: form.deliverables.value,
                reference_fee: form.reference_fee.value,
                requires_experience: form.requires_experience.checked
            }
        });
        
        closeModal();
        showNotification('Rol creado correctamente', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function handleApply(e, roleId) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const body = { message: form.message.value };
        if (form.experience_references) {
            body.experience_references = form.experience_references.value;
        }
        
        const data = await api(`/roles/${roleId}/apply`, {
            method: 'POST',
            body: body
        });
        
        closeModal();
        showNotification('Postulación enviada', 'success');
        loadProjects();
    } catch (error) {
        console.error(error);
    }
}

async function handleDonate(e, projectId) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api(`/projects/${projectId}/donate`, {
            method: 'POST',
            body: { amount: form.amount.value }
        });
        
        closeModal();
        showNotification('Aporte registrado (simulado)', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// Data Loading
// ==========================================

async function loadPublicProjects() {
    try {
        const projects = await api('/projects/public');
        const grid = document.getElementById('public-projects-grid');
        if (!grid) return;
        
        if (projects.length === 0) {
            grid.innerHTML = `<div class="empty-state">No hay proyectos activos aún</div>`;
            return;
        }
        
        grid.innerHTML = projects.slice(0, 3).map(p => `
            <div class="card project-card">
                <div class="project-type">${p.type}</div>
                <h3 class="card-title">${p.title}</h3>
                <p class="card-subtitle">${p.description.substring(0, 120)}...</p>
                <div>${getStatusBadge(p.status)}</div>
                <div class="project-roles">
                    <strong>Roles necesarios:</strong>
                    ${p.roles.map(r => `
                        <div class="role-item">
                            <span>${r.title}</span>
                            ${r.is_filled ? '<span class="badge badge-accepted">Asignado</span>' : '<span class="badge badge-open">Disponible</span>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function loadProjects() {
    try {
        const projects = state.token 
            ? await api('/projects')
            : await api('/projects/public');
        
        const grid = document.getElementById('projects-grid');
        if (!grid) return;
        
        if (projects.length === 0) {
            grid.innerHTML = `<div class="empty-state">No hay proyectos activos aún</div>`;
            return;
        }
        
        grid.innerHTML = projects.map(p => `
            <div class="card project-card" onclick="navigateTo('project', ${p.id})" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div class="project-type">${p.type}</div>
                    ${getStatusBadge(p.status)}
                </div>
                <h3 class="card-title">${p.title}</h3>
                <p class="card-subtitle">${p.description.substring(0, 150)}...</p>
                ${p.is_member ? '<span class="badge badge-accepted" style="margin-top: 0.5rem;">Ya eres miembro</span>' : ''}
                <div class="project-roles">
                    <strong>${p.roles.filter(r => !r.is_filled).length} roles disponibles</strong>
                    ${p.roles.filter(r => !r.is_filled).slice(0, 2).map(r => `
                        <div class="role-item">
                            <span>${r.title}</span>
                        </div>
                    `).join('')}
                    ${p.roles.filter(r => !r.is_filled).length > 2 ? `<div style="font-size: 0.75rem; color: var(--gray-600);">Y ${p.roles.filter(r => !r.is_filled).length - 2} más...</div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error(error);
    }
}

async function loadProjectDetail(projectId) {
    try {
        const project = await api(`/projects/${projectId}/public`);
        
        // Cargar datos adicionales en paralelo
        let resources = [];
        let events = [];
        let votings = [];
        
        try {
            [resources, events, votings] = await Promise.all([
                api(`/projects/${projectId}/resources`).catch(() => []),
                api(`/projects/${projectId}/events`).catch(() => []),
                state.token ? api(`/projects/${projectId}/votings`).catch(() => []) : Promise.resolve([])
            ]);
        } catch (e) {
            console.error('Error cargando datos secundarios:', e);
        }
        
        const container = document.getElementById('project-detail');
        if (!container) return;
        
        const isAdmin = state.user?.role === 'admin';
        
        let html = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <div class="project-type">${project.type}</div>
                        <h1 style="margin-bottom: 0.5rem;">${project.title}</h1>
                        <p style="color: var(--gray-600);">Productor: ${project.producer || 'Equipo CrowdStudio'}</p>
                    </div>
                    ${getStatusBadge(project.status)}
                </div>
                
                <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 1.5rem 0;">
                
                <h3 style="margin-bottom: 0.5rem;">Descripción</h3>
                <p style="margin-bottom: 1.5rem;">${project.description}</p>
                
                <h3 style="margin-bottom: 0.5rem;">Objetivos</h3>
                <p style="margin-bottom: 1.5rem;">${project.objectives || 'No especificado'}</p>
                
                ${isAdmin ? `
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="showAddRoleModal(${project.id})">
                            + Agregar Rol
                        </button>
                        <button class="btn btn-secondary" onclick="showApplications(${project.id})">
                            Ver Postulaciones
                        </button>
                        <button class="btn btn-secondary" onclick="showContributions(${project.id})">
                            Ver Contribuciones
                        </button>
                        <button class="btn btn-secondary" onclick="showVotings(${project.id})">
                            Ver Votaciones
                        </button>
                        <button class="btn btn-warning" onclick="showCompleteModal(${project.id})">
                            Comercializar
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Roles Necesarios</h3>
                <div style="display: grid; gap: 1rem;">
                    ${project.roles.length === 0 ? '<p style="color: var(--gray-600);">Aún no se han definido roles para este proyecto.</p>' : project.roles.map(r => `
                        <div style="padding: 1rem; background: var(--gray-100); border-radius: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <h4 style="margin-bottom: 0.25rem;">${r.title}</h4>
                                    <p style="font-size: 0.875rem; color: var(--gray-600);">${r.description || ''}</p>
                                    ${r.tasks ? `<p style="font-size: 0.875rem; margin-top: 0.5rem;"><strong>Tareas:</strong> ${r.tasks}</p>` : ''}
                                    ${r.reference_fee > 0 ? `<p style="font-size: 0.875rem; color: var(--primary);"><strong>Honorario referencia:</strong> ${formatCurrency(r.reference_fee)}</p>` : ''}
                                    ${r.requires_experience ? `<p style="font-size: 0.875rem; color: var(--warning);"><strong>⚠ Requiere experiencia comprobable</strong></p>` : ''}
                                </div>
                                ${r.is_filled 
                                    ? '<span class="badge badge-accepted">Asignado</span>'
                                    : state.token 
                                        ? `<button class="btn btn-primary btn-sm" onclick="showApplyModal(${r.id}, '${r.title.replace(/'/g, "\\'")}', ${r.requires_experience || false})">Postularme</button>`
                                        : '<span class="badge badge-pending">Regístrate para postularte</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Equipos, Insumos y Locaciones</h3>
                ${isAdmin ? `
                    <div style="margin-bottom: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="showAddResourceModal(${project.id})">+ Agregar Necesidad</button>
                    </div>
                ` : ''}
                <div style="display: grid; gap: 1rem;">
                    ${resources.length === 0 ? '<p style="color: var(--gray-600);">Aún no se han solicitado equipos, insumos o locaciones.</p>' : resources.map(res => `
                        <div style="padding: 1rem; background: var(--gray-100); border-radius: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <h4 style="margin-bottom: 0.25rem;">${res.title}</h4>
                                    <span class="badge badge-open" style="margin-bottom: 0.5rem; display: inline-block;">${res.category === 'equipment' ? 'Equipo' : res.category === 'location' ? 'Locación' : 'Insumo'}</span>
                                    <p style="font-size: 0.875rem; color: var(--gray-600);">${res.description || ''}</p>
                                    ${res.provider_name ? `<p style="font-size: 0.875rem; color: var(--primary); margin-top: 0.5rem;"><strong>Aportado por:</strong> ${res.provider_name}</p>` : ''}
                                </div>
                                ${res.is_filled 
                                    ? '<span class="badge badge-accepted">Cuberto</span>'
                                    : state.token 
                                        ? `<button class="btn btn-primary btn-sm" onclick="showOfferResourceModal(${res.id}, '${res.title.replace(/'/g, "\\'")}')">Ofrecer</button>`
                                        : '<span class="badge badge-pending">Regístrate para ofrecer</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Agenda del Proyecto</h3>
                ${isAdmin ? `
                    <div style="margin-bottom: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="showAddEventModal(${project.id})">+ Agendar Reunión</button>
                    </div>
                ` : ''}
                <div style="display: grid; gap: 1rem;">
                    ${events.length === 0 ? '<p style="color: var(--gray-600);">No hay eventos programados aún.</p>' : events.map(ev => `
                        <div style="padding: 1rem; background: var(--gray-100); border-radius: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <h4 style="margin-bottom: 0.25rem;">${ev.title}</h4>
                                    <p style="font-size: 0.875rem; color: var(--primary); margin-bottom: 0.25rem;">
                                        <strong>${formatDate(ev.event_date)}</strong> — ${new Date(ev.event_date).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                    ${ev.related_role_title ? `<p style="font-size: 0.875rem; color: var(--gray-600);">Área: ${ev.related_role_title}</p>` : ''}
                                    <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem;">${ev.description || ''}</p>
                                </div>
                                ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent(${ev.id}, ${project.id})">Eliminar</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${state.token ? `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Votaciones del Proyecto</h3>
                    <div style="display: grid; gap: 1rem;">
                        ${votings.length === 0 ? '<p style="color: var(--gray-600);">No hay votaciones activas en este proyecto.</p>' : votings.map(v => `
                            <div style="padding: 1rem; background: var(--gray-100); border-radius: 0.5rem;">
                                <h4 style="margin-bottom: 0.5rem;">${v.title}</h4>
                                <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 1rem;">${v.description || ''}</p>
                                ${v.status === 'open' && !v.has_voted ? `
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${v.options.map((opt, idx) => `
                                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.875rem;">
                                                <input type="radio" name="vote_option_${v.id}" value="${idx}" style="width: auto;">
                                                ${opt}
                                            </label>
                                        `).join('')}
                                        <button class="btn btn-primary btn-sm" style="margin-top: 0.5rem; align-self: flex-start;" onclick="castProjectVote(${v.id}, ${project.id})">Votar</button>
                                    </div>
                                ` : v.has_voted ? '<span class="badge badge-accepted">Ya votaste</span>' : '<span class="badge badge-pending">Cerrada</span>'}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        if (state.token) {
            html += `
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Apoyar el Proyecto</h3>
                    <p style="margin-bottom: 1rem;">Haz un aporte económico voluntario y conviértete en mecenas con derecho a voto.</p>
                    <button class="btn btn-success" onclick="showDonateModal(${project.id})">
                        Hacer Aporte
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error(error);
    }
}

async function loadMyProjects() {
    if (!state.token) {
        navigateTo('login');
        return;
    }
    
    try {
        // Obtener aplicaciones del usuario
        const projects = await api('/projects');
        const container = document.getElementById('my-projects-content');
        if (!container) return;
        
        // Filtrar proyectos donde el usuario tiene roles asignados o ha postulado
        const myApplications = [];
        const myContributions = [];
        
        // Simplificado - mostrar mensaje
        container.innerHTML = `
            <div class="card">
                <h3>Tus Postulaciones</h3>
                <p style="color: var(--gray-600);">Aquí verás el estado de tus postulaciones a roles.</p>
                <div class="alert alert-info" style="margin-top: 1rem;">
                    Explora los proyectos y postúlate a los roles que se ajusten a tus habilidades.
                </div>
            </div>
            ${state.user?.role === 'member' || state.user?.role === 'admin' ? `
                <div class="card">
                    <h3>Registro de Contribuciones</h3>
                    <p style="color: var(--gray-600);">Registra tu trabajo para que sea validado por los productores.</p>
                    <button class="btn btn-primary" onclick="navigateTo('projects')">Ir a proyectos</button>
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// Modales
// ==========================================

function showCreateProjectModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Nuevo Proyecto</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCreateProject(event)">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" name="title" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Tipo (película, documental, serie, libro, canción)</label>
                        <input type="text" name="type" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea name="description" class="form-control" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Objetivos</label>
                        <textarea name="objectives" class="form-control"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Presupuesto Teórico ($)</label>
                        <input type="number" name="budget" class="form-control" value="0" step="0.01">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Crear Proyecto</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

function showAddRoleModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Agregar Rol</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCreateRole(event, ${projectId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Título del Rol</label>
                        <input type="text" name="title" class="form-control" required placeholder="Ej: Director de Fotografía">
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea name="description" class="form-control" placeholder="Describe el rol..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Tareas</label>
                        <textarea name="tasks" class="form-control" placeholder="Lista de tareas principales..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Entregables</label>
                        <textarea name="deliverables" class="form-control" placeholder="Qué debe entregar..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Honorario de Referencia ($)</label>
                        <input type="number" name="reference_fee" class="form-control" value="0" step="0.01">
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" name="requires_experience" id="requires_experience" value="true" style="width: auto;">
                        <label for="requires_experience" style="margin: 0; font-weight: normal;">Requiere experiencia comprobable</label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Agregar Rol</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

function showApplyModal(roleId, roleTitle, requiresExperience = false) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Postularse a: ${roleTitle}</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleApply(event, ${roleId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Mensaje para el productor</label>
                        <textarea name="message" class="form-control" required rows="5" 
                            placeholder="Cuéntanos por qué eres la persona ideal para este rol..."></textarea>
                    </div>
                    ${requiresExperience ? `
                    <div class="form-group">
                        <label>Referencias / Links de trabajos previos <span style="color: var(--danger);">*</span></label>
                        <textarea name="experience_references" class="form-control" required rows="3" 
                            placeholder="Compartí links a trabajos anteriores, portfolio, etc."></textarea>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Enviar Postulación</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

function showDonateModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Apoyar el Proyecto</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleDonate(event, ${projectId})">
                <div class="modal-body">
                    <div class="alert alert-info">
                        Este es un sistema simulado. No se procesarán pagos reales.
                    </div>
                    <div class="form-group">
                        <label>Monto a aportar ($)</label>
                        <input type="number" name="amount" class="form-control" required min="1" step="0.01">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-success">Confirmar Aporte</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function showApplications(projectId) {
    try {
        const applications = await api(`/projects/${projectId}/applications`);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Postulaciones</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    ${applications.length === 0 ? '<p>No hay postulaciones aún.</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Rol</th>
                                    <th>Postulante</th>
                                    <th>Mensaje</th>
                                    <th>Referencias</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${applications.map(app => `
                                    <tr>
                                        <td>${app.role_title}</td>
                                        <td>
                                            ${app.user_name}<br>
                                            <small style="color: var(--gray-600);">${app.user_email}</small>
                                        </td>
                                        <td style="max-width: 200px;"><small>${app.message}</small></td>
                                        <td style="max-width: 200px;">${app.experience_references ? `<small>${app.experience_references}</small>` : '-'}</td>
                                        <td>${getStatusBadge(app.status)}</td>
                                        <td>
                                            ${app.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="respondApplication(${app.id}, true)">Aceptar</button>
                                                <button class="btn btn-danger btn-sm" onclick="respondApplication(${app.id}, false)">Rechazar</button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
    }
}

async function showContributions(projectId) {
    try {
        const contributions = await api(`/projects/${projectId}/contributions`);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>Registro de Contribuciones</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="showAddContributionModal(${projectId})">
                            + Registrar Contribución
                        </button>
                    </div>
                    ${contributions.length === 0 ? '<p>No hay contribuciones registradas.</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Miembro</th>
                                    <th>Rol</th>
                                    <th>Descripción</th>
                                    <th>Horas</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${contributions.map(c => `
                                    <tr>
                                        <td>${c.user_name}</td>
                                        <td>${c.role_title}</td>
                                        <td style="max-width: 200px;"><small>${c.description}</small></td>
                                        <td>${c.hours_worked}</td>
                                        <td>${getStatusBadge(c.status)}</td>
                                        <td>
                                            ${c.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="validateContribution(${c.id}, true)">Validar</button>
                                                <button class="btn btn-danger btn-sm" onclick="validateContribution(${c.id}, false)">Rechazar</button>
                                            ` : formatCurrency(c.compensation_amount || 0)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
    }
}

function showAddResourceModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Agregar Equipo, Insumo o Locación</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCreateResource(event, ${projectId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Categoría</label>
                        <select name="category" class="form-control" required>
                            <option value="equipment">Equipo técnico</option>
                            <option value="location">Locación / Espacio</option>
                            <option value="supply">Insumo / Material</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" name="title" class="form-control" required placeholder="Ej: Cámara DSLR, Fábrica en CABA, etc.">
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea name="description" class="form-control" placeholder="Detalles de lo que se necesita..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Agregar</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleCreateResource(e, projectId) {
    e.preventDefault();
    const form = e.target;
    try {
        await api(`/projects/${projectId}/resources`, {
            method: 'POST',
            body: {
                category: form.category.value,
                title: form.title.value,
                description: form.description.value
            }
        });
        closeModal();
        showNotification('Recurso agregado correctamente', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

function showOfferResourceModal(resourceId, resourceTitle) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Ofrecer: ${resourceTitle}</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleOfferResource(event, ${resourceId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Mensaje para el productor</label>
                        <textarea name="message" class="form-control" required rows="4" 
                            placeholder="Describí qué podés aportar y en qué condiciones..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Enviar Oferta</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleOfferResource(e, resourceId) {
    e.preventDefault();
    const form = e.target;
    try {
        await api(`/resources/${resourceId}/offer`, {
            method: 'POST',
            body: { message: form.message.value }
        });
        closeModal();
        showNotification('Oferta enviada correctamente', 'success');
        // Recargar la vista actual si estamos en un proyecto
        const hash = window.location.hash.slice(1);
        const [view, projectId] = hash.split('/');
        if (view === 'project' && projectId) {
            loadProjectDetail(parseInt(projectId));
        }
    } catch (error) {
        console.error(error);
    }
}

async function showResourceOffers(resourceId) {
    try {
        const offers = await api(`/resources/${resourceId}/offers`);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Ofertas recibidas</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    ${offers.length === 0 ? '<p>No hay ofertas aún.</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Postulante</th>
                                    <th>Mensaje</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${offers.map(o => `
                                    <tr>
                                        <td>${o.user_name}<br><small style="color: var(--gray-600);">${o.user_email}</small></td>
                                        <td style="max-width: 250px;"><small>${o.message}</small></td>
                                        <td>${getStatusBadge(o.status)}</td>
                                        <td>
                                            ${o.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="respondResourceOffer(${resourceId}, ${o.id}, true)">Aceptar</button>
                                                <button class="btn btn-danger btn-sm" onclick="respondResourceOffer(${resourceId}, ${o.id}, false)">Rechazar</button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
    }
}

async function respondResourceOffer(resourceId, offerId, accept) {
    try {
        await api(`/resources/${resourceId}/respond`, {
            method: 'POST',
            body: { offer_id: offerId, accept }
        });
        showNotification(accept ? 'Oferta aceptada' : 'Oferta rechazada', 'success');
        closeModal();
        const hash = window.location.hash.slice(1);
        const [view, projectId] = hash.split('/');
        if (view === 'project' && projectId) {
            loadProjectDetail(parseInt(projectId));
        }
    } catch (error) {
        console.error(error);
    }
}

function showAddEventModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Agendar Reunión / Instancia</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCreateEvent(event, ${projectId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" name="title" class="form-control" required placeholder="Ej: Reunión de dirección de arte">
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea name="description" class="form-control" placeholder="Detalles de la instancia..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Fecha y hora</label>
                        <input type="datetime-local" name="event_date" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Área / Rol relacionado (opcional)</label>
                        <input type="text" name="related_role_title" class="form-control" placeholder="Ej: Dirección de arte">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Agendar</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleCreateEvent(e, projectId) {
    e.preventDefault();
    const form = e.target;
    try {
        const dateValue = new Date(form.event_date.value);
        await api(`/projects/${projectId}/events`, {
            method: 'POST',
            body: {
                title: form.title.value,
                description: form.description.value,
                event_date: dateValue.toISOString(),
                related_role_title: form.related_role_title.value
            }
        });
        closeModal();
        showNotification('Evento agendado correctamente', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function deleteEvent(eventId, projectId) {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
        await api(`/events/${eventId}`, { method: 'DELETE' });
        showNotification('Evento eliminado', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function castProjectVote(votingId, projectId) {
    const selected = document.querySelector(`input[name="vote_option_${votingId}"]:checked`);
    if (!selected) {
        showNotification('Seleccioná una opción para votar', 'error');
        return;
    }
    try {
        await api(`/votings/${votingId}/vote`, {
            method: 'POST',
            body: { option_index: parseInt(selected.value) }
        });
        showNotification('Voto registrado correctamente', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function showVotings(projectId) {
    try {
        const votings = await api(`/projects/${projectId}/votings`);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Gestionar Votaciones</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="closeModal(); showCreateVotingModal(${projectId});">+ Nueva Votación</button>
                    </div>
                    ${votings.length === 0 ? '<p>No hay votaciones creadas aún.</p>' : `
                        <div style="display: grid; gap: 1rem;">
                            ${votings.map(v => `
                                <div style="padding: 1rem; background: var(--gray-100); border-radius: 0.5rem;">
                                    <h4>${v.title}</h4>
                                    <p style="font-size: 0.875rem; color: var(--gray-600);">${v.description || ''}</p>
                                    <p style="font-size: 0.875rem; margin-top: 0.5rem;"><strong>Opciones:</strong> ${v.options.join(', ')}</p>
                                    <div style="margin-top: 0.5rem;">${getStatusBadge(v.status)}</div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
    }
}

function showCreateVotingModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Nueva Votación</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCreateVoting(event, ${projectId})">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" name="title" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea name="description" class="form-control"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Opciones (una por línea)</label>
                        <textarea name="options" class="form-control" required rows="4" placeholder="Opción A&#10;Opción B&#10;Opción C"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Crear Votación</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleCreateVoting(e, projectId) {
    e.preventDefault();
    const form = e.target;
    const options = form.options.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
        showNotification('Ingresá al menos 2 opciones', 'error');
        return;
    }
    try {
        await api(`/projects/${projectId}/votings`, {
            method: 'POST',
            body: {
                title: form.title.value,
                description: form.description.value,
                options: JSON.stringify(options)
            }
        });
        closeModal();
        showNotification('Votación creada correctamente', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function showAddContributionModal(projectId) {
    try {
        const members = await api(`/projects/${projectId}/members`);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Registrar Contribución</h3>
                    <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <form onsubmit="handleAddContribution(event, ${projectId})">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Rol / Miembro</label>
                            <select name="role_id" class="form-control" required>
                                ${members.map(m => `<option value="${m.role_id}">${m.role_title} - ${m.user_name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Descripción del trabajo</label>
                            <textarea name="description" class="form-control" required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Horas trabajadas</label>
                            <input type="number" name="hours" class="form-control" required step="0.5" min="0">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
    }
}

function showCompleteModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Comercializar Proyecto</h3>
                <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <form onsubmit="handleCompleteProject(event, ${projectId})">
                <div class="modal-body">
                    <div class="alert alert-info">
                        Marca el proyecto como terminado y comercializado para iniciar la distribución económica.
                    </div>
                    <div class="form-group">
                        <label>Ingresos totales generados ($)</label>
                        <input type="number" name="income" class="form-control" required step="0.01" min="0">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-warning">Comercializar Proyecto</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleAddContribution(e, projectId) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/contributions', {
            method: 'POST',
            body: {
                role_id: form.role_id.value,
                description: form.description.value,
                hours_worked: form.hours.value
            }
        });
        
        closeModal();
        showNotification('Contribución registrada', 'success');
        showContributions(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function handleCompleteProject(e, projectId) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api(`/projects/${projectId}/complete`, {
            method: 'POST',
            body: { total_income: form.income.value }
        });
        
        closeModal();
        showNotification('Proyecto comercializado', 'success');
        loadProjectDetail(projectId);
    } catch (error) {
        console.error(error);
    }
}

async function respondApplication(appId, accept) {
    try {
        await api(`/applications/${appId}/respond`, {
            method: 'POST',
            body: { accept }
        });
        showNotification(accept ? 'Postulación aceptada' : 'Postulación rechazada', 'success');
        closeModal();
    } catch (error) {
        console.error(error);
    }
}

async function validateContribution(contributionId, validated) {
    const compensation = validated ? prompt('Monto de compensación ($):', '0') : '0';
    if (compensation === null) return;
    
    try {
        await api(`/contributions/${contributionId}/validate`, {
            method: 'POST',
            body: { validated, compensation_amount: parseFloat(compensation) }
        });
        showNotification(validated ? 'Contribución validada' : 'Contribución rechazada', 'success');
        closeModal();
    } catch (error) {
        console.error(error);
    }
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
}

// ==========================================
// Admin Panel
// ==========================================

async function loadAdminProjects() {
    try {
        const projects = await api('/projects');
        const container = document.getElementById('admin-content');
        if (!container) return;
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Proyectos (${projects.length})</h3>
                <button class="btn btn-primary" onclick="showCreateProjectModal()">+ Nuevo Proyecto</button>
            </div>
            <div class="grid">
                ${projects.map(p => `
                    <div class="card">
                        <div class="project-type">${p.type}</div>
                        <h4>${p.title}</h4>
                        <p style="font-size: 0.875rem; color: var(--gray-600);">${p.description.substring(0, 100)}...</p>
                        <div style="margin-top: 0.5rem;">${getStatusBadge(p.status)}</div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                            <button class="btn btn-primary btn-sm" onclick="navigateTo('project', ${p.id})">Ver</button>
                            <button class="btn btn-secondary btn-sm" onclick="showApplications(${p.id})">Postulaciones</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error(error);
    }
}

function showAdminTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'projects') {
        loadAdminProjects();
    } else {
        document.getElementById('admin-content').innerHTML = `
            <div class="empty-state">
                <h3>Gestión de Usuarios</h3>
                <p>Funcionalidad en desarrollo</p>
            </div>
        `;
    }
}

// ==========================================
// Navegación
// ==========================================

async function navigateTo(view, param = null) {
    state.currentView = view;
    
    let content;
    switch (view) {
        case 'home':
            content = renderHome();
            break;
        case 'how-it-works':
            content = renderHowItWorks();
            break;
        case 'login':
            content = renderLogin();
            break;
        case 'register':
            content = renderRegister();
            break;
        case 'projects':
            content = renderProjects();
            break;
        case 'project':
            content = renderProjectDetail(param);
            break;
        case 'my-projects':
            content = renderMyProjects();
            break;
        case 'admin':
            content = renderAdmin();
            break;
        default:
            content = renderHome();
    }
    
    document.getElementById('app').innerHTML = content;
    
    // Cargar datos según la vista
    if (view === 'home') {
        loadPublicProjects();
    } else if (view === 'projects') {
        loadProjects();
    } else if (view === 'project' && param) {
        loadProjectDetail(param);
    } else if (view === 'my-projects') {
        loadMyProjects();
    } else if (view === 'admin') {
        loadAdminProjects();
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    showNotification('Sesión cerrada', 'info');
    navigateTo('home');
}

// ==========================================
// Inicialización
// ==========================================

async function init() {
    console.log('App init. Token presente:', !!state.token);
    
    if (state.token) {
        try {
            const user = await api('/me');
            if (user) {
                state.user = user;
                console.log('Usuario autenticado:', user.full_name);
            }
        } catch (error) {
            console.error('Error validando token:', error);
            logout();
        }
    } else {
        console.log('No hay token guardado');
    }
    
    // Router simple basado en hash
    const hash = window.location.hash.slice(1);
    if (hash) {
        const [view, id] = hash.split('/');
        navigateTo(view, id ? parseInt(id) : null);
    } else {
        navigateTo('home');
    }
    
    // Manejar cambios de hash
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        const [view, id] = hash.split('/');
        navigateTo(view, id ? parseInt(id) : null);
    });
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', init);
