import React, { useEffect, useRef } from 'react';
import './Squares.css';

interface SquaresProps {
  direction?: 'diagonal' | 'up' | 'right' | 'down' | 'left';
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
}

const Squares: React.FC<SquaresProps> = ({
  direction = 'right',
  speed = 1,
  borderColor = '#999',
  squareSize = 40,
  hoverFillColor = '#222'
}) => {
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
      speedX: number;
      speedY: number;
      isHovered: boolean;
    }> = [];

    let mouseX = 0;
    let mouseY = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const getMovementVector = () => {
      switch (direction) {
        case 'up':
          return { x: 0, y: -1 };
        case 'down':
          return { x: 0, y: 1 };
        case 'left':
          return { x: -1, y: 0 };
        case 'right':
          return { x: 1, y: 0 };
        case 'diagonal':
          return { x: 1, y: -1 };
        default:
          return { x: 1, y: 0 };
      }
    };

    const createSquare = () => {
      const movement = getMovementVector();
      const baseSpeed = (Math.random() * 0.5 + 0.2) * speed;
      
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: squareSize,
        opacity: Math.random() * 0.3 + 0.1,
        speedX: movement.x * baseSpeed,
        speedY: movement.y * baseSpeed,
        isHovered: false,
      };
    };

    const initSquares = () => {
      squares.length = 0;
      const numSquares = Math.floor((canvas.width * canvas.height) / (squareSize * squareSize * 4));
      for (let i = 0; i < numSquares; i++) {
        squares.push(createSquare());
      }
    };

    const checkHover = (square: typeof squares[0]) => {
      return mouseX >= square.x && 
             mouseX <= square.x + square.size && 
             mouseY >= square.y && 
             mouseY <= square.y + square.size;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      squares.forEach((square) => {
        square.isHovered = checkHover(square);
        
        // Draw square with border
        if (square.isHovered) {
          ctx.fillStyle = hoverFillColor;
          ctx.fillRect(square.x, square.y, square.size, square.size);
        }
        
        ctx.strokeStyle = `${borderColor}${Math.floor(square.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1;
        ctx.strokeRect(square.x, square.y, square.size, square.size);

        // Move square
        square.x += square.speedX;
        square.y += square.speedY;

        // Reset position when square goes off screen
        if (square.x + square.size < 0) {
          square.x = canvas.width + square.size;
        } else if (square.x > canvas.width + square.size) {
          square.x = -square.size;
        }
        
        if (square.y + square.size < 0) {
          square.y = canvas.height + square.size;
        } else if (square.y > canvas.height + square.size) {
          square.y = -square.size;
        }
      });

      requestAnimationFrame(animate);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };

    resizeCanvas();
    initSquares();
    animate();

    const handleResize = () => {
      resizeCanvas();
      initSquares();
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [direction, speed, borderColor, squareSize, hoverFillColor]);

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
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  );
};

export default Squares;