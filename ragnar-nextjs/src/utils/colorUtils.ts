
/**
 * Generates rainbow colors by dividing the color spectrum evenly
 * @param count Number of colors to generate
 * @returns Array of HSL color strings
 */
export function generateRainbowColors(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return ['hsl(210, 70%, 60%)'];
  
  const colors: string[] = [];
  const hueStep = 360 / count;
  
  for (let i = 0; i < count; i++) {
    const hue = Math.round(i * hueStep);
    // Use consistent saturation and lightness for better visual harmony
    const saturation = 70; // 70% saturation for vibrant colors
    const lightness = 60;  // 60% lightness for good contrast
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
}

/**
 * Generates a color map for entity types using rainbow distribution
 * @param entityTypes Array of unique entity type names
 * @returns Object mapping entity type to color
 */
export function generateEntityTypeColorMap(entityTypes: string[]): { [key: string]: string } {
  const uniqueTypes = [...new Set(entityTypes)].sort(); // Sort for consistency
  const rainbowColors = generateRainbowColors(uniqueTypes.length);
  
  const colorMap: { [key: string]: string } = {};
  uniqueTypes.forEach((type, index) => {
    colorMap[type] = rainbowColors[index];
  });
  
  return colorMap;
}

/**
 * Converts HSL color to hex format
 * @param hslColor HSL color string (e.g., "hsl(210, 70%, 60%)")
 * @returns Hex color string (e.g., "#3B82F6")
 */
export function hslToHex(hslColor: string): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return hslColor;
  
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Gets a lighter version of a color for backgrounds
 * @param color Base color (HSL or hex)
 * @param lightnessIncrease How much to increase lightness (default: 25%)
 * @returns Lighter color string
 */
export function getLighterColor(color: string, lightnessIncrease: number = 25): string {
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]);
      const s = parseInt(match[2]);
      const l = Math.min(100, parseInt(match[3]) + lightnessIncrease);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  }
  
  // For hex colors, convert to HSL, lighten, and convert back
  // This is a simplified version - for production, you might want a more robust converter
  return color;
}

/**
 * Pre-defined color schemes for common entity types
 */
export const ENTITY_TYPE_COLORS = {
  // People and organizations
  'PERSON': 'hsl(39, 70%, 60%)',      // Orange
  'ORGANIZATION': 'hsl(120, 70%, 60%)', // Green
  'COMPANY': 'hsl(120, 70%, 60%)',     // Green
  'TEAM': 'hsl(160, 70%, 60%)',       // Teal
  
  // Places and locations
  'LOCATION': 'hsl(200, 70%, 60%)',    // Blue
  'PLACE': 'hsl(200, 70%, 60%)',      // Blue
  'COUNTRY': 'hsl(220, 70%, 60%)',    // Deep Blue
  'CITY': 'hsl(180, 70%, 60%)',       // Cyan
  
  // Technology and products
  'TECHNOLOGY': 'hsl(280, 70%, 60%)',  // Purple
  'PRODUCT': 'hsl(300, 70%, 60%)',    // Magenta
  'SOFTWARE': 'hsl(260, 70%, 60%)',   // Violet
  'HARDWARE': 'hsl(320, 70%, 60%)',   // Pink
  
  // Financial and business
  'MONEY': 'hsl(60, 70%, 60%)',       // Yellow
  'PERCENTAGE': 'hsl(80, 70%, 60%)',  // Lime
  'CURRENCY': 'hsl(45, 70%, 60%)',    // Gold
  'INVESTMENT': 'hsl(100, 70%, 60%)', // Light Green
  
  // Medical and health
  'DISEASE': 'hsl(0, 70%, 60%)',      // Red
  'MEDICATION': 'hsl(330, 70%, 60%)', // Rose
  'SYMPTOM': 'hsl(15, 70%, 60%)',     // Red-Orange
  'TREATMENT': 'hsl(140, 70%, 60%)',  // Green-Teal
  
  // Abstract concepts
  'CONCEPT': 'hsl(240, 70%, 60%)',    // Blue-Purple
  'EVENT': 'hsl(30, 70%, 60%)',       // Orange-Yellow
  'DATE': 'hsl(270, 70%, 60%)',       // Purple-Blue
  'TIME': 'hsl(290, 70%, 60%)',       // Purple-Magenta
  
  // Default fallback
  'DEFAULT': 'hsl(210, 70%, 60%)',    // Standard Blue
} as const;
