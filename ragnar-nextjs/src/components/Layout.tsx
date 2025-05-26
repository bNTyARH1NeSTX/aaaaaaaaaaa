"use client";

import React, { useState } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <main 
        className={`transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'ml-64' : 'ml-[70px]'
        }`}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
