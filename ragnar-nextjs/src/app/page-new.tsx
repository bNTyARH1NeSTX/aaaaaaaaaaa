import React from 'react';
import Link from 'next/link';
import { FaSearch, FaDatabase, FaNetworkWired, FaRobot, FaFileUpload } from 'react-icons/fa';

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
                <span className="hero-brand-sub">Vector Embeddings & Knowledge Graphs</span>
              </h1>
              <p className="hero-description">
                Powered by pgvector and semantic search, RAGnar is your intelligent document retrieval system.
                Search with natural language, explore knowledge graphs, and get answers from your own documents
                instantly using embeddings and vector similarity.
              </p>
              <div className="hero-buttons-stack">
                <Link href="/documents" className="button button-primary">Upload Documents</Link>
                <Link href="/search" className="button button-secondary">
                  <FaSearch /> Vector Search
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
          <h2 className="section-title">Powered by pgvector & Embeddings</h2>
          <p className="section-subtitle">
            Advanced features for intelligent document retrieval
          </p>
        </div>
        <div className="container-7xl">
          <div className="features-grid">
            <Feature
              icon={<FaSearch style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Vector Search'}
              text={'Search your documents using semantic similarity with embeddings stored in pgvector.'}
              color="blue"
            />
            <Feature
              icon={<FaNetworkWired style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Knowledge Graphs'}
              text={'Automatically extract entities and relationships from your documents to build searchable knowledge graphs.'}
              color="green"
            />
            <Feature
              icon={<FaFileUpload style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Document Management'}
              text={'Upload and manage your document corpus with automatic chunking and embedding generation.'}
              color="purple"
            />
            <Feature
              icon={<FaRobot style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'AI Assistant'}
              text={'Get answers to your questions using retrieval-augmented generation from your own documents.'}
              color="orange"
            />
            <Feature
              icon={<FaDatabase style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />}
              title={'Enterprise Integration'}
              text={'Easily connect to existing database systems with scalable PostgreSQL-based vector store.'}
              color="red"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
