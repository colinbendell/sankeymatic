import { logger as msg } from '../ux/logger.js';
import { el } from '../ux/dom.js';
import { fileTimestamp, humanTimestamp, clamp } from '../utils.js';
import { Canvg } from 'canvg';

/**
   * Download a data URL as a file
   * @param {string} dataURL - The data URL to download
   * @param {string} name - The filename to use
   */
export const downloadDataURL = (dataURL, name) => {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = name;
  document.body.appendChild(link);
  link.click(); // This kicks off the download
  link.remove(); // Discard the Anchor we just clicked; it's no longer needed
  // document.body.removeChild(link);
}


// scaledPNG: Build a data URL for a PNG representing the current diagram:
export const scaledPNG = scale => {
  const chartEl = el('chart');
  const orig = { w: chartEl.clientWidth, h: chartEl.clientHeight };
  const scaleFactor = clamp(scale, 1, 6);
  const scaled = { w: orig.w * scaleFactor, h: orig.h * scaleFactor };
  // Canvg 3 needs interesting offsets added when scaling up:
  const offset = {
    x: (scaled.w - orig.w) / (2 * scaleFactor),
    y: (scaled.h - orig.h) / (2 * scaleFactor),
  };
  // Find the (hidden) canvas element in our page:
  const canvasEl = el('png_preview');
  const canvasContext = canvasEl.getContext('2d');
  const svgContent = (new XMLSerializer()).serializeToString(el('sankey_svg'));

  // Set the canvas element to the final height/width the user wants.
  // NOTE: THIS CAN FAIL. Canvases have maximum dimensions and a max area.
  // TODO: Disable any export buttons which will fail silently.
  canvasEl.width = scaled.w;
  canvasEl.height = scaled.h;

  // Give Canvg what it needs to produce a rendered image:
  const canvgObj = Canvg.fromString(
    canvasContext,
    svgContent,
    {
      ignoreMouse: true,
      ignoreAnimation: true,
      ignoreDimensions: true, // DON'T make the canvas size match the svg
      scaleWidth: scaled.w,
      scaleHeight: scaled.h,
      offsetX: offset.x,
      offsetY: offset.y,
    }
  );
  canvgObj.render();

  // Turn canvg's output into a data URL and return it with size info:
  return [scaled, canvasEl.toDataURL('image/png')];
}


/**
 * Save the current diagram as a PNG file
 * @param {number} scale - The scale factor to use
 */
export const saveDiagramAsPNG = scale => {
  const [size, dataURL] = scaledPNG(scale);
  const name = `sankeymatic_${fileTimestamp()}_${size.w}x${size.h}.png`;
  downloadDataURL(dataURL, name);
};

/**
 * Save the current diagram as an SVG file
 */
export const saveDiagramAsSVG = () => {
  // Make a copy of the true SVG & make a few cosmetic changes:
  const svgForExport = el('sankey_svg').outerHTML
    // Take out the id and the class declaration for the background:
    .replace(' id="sankey_svg"', '')
    .replace(/ class="svg_background_[a-z]+"/, '')
    // Add a title placeholder & credit comment after the FIRST tag:
    .replace(
      />/,
      '>\r\n<title>Your Diagram Title</title>\r\n'
          + `<!-- Generated with SankeyMATIC: ${humanTimestamp()} -->\r\n`
    )
  // Add some line breaks to highlight where [g]roups start/end
  // and where each path/text/rect begins:
    .replace(/><(g|\/g|path|text|rect)/g, '>\r\n<$1');
  downloadTextFile(svgForExport, `sankeymatic_${fileTimestamp()}.svg`);
};

/**
   * Download text content as a file
   * @param {string} text - The text content to download
   * @param {string} name - The filename to use
   * @param {string} type - The MIME type of the file
   */
export const downloadTextFile = (text, name, type = 'text/plain') => {
  const blob = new Blob([text], { type });
  const dataURL = URL.createObjectURL(blob);
  downloadDataURL(dataURL, name);
  URL.revokeObjectURL(dataURL);
}

/**
   * Read a file as text
   * @param {File} file - The file to read
   * @returns {Promise<string>} A promise that resolves with the file contents
   */
export const readFileAsText = file => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = error => reject(error);
    reader.readAsText(file);
  });
}

/**
   * Handle file selection for loading a diagram
   * @param {Event} event - The file input change event
   * @returns {Promise<string>} A promise that resolves with the file contents
   */
export const handleFileSelect = async event => {
  const file = event.target.files[0];
  if (!file) return '';

  try {
    return await readFileAsText(file);
  } catch (error) {
    msg.add(`Error reading file: ${error.message}`, 'issue');
    return '';
  }
}

