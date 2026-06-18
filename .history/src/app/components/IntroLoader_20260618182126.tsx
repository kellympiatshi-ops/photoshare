import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Camera } from 'lucide-react';

interface IntroLoaderProps {
  onComplete: () => void;
}

export function IntroLoader({ onComplete }: IntroLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animation de la progression
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Redirection après 3 secondes
    const timeout = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-black flex items-center justify-center overflow-hidden">
      {/* Grille futuriste en arrière-plan */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(59, 130, 246, 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Cercles lumineux animés */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-20"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.2, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo appareil photo avec animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            duration: 1
          }}
          className="relative"
        >
          {/* Cercle extérieur animé */}
          <motion.div
            className="absolute inset-0 -m-8"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <svg width="160" height="160" className="absolute inset-0">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="url(#gradient1)"
                strokeWidth="2"
                strokeDasharray="10 5"
              />
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          {/* Cercle intérieur pulsant */}
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/50"
            animate={{
              boxShadow: [
                "0 0 20px rgba(59, 130, 246, 0.5)",
                "0 0 40px rgba(59, 130, 246, 0.8)",
                "0 0 20px rgba(59, 130, 246, 0.5)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Camera className="w-12 h-12 text-white" strokeWidth={2} />
          </motion.div>
        </motion.div>

        {/* Nom du site */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            photoshare
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-2"
          />
        </motion.div>

        {/* Texte initialisation */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-blue-300 tracking-widest text-sm uppercase"
        >
          Initialisation...
        </motion.p>

        {/* Barres de progression */}
        <div className="w-80 space-y-3">
          {/* Barre principale */}
          <div className="relative h-2 bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-blue-900/30">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-100%', '200%']
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </motion.div>
          </div>

          {/* Barres secondaires décoratives */}
          <div className="flex gap-2">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="flex-1 h-1 bg-slate-800/50 rounded-full overflow-hidden border border-blue-900/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: progress > (i * 12.5) ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Pourcentage */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-blue-400 font-mono text-xl"
        >
          {Math.round(progress)}%
        </motion.div>

        {/* Particules flottantes */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0]
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
