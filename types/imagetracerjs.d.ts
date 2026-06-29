declare module "imagetracerjs" {
  interface ImageTracerPaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  interface ImageTracerOptions {
    numberofcolors?: number;
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    strokewidth?: number;
    linefilter?: boolean;
    viewbox?: boolean;
    scale?: number;
    roundcoords?: number;
    rightangleenhance?: boolean;
    blurradius?: number;
    blurdelta?: number;
    colorsampling?: number;
    colorquantcycles?: number;
    layering?: number;
    desc?: boolean;
    lcpr?: number;
    qcpr?: number;
    pal?: ImageTracerPaletteColor[];
    [key: string]: unknown;
  }

  interface TracedData {
    width: number;
    height: number;
    layers: unknown[][];
    palette: unknown[];
  }

  const ImageTracer: {
    versionnumber: string;
    optionpresets: Record<string, ImageTracerOptions>;
    checkoptions(options: ImageTracerOptions | string): ImageTracerOptions;
    imagedataToSVG(imageData: ImageData, options?: ImageTracerOptions | string): string;
    imagedataToTracedata(imageData: ImageData, options?: ImageTracerOptions | string): TracedData;
    getsvgstring(tracedata: TracedData, options?: ImageTracerOptions): string;
    svgpathstring(tracedata: TracedData, lnum: number, pathnum: number, options: ImageTracerOptions): string;
  };

  export default ImageTracer;
}
