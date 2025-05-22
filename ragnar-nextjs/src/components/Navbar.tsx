"use client";

import NextLink from 'next/link';
import { Search, Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-white shadow-md dark:bg-gray-800 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={onToggle} aria-label="Toggle Navigation" className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center">
            <NextLink href="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">Morphik</span>
            </NextLink>

            <div className="hidden md:flex md:ml-10">
              <DesktopNav />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex items-center">
            <NextLink href="/search" className="flex items-center text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
              <Search className="mr-2" size={18} />
              <span>Búsqueda</span>
            </NextLink>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden mt-4 pb-2">
            <MobileNav />
          </div>
        )}
      </div>
    </nav>
  );
}

const DesktopNav = () => {
  return (
    <div className="flex space-x-4">
      {NAV_ITEMS.map((navItem) => (
        <div key={navItem.label} className="relative group">
          {navItem.children ? (
            <div>
              <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-md">
                {navItem.label}
                <ChevronDown className="ml-1" size={16} />
              </button>
              <div className="absolute z-10 left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="py-1">
                  {navItem.children.map((child) => (
                    <DesktopSubNav key={child.label} {...child} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <NextLink href={navItem.href ?? '#'} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-md">
              {navItem.label}
            </NextLink>
          )}
        </div>
      ))}
    </div>
  );
};

const DesktopSubNav = ({ label, href, subLabel, target }: NavItem) => {
  return (
    <NextLink 
      href={href ?? '#'} 
      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
      target={target}
    >
      <div>
        <div className="font-medium">{label}</div>
        {subLabel && <div className="mt-1 text-xs text-gray-500">{subLabel}</div>}
      </div>
    </NextLink>
  );
};

const MobileNav = () => {
  return (
    <div className="space-y-1 px-2 pb-3 pt-2">
      {NAV_ITEMS.map((navItem) => (
        <MobileNavItem key={navItem.label} {...navItem} />
      ))}
    </div>
  );
};

const MobileNavItem = ({ label, children, href, target }: NavItem) => {
  const [isSubOpen, setIsSubOpen] = useState(false);
  const onSubToggle = () => setIsSubOpen(!isSubOpen);

  return (
    <div className="py-1">
      <div onClick={children ? onSubToggle : undefined} className="flex justify-between items-center px-3 py-2 text-base font-medium rounded-md cursor-pointer text-gray-700 hover:bg-blue-50 hover:text-blue-600">
        <NextLink href={children ? '#' : (href ?? '#')} className="flex-1" target={target}>
          {label}
        </NextLink>
        {children && (
          <span className="text-gray-400">
            {isSubOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        )}
      </div>
      {isSubOpen && children && (
        <div className="ml-4 mt-1 space-y-1">
          {children.map((child) => (
            <NextLink
              key={child.label}
              href={child.href ?? '#'}
              className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-md"
              target={child.target}
            >
              {child.label}
            </NextLink>
          ))}
        </div>
      )}
    </div>
  );
};

interface NavItem {
  label: string;
  subLabel?: string;
  children?: Array<NavItem>;
  href?: string;
  key?: string;
  target?: string;
}

const NAV_ITEMS: Array<NavItem> = [
  {
    label: 'Inicio',
    href: '/',
  },
  {
    label: 'Chat',
    href: '/chat',
  },
  {
    label: 'Documentos',
    href: '/documents',
  },
  {
    label: 'Búsqueda',
    href: '/search',
  },
  {
    label: 'Recursos',
    children: [
      {
        label: 'Generación de Manuales',
        subLabel: 'Crea manuales con IA',
        href: '/manuals',
      },
      {
        label: 'Grafos de Conocimiento',
        subLabel: 'Visualiza relaciones entre documentos',
        href: '/graphs/page-simple',
      },
      {
        label: 'Documentación',
        subLabel: 'API y guías de integración',
        href: 'https://github.com/morphik-io/morphik',
        target: '_blank'
      },
      {
        label: 'Acerca de Morphik',
        subLabel: 'Conozca nuestra tecnología',
        href: '/about',
      },
    ],
  },
];
