#version 300 es
precision highp float;

uniform sampler2D uResourceDensityTex; // Normalized density [0, 1] mapped to R8
uniform vec2 uMapSize;
uniform float uHeatmapAlpha;
uniform int uActive; // 1 = active, 0 = inactive

in vec2 vWorldPos;
out vec4 fragColor;

void main() {
  if (uActive == 0) discard;

  ivec2 tc = ivec2(floor(vWorldPos));
  if (tc.x < 0 || tc.y < 0 || tc.x >= int(uMapSize.x) || tc.y >= int(uMapSize.y))
    discard;

  // Exact per-tile pixel sampling
  float v = texelFetch(uResourceDensityTex, tc, 0).r;

  // Discard ocean / water tiles (density is 0.0)
  if (v < 0.05) {
    discard;
  }

  // Multi-tier Thermal Palette:
  // Baseline Land (0.05 - 0.25): Soft subtle cyan/teal
  // Emerging Rich Lode (0.25 - 0.50): Vivid Neon Lime Green
  // High Yield Cluster (0.50 - 0.75): Radiant Gold / Yellow
  // Strategic Hotspot (0.75 - 0.90): Blazing Flame Orange / Red
  // Core Epicenter (0.90 - 1.00): White-Hot Lava
  vec3 color;
  if (v < 0.25) {
    float t = (v - 0.05) / 0.20;
    color = mix(vec3(0.04, 0.40, 0.70), vec3(0.05, 0.75, 0.60), t);
  } else if (v < 0.50) {
    float t = (v - 0.25) / 0.25;
    color = mix(vec3(0.05, 0.75, 0.60), vec3(0.25, 0.95, 0.05), t);
  } else if (v < 0.75) {
    float t = (v - 0.50) / 0.25;
    color = mix(vec3(0.25, 0.95, 0.05), vec3(1.0, 0.88, 0.0), t);
  } else if (v < 0.90) {
    float t = (v - 0.75) / 0.15;
    color = mix(vec3(1.0, 0.88, 0.0), vec3(1.0, 0.22, 0.0), t);
  } else {
    float t = clamp((v - 0.90) / 0.10, 0.0, 1.0);
    color = mix(vec3(1.0, 0.22, 0.0), vec3(1.0, 1.0, 1.0), t);
  }

  // Crisp per-tile pixel border to emphasize map grid coordinates
  vec2 localUV = fract(vWorldPos);
  float edgeDist = min(min(localUV.x, 1.0 - localUV.x), min(localUV.y, 1.0 - localUV.y));
  if (edgeDist < 0.065) {
    color = mix(color, vec3(0.0, 0.0, 0.0), 0.35);
  }

  // Dynamic alpha: Baseline is pleasant and unobtrusive (0.42 - 0.55),
  // while Hotspots blaze with full tactical prominence (0.75 - 0.95)!
  float alpha;
  if (v < 0.25) {
    alpha = uHeatmapAlpha * mix(0.42, 0.58, (v - 0.05) / 0.20);
  } else {
    alpha = uHeatmapAlpha * mix(0.68, 0.95, clamp((v - 0.25) / 0.65, 0.0, 1.0));
  }

  fragColor = vec4(color, alpha);
}
