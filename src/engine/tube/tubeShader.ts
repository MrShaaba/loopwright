export const tubeVertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(world) * normal);
  vUv = uv;
  gl_Position = viewProjection * w;
}
`;

/**
 * Glass tube rendered additively: a Fresnel edge glow, soft light rings, speed streaks that
 * scroll towards the camera, a glow falloff around the ball, a highlight band for the selected
 * section and exponential fog that fades the glow with distance. uv.x runs around the tube and
 * uv.y is the arc length in metres.
 */
export const tubeFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec3 cameraPosition;
uniform vec3 tint;
uniform vec3 edgeColor;
uniform vec3 streakColor;
uniform vec3 ballPos;
uniform vec3 ballColor;
uniform float time;
uniform float scroll;
uniform float speedFactor;
uniform float ringSpacing;
uniform float dashSpacing;
uniform float intensity;
uniform vec2 highlight;
uniform float highlightOn;
uniform vec3 fogColor;
uniform float fogDensity;

void main(void) {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float facing = abs(dot(N, V));
  float fresnel = pow(1.0 - facing, 2.4);
  float dist = distance(cameraPosition, vWorld);
  // Walls hugging the camera stay quiet, otherwise the view inside the tube washes out.
  float nearFade = smoothstep(0.6, 5.5, dist);
  float quiet = mix(0.05, 1.0, nearFade);

  vec3 col = (tint * (0.05 + 0.2 * fresnel) + edgeColor * fresnel * 0.36) * quiet;

  float along = vUv.y;
  float ringDistance = abs(fract(along / ringSpacing) - 0.5) * ringSpacing;
  col += edgeColor * smoothstep(0.5, 0.0, ringDistance) * 0.12 * nearFade;

  float lane = abs(fract(vUv.x * 14.0 + 0.5) - 0.5) * 2.0;
  float dash = fract((along + scroll) / dashSpacing);
  float streak = smoothstep(0.14, 0.0, lane) * smoothstep(0.45, 0.97, dash) * speedFactor;
  col += streakColor * streak * mix(0.35, 1.2, nearFade);

  float d = distance(vWorld, ballPos);
  float glow = exp(-d * d / 4.5) * 0.85;
  col += ballColor * glow * mix(0.08, 1.0, nearFade);

  float inside = step(highlight.x, along) * step(along, highlight.y) * highlightOn;
  col += edgeColor * inside * (0.28 + 0.08 * sin(time * 5.0));

  float fog = exp(-pow(dist * fogDensity, 2.0));
  gl_FragColor = vec4(col * fog * intensity, 1.0);
}
`;
