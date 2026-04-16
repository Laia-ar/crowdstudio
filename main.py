from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager
import json
import os
import bcrypt
from collections import defaultdict

from database import engine, get_db
from models import Base, User, Project, Role, Application, Contribution, Donation, Voting, Vote
from models import ResourceNeed, ResourceOffer, ProjectEvent
from models import UserRole, ProjectStatus, ApplicationStatus, ContributionStatus, ResourceCategory, ResourceOfferStatus

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)
    get_or_create_admin(db)
    db.close()
    yield
    # Shutdown (limpieza si es necesaria)

app = FastAPI(title="Crowdsourcing Audiovisual", lifespan=lifespan)

# Rate limiting básico en memoria para auth endpoints
_rate_limit_store = defaultdict(list)
RATE_LIMIT_MAX = 10  # requests
RATE_LIMIT_WINDOW = 60  # segundos

def _check_rate_limit(client_ip: str) -> bool:
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)
    _rate_limit_store[client_ip] = [t for t in _rate_limit_store[client_ip] if t > window_start]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limit_store[client_ip].append(now)
    return True

# Configuración de seguridad
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 día

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# CORS - configurable por entorno
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
allow_origins = [o.strip() for o in _cors_origins.split(",")] if _cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")

# ============ UTILIDADES ============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    # bcrypt trunca a 72 bytes, así que truncamos si es necesario
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Log para debugging
    auth_header = request.headers.get('authorization')
    print(f"Auth header: {auth_header}")
    print(f"Token from oauth2_scheme: {token}")
    
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_or_create_admin(db: Session):
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if not admin:
        admin = User(
            email="admin@platform.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Administrador",
            role=UserRole.ADMIN
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin

def is_community_member(db: Session, user_id: int, project_id: int = None) -> bool:
    """Devuelve True si el usuario es miembro de la comunidad.
    Si project_id se proporciona, verifica membresía en ese proyecto específico.
    Membresía = rol aceptado en cualquier proyecto, o donación, o recurso aceptado.
    """
    # Admin siempre es miembro
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.role == UserRole.ADMIN:
        return True
    
    if project_id:
        # Verificar rol aceptado en este proyecto
        has_accepted_role = db.query(Role).filter(
            Role.project_id == project_id,
            Role.assigned_user_id == user_id
        ).first() is not None
        
        has_donation = db.query(Donation).filter(
            Donation.project_id == project_id,
            Donation.user_id == user_id
        ).first() is not None
        
        has_resource = db.query(ResourceNeed).filter(
            ResourceNeed.project_id == project_id,
            ResourceNeed.provider_user_id == user_id
        ).first() is not None
        
        return has_accepted_role or has_donation or has_resource
    else:
        # Verificar en cualquier proyecto
        has_accepted_role = db.query(Application).filter(
            Application.user_id == user_id,
            Application.status == ApplicationStatus.ACCEPTED
        ).first() is not None
        
        has_donation = db.query(Donation).filter(
            Donation.user_id == user_id
        ).first() is not None
        
        has_resource = db.query(ResourceNeed).filter(
            ResourceNeed.provider_user_id == user_id
        ).first() is not None
        
        return has_accepted_role or has_donation or has_resource


# ============ RUTAS DE AUTENTICACIÓN ============

@app.post("/api/register")
def register(request: Request, email: str = Form(...), password: str = Form(...), full_name: str = Form(...), db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=UserRole.USER
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created successfully", "user_id": user.id}

@app.post("/api/token")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value
        }
    }

@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "bio": current_user.bio,
        "is_community_member": is_community_member(db, current_user.id)
    }

# ============ RUTAS PÚBLICAS (VISITANTE) ============

@app.get("/api/projects/public")
def get_public_projects(db: Session = Depends(get_db)):
    """Proyectos visibles para visitantes (abiertos o en progreso)"""
    projects = db.query(Project).filter(
        Project.status.in_([ProjectStatus.OPEN, ProjectStatus.IN_PROGRESS])
    ).options(joinedload(Project.roles)).all()
    
    result = []
    for p in projects:
        roles_info = []
        for r in p.roles:
            roles_info.append({
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "is_filled": r.is_filled
            })
        result.append({
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "type": p.type,
            "status": p.status.value,
            "roles": roles_info
        })
    return result

@app.get("/api/projects/{project_id}/public")
def get_public_project(project_id: int, db: Session = Depends(get_db)):
    """Detalle público de un proyecto"""
    p = db.query(Project).filter(Project.id == project_id).options(
        joinedload(Project.roles),
        joinedload(Project.producer)
    ).first()
    
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    roles_info = []
    for r in p.roles:
        roles_info.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "tasks": r.tasks,
            "reference_fee": r.reference_fee,
            "is_filled": r.is_filled,
            "requires_experience": r.requires_experience
        })
    
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "type": p.type,
        "status": p.status.value,
        "objectives": p.objectives,
        "roles": roles_info,
        "producer": p.producer.full_name if p.producer else None
    }

# ============ RUTAS DE PROYECTOS (USUARIOS REGISTRADOS) ============

@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Todos los proyectos para usuarios registrados"""
    projects = db.query(Project).options(joinedload(Project.roles)).all()
    
    result = []
    for p in projects:
        roles_info = []
        for r in p.roles:
            # Verificar si el usuario ya se postuló a este rol
            has_applied = db.query(Application).filter(
                Application.role_id == r.id,
                Application.user_id == current_user.id
            ).first() is not None
            
            roles_info.append({
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "is_filled": r.is_filled,
                "has_applied": has_applied
            })
        
        is_member = is_community_member(db, current_user.id, p.id)
        
        result.append({
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "type": p.type,
            "status": p.status.value,
            "roles": roles_info,
            "is_member": is_member
        })
    return result

@app.post("/api/projects")
def create_project(
    title: str = Form(...),
    description: str = Form(...),
    type: str = Form(...),
    objectives: str = Form(...),
    budget_theoretical: float = Form(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Solo administradores pueden crear proyectos"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create projects")
    
    project = Project(
        title=title,
        description=description,
        type=type,
        objectives=objectives,
        budget_theoretical=budget_theoretical,
        producer_id=current_user.id,
        status=ProjectStatus.OPEN
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"message": "Project created", "project_id": project.id}

@app.post("/api/projects/{project_id}/roles")
def create_role(
    project_id: int,
    title: str = Form(...),
    description: str = Form(...),
    tasks: str = Form(...),
    deliverables: str = Form(""),
    reference_fee: float = Form(0),
    requires_experience: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear un rol dentro de un proyecto (solo admin/productor)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    role = Role(
        project_id=project_id,
        title=title,
        description=description,
        tasks=tasks,
        deliverables=deliverables,
        reference_fee=reference_fee,
        is_filled=False,
        requires_experience=requires_experience
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return {"message": "Role created", "role_id": role.id}

# ============ POSTULACIONES ============

@app.post("/api/roles/{role_id}/apply")
def apply_to_role(
    role_id: int,
    message: str = Form(...),
    experience_references: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Postularse a un rol"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_filled:
        raise HTTPException(status_code=400, detail="Role is already filled")
    
    # Verificar si ya se postuló
    existing = db.query(Application).filter(
        Application.role_id == role_id,
        Application.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this role")
    
    if role.requires_experience and not experience_references.strip():
        raise HTTPException(status_code=400, detail="Experience references are required for this role")
    
    application = Application(
        role_id=role_id,
        user_id=current_user.id,
        message=message,
        experience_references=experience_references or None,
        status=ApplicationStatus.PENDING
    )
    db.add(application)
    db.commit()
    
    return {"message": "Application submitted successfully"}

@app.get("/api/projects/{project_id}/applications")
def get_project_applications(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ver postulaciones de un proyecto (solo productor/admin)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    applications = db.query(Application).join(Role).filter(
        Role.project_id == project_id
    ).options(joinedload(Application.user), joinedload(Application.role)).all()
    
    result = []
    for app in applications:
        result.append({
            "id": app.id,
            "role_title": app.role.title,
            "user_name": app.user.full_name,
            "user_email": app.user.email,
            "user_bio": app.user.bio,
            "message": app.message,
            "experience_references": app.experience_references,
            "status": app.status.value,
            "created_at": app.created_at.isoformat()
        })
    return result

@app.post("/api/applications/{application_id}/respond")
def respond_to_application(
    application_id: int,
    accept: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aceptar o rechazar una postulación"""
    application = db.query(Application).filter(Application.id == application_id).options(
        joinedload(Application.role).joinedload(Role.project)
    ).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    project = application.role.project
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if accept:
        application.status = ApplicationStatus.ACCEPTED
        application.role.is_filled = True
        application.role.assigned_user_id = application.user_id
        
        # Convertir usuario en miembro
        user = db.query(User).filter(User.id == application.user_id).first()
        if user.role == UserRole.USER:
            user.role = UserRole.MEMBER
    else:
        application.status = ApplicationStatus.REJECTED
    
    db.commit()
    return {"message": "Application " + ("accepted" if accept else "rejected")}

# ============ CONTRIBUCIONES Y VALIDACIÓN ============

@app.get("/api/projects/{project_id}/members")
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener miembros con roles asignados de un proyecto"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    roles = db.query(Role).filter(
        Role.project_id == project_id,
        Role.is_filled == True
    ).options(joinedload(Role.assigned_user)).all()
    
    result = []
    for role in roles:
        contributions = db.query(Contribution).filter(
            Contribution.role_id == role.id
        ).all()
        
        validated_contributions = [c for c in contributions if c.status == ContributionStatus.VALIDATED]
        pending_contributions = [c for c in contributions if c.status == ContributionStatus.PENDING]
        
        result.append({
            "role_id": role.id,
            "role_title": role.title,
            "user_id": role.assigned_user.id if role.assigned_user else None,
            "user_name": role.assigned_user.full_name if role.assigned_user else None,
            "validated_count": len(validated_contributions),
            "pending_count": len(pending_contributions),
            "total_hours": sum(c.hours_worked for c in validated_contributions)
        })
    
    return result

@app.post("/api/contributions")
def create_contribution(
    role_id: int = Form(...),
    description: str = Form(...),
    hours_worked: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registrar trabajo realizado (el miembro registra su trabajo)"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this role")
    
    contribution = Contribution(
        user_id=current_user.id,
        project_id=role.project_id,
        role_id=role_id,
        description=description,
        hours_worked=hours_worked,
        status=ContributionStatus.PENDING
    )
    db.add(contribution)
    db.commit()
    
    return {"message": "Contribution recorded", "contribution_id": contribution.id}

@app.get("/api/projects/{project_id}/contributions")
def get_project_contributions(
    project_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener contribuciones de un proyecto (para validación)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(Contribution).filter(Contribution.project_id == project_id)
    if status:
        query = query.filter(Contribution.status == status)
    
    contributions = query.options(
        joinedload(Contribution.user),
        joinedload(Contribution.role)
    ).all()
    
    result = []
    for c in contributions:
        result.append({
            "id": c.id,
            "user_name": c.user.full_name,
            "role_title": c.role.title,
            "description": c.description,
            "hours_worked": c.hours_worked,
            "status": c.status.value,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    return result

@app.post("/api/contributions/{contribution_id}/validate")
def validate_contribution(
    contribution_id: int,
    validated: bool = Form(...),
    compensation_amount: float = Form(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validar o rechazar una contribución"""
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).options(
        joinedload(Contribution.role).joinedload(Role.project)
    ).first()
    
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")
    
    project = contribution.role.project
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if validated:
        contribution.status = ContributionStatus.VALIDATED
        contribution.validated_at = datetime.utcnow()
        contribution.compensation_amount = compensation_amount
    else:
        contribution.status = ContributionStatus.REJECTED
    
    db.commit()
    return {"message": "Contribution " + ("validated" if validated else "rejected")}

@app.post("/api/roles/{role_id}/replace")
def replace_member(
    role_id: int,
    new_user_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reemplazar a un miembro en un rol"""
    role = db.query(Role).filter(Role.id == role_id).options(
        joinedload(Role.project)
    ).first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if current_user.role != UserRole.ADMIN and role.project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Rechazar aplicación del usuario anterior
    if role.assigned_user_id:
        old_app = db.query(Application).filter(
            Application.role_id == role_id,
            Application.user_id == role.assigned_user_id,
            Application.status == ApplicationStatus.ACCEPTED
        ).first()
        if old_app:
            old_app.status = ApplicationStatus.REJECTED
    
    # Asignar nuevo usuario
    role.assigned_user_id = new_user_id
    
    # Crear o actualizar aplicación aceptada para el nuevo usuario
    new_app = db.query(Application).filter(
        Application.role_id == role_id,
        Application.user_id == new_user_id
    ).first()
    
    if new_app:
        new_app.status = ApplicationStatus.ACCEPTED
    else:
        new_app = Application(
            role_id=role_id,
            user_id=new_user_id,
            message="Assigned by producer",
            status=ApplicationStatus.ACCEPTED
        )
        db.add(new_app)
    
    # Convertir nuevo usuario en miembro
    new_user = db.query(User).filter(User.id == new_user_id).first()
    if new_user and new_user.role == UserRole.USER:
        new_user.role = UserRole.MEMBER
    
    db.commit()
    return {"message": "Member replaced successfully"}

# ============ NECESIDADES DE RECURSOS (Equipos, Insumos, Locaciones) ============

@app.post("/api/projects/{project_id}/resources")
def create_resource_need(
    project_id: int,
    category: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear una necesidad de recurso dentro de un proyecto (solo admin/productor)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        cat_enum = ResourceCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category. Use equipment, location or supply")
    
    resource = ResourceNeed(
        project_id=project_id,
        category=cat_enum,
        title=title,
        description=description,
        is_filled=False
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return {"message": "Resource need created", "resource_id": resource.id}

@app.get("/api/projects/{project_id}/resources")
def get_project_resources(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Listar necesidades de recursos de un proyecto"""
    resources = db.query(ResourceNeed).filter(
        ResourceNeed.project_id == project_id
    ).options(joinedload(ResourceNeed.provider)).all()
    
    result = []
    for r in resources:
        result.append({
            "id": r.id,
            "category": r.category.value,
            "title": r.title,
            "description": r.description,
            "is_filled": r.is_filled,
            "provider_name": r.provider.full_name if r.provider else None
        })
    return result

@app.post("/api/resources/{resource_id}/offer")
def offer_resource(
    resource_id: int,
    message: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ofrecer un recurso para una necesidad del proyecto"""
    resource = db.query(ResourceNeed).filter(ResourceNeed.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource need not found")
    
    if resource.is_filled:
        raise HTTPException(status_code=400, detail="This resource need is already filled")
    
    existing = db.query(ResourceOffer).filter(
        ResourceOffer.resource_need_id == resource_id,
        ResourceOffer.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already offered for this resource")
    
    offer = ResourceOffer(
        resource_need_id=resource_id,
        user_id=current_user.id,
        message=message,
        status=ResourceOfferStatus.PENDING
    )
    db.add(offer)
    db.commit()
    return {"message": "Resource offer submitted successfully"}

@app.get("/api/resources/{resource_id}/offers")
def get_resource_offers(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ver ofertas de un recurso (solo admin/productor del proyecto)"""
    resource = db.query(ResourceNeed).filter(ResourceNeed.id == resource_id).options(
        joinedload(ResourceNeed.project)
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource need not found")
    
    if current_user.role != UserRole.ADMIN and resource.project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    offers = db.query(ResourceOffer).filter(
        ResourceOffer.resource_need_id == resource_id
    ).options(joinedload(ResourceOffer.user)).all()
    
    result = []
    for o in offers:
        result.append({
            "id": o.id,
            "user_name": o.user.full_name,
            "user_email": o.user.email,
            "message": o.message,
            "status": o.status.value,
            "created_at": o.created_at.isoformat()
        })
    return result

@app.post("/api/resources/{resource_id}/respond")
def respond_resource_offer(
    resource_id: int,
    offer_id: int = Form(...),
    accept: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aceptar o rechazar una oferta de recurso"""
    resource = db.query(ResourceNeed).filter(ResourceNeed.id == resource_id).options(
        joinedload(ResourceNeed.project)
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource need not found")
    
    if current_user.role != UserRole.ADMIN and resource.project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    offer = db.query(ResourceOffer).filter(
        ResourceOffer.id == offer_id,
        ResourceOffer.resource_need_id == resource_id
    ).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if accept:
        offer.status = ResourceOfferStatus.ACCEPTED
        resource.is_filled = True
        resource.provider_user_id = offer.user_id
        
        # Rechazar otras ofertas pendientes
        other_offers = db.query(ResourceOffer).filter(
            ResourceOffer.resource_need_id == resource_id,
            ResourceOffer.id != offer_id,
            ResourceOffer.status == ResourceOfferStatus.PENDING
        ).all()
        for oo in other_offers:
            oo.status = ResourceOfferStatus.REJECTED
        
        # Convertir proveedor en miembro
        user = db.query(User).filter(User.id == offer.user_id).first()
        if user and user.role == UserRole.USER:
            user.role = UserRole.MEMBER
    else:
        offer.status = ResourceOfferStatus.REJECTED
    
    db.commit()
    return {"message": "Resource offer " + ("accepted" if accept else "rejected")}

# ============ APORTES ECONÓMICOS ============

@app.post("/api/projects/{project_id}/donate")
def donate(
    project_id: int,
    amount: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Realizar aporte económico voluntario"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    donation = Donation(
        user_id=current_user.id,
        project_id=project_id,
        amount=amount
    )
    db.add(donation)
    
    # Convertir usuario en miembro si no lo es
    if current_user.role == UserRole.USER:
        current_user.role = UserRole.MEMBER
    
    db.commit()
    return {"message": f"Donation of ${amount} recorded (simulated payment)"}

@app.get("/api/projects/{project_id}/donations")
def get_project_donations(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ver donaciones de un proyecto"""
    donations = db.query(Donation).filter(
        Donation.project_id == project_id
    ).options(joinedload(Donation.user)).all()
    
    total = sum(d.amount for d in donations)
    
    result = []
    for d in donations:
        result.append({
            "user_name": d.user.full_name,
            "amount": d.amount,
            "created_at": d.created_at.isoformat()
        })
    
    return {"donations": result, "total": total}

# ============ AGENDA DEL PROYECTO ============

@app.post("/api/projects/{project_id}/events")
def create_project_event(
    project_id: int,
    title: str = Form(...),
    description: str = Form(""),
    event_date: str = Form(...),  # ISO format
    related_role_title: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear un evento en la agenda del proyecto (solo admin/productor)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        parsed_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601")
    
    event = ProjectEvent(
        project_id=project_id,
        title=title,
        description=description,
        event_date=parsed_date,
        related_role_title=related_role_title or None
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"message": "Event created", "event_id": event.id}

@app.get("/api/projects/{project_id}/events")
def get_project_events(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Listar eventos de un proyecto (futuros primero, luego pasados recientes)"""
    now = datetime.utcnow()
    
    future = db.query(ProjectEvent).filter(
        ProjectEvent.project_id == project_id,
        ProjectEvent.event_date >= now
    ).order_by(ProjectEvent.event_date.asc()).all()
    
    past = db.query(ProjectEvent).filter(
        ProjectEvent.project_id == project_id,
        ProjectEvent.event_date < now
    ).order_by(ProjectEvent.event_date.desc()).limit(5).all()
    
    events = future + past
    
    result = []
    for e in events:
        result.append({
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "event_date": e.event_date.isoformat(),
            "related_role_title": e.related_role_title
        })
    return result

@app.delete("/api/events/{event_id}")
def delete_project_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Eliminar un evento de la agenda"""
    event = db.query(ProjectEvent).filter(ProjectEvent.id == event_id).options(
        joinedload(ProjectEvent.project)
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if current_user.role != UserRole.ADMIN and event.project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}

# ============ DISTRIBUCIÓN ECONÓMICA Y VOTACIONES ============

@app.post("/api/projects/{project_id}/complete")
def complete_project(
    project_id: int,
    total_income: float = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marcar proyecto como terminado y comercializado, con ingresos"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    project.status = ProjectStatus.COMMERCIALIZED
    project.total_income = total_income
    project.completed_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Project marked as commercialized"}

@app.get("/api/projects/{project_id}/distribution")
def get_distribution(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cálculo de distribución económica"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.status != ProjectStatus.COMMERCIALIZED:
        raise HTTPException(status_code=400, detail="Project not yet commercialized")
    
    # Obtener contribuciones validadas
    contributions = db.query(Contribution).filter(
        Contribution.project_id == project_id,
        Contribution.status == ContributionStatus.VALIDATED
    ).all()
    
    total_compensation = sum(c.compensation_amount for c in contributions)
    
    # Calcular excedente
    surplus = project.total_income - total_compensation
    
    contributors = []
    for c in contributions:
        contributors.append({
            "user_id": c.user_id,
            "role_id": c.role_id,
            "hours": c.hours_worked,
            "compensation": c.compensation_amount
        })
    
    return {
        "total_income": project.total_income,
        "total_compensation": total_compensation,
        "surplus": surplus,
        "contributors": contributors
    }

@app.get("/api/projects/{project_id}/votings")
def get_project_votings(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Listar votaciones de un proyecto"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    votings = db.query(Voting).filter(Voting.project_id == project_id).all()
    
    result = []
    for v in votings:
        has_voted = db.query(Vote).filter(
            Vote.voting_id == v.id,
            Vote.user_id == current_user.id
        ).first() is not None
        
        result.append({
            "id": v.id,
            "title": v.title,
            "description": v.description,
            "status": v.status,
            "options": json.loads(v.options),
            "has_voted": has_voted,
            "created_at": v.created_at.isoformat()
        })
    return result

@app.post("/api/projects/{project_id}/votings")
def create_voting(
    project_id: int,
    title: str = Form(...),
    description: str = Form(...),
    options: str = Form(...),  # JSON string
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear votación para decidir uso de excedente"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != UserRole.ADMIN and project.producer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    options_list = json.loads(options)
    
    voting = Voting(
        project_id=project_id,
        title=title,
        description=description,
        options=json.dumps(options_list),
        status="open"
    )
    db.add(voting)
    db.commit()
    
    return {"message": "Voting created", "voting_id": voting.id}

@app.post("/api/votings/{voting_id}/vote")
def cast_vote(
    voting_id: int,
    option_index: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Votar en una votación (solo miembros del proyecto)"""
    voting = db.query(Voting).filter(Voting.id == voting_id).first()
    if not voting:
        raise HTTPException(status_code=404, detail="Voting not found")
    
    if voting.status != "open":
        raise HTTPException(status_code=400, detail="Voting is closed")
    
    # Verificar que el usuario sea miembro de la comunidad de este proyecto
    if not is_community_member(db, current_user.id, voting.project_id):
        raise HTTPException(status_code=403, detail="Only community members of this project can vote")
    
    # Verificar que no haya votado ya
    existing = db.query(Vote).filter(
        Vote.voting_id == voting_id,
        Vote.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already voted")
    
    vote = Vote(
        voting_id=voting_id,
        user_id=current_user.id,
        option_index=option_index
    )
    db.add(vote)
    db.commit()
    
    return {"message": "Vote cast successfully"}

@app.get("/api/votings/{voting_id}/results")
def get_voting_results(
    voting_id: int,
    db: Session = Depends(get_db)
):
    """Obtener resultados de una votación"""
    voting = db.query(Voting).filter(Voting.id == voting_id).first()
    if not voting:
        raise HTTPException(status_code=404, detail="Voting not found")
    
    options = json.loads(voting.options)
    votes = db.query(Vote).filter(Vote.voting_id == voting_id).all()
    
    results = [0] * len(options)
    for v in votes:
        if 0 <= v.option_index < len(options):
            results[v.option_index] += 1
    
    return {
        "title": voting.title,
        "description": voting.description,
        "status": voting.status,
        "options": options,
        "votes": results,
        "total_votes": len(votes)
    }

# ============ RUTA PARA SERVIR EL FRONTEND ============

@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")

@app.get("/{path:path}")
def serve_spa(path: str):
    """Servir la SPA para cualquier ruta"""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
