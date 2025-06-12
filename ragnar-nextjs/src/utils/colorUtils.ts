/**
 * Generates rainbow colors by dividing the color spectrum evenly
 * @param count Number of colors to generate
 * @returns Array of HSL color strings
 */
export function generateRainbowColors(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return ['hsl(210, 95%, 42%)'];
  
  const colors: string[] = [];
  
  // Define a set of highly distinct, vibrant colors with optimal spacing
  const predefinedColors = [
    'hsl(0, 95%, 42%)',    // Vibrant Red - more saturated
    'hsl(120, 95%, 35%)',  // Vibrant Green - darker for better contrast
    'hsl(240, 95%, 52%)',  // Vibrant Blue - more saturated
    'hsl(30, 95%, 42%)',   // Vibrant Orange - more saturated
    'hsl(280, 95%, 52%)',  // Vibrant Purple - more saturated
    'hsl(60, 95%, 38%)',   // Vibrant Yellow - darker for better contrast
    'hsl(180, 95%, 35%)',  // Vibrant Cyan - darker
    'hsl(320, 95%, 48%)',  // Vibrant Magenta - more saturated
    'hsl(90, 95%, 35%)',   // Vibrant Lime - darker
    'hsl(210, 95%, 42%)',  // Vibrant Blue (different shade)
    'hsl(15, 95%, 42%)',   // Vibrant Red-Orange - more saturated
    'hsl(270, 95%, 50%)',  // Vibrant Violet - more saturated
    'hsl(150, 95%, 32%)',  // Vibrant Teal - darker
    'hsl(45, 95%, 38%)',   // Vibrant Gold - darker
    'hsl(195, 95%, 38%)',  // Vibrant Sky Blue - darker
    'hsl(315, 95%, 45%)',  // Vibrant Pink - more saturated
  ];
  
  // If we need more colors than predefined, generate additional ones
  if (count <= predefinedColors.length) {
    return predefinedColors.slice(0, count);
  }
  
  // Use predefined colors first, then generate additional ones using golden ratio
  colors.push(...predefinedColors);
  
  const remainingCount = count - predefinedColors.length;
  const goldenRatio = 0.618033988749; // Golden ratio for better distribution
  
  for (let i = 0; i < remainingCount; i++) {
    // Use golden ratio for more evenly distributed hues
    const hue = ((predefinedColors.length + i) * goldenRatio * 360) % 360;
    
    // Vary saturation and lightness slightly for even more distinction
    const saturation = 92 + (i % 3) * 2; // 92-96% saturation
    const lightness = 35 + (i % 4) * 3;  // 35-44% lightness for better contrast
    
    colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
}

// Global color registry to track assigned colors and prevent collisions
class ColorRegistry {
  private assignedColors = new Map<string, string>(); // entity -> color
  private usedColors = new Set<string>(); // Track all used colors
  private colorToEntity = new Map<string, string>(); // color -> entity (for reverse lookup)

  /**
   * Gets or assigns a color for an entity, ensuring no collisions
   * @param entityId Unique identifier for the entity (can be name, type, or composite key)
   * @param entityType Optional entity type for fallback color selection
   * @returns HSL color string
   */
  getEntityColor(entityId: string, entityType?: string): string {
    // Check if this entity already has an assigned color
    if (this.assignedColors.has(entityId)) {
      return this.assignedColors.get(entityId)!;
    }

    let color: string;

    // First try predefined color for entity type
    if (entityType) {
      const predefinedColor = (ENTITY_TYPE_COLORS as any)[entityType.toUpperCase()];
      if (predefinedColor && !this.usedColors.has(predefinedColor)) {
        color = predefinedColor;
      } else {
        // Generate a consistent color based on entity type, then check for collisions
        color = this.generateColorWithCollisionDetection(entityType);
      }
    } else {
      // Generate color based on entity ID
      color = this.generateColorWithCollisionDetection(entityId);
    }

    // Register the color assignment
    this.assignColor(entityId, color);
    return color;
  }

  /**
   * Generates a color with collision detection and avoidance
   * @param seedString String to use for generating base color
   * @returns Collision-free HSL color string
   */
  private generateColorWithCollisionDetection(seedString: string): string {
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const color = this.generateConsistentColor(seedString, attempts);
      
      // Check if color is sufficiently distinct from used colors
      if (!this.usedColors.has(color) && this.isColorSufficientlyDistinct(color)) {
        return color;
      }
      
      attempts++;
    }

    // Fallback: generate a completely random distinct color
    return this.generateFallbackColor();
  }

  /**
   * Generates a consistent color with optional variation
   * @param seedString String to hash for color generation
   * @param variation Variation number to modify the hash
   * @returns HSL color string
   */
  private generateConsistentColor(seedString: string, variation: number = 0): string {
    // Enhanced hash function with variation
    let hash = variation * 7919; // Prime number for better distribution
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use the hash to generate a hue (0-359)
    const hue = Math.abs(hash) % 360;
    
    // Use different saturation and lightness values based on hash to create more variety
    const saturationVariations = [95, 92, 88, 90, 85];
    const lightnessVariations = [42, 38, 45, 35, 40];
    
    const saturation = saturationVariations[Math.abs(hash) % saturationVariations.length];
    const lightness = lightnessVariations[Math.abs(hash >> 8) % lightnessVariations.length];
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Checks if a color is sufficiently distinct from all used colors
   * @param newColor The new color to check
   * @returns True if the color is sufficiently distinct
   */
  private isColorSufficientlyDistinct(newColor: string): boolean {
    const newHsl = parseHslColor(newColor);
    if (!newHsl) return true;
    
    const minHueDifference = 20; // Minimum hue difference in degrees
    const minSaturationDifference = 15; // Minimum saturation difference
    const minLightnessDifference = 8; // Minimum lightness difference
    
    for (const existingColor of this.usedColors) {
      const existingHsl = parseHslColor(existingColor);
      if (!existingHsl) continue;
      
      // Calculate hue difference (accounting for circular nature of hue)
      let hueDiff = Math.abs(newHsl.h - existingHsl.h);
      hueDiff = Math.min(hueDiff, 360 - hueDiff);
      
      const satDiff = Math.abs(newHsl.s - existingHsl.s);
      const lightDiff = Math.abs(newHsl.l - existingHsl.l);
      
      // Colors are too similar if hue is close AND saturation/lightness are also close
      if (hueDiff < minHueDifference && 
          satDiff < minSaturationDifference && 
          lightDiff < minLightnessDifference) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generates a fallback color when all else fails
   * @returns A distinct HSL color string
   */
  private generateFallbackColor(): string {
    // Use golden ratio to find an unused hue space
    const goldenRatio = 0.618033988749;
    const usedHues = new Set<number>();
    
    // Extract hues from used colors
    for (const color of this.usedColors) {
      const hsl = parseHslColor(color);
      if (hsl) usedHues.add(hsl.h);
    }
    
    // Find an unused hue using golden ratio distribution
    let hue = 0;
    let attempts = 0;
    while (attempts < 360) {
      hue = (attempts * goldenRatio * 360) % 360;
      
      // Check if this hue is far enough from used hues
      let isDistinct = true;
      for (const usedHue of usedHues) {
        let hueDiff = Math.abs(hue - usedHue);
        hueDiff = Math.min(hueDiff, 360 - hueDiff);
        if (hueDiff < 25) {
          isDistinct = false;
          break;
        }
      }
      
      if (isDistinct) break;
      attempts++;
    }
    
    return `hsl(${Math.round(hue)}, 90%, 40%)`;
  }

  /**
   * Manually assigns a color to an entity
   * @param entityId The entity identifier
   * @param color The color to assign
   */
  private assignColor(entityId: string, color: string): void {
    this.assignedColors.set(entityId, color);
    this.usedColors.add(color);
    this.colorToEntity.set(color, entityId);
  }

  /**
   * Removes an entity's color assignment (useful for cleanup)
   * @param entityId The entity identifier
   */
  removeEntity(entityId: string): void {
    const color = this.assignedColors.get(entityId);
    if (color) {
      this.assignedColors.delete(entityId);
      this.usedColors.delete(color);
      this.colorToEntity.delete(color);
    }
  }

  /**
   * Clears all color assignments
   */
  clear(): void {
    this.assignedColors.clear();
    this.usedColors.clear();
    this.colorToEntity.clear();
  }

  /**
   * Gets statistics about color usage
   */
  getStats(): { totalEntities: number; totalColors: number; assignments: Record<string, string> } {
    return {
      totalEntities: this.assignedColors.size,
      totalColors: this.usedColors.size,
      assignments: Object.fromEntries(this.assignedColors)
    };
  }
}

// Global singleton instance
const globalColorRegistry = new ColorRegistry();

/**
 * Gets a consistent, collision-free color for any entity
 * This is the main function to use for entity coloring
 * @param entityId Unique identifier for the entity (name, ID, or composite key)
 * @param entityType Optional entity type for better color selection
 * @returns HSL color string
 */
export function getEntityColor(entityId: string, entityType?: string): string {
  return globalColorRegistry.getEntityColor(entityId, entityType);
}

/**
 * Generates a consistent color for an entity type using string hashing
 * This ensures the same entity type always gets the same color
 * @param entityType The entity type string
 * @returns HSL color string
 * @deprecated Use getEntityColor instead for collision-free colors
 */
export function generateConsistentEntityColor(entityType: string): string {
  return getEntityColor(entityType, entityType);
}

/**
 * Generates a color map for entity types using the global color registry
 * This ensures entity types get collision-free colors
 * @param entityTypes Array of unique entity type names
 * @returns Object mapping entity type to color
 */
export function generateEntityTypeColorMap(entityTypes: string[]): { [key: string]: string } {
  const colorMap: { [key: string]: string } = {};
  
  // Use the global color registry to assign colors
  entityTypes.forEach((type) => {
    colorMap[type] = getEntityColor(type, type);
  });
  
  return colorMap;
}

/**
 * Generates colors for specific entities (not just types) ensuring uniqueness
 * @param entities Array of entity objects with id/name and optional type
 * @returns Object mapping entity ID to color
 */
export function generateEntityColorMap(entities: Array<{id: string, type?: string, name?: string}>): { [key: string]: string } {
  const colorMap: { [key: string]: string } = {};
  
  entities.forEach((entity) => {
    // Use entity name if available, otherwise use ID
    const entityIdentifier = entity.name || entity.id;
    // Create a composite key that includes both identifier and type for better uniqueness
    const compositeKey = entity.type ? `${entityIdentifier}:${entity.type}` : entityIdentifier;
    
    colorMap[entity.id] = getEntityColor(compositeKey, entity.type);
  });
  
  return colorMap;
}

/**
 * Utility function to clear all color assignments (useful for testing or reset)
 */
export function clearColorRegistry(): void {
  globalColorRegistry.clear();
}

/**
 * Gets color registry statistics (useful for debugging)
 */
export function getColorRegistryStats(): { totalEntities: number; totalColors: number; assignments: Record<string, string> } {
  return globalColorRegistry.getStats();
}

/**
 * Generates a specified number of distinct colors, avoiding already used colors
 * @param count Number of colors needed
 * @param usedColors Set of already used colors to avoid
 * @returns Array of distinct color strings
 */
export function generateDistinctColors(count: number, usedColors: Set<string> = new Set()): string[] {
  if (count <= 0) return [];
  
  const colors: string[] = [];
  const maxAttempts = count * 10; // Prevent infinite loops
  let attempts = 0;
  
  // Define a larger pool of highly distinct colors
  const colorPool = [
    'hsl(0, 95%, 42%)',     // Rojo vibrante
    'hsl(120, 95%, 35%)',   // Verde vibrante 
    'hsl(240, 95%, 52%)',   // Azul vibrante
    'hsl(30, 95%, 42%)',    // Naranja vibrante
    'hsl(280, 95%, 52%)',   // Púrpura vibrante
    'hsl(180, 95%, 35%)',   // Cian vibrante
    'hsl(320, 95%, 48%)',   // Magenta vibrante
    'hsl(60, 95%, 38%)',    // Amarillo vibrante
    'hsl(90, 95%, 35%)',    // Lima vibrante
    'hsl(15, 95%, 42%)',    // Rojo-naranja vibrante
    'hsl(270, 95%, 50%)',   // Violeta vibrante
    'hsl(150, 95%, 32%)',   // Verde azulado vibrante
    'hsl(45, 95%, 38%)',    // Oro vibrante
    'hsl(195, 95%, 38%)',   // Azul cielo vibrante
    'hsl(315, 95%, 45%)',   // Rosa vibrante
    'hsl(135, 95%, 35%)',   // Verde esmeralda
    'hsl(225, 95%, 48%)',   // Azul índigo
    'hsl(75, 95%, 38%)',    // Verde lima
    'hsl(345, 95%, 45%)',   // Rosa fucsia
    'hsl(165, 95%, 35%)',   // Verde agua
    'hsl(255, 95%, 50%)',   // Azul violeta
    'hsl(105, 95%, 35%)',   // Verde primavera
    'hsl(285, 95%, 48%)',   // Púrpura oscuro
    'hsl(55, 95%, 40%)',    // Amarillo dorado
  ];
  
  // First, try colors from the pool that aren't used
  for (const color of colorPool) {
    if (colors.length >= count) break;
    if (!usedColors.has(color)) {
      colors.push(color);
      usedColors.add(color);
    }
  }
  
  // If we need more colors, generate them using golden ratio distribution
  const goldenRatio = 0.618033988749;
  let colorIndex = colorPool.length;
  
  while (colors.length < count && attempts < maxAttempts) {
    const hue = (colorIndex * goldenRatio * 360) % 360;
    
    // Vary saturation and lightness for better distinction
    const saturationVariations = [95, 88, 92, 85];
    const lightnessVariations = [42, 35, 48, 38];
    
    const saturation = saturationVariations[colorIndex % saturationVariations.length];
    const lightness = lightnessVariations[(colorIndex >> 1) % lightnessVariations.length];
    
    const newColor = `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
    
    // Check if this color is sufficiently different from used colors
    if (!usedColors.has(newColor)) {
      // Simple hue-based distinctness check
      const newHsl = parseHslColor(newColor);
      let isDistinct = true;
      
      if (newHsl) {
        for (const existingColor of usedColors) {
          const existingHsl = parseHslColor(existingColor);
          if (existingHsl) {
            let hueDiff = Math.abs(newHsl.h - existingHsl.h);
            hueDiff = Math.min(hueDiff, 360 - hueDiff);
            if (hueDiff < 25) {
              isDistinct = false;
              break;
            }
          }
        }
      }
      
      if (isDistinct) {
        colors.push(newColor);
        usedColors.add(newColor);
      }
    }
    
    colorIndex++;
    attempts++;
  }
  
  return colors;
}

/**
 * Parses an HSL color string into components
 * @param hslColor HSL color string
 * @returns Object with h, s, l components or null if invalid
 */
function parseHslColor(hslColor: string): { h: number; s: number; l: number } | null {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return null;
  
  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3])
  };
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
 * @param lightnessIncrease How much to increase lightness (default: 10%)
 * @returns Lighter color string
 */
export function getLighterColor(color: string, lightnessIncrease: number = 10): string {
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]);
      const s = Math.max(50, parseInt(match[2]) - 10); // Keep higher saturation for more vibrant backgrounds
      const l = Math.min(72, parseInt(match[3]) + lightnessIncrease + 8); // Less lightness increase to maintain distinctness
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  }
  
  // For hex colors, convert to HSL, lighten, and convert back
  // This is a simplified version - for production, you might want a more robust converter
  return color;
}

/**
 * Pre-defined color schemes for entity types in Spanish
 * The system will use generateConsistentEntityColor for unknown types
 */
export const ENTITY_TYPE_COLORS = {
  // Personas y organizaciones
  'PERSONA': 'hsl(39, 95%, 42%)',      // Naranja vibrante
  'ORGANIZACIÓN': 'hsl(120, 95%, 35%)', // Verde vibrante
  'EMPRESA': 'hsl(120, 95%, 35%)',     // Verde vibrante
  'EQUIPO': 'hsl(160, 95%, 35%)',      // Verde azulado vibrante
  'CLIENTE': 'hsl(45, 95%, 40%)',      // Amarillo dorado
  'PROVEEDOR': 'hsl(130, 95%, 35%)',   // Verde claro
  
  // Lugares y ubicaciones
  'UBICACIÓN': 'hsl(200, 95%, 42%)',   // Azul vibrante
  'LUGAR': 'hsl(200, 95%, 42%)',       // Azul vibrante
  'PAÍS': 'hsl(220, 95%, 42%)',        // Azul profundo vibrante
  'CIUDAD': 'hsl(180, 95%, 35%)',      // Cian vibrante
  'DIRECCIÓN': 'hsl(190, 95%, 38%)',   // Azul cielo
  'OFICINA': 'hsl(210, 95%, 40%)',     // Azul estándar
  
  // Tecnología y productos
  'TECNOLOGÍA': 'hsl(280, 95%, 50%)',  // Púrpura vibrante
  'PRODUCTO': 'hsl(300, 95%, 48%)',    // Magenta vibrante
  'SOFTWARE': 'hsl(260, 95%, 50%)',    // Violeta vibrante
  'HARDWARE': 'hsl(320, 95%, 48%)',    // Rosa vibrante
  'SISTEMA': 'hsl(270, 95%, 45%)',     // Púrpura-violeta
  'APLICACIÓN': 'hsl(290, 95%, 48%)',  // Púrpura-magenta
  
  // Finanzas y negocios
  'DINERO': 'hsl(60, 95%, 38%)',       // Amarillo vibrante
  'PORCENTAJE': 'hsl(80, 95%, 35%)',   // Lima vibrante
  'MONEDA': 'hsl(45, 95%, 38%)',       // Oro vibrante
  'INVERSIÓN': 'hsl(100, 95%, 35%)',   // Verde lima vibrante
  'PRECIO': 'hsl(55, 95%, 40%)',       // Amarillo dorado
  'COSTO': 'hsl(65, 95%, 38%)',        // Amarillo verdoso
  
  // Médico y salud
  'ENFERMEDAD': 'hsl(0, 95%, 42%)',    // Rojo vibrante
  'MEDICAMENTO': 'hsl(330, 95%, 48%)', // Rosa vibrante
  'SÍNTOMA': 'hsl(15, 95%, 42%)',      // Rojo-naranja vibrante
  'TRATAMIENTO': 'hsl(140, 95%, 35%)', // Verde-azulado vibrante
  
  // Conceptos abstractos
  'CONCEPTO': 'hsl(240, 95%, 50%)',    // Azul-púrpura vibrante
  'EVENTO': 'hsl(30, 95%, 42%)',       // Naranja-amarillo vibrante
  'FECHA': 'hsl(270, 95%, 50%)',       // Púrpura-azul vibrante
  'TIEMPO': 'hsl(290, 95%, 48%)',      // Púrpura-magenta vibrante
  'PROCESO': 'hsl(190, 95%, 38%)',     // Azul-cian vibrante
  'RESULTADO': 'hsl(110, 95%, 35%)',   // Verde vibrante
  
  // Tipos específicos del dominio de manuales ERP
  'METODOLOGÍA': 'hsl(350, 95%, 42%)', // Rojo-rosa brillante
  'HERRAMIENTA': 'hsl(25, 95%, 42%)',  // Naranja-rojo brillante
  'MÉTODO': 'hsl(250, 95%, 48%)',      // Azul-violeta brillante
  'PROCEDIMIENTO': 'hsl(170, 95%, 35%)', // Verde-cian brillante
  'FUNCIÓN': 'hsl(310, 95%, 48%)',     // Magenta-rosa brillante
  'CARACTERÍSTICA': 'hsl(340, 95%, 45%)', // Rosa-rojo brillante
  'REQUISITO': 'hsl(230, 95%, 50%)',   // Azul brillante
  'OBJETIVO': 'hsl(20, 95%, 42%)',     // Naranja brillante
  'META': 'hsl(40, 95%, 40%)',         // Naranja-amarillo brillante
  'ESTRATEGIA': 'hsl(260, 95%, 48%)',  // Violeta brillante
  'PLAN': 'hsl(180, 95%, 38%)',        // Cian brillante
  'FASE': 'hsl(200, 95%, 40%)',        // Azul brillante
  'ETAPA': 'hsl(220, 95%, 40%)',       // Azul profundo brillante
  'PASO': 'hsl(240, 95%, 45%)',        // Azul-violeta brillante
  'ACCIÓN': 'hsl(10, 95%, 42%)',       // Rojo brillante
  'TAREA': 'hsl(30, 95%, 40%)',        // Naranja brillante
  'ACTIVIDAD': 'hsl(50, 95%, 38%)',    // Amarillo brillante
  'OPERACIÓN': 'hsl(70, 95%, 35%)',    // Amarillo-verde brillante
  'FLUJO': 'hsl(190, 95%, 35%)',       // Azul-cian brillante
  'FLUJO_DE_TRABAJO': 'hsl(210, 95%, 35%)', // Azul brillante
  
  // Documentos y contenido
  'DOCUMENTO': 'hsl(120, 95%, 38%)',   // Verde brillante
  'ARCHIVO': 'hsl(140, 95%, 35%)',     // Verde-cian brillante
  'MANUAL': 'hsl(160, 95%, 35%)',      // Verde-azul brillante
  'GUÍA': 'hsl(180, 95%, 35%)',        // Cian brillante
  'TUTORIAL': 'hsl(200, 95%, 38%)',    // Azul brillante
  'INSTRUCCIÓN': 'hsl(220, 95%, 40%)', // Azul profundo brillante
  'EJEMPLO': 'hsl(240, 95%, 42%)',     // Azul-violeta brillante
  'DEMOSTRACIÓN': 'hsl(260, 95%, 45%)', // Violeta brillante
  'EXPLICACIÓN': 'hsl(280, 95%, 48%)', // Púrpura brillante
  'DESCRIPCIÓN': 'hsl(300, 95%, 45%)', // Magenta brillante
  
  // Elementos de interfaz ERP
  'BOTÓN': 'hsl(0, 95%, 45%)',         // Rojo brillante
  'MENÚ': 'hsl(30, 95%, 42%)',         // Naranja brillante
  'PANTALLA': 'hsl(60, 95%, 38%)',     // Amarillo brillante
  'VENTANA': 'hsl(90, 95%, 35%)',      // Verde-amarillo brillante
  'CAMPO': 'hsl(120, 95%, 35%)',       // Verde brillante
  'FORMULARIO': 'hsl(150, 95%, 35%)',  // Verde-cian brillante
  'TABLA': 'hsl(180, 95%, 35%)',       // Cian brillante
  'LISTA': 'hsl(210, 95%, 38%)',       // Azul brillante
  'REPORTE': 'hsl(240, 95%, 40%)',     // Azul-violeta brillante
  'GRÁFICO': 'hsl(270, 95%, 42%)',     // Violeta brillante
  'DASHBOARD': 'hsl(300, 95%, 45%)',   // Magenta brillante
  'PANEL': 'hsl(330, 95%, 45%)',       // Rosa brillante
  
  // Estados y condiciones
  'ESTADO': 'hsl(15, 95%, 42%)',       // Rojo-naranja brillante
  'CONDICIÓN': 'hsl(45, 95%, 40%)',    // Amarillo-naranja brillante
  'SITUACIÓN': 'hsl(75, 95%, 35%)',    // Amarillo-verde brillante
  'ESTATUS': 'hsl(105, 95%, 35%)',     // Verde brillante
  'NIVEL': 'hsl(135, 95%, 35%)',       // Verde-cian brillante
  'GRADO': 'hsl(165, 95%, 35%)',       // Cian-verde brillante
  'TIPO': 'hsl(195, 95%, 38%)',        // Azul-cian brillante
  'CATEGORÍA': 'hsl(225, 95%, 40%)',   // Azul brillante
  'CLASE': 'hsl(255, 95%, 42%)',       // Azul-violeta brillante
  'GRUPO': 'hsl(285, 95%, 45%)',       // Violeta-púrpura brillante
  
  // Fallback por defecto
  'DEFAULT': 'hsl(210, 95%, 42%)',     // Azul estándar vibrante
} as const;
