import type { ResourceType } from "@openfront/engine-api/game/GameTypes";
import fragSrc from "../shaders/geological-scouting/geological-scouting.frag.glsl?raw";
import vertSrc from "../shaders/geological-scouting/geological-scouting.vert.glsl?raw";
import { createMapQuad, createProgram, shaderSrc } from "../utils/GlUtils";

export class GeologicalScoutingPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private densityTex: WebGLTexture;
  private mapW: number;
  private mapH: number;

  // Uniforms
  private uCamera: WebGLUniformLocation;
  private uMapSize: WebGLUniformLocation;
  private uHeatmapAlpha: WebGLUniformLocation;
  private uActive: WebGLUniformLocation;
  private uResourceDensityTex: WebGLUniformLocation;

  private active: boolean = false;
  private currentResource: ResourceType | "all" | "none" = "none";
  private alpha: number = 0.95;

  constructor(gl: WebGL2RenderingContext, mapW: number, mapH: number) {
    this.gl = gl;
    this.mapW = mapW;
    this.mapH = mapH;

    this.program = createProgram(
      gl,
      shaderSrc(vertSrc, {}),
      shaderSrc(fragSrc, {}),
      "GeologicalScoutingPass",
    );

    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uMapSize = gl.getUniformLocation(this.program, "uMapSize")!;
    this.uHeatmapAlpha = gl.getUniformLocation(this.program, "uHeatmapAlpha")!;
    this.uActive = gl.getUniformLocation(this.program, "uActive")!;
    this.uResourceDensityTex = gl.getUniformLocation(
      this.program,
      "uResourceDensityTex",
    )!;

    this.vao = createMapQuad(gl, mapW, mapH);

    // Create standard R8 / UNSIGNED_BYTE texture (100% core WebGL2, no float texture extensions needed)
    this.densityTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.densityTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      mapW,
      mapH,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  public setResourceDensityData(data: Float32Array | Uint8Array): void {
    const gl = this.gl;
    const len = this.mapW * this.mapH;
    let byteData: Uint8Array;
    if (data instanceof Uint8Array) {
      byteData = data;
    } else {
      byteData = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        const val = data[i] ?? 0;
        byteData[i] = Math.round(Math.min(1.0, Math.max(0.0, val)) * 255);
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.densityTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.mapW,
      this.mapH,
      gl.RED,
      gl.UNSIGNED_BYTE,
      byteData,
    );
  }

  public setActiveResource(resource: ResourceType | "all" | "none"): void {
    this.currentResource = resource;
    this.active = resource !== "none";
  }

  public isActive(): boolean {
    return this.active;
  }

  public getActiveResource(): ResourceType | "all" | "none" {
    return this.currentResource;
  }

  public draw(cam: Float32Array): void {
    if (!this.active) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform2f(this.uMapSize, this.mapW, this.mapH);
    gl.uniform1f(this.uHeatmapAlpha, this.alpha);
    gl.uniform1i(this.uActive, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTex);
    gl.uniform1i(this.uResourceDensityTex, 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.densityTex);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
