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


El backend esta corriendo en un runpod, y este es su url, https://20h8g0u0nuxy1t-8000.proxy.runpod.net
El frontend esta corriendo en un runpod, y este es su url, https://20h8g0u0nuxy1t-3000.proxy.runpod.net/

ok mira ahora haremos la funcion principal de este proyecto, la generacion de manuales.

En el back ya hay una especie de implementacion en
/root/.ipython/aaaaaaaaaaa/core/models/manual_generation_document.py
/root/.ipython/aaaaaaaaaaa/core/services/manual_generator_service.py
/root/.ipython/aaaaaaaaaaa/core/embedding/manual_generation_embedding_model.py

esto debera estar en esta base de datos, -- Create the user for the manual_db
CREATE USER manual_user WITH PASSWORD 'manual_password';

-- Create the database and set manual_user as the owner
CREATE DATABASE manual_db OWNER manual_user;

Tambien en el api ya vienen ahi unas cosas.

Pero bueno el codigo orginal esta aqui,  /root/.ipython/aaaaaaaaaaa/Bnext%20RAGnar/col.py, aqui se usa un colpali finetuneado para generar los embeddings,
los metadatos y el json que se usa se hicieron con  /root/.ipython/manualesaaaaaaaaaaa//Bnext%20RAGnar/n.py  , pero si luego ya que se hace todo esto la magia sucede en /root/.ipython/aaaaaaaaaaa/Bnext%20RAGnar/generate_manual.py,
aqui la logica es la siguiente:

Se hizo un folder de imagenes que representa los paneles del ERP, estos pues te dicen como llegar a un lado, osea si esta en ventas y dentro de ventas hay un subfolder de agregar pues el path de la imagen te
dice a que irte para llegar ahi. Bueno colpali recupera esto y atravez de un codigo se recuperan las imagenes de los rooths padres de la imagen,
aqui se mandan las imagenes y los metadatos correspondientes a un modelo qwen finetuneado para generar manuales, es de modalidad visual, por lo que usa metadatos y imagenes para generar el manual.
El modelo genera un manual en formato markdown, y este  se supone que debe ser convertido a un powerpoint para aplicarle un diseño, a esto solo falta ponerle las imagenes que si son.
Ayudame a implementar esto, y pues a usar las funcionalidades que tambien ya tengo en el backend cuando sea posible para hacer esto un proceso
mas rapido, osea podriamos usar reglas para los metadatos,etc.

La implementacion debe quedar en el frontend.

VE registrando los cambios que hagas en un .txt porfa.

El agente de ia pasado habia hecho varios tests de lo que llevaba, buscalos tambien.

Asegurate de checar  /root/.ipython/aaaaaaaaaaa/core/config.py para la config de este toml donde vienen unas variables,  /root/.ipython/aaaaaaaaaaa/morphik.toml
hay cosas en mi .env, preguntame si tienes duda.