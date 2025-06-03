"""
Rules module for Morphik.
Contains custom rules for document processing and metadata extraction.
"""

from .erp_metadata_extraction_rule import ERPMetadataExtractionRule

__all__ = [
    "ERPMetadataExtractionRule"
]
