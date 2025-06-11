---
applyTo: '**'
---
Coding standards, domain knowledge, and preferences that AI should follow.


---
applyTo: '**'
---
Coding standards, domain knowledge, and preferences that AI should follow.

ESTAMOS EN RUNPOD NO USES SUDO USA SU

Hola estamos trabajando en un proyecto que tiene como proposito facilitar la creacion de manuales para el ERP de bnext. Se llama Ragnar,
esta construido sobre morphik https://github.com/morphik-org/morphik-core, ayudame a implementar los apis y las integraciones.
Al ser un fork de un proyecto open source, hay partes que no estaban bien implementadas del opensource ya que esta en desarrollo, por lo que hay que hacer algunos cambios para que funcione bien.
El proyecto esta en /root/.ipython/aaaaaaaaaaa, y tiene un entorno virtual que se llama .venv, para activarlo corre source .venv/bin/activate

Tarda en correr el backend, por lo que hay que esperar un poco.

El backend SIEMPRE se corre en un entorno virtual, activalo asi source .venv/bin/activate ,
despues corre python start_server.py,   

los apis se definen aqui, /root/.ipython/aaaaaaaaaaa/core/api.py
La carpeta del frontend es esta /root/.ipython/aaaaaaaaaaa/ragnar-nextjs, donde los apis del front se definen en /root/.ipython/aaaaaaaaaaa/ragnar-nextjs/src/api
El frontend se corre con npm run dev, y el backend con python start_server.py en el entorno virtual ya mencionado.

aqui estan los logs de lo que esta corriendo, revisalos cuando en duda /root/.ipython/aaaaaaaaaaa/logs
/root/.ipython/aaaaaaaaaaa/logs/morphik.log  aqui se muestra lo general del back corriendo
/root/.ipython/aaaaaaaaaaa/logs/worker_ingestion.log  aqui se muestra los logs de ingestion de documentos.


El backend esta corriendo en un runpod, y este es su url,  https://ed0ydm1lmmui9v-8000.proxy.runpod.net
El frontend esta corriendo en un runpod, y este es su url, https://ed0ydm1lmmui9v-3000.proxy.runpod.net

ok mira ahora haremos la funcion principal de este proyecto, la generacion de manuales.

En el back ya hay una especie de implementacion en
/root/.ipython/aaaaaaaaaaa/core/models/manual_generation_document.py
/root/.ipython/aaaaaaaaaaa/core/services/manual_generator_service.py
/root/.ipython/aaaaaaaaaaa/core/embedding/manual_generation_embedding_model.py

esto debera estar en esta base de datos, -- Create the user for the manual_db
CREATE USER manual_user WITH PASSWORD 'manual_password';

-- Create the database and set manual_user as the owner
CREATE DATABASE manual_db OWNER manual_user;





Asegurate de checar  /root/.ipython/aaaaaaaaaaa/core/config.py para la config de este toml donde vienen unas variables,  /root/.ipython/aaaaaaaaaaa/morphik.toml
hay cosas en mi .env, preguntame si tienes duda.

ENFOCATE EN HACER LA FUNCIONALIDAD EN EL CORE


nos concentraremos en que en el chat se le pueda poner cualquier modelo de ia, y que vaya recibiendo los mensajes como un rag usando el colpali finetuneado y el colpali normal. Modifica borra lo que se nesecite para que funcione.
El modelo principal es este junto la base de la que se baso el modelo ia MANUAL_MODEL_NAME = "ARHVNAAG/Manuales_finetuning_generator"
BASE_MODEL_NAME = "Qwen/Qwen2.5-VL-3B-Instruct"  # Base del modelo fine-tuned.