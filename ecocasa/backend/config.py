# -*- coding: utf-8 -*-
"""Configuration EcoCasa - MySQL et Flask."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    """Configuration de base."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'ecocasa-dev-secret-change-in-production'
    # MySQL
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER = os.environ.get('MYSQL_USER', 'ecocasa')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'ecocasa')
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'ecocasa')
    
    @property
    def MYSQL_URI(self):
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
        )


config = Config()
