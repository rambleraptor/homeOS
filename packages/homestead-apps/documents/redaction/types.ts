/**
 * Types for the client-side document redaction editor.
 *
 * Redaction runs entirely in the browser, before upload: the file is
 * rasterized, the user paints opaque rectangles over sensitive regions, and the
 * flattened result — never the original — is what gets uploaded. That keeps the
 * sensitive content off disk and out of every downstream reader (the classify
 * method sends raw bytes to a model; the index pipeline transcribes them).
 */

/**
 * A redaction rectangle in normalized page coordinates ([0,1] on each axis),
 * so it's independent of the display scale and maps cleanly onto the source
 * raster at flatten time.
 */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A single document page rasterized at natural resolution, ready to redact. */
export interface PageRaster {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}
