"use client";

import dynamic from 'next/dynamic';

// Dynamically import the DocumentsPageClient component with SSR disabled
const DocumentsPageClient = dynamic(() => import('@/components/DocumentsPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>
  )
});

export default function DocumentsPage() {
  return <DocumentsPageClient />;
}
