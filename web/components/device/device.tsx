"use client";

import React, { useRef, useEffect, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ReactLenis } from "lenis/react";
import { cn } from "@/lib/utils";

export interface DeviceProps {
  /** Image URL shown inside the screen */
  image?: string;
  /** Scale the whole device (default: 1) */
  scale?: number;
  /** Allow vertical scrolling inside the screen */
  isScrollable?: boolean;
  /** Enable parallax layer movement on hover */
  enableParallax?: boolean;
  /** Parallax movement strength in px (default: 15) */
  parallaxStrength?: number;
  /** Enable 3-axis rotation on hover */
  enableRotate?: boolean;
  /** Rotation strength in degrees (default: 3) */
  rotateStrength?: number;
  /** Auto-animate with a simulated figure-8 cursor */
  autoAnimate?: boolean;
  /** Custom content rendered inside the screen instead of an image */
  children?: React.ReactNode;
  className?: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const DEVICE_W = 320;
const DEVICE_H = 650;
const BORDER_RADIUS = 48;
const NOTCH_W = 110;
const NOTCH_H = 30;
const SCREEN_INSET = 14; // bezel thickness

// ─── helpers ──────────────────────────────────────────────────────────────────

function useParallaxSpring(strength: number): [MotionValue<number>, MotionValue<number>, (x: number, y: number) => void, () => void] {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 120, damping: 20, mass: 0.6 });
  const springY = useSpring(rawY, { stiffness: 120, damping: 20, mass: 0.6 });

  const move = useCallback((x: number, y: number) => {
    rawX.set(x * strength);
    rawY.set(y * strength);
  }, [rawX, rawY, strength]);

  const reset = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return [springX, springY, move, reset];
}

function useRotateSpring(strength: number): [MotionValue<number>, MotionValue<number>, MotionValue<number>, (x: number, y: number) => void, () => void] {
  const rawRX = useMotionValue(0);
  const rawRY = useMotionValue(0);
  const rawRZ = useMotionValue(0);
  const rotX = useSpring(rawRX, { stiffness: 150, damping: 22, mass: 0.5 });
  const rotY = useSpring(rawRY, { stiffness: 150, damping: 22, mass: 0.5 });
  const rotZ = useSpring(rawRZ, { stiffness: 150, damping: 22, mass: 0.5 });

  const move = useCallback((nx: number, ny: number) => {
    rawRX.set(-ny * strength);
    rawRY.set(nx * strength);
    rawRZ.set(nx * (strength * 0.4));
  }, [rawRX, rawRY, rawRZ, strength]);

  const reset = useCallback(() => {
    rawRX.set(0);
    rawRY.set(0);
    rawRZ.set(0);
  }, [rawRX, rawRY, rawRZ]);

  return [rotX, rotY, rotZ, move, reset];
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Device({
  image,
  scale = 1,
  isScrollable = false,
  enableParallax = true,
  parallaxStrength = 15,
  enableRotate = true,
  rotateStrength = 3,
  autoAnimate = false,
  children,
  className,
}: DeviceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  const [pX, pY, movePara, resetPara] = useParallaxSpring(parallaxStrength);
  const [rotX, rotY, rotZ, moveRot, resetRot] = useRotateSpring(rotateStrength);

  // ── auto-animate figure-8 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!autoAnimate) return;

    const tick = (ts: number) => {
      const t = ts * 0.0008;
      tRef.current = t;
      // Lissajous figure-8: x = sin(2t), y = sin(t)
      const nx = Math.sin(2 * t) * 0.8;
      const ny = Math.sin(t) * 0.8;
      if (enableParallax) movePara(nx, ny);
      if (enableRotate) moveRot(nx, ny);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoAnimate, enableParallax, enableRotate, movePara, moveRot]);

  // ── mouse tracking ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (autoAnimate) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (enableParallax) movePara(nx, ny);
    if (enableRotate) moveRot(nx, ny);
  }, [autoAnimate, enableParallax, enableRotate, movePara, moveRot]);

  const handleMouseLeave = useCallback(() => {
    if (autoAnimate) return;
    resetPara();
    resetRot();
  }, [autoAnimate, resetPara, resetRot]);

  // ── derived transform strings ─────────────────────────────────────────────
  const transform = useTransform(
    [rotX, rotY, rotZ],
    ([rx, ry, rz]) =>
      `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
  );

  const screenW = DEVICE_W - SCREEN_INSET * 2;
  const screenH = DEVICE_H - SCREEN_INSET * 2;

  return (
    <div
      ref={containerRef}
      className={cn("inline-flex items-center justify-center select-none", className)}
      style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Outer motion wrapper — rotation */}
      <motion.div
        style={{
          transform,
          width: DEVICE_W * scale,
          height: DEVICE_H * scale,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Parallax inner layer */}
        <motion.div
          style={{
            x: enableParallax ? pX : 0,
            y: enableParallax ? pY : 0,
            width: DEVICE_W * scale,
            height: DEVICE_H * scale,
            position: "relative",
          }}
        >
          {/* ── Phone body ────────────────────────────────────────────── */}
          <div
            style={{
              width: DEVICE_W * scale,
              height: DEVICE_H * scale,
              borderRadius: BORDER_RADIUS * scale,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {/* Outer shell */}
            <div
              style={{
                width: DEVICE_W,
                height: DEVICE_H,
                borderRadius: BORDER_RADIUS,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
                background: "linear-gradient(145deg, #2a2a2e 0%, #1a1a1f 50%, #111115 100%)",
                boxShadow: [
                  "inset 0 1px 0 rgba(255,255,255,0.12)",
                  "inset 0 -1px 0 rgba(0,0,0,0.5)",
                  "inset 1px 0 0 rgba(255,255,255,0.06)",
                  "inset -1px 0 0 rgba(0,0,0,0.3)",
                  "0 40px 80px rgba(0,0,0,0.6)",
                  "0 0 0 1px rgba(255,255,255,0.08)",
                  "0 20px 40px rgba(0,0,0,0.4)",
                ].join(", "),
              }}
            >
              {/* Side buttons — power */}
              <div style={{
                position: "absolute",
                right: -3,
                top: 140,
                width: 4,
                height: 56,
                borderRadius: 2,
                background: "linear-gradient(to bottom, #2e2e34, #1e1e24)",
                boxShadow: "inset 1px 0 0 rgba(255,255,255,0.08)",
              }} />
              {/* Volume up */}
              <div style={{
                position: "absolute",
                left: -3,
                top: 120,
                width: 4,
                height: 36,
                borderRadius: 2,
                background: "linear-gradient(to bottom, #2e2e34, #1e1e24)",
                boxShadow: "inset -1px 0 0 rgba(255,255,255,0.08)",
              }} />
              {/* Volume down */}
              <div style={{
                position: "absolute",
                left: -3,
                top: 168,
                width: 4,
                height: 36,
                borderRadius: 2,
                background: "linear-gradient(to bottom, #2e2e34, #1e1e24)",
                boxShadow: "inset -1px 0 0 rgba(255,255,255,0.08)",
              }} />

              {/* Screen cutout */}
              <div
                style={{
                  position: "absolute",
                  top: SCREEN_INSET,
                  left: SCREEN_INSET,
                  width: screenW,
                  height: screenH,
                  borderRadius: BORDER_RADIUS - SCREEN_INSET,
                  overflow: "hidden",
                  background: "#080810",
                }}
              >
                {/* Screen content */}
                {isScrollable ? (
                  <ReactLenis
                    options={{ duration: 1.4, smoothWheel: true }}
                    style={{ height: "100%", overflow: "hidden" }}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt="device screen"
                        style={{ width: "100%", display: "block" }}
                        draggable={false}
                      />
                    ) : (
                      children
                    )}
                  </ReactLenis>
                ) : image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt="device screen"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    draggable={false}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%" }}>
                    {children}
                  </div>
                )}

                {/* Dynamic island */}
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: NOTCH_W,
                    height: NOTCH_H,
                    borderRadius: NOTCH_H / 2,
                    background: "#000",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 10,
                    gap: 5,
                  }}
                >
                  {/* Front camera dot */}
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, #1a3a5c, #0a1a2c)",
                    boxShadow: "0 0 4px rgba(30,100,200,0.3)",
                  }} />
                </div>

                {/* Screen glass gloss */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)",
                  pointerEvents: "none",
                  borderRadius: "inherit",
                  zIndex: 20,
                }} />
              </div>

              {/* Body glass highlight */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: BORDER_RADIUS,
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
                pointerEvents: "none",
              }} />
            </div>

            {/* Drop shadow glow */}
            <div style={{
              position: "absolute",
              bottom: -20 * scale,
              left: "10%",
              right: "10%",
              height: 40 * scale,
              background: "rgba(0,0,0,0.4)",
              filter: "blur(20px)",
              borderRadius: "50%",
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
