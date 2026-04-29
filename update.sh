#!/bin/bash
# Script de actualización de CrowdStudio
# Actualiza el código desde el repo git y reinicia el servicio
#
# Uso:
#   cd /root/crowdstudio && sudo ./update.sh
#
# Estructura soportada:
#   - Repo git en /root/crowdstudio (o donde clonaste)
#   - App instalada en /opt/crowdstudio (donde corre el servicio)

set -e

APP_DIR="/opt/crowdstudio"
SERVICE_NAME="crowdstudio"
SOURCE_DIR="$(pwd)"

echo "🔄 Actualizando CrowdStudio..."
echo "   Source repo: $SOURCE_DIR"
echo "   Target app:  $APP_DIR"

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ejecutar como root: sudo ./update.sh"
    exit 1
fi

# Verificar que estamos en el repo git
if [ ! -d "$SOURCE_DIR/.git" ]; then
    echo "❌ No se encontró .git en $SOURCE_DIR"
    echo "   Ejecuta esto desde el directorio del repositorio (ej: /root/crowdstudio)"
    exit 1
fi

# Verificar que el target existe
if [ ! -d "$APP_DIR" ]; then
    echo "❌ No se encontró $APP_DIR"
    echo "   Ejecutá install-service.sh primero."
    exit 1
fi

# Evitar source == target
if [ "$SOURCE_DIR" = "$APP_DIR" ]; then
    echo "❌ El directorio fuente no puede ser igual al directorio destino."
    echo "   Ejecuta esto desde el repo (ej: /root/crowdstudio), no desde /opt/crowdstudio"
    exit 1
fi

# Backup de la base de datos
if [ -f "$APP_DIR/crowdsourcing.db" ]; then
    BACKUP_FILE="$APP_DIR/crowdsourcing.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backup de la base de datos: $BACKUP_FILE"
    cp "$APP_DIR/crowdsourcing.db" "$BACKUP_FILE"
fi

echo ""
echo "📥 Descargando cambios desde GitHub..."

cd "$SOURCE_DIR"
git fetch origin
git reset --hard origin/main

echo ""
echo "📦 Copiando archivos a $APP_DIR..."

# Copiar archivos nuevos (excluyendo .git, db, venv)
if command -v rsync &> /dev/null; then
    rsync -av --delete \
          --exclude='.git' \
          --exclude='__pycache__' \
          --exclude='*.pyc' \
          --exclude='crowdsourcing.db' \
          --exclude='venv' \
          "$SOURCE_DIR/" "$APP_DIR/"
else
    # Limpiar destino (menos db y venv)
    find "$APP_DIR" -mindepth 1 -not -name 'crowdsourcing.db' -not -name 'venv' -exec rm -rf {} + 2>/dev/null || true
    cp -r "$SOURCE_DIR/"* "$APP_DIR/" 2>/dev/null || true
    rm -rf "$APP_DIR/.git" "$APP_DIR/__pycache__" 2>/dev/null || true
fi

echo ""
echo "📦 Actualizando dependencias..."

# Actualizar pip y dependencias (sin recrear el venv)
if [ -d "$APP_DIR/venv" ]; then
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
else
    echo "⚠️  No se encontró venv. Creando uno nuevo..."
    python3 -m venv "$APP_DIR/venv"
    "$APP_DIR/venv/bin/pip" install --upgrade pip
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
fi

echo ""
echo "🔧 Ajustando permisos..."

chown -R crowdstudio:crowdstudio "$APP_DIR" 2>/dev/null || chown -R root:root "$APP_DIR"
chmod 755 "$APP_DIR"
chmod 664 "$APP_DIR/crowdsourcing.db" 2>/dev/null || true

echo ""
echo "🚀 Reiniciando servicio..."

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    # Copiar service file actualizado
    if [ -f "$SOURCE_DIR/crowdstudio.service" ]; then
        cp "$SOURCE_DIR/crowdstudio.service" /etc/systemd/system/
    fi
    
    systemctl daemon-reload
    systemctl restart "$SERVICE_NAME"

    sleep 2

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo ""
        echo "✅ ¡Actualización completada!"
        echo ""
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
