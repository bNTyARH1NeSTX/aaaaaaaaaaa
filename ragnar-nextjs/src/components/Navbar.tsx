"use client";

import NextLink from 'next/link';
import React, { useState, useEffect } from 'react';
import { Home, MessageSquare, FileText, Search, BookOpen, BarChart2, Settings, Info, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  target?: string;
  icon: React.ElementType;
}

interface NavbarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const NAV_ITEMS: Array<NavItem> = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Documentos', href: '/documents', icon: FileText },
  { label: 'Búsqueda', href: '/search', icon: Search },
  { label: 'Grafos de Conocimiento', href: '/graphs/page-simple', icon: BarChart2 },
];

const FOOTER_ITEMS: Array<NavItem> = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Navbar({ isOpen, toggleSidebar }: NavbarProps) {
  return (
    <aside 
      className={`${isOpen ? 'w-64' : 'w-[70px]'} min-h-screen fixed top-0 left-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-r border-gray-200/50 dark:border-gray-700/50 shadow-lg transition-all duration-300 ease-in-out flex flex-col z-50`}
    >
      {/* Sidebar Header */}
      <div className={`p-4 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} border-b border-gray-200/50 dark:border-gray-700/50 h-[65px]`}>
        {isOpen && (
          <NextLink href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">Morphik</span>
          </NextLink>
        )}
        <button 
          onClick={toggleSidebar} 
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 transition-all duration-200 relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10 rounded-lg scale-0 group-hover:scale-100 transition-transform duration-200"></div>
          {isOpen ? <ChevronLeft className="w-5 h-5 relative z-10" /> : <ChevronRight className="w-5 h-5 relative z-10" />}
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="mt-4 flex-1 px-2 space-y-1 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NextLink key={item.label} href={item.href ?? '#'} passHref legacyBehavior>
            <a
              target={item.target}
              title={item.label}
              className="relative flex items-center px-3 py-2.5 text-gray-700 dark:text-gray-300 rounded-lg group overflow-hidden
                         transition-all duration-200 ease-out hover:bg-gray-100/80 dark:hover:bg-gray-800/80 mb-1"
            >
              {/* Hover background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-transparent 
                           opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
              
              {/* Icon container */}
              <div className={`relative flex items-center justify-center transition-all duration-200 ease-out group-hover:scale-110 
                           group-hover:text-blue-600 dark:group-hover:text-blue-400 ${isOpen ? 'w-7' : 'w-full'}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-200"></div>
                <item.icon className="w-5 h-5 relative z-10" />
              </div>

              {/* Label with gradient effect */}
              {isOpen && (
                <div className="relative ml-3 transition-all duration-200 ease-out group-hover:translate-x-0.5 whitespace-nowrap">
                  <span className="relative z-10 text-sm font-medium group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors duration-200">
                    {item.label}
                  </span>
                  <div className="absolute -bottom-0.5 left-0 w-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-600 
                              group-hover:w-full transition-all duration-300"></div>
                </div>
              )}
            </a>
          </NextLink>
        ))}
      </nav>

      {/* Footer Items */}
      <div className="mt-auto p-2 border-t border-gray-200/50 dark:border-gray-700/50 space-y-1">
        {FOOTER_ITEMS.map((item) => (
           <NextLink key={item.label} href={item.href ?? '#'} passHref legacyBehavior>
           <a
             target={item.target}
             title={item.label}
             className="relative flex items-center px-3 py-2.5 text-gray-700 dark:text-gray-300 rounded-lg group overflow-hidden
                        transition-all duration-200 ease-out hover:bg-gray-100/80 dark:hover:bg-gray-800/80 mb-1"
           >
             <div className="absolute inset-0 bg-gradient-to-r from-gray-500/0 via-gray-500/5 to-transparent 
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
             <div className={`relative flex items-center justify-center transition-all duration-200 ease-out group-hover:scale-110 
                          group-hover:text-gray-600 dark:group-hover:text-gray-400 ${isOpen ? 'w-7' : 'w-full'}`}>
               <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-gray-400/10 dark:from-gray-400/10 dark:to-gray-300/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-200"></div>
               <item.icon className="w-5 h-5 relative z-10" />
             </div>
             {isOpen && (
               <div className="relative ml-3 transition-all duration-200 ease-out group-hover:translate-x-0.5 whitespace-nowrap">
                 <span className="relative z-10 text-sm font-medium group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200">
                   {item.label}
                 </span>
               </div>
             )}
           </a>
         </NextLink>
        ))}
      </div>
    </aside>
  );
}
