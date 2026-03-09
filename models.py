from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    VISITOR = "visitor"
    USER = "user"
    MEMBER = "member"
    ADMIN = "admin"

class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    COMMERCIALIZED = "commercialized"

class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

class ContributionStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    bio = Column(Text, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    applications = relationship("Application", back_populates="user")
    contributions = relationship("Contribution", back_populates="user")
    donations = relationship("Donation", back_populates="user")
    votes = relationship("Vote", back_populates="user")
    managed_projects = relationship("Project", back_populates="producer")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    type = Column(String)  # pelicula, documental, serie, libro, cancion
    status = Column(Enum(ProjectStatus), default=ProjectStatus.OPEN)
    producer_id = Column(Integer, ForeignKey("users.id"))
    budget_theoretical = Column(Float, default=0)
    objectives = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    total_income = Column(Float, default=0)
    
    producer = relationship("User", back_populates="managed_projects")
    roles = relationship("Role", back_populates="project", cascade="all, delete-orphan")
    donations = relationship("Donation", back_populates="project")

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String)
    description = Column(Text)
    tasks = Column(Text)
    deliverables = Column(Text)
    reference_fee = Column(Float, default=0)
    is_filled = Column(Boolean, default=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    project = relationship("Project", back_populates="roles")
    assigned_user = relationship("User")
    applications = relationship("Application", back_populates="role")
    contributions = relationship("Contribution", back_populates="role")

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    role = relationship("Role", back_populates="applications")
    user = relationship("User", back_populates="applications")

class Contribution(Base):
    __tablename__ = "contributions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    description = Column(Text)
    hours_worked = Column(Float, default=0)
    status = Column(Enum(ContributionStatus), default=ContributionStatus.PENDING)
    validated_at = Column(DateTime, nullable=True)
    compensation_amount = Column(Float, default=0)
    
    user = relationship("User", back_populates="contributions")
    role = relationship("Role", back_populates="contributions")

class Donation(Base):
    __tablename__ = "donations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    amount = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="donations")
    project = relationship("Project", back_populates="donations")

class Voting(Base):
    __tablename__ = "votings"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String)
    description = Column(Text)
    options = Column(Text)  # JSON array
    status = Column(String, default="open")  # open, closed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    votes = relationship("Vote", back_populates="voting")

class Vote(Base):
    __tablename__ = "votes"
    
    id = Column(Integer, primary_key=True, index=True)
    voting_id = Column(Integer, ForeignKey("votings.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    option_index = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    voting = relationship("Voting", back_populates="votes")
    user = relationship("User", back_populates="votes")
