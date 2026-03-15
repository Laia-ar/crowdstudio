# 🚀 Guía de Despliegue - CrowdStudio

## Despliegue Automático (Recomendado)

### 1. En tu servidor Proxmox/VPS

```bash
# Clonar el repositorio
git clone https://github.com/Laia-ar/crowdstudio.git /opt/crowdstudio
cd /opt/crowdstudio

# Ejecutar instalador (como root)
sudo ./install-service.sh
```

Esto hace todo automáticamente:
- ✅ Crea usuario dedicado (`crowdstudio`)
- ✅ Crea entorno virtual Python
- ✅ Instala dependencias
- ✅ Configura systemd
- ✅ Inicia el servicio
- ✅ Habilita autoinicio

### 2. Verificar instalación

```bash
# Ver estado del servicio
sudo systemctl status crowdstudio

# Ver logs en tiempo real
sudo journalctl -u crowdstudio -f

# Ver últimos 100 logs
sudo journalctl -u crowdstudio -n 100
```

### 3. Configurar Nginx (Reverse Proxy) - Opcional pero recomendado

```bash
sudo apt install nginx
```

Crear archivo `/etc/nginx/sites-available/crowdstudio`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # O IP del servidor

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar:
```bash
sudo ln -s /etc/nginx/sites-available/crowdstudio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Despliegue Manual

Si prefieres hacerlo paso a paso:

### 1. Crear usuario dedicado

```bash
sudo useradd -r -s /bin/false -d /opt/crowdstudio crowdstudio
```

### 2. Copiar aplicación

```bash
sudo mkdir -p /opt/crowdstudio
sudo cp -r /ruta/del/repo/* /opt/crowdstudio/
sudo chown -R crowdstudio:crowdstudio /opt/crowdstudio
```

### 3. Crear entorno virtual

```bash
cd /opt/crowdstudio
sudo -u crowdstudio python3 -m venv venv
sudo -u crowdstudio ./venv/bin/pip install -r requirements.txt
```

### 4. Instalar servicio systemd

```bash
sudo cp crowdstudio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable crowdstudio
sudo systemctl start crowdstudio
```

## Actualización

Para actualizar la aplicación después de un `git pull`:

```bash
cd /opt/crowdstudio

# Detener servicio
sudo systemctl stop crowdstudio

# Actualizar código (si clonaste con git)
sudo -u crowdstudio git pull

# Actualizar dependencias (si cambiaron)
sudo -u crowdstudio ./venv/bin/pip install -r requirements.txt

# Reiniciar servicio
sudo systemctl start crowdstudio

# Verificar
sudo systemctl status crowdstudio
```

## Comandos Útiles

```bash
# Iniciar servicio
sudo systemctl start crowdstudio

# Detener servicio
sudo systemctl stop crowdstudio

# Reiniciar servicio
sudo systemctl restart crowdstudio

# Ver logs
sudo journalctl -u crowdstudio -f

# Deshabilitar autoinicio
sudo systemctl disable crowdstudio

# Habilitar autoinicio
sudo systemctl enable crowdstudio
```

## Configuración del Servicio

El archivo `crowdstudio.service` tiene estas configuraciones:

| Opción | Valor | Descripción |
|--------|-------|-------------|
| `Restart=always` | Siempre | Reinicia automáticamente si falla |
| `RestartSec=5` | 5 segundos | Espera antes de reiniciar |
| `MemoryMax=512M` | 512 MB | Límite de RAM |
| `CPUQuota=50%` | 50% | Límite de CPU |
| `User=crowdstudio` | crowdstudio | Usuario no-root para seguridad |

Para modificar:
```bash
sudo nano /etc/systemd/system/crowdstudio.service
sudo systemctl daemon-reload
sudo systemctl restart crowdstudio
```

## Firewall (UFW)

```bash
# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS (si usas SSL)
sudo ufw allow 443/tcp

# Si no usas Nginx, permitir directo al 8000
sudo ufw allow 8000/tcp

# Activar firewall
sudo ufw enable
```

## SSL con Certbot (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## Troubleshooting

### El servicio no inicia

```bash
# Ver error específico
sudo journalctl -u crowdstudio -n 50 --no-pager

# Verificar permisos
ls -la /opt/crowdstudio

# Probar manualmente
sudo -u crowdstudio /opt/crowdstudio/venv/bin/python /opt/crowdstudio/main.py
```

### Puerto 8000 ocupado

```bash
# Encontrar proceso
sudo lsof -i :8000

# Matar proceso
sudo kill -9 <PID>
```

### Permisos denegados

```bash
# Arreglar permisos
sudo chown -R crowdstudio:crowdstudio /opt/crowdstudio
sudo chmod -R 755 /opt/crowdstudio
```
