@echo off
chcp 65001 >nul
echo =======================================
echo   Publication automatique sur GitHub
echo =======================================
echo.

set "msg=%~1"
if "%msg%"=="" (
    set /p "msg=Message du commit (appuyez sur Entrée pour 'Mise à jour') : "
)
if "%msg%"=="" set "msg=Mise à jour"

echo.
echo 1/3 - Préparation des fichiers...
git add -A

echo 2/3 - Création du commit...
git commit -m "%msg%"

echo 3/3 - Envoi vers GitHub...
git push origin main

echo.
echo =======================================
echo   Terminé avec succès !
echo =======================================
echo.
pause
