"use client";

import Link from 'next/link';
import React from 'react';
import { 
  Home, 
  MessageSquare, 
  FileText, 
  Search, 
  BookOpen, 
  BarChart2, 
  Settings, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

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
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Manuals', href: '/manuals', icon: BookOpen },
  { label: 'Knowledge Graphs', href: '/graphs', icon: BarChart2 },
];

const FOOTER_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Navbar({ isOpen, toggleSidebar }: NavbarProps) {
  return (
    <aside 
      className={`${
        isOpen ? 'w-64' : 'w-[70px]'
      } min-h-screen fixed top-0 left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 ease-in-out flex flex-col z-50`}
    >
      {/* Header */}
      <div className={`p-4 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} border-b border-gray-200 dark:border-gray-700 h-16`}>
        {isOpen && (
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-semibold text-gray-800 dark:text-white">Morphik</span>
          </Link>
        )}
        <button 
          onClick={toggleSidebar} 
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
            className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {isOpen && (
              <span className="ml-3 text-sm font-medium">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        {FOOTER_ITEMS.map((item) => (
          <Link 
            key={item.label} 
            href={item.href}
            className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {isOpen && (
              <span className="ml-3 text-sm font-medium">{item.label}</span>
            )}
          </Link>
        ))}
      </div>
    </aside>
  );
}
