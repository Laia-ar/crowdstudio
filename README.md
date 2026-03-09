# CrowdStudio - Plataforma de Crowdsourcing Audiovisual

Una plataforma tipo crowdsourcing para proyectos audiovisuales donde creadores, técnicos y mecenas colaboran en la producción de obras (películas, documentales, series, libros, canciones).

![Estado](https://img.shields.io/badge/estado-en%20desarrollo-yellow)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green)

## 🎬 Características

- **Visitantes**: Pueden ver información pública sobre la plataforma, proyectos activos y roles disponibles
- **Usuarios Registrados**: Se pueden postular a roles, hacer aportes económicos
- **Miembros**: Usuarios que han realizado aportes verificables (trabajo o económico)
- **Administradores**: Crean proyectos, evalúan postulaciones, validan trabajo

### Flujo del Proyecto

```
1. Estructuración → Proyecto con presupuesto, roles, objetivos
2. Postulación → Usuarios se postulan a roles → Productores evalúan
3. Ejecución → Miembros trabajan → Productores validan
4. Registro Audit → Quién hizo qué, en qué rol, cuánto tiempo
5. Comercialización → La obra genera ingresos
6. Distribución → 
   - Paso 1: Pagar a contribuyentes según validaciones
   - Paso 2: Mecenas votan sobre el uso del excedente
```

## 🚀 Instalación Rápida

```bash
# Clonar el repositorio
git clone https://github.com/Laia-ar/crowdstudio.git
cd crowdstudio

# Crear entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar
python main.py
```

La aplicación estará disponible en `http://localhost:8000`

## 👤 Cuenta Demo

| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@platform.com | admin123 | Administrador |

## 🛠️ Stack Tecnológico

- **Backend**: Python + FastAPI
- **Base de Datos**: SQLite (fácilmente cambiable a PostgreSQL)
- **Frontend**: HTML + CSS + JavaScript vanilla (SPA)
- **Autenticación**: JWT tokens

## 📁 Estructura del Proyecto

```
crowdstudio/
├── main.py              # Backend FastAPI con todos los endpoints
├── models.py            # Modelos SQLAlchemy
├── database.py          # Configuración de base de datos
├── requirements.txt     # Dependencias Python
├── .env.example         # Variables de entorno de ejemplo
├── .gitignore          # Archivos ignorados por git
├── README.md           # Este archivo
├── user stories.pdf    # Documento original de especificaciones
└── static/
    ├── index.html      # Template principal
    ├── app.js          # Lógica frontend SPA
    └── style.css       # Estilos
```

## 📡 API Endpoints

### Autenticación
- `POST /api/register` - Registro de usuarios
- `POST /api/token` - Login (OAuth2)
- `GET /api/me` - Perfil del usuario

### Proyectos
- `GET /api/projects/public` - Proyectos públicos (visitantes)
- `GET /api/projects` - Todos los proyectos (autenticado)
- `POST /api/projects` - Crear proyecto (admin)
- `POST /api/projects/{id}/roles` - Crear rol (admin)

### Postulaciones
- `POST /api/roles/{id}/apply` - Postularse a rol
- `GET /api/projects/{id}/applications` - Ver postulaciones
- `POST /api/applications/{id}/respond` - Aceptar/rechazar

### Contribuciones
- `POST /api/contributions` - Registrar trabajo
- `GET /api/projects/{id}/contributions` - Ver contribuciones
- `POST /api/contributions/{id}/validate` - Validar trabajo
- `POST /api/roles/{id}/replace` - Reemplazar miembro

### Economía
- `POST /api/projects/{id}/donate` - Aporte económico
- `POST /api/projects/{id}/complete` - Comercializar
- `GET /api/projects/{id}/distribution` - Distribución económica
- `POST /api/projects/{id}/votings` - Crear votación
- `POST /api/votings/{id}/vote` - Votar

## 🏗️ Despliegue

### Docker (opcional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

### Requisitos mínimos (Proxmox/VPS)

- **vCPU**: 1 núcleo
- **RAM**: 512 MB - 1 GB
- **Disco**: 10 GB
- **OS**: Ubuntu 22.04 / Debian 12

### Systemd Service

```bash
sudo nano /etc/systemd/system/crowdstudio.service
```

```ini
[Unit]
Description=CrowdStudio API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/crowdstudio
ExecStart=/opt/crowdstudio/venv/bin/python /opt/crowdstudio/main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable crowdstudio
sudo systemctl start crowdstudio
```

## ⚠️ Notas Importantes

- **Pagos**: El sistema de pagos es **simulado** (mock). No integra pasarelas reales (Stripe/MercadoPago).
- **Roles**: Solo los administradores pueden crear proyectos.
- **Archivos**: No incluye upload de archivos actualmente.
- **Notificaciones**: No hay sistema de email (notificaciones UI solamente).

## 📜 User Stories Implementadas

- ✅ **US1-4**: Visitantes (info pública, registro)
- ✅ **US5-6**: Usuarios registrados (ver roles, postularse)
- ✅ **US7-9**: Responsables (evaluar, validar, reemplazar)
- ✅ **US10**: Aportes económicos
- ✅ **US11**: Compensación por trabajo validado
- ✅ **US12**: Votaciones sobre excedentes

## 🤝 Contribuir

1. Fork del repositorio
2. Crear rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT.

---

Desarrollado para Laia-ar 🎬
