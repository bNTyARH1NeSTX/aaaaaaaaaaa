"use client";

import { 
  Home, 
  MessageSquare, 
  FileText, 
  Search, 
  BookOpen, 
  BarChart2, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon 
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavbarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Documentos', href: '/documents', icon: FileText },
  { label: 'Búsqueda', href: '/search', icon: Search },
  { label: 'Manuales', href: '/manuals', icon: BookOpen },
  { label: 'Grafos de Conocimiento', href: '/graphs', icon: BarChart2 },
];

const FOOTER_ITEMS: NavItem[] = [
  { label: 'Configuración', href: '/settings', icon: Settings },
];

export default function Navbar({ isOpen, toggleSidebar }: NavbarProps) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Optionally, check for saved theme preference or system preference
    const isDark = localStorage.getItem('theme') === 'dark' || 
                   (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (!isMounted) {
    return null; // Or a loading skeleton
  }

  return (
    <aside 
      className={`${isOpen ? 'w-64' : 'w-[70px]'} min-h-screen fixed top-0 left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 ease-in-out flex flex-col z-50`}
    >
      {/* Header */}
      <div className={`p-4 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} border-b border-gray-200 dark:border-gray-700 h-16`}>
        {isOpen && (
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <img src="/morphik_logo.png" alt="Ragnar Logo" className="h-8 w-auto" /> 
            <span>Ragnar</span>
          </Link>
        )}
        <button 
          onClick={toggleSidebar} 
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
              ${pathname === item.href 
                ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
              ${!isOpen ? 'justify-center' : ''}`}
          >
            <item.icon className={`w-5 h-5 ${!isOpen ? 'mx-auto' : ''}`} />
            {isOpen && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-1">
          {FOOTER_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                ${pathname === item.href 
                  ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                ${!isOpen ? 'justify-center' : ''}`}
            >
              <item.icon className={`w-5 h-5 ${!isOpen ? 'mx-auto' : ''}`} />
              {isOpen && <span>{item.label}</span>}
            </Link>
          ))}
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
              ${!isOpen ? 'justify-center' : ''}`}
          >
            {darkMode ? <Sun className={`w-5 h-5 ${!isOpen ? 'mx-auto' : ''}`} /> : <Moon className={`w-5 h-5 ${!isOpen ? 'mx-auto' : ''}`} />}
            {isOpen && <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
          {/* Logout - Assuming a placeholder, actual logout logic would be needed */}
          <Link
            href="#"
            onClick={() => alert('Funcionalidad de logout no implementada')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 ${!isOpen ? 'justify-center' : ''}`}
          >
            <LogOut className={`w-5 h-5 ${!isOpen ? 'mx-auto' : ''}`} />
            {isOpen && <span>Cerrar Sesión</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
}
