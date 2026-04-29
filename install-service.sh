#!/bin/bash
# Script de instalación del servicio CrowdStudio
# Ejecutar como root desde el directorio del repositorio
#
# Estructura soportada:
#   - Repo git en /root/crowdstudio (o donde clonaste)
#   - App instalada en /opt/crowdstudio (donde corre el servicio)

set -e

APP_DIR="/opt/crowdstudio"
SERVICE_FILE="crowdstudio.service"
USER="crowdstudio"
SOURCE_DIR="$(pwd)"

# Detectar si estamos en un container (sin systemd) o VM completa
IN_CONTAINER=false
if [ ! -d "/run/systemd/system" ] && [ ! -d "/sys/fs/cgroup/systemd" ]; then
    IN_CONTAINER=true
fi

echo "🚀 Instalando servicio CrowdStudio..."
echo "   Source: $SOURCE_DIR"
echo "   Target: $APP_DIR"

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Por favor ejecuta como root: sudo ./install-service.sh"
    exit 1
fi

# Verificar que el directorio actual contiene la app
if [ ! -f "$SOURCE_DIR/main.py" ]; then
    echo "❌ No se encontró main.py en $SOURCE_DIR"
    echo "   Ejecuta esto desde el directorio del repositorio."
    exit 1
fi

# Evitar instalar sobre sí mismo si SOURCE_DIR == APP_DIR
if [ "$SOURCE_DIR" = "$APP_DIR" ]; then
    echo "❌ El directorio fuente no puede ser igual al directorio destino."
    echo "   Cloná el repo en otro lugar (ej: /root/crowdstudio) y ejecutalo desde ahí."
    exit 1
fi

echo ""
echo "📁 Paso 1: Creando usuario y directorios..."

# Crear usuario dedicado (sin shell, sin home)
if ! id "$USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$APP_DIR" "$USER" 2>/dev/null || \
    adduser -S -D -H -h "$APP_DIR" "$USER" 2>/dev/null || \
    { echo "⚠️  No se pudo crear usuario automáticamente, continuando con root..."; USER="root"; }
    echo "✅ Usuario $USER creado"
else
    echo "ℹ️  Usuario $USER ya existe"
fi

# Crear directorio de la aplicación
mkdir -p "$APP_DIR"

echo ""
echo "📦 Paso 2: Copiando archivos de la aplicación..."

# Copiar archivos (excluyendo .git, __pycache__, db, venv)
if command -v rsync &> /dev/null; then
    rsync -av --delete \
          --exclude='.git' \
          --exclude='__pycache__' \
          --exclude='*.pyc' \
          --exclude='crowdsourcing.db' \
          --exclude='venv' \
          "$SOURCE_DIR/" "$APP_DIR/"
else
    # Limpiar destino antes de copiar (menos db y venv)
    find "$APP_DIR" -mindepth 1 -not -name 'crowdsourcing.db' -not -name 'venv' -exec rm -rf {} + 2>/dev/null || true
    cp -r "$SOURCE_DIR/"* "$APP_DIR/" 2>/dev/null || true
    rm -rf "$APP_DIR/.git" "$APP_DIR/__pycache__" 2>/dev/null || true
fi

# Ajustar permisos
chown -R "$USER:$USER" "$APP_DIR" 2>/dev/null || chown -R root:root "$APP_DIR"
chmod 755 "$APP_DIR"
# Asegurar que la base de datos sea escribible
chmod 664 "$APP_DIR/crowdsourcing.db" 2>/dev/null || true

echo ""
echo "🐍 Paso 3: Creando entorno virtual..."

# Verificar que python3 existe
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado. Instálalo primero:"
    echo "   apt update && apt install -y python3 python3-venv python3-pip"
    exit 1
fi

# Crear o actualizar venv
if [ ! -d "$APP_DIR/venv" ]; then
    echo "   Creando nuevo entorno virtual..."
    if [ "$USER" = "root" ]; then
        python3 -m venv "$APP_DIR/venv"
    else
        su -s /bin/bash "$USER" -c "python3 -m venv $APP_DIR/venv"
    fi
else
    echo "   Entorno virtual existente encontrado, actualizando..."
fi

# Instalar/actualizar dependencias
if [ "$USER" = "root" ]; then
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
else
    su -s /bin/bash "$USER" -c "$APP_DIR/venv/bin/pip install --upgrade pip"
    su -s /bin/bash "$USER" -c "$APP_DIR/venv/bin/pip install -r $APP_DIR/requirements.txt"
fi

echo ""
echo "⚙️  Paso 4: Configurando servicio systemd..."

if [ "$IN_CONTAINER" = true ]; then
    echo "⚠️  Detectado contenedor sin systemd."
    echo "   El servicio systemd no estará disponible."
    cat > "$APP_DIR/start.sh" << EOFSCRIPT
#!/bin/bash
cd $APP_DIR
./venv/bin/python main.py
EOFSCRIPT
    chmod +x "$APP_DIR/start.sh"
    echo "   Para iniciar manualmente: $APP_DIR/start.sh"
else
    # Copiar archivo de servicio
    cp "$SOURCE_DIR/$SERVICE_FILE" /etc/systemd/system/

    # Recargar systemd
    systemctl daemon-reload

    # Habilitar inicio automático
    systemctl enable crowdstudio.service

    echo ""
    echo "🚀 Paso 5: Iniciando servicio..."

    # Iniciar servicio
    systemctl start crowdstudio.service

    # Esperar un momento
    sleep 2

    # Verificar estado
    if systemctl is-active --quiet crowdstudio; then
        echo ""
        echo "✅ ¡Servicio iniciado exitosamente!"
    else
        echo ""
        echo "❌ El servicio no pudo iniciar. Ver logs:"
        echo "   journalctl -u crowdstudio -n 50"
        exit 1
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Instalación completada!"
echo "═══════════════════════════════════════════════════"
echo ""

if [ "$IN_CONTAINER" = true ]; then
    echo "🐳 Modo contenedor detectado:"
    echo "   Iniciar manualmente: $APP_DIR/start.sh"
else
    echo "📊 Estado del servicio:"
    echo "   systemctl status crowdstudio"
    echo ""
    echo "📜 Ver logs:"
    echo "   journalctl -u crowdstudio -f"
    echo ""
    echo "🔄 Comandos útiles:"
    echo "   systemctl start crowdstudio    # Iniciar"
    echo "   systemctl stop crowdstudio     # Detener"
    echo "   systemctl restart crowdstudio  # Reiniciar"
fi

echo ""
echo "🌐 La aplicación estará disponible en:"
echo "   http://localhost:8000"
echo ""
echo "═══════════════════════════════════════════════════"
