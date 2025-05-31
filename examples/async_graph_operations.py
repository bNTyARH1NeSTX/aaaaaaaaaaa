import os
import time
from typing import Dict, Any, Optional

from dotenv import load_dotenv
import requests

# Cargar variables de entorno
load_dotenv()

# URL base para la API de Ragnar (Morphik)
BASE_URL = os.getenv("MORPHIK_API_URL", "http://localhost:8000")
# Token de API para autenticación
API_TOKEN = os.getenv("MORPHIK_API_TOKEN", "")

# Headers para autenticación
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def create_graph_async(name: str, document_ids: list, filters: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Crear un grafo de manera asíncrona.

    Args:
        name: Nombre del grafo a crear
        document_ids: Lista de IDs de documentos a incluir en el grafo
        filters: Filtros adicionales para la creación del grafo

    Returns:
        Dict: Respuesta con el ID del flujo de trabajo
    """
    create_data = {
        "name": name,
        "documents": document_ids,
    }
    
    if filters:
        create_data["filters"] = filters
    
    response = requests.post(f"{BASE_URL}/graph", json=create_data, headers=headers)
    response.raise_for_status()
    
    result = response.json()
    
    # Extraer workflow_id del resultado si está disponible
    workflow_id = result.get("system_metadata", {}).get("workflow_id")
    print(f"Grafo '{name}' iniciado. ID del flujo de trabajo: {workflow_id}")
    
    return {
        "graph_name": name, 
        "workflow_id": workflow_id, 
        "graph": result
    }

def update_graph_async(name: str, additional_document_ids: Optional[list] = None) -> Dict[str, Any]:
    """
    Actualizar un grafo de manera asíncrona.

    Args:
        name: Nombre del grafo a actualizar
        additional_document_ids: Lista de IDs de documentos adicionales a incluir

    Returns:
        Dict: Respuesta con el ID del flujo de trabajo
    """
    update_data = {}
    
    if additional_document_ids:
        update_data["additional_documents"] = additional_document_ids
    
    response = requests.post(f"{BASE_URL}/graph/{name}/update", json=update_data, headers=headers)
    response.raise_for_status()
    
    result = response.json()
    
    # Extraer workflow_id del resultado si está disponible
    workflow_id = result.get("system_metadata", {}).get("workflow_id")
    print(f"Actualización del grafo '{name}' iniciada. ID del flujo de trabajo: {workflow_id}")
    
    return {
        "graph_name": name,
        "workflow_id": workflow_id,
        "graph": result
    }

def check_workflow_status(workflow_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Verificar el estado de un flujo de trabajo de grafo.

    Args:
        workflow_id: ID del flujo de trabajo a verificar
        run_id: ID opcional de la ejecución específica

    Returns:
        Dict: Estado actual del flujo de trabajo
    """
    params = {}
    if run_id:
        params["run_id"] = run_id
    
    response = requests.get(
        f"{BASE_URL}/graph/workflow/{workflow_id}/status", 
        headers=headers,
        params=params
    )
    response.raise_for_status()
    
    return response.json()

def wait_for_workflow_completion(workflow_id: str, timeout_seconds: int = 600, polling_interval: int = 10) -> Dict[str, Any]:
    """
    Esperar a que un flujo de trabajo se complete.

    Args:
        workflow_id: ID del flujo de trabajo a verificar
        timeout_seconds: Tiempo máximo de espera en segundos (por defecto 10 minutos)
        polling_interval: Intervalo entre verificaciones en segundos

    Returns:
        Dict: Resultado final del flujo de trabajo
    """
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        status_result = check_workflow_status(workflow_id)
        current_status = status_result.get("status")
        
        print(f"Estado actual del flujo de trabajo: {current_status}")
        
        if current_status == "completed":
            print("¡Flujo de trabajo completado con éxito!")
            return status_result
        elif current_status == "failed":
            print(f"El flujo de trabajo falló: {status_result.get('error', 'Error desconocido')}")
            return status_result
        
        print(f"Esperando {polling_interval} segundos para volver a verificar...")
        time.sleep(polling_interval)
    
    print(f"Tiempo de espera agotado después de {timeout_seconds} segundos.")
    return {"status": "timeout", "message": f"Tiempo de espera agotado después de {timeout_seconds} segundos"}

def get_graph_visualization(graph_name: str) -> Dict[str, Any]:
    """
    Obtener datos de visualización de un grafo.

    Args:
        graph_name: Nombre del grafo para visualizar

    Returns:
        Dict: Datos de visualización del grafo (nodos y enlaces)
    """
    response = requests.get(f"{BASE_URL}/graph/{graph_name}/visualization", headers=headers)
    response.raise_for_status()
    
    return response.json()

# Ejemplo de uso
if __name__ == "__main__":
    # Ejemplo: crear un grafo de manera asíncrona
    print("Creando un grafo de conocimiento de manera asíncrona...")
    
    # IDs de documentos para el grafo (sustituir con IDs reales)
    document_ids = ["doc-1", "doc-2", "doc-3"]
    
    # Crear el grafo
    create_result = create_graph_async(
        name="async_demo_graph",
        document_ids=document_ids,
        filters={"category": "documentation"}
    )
    
    workflow_id = create_result.get("workflow_id")
    if not workflow_id:
        print("No se pudo obtener el ID del flujo de trabajo. La operación puede no ser asíncrona.")
    else:
        # Esperar a que el grafo termine de construirse
        print(f"Esperando a que el grafo termine de construirse (workflow_id: {workflow_id})...")
        final_status = wait_for_workflow_completion(workflow_id)
        
        if final_status.get("status") == "completed":
            # Obtener datos de visualización
            print("Obteniendo datos de visualización del grafo...")
            visualization_data = get_graph_visualization("async_demo_graph")
            print(f"Grafo creado con {len(visualization_data.get('nodes', []))} nodos y {len(visualization_data.get('links', []))} enlaces")
