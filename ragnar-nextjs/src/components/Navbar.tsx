"use client";

import NextLink from 'next/link';
import React from 'react';
import { Home, MessageSquare, FileText, Search, BookOpen, BarChart2, Menu, X } from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  target?: string;
}

interface NavbarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const NAV_ITEMS: Array<NavItem> = [
  { label: 'Inicio', href: '/' },
  { label: 'Chat', href: '/chat' },
  { label: 'Documentos', href: '/documents' },
  { label: 'Búsqueda', href: '/search' },
  { label: 'Generación de Manuales', href: '/manuals' },
  { label: 'Grafos de Conocimiento', href: '/graphs/page-simple' },
  { label: 'Documentación', href: 'https://github.com/morphik-io/morphik', target: '_blank' },
  { label: 'Acerca de Morphik', href: '/about' },
];

const getIcon = (label: string) => {
  switch (label) {
    case 'Inicio': return <Home size={20} className="text-gray-500" />;
    case 'Chat': return <MessageSquare size={20} className="text-gray-500" />;
    case 'Documentos': return <FileText size={20} className="text-gray-500" />;
    case 'Búsqueda': return <Search size={20} className="text-gray-500" />;
    case 'Generación de Manuales': return <BookOpen size={20} className="text-gray-500" />;
    case 'Grafos de Conocimiento': return <BarChart2 size={20} className="text-gray-500" />;
    default: return <BarChart2 size={20} className="text-gray-500" />;
  }
};

export default function Navbar({ isOpen, toggleSidebar }: NavbarProps) {
  return (
    <>
      {/* Button to OPEN the sidebar. Fixed position, visibility toggled. */}
      <button
        onClick={toggleSidebar}
        className={`p-3 fixed top-4 left-4 z-50 bg-white rounded-md shadow-lg hover:bg-gray-100 transition-all duration-300 ease-in-out border border-gray-200 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Open sidebar"
      >
        <Menu size={24} className="text-gray-700" />
      </button>

      {/* Sidebar <aside> element. Always rendered in the flex layout. Width and content visibility are toggled. */}
      <aside
        className={`h-screen bg-white border-r shadow-lg flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "w-64" : "w-0"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Content of the sidebar, rendered only if isOpen to prevent issues with w-0 */}
        {isOpen && (
          <div className="px-4 py-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <NextLink href="/" className="flex items-center">
                <span className="text-xl font-bold text-blue-600">Morphik</span>
              </NextLink>
              {/* Button to CLOSE the sidebar */}
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Close sidebar"
              >
                <X size={20} className="text-gray-700" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.label} className="list-none">
                    <NextLink
                      href={item.href ?? '#'}
                      target={item.target}
                      className="flex items-center text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md px-3 py-2.5 transition-all text-sm"
                    >
                      <span className="mr-3">{getIcon(item.label)}</span>
                      <span>{item.label}</span>
                    </NextLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </aside>
    </>
  );
}
