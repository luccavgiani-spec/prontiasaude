import { useState, useEffect } from "react";
import { X, Users, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const PADoctorNotification = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [queueCount, setQueueCount] = useState(2);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Simula variação na fila
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueCount(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newCount = prev + change;
        return Math.max(1, Math.min(4, newCount));
      });
    }, 45000); // Atualiza a cada 45 segundos

    return () => clearInterval(interval);
  }, []);

  const waitTime = queueCount * 3; // ~3 min por pessoa

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 100, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.8 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4">
            <div className="flex items-start gap-4">
              <a
                href="/entrar"
                className="flex items-center gap-4 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">DV</span>
                  </div>
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-card rounded-full animate-pulse" />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Dra. Victória Toledo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clínico Geral - CRMSP 260033
                  </p>
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Disponível agora
                  </p>
                </div>
              </a>

              <button
                onClick={() => setIsVisible(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Queue Info */}
            <a
              href="/entrar"
              className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <motion.span
                  key={queueCount}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-medium text-foreground"
                >
                  {queueCount}
                </motion.span>
                <span>{queueCount === 1 ? "pessoa" : "pessoas"} na fila</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>~{waitTime} min</span>
              </div>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PADoctorNotification;
