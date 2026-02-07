'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';

const waveVertexShader = `
varying vec2 vUv;
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;

void main() {
  vUv = uv;
  vec3 pos = position;
  pos.z += sin(pos.x * uFrequency + uTime) * uAmplitude;
  pos.z += cos(pos.y * uFrequency + uTime * 0.5) * uAmplitude * 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const waveFragmentShader = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;

void main() {
  float brightness = 0.5 + 0.5 * sin(vUv.x * 10.0 + uTime);
  gl_FragColor = vec4(uColor * brightness, 1.0);
}
`;

const retroDitherFragmentShader = `
uniform float uColorNum;
uniform sampler2D tDiffuse;

const int indexMatrix4x4[16] = int[16](
  0,  8,  2,  10,
  12, 4,  14, 6,
  3,  11, 1,  9,
  15, 7,  13, 5
);

float indexValue() {
  int x = int(mod(gl_FragCoord.x, 4.0));
  int y = int(mod(gl_FragCoord.y, 4.0));
  return float(indexMatrix4x4[x + y * 4]) / 16.0;
}

float dither(float color) {
  float closestColor = (color < 0.5) ? 0.0 : 1.0;
  float secondClosestColor = 1.0 - closestColor;
  float d = indexValue();
  float distance_val = abs(closestColor - color);
  return (distance_val < d) ? closestColor : secondClosestColor;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 color = texture2D(tDiffuse, uv);
  color.r = floor(color.r * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
  color.g = floor(color.g * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
  color.b = floor(color.b * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
  color.r = dither(color.r);
  color.g = dither(color.g);
  color.b = dither(color.b);
  outputColor = color;
}
`;

class RetroEffect extends Effect {
  constructor({ colorNum = 4.0 } = {}) {
    super('RetroEffect', retroDitherFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform<number | null>>([
        ['uColorNum', new THREE.Uniform(colorNum)],
        ['tDiffuse', new THREE.Uniform(null)],
      ]),
    });
  }

  set colorNum(value: number) {
    this.uniforms.get('uColorNum')!.value = value;
  }
}

function DitheredWaves({
  waveColor,
  waveSpeed,
  waveAmplitude,
  waveFrequency,
  colorNum,
  disableAnimation,
  enableMouseInteraction,
  mouseRadius,
}: {
  waveColor: [number, number, number];
  waveSpeed: number;
  waveAmplitude: number;
  waveFrequency: number;
  colorNum: number;
  disableAnimation: boolean;
  enableMouseInteraction: boolean;
  mouseRadius: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, pointer } = useThree();
  const effectRef = useRef<RetroEffect>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: waveAmplitude },
      uFrequency: { value: waveFrequency },
      uColor: { value: new THREE.Color(...waveColor) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseRadius: { value: mouseRadius },
    }),
    []
  );

  const retroEffect = useMemo(() => new RetroEffect({ colorNum }), []);

  useEffect(() => {
    retroEffect.colorNum = colorNum;
  }, [colorNum, retroEffect]);

  useFrame((state) => {
    if (materialRef.current) {
      if (!disableAnimation) {
        materialRef.current.uniforms.uTime.value =
          state.clock.getElapsedTime() * waveSpeed;
      }
      materialRef.current.uniforms.uAmplitude.value = waveAmplitude;
      materialRef.current.uniforms.uFrequency.value = waveFrequency;
      materialRef.current.uniforms.uColor.value.set(...waveColor);

      if (enableMouseInteraction) {
        materialRef.current.uniforms.uMouse.value.set(
          (pointer.x * viewport.width) / 2,
          (pointer.y * viewport.height) / 2
        );
      }
    }
  });

  return (
    <>
      <mesh ref={meshRef} rotation={[-Math.PI / 4, 0, 0]} scale={[4, 4, 1]}>
        <planeGeometry args={[4, 4, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={waveVertexShader}
          fragmentShader={waveFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      <EffectComposer>
        <primitive ref={effectRef} object={retroEffect} />
      </EffectComposer>
    </>
  );
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

export default function Dither({
  waveColor = [0.5, 0.5, 0.5],
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 0.3,
  colorNum = 27.2,
  waveAmplitude = 0.3,
  waveFrequency = 3,
  waveSpeed = 0.05,
}: {
  waveColor?: [number, number, number];
  disableAnimation?: boolean;
  enableMouseInteraction?: boolean;
  mouseRadius?: number;
  colorNum?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  waveSpeed?: number;
}) {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    setCanRender(isWebGLAvailable());
  }, []);

  if (!canRender) return null;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 3] }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(0x000000), 0);
        }}
      >
        <DitheredWaves
          waveColor={waveColor}
          waveSpeed={waveSpeed}
          waveAmplitude={waveAmplitude}
          waveFrequency={waveFrequency}
          colorNum={colorNum}
          disableAnimation={disableAnimation}
          enableMouseInteraction={enableMouseInteraction}
          mouseRadius={mouseRadius}
        />
      </Canvas>
    </div>
  );
}
