'use client'; // Needed for hooks and event handlers

import Link from 'next/link';
import { ArrowRight, Search, FileText, Database, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="py-16 px-4 md:py-24 text-center bg-gradient-to-br from-brand-light via-background to-background dark:from-brand-dark dark:via-background">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 text-brand-primary dark:text-brand-light">
            Ragnar <span className="text-primary">Asistente</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-muted-foreground">
            Genere manuales paso a paso desde archivos visuales e información técnica utilizando nuestro motor de inteligencia artificial avanzado.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-background transition-colors duration-150 ease-in-out shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              Iniciar Conversación <ArrowRight size={20} className="ml-2" />
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center justify-center px-8 py-3 border border-border text-base font-medium rounded-md text-primary bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary dark:text-primary-foreground dark:bg-secondary dark:hover:bg-secondary/80 dark:focus:ring-offset-background transition-colors duration-150 ease-in-out shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              Ver Documentos <FileText size={20} className="ml-2" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-background">
        <motion.div
          className="max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-brand-primary dark:text-brand-light">
            Funcionalidades Principales
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 justify-items-center"> {/* Increased gap and centered items */}
            {/* Feature Card 1 */}
            <motion.div 
              className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-8 rounded-xl shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col items-start w-full max-w-sm"
              whileHover={{ scale: 1.03 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 ring-4 ring-white/30">
                <Zap size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Consulta IA</h3>
              <p className="text-indigo-100 text-sm flex-grow">Realice preguntas complejas sobre sus documentos y reciba respuestas precisas con referencias a las fuentes.</p>
            </motion.div>
            
            {/* Feature Card 2 */}
            <motion.div 
              className="bg-gradient-to-br from-sky-500 to-cyan-600 text-white p-8 rounded-xl shadow-2xl hover:shadow-sky-500/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col items-start w-full max-w-sm"
              whileHover={{ scale: 1.03 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 ring-4 ring-white/30">
                <Database size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Gestión de Documentos</h3>
              <p className="text-cyan-100 text-sm flex-grow">Suba, visualice y organice sus documentos, imágenes y archivos técnicos en un solo lugar.</p>
            </motion.div>
            
            {/* Feature Card 3 */}
            <motion.div 
              className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-8 rounded-xl shadow-2xl hover:shadow-amber-500/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col items-start w-full max-w-sm"
              whileHover={{ scale: 1.03 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 ring-4 ring-white/30">
                <Search size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Búsqueda Vectorial</h3>
              <p className="text-orange-100 text-sm flex-grow">Encuentre información relevante mediante búsqueda semántica avanzada en todos sus documentos.</p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 text-center bg-gradient-to-tr from-brand-light via-background to-background dark:from-brand-dark dark:via-background">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-brand-primary dark:text-brand-light">Comience a Generar Manuales Ahora</h2>
          <p className="text-lg md:text-xl mb-10 text-muted-foreground">Suba sus archivos y deje que nuestra IA cree manuales completos paso a paso.</p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center px-10 py-4 border border-transparent text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 ease-in-out shadow-lg hover:shadow-blue-500/50 transform hover:scale-105 w-full sm:w-auto"
          >
            Ir al Chat <ArrowRight size={24} className="ml-3" />
          </Link>
        </motion.div>
      </section>
    </main>
  );
}
