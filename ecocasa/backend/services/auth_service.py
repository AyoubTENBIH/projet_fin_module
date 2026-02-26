# -*- coding: utf-8 -*-
"""Service d'authentification - hash mot de passe, création utilisateurs démo."""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.models import db, User

def hash_password(password: str) -> str:
    return generate_password_hash(password, method='scrypt')

def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)

def ensure_demo_users():
    """Crée les comptes démo si aucun utilisateur n'existe."""
    if User.query.first() is not None:
        return
    demo = [
        ('u1', 'admin', 'Mohammed Alami', 'admin@ecocasa.ma', 'Admin2024!', 'MA', None, None),
        ('u2', 'chauffeur', 'Youssef Benali', 'y.benali@ecocasa.ma', 'Chauffeur1!', 'YB', 'c1', 3),
        ('u3', 'chauffeur', 'Karim Mansouri', 'k.mansouri@ecocasa.ma', 'Chauffeur2!', 'KM', 'c2', 1),
        ('u4', 'chauffeur', 'Hassan Tazi', 'h.tazi@ecocasa.ma', 'Chauffeur1!', 'HT', None, None),
    ]
    for uid, role, nom, email, pwd, avatar, camion_id, zone in demo:
        if User.query.get(uid) is None:
            u = User(
                id=uid, role=role, nom=nom, email=email,
                password_hash=hash_password(pwd), avatar=avatar,
                camion_id=camion_id, zone_affectee=zone, status='inactif' if role == 'chauffeur' and uid == 'u4' else 'actif',
            )
            db.session.add(u)
    db.session.commit()
