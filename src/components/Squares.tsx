import React, { useEffect, useRef } from 'react';
import './Squares.css';

const Squares: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const squares: Array<{
      x: number;
      y: number;
      size: number;
      opacity: number;
      speed: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createSquare = () => {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 20 + 10,
        opacity: Math.random() * 0.3 + 0.1,
        speed: Math.random() * 0.5 + 0.2,
      };
    };

    const initSquares = () => {
      squares.length = 0;
      const numSquares = Math.floor((canvas.width * canvas.height) / 10000);
      for (let i = 0; i < numSquares; i++) {
        squares.push(createSquare());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      squares.forEach((square) => {
        ctx.fillStyle = `rgba(59, 130, 246, ${square.opacity})`;
        ctx.fillRect(square.x, square.y, square.size, square.size);

        square.y -= square.speed;
        if (square.y + square.size < 0) {
          square.y = canvas.height + square.size;
          square.x = Math.random() * canvas.width;
        }
      });

      requestAnimationFrame(animate);
    };

    resizeCanvas();
    initSquares();
    animate();

    const handleResize = () => {
      resizeCanvas();
      initSquares();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="squares-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default Squares;