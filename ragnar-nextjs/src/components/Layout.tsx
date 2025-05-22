"use client"; // Add this if Navbar or Footer become client components or if Layout uses client hooks

import React, { useState } from 'react';
import Navbar from './Navbar';
// import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100"> {/* Ensure parent has a background */}
      <Navbar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-auto"> {/* Removed ml-x, bg-gray-100 moved to parent or here */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
        {/* <Footer /> */}
      </div>
    </div>
  );
};

export default Layout;
