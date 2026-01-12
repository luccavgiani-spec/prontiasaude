import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Clock, Users } from "lucide-react";

const LPDoctorNotification = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show notification after 2 seconds
    const timer = setTimeout(() => {
      if (!isDismissed) {
        setIsVisible(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
  };

  const handleClick = () => {
    navigate("/entrar");
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-in slide-in-from-right duration-500"
      role="alert"
    >
      <div
        onClick={handleClick}
        className="bg-card rounded-xl shadow-2xl border border-border/50 p-4 max-w-xs cursor-pointer hover:shadow-3xl transition-all hover:scale-[1.02]"
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3">
          {/* Doctor Photo */}
          <div className="relative flex-shrink-0">
            <img
              src="https://prontia-landing-page-publicada.vercel.app/assets/dra-victoria-D_ZjWFi2.png"
              alt="Dra. Victória Toledo"
              className="w-12 h-12 rounded-full object-cover border-2 border-primary"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card"></span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground text-sm">
              Dra. Victória Toledo
            </h4>
            <p className="text-muted-foreground text-xs">
              Clínico Geral - CRMSP 260033
            </p>
            <p className="text-green-600 text-xs font-medium mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Disponível agora
            </p>
          </div>
        </div>

        {/* Queue info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>2 pessoas na fila</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>~6 min</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPDoctorNotification;
