"use client";

import React, { useState, useEffect } from 'react'; // Import useEffect
import Navbar from './Navbar';
// import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // Add isMounted state

  useEffect(() => {
    setIsMounted(true); // Set isMounted to true after component mounts
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div 
        className={`flex-1 flex flex-col overflow-auto transition-all duration-300 ease-in-out`}
        style={{ marginLeft: isSidebarOpen ? '16rem' : '4.375rem' }}
      >
        <main className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </main>
        {/* <Footer /> */}
      </div>
    </div>
  );
};

export default Layout;
