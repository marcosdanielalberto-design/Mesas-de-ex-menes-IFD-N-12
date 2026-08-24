# Frontend GitHub Pages

Este directorio es el frontend estático de Mesas de Exámenes. No contiene datos institucionales ni credenciales. El backend continúa en Apps Script.

## Publicación

1. Crear un repositorio GitHub, por ejemplo `mesas-examenes-ifd12`.
2. Copiar el contenido de este directorio a la raíz del repositorio.
3. En GitHub: `Settings` -> `Pages` -> `Deploy from a branch` -> `main` -> `/root`.
4. Editar `config.js` sólo para cambiar la URL pública del backend.

## Nota técnica

GitHub Pages no ejecuta servidor. El adaptador usa JSONP para comunicarse con Apps Script sin depender de `google.script.run`. Las operaciones que transportan archivos grandes, como la importación de PDF de Planta Funcional, deben continuar ejecutándose desde la Web App de Apps Script o migrarse posteriormente a un endpoint con CORS real.
