"use client";

import { Twitter, Youtube, Github } from 'lucide-react';
import React, { ReactNode } from 'react';

const ListHeader = ({ children }: { children: ReactNode }) => {
  return (
    <h3 className="font-bold text-gray-700 mb-3">{children}</h3>
  );
};

const SocialButton = ({
  children,
  label,
  href,
}: {
  children: ReactNode;
  label: string;
  href: string;
}) => {
  return (
    <a 
      href={href} 
      aria-label={label} 
      className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full inline-flex justify-center items-center text-gray-600 hover:text-blue-500 transition-all mx-1"
    >
      {children}
    </a>
  );
};

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div>
              <h2 className="text-2xl font-bold text-blue-600">Morphik</h2>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              © {new Date().getFullYear()} Morphik. Todos los derechos reservados.
            </p>
            <div className="mt-4 flex">
              <SocialButton label="Twitter" href="https://twitter.com">
                <Twitter size={18} />
              </SocialButton>
              <SocialButton label="YouTube" href="https://youtube.com">
                <Youtube size={18} />
              </SocialButton>
              <SocialButton label="GitHub" href="https://github.com/morphik-ai/morphik-core">
                <Github size={18} />
              </SocialButton>
            </div>
          </div>
          
          <div>
            <ListHeader>Funciones</ListHeader>
            <div className="flex flex-col space-y-2">
              <a href="/search" className="text-gray-600 hover:text-blue-500 text-sm">Búsqueda Vectorial</a>
              <a href="/documents" className="text-gray-600 hover:text-blue-500 text-sm">Gestión de Documentos</a>
              <a href="/graphs" className="text-gray-600 hover:text-blue-500 text-sm">Grafos de Conocimiento</a>
              <a href="/chat" className="text-gray-600 hover:text-blue-500 text-sm">Chat IA</a>
            </div>
          </div>
          
          <div>
            <ListHeader>Recursos</ListHeader>
            <div className="flex flex-col space-y-2">
              <a href="https://github.com/pgvector/pgvector" className="text-gray-600 hover:text-blue-500 text-sm">pgvector</a>
              <a href="https://python.langchain.com/docs/modules/vectorstores" className="text-gray-600 hover:text-blue-500 text-sm">Vector Stores</a>
              <a href="https://github.com/morphik-ai/morphik-core" className="text-gray-600 hover:text-blue-500 text-sm">GitHub</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
