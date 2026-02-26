# 1) MySQL : creer la base et charger schema + seed (une seule fois)
#    Ouvrir MySQL (ligne de commande ou outil) et executer :
#    CREATE DATABASE IF NOT EXISTS ecoagadir;
#    Puis en CMD/PowerShell (depuis la racine du projet) :
#    Get-Content database\schema.sql | mysql -u root -p ecoagadir
#    Get-Content database\seed.sql | mysql -u root -p ecoagadir
#
# 2) Lancer le backend (terminal 1)
Set-Location backend
python app.py
