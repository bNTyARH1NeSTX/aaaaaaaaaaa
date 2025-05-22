'use client'; // Needed for hooks and event handlers

import Link from 'next/link';
import { ArrowRight, Search, FileText, Database, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-16 px-4 md:py-24 text-center">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 text-neon-pink">
            Ragnar <span className="text-neon-cyan">Asistente</span>
          </h1>
          <p className="text-2xl mb-8 max-w-3xl mx-auto text-white">
            Genere manuales paso a paso desde archivos visuales e información técnica utilizando nuestro motor de inteligencia artificial avanzado.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link 
              href="/chat" 
              className="button"
            >
              Iniciar Conversación <ArrowRight size={18} className="ml-2" />
            </Link>
            <Link 
              href="/documents" 
              className="file-label"
            >
              Ver Documentos <FileText size={18} className="ml-2" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <motion.div
          className="max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl font-bold text-center mb-12 text-neon-purple">Funcionalidades Principales</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Zap size={24} className="text-neon-pink" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Consulta IA</h3>
              <p className="text-white">Realice preguntas complejas sobre sus documentos y reciba respuestas precisas con referencias a las fuentes.</p>
            </div>
            
            <div className="card">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Database size={24} className="text-neon-cyan" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Gestión de Documentos</h3>
              <p className="text-white">Suba, visualice y organice sus documentos, imágenes y archivos técnicos en un solo lugar.</p>
            </div>
            
            <div className="card">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Search size={24} className="text-neon-purple" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Búsqueda Vectorial</h3>
              <p className="text-white">Encuentre información relevante mediante búsqueda semántica avanzada en todos sus documentos.</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 text-center">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl font-bold mb-6 text-neon-pink">Comience a Generar Manuales Ahora</h2>
          <p className="text-xl mb-8 text-white">Suba sus archivos y deje que nuestra IA cree manuales completos paso a paso.</p>
          <Link 
            href="/chat" 
            className="button"
          >
            Ir al Chat <ArrowRight size={18} className="ml-2" />
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
