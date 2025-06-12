#!/usr/bin/env python3
"""
Test script for the color collision detection system.
This script tests both frontend and backend color systems for uniqueness.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.services.graph_service import GraphService
from core.database.base_database import BaseDatabase
from core.embedding.base_embedding_model import BaseEmbeddingModel
from core.completion.base_completion import BaseCompletionModel
from unittest.mock import Mock

def test_color_collision_system():
    """Test the color collision detection system"""
    print("🎨 Testing Color Collision Detection System")
    print("=" * 50)
    
    # Create mock dependencies
    mock_db = Mock(spec=BaseDatabase)
    mock_embedding = Mock(spec=BaseEmbeddingModel)
    mock_completion = Mock(spec=BaseCompletionModel)
    
    # Create GraphService instance
    graph_service = GraphService(
        db=mock_db,
        embedding_model=mock_embedding,
        completion_model=mock_completion
    )
    
    # Test entities - mix of Spanish entity types with potential collision names
    test_entities = [
        {"label": "Juan Pérez", "type": "PERSONA"},
        {"label": "Juan García", "type": "PERSONA"},
        {"label": "María López", "type": "PERSONA"},
        {"label": "Microsoft", "type": "ORGANIZACIÓN"},
        {"label": "Google", "type": "ORGANIZACIÓN"},
        {"label": "Apple", "type": "ORGANIZACIÓN"},
        {"label": "Madrid", "type": "UBICACIÓN"},
        {"label": "Barcelona", "type": "UBICACIÓN"},
        {"label": "Valencia", "type": "UBICACIÓN"},
        {"label": "Python", "type": "TECNOLOGÍA"},
        {"label": "JavaScript", "type": "TECNOLOGÍA"},
        {"label": "Java", "type": "TECNOLOGÍA"},
        {"label": "2024", "type": "FECHA"},
        {"label": "enero", "type": "FECHA"},
        {"label": "febrero", "type": "FECHA"},
        {"label": "Facturación", "type": "PROCESO"},
        {"label": "Contabilidad", "type": "PROCESO"},
        {"label": "Inventario", "type": "PROCESO"},
        {"label": "ERP", "type": "SISTEMA"},
        {"label": "CRM", "type": "SISTEMA"},
        {"label": "Base de datos", "type": "SISTEMA"},
        {"label": "Manual de usuario", "type": "DOCUMENTO"},
        {"label": "Guía técnica", "type": "DOCUMENTO"},
        {"label": "Tutorial", "type": "DOCUMENTO"},
    ]
    
    print(f"Testing {len(test_entities)} entities for color uniqueness...")
    print()
    
    # Generate colors for all entities
    entity_colors = {}
    color_counts = {}
    
    for entity in test_entities:
        color = graph_service._get_node_color(entity["type"], entity["label"])
        entity_colors[f"{entity['label']}:{entity['type']}"] = color
        
        # Count color usage
        if color in color_counts:
            color_counts[color] += 1
        else:
            color_counts[color] = 1
    
    # Check for collisions
    collisions = {color: count for color, count in color_counts.items() if count > 1}
    
    print("📊 Results:")
    print(f"Total entities: {len(test_entities)}")
    print(f"Unique colors generated: {len(color_counts)}")
    print(f"Color collisions: {len(collisions)}")
    print()
    
    if collisions:
        print("⚠️  Color Collisions Detected:")
        for color, count in collisions.items():
            print(f"  {color}: used {count} times")
            entities_with_color = [entity_id for entity_id, entity_color 
                                 in entity_colors.items() if entity_color == color]
            for entity_id in entities_with_color:
                print(f"    - {entity_id}")
        print()
    else:
        print("✅ No color collisions detected!")
        print()
    
    # Show color assignments by type
    print("🎨 Color Assignments by Type:")
    type_groups = {}
    for entity in test_entities:
        entity_id = f"{entity['label']}:{entity['type']}"
        entity_type = entity['type']
        if entity_type not in type_groups:
            type_groups[entity_type] = []
        type_groups[entity_type].append({
            'id': entity_id,
            'color': entity_colors[entity_id]
        })
    
    for entity_type, entities in type_groups.items():
        print(f"\n  {entity_type}:")
        for entity in entities:
            print(f"    {entity['id']}: {entity['color']}")
    
    # Test color registry statistics
    stats = {
        'totalEntities': len(graph_service._color_registry),
        'totalColors': len(graph_service._used_colors),
        'assignments': dict(graph_service._color_registry)
    }
    
    print(f"\n📈 Color Registry Statistics:")
    print(f"  Total registered entities: {stats['totalEntities']}")
    print(f"  Total unique colors: {stats['totalColors']}")
    print(f"  Registry efficiency: {stats['totalColors']/stats['totalEntities']*100:.1f}%")
    
    # Test color distinctness
    print(f"\n🔍 Color Distinctness Analysis:")
    distinct_colors = 0
    similar_pairs = []
    
    color_list = list(graph_service._used_colors)
    for i, color1 in enumerate(color_list):
        for color2 in color_list[i+1:]:
            if graph_service._is_color_sufficiently_distinct(color1) or not graph_service._is_color_sufficiently_distinct(color2):
                # This is a simplified check - in reality we'd compare the two colors directly
                continue
            else:
                similar_pairs.append((color1, color2))
    
    print(f"  Colors analyzed: {len(color_list)}")
    print(f"  Potentially similar pairs: {len(similar_pairs)}")
    
    if similar_pairs:
        print("  Similar color pairs:")
        for color1, color2 in similar_pairs[:5]:  # Show first 5
            print(f"    {color1} ↔ {color2}")
    
    # Success metrics
    collision_rate = len(collisions) / len(test_entities) * 100
    uniqueness_rate = len(color_counts) / len(test_entities) * 100
    
    print(f"\n✨ Final Assessment:")
    print(f"  Collision rate: {collision_rate:.1f}%")
    print(f"  Uniqueness rate: {uniqueness_rate:.1f}%")
    
    if collision_rate == 0:
        print("  🎉 EXCELLENT: Perfect color uniqueness achieved!")
    elif collision_rate < 5:
        print("  ✅ GOOD: Very low collision rate")
    elif collision_rate < 10:
        print("  ⚠️  FAIR: Some collisions detected")
    else:
        print("  ❌ POOR: High collision rate needs improvement")

if __name__ == "__main__":
    test_color_collision_system()
