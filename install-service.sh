#!/bin/bash
# Script de instalación del servicio CrowdStudio
# Ejecutar como root: sudo ./install-service.sh

set -e

APP_DIR="/opt/crowdstudio"
SERVICE_FILE="crowdstudio.service"
USER="crowdstudio"

# Detectar si estamos en un container (sin systemd) o VM completa
IN_CONTAINER=false
if [ ! -d "/run/systemd/system" ] && [ ! -d "/sys/fs/cgroup/systemd" ]; then
    IN_CONTAINER=true
fi

echo "🚀 Instalando servicio CrowdStudio..."

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Por favor ejecuta como root: sudo ./install-service.sh"
    exit 1
fi

# Verificar que el directorio actual contiene la app
if [ ! -f "main.py" ]; then
    echo "❌ No se encontró main.py. Ejecuta esto desde el directorio de la aplicación."
    exit 1
fi

echo ""
echo "📁 Paso 1: Creando usuario y directorios..."

# Crear usuario dedicado (sin shell, sin home)
if ! id "$USER" &>/dev/null; then
    useradd -r -s /bin/false -d /opt/crowdstudio "$USER" 2>/dev/null || \
    adduser -S -D -H -h /opt/crowdstudio "$USER" 2>/dev/null || \
    { echo "⚠️  No se pudo crear usuario automáticamente, continuando con root..."; USER="root"; }
    echo "✅ Usuario $USER creado"
else
    echo "ℹ️  Usuario $USER ya existe"
fi

# Crear directorio de la aplicación
mkdir -p "$APP_DIR"

echo ""
echo "📦 Paso 2: Copiando archivos de la aplicación..."

# Copiar archivos (excluyendo .git, __pycache__, etc.)
if command -v rsync &> /dev/null; then
    rsync -av --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
          --exclude='crowdsourcing.db' --exclude='venv' \
          . "$APP_DIR/"
else
    cp -r . "$APP_DIR/"
    rm -rf "$APP_DIR/.git" "$APP_DIR/__pycache__" "$APP_DIR/venv" 2>/dev/null || true
fi

# Ajustar permisos
chown -R "$USER:$USER" "$APP_DIR" 2>/dev/null || chown -R root:root "$APP_DIR"
chmod 755 "$APP_DIR"

echo ""
echo "🐍 Paso 3: Creando entorno virtual..."

# Verificar que python3 existe
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado. Instálalo primero:"
    echo "   apt update && apt install -y python3 python3-venv python3-pip"
    exit 1
fi

# Crear venv (como el usuario crowdstudio si es posible, sino como root)
if [ "$USER" = "root" ]; then
    python3 -m venv "$APP_DIR/venv"
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
else
    # Ejecutar como el usuario crowdstudio sin sudo (ya somos root)
    su -s /bin/bash "$USER" -c "python3 -m venv $APP_DIR/venv"
    su -s /bin/bash "$USER" -c "$APP_DIR/venv/bin/pip install --upgrade pip"
    su -s /bin/bash "$USER" -c "$APP_DIR/venv/bin/pip install -r $APP_DIR/requirements.txt"
fi

echo ""
echo "⚙️  Paso 4: Configurando servicio systemd..."

if [ "$IN_CONTAINER" = true ]; then
    echo "⚠️  Detectado contenedor sin systemd."
    echo "   El servicio systemd no estará disponible."
    echo "   Para iniciar manualmente:"
    echo "   $APP_DIR/venv/bin/python $APP_DIR/main.py"
    echo ""
    echo "   O usa el script de inicio manual:"
    cat > "$APP_DIR/start.sh" << 'EOFSCRIPT'
#!/bin/bash
cd /opt/crowdstudio
./venv/bin/python main.py
EOFSCRIPT
    chmod +x "$APP_DIR/start.sh"
    echo "   $APP_DIR/start.sh"
else
    # Copiar archivo de servicio
    cp "$SERVICE_FILE" /etc/systemd/system/
    
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
    echo "   O con: cd $APP_DIR && ./venv/bin/python main.py"
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
