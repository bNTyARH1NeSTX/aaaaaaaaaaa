"use client";

import NextLink from 'next/link';
import { FaSearch } from 'react-icons/fa';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => setIsOpen(!isOpen);

  return (
    <nav className="navbar-container">
      <div className="navbar-flex-container">
        <div className="mobile-menu-button-container">
          <button onClick={onToggle} aria-label="Toggle Navigation" className="mobile-menu-button">
            {isOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <div className="navbar-brand-container">
          <NextLink href="/" className="navbar-brand-link">
            <span className="navbar-brand-text">RAGnar</span>
          </NextLink>

          <div className="desktop-nav-container">
            <DesktopNav />
          </div>
        </div>

        <div className="navbar-actions-container">
          <NextLink href="/search" className="multimodal-search-link">
            <span><FaSearch /> Vector Search</span>
          </NextLink>
        </div>
      </div>
      {isOpen && (
        <div className="mobile-nav-container">
          <MobileNav />
        </div>
      )}
    </nav>
  );
}

const DesktopNav = () => {
  return (
    <div className="desktop-nav-stack">
      {NAV_ITEMS.map((navItem) => (
        <div key={navItem.label} className="desktop-nav-item-container">
          {navItem.children ? (
            <div className="popover-container">
              <NextLink href={navItem.href ?? '#'} className="desktop-nav-link">
                {navItem.label}
              </NextLink>
              <div className="popover-content">
                <div className="desktop-subnav-stack">
                  {navItem.children.map((child) => (
                    <DesktopSubNav key={child.label} {...child} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <NextLink href={navItem.href ?? '#'} className="desktop-nav-link">
              {navItem.label}
            </NextLink>
          )}
        </div>
      ))}
    </div>
  );
};

const DesktopSubNav = ({ label, href, subLabel }: NavItem) => {
  return (
    <NextLink href={href ?? '#'} className="desktop-subnav-link">
      <div className="desktop-subnav-content">
        <div>
          <div className="desktop-subnav-label">{label}</div>
          {subLabel && <div className="desktop-subnav-sublabel">{subLabel}</div>}
        </div>
      </div>
    </NextLink>
  );
};

const MobileNav = () => {
  return (
    <div className="mobile-nav-stack">
      {NAV_ITEMS.map((navItem) => (
        <MobileNavItem key={navItem.label} {...navItem} />
      ))}
    </div>
  );
};

const MobileNavItem = ({ label, children, href }: NavItem) => {
  const [isSubOpen, setIsSubOpen] = useState(false);
  const onSubToggle = () => setIsSubOpen(!isSubOpen);

  return (
    <div className="mobile-nav-item-stack">
      <div onClick={children && onSubToggle} className="mobile-nav-item-flex">
        <NextLink href={href ?? '#'} className="mobile-nav-item-link">
          <span className="mobile-nav-item-label">{label}</span>
        </NextLink>
        {children && (
          <span className="mobile-nav-item-chevron">{isSubOpen ? 'Up' : 'Down'}</span>
        )}
      </div>
      {isSubOpen && children && (
        <div className="mobile-subnav-stack">
          {children.map((child) => (
            <NextLink
              key={child.label}
              href={child.href ?? '#'}
              className="mobile-subnav-link"
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
}

const NAV_ITEMS: Array<NavItem> = [
  {
    label: 'Home',
    href: '/',
  },
  {
    label: 'Features',
    href: '#',
    children: [
      {
        label: 'Vector Search',
        subLabel: 'Search with pgvector embeddings',
        href: '/search',
      },
      {
        label: 'Document Management',
        subLabel: 'Upload and manage document corpus',
        href: '/documents',
      },
      {
        label: 'Knowledge Graph',
        subLabel: 'Create and explore knowledge graphs',
        href: '/graphs',
      },
      {
        label: 'Chat',
        subLabel: 'AI assistant using your documents',
        href: '/chat',
      },
    ],
  },
  {
    label: 'About',
    href: '/about',
  },
];
