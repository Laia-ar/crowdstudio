#!/usr/bin/env python3
"""
Script de migración para SQLite.
Agrega columnas y tablas nuevas sin perder datos.
"""
import sqlite3
import os
import sys

def migrate(db_path):
    print(f"Migrando: {db_path}")
    
    if not os.path.exists(db_path):
        print("Base de datos no encontrada. Se creará automáticamente al iniciar la app.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener columnas existentes de roles
    cursor.execute("PRAGMA table_info(roles)")
    role_columns = {col[1] for col in cursor.fetchall()}
    
    # Agregar requires_experience si no existe
    if 'requires_experience' not in role_columns:
        print("  + Agregando columna roles.requires_experience")
        cursor.execute("ALTER TABLE roles ADD COLUMN requires_experience BOOLEAN DEFAULT 0")
    else:
        print("  ✓ Columna roles.requires_experience ya existe")
    
    # Obtener columnas existentes de applications
    cursor.execute("PRAGMA table_info(applications)")
    app_columns = {col[1] for col in cursor.fetchall()}
    
    # Agregar experience_references si no existe
    if 'experience_references' not in app_columns:
        print("  + Agregando columna applications.experience_references")
        cursor.execute("ALTER TABLE applications ADD COLUMN experience_references TEXT")
    else:
        print("  ✓ Columna applications.experience_references ya existe")
    
    # Crear tablas nuevas si no existen
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {t[0] for t in cursor.fetchall()}
    
    if 'resource_needs' not in existing_tables:
        print("  + Creando tabla resource_needs")
        cursor.execute('''
            CREATE TABLE resource_needs (
                id INTEGER PRIMARY KEY,
                project_id INTEGER,
                category VARCHAR,
                title VARCHAR,
                description TEXT,
                is_filled BOOLEAN DEFAULT 0,
                provider_user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        print("  ✓ Tabla resource_needs ya existe")
    
    if 'resource_offers' not in existing_tables:
        print("  + Creando tabla resource_offers")
        cursor.execute('''
            CREATE TABLE resource_offers (
                id INTEGER PRIMARY KEY,
                resource_need_id INTEGER,
                user_id INTEGER,
                message TEXT,
                status VARCHAR DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        print("  ✓ Tabla resource_offers ya existe")
    
    if 'project_events' not in existing_tables:
        print("  + Creando tabla project_events")
        cursor.execute('''
            CREATE TABLE project_events (
                id INTEGER PRIMARY KEY,
                project_id INTEGER,
                title VARCHAR,
                description TEXT,
                event_date DATETIME,
                related_role_title VARCHAR,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        print("  ✓ Tabla project_events ya existe")
    
    conn.commit()
    conn.close()
    print("✅ Migración completada")

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "crowdsourcing.db"
    migrate(db_path)
