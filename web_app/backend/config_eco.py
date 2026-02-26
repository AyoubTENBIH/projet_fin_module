# -*- coding: utf-8 -*-
"""Configuration EcoAgadir - MySQL (utilisée par le package eco).
   Par défaut : root sans mot de passe (XAMPP/phpMyAdmin). Sinon définir MYSQL_USER / MYSQL_PASSWORD.
"""
import os

class ConfigEco:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'ecoagadir-dev-secret'
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    # Par défaut root sans mdp (fréquent en dev) ; sinon env ou utilisateur ecoagadir
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = (
        '' if (MYSQL_USER == 'root' and 'MYSQL_PASSWORD' not in os.environ)
        else os.environ.get('MYSQL_PASSWORD', 'ecoagadir')
    )
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'ecoagadir')

    @property
    def MYSQL_URI(self):
        user = self.MYSQL_USER
        pw = self.MYSQL_PASSWORD
        host, port, db = self.MYSQL_HOST, self.MYSQL_PORT, self.MYSQL_DATABASE
        if not pw:
            return f"mysql+pymysql://{user}@{host}:{port}/{db}"
        return f"mysql+pymysql://{user}:{pw}@{host}:{port}/{db}"

config_eco = ConfigEco()
