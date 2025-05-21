declare module 'react-force-graph' {
  import { ComponentType, RefObject } from 'react';

  export interface NodeObject {
    id: string;
    name?: string;
    label?: string;
    val?: number;
    color?: string;
    x?: number;
    y?: number;
    z?: number;
    [key: string]: any;
  }

  export interface LinkObject {
    source: string | NodeObject;
    target: string | NodeObject;
    label?: string;
    color?: string;
    value?: number;
    [key: string]: any;
  }

  export interface GraphData {
    nodes: NodeObject[];
    links: LinkObject[];
  }

  export interface ForceGraphProps {
    graphData: GraphData;
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeColor?: string | ((node: NodeObject) => string);
    nodeVal?: number | ((node: NodeObject) => number);
    linkLabel?: string | ((link: LinkObject) => string);
    linkColor?: string | ((link: LinkObject) => string);
    linkWidth?: number | ((link: LinkObject) => number);
    dagMode?: 'td' | 'bu' | 'lr' | 'rl' | 'radialout' | 'radialin';
    dagLevelDistance?: number;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    warmupTicks?: number;
    cooldownTicks?: number;
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    onNodeHover?: (node: NodeObject | null, previousNode: NodeObject | null) => void;
    onLinkClick?: (link: LinkObject, event: MouseEvent) => void;
    onLinkHover?: (link: LinkObject | null, previousLink: LinkObject | null) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
    onEngineStop?: () => void;
    nodeRelSize?: number;
    nodeId?: string;
    linkSource?: string;
    linkTarget?: string;
    [key: string]: any;
  }

  export const ForceGraph2D: ComponentType<ForceGraphProps>;
  export const ForceGraph3D: ComponentType<ForceGraphProps>;
  export const ForceGraphVR: ComponentType<ForceGraphProps>;
  export const ForceGraphAR: ComponentType<ForceGraphProps>;
}
