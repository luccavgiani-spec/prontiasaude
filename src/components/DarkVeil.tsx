import React, { useEffect, useRef } from 'react';
import { Renderer, Camera, Transform, Plane, Program, Mesh, Vec2 } from 'ogl';
import './DarkVeil.css';

interface DarkVeilProps {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  speed?: number;
  resolutionScale?: number;
}

const DarkVeil: React.FC<DarkVeilProps> = ({
  hueShift = 0,
  noiseIntensity = 0,
  scanlineIntensity = 0,
  scanlineFrequency = 0,
  warpAmount = 0,
  speed = 0.5,
  resolutionScale = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new Renderer({
      canvas,
      width: canvas.offsetWidth * resolutionScale,
      height: canvas.offsetHeight * resolutionScale,
      dpr: Math.min(window.devicePixelRatio, 2),
    });

    rendererRef.current = renderer;
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const camera = new Camera(gl);
    camera.position.z = 1;

    const scene = new Transform();

    const geometry = new Plane(gl);

    const vertexShader = `
      attribute vec2 uv;
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0, 1);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float time;
      uniform vec2 resolution;
      uniform float hueShift;
      uniform float noiseIntensity;
      uniform float scanlineIntensity;
      uniform float scanlineFrequency;
      uniform float warpAmount;
      varying vec2 vUv;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        vec2 st = vUv;
        
        // Warp effect
        st += warpAmount * sin(st.yx * 10.0 + time) * 0.1;
        
        // Base dark color
        vec3 color = vec3(0.05, 0.05, 0.1);
        
        // Add some subtle variation
        float n = noise(st * 5.0 + time * 0.1);
        color += n * 0.1;
        
        // Hue shift
        if (hueShift > 0.0) {
          vec3 hsv = vec3(hueShift / 360.0, 0.3, 0.2);
          color += hsv2rgb(hsv) * 0.5;
        }
        
        // Noise effect
        if (noiseIntensity > 0.0) {
          float noise_val = random(st + time) * noiseIntensity;
          color += noise_val;
        }
        
        // Scanlines
        if (scanlineIntensity > 0.0 && scanlineFrequency > 0.0) {
          float scanline = sin(st.y * scanlineFrequency) * scanlineIntensity;
          color += scanline;
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new Vec2(canvas.offsetWidth, canvas.offsetHeight) },
        hueShift: { value: hueShift },
        noiseIntensity: { value: noiseIntensity },
        scanlineIntensity: { value: scanlineIntensity },
        scanlineFrequency: { value: scanlineFrequency },
        warpAmount: { value: warpAmount },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);

    const resize = () => {
      const width = canvas.offsetWidth * resolutionScale;
      const height = canvas.offsetHeight * resolutionScale;
      renderer.setSize(width, height);
      program.uniforms.resolution.value.set(width, height);
    };

    const animate = (time: number) => {
      program.uniforms.time.value = time * 0.001 * speed;
      renderer.render({ scene, camera });
      animationRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate(0);

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, [hueShift, noiseIntensity, scanlineIntensity, scanlineFrequency, warpAmount, speed, resolutionScale]);

  return (
    <canvas
      ref={canvasRef}
      className="dark-veil-canvas"
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

export default DarkVeil;