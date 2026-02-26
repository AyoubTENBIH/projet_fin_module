# -*- coding: utf-8 -*-
"""Exécute schema.sql et seed.sql sur la base ecoagadir (PyMySQL, pas besoin de mysql en PATH).
   Utilisation (depuis web_app/backend) :
     python init_db.py
   Avec root : MYSQL_USER=root MYSQL_PASSWORD=TonMotDePasse python init_db.py
"""
import os
import sys
from pathlib import Path

# S'assurer d'être dans backend pour importer config_eco
BACKEND = Path(__file__).resolve().parent
WEB_APP = BACKEND.parent
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from config_eco import config_eco
import pymysql

def run_sql_file(cursor, path):
    path = Path(path)
    if not path.exists():
        print("Fichier introuvable:", path)
        return
    sql = path.read_text(encoding="utf-8")
    # Enlever commentaires et découper par ;
    statements = []
    buf = []
    for line in sql.splitlines():
        line = line.strip()
        if not line or line.startswith("--"):
            continue
        buf.append(line)
        if line.endswith(";"):
            st = " ".join(buf).strip()
            if st and st != ";":
                statements.append(st)
            buf = []
    if buf:
        st = " ".join(buf).strip()
        if st:
            statements.append(st)
    for i, st in enumerate(statements):
        try:
            cursor.execute(st)
        except Exception as e:
            print("Erreur statement", i + 1, ":", e)
            print(st[:200], "...")
            raise
    print("OK:", path.name)

def main():
    user = os.environ.get("MYSQL_USER") or config_eco.MYSQL_USER
    # Mot de passe : env prioritaire ; si user=root et pas de MYSQL_PASSWORD en env → aucun (root sans mdp)
    pw_env = os.environ.get("MYSQL_PASSWORD")
    if pw_env is not None:
        password = None if pw_env == "" else pw_env
    elif user == "root" and "MYSQL_PASSWORD" not in os.environ:
        password = None  # root sans mot de passe courant
    else:
        password = config_eco.MYSQL_PASSWORD
    print("Connexion à", config_eco.MYSQL_DATABASE, "en tant que", user, "...")
    conn = pymysql.connect(
        host=config_eco.MYSQL_HOST,
        port=config_eco.MYSQL_PORT,
        user=user,
        password=password,
        database=config_eco.MYSQL_DATABASE,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            run_sql_file(cur, WEB_APP / "database" / "schema.sql")
            conn.commit()
            run_sql_file(cur, WEB_APP / "database" / "seed.sql")
            conn.commit()
        print("Base initialisée.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
