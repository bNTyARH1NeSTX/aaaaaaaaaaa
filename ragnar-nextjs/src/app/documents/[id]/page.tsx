'use client';

import { useParams } from 'next/navigation';
import DocumentDetailView from '@/components/documents/DocumentDetailView';

export default function DocumentDetail() {
  const params = useParams();
  // Aseguramos que params.id exista y sea string
  const documentId = params?.id ? params.id.toString() : '';

  return <DocumentDetailView documentId={documentId} />;
}
