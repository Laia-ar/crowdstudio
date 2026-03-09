#!/bin/bash
# Script para hacer push del repositorio a GitHub
# Uso: ./push-to-github.sh

set -e

echo "🚀 Preparando push a GitHub..."

# Verificar que git está instalado
if ! command -v git &> /dev/null; then
    echo "❌ Git no está instalado. Instálalo primero."
    exit 1
fi

# Verificar que el repo existe
if [ ! -d ".git" ]; then
    echo "❌ No se encontró repositorio git."
    exit 1
fi

echo ""
echo "📋 Configuración del repositorio:"
echo "Organización: Laia-ar"
echo "Repositorio: crowdstudio"
echo "Visibilidad: Público"
echo ""

# Verificar remote
if git remote | grep -q "origin"; then
    echo "⚠️  Ya existe un remote 'origin'."
    read -p "¿Quieres eliminarlo y configurar el nuevo? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote remove origin
    else
        echo "❌ Cancelado."
        exit 1
    fi
fi

# Agregar remote
echo "🔗 Configurando remote..."
git remote add origin https://github.com/Laia-ar/crowdstudio.git

# Verificar conexión
echo ""
echo "🔍 Verificando configuración:"
git remote -v

echo ""
echo "📤 Haciendo push..."
echo ""

# Push
git push -u origin main

echo ""
echo "✅ ¡Listo! El repositorio ha sido publicado en:"
echo "   https://github.com/Laia-ar/crowdstudio"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Ve a https://github.com/Laia-ar/crowdstudio para verificar"
echo "   2. Configura la descripción del repositorio en GitHub"
echo "   3. Activa GitHub Pages si quieres demo estático (opcional)"
