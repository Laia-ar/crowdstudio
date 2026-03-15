#!/bin/bash
# Script de instalación del servicio CrowdStudio
# Ejecutar como root: sudo ./install-service.sh

set -e

APP_DIR="/opt/crowdstudio"
SERVICE_FILE="crowdstudio.service"
USER="crowdstudio"

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
    useradd -r -s /bin/false -d /opt/crowdstudio "$USER"
    echo "✅ Usuario $USER creado"
else
    echo "ℹ️  Usuario $USER ya existe"
fi

# Crear directorio de la aplicación
mkdir -p "$APP_DIR"

echo ""
echo "📦 Paso 2: Copiando archivos de la aplicación..."

# Copiar archivos (excluyendo .git, __pycache__, etc.)
rsync -av --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
      --exclude='crowdsourcing.db' --exclude='venv' \
      . "$APP_DIR/"

# Ajustar permisos
chown -R "$USER:$USER" "$APP_DIR"
chmod 755 "$APP_DIR"

echo ""
echo "🐍 Paso 3: Creando entorno virtual..."

# Crear venv como el usuario crowdstudio
sudo -u "$USER" python3 -m venv "$APP_DIR/venv"

# Instalar dependencias
sudo -u "$USER" "$APP_DIR/venv/bin/pip" install --upgrade pip
sudo -u "$USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

echo ""
echo "⚙️  Paso 4: Configurando servicio systemd..."

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
    echo "   sudo journalctl -u crowdstudio -n 50"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Instalación completada!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📊 Estado del servicio:"
echo "   sudo systemctl status crowdstudio"
echo ""
echo "📜 Ver logs:"
echo "   sudo journalctl -u crowdstudio -f"
echo ""
echo "🔄 Comandos útiles:"
echo "   sudo systemctl start crowdstudio    # Iniciar"
echo "   sudo systemctl stop crowdstudio     # Detener"
echo "   sudo systemctl restart crowdstudio  # Reiniciar"
echo ""
echo "🌐 La aplicación está disponible en:"
echo "   http://localhost:8000"
echo ""
echo "═══════════════════════════════════════════════════"
