"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import * as THREE from "three";

export interface WarpTwisterProps {
  /** Tube radius */
  radius?: number;
  /** Tube narrowing factor */
  narrow?: number;
  /** Tube length */
  length?: number;
  /** Speed of haze flow */
  hazeSpeed?: number;
  /** Speed of dust particles */
  dustSpeed?: number;
  /** Intensity of haze effect */
  hazeStrength?: number;
  /** Frequency of haze pattern */
  hazeFrequency?: number;
  /** Density of dust particles */
  dustDensity?: number;
  /** Size of dust particles */
  dustSize?: number;
  /** Opacity of dust particles */
  dustOpacity?: number;
  /** Edge fade intensity */
  edgeFade?: number;
  /** Tightness of spiral pattern */
  spiralTight?: number;
  /** Rotation speed */
  rotSpeed?: number;
  /** Base color [r, g, b] values 0-1 */
  baseColor?: [number, number, number];
  /** Light mode base color [r, g, b] values 0-1 */
  baseColorLight?: [number, number, number];
  /** Camera distance */
  cameraDistance?: number;
  className?: string;
}

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_narrow;
uniform float u_length;
uniform float u_hazeSpeed;
uniform float u_dustSpeed;
uniform float u_hazeStrength;
uniform float u_hazeFrequency;
uniform float u_dustDensity;
uniform float u_dustSize;
uniform float u_dustOpacity;
uniform float u_edgeFade;
uniform float u_spiralTight;
uniform float u_rotSpeed;
uniform vec3 u_baseColor;
uniform float u_cameraDistance;
uniform bool u_lightMode;

varying vec2 vUv;

bool clipped(in vec3 pos, float clipY, float clipZ) {
  return abs(pos.y) < clipY && abs(pos.z) < clipZ;
}

float iQuadricTypeA(in vec3 ro, in vec3 rd, in vec4 abcd, in float clipY, in float clipZ, out vec3 oNor) {
  vec3 r2 = abcd.xyz * abs(abcd.xyz);
  float k2 = dot(rd, rd * r2);
  float k1 = dot(rd, ro * r2);
  float k0 = dot(ro, ro * r2) - abcd.w;

  float h = k1 * k1 - k2 * k0;
  float nh = step(0.0, h);
  h = sqrt(max(h, 0.0)) * sign(k2);

  float t1 = (-k1 - h) / k2;
  float t2 = (-k1 + h) / k2;

  vec3 pos1 = ro + t1 * rd;
  vec3 pos2 = ro + t2 * rd;

  float v1 = float(clipped(pos1, clipY, clipZ)) * step(0.0, t1);
  float v2 = float(clipped(pos2, clipY, clipZ)) * step(0.0, t2);
  float s = step(0.0, v1);

  float t = mix(t2, t1, s) * nh;

  vec3 nor1 = normalize(pos1 * r2);
  vec3 nor2 = normalize(pos2 * r2);
  oNor = mix(nor2, nor1, s);

  return mix(-1.0, t, step(0.0, v1 + v2));
}

float hash21(vec2 p) {
  p = fract(p * vec2(345.42, 137.25));
  p += dot(p, p + 34.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1));
  float d = hash21(i + vec2(1, 1));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.4;
  for (int i = 0; i < 3; i++) {
    s += noise(p) * a;
    p *= 1.28;
    a *= 0.512;
  }
  return s;
}

void main() {
  vec4 kShape = vec4(1.0 / u_radius, -1.0 / u_narrow, 1.0 / u_radius, 1.0);

  vec2 ndc = (vUv - 0.5) * 2.0;
  ndc.x *= u_resolution.x / u_resolution.y;

  vec3 ro = vec3(0.0, 0.0, u_cameraDistance);
  vec3 ta = vec3(0.0, 0.0, 0.0);

  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
  vec3 vv = cross(uu, ww);

  vec3 rd = normalize(ndc.x * uu + ndc.y * vv + 3.0 * ww);

  float ang = 1.5707963;
  float c = cos(ang), s = sin(ang);
  ro = vec3(c * ro.x - s * ro.y, s * ro.x + c * ro.y, ro.z);
  rd = vec3(c * rd.x - s * rd.y, s * rd.x + c * rd.y, rd.z);

  vec3 nor;
  float t = iQuadricTypeA(ro, rd, kShape, u_length, u_length, nor);
  float valid = step(0.0, t);

  vec3 pos = ro + t * rd;

  float angle = atan(pos.z, pos.x);
  float cy = pos.y;
  float angle01 = angle * 0.15915494 + 0.5;
  float flow = cy - u_time * u_hazeSpeed;

  float swirl = angle + cy * u_spiralTight + u_time * u_rotSpeed;
  vec2 cyc = vec2(cos(swirl), sin(swirl));

  vec2 h1 = vec2(cyc.x * u_hazeFrequency, flow * 2.0 + cyc.y * 0.75);
  vec2 h2 = vec2(cyc.y * (u_hazeFrequency * 0.7), flow * 1.37 - cyc.x * 0.5);
  float haze = pow(mix(fbm(h1), fbm(h2), 0.5), 2.0) * u_hazeStrength;

  float u = cyc.x * 0.5 + 0.5;
  float v = cyc.y * 0.5 + 0.5;

  vec2 uid = vec2(
    floor(u * u_dustDensity),
    floor(v * u_dustDensity + flow * 0.1)
  );

  float r1 = hash21(uid * 1.373 + 1.7);
  float r2 = hash21(uid * 2.911 + 3.1);
  float r3 = hash21(uid * 4.277 + 5.9);

  float local = cy + (r1 - 0.5) - u_time * u_dustSpeed * 0.5;
  float d = abs(fract(local) - 0.5);

  float size = mix(u_dustSize * 0.6, u_dustSize * 1.4, r2);
  float opacity = mix(u_dustOpacity * 0.4, u_dustOpacity * 0.8, r3);

  float core = exp(-d * size);
  float halo = exp(-d * size * 0.35);
  float dust = (core * 0.1 + halo * 0.8) * opacity;

  float seamFade = smoothstep(0.0, 0.2, min(angle01, 1.0 - angle01));
  dust *= seamFade;

  float fres = pow(1.0 - abs(dot(nor, -rd)), 1.35);
  float edgeFadeVal = smoothstep(0.0, 0.9, fres);
  float fadeLen = smoothstep(u_length * 0.55, 0.25, length(pos));

  vec3 col = (vec3(haze) + vec3(dust)) * fadeLen * valid;
  col *= 1.0 - edgeFadeVal * u_edgeFade;
  col *= u_baseColor;
  col = sqrt(col);

  float alpha = max(max(col.r, col.g), col.b);
  alpha = clamp(alpha * 2.0, 0.0, 1.0);

  if (u_lightMode) {
    float luminance = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luminance), col, 2.5);
    col = pow(col, vec3(0.7));
    col = clamp(col * 2.0, 0.0, 1.0);
    alpha = clamp(luminance * 6.0, 0.0, 1.0);
  }

  gl_FragColor = vec4(col, alpha);
}
`;

interface ShaderPlaneProps {
  radius: number;
  narrow: number;
  length: number;
  hazeSpeed: number;
  dustSpeed: number;
  hazeStrength: number;
  hazeFrequency: number;
  dustDensity: number;
  dustSize: number;
  dustOpacity: number;
  edgeFade: number;
  spiralTight: number;
  rotSpeed: number;
  baseColor: [number, number, number];
  cameraDistance: number;
  lightMode: boolean;
}

const ShaderPlane: React.FC<ShaderPlaneProps> = ({
  radius,
  narrow,
  length,
  hazeSpeed,
  dustSpeed,
  hazeStrength,
  hazeFrequency,
  dustDensity,
  dustSize,
  dustOpacity,
  edgeFade,
  spiralTight,
  rotSpeed,
  baseColor,
  cameraDistance,
  lightMode,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const frameCount = useRef(0);
  const { viewport, size } = useThree();

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_radius: { value: 0.5 },
      u_narrow: { value: 2.0 },
      u_length: { value: 8.0 },
      u_hazeSpeed: { value: 3.0 },
      u_dustSpeed: { value: 2.0 },
      u_hazeStrength: { value: 0.1 },
      u_hazeFrequency: { value: 32.0 },
      u_dustDensity: { value: 128.0 },
      u_dustSize: { value: 64.0 },
      u_dustOpacity: { value: 0.1 },
      u_edgeFade: { value: 1.28 },
      u_spiralTight: { value: 0.32 },
      u_rotSpeed: { value: 0.32 },
      u_baseColor: { value: new THREE.Vector3() },
      u_cameraDistance: { value: 8.0 },
      u_lightMode: { value: false },
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    // Throttle to ~30fps to reduce GPU contention with PixiJS canvas
    frameCount.current += 1;
    if (frameCount.current % 2 !== 0) return;
    const u = materialRef.current.uniforms;
    u.u_time.value = state.clock.elapsedTime;
    u.u_resolution.value.set(size.width, size.height);
    u.u_radius.value = radius;
    u.u_narrow.value = narrow;
    u.u_length.value = length;
    u.u_hazeSpeed.value = hazeSpeed;
    u.u_dustSpeed.value = dustSpeed;
    u.u_hazeStrength.value = hazeStrength;
    u.u_hazeFrequency.value = hazeFrequency;
    u.u_dustDensity.value = dustDensity;
    u.u_dustSize.value = dustSize;
    u.u_dustOpacity.value = dustOpacity;
    u.u_edgeFade.value = edgeFade;
    u.u_spiralTight.value = spiralTight;
    u.u_rotSpeed.value = rotSpeed;
    u.u_baseColor.value.set(...baseColor);
    u.u_cameraDistance.value = cameraDistance;
    u.u_lightMode.value = lightMode;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
};

const WarpTwister: React.FC<WarpTwisterProps> = ({
  radius = 1.5,
  narrow = 1.8,
  length = 10,
  hazeSpeed = 0.5,
  dustSpeed = 1,
  hazeStrength = 0.25,
  hazeFrequency = 100,
  dustDensity = 300,
  dustSize = 100,
  dustOpacity = 0.1,
  edgeFade = 2,
  spiralTight = 0.5,
  rotSpeed = 0,
  baseColor = [0.753, 0.518, 0.988],
  baseColorLight = [0.267, 0, 0.667],
  cameraDistance = 8.5,
  className,
}) => {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const activeBaseColor = isLight ? baseColorLight : baseColor;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: isLight ? "#fff" : "#0b0b0b",
      }}
    >
      <Canvas
        className="w-full h-full"
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false }}
        dpr={[0.5, 1]}
      >
        <ShaderPlane
          radius={radius}
          narrow={narrow}
          length={length}
          hazeSpeed={hazeSpeed}
          dustSpeed={dustSpeed}
          hazeStrength={hazeStrength}
          hazeFrequency={hazeFrequency}
          dustDensity={dustDensity}
          dustSize={dustSize}
          dustOpacity={dustOpacity}
          edgeFade={edgeFade}
          spiralTight={spiralTight}
          rotSpeed={rotSpeed}
          baseColor={activeBaseColor}
          cameraDistance={cameraDistance}
          lightMode={isLight}
        />
      </Canvas>
    </div>
  );
};

WarpTwister.displayName = "WarpTwister";

export default WarpTwister;
