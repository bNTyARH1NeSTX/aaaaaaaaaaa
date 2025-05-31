# Operaciones de Grafos en Ragnar

Este documento describe las operaciones disponibles para trabajar con grafos de conocimiento en Ragnar, incluyendo tanto operaciones síncronas como asíncronas.

## Introducción

Los grafos de conocimiento permiten representar y explorar relaciones entre entidades extraídas de documentos. Ragnar ofrece una API completa para crear, actualizar, consultar y visualizar grafos de conocimiento.

## Operaciones Síncronas

Las operaciones síncronas son ideales para grafos pequeños o medianos donde el proceso de creación/actualización se completa rápidamente.

### Crear un Grafo

```python
from morphik import Morphik

db = Morphik("http://localhost:8000", api_key="your-api-key")

# Crear un grafo a partir de documentos existentes
graph = db.create_graph(
    name="mi_grafo",
    filters={"category": "tech"},  # Filtros opcionales para seleccionar documentos
    documents=["doc-id-1", "doc-id-2"]  # IDs de documentos específicos
)
```

### Consultar un Grafo

```python
# Consulta utilizando el grafo para mejorar la respuesta
response = db.query(
    "¿Cuáles son las principales relaciones entre entidades?",
    graph_name="mi_grafo",
    hop_depth=2  # Profundidad de exploración del grafo
)
```

### Visualizar un Grafo

```python
# Obtener datos de visualización (esta es una operación de API directa)
import requests

headers = {"Authorization": f"Bearer {api_key}"}
response = requests.get("http://localhost:8000/graph/mi_grafo/visualization", headers=headers)
visualization_data = response.json()
```

## Operaciones Asíncronas

Para grafos grandes o complejos, Ragnar ofrece operaciones asíncronas que permiten iniciar un proceso en segundo plano y verificar su estado posteriormente.

### Creación/Actualización Asíncrona

Cuando se crean o actualizan grafos complejos, estas operaciones pueden devolver un ID de flujo de trabajo (workflow_id) que puede utilizarse para verificar el estado del proceso.

```python
# El ID del flujo de trabajo se devuelve en la respuesta
workflow_id = graph.system_metadata.get("workflow_id")
```

### Verificar Estado del Flujo de Trabajo

```python
import requests

headers = {"Authorization": f"Bearer {api_key}"}
response = requests.get(
    f"http://localhost:8000/graph/workflow/{workflow_id}/status", 
    headers=headers
)
status_info = response.json()
```

La respuesta incluirá un campo `status` con uno de estos valores:
- `running`: El proceso está en ejecución
- `completed`: El proceso ha finalizado correctamente
- `failed`: El proceso ha fallado

### Ejemplo Completo

Consulte el archivo `examples/async_graph_operations.py` para un ejemplo completo de cómo trabajar con operaciones asíncronas de grafos, incluyendo:

1. Crear un grafo de forma asíncrona
2. Verificar el estado del proceso
3. Esperar hasta la finalización
4. Obtener los datos de visualización

## Mejores Prácticas

- Utilice operaciones síncronas para grafos pequeños (menos de 50 documentos)
- Utilice operaciones asíncronas para grafos grandes o cuando procese grandes volúmenes de texto
- Implemente un mecanismo de sondeo con retroceso exponencial para verificar el estado del flujo de trabajo
- Establezca tiempos de espera razonables al monitorear procesos largos

## Referencia de la API

### Endpoint de Estado del Flujo de Trabajo

```
GET /graph/workflow/{workflow_id}/status
```

**Parámetros:**
- `workflow_id`: ID del flujo de trabajo a verificar (obligatorio)
- `run_id`: ID de ejecución específico (opcional)

**Respuesta:**
```json
{
  "status": "completed",  // "running", "completed", "failed"
  "progress": 100,        // Porcentaje de finalización (si está disponible)
  "result": {},           // Datos adicionales cuando se completa
  "error": null           // Mensaje de error si falló
}
```

### Endpoint de Visualización

```
GET /graph/{name}/visualization
```

**Parámetros:**
- `name`: Nombre del grafo a visualizar

**Respuesta:**
```json
{
  "nodes": [
    { "id": "entity-1", "label": "Nombre", "type": "persona", "color": "#4f46e5" }
  ],
  "links": [
    { "source": "entity-1", "target": "entity-2", "type": "conoce" }
  ]
}
```
