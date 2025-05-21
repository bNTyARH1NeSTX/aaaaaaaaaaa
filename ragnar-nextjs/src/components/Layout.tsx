"use client"; // Add this if Navbar or Footer become client components or if Layout uses client hooks

import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="layout-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main className="main-container" style={{ flex: '1', padding: '2rem 1rem' }}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
