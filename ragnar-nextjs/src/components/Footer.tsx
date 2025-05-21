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
            <div className="social-links-container">
              <SocialButton label={'Twitter'} href={'#'}>
                <FaTwitter />
              </SocialButton>
              <SocialButton label={'YouTube'} href={'#'}>
                <FaYoutube />
              </SocialButton>
              <SocialButton label={'GitHub'} href={'#'}>
                <FaGithub />
              </SocialButton>
            </div>
          </div>
          <div className="footer-column">
            <ListHeader>Company</ListHeader>
            <a href={'#'} className="footer-link">About</a>
            <a href={'#'} className="footer-link">Careers</a>
            <a href={'#'} className="footer-link">Contact</a>
          </div>
          <div className="footer-column">
            <ListHeader>Support</ListHeader>
            <a href={'#'} className="footer-link">Help Center</a>
            <a href={'#'} className="footer-link">Terms of Service</a>
            <a href={'#'} className="footer-link">Privacy Policy</a>
          </div>
          <div className="footer-column">
            <ListHeader>Stay Connected</ListHeader>
            <p>Subscribe to our newsletter to get the latest updates</p>
            {/* Add newsletter signup form here if needed */}
          </div>
        </div>
      </div>
    </footer>
  );
}
