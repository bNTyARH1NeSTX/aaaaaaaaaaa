import React from 'react';
import Link from 'next/link';
import { FaSearch, FaDatabase, FaPlus, FaBolt } from 'react-icons/fa';
import { GiReactor } from 'react-icons/gi';

// Simplified Feature component - styling to be done with CSS
const Feature = ({ title, text, icon, color }: { title: string; text: string; icon: React.ReactElement; color: string }) => {
  return (
    <div className="feature-card" style={{ borderColor: color }}>
      <div className="feature-icon-background" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-text">{text}</p>
    </div>
  );
};

export default function HomePage() {
  return (
    <div className="homepage-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container-7xl">
          <div className="hero-stack">
            <div className="hero-text-content">
              <h1 className="hero-heading">
                <span className="hero-brand-main">RAGnar</span>
                <br />
                <span className="hero-brand-sub">Intelligent ERP Documentation</span>
              </h1>
              <p className="hero-description">
                Powered by Morphik Core, RAGnar is your intelligent companion for BNext ERP documentation.
                Search with natural language, explore knowledge graphs, and get answers instantly - even
                from images, PDFs, and videos.
              </p>
              <div className="hero-buttons-stack">
                <Link href="/chat" className="button button-primary">Start Chatting</Link>
                <Link href="/search" className="button button-secondary">
                  <FaSearch /> Search Manuals
                </Link>
              </div>
            </div>
            <div className="hero-image-container">
              <div className="hero-image-wrapper">
                <img
                  alt="Hero Image"
                  src="/assets/hero-image.png"
                  className="hero-image"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-heading-stack">
          <h2 className="section-title">Powered by Morphik Core</h2>
          <p className="section-subtitle">
            Advanced features for intelligent documentation retrieval
          </p>
        </div>
        <div className="container-7xl">
          <div className="features-grid">
            <Feature
              icon={<FaSearch style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Multimodal Search'}
              text={'Search through images, PDFs, videos, and more with natural language queries powered by ColPali.'}
              color="blue"
            />
            <Feature
              icon={<GiReactor style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Knowledge Graphs'}
              text={'Explore domain-specific knowledge graphs that connect related concepts within your documentation.'}
              color="green"
            />
            <Feature
              icon={<FaDatabase style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Metadata Extraction'}
              text={'Extract and visualize metadata including bounding boxes, labels, classifications, and more.'}
              color="purple"
            />
            <Feature
              icon={<FaPlus style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Integrations'}
              text={'Connect with existing tools including Google Suite, Slack, and Confluence.'}
              color="orange"
            />
            <Feature
              icon={<FaBolt style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Cache-Augmented-Gen'}
              text={'Benefit from persistent KV-caches for faster response generation.'}
              color="red"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
