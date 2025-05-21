"use client";

import { FaTwitter, FaYoutube, FaGithub } from 'react-icons/fa';
import React, { ReactNode } from 'react';

const ListHeader = ({ children }: { children: ReactNode }) => {
  return (
    <h3 className="list-header">{children}</h3>
  );
};

const SocialButton = ({
  children,
  label,
  href,
}: {
  children: ReactNode;
  label: string;
  href: string;
}) => {
  return (
    <a href={href} aria-label={label} className="social-button">
      {children}
    </a>
  );
};

export default function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-content-container">
        <div className="footer-grid">
          <div className="footer-column footer-brand-column">
            <div>
              <h2 className="footer-brand-name">RAGnar</h2>
            </div>
            <p className="footer-copyright">
              © {new Date().getFullYear()} RAGnar. All rights reserved.
            </p>
          </div>
          <div className="footer-column">
            <ListHeader>Features</ListHeader>
            <a href="/search" className="footer-link">Vector Search</a>
            <a href="/documents" className="footer-link">Document Management</a>
            <a href="/graphs" className="footer-link">Knowledge Graphs</a>
            <a href="/chat" className="footer-link">AI Chat</a>
          </div>
          <div className="footer-column">
            <ListHeader>Resources</ListHeader>
            <a href="https://github.com/pgvector/pgvector" className="footer-link">pgvector</a>
            <a href="https://python.langchain.com/docs/modules/vectorstores" className="footer-link">Vector Stores</a>
            <a href="https://github.com/morphik-ai/morphik-core" className="footer-link">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
