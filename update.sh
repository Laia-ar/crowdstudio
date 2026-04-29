#!/bin/bash
# Script de actualización de CrowdStudio
# Actualiza el código y reinicia el servicio sin tocar la base de datos

set -e

APP_DIR="/opt/crowdstudio"
SERVICE_NAME="crowdstudio"

echo "🔄 Actualizando CrowdStudio..."

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ejecutar como root: sudo ./update.sh"
    exit 1
fi

# Verificar que estamos en el repo git
if [ ! -d ".git" ]; then
    echo "❌ No es un repositorio git. Cloná primero:"
    echo "   git clone https://github.com/Laia-ar/crowdstudio.git"
    exit 1
fi

# Backup de la base de datos
if [ -f "$APP_DIR/crowdsourcing.db" ]; then
    echo "💾 Haciendo backup de la base de datos..."
    cp "$APP_DIR/crowdsourcing.db" "$APP_DIR/crowdsourcing.db.backup.$(date +%Y%m%d_%H%M%S)"
fi

echo ""
echo "📥 Descargando cambios..."

git fetch origin
git reset --hard origin/main

echo ""
echo "📦 Actualizando dependencias..."

# Actualizar pip y dependencias (sin recrear el venv)
if [ -d "$APP_DIR/venv" ]; then
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r requirements.txt
else
    echo "⚠️  No se encontró venv. Creando uno nuevo..."
    python3 -m venv "$APP_DIR/venv"
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r requirements.txt
fi

echo ""
echo "🔧 Ajustando permisos..."

chown -R crowdstudio:crowdstudio "$APP_DIR" 2>/dev/null || chown -R root:root "$APP_DIR"
chmod 664 "$APP_DIR/crowdsourcing.db" 2>/dev/null || true

echo ""
echo "🚀 Reiniciando servicio..."

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl daemon-reload
    systemctl restart "$SERVICE_NAME"
    
    sleep 2
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo ""
        echo "✅ ¡Actualización completada!"
        systemctl status "$SERVICE_NAME" --no-pager
    else
        echo ""
        echo "❌ El servicio no inició. Ver logs:"
        echo "   journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
else
    echo "⚠️  El servicio systemd no está activo."
    echo "   Para iniciar manualmente:"
    echo "   cd $APP_DIR && ./venv/bin/python main.py"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ CrowdStudio actualizado"
echo "═══════════════════════════════════════════════════"
