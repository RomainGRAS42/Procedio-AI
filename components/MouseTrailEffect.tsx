
import React, { useEffect, useRef } from 'react';

const MouseTrailEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let lastMoveTime = Date.now();
    let isIdle = false;
    let isFormationAssigned = false;
    let time = 0;

    const particleCount = 1000;
    const idleThreshold = 600;
    const textToForm = "MDI";
    const fontSize = 100;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; baseOpacity: number;
      angle: number; phase: number;
      targetX: number | null; targetY: number | null;
    }

    const particles: Particle[] = [];
    let textPoints: {x: number, y: number}[] = [];

    const initTextPoints = () => {
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;
        offCanvas.width = 400; offCanvas.height = 200;
        offCtx.fillStyle = 'white';
        offCtx.font = `900 ${fontSize}px sans-serif`;
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillText(textToForm, offCanvas.width / 2, offCanvas.height / 2);
        const data = offCtx.getImageData(0, 0, 400, 200).data;
        textPoints = [];
        for (let y = 0; y < 200; y += 3) {
            for (let x = 0; x < 400; x += 3) {
                if (data[(y * 400 + x) * 4 + 3] > 128) {
                    textPoints.push({ x: x - 200, y: y - 100 });
                }
            }
        }
    };

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
          vx: 0, vy: 0, size: Math.random() * 1.5 + 0.5,
          color: Math.random() > 0.94 ? '79, 70, 229' : '255, 255, 255',
          baseOpacity: Math.random() * 0.2 + 0.05, angle: 0, phase: Math.random() * Math.PI * 2,
          targetX: null, targetY: null
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      lastMoveTime = Date.now();
      if (isIdle) {
          isIdle = false; isFormationAssigned = false;
          particles.forEach(p => { p.targetX = null; p.targetY = null; p.vx = (Math.random() - 0.5) * 10; p.vy = (Math.random() - 0.5) * 10; });
      }
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      if (!isIdle && Date.now() - lastMoveTime > idleThreshold) {
          isIdle = true;
          if (!isFormationAssigned && textPoints.length > 0) {
              const shuffled = [...textPoints].sort(() => Math.random() - 0.5);
              particles.forEach((p, i) => { if (i < shuffled.length) { p.targetX = shuffled[i].x; p.targetY = shuffled[i].y; }});
              isFormationAssigned = true;
          }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.002;
      particles.forEach(p => {
        const breath = (Math.sin(p.phase + time * 0.5) + 1) / 2;
        if (isIdle && p.targetX !== null) {
            const dx = (mouse.x + p.targetX) - p.x; const dy = (mouse.y + p.targetY) - p.y;
            p.vx = (p.vx + dx * 0.05) * 0.8; p.vy = (p.vy + dy * 0.05) * 0.8;
            p.x += p.vx; p.y += p.vy;
        } else {
            const flowAngle = Math.cos(p.x * 0.0015 + time) * Math.PI;
            p.vx = Math.cos(flowAngle) * 0.5; p.vy = Math.sin(flowAngle) * 0.5;
            p.x += p.vx; p.y += p.vy;
            if (p.x < -10) p.x = canvas.width + 10; if (p.x > canvas.width + 10) p.x = -10;
            if (p.y < -10) p.y = canvas.height + 10; if (p.y > canvas.height + 10) p.y = -10;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.8 + 0.4 * breath), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${isIdle && p.targetX ? 0.8 : p.baseOpacity * (0.6 + 0.8 * breath)})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('mousemove', handleMouseMove);
    handleResize();
    initTextPoints(); initParticles(); draw();
    function handleResize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationFrameId); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 mix-blend-screen" />;
};

export default MouseTrailEffect;
