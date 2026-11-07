// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, CandlestickSeries, LineSeries, createSeriesMarkers, LineWidth, Time } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Trash2, Save, RefreshCw, AlertCircle, CheckCircle2, Info, Wand2, MousePointer2, Pencil, ChevronDown, Target, Bell, BellOff, X, Settings, Magnet, Sparkles, BarChart2 } from 'lucide-react';
import { useChartGestures, type GesturePoint, type BarData } from '@/hooks/useChartGestures';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { authenticatedApiRequest, ApiError } from '@/lib/apiAuth';
import { useCryptoAuth, isDevelopment } from '@/hooks/useCryptoAuth';
import { runValidation } from '@shared/elliottValidation';
import { calcW5ProjectionLevels } from '@/lib/elliottWave/fibCalculator';
import { useEnsureAuthReady } from '@/hooks/useEnsureAuthReady';
import { useLocation, Link } from 'wouter';
import { CryptoNavigation } from '@/components/CryptoNavigation';
import { usePageViewTracking } from '@/hooks/useAnalytics';
import { AuthButtons } from '@/components/AuthButtons';
import bearTecLogoNew from '@assets/beartec logo_1763645889028.png';
import trainingChartImpulse from '@assets/Screenshot_2025-12-14_14.49.33_1765724048911.png';
import trainingStackPrediction from '@assets/Screenshot_2025-12-14_14.50.07_1765724048821.png';
import trainingStack1Deep from '@assets/Screenshot_2025-12-14_14.53.25_1765724358714.png';
import trainingChart1Deep from '@assets/Screenshot_2025-12-14_14.57.39_1765724358648.png';
import trainingChart2Deep from '@assets/Screenshot_2025-12-14_15.01.03_1765724548776.png';
import trainingStack2Deep from '@assets/Screenshot_2025-12-14_15.01.49_1765724548714.png';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface WavePoint {
  index: number;
  label: string;
  price: number;
  time: number;
  isCorrection: boolean;
  snappedToHigh?: boolean; // True if snapped to candle high, false if snapped to low
  isFutureProjection?: boolean; // True if this point is placed beyond available candle data
  fibLabel?: string; // Fib projection label like "B zig 50%" or "C flat 127%" when snapped to Fib line
}

interface WaveDegree {
  name: string;
  color: string;
  labels: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fibonacciRatios: {
    wave: string;
    ratio: number;
    idealRatio: number;
    validMin: number;
    validMax: number;
    quality: 'excellent' | 'good' | 'ok' | 'valid' | 'poor';
  }[];
  detectedType?: 'zigzag' | 'flat' | 'impulse' | 'triangle' | 'diagonal';
  detectedSubtype?: 'regular_flat' | 'expanded_flat' | 'running_flat';
}

interface ElliottWaveLabel {
  id: string;
  userId: string;
  symbol: string;
  timeframe: string;
  degree: string;
  patternType: string;
  points: WavePoint[];
  isComplete: boolean;
  fibonacciMode: string;
  validationResult?: ValidationResult;
}

interface SavedProjectionLine {
  id: string;
  userId: string;
  symbol: string;
  timeframe: string;
  structureId: string;
  levelLabel: string;
  price: number;
  color: string;
  waveType: string;
  alertEnabled: boolean;
  alertTriggered: boolean;
  createdAt: string;
}

interface WaveStackEntry {
  id: string;
  timeframe: string;
  degree: string;
  patternType: string;
  waveCount: number; // 5 for impulse, 3 for ABC/flat
  direction: 'up' | 'down';
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  suggestedLabel?: string;
}

// Fibonacci projection context for Wave Stack suggestions
interface ProjectionContext {
  waveRole: 'W2' | 'W3' | 'W4' | 'W5' | 'A' | 'B' | 'C' | 'Y' | 'W1_precursor';
  fibMode: 'retracement' | 'extension';
  anchorStartPrice: number;
  anchorEndPrice: number;
  launchPrice: number; // The price to project FROM (e.g., B endpoint for C wave)
  levels: { ratio: number; price: number; label: string }[];
  direction: 'up' | 'down'; // Direction of the projected wave
  sourcePatternInfo?: string; // Info about source pattern for display
}

// Extended type for forming patterns that may expect additional wave types
type FormingWaveRole = 'W3' | 'W4' | 'W5' | 'C' | 'Y';

interface WaveStackSuggestion {
  sequence: string; // e.g., "5-3-5-3-5"
  suggestion: string; // e.g., "Possible W1 or A (Intermediate degree)"
  confidence: 'high' | 'medium' | 'low';
  startPrice: number;
  endPrice: number;
  projections?: ProjectionContext[]; // Fib projections for suggested wave
}

// Grouped structure for Wave Stack table
interface CascadeContribution {
  sourceId: string;
  sourceDegree: string;
  contribution: number; // percentage points contributed
  depth: number; // 1 = direct child, 2 = grandchild, etc.
}

interface GroupedStructure {
  id: string;
  degree: string;
  archetype: string; // 'WXY', 'Zigzag', 'Flat', 'Impulse', 'WXYXZ', etc.
  sequence: string; // '3-3-3', '5-3-5', etc.
  entries: WaveStackEntry[];
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  priceRange: number; // abs(endPrice - startPrice)
  percentMove: number; // percentage change
  duration: number; // time in seconds
  validityScore: number; // 0-100 (intrinsic score before cascade)
  cascadedScore?: number; // 0-100 (final score including child contributions)
  cascadeBreakdown?: CascadeContribution[]; // breakdown of how children contributed
  validityTier: 'excellent' | 'good' | 'fair' | 'poor';
  direction: 'up' | 'down';
  isExpanded?: boolean;
  isForming?: boolean; // True if this is a partial sequence (e.g., 5-3 = W1-W2 or A-B)
  expectedNextWave?: 'W3' | 'W4' | 'W5' | 'C' | 'Y'; // What wave is expected next
  predictiveContext?: ProjectionContext; // Projections for the next expected wave
  childrenIds?: string[]; // IDs of child structures (lower degree)
  parentId?: string; // ID of parent structure (higher degree)
  displayIndex?: number; // 1-based index within this degree for identification
}

// Helper: identify archetype from wave sequence
function identifyArchetype(seq: string, patternTypes: string[]): string {
  const hasTriangle = patternTypes.some(p => p === 'triangle');
  const hasDiagonal = patternTypes.some(p => p === 'diagonal');
  
  if (seq === '5-3-5-3-5') return 'Impulse';
  if (seq === '5-3-5') return 'Zigzag';
  if (seq === '3-3-5') {
    if (patternTypes.length >= 2 && patternTypes[1] === 'triangle') return 'ABC w/ B-tri';
    return 'Flat';
  }
  if (seq === '3-5-5') {
    if (patternTypes.length >= 2 && patternTypes[1] === 'triangle') return 'WXY (X=tri)';
    if (patternTypes.length >= 2 && patternTypes[1] === 'diagonal') return 'WXY (X=diag)';
    return 'WXY';
  }
  if (seq === '3-5-3') {
    if (patternTypes[1] === 'triangle') return 'WXY (X=tri)';
    if (patternTypes[1] === 'diagonal') return 'WXY (X=diag)';
    return 'WXY';
  }
  if (seq === '3-3-3') return 'WXY';
  if (seq === '3-3-3-3-3') {
    const allCorrections = patternTypes.every(p => p === 'abc' || p === 'correction' || p === 'zigzag' || p === 'flat');
    // Return ambiguous archetype - parent context will clarify if it's diagonal internals or triangle
    return allCorrections ? 'Triangle or Diagonal' : 'WXYXZ';
  }
  if (seq === '5-3-3-3') return '1/A + 2/B(WXY)'; // Complete 1/A + 2/B where 2/B is WXY
  if (seq === '5-3-3') return '1/A + 2/B(W-X)'; // 1/A complete, 2/B building as WXY (need Y)
  if (seq === '5-3') return 'W1-W2 / A-B';
  if (seq === '3-3') return 'W-X';
  if (seq === '5') return 'W1/A';
  if (seq === '3') return 'Correction (W2, B, or 4)';
  if (hasTriangle && patternTypes.length === 1 && patternTypes[0] === 'triangle') return 'Triangle';
  if (hasDiagonal && patternTypes.length === 1 && patternTypes[0] === 'diagonal') return 'Diagonal';
  return seq;
}

// Group consecutive same-degree patterns into structures
// KEY: Lower degree patterns are segmented by parent wave timespan
function groupWaveStructures(entries: WaveStackEntry[]): GroupedStructure[] {
  if (entries.length === 0) return [];
  
  // Degree hierarchy (highest to lowest significance)
  const degreeOrder = [
    'Grand Supercycle', 'Supercycle', 'Cycle', 'Primary', 
    'Intermediate', 'Minor', 'Minute', 'Minuette', 'Subminuette'
  ];
  
  // Group by degree first
  const byDegree: Record<string, WaveStackEntry[]> = {};
  entries.forEach(e => {
    if (!byDegree[e.degree]) byDegree[e.degree] = [];
    byDegree[e.degree].push(e);
  });
  
  const structures: GroupedStructure[] = [];
  
  // Helper: create structure from entries
  const createStructure = (
    degree: string, 
    entries: WaveStackEntry[], 
    parentInfo?: { parentDegree: string; parentWaveIndex: number; parentArchetype: string; parentPatternType?: string; parentLabel?: string }
  ): GroupedStructure | null => {
    if (entries.length === 0) return null;
    
    const sorted = entries.sort((a, b) => a.startTime - b.startTime);
    const seq = sorted.map(e => e.waveCount).join('-');
    const patternTypes = sorted.map(e => e.patternType);
    
    let archetype = identifyArchetype(seq, patternTypes);
    
    // Add cross-degree info if this is internal to a parent wave
    if (parentInfo) {
      const { parentDegree, parentWaveIndex, parentArchetype, parentPatternType, parentLabel } = parentInfo;
      
      // CRITICAL: If parent is a diagonal and children are 3-3-3-3-3, they are diagonal internal waves, not a triangle
      if (parentPatternType === 'diagonal' && seq === '3-3-3-3-3') {
        const parentDesc = parentLabel || `${parentDegree} wave`;
        archetype = `Diagonal waves 1-5 = ${parentDesc}`;
        // Return early with this definitive archetype
        const startPrice = sorted[0].startPrice;
        const endPrice = sorted[sorted.length - 1].endPrice;
        const startTime = sorted[0].startTime;
        const endTime = sorted[sorted.length - 1].endTime;
        const priceRange = Math.abs(endPrice - startPrice);
        const percentMove = Math.abs((endPrice - startPrice) / startPrice * 100);
        const duration = endTime - startTime;
        const direction = endPrice > startPrice ? 'up' : 'down';
        const validityScore = calculateStructureValidity(sorted, archetype);
        const validityTier = validityScore >= 80 ? 'excellent' : 
                             validityScore >= 60 ? 'good' : 
                             validityScore >= 40 ? 'fair' : 'poor';
        const idSuffix = `-${parentWaveIndex}`;
        return {
          id: `${degree}-${seq}${idSuffix}`,
          degree,
          archetype,
          sequence: seq,
          entries: sorted,
          startPrice,
          endPrice,
          startTime,
          endTime,
          priceRange,
          percentMove,
          duration,
          validityScore,
          validityTier,
          direction,
          isExpanded: true,
        };
      }
      // Determine wave label based on parent structure
      // Use includes/startsWith for annotated archetypes like 'WXY (X=tri)'
      let waveLabel: string;
      
      // For COMPLETE patterns, use definitive labels
      if (parentArchetype === 'Impulse' || parentArchetype.startsWith('Impulse')) {
        const impulseLabels = ['1', '2', '3', '4', '5'];
        waveLabel = impulseLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('Zigzag') || parentArchetype === '5-3-5') {
        // Zigzag is A-B-C where A=5, B=3, C=5
        const abcLabels = ['A', 'B', 'C'];
        waveLabel = abcLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('Flat') || parentArchetype === '3-3-5' || parentArchetype.includes('ABC')) {
        // Flat is A-B-C where A=3, B=3, C=5
        const abcLabels = ['A', 'B', 'C'];
        waveLabel = abcLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('WXY') || parentArchetype === '3-3-3') {
        // WXY double correction (includes 'WXY (X=tri)', 'WXY (X=diag)', etc.)
        const wxyLabels = ['W', 'X', 'Y'];
        waveLabel = wxyLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('WXYXZ') || parentArchetype === '3-3-3-3-3') {
        // Triple correction
        const wxyxzLabels = ['W', 'X', 'Y', 'X2', 'Z'];
        waveLabel = wxyxzLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('Triangle')) {
        // Triangle ABCDE
        const triLabels = ['A', 'B', 'C', 'D', 'E'];
        waveLabel = triLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.startsWith('Diagonal')) {
        // Diagonal 12345
        const diagLabels = ['1', '2', '3', '4', '5'];
        waveLabel = diagLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      }
      // For INCOMPLETE/AMBIGUOUS patterns, show both possibilities
      else if (parentArchetype === 'W-X' || parentArchetype === '3-3') {
        // 3-3 could be A-B (flat building) or W-X (WXY building)
        const ambiguousLabels = ['A/W', 'B/X', 'C/Y'];
        waveLabel = ambiguousLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.includes('W1-W2') || parentArchetype.includes('A-B') || parentArchetype === '5-3') {
        // 5-3 could be W1-W2 (impulse) or A-B (zigzag)
        const ambiguousLabels = ['1/A', '2/B', '3/C', '4/D', '5/E'];
        waveLabel = ambiguousLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else if (parentArchetype.includes('W1/A') || parentArchetype === '5' || parentArchetype === 'W1/A') {
        // Single impulse could be W1 or A
        waveLabel = parentWaveIndex === 0 ? '1/A' : `${parentWaveIndex + 1}`;
      } else if (parentArchetype === 'Correction' || parentArchetype === '3') {
        // Single correction could be any corrective wave
        const corrLabels = ['A/W', 'B/X', 'C/Y'];
        waveLabel = corrLabels[parentWaveIndex] || `${parentWaveIndex + 1}`;
      } else {
        // Fallback: use numeric labels
        waveLabel = `${parentWaveIndex + 1}`;
      }
      
      archetype = `${archetype} = ${parentDegree} ${waveLabel}`;
    }
    
    const startPrice = sorted[0].startPrice;
    const endPrice = sorted[sorted.length - 1].endPrice;
    const startTime = sorted[0].startTime;
    const endTime = sorted[sorted.length - 1].endTime;
    const priceRange = Math.abs(endPrice - startPrice);
    const percentMove = Math.abs((endPrice - startPrice) / startPrice * 100);
    const duration = endTime - startTime;
    const direction = endPrice > startPrice ? 'up' : 'down';
    
    const validityScore = calculateStructureValidity(sorted, archetype);
    const validityTier = validityScore >= 80 ? 'excellent' : 
                         validityScore >= 60 ? 'good' : 
                         validityScore >= 40 ? 'fair' : 'poor';
    
    const idSuffix = parentInfo ? `-${parentInfo.parentWaveIndex}` : '';
    
    // Detect forming patterns (partial sequences) and set predictive context
    // Many sequences have dual interpretations (e.g., 5-3 could be W1-W2 OR A-B)
    type FormingConfig = { 
      expectedNextWaves: { wave: string; label: string }[]; // Multiple possibilities
      fibMode: 'extension' | 'retracement';
      anchorWaveIdx: number; // Which wave to measure from (0=W1, 1=W2, etc.)
    };
    const formingSequences: Record<string, FormingConfig> = {
      '5': { expectedNextWaves: [{ wave: 'W2', label: 'W2' }, { wave: 'B', label: 'B' }], fibMode: 'retracement', anchorWaveIdx: 0 }, // W1/A only → W2/B
      '5-3': { expectedNextWaves: [{ wave: 'W3', label: 'W3' }, { wave: 'C', label: 'C' }], fibMode: 'extension', anchorWaveIdx: 0 }, // W1-W2 OR A-B
      '5-3-3': { expectedNextWaves: [{ wave: 'Y', label: 'Y (2/B)' }], fibMode: 'extension', anchorWaveIdx: 1 }, // 1/A + 2/B(W-X) → Y to complete 2/B
      '5-3-3-3': { expectedNextWaves: [{ wave: 'W3', label: 'W3' }, { wave: 'C', label: 'C' }], fibMode: 'extension', anchorWaveIdx: 0 }, // W1 + W2(WXY complete) → W3/C
      '5-3-5-3': { expectedNextWaves: [{ wave: 'W5', label: 'W5' }], fibMode: 'extension', anchorWaveIdx: 0 }, // W1-W2-W3-W4 → W5
      '3-3': { expectedNextWaves: [{ wave: 'Y', label: 'Y' }], fibMode: 'extension', anchorWaveIdx: 0 }, // W-X → Y
      '5-3-5': { expectedNextWaves: [{ wave: 'W4', label: 'W4' }], fibMode: 'retracement', anchorWaveIdx: 2 }, // W1-W2-W3 → W4
      // Note: Single '3' correction excluded - needs prior wave structure for measurement calculations
    };
    
    const formingInfo = formingSequences[seq];
    const isForming = !!formingInfo;
    // Show primary expected wave in badge, but track all possibilities
    const expectedNextWave = formingInfo?.expectedNextWaves?.[0]?.wave as 'W3' | 'W4' | 'W5' | 'C' | 'Y' | undefined;
    const allExpectedWaves = formingInfo?.expectedNextWaves || [];
    
    // Compute predictive context for forming patterns (uses primary wave's ratios)
    let predictiveContext: ProjectionContext | undefined;
    if (isForming && sorted.length >= 1 && formingInfo) {
      const lastEntry = sorted[sorted.length - 1];
      const launchPrice = lastEntry.endPrice;
      
      // Get the anchor wave for Fib calculations
      const anchorIdx = Math.min(formingInfo.anchorWaveIdx, sorted.length - 1);
      const anchorWave = sorted[anchorIdx];
      const anchorRange = Math.abs(anchorWave.endPrice - anchorWave.startPrice);
      
      // Determine direction based on expected wave type
      const trendDirection = sorted[0].direction;
      const nextDirection: 'up' | 'down' = formingInfo.fibMode === 'retracement'
        ? (trendDirection === 'up' ? 'down' : 'up')
        : trendDirection;
      
      // Build levels for ALL expected waves with labels indicating which wave
      const levels: { ratio: number; price: number; label: string }[] = [];
      
      allExpectedWaves.forEach(({ wave, label }) => {
        let ratios: number[];
        if (wave === 'W3' || wave === 'C') {
          ratios = [1.0, 1.272, 1.618, 2.0, 2.618];
        } else if (wave === 'W5') {
          ratios = [0.618, 0.786, 1.0, 1.618];
        } else if (wave === 'W4') {
          ratios = [0.236, 0.382, 0.5];
        } else if (wave === 'W2') {
          ratios = [0.382, 0.5, 0.618, 0.786]; // W2 retracement ratios
        } else if (wave === 'B') {
          // B wave: include BOTH zigzag (38-79%) AND flat (88-138%) targets
          ratios = [0.382, 0.5, 0.618, 0.786, 0.886, 1.0, 1.236, 1.382];
        } else if (wave === 'Y') {
          ratios = [0.618, 1.0, 1.272, 1.618];
        } else {
          ratios = [0.618, 1.0, 1.272];
        }
        
        ratios.forEach(ratio => {
          const price = nextDirection === 'up'
            ? launchPrice + (anchorRange * ratio)
            : launchPrice - (anchorRange * ratio);
          // Label includes wave type if multiple possibilities
          const ratioLabel = allExpectedWaves.length > 1 
            ? `${label} ${(ratio * 100).toFixed(0)}%`
            : `${(ratio * 100).toFixed(0)}%`;
          levels.push({ ratio, price, label: ratioLabel });
        });
      });
      
      predictiveContext = {
        waveRole: expectedNextWave as any,
        fibMode: formingInfo.fibMode,
        anchorStartPrice: anchorWave.startPrice,
        anchorEndPrice: anchorWave.endPrice,
        launchPrice,
        levels,
        direction: nextDirection,
        sourcePatternInfo: allExpectedWaves.length > 1 
          ? `${degree} ${allExpectedWaves.map(w => w.label).join('/')}`
          : `${degree} ${expectedNextWave}`,
      };
    }
    
    return {
      id: `${degree}-${seq}${idSuffix}`,
      degree,
      archetype,
      sequence: seq,
      entries: sorted,
      startPrice,
      endPrice,
      startTime,
      endTime,
      priceRange,
      percentMove,
      duration,
      validityScore,
      validityTier,
      direction,
      isExpanded: true,
      isForming,
      expectedNextWave,
      predictiveContext,
    };
  };
  
  // Helper: check if a time falls within a range (with small tolerance)
  const isWithinTimespan = (time: number, start: number, end: number): boolean => {
    const tolerance = (end - start) * 0.05; // 5% tolerance at boundaries
    return time >= (start - tolerance) && time <= (end + tolerance);
  };
  
  // Find which degrees exist in entries
  const presentDegrees = degreeOrder.filter(d => byDegree[d] && byDegree[d].length > 0);
  
  // Map to track structure displayIndex for each wave entry (by its startTime)
  // Key: `${degree}-${waveEntryStartTime}`, Value: displayIndex of containing structure
  const waveEntryToStructureIndex: Record<string, number> = {};
  
  // Helper to generate semantic label from archetype and position
  const getSemanticLabel = (archetype: string, position: number): string => {
    if (archetype === 'Impulse' || archetype.startsWith('Impulse')) {
      const labels = ['1', '2', '3', '4', '5'];
      return labels[position] || `${position + 1}`;
    } else if (archetype.startsWith('Flat') || archetype === '3-3-5' || archetype.startsWith('Zigzag') || archetype === '5-3-5') {
      const labels = ['A', 'B', 'C'];
      return labels[position] || `${position + 1}`;
    } else if (archetype.startsWith('WXY') || archetype === '3-3-3') {
      const labels = ['W', 'X', 'Y'];
      return labels[position] || `${position + 1}`;
    } else if (archetype.startsWith('WXYXZ') || archetype === '3-3-3-3-3') {
      const labels = ['W', 'X', 'Y', 'X2', 'Z'];
      return labels[position] || `${position + 1}`;
    } else if (archetype.startsWith('Triangle')) {
      const labels = ['A', 'B', 'C', 'D', 'E'];
      return labels[position] || `${position + 1}`;
    } else if (archetype.startsWith('Diagonal')) {
      const labels = ['1', '2', '3', '4', '5'];
      return labels[position] || `${position + 1}`;
    }
    return `${position + 1}`;
  };
  
  // Process each degree, segmenting lower degrees by parent wave timespans
  // This is the ORIGINAL per-wave-entry approach that correctly segments by parent timespan
  for (let i = 0; i < presentDegrees.length; i++) {
    const currentDegree = presentDegrees[i];
    const currentEntries = byDegree[currentDegree];
    const sortedCurrent = [...currentEntries].sort((a, b) => a.startTime - b.startTime);
    
    // Check if there's a higher degree that should be the parent
    const higherDegreeIdx = degreeOrder.indexOf(currentDegree) - 1;
    let hasParent = false;
    
    if (higherDegreeIdx >= 0) {
      const higherDegree = degreeOrder[higherDegreeIdx];
      const higherEntries = byDegree[higherDegree];
      
      if (higherEntries && higherEntries.length > 0) {
        const sortedHigher = [...higherEntries].sort((a, b) => a.startTime - b.startTime);
        
        // Get parent's archetype for semantic labeling
        const parentSeq = sortedHigher.map(e => e.waveCount).join('-');
        const parentTypes = sortedHigher.map(e => e.patternType);
        const parentArchetype = identifyArchetype(parentSeq, parentTypes);
        
        // Track how many structures we create at this degree (for displayIndex)
        let structureCount = structures.filter(s => s.degree === currentDegree).length;
        
        // TIME-OVERLAP BASED MATCHING: Find best parent for each child based on overlap
        // This handles "backward drawing" where internals are drawn after higher degree
        // Step 1: Build a map of child -> best parent (by overlap score)
        const childToBestParent: Map<string, { parentIdx: number; overlap: number }> = new Map();
        
        for (const child of sortedCurrent) {
          let bestParentIdx = -1;
          let bestOverlap = -Infinity; // Allow any valid match, not just positive scores
          
          for (let parentIdx = 0; parentIdx < sortedHigher.length; parentIdx++) {
            const parent = sortedHigher[parentIdx];
            const tolerance = (parent.endTime - parent.startTime) * 0.05;
            
            // Check if child fits within parent
            const startsWithinParent = child.startTime >= (parent.startTime - tolerance) && 
                                        child.startTime < parent.endTime;
            const endsWithinParent = child.endTime <= (parent.endTime + tolerance);
            
            if (startsWithinParent && endsWithinParent) {
              // Calculate overlap score using ACTUAL TIME INTERSECTION
              // This correctly assigns children to shorter parents (like C) over longer parents (like A)
              const parentDuration = parent.endTime - parent.startTime;
              const childDuration = child.endTime - child.startTime;
              
              // Intersection: how much of the child overlaps with the parent
              const intersectStart = Math.max(child.startTime, parent.startTime);
              const intersectEnd = Math.min(child.endTime, parent.endTime);
              const intersectionDuration = Math.max(0, intersectEnd - intersectStart);
              
              // PRIMARY METRIC: What % of the child is covered by this parent?
              // A child fully inside C will have 100% coverage from C, but only partial from A
              const childCoverage = childDuration > 0 ? intersectionDuration / childDuration : 0;
              
              // SECONDARY METRIC: What % of the parent is filled by the child?
              // Prefer parents where the child fills a larger portion (tighter fit)
              const parentFill = parentDuration > 0 ? intersectionDuration / parentDuration : 0;
              
              // Bonus for exact boundary matches (internal structure spans entire parent)
              const startMatch = Math.abs(child.startTime - parent.startTime) < tolerance ? 0.1 : 0;
              const endMatch = Math.abs(child.endTime - parent.endTime) < tolerance ? 0.1 : 0;
              
              // Combined score: prioritize child coverage, then parent fill, then boundary matches
              const overlap = childCoverage * 1.0 + parentFill * 0.5 + startMatch + endMatch;
              
              if (overlap > bestOverlap) {
                bestOverlap = overlap;
                bestParentIdx = parentIdx;
              }
            }
          }
          
          if (bestParentIdx >= 0) {
            childToBestParent.set(child.id, { parentIdx: bestParentIdx, overlap: bestOverlap });
          }
        }
        
        // Step 2: Group children by their best parent
        for (let parentIdx = 0; parentIdx < sortedHigher.length; parentIdx++) {
          const parent = sortedHigher[parentIdx];
          
          // Find children assigned to this parent
          const childPatterns = sortedCurrent.filter(child => {
            const match = childToBestParent.get(child.id);
            return match && match.parentIdx === parentIdx;
          });
          
          if (childPatterns.length > 0) {
            hasParent = true;
            structureCount++;
            
            // Also pass individual parent's patternType for diagonal/triangle disambiguation
            const parentPatternType = parent.patternType;
            
            // Generate semantic wave label based on parent's position in higher degree archetype
            const semanticLabel = getSemanticLabel(parentArchetype, parentIdx);
            
            // Look up parent wave entry's structure displayIndex if available
            const parentWaveKey = `${higherDegree}-${parent.startTime}`;
            const parentDisplayIdx = waveEntryToStructureIndex[parentWaveKey] || (parentIdx + 1);
            const parentLabel = parent.suggestedLabel || `${higherDegree} ${parentDisplayIdx}`;
            
            const structure = createStructure(currentDegree, childPatterns, {
              parentDegree: higherDegree,
              parentWaveIndex: parentIdx,
              parentArchetype,
              parentPatternType,
              parentLabel
            });
            if (structure) {
              structure.displayIndex = structureCount;
              structures.push(structure);
              
              // Record each wave entry's structure index for child degrees to reference
              structure.entries.forEach(entry => {
                const entryKey = `${currentDegree}-${entry.startTime}`;
                waveEntryToStructureIndex[entryKey] = structureCount;
              });
            }
          }
        }
        
        // Also check for patterns that fall BETWEEN or AFTER parent waves (orphans)
        // Use the already-computed childToBestParent map for consistency
        const assignedIds = new Set(childToBestParent.keys());
        
        const orphanPatterns = sortedCurrent.filter(child => !assignedIds.has(child.id));
        
        // Track orphans that get their own structure (to avoid re-processing in "no parent" path)
        const orphanStructureIds = new Set<string>();
        
        // Group orphans into separate structures based on time gaps and pattern boundaries
        if (orphanPatterns.length > 0) {
          let currentOrphanGroup: WaveStackEntry[] = [];
          
          for (let idx = 0; idx < orphanPatterns.length; idx++) {
            const entry = orphanPatterns[idx];
            
            if (currentOrphanGroup.length > 0) {
              const lastEntry = currentOrphanGroup[currentOrphanGroup.length - 1];
              const timeGap = entry.startTime - lastEntry.endTime;
              const avgDuration = currentOrphanGroup.reduce((sum, e) => sum + (e.endTime - e.startTime), 0) / currentOrphanGroup.length;
              
              let shouldSplit = false;
              
              // Split if significant time gap (new wave sequence starting)
              if (timeGap > avgDuration * 0.5) {
                shouldSplit = true;
              }
              
              // NOTE: 5-3 followed by 3 can build towards 5-3-3-3 (W1 + WXY as W2)
              // Only split if a NEW 5-wave starts (indicating new impulse/zigzag)
              const currentSeq = currentOrphanGroup.map(e => e.waveCount).join('-');
              if ((currentSeq === '5-3-3-3' || currentSeq === '3-3-3') && entry.waveCount === 5) {
                // After complete WXY (3-3-3) or W1+W2(WXY), a new 5-wave starts a new structure
                shouldSplit = true;
              }
              
              if (shouldSplit) {
                structureCount++;
                const structure = createStructure(currentDegree, currentOrphanGroup);
                if (structure) {
                  structure.displayIndex = structureCount;
                  structures.push(structure);
                  structure.entries.forEach(e => {
                    const entryKey = `${currentDegree}-${e.startTime}`;
                    waveEntryToStructureIndex[entryKey] = structureCount;
                    orphanStructureIds.add(e.id); // Mark as processed
                  });
                }
                currentOrphanGroup = [];
              }
            }
            
            currentOrphanGroup.push(entry);
          }
          
          // Emit final orphan group
          if (currentOrphanGroup.length > 0) {
            structureCount++;
            const structure = createStructure(currentDegree, currentOrphanGroup);
            if (structure) {
              structure.displayIndex = structureCount;
              structures.push(structure);
              structure.entries.forEach(entry => {
                const entryKey = `${currentDegree}-${entry.startTime}`;
                waveEntryToStructureIndex[entryKey] = structureCount;
                orphanStructureIds.add(entry.id); // Mark as processed
              });
            }
          }
        }
        
        // If ALL patterns at this degree were processed as orphans, skip the "no parent" path
        if (orphanStructureIds.size === sortedCurrent.length) {
          hasParent = true; // Pretend we have a parent to skip the no-parent path
        }
      }
    }
    
    // If no parent exists, split ONLY when we have a complete high-level structure
    // followed by a completely separate structure (different time, different trend)
    // Key: ABC/Impulse should stay together, but a NEW impulse after ABC ends = new structure
    if (!hasParent) {
      let existingCount = structures.filter(s => s.degree === currentDegree).length;
      let currentGroup: WaveStackEntry[] = [];
      
      // Helper to validate if entries can form a valid triangle
      // Triangle rules: B cannot break A's origin, C cannot break A's end
      const isValidTriangle = (group: WaveStackEntry[]): boolean => {
        if (group.length < 3) return true; // Not enough waves to validate
        
        const waveA = group[0];
        const waveB = group[1];
        const waveC = group.length > 2 ? group[2] : null;
        
        // Determine if bullish or bearish triangle
        const isBullish = waveA.direction === 'down'; // A goes down in bullish triangle
        
        if (isBullish) {
          // Bullish triangle: A goes down, B goes up
          // B cannot break A's origin (A's start/high)
          if (waveB.endPrice > waveA.startPrice) return false;
          // C cannot break A's end (A's end/low)
          if (waveC && waveC.endPrice < waveA.endPrice) return false;
        } else {
          // Bearish triangle: A goes up, B goes down
          // B cannot break A's origin (A's start/low)
          if (waveB.endPrice < waveA.startPrice) return false;
          // C cannot break A's end (A's end/high)
          if (waveC && waveC.endPrice > waveA.endPrice) return false;
        }
        
        return true;
      };
      
      // Helper to check if adding next entry would extend past a complete pattern
      // Returns true if current group should be split before adding next entry
      const shouldSplitBeforeNext = (group: WaveStackEntry[], nextEntry: WaveStackEntry): boolean => {
        if (group.length === 0) return false;
        
        const currentSeq = group.map(e => e.waveCount).join('-');
        
        // Check if current sequence is a complete pattern
        // Flat (3-3-5), Zigzag (5-3-5), WXY (3-3-3), Impulse (5-3-5-3-5), Triangle (3-3-3-3-3)
        const completePatterns = ['3-3-5', '5-3-5', '3-3-3', '5-3-5-3-5', '3-3-3-3-3'];
        
        if (completePatterns.includes(currentSeq)) {
          // Current group is complete - check if next would break the pattern
          // Exception: 3-3-3 could continue towards 3-3-3-3-3 (triangle) if valid
          if (currentSeq === '3-3-3') {
            // Only continue grouping if heading towards valid triangle
            const potentialGroup = [...group, nextEntry];
            if (nextEntry.waveCount === 3 && isValidTriangle(potentialGroup)) {
              return false; // Allow continuing towards triangle
            }
          }
          return true; // Split before adding next entry
        }
        
        // Check if we're at 3-3-3-3 and next is a 3 (potential triangle completion)
        if (currentSeq === '3-3-3-3' && nextEntry.waveCount === 3) {
          const potentialGroup = [...group, nextEntry];
          if (!isValidTriangle(potentialGroup)) {
            return true; // Invalid triangle - split here
          }
        }
        
        // Handle W1+W2(WXY) pattern: 5-3 can continue to 5-3-3-3 
        // 5-3 followed by 3 builds towards W1 + W2(WXY) - don't split
        // 5-3-3-3 followed by 5 starts a new impulse (W3) - split after complete W2
        if ((currentSeq === '5-3-3-3' || currentSeq === '3-3-3') && nextEntry.waveCount === 5) {
          // After complete WXY or W1+W2(WXY), a new 5-wave starts a new structure
          return true;
        }
        
        return false;
      };
      
      for (let i = 0; i < sortedCurrent.length; i++) {
        const entry = sortedCurrent[i];
        
        // Check if adding this entry would extend past a complete pattern
        if (shouldSplitBeforeNext(currentGroup, entry)) {
          // Emit current structure before adding new entry
          existingCount++;
          const structure = createStructure(currentDegree, currentGroup);
          if (structure) {
            structure.displayIndex = existingCount;
            structures.push(structure);
            structure.entries.forEach(e => {
              const entryKey = `${currentDegree}-${e.startTime}`;
              waveEntryToStructureIndex[entryKey] = existingCount;
            });
          }
          // Start new group
          currentGroup = [];
        }
        
        // Add entry to current group
        currentGroup.push(entry);
      }
      
      // Emit final group
      if (currentGroup.length > 0) {
        existingCount++;
        const structure = createStructure(currentDegree, currentGroup);
        if (structure) {
          structure.displayIndex = existingCount;
          structures.push(structure);
          structure.entries.forEach(entry => {
            const entryKey = `${currentDegree}-${entry.startTime}`;
            waveEntryToStructureIndex[entryKey] = existingCount;
          });
        }
      }
    }
  }
  
  // Sort by degree order (highest first), then by time
  structures.sort((a, b) => {
    const degreeCompare = degreeOrder.indexOf(a.degree) - degreeOrder.indexOf(b.degree);
    if (degreeCompare !== 0) return degreeCompare;
    return a.startTime - b.startTime;
  });
  
  // Re-assign displayIndex per degree after final sort
  const indexByDegree: Record<string, number> = {};
  structures.forEach(s => {
    if (!indexByDegree[s.degree]) indexByDegree[s.degree] = 0;
    indexByDegree[s.degree]++;
    s.displayIndex = indexByDegree[s.degree];
    // Update the map with final indices for each wave entry
    s.entries.forEach(entry => {
      const entryKey = `${s.degree}-${entry.startTime}`;
      waveEntryToStructureIndex[entryKey] = s.displayIndex!;
    });
  });
  
  return structures;
}

// Helper: Get child structures for a specific parent wave entry
// Maps child structures to the parent entry whose timespan contains them
function getChildrenForEntry(
  entry: WaveStackEntry, 
  structure: GroupedStructure, 
  allStructures: GroupedStructure[]
): GroupedStructure[] {
  if (!structure.childrenIds || structure.childrenIds.length === 0) return [];
  
  return allStructures.filter(child => {
    if (!structure.childrenIds?.includes(child.id)) return false;
    
    // Check if child falls within this specific entry's timespan
    const tolerance = (entry.endTime - entry.startTime) * 0.1;
    return child.startTime >= (entry.startTime - tolerance) &&
           child.endTime <= (entry.endTime + tolerance);
  });
}

// Helper: Get context-aware wave role label for a child structure
// Instead of generic "W1/A", shows what parent wave it's completing
function getContextualWaveRole(
  childStructure: GroupedStructure,
  parentEntry: WaveStackEntry,
  parentStructure: GroupedStructure,
  entryIndex: number // 0-based index within parent entries
): string {
  const parentArchetype = parentStructure.archetype;
  
  // Determine what wave this entry represents in the parent structure
  let parentWaveLabel: string;
  if (parentArchetype.includes('WXY')) {
    parentWaveLabel = entryIndex === 0 ? 'W' : entryIndex === 1 ? 'X' : 'Y';
  } else if (parentArchetype === 'Impulse') {
    parentWaveLabel = String(entryIndex * 2 + 1); // 1, 3, 5 for motive waves
  } else {
    // ABC type corrections
    parentWaveLabel = ['A', 'B', 'C', 'D', 'E'][entryIndex] || String(entryIndex + 1);
  }
  
  // For motive waves (5-count), child completes this wave
  // For corrective waves (3-count), child is the internal structure
  const isMotiveEntry = parentEntry.waveCount === 5;
  const isCorrectionEntry = parentEntry.waveCount === 3;
  
  if (isMotiveEntry) {
    // This is a 5-wave motive - child completes it
    return `= ${parentStructure.degree} ${parentWaveLabel}`;
  } else if (isCorrectionEntry) {
    // This is a 3-wave correction - child is internal structure
    return `= ${parentStructure.degree} ${parentWaveLabel}`;
  }
  
  return `= ${parentStructure.degree} ${parentWaveLabel}`;
}

// Helper: Get completion chain - what higher degree waves are completed by this structure
function getCompletionChain(
  structure: GroupedStructure,
  allStructures: GroupedStructure[]
): string[] {
  const chain: string[] = [];
  
  // Find parent structure
  if (!structure.parentId) return chain;
  
  const parent = allStructures.find(s => s.id === structure.parentId);
  if (!parent) return chain;
  
  // Find which entry in parent this structure belongs to
  const parentEntry = parent.entries.find(entry => {
    const tolerance = (entry.endTime - entry.startTime) * 0.1;
    return structure.startTime >= (entry.startTime - tolerance) &&
           structure.endTime <= (entry.endTime + tolerance);
  });
  
  if (!parentEntry) return chain;
  
  // Check if this is the LAST entry in the parent (completes the structure)
  const entryIndex = parent.entries.findIndex(e => e.id === parentEntry.id);
  const isLastEntry = entryIndex === parent.entries.length - 1;
  
  // Determine wave label
  let waveLabel: string;
  if (parent.archetype.includes('WXY')) {
    waveLabel = entryIndex === 0 ? 'W' : entryIndex === 1 ? 'X' : 'Y';
  } else if (parent.archetype === 'Impulse') {
    waveLabel = ['1', '2', '3', '4', '5'][entryIndex] || String(entryIndex + 1);
  } else {
    waveLabel = ['A', 'B', 'C', 'D', 'E'][entryIndex] || String(entryIndex + 1);
  }
  
  chain.push(`${parent.degree} ${waveLabel}`);
  
  // If this completes the parent, recurse up
  if (isLastEntry) {
    const parentChain = getCompletionChain(parent, allStructures);
    chain.push(...parentChain);
  }
  
  return chain;
}

// Calculate validity score for a grouped structure
function calculateStructureValidity(entries: WaveStackEntry[], archetype: string): number {
  let score = 50; // Base score
  
  // Bonus for recognized archetypes
  if (['Impulse', 'Zigzag', 'Flat', 'WXY', 'WXYXZ', 'W1-W2'].includes(archetype)) {
    score += 20;
  }
  
  // Check wave proportions for WXY (W and Y should be similar)
  if (archetype === 'WXY' && entries.length >= 3) {
    const wLength = Math.abs(entries[0].endPrice - entries[0].startPrice);
    const yLength = Math.abs(entries[2].endPrice - entries[2].startPrice);
    const ratio = Math.min(wLength, yLength) / Math.max(wLength, yLength);
    // Ideally W and Y are similar (ratio close to 1)
    if (ratio >= 0.618) score += 15;
    else if (ratio >= 0.382) score += 10;
    else score += 5;
  }
  
  // Check for alternation in Zigzag/Impulse
  if ((archetype === 'Zigzag' || archetype === 'Impulse') && entries.length >= 2) {
    let alternates = true;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].direction === entries[i-1].direction) {
        alternates = false;
        break;
      }
    }
    if (alternates) score += 15;
  }
  
  // Bonus for complete patterns (odd wave counts usually)
  if (entries.length >= 3) score += 5;
  if (entries.length >= 5) score += 5;
  
  // Cap at 100
  return Math.min(100, Math.max(0, score));
}

// Compute cascaded validity scores across generations
// Lower degree pattern scores cascade up to boost/reduce higher degree scores
// Formula: cascadedScore = baseScore × 0.6 + weightedDescendantAverage × 0.4
// Decay: direct children at 1.0, grandchildren at 0.6, great-grandchildren at 0.36, etc.
function computeCascadeScores(structures: GroupedStructure[]): GroupedStructure[] {
  if (structures.length === 0) return structures;
  
  const degreeOrder = [
    'Grand Supercycle', 'Supercycle', 'Cycle', 'Primary', 
    'Intermediate', 'Minor', 'Minute', 'Minuette', 'Subminuette'
  ];
  
  // Scoring weights
  const BASE_WEIGHT = 0.6; // 60% from intrinsic score
  const DESCENDANT_WEIGHT = 0.4; // 40% from descendants
  const DEPTH_DECAY = 0.6; // Each generation deeper is weighted at 60% of previous
  
  // Helper: check if child timespan is truly INTERNAL to parent timespan
  // Child must START before parent ENDS - patterns that start after parent completes are new structures
  const isWithin = (child: GroupedStructure, parent: GroupedStructure): boolean => {
    const tolerance = (parent.endTime - parent.startTime) * 0.05;
    const startsWithinParent = child.startTime >= (parent.startTime - tolerance) && 
                                child.startTime < parent.endTime; // Must start BEFORE parent ends
    const endsWithinParent = child.endTime <= (parent.endTime + tolerance);
    return startsWithinParent && endsWithinParent;
  };
  
  // Build parent-child relationships based on degree and timespan containment
  const structureMap = new Map<string, GroupedStructure>();
  structures.forEach(s => structureMap.set(s.id, s));
  
  // Initialize relationship arrays
  structures.forEach(s => {
    s.childrenIds = [];
    s.parentId = undefined;
    s.cascadeBreakdown = [];
  });
  
  // Find parent-child relationships
  // Look for ANY higher degree parent (not just one degree higher) to handle skipped degrees
  for (let i = 0; i < structures.length; i++) {
    const child = structures[i];
    const childDegreeIdx = degreeOrder.indexOf(child.degree);
    
    // Look for potential parent at ANY higher degree (closest first)
    for (let parentDegreeIdx = childDegreeIdx - 1; parentDegreeIdx >= 0; parentDegreeIdx--) {
      const parentDegree = degreeOrder[parentDegreeIdx];
      let foundParent = false;
      
      // Find parent that contains this child
      for (const potentialParent of structures) {
        if (potentialParent.degree === parentDegree && isWithin(child, potentialParent)) {
          child.parentId = potentialParent.id;
          potentialParent.childrenIds = potentialParent.childrenIds || [];
          potentialParent.childrenIds.push(child.id);
          foundParent = true;
          break; // Only one parent per child at this degree
        }
      }
      
      if (foundParent) break; // Stop looking for higher degrees once we found a parent
    }
  }
  
  // Collect all descendants with proper depth-based weights
  interface DescendantInfo {
    id: string;
    degree: string;
    intrinsicScore: number;
    depth: number;
    weight: number; // DEPTH_DECAY^(depth-1)
  }
  
  const getDescendants = (structureId: string, currentDepth: number = 1): DescendantInfo[] => {
    const structure = structureMap.get(structureId);
    if (!structure) return [];
    
    const children = structure.childrenIds || [];
    const descendants: DescendantInfo[] = [];
    
    for (const childId of children) {
      const child = structureMap.get(childId);
      if (child) {
        const weight = Math.pow(DEPTH_DECAY, currentDepth - 1);
        descendants.push({
          id: childId,
          degree: child.degree,
          intrinsicScore: child.validityScore,
          depth: currentDepth,
          weight
        });
        // Recursively get grandchildren, great-grandchildren, etc.
        const grandDescendants = getDescendants(childId, currentDepth + 1);
        descendants.push(...grandDescendants);
      }
    }
    
    return descendants;
  };
  
  // Compute cascaded scores for all structures
  for (const structure of structures) {
    const descendants = getDescendants(structure.id);
    
    if (descendants.length === 0) {
      // Leaf node: cascaded score = intrinsic score
      structure.cascadedScore = structure.validityScore;
      structure.cascadeBreakdown = [];
    } else {
      // Calculate weighted average of all descendants
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const desc of descendants) {
        totalWeightedScore += desc.intrinsicScore * desc.weight;
        totalWeight += desc.weight;
      }
      
      const weightedDescendantAverage = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      
      // Final score: 60% base + 40% descendants
      const cascadedScore = structure.validityScore * BASE_WEIGHT + weightedDescendantAverage * DESCENDANT_WEIGHT;
      structure.cascadedScore = Math.min(100, Math.max(0, Math.round(cascadedScore)));
      
      // Calculate actual marginal contribution from each descendant for tooltip
      // Each descendant contributes: (intrinsicScore × weight / totalWeight) × DESCENDANT_WEIGHT
      // This is the actual percentage points added/subtracted to the final score
      const contributions: CascadeContribution[] = [];
      for (const desc of descendants) {
        // True marginal contribution = (weighted score share) × 40%
        const actualContribution = (desc.intrinsicScore * desc.weight / totalWeight) * DESCENDANT_WEIGHT;
        
        if (Math.abs(actualContribution) >= 0.5) { // Only show contributions >= 0.5%
          contributions.push({
            sourceId: desc.id,
            sourceDegree: desc.degree,
            contribution: Math.round(actualContribution * 10) / 10,
            depth: desc.depth
          });
        }
      }
      
      // Sort by absolute contribution (highest first) and limit to top contributors
      contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      structure.cascadeBreakdown = contributions.slice(0, 8);
    }
  }
  
  // Update validity tiers based on cascaded scores
  structures.forEach(s => {
    const score = s.cascadedScore ?? s.validityScore;
    s.validityTier = score >= 80 ? 'excellent' : 
                     score >= 60 ? 'good' : 
                     score >= 40 ? 'fair' : 'poor';
  });
  
  return structures;
}

// Helper: Calculate maximum nested depth below an entry (counts unique degrees)
function getNestedDepth(entry: WaveStackEntry, parentStructure: GroupedStructure, allStructures: GroupedStructure[], visited = new Set<string>()): number {
  if (visited.has(entry.id)) return 0;
  visited.add(entry.id);
  
  const children = getChildrenForEntry(entry, parentStructure, allStructures);
  if (children.length === 0) return 0;
  
  let maxDepth = 0;
  for (const childStructure of children) {
    // Each child structure is 1 level deep
    let childMaxDepth = 1;
    // Check if any entry in this child structure has further children
    for (const childEntry of childStructure.entries) {
      const entryDepth = getNestedDepth(childEntry, childStructure, allStructures, visited);
      childMaxDepth = Math.max(childMaxDepth, 1 + entryDepth);
    }
    maxDepth = Math.max(maxDepth, childMaxDepth);
  }
  
  return maxDepth;
}

// Recursive Wave Entry Row Component for hierarchical tree display
interface WaveEntryRowProps {
  entry: WaveStackEntry;
  parentStructure: GroupedStructure;
  entryIndex: number;
  allStructures: GroupedStructure[];
  depth: number;
  expandedEntries: Set<string>;
  toggleEntry: (id: string) => void;
  selectedLabelId: string | null;
  setSelectedLabelId: (id: string | null) => void;
  deleteLabel: { mutate: (id: string) => void };
  updateLabel: { mutate: (data: { id: string; degree: string }) => void };
  toast: (opts: { title: string; description: string }) => void;
  waveDegrees: WaveDegree[];
  timeframe: string;
  setTimeframe: (tf: string) => void;
}

function WaveEntryRow({
  entry,
  parentStructure,
  entryIndex,
  allStructures,
  depth,
  expandedEntries,
  toggleEntry,
  selectedLabelId,
  setSelectedLabelId,
  deleteLabel,
  updateLabel,
  toast,
  waveDegrees,
  timeframe,
  setTimeframe
}: WaveEntryRowProps) {
  // Get child structures for this entry
  const entryChildren = getChildrenForEntry(entry, parentStructure, allStructures);
  const hasChildren = entryChildren.length > 0;
  const isExpanded = expandedEntries.has(entry.id);
  
  // Determine wave label based on parent archetype
  // For ambiguous patterns (single impulse/correction), show dual labels like "1/A"
  const getWaveLabelForArchetype = (archetype: string, idx: number): string => {
    // WXY patterns
    if (archetype.includes('WXY') || archetype === 'W-X' || archetype === '3-3-3' || archetype === '3-3') {
      const wxyLabels = ['W', 'X', 'Y', 'X2', 'Z'];
      return wxyLabels[idx] || String(idx + 1);
    }
    // Impulse (complete 5-wave)
    if (archetype === 'Impulse' || archetype.startsWith('Impulse')) {
      const impulseLabels = ['1', '2', '3', '4', '5'];
      return impulseLabels[idx] || String(idx + 1);
    }
    // Zigzag (5-3-5)
    if (archetype === 'Zigzag' || archetype === '5-3-5') {
      const abcLabels = ['A', 'B', 'C'];
      return abcLabels[idx] || String(idx + 1);
    }
    // Flat (3-3-5)
    if (archetype === 'Flat' || archetype === '3-3-5') {
      const abcLabels = ['A', 'B', 'C'];
      return abcLabels[idx] || String(idx + 1);
    }
    // Triangle or Diagonal (5 waves)
    if (archetype.includes('Triangle') || archetype.includes('Diagonal')) {
      const fiveLabels = archetype.includes('Triangle') ? ['A', 'B', 'C', 'D', 'E'] : ['1', '2', '3', '4', '5'];
      return fiveLabels[idx] || String(idx + 1);
    }
    // AMBIGUOUS: Single impulse could be W1 or A
    if (archetype === 'W1/A' || archetype === '5') {
      return idx === 0 ? '1/A' : String(idx + 1);
    }
    // AMBIGUOUS: 5-3 could be W1-W2 (impulse building) or A-B (zigzag building)
    if (archetype.includes('W1-W2') || archetype.includes('A-B') || archetype === '5-3') {
      const ambiguousLabels = ['1/A', '2/B', '3/C', '4', '5'];
      return ambiguousLabels[idx] || String(idx + 1);
    }
    // AMBIGUOUS: Single correction could be A or W
    if (archetype === 'Correction' || archetype === '3') {
      return idx === 0 ? 'A/W' : String(idx + 1);
    }
    // Default: ABC labels
    const defaultLabels = ['A', 'B', 'C', 'D', 'E'];
    return defaultLabels[idx] || String(idx + 1);
  };
  
  const waveLabel = getWaveLabelForArchetype(parentStructure.archetype, entryIndex);
  
  const degreeColor = waveDegrees.find((d: WaveDegree) => d.name === parentStructure.degree)?.color || '#74C0FC';
  const indentPx = depth * 16;
  
  return (
    <div>
      {/* Entry Row */}
      <div 
        className={`flex items-center gap-2 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer min-w-max ${
          selectedLabelId === entry.id ? 'bg-cyan-900/20' : ''
        }`}
        style={{ paddingLeft: `${12 + indentPx}px`, paddingRight: '12px' }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            // 3-click cycle for parent waves with children:
            // 1. First click (collapsed) → Expand
            // 2. Second click (expanded, not selected) → Select
            // 3. Third click (expanded, selected) → Deselect and Collapse
            const isSelected = selectedLabelId === entry.id;
            
            if (!isExpanded) {
              // Click 1: Expand
              toggleEntry(entry.id);
            } else if (!isSelected) {
              // Click 2: Select
              setSelectedLabelId(entry.id);
              toast({ title: 'Pattern Selected', description: `${parentStructure.degree} ${waveLabel} selected for analysis` });
            } else {
              // Click 3: Deselect and Collapse
              setSelectedLabelId(null);
              toggleEntry(entry.id);
            }
          } else {
            // No children: toggle selection directly
            if (selectedLabelId === entry.id) {
              setSelectedLabelId(null);
            } else {
              setSelectedLabelId(entry.id);
              toast({ title: 'Pattern Selected', description: `${parentStructure.degree} ${waveLabel} selected` });
            }
          }
        }}
      >
        {/* Expand/Collapse indicator for entries with children */}
        {hasChildren ? (
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
        ) : (
          <span className="w-3" /> // Spacer for alignment
        )}
        
        {/* Wave Label */}
        <span className="w-6 text-center font-bold" style={{ color: degreeColor }}>
          {waveLabel}
        </span>
        
        {/* Timeframe dropdown - allows viewing in original or one level down */}
        {(() => {
          const originalTf = entry.timeframe;
          const oneDown = TIMEFRAME_ONE_DOWN[originalTf.toLowerCase()] || TIMEFRAME_ONE_DOWN[originalTf];
          const canDrillDown = !!oneDown;
          
          if (!canDrillDown) {
            // Lowest timeframe - show static badge
            return (
              <Badge variant="outline" className="text-[10px] px-1.5 text-gray-300 border-gray-600">
                {entry.timeframe}
              </Badge>
            );
          }
          
          return (
            <select
              value={timeframe}
              onChange={(e) => {
                e.stopPropagation();
                const newTf = e.target.value;
                setTimeframe(newTf);
                toast({ 
                  title: 'Timeframe Changed', 
                  description: newTf === originalTf 
                    ? `Viewing at original ${originalTf}` 
                    : `Drilling down to ${newTf}` 
                });
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-cyan-400 hover:border-cyan-500/50 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value={originalTf}>{originalTf}</option>
              <option value={oneDown.tf}>{oneDown.tf} ↓</option>
            </select>
          );
        })()}
        
        {/* Pattern Type */}
        <span className={`text-xs font-medium ${
          entry.patternType === 'impulse' ? 'text-emerald-400' :
          entry.patternType === 'abc' || entry.patternType === 'correction' ? 'text-amber-400' :
          entry.patternType === 'diagonal' ? 'text-purple-400' :
          'text-gray-400'
        }`}>{entry.patternType}</span>
        
        {/* Wave Count */}
        <span className="font-mono text-xs text-cyan-400">{entry.waveCount}</span>
        
        {/* Direction */}
        <span className={entry.direction === 'up' ? 'text-green-400' : 'text-red-400'}>
          {entry.direction === 'up' ? '↑' : '↓'}
        </span>
        
        {/* Nested depth badge - shows how many degree levels are below */}
        {hasChildren && (
          <Badge variant="outline" className="text-[9px] px-1 border-cyan-600 text-cyan-400">
            {getNestedDepth(entry, parentStructure, allStructures)} deep
          </Badge>
        )}
        
        {/* Price */}
        <span className="ml-auto text-xs font-mono text-gray-400">
          ${entry.endPrice.toFixed(4)}
        </span>
        
        {/* Degree dropdown */}
        <select
          value={entry.degree}
          onChange={(e) => {
            e.stopPropagation();
            const newDegree = e.target.value;
            updateLabel.mutate({ id: entry.id, degree: newDegree });
            toast({ title: 'Degree Updated', description: `Changed to ${newDegree}` });
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-gray-300 hover:border-amber-500/50 focus:border-amber-500 focus:outline-none cursor-pointer"
          style={{ 
            color: waveDegrees.find(d => d.name === entry.degree)?.color || '#ffa500',
            minWidth: '60px'
          }}
        >
          {waveDegrees.map(d => (
            <option key={d.name} value={d.name} style={{ color: d.color }}>
              {d.name}
            </option>
          ))}
        </select>
        
        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete this ${entry.patternType}?`)) {
              deleteLabel.mutate(entry.id);
            }
          }}
          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      
      {/* Recursively render child structures when expanded */}
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-slate-700" style={{ marginLeft: `${16 + indentPx}px` }}>
          {entryChildren.map(childStructure => {
            const childDegreeColor = waveDegrees.find((d: WaveDegree) => d.name === childStructure.degree)?.color || '#666';
            return (
              <div key={childStructure.id}>
                {/* Child structure header (degree label) */}
                <div 
                  className="flex items-center gap-2 py-1.5 px-2 text-xs text-gray-400 bg-slate-800/20"
                  style={{ borderLeft: `2px solid ${childDegreeColor}` }}
                >
                  <span style={{ color: childDegreeColor }}>
                    {childStructure.degree}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 border-gray-600">
                    {childStructure.archetype}
                  </Badge>
                  <span className="font-mono text-gray-500">{childStructure.sequence}</span>
                </div>
                
                {/* Child structure entries (recursive) */}
                {childStructure.entries.map((childEntry, childIdx) => (
                  <WaveEntryRow
                    key={childEntry.id}
                    entry={childEntry}
                    parentStructure={childStructure}
                    entryIndex={childIdx}
                    allStructures={allStructures}
                    depth={depth + 1}
                    expandedEntries={expandedEntries}
                    toggleEntry={toggleEntry}
                    selectedLabelId={selectedLabelId}
                    setSelectedLabelId={setSelectedLabelId}
                    deleteLabel={deleteLabel}
                    updateLabel={updateLabel}
                    toast={toast}
                    waveDegrees={waveDegrees}
                    timeframe={timeframe}
                    setTimeframe={setTimeframe}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Calculate Fibonacci projection levels based on wave type
// launchPrice: the price to project FROM (defaults to anchorEnd but can be different, e.g., B endpoint for C wave)
function calculateFibLevels(
  waveRole: ProjectionContext['waveRole'],
  anchorStart: number,
  anchorEnd: number,
  projectionDirection: 'up' | 'down',
  launchPrice?: number, // Override: project from this price instead of anchorEnd
  sourceInfo?: string
): ProjectionContext {
  const range = Math.abs(anchorEnd - anchorStart);
  const projectFrom = launchPrice ?? anchorEnd; // Use launchPrice if provided
  
  // Fib ratios by wave type (Elliott Wave standard ratios)
  const fibRatios: Record<string, number[]> = {
    'W2': [0.382, 0.5, 0.618, 0.786], // Retracements of W1
    'W4': [0.236, 0.382, 0.5], // Shallow retracements of W3
    'C': [0.618, 1.0, 1.272, 1.618], // Extensions from A wave
    'Y': [0.618, 1.0, 1.272, 1.618], // Extensions from W wave
    'W5': [0.618, 1.0, 1.272, 1.618], // Extensions (W5 often truncated or equal to W1)
    'W3': [1.382, 1.618, 2.0, 2.618], // W3 extensions: 138.2% (min), 161.8% (common), 200%, 261.8% (extended)
    'A': [0.382, 0.5, 0.618], // Retracements of prior impulse
    'B': [0.382, 0.5, 0.618, 0.786], // Retracements of A
    'W1_precursor': [0.382, 0.5, 0.618], // Initial pullback targets
  };
  
  const ratios = fibRatios[waveRole] || [0.382, 0.5, 0.618];
  const isRetracement = ['W2', 'W4', 'A', 'B', 'W1_precursor'].includes(waveRole);
  
  // Calculate price levels
  const levels = ratios.map(ratio => {
    let price: number;
    if (isRetracement) {
      // Retracement: project from projectFrom back toward anchorStart
      if (projectionDirection === 'down') {
        price = projectFrom - (range * ratio);
      } else {
        price = projectFrom + (range * ratio);
      }
    } else {
      // Extension: project beyond the projectFrom point
      if (projectionDirection === 'up') {
        price = projectFrom + (range * ratio);
      } else {
        price = projectFrom - (range * ratio);
      }
    }
    // Clamp minimum price to 0.0001 (crypto can't go below zero)
    price = Math.max(0.0001, price);
    return {
      ratio,
      price,
      label: `${(ratio * 100).toFixed(1)}%`
    };
  });
  
  return {
    waveRole,
    fibMode: isRetracement ? 'retracement' : 'extension',
    anchorStartPrice: anchorStart,
    anchorEndPrice: anchorEnd,
    launchPrice: projectFrom,
    levels,
    direction: projectionDirection,
    sourcePatternInfo: sourceInfo
  };
}

// Pattern recognition: convert patternType to wave count
function getWaveCount(patternType: string): number {
  if (patternType === 'impulse' || patternType === 'diagonal') return 5;
  if (patternType === 'abc' || patternType === 'flat' || patternType === 'zigzag' || patternType === 'correction') return 3;
  if (patternType === 'triangle') return 5; // A-B-C-D-E
  return 0;
}

// Detect pattern direction from points
function getPatternDirection(points: WavePoint[]): 'up' | 'down' {
  if (!points || points.length < 2) return 'up';
  const first = points[0];
  const last = points[points.length - 1];
  return last.price > first.price ? 'up' : 'down';
}


// Analyze wave sequence and suggest higher degree patterns
// Supports cross-degree analysis for nested corrections
function analyzeWaveStack(entries: WaveStackEntry[]): WaveStackSuggestion | null {
  if (entries.length === 0) return null;
  
  // Group entries by degree (only same-degree patterns form a sequence)
  const byDegree: Record<string, WaveStackEntry[]> = {};
  entries.forEach(e => {
    if (!byDegree[e.degree]) byDegree[e.degree] = [];
    byDegree[e.degree].push(e);
  });
  
  // Degree hierarchy (highest to lowest significance)
  const degreeOrder = [
    'Grand Supercycle', 'Supercycle', 'Cycle', 'Primary', 
    'Intermediate', 'Minor', 'Minute', 'Minuette', 'Subminuette'
  ];
  
  // ========== CROSS-DEGREE ANALYSIS ==========
  // Look for higher-degree impulse with lower-degree corrections building underneath
  for (let i = 0; i < degreeOrder.length - 1; i++) {
    const higherDegree = degreeOrder[i];
    const lowerDegree = degreeOrder[i + 1];
    const higherPatterns = byDegree[higherDegree] || [];
    const lowerPatterns = byDegree[lowerDegree] || [];
    
    if (higherPatterns.length === 0 || lowerPatterns.length === 0) continue;
    
    const higherSorted = higherPatterns.sort((a, b) => a.startTime - b.startTime);
    const lowerSorted = lowerPatterns.sort((a, b) => a.startTime - b.startTime);
    const lastHigher = higherSorted[higherSorted.length - 1];
    
    // Case 1: Higher degree has complete impulse (5 waves), lower degree building correction
    if (lastHigher.waveCount === 5 && lastHigher.patternType === 'impulse') {
      // Find lower degree patterns that come AFTER the higher degree impulse
      // Use tolerance to handle patterns that start at/near where the impulse ends
      const impulseDuration = lastHigher.endTime - lastHigher.startTime;
      const timeTolerance = impulseDuration * 0.1; // 10% tolerance
      const lowerAfterHigher = lowerSorted.filter(l => l.startTime >= (lastHigher.endTime - timeTolerance));
      
      if (lowerAfterHigher.length > 0) {
        // Triangle as wave B - need C wave to complete W2/B/4
        const lastLower = lowerAfterHigher[lowerAfterHigher.length - 1];
        if (lastLower.patternType === 'triangle') {
          const higherDir = lastHigher.direction;
          const priorWave = higherDir === 'up' ? 'W2 or B or 4' : 'W2 or B or 4';
          
          // Find the A wave (first pattern after higher impulse)
          const aWave = lowerAfterHigher.length > 1 ? lowerAfterHigher[0] : null;
          
          // C wave projection: use A wave LENGTH as base, but PROJECT FROM B endpoint (triangle E)
          let cProjection: ProjectionContext;
          const bEndpoint = lastLower.endPrice; // Triangle E point = B endpoint = launch point for C
          
          if (aWave && aWave.patternType !== 'triangle') {
            // Use A wave length for C extension targets, projected from B endpoint
            cProjection = calculateFibLevels(
              'C',
              aWave.startPrice,
              aWave.endPrice,
              aWave.direction, // C continues same direction as A
              bEndpoint, // Launch from B endpoint (triangle E)
              `A leg: ${aWave.startPrice.toFixed(4)} → ${aWave.endPrice.toFixed(4)}`
            );
          } else {
            // Fallback: use retracement of higher impulse for C targets
            const impulseRange = Math.abs(lastHigher.endPrice - lastHigher.startPrice);
            const cRatios = [0.382, 0.5, 0.618, 0.786];
            const cLevels = cRatios.map(ratio => {
              const price = higherDir === 'up' 
                ? bEndpoint - (impulseRange * ratio)
                : bEndpoint + (impulseRange * ratio);
              return { ratio, price, label: `${(ratio * 100).toFixed(1)}%` };
            });
            cProjection = {
              waveRole: 'C',
              fibMode: 'retracement',
              anchorStartPrice: lastHigher.startPrice,
              anchorEndPrice: lastHigher.endPrice,
              launchPrice: bEndpoint,
              levels: cLevels,
              direction: higherDir === 'up' ? 'down' : 'up',
              sourcePatternInfo: 'Higher impulse retracement'
            };
          }
          
          return {
            sequence: `${higherDegree}:5 → ${lowerDegree}:triangle`,
            suggestion: `🔺 ${lowerDegree} Triangle (wave B) complete - need C wave to finish ${higherDegree} ${priorWave}`,
            confidence: 'high',
            startPrice: lastHigher.startPrice,
            endPrice: lastLower.endPrice,
            projections: [cProjection],
          };
        }
        
        // Build sequence string from lower-degree patterns after higher impulse
        const lowerSeqStr = lowerAfterHigher.map(e => e.waveCount).join('-');
        
        // SINGLE CORRECTION (3) at lower degree after higher impulse = potential W2/B completion
        // A simple abc correction can complete W2, or be wave A/W of a more complex pattern
        if (lowerSeqStr === '3' && lowerAfterHigher.length === 1) {
          const correction = lowerAfterHigher[0];
          const higherDir = lastHigher.direction;
          const impulseRange = Math.abs(lastHigher.endPrice - lastHigher.startPrice);
          
          // Check if correction actually retraced (moved opposite to impulse direction)
          const isValidRetracement = higherDir === 'up' 
            ? correction.endPrice < lastHigher.endPrice
            : correction.endPrice > lastHigher.endPrice;
          
          // Calculate retracement percentage
          const retraceAmount = higherDir === 'up'
            ? lastHigher.endPrice - correction.endPrice
            : correction.endPrice - lastHigher.endPrice;
          const retracePercent = retraceAmount / impulseRange;
          
          // Only consider if retraced at least 23.6% but not more than 100%
          if (isValidRetracement && retracePercent >= 0.236 && retracePercent <= 1.0) {
            const retraceLabel = `${(retracePercent * 100).toFixed(0)}%`;
            
            // W3 projection if this is W2 complete
            const w3Projection = calculateFibLevels(
              'W3',
              lastHigher.startPrice,
              lastHigher.endPrice,
              higherDir,
              correction.endPrice, // Launch from W2 end
              `${higherDegree} W1`
            );
            w3Projection.sourcePatternInfo = `${higherDegree} W3`;
            
            return {
              sequence: `${higherDegree}:5 → ${lowerDegree}:3`,
              suggestion: `✅ ${lowerDegree} abc (${retraceLabel} retrace) = possible ${higherDegree} W2/B complete - Draw W2, predict W3 OR add another abc for W-X continuation`,
              confidence: 'medium',
              startPrice: lastHigher.startPrice,
              endPrice: correction.endPrice,
              projections: [w3Projection],
            };
          }
        }
        
        // 5-3 at lower degree after higher impulse = Zigzag A-B forming, need C wave
        if (lowerSeqStr === '5-3') {
          if (lastLower.waveCount === 3) {
            const firstLower = lowerAfterHigher[0]; // A wave (5-wave)
            const bEndpoint = lastLower.endPrice; // B endpoint = launch point for C
            // C wave projection: use A wave length, project from B endpoint
            const cProjection = calculateFibLevels(
              'C',
              firstLower.startPrice,
              firstLower.endPrice,
              firstLower.direction, // C continues same direction as A
              bEndpoint, // Launch from B endpoint
              `A leg: ${firstLower.startPrice.toFixed(4)} → ${firstLower.endPrice.toFixed(4)}`
            );
            return {
              sequence: `${higherDegree}:5 → ${lowerDegree}:5-3`,
              suggestion: `${lowerDegree}: Zigzag A-B forming - add C wave (5-wave) to complete ${higherDegree} W2`,
              confidence: 'medium',
              startPrice: lastHigher.startPrice,
              endPrice: lastLower.endPrice,
              projections: [cProjection],
            };
          }
        }
        
        // 3-3 at lower degree after higher impulse = W-X pattern, W2 still forming
        // This is NOT yet complete - need Y wave to complete WXY and thus W2
        if (lowerSeqStr === '3-3') {
          if (lastLower.waveCount === 3) {
            const firstLower = lowerAfterHigher[0]; // W wave (first abc)
            const xEndpoint = lastLower.endPrice; // X endpoint = launch point for Y
            // Y wave projection: use W wave length, project from X endpoint
            const yProjection = calculateFibLevels(
              'Y',
              firstLower.startPrice,
              firstLower.endPrice,
              firstLower.direction, // Y continues same direction as W
              xEndpoint, // Launch from X endpoint
              `W leg: ${firstLower.startPrice.toFixed(4)} → ${firstLower.endPrice.toFixed(4)}`
            );
            return {
              sequence: `${higherDegree}:5 → ${lowerDegree}:3-3`,
              suggestion: `⏳ ${lowerDegree}: W-X forming (${higherDegree} W2 still building) - add Y wave (abc) to complete WXY = ${higherDegree} W2`,
              confidence: 'medium',
              startPrice: lastHigher.startPrice,
              endPrice: lastLower.endPrice,
              projections: [yProjection],
            };
          }
        }
        
        // 3-5 pattern = likely WXY with X as triangle
        if (lowerSeqStr === '3-5' && lowerAfterHigher.length >= 2) {
          const secondLower = lowerAfterHigher[1];
          if (secondLower?.patternType === 'triangle') {
            const firstLower = lowerAfterHigher[0]; // W wave
            const xEndpoint = secondLower.endPrice; // X triangle endpoint = launch point for Y
            // Y wave projection: use W wave length, project from X endpoint
            const yProjection = calculateFibLevels(
              'Y',
              firstLower.startPrice,
              firstLower.endPrice,
              firstLower.direction, // Y continues same direction as W
              xEndpoint, // Launch from X endpoint
              `W leg: ${firstLower.startPrice.toFixed(4)} → ${firstLower.endPrice.toFixed(4)}`
            );
            return {
              sequence: `${higherDegree}:5 → ${lowerDegree}:3-triangle`,
              suggestion: `📐 WXY pattern - W complete, X triangle complete - need Y wave`,
              confidence: 'high',
              startPrice: lastHigher.startPrice,
              endPrice: lastLower.endPrice,
              projections: [yProjection],
            };
          }
        }
        
        // COMPLETE lower-degree correction = higher-degree W2
        // 3-3-3 (WXY), 3-3-5 (Flat), 5-3-5 (Zigzag) after impulse = W2 complete
        // IMPORTANT: Must verify the correction actually RETRACED the impulse
        const completeCorrections = ['3-3-3', '3-3-5', '5-3-5'];
        if (completeCorrections.includes(lowerSeqStr)) {
          const higherDir = lastHigher.direction;
          const impulseRange = Math.abs(lastHigher.endPrice - lastHigher.startPrice);
          const correctionEnd = lastLower.endPrice;
          
          // Check if correction actually retraced (moved opposite to impulse direction)
          const isValidRetracement = higherDir === 'up' 
            ? correctionEnd < lastHigher.endPrice  // Must be below impulse high
            : correctionEnd > lastHigher.endPrice; // Must be above impulse low
          
          // Calculate retracement percentage
          const retraceAmount = higherDir === 'up'
            ? lastHigher.endPrice - correctionEnd
            : correctionEnd - lastHigher.endPrice;
          const retracePercent = retraceAmount / impulseRange;
          
          // Only consider it W2 if it retraced at least 23.6% but not more than 100%
          if (isValidRetracement && retracePercent >= 0.236 && retracePercent <= 1.0) {
            const correctionType = lowerSeqStr === '3-3-3' ? 'WXY' : 
                                    lowerSeqStr === '3-3-5' ? 'Flat' : 'Zigzag';
            
            // W3 projection from W2 end using W1 length
            const w3Projection = calculateFibLevels(
              'W3',
              lastHigher.startPrice,
              lastHigher.endPrice,
              higherDir,
              lastLower.endPrice, // Launch from W2 end
              `${higherDegree} W1`
            );
            w3Projection.sourcePatternInfo = `${higherDegree} W3`;
            
            const retraceLabel = `${(retracePercent * 100).toFixed(0)}%`;
            
            return {
              sequence: `${higherDegree}:5 → ${lowerDegree}:${lowerSeqStr}`,
              suggestion: `✅ ${lowerDegree} ${correctionType} complete (${retraceLabel} retrace) = ${higherDegree} W2 - Draw ${higherDegree} W2, then W3`,
              confidence: 'high',
              startPrice: lastHigher.startPrice,
              endPrice: lastLower.endPrice,
              projections: [w3Projection],
            };
          }
        }
      }
    }
    
  }
  // ========== END CROSS-DEGREE ANALYSIS ==========
  
  // Find the most significant degree with 1+ patterns
  let targetDegree: string | null = null;
  let targetEntries: WaveStackEntry[] = [];
  
  for (const degree of degreeOrder) {
    if (byDegree[degree] && byDegree[degree].length >= 1) {
      targetDegree = degree;
      targetEntries = byDegree[degree].sort((a, b) => a.startTime - b.startTime);
      break;
    }
  }
  
  // If no degree found, fall back to first available
  if (!targetDegree) {
    const degrees = Object.keys(byDegree);
    if (degrees.length === 0) return null;
    targetDegree = degrees[0];
    targetEntries = byDegree[targetDegree].sort((a, b) => a.startTime - b.startTime);
  }
  
  // ========== NESTED 1-2, 1-2 DETECTION ==========
  // Check for W1-W2 patterns at multiple degrees (uber bullish/bearish setup)
  const nestedSetups: Array<{ degree: string; direction: 'up' | 'down' }> = [];
  
  for (const degree of degreeOrder) {
    const degreePatterns = byDegree[degree];
    if (!degreePatterns || degreePatterns.length < 2) continue;
    
    const sorted = degreePatterns.sort((a, b) => a.startTime - b.startTime);
    const seq = sorted.map(e => e.waveCount).join('-');
    
    // Check for 5-3 pattern (impulse + correction = W1-W2)
    if (seq === '5-3') {
      // Determine direction: impulse direction determines bullish/bearish
      const impulsePattern = sorted[0];
      nestedSetups.push({ degree, direction: impulsePattern.direction });
    }
  }
  
  // If we have 2+ degrees with 1-2 patterns = nested 1-2, 1-2 setup!
  if (nestedSetups.length >= 2) {
    // All should have same direction for valid nesting
    const primaryDirection = nestedSetups[0].direction;
    const allSameDirection = nestedSetups.every(s => s.direction === primaryDirection);
    
    if (allSameDirection) {
      const degreeNames = nestedSetups.map(s => s.degree).join(' + ');
      // 2 degrees = 1-2, 1-2 bullish/bearish
      // 3+ degrees = UBER bullish/bearish
      const isUber = nestedSetups.length >= 3;
      const sentiment = primaryDirection === 'up' 
        ? (isUber ? 'UBER BULLISH' : 'bullish')
        : (isUber ? 'UBER BEARISH' : 'bearish');
      const nestCount = nestedSetups.length === 2 ? '1-2, 1-2' : 
                        `1-2, 1-2, 1-2${nestedSetups.length > 3 ? `... (${nestedSetups.length}x)` : ''}`;
      
      // ========== W3 PROJECTION FOR NESTED 1-2 SETUPS ==========
      // Use HIGHEST degree W1 as the base for W3 extensions
      // Double: 1.618, 2.618, 3.618 | Triple: 2.618, 3.618, 4.236
      const highestDegree = nestedSetups[0].degree; // First in degreeOrder is highest
      const highestDegreePatterns = byDegree[highestDegree]?.sort((a, b) => a.startTime - b.startTime) || [];
      const w1Pattern = highestDegreePatterns[0]; // First pattern is W1 (impulse)
      const w2Pattern = highestDegreePatterns[1]; // Second pattern is W2 (correction)
      
      let w3Projection: ProjectionContext | null = null;
      
      if (w1Pattern && w2Pattern) {
        const w1Range = Math.abs(w1Pattern.endPrice - w1Pattern.startPrice);
        const launchPrice = w2Pattern.endPrice; // W3 launches from W2 end
        
        // Extension ratios based on nest count
        const fibRatios = isUber 
          ? [2.618, 3.618, 4.236] // Triple 1-2: more explosive
          : [1.618, 2.618, 3.618]; // Double 1-2: standard
        
        const w3Levels = fibRatios.map(ratio => {
          const extension = w1Range * ratio;
          const targetPrice = primaryDirection === 'up'
            ? launchPrice + extension
            : launchPrice - extension;
          return {
            ratio,
            price: targetPrice,
            label: `${(ratio * 100).toFixed(1)}%`,
          };
        });
        
        w3Projection = {
          waveRole: 'W3',
          fibMode: 'extension',
          anchorStartPrice: w1Pattern.startPrice,
          anchorEndPrice: w1Pattern.endPrice,
          launchPrice,
          levels: w3Levels,
          direction: primaryDirection,
          sourcePatternInfo: `${highestDegree} W1: ${w1Pattern.startPrice.toFixed(4)} → ${w1Pattern.endPrice.toFixed(4)}`
        };
      }
      // ========== END W3 PROJECTION ==========
      
      return {
        sequence: nestedSetups.map(() => '5-3').join(' | '),
        suggestion: `🚀 ${nestCount} setup (${degreeNames}) - ${sentiment} on confirmation!`,
        confidence: 'high',
        startPrice: targetEntries[0]?.startPrice || 0,
        endPrice: targetEntries[targetEntries.length - 1]?.endPrice || 0,
        projections: w3Projection ? [w3Projection] : undefined,
      };
    }
  }
  // ========== END NESTED DETECTION ==========
  
  // Build sequence string from SAME DEGREE patterns only
  const sequence = targetEntries.map(e => e.waveCount).join('-');
  const directions = targetEntries.map(e => e.direction);
  
  // Check for alternating directions
  let isAlternating = true;
  for (let i = 1; i < directions.length; i++) {
    if (directions[i] === directions[i-1]) {
      isAlternating = false;
      break;
    }
  }
  
  // Use targetEntries for price range (same degree patterns only)
  const startPrice = targetEntries[0]?.startPrice || 0;
  const endPrice = targetEntries[targetEntries.length - 1]?.endPrice || 0;
  
  // Pattern recognition rules (only for SAME DEGREE patterns)
  // 5-3-5-3-5 = Impulse (potential W1 or A of higher degree)
  if (sequence === '5-3-5-3-5' && isAlternating) {
    return {
      sequence,
      suggestion: `Complete ${targetDegree} impulse - Possible W1 or A of higher degree`,
      confidence: 'high',
      startPrice,
      endPrice,
    };
  }
  
  // 5-3-5 = Zigzag (ABC correction)
  if (sequence === '5-3-5' && isAlternating) {
    return {
      sequence,
      suggestion: `Possible ${targetDegree} Zigzag (ABC correction)`,
      confidence: 'high',
      startPrice,
      endPrice,
    };
  }
  
  // 3-3-5 = Flat correction
  if (sequence === '3-3-5') {
    return {
      sequence,
      suggestion: `Possible ${targetDegree} Flat correction (3-3-5)`,
      confidence: 'high',
      startPrice,
      endPrice,
    };
  }
  
  // ========== TRIANGLE AND WXY PATTERN DETECTION ==========
  // Check if last pattern is a triangle - can be wave B, X, or 4
  const lastPattern = targetEntries[targetEntries.length - 1];
  if (lastPattern && lastPattern.patternType === 'triangle') {
    // FIRST: Check for W4 triangle (5-3-5-triangle) - most specific case
    if (targetEntries.length >= 4) {
      const seq = targetEntries.slice(0, -1).map(e => e.waveCount).join('-');
      if (seq === '5-3-5') {
        const w2Pattern = targetEntries[1];
        const w1Pattern = targetEntries[0];
        const w3Pattern = targetEntries[2];
        const w4Triangle = lastPattern;
        const trendDir = w1Pattern.direction;

        const w5FibLevels = calcW5ProjectionLevels(
          w1Pattern.startPrice,
          w1Pattern.endPrice,
          w2Pattern.endPrice,
          w3Pattern.endPrice,
          w4Triangle.endPrice,
        );
        const w5Levels = w5FibLevels.map(l => ({
          ratio: l.ratio,
          price: l.price,
          label: l.label,
        }));

        const w5Projection: ProjectionContext = {
          waveRole: 'W5',
          fibMode: 'extension',
          anchorStartPrice: w1Pattern.startPrice,
          anchorEndPrice: w1Pattern.endPrice,
          launchPrice: w4Triangle.endPrice,
          levels: w5Levels,
          direction: trendDir,
          sourcePatternInfo: `W1: ${w1Pattern.startPrice.toFixed(4)} → ${w1Pattern.endPrice.toFixed(4)}`
        };
        
        return {
          sequence: `5-3-5-triangle`,
          suggestion: `🔺 ${targetDegree}: W1-W2-W3 + W4 triangle - need W5 to complete impulse!`,
          confidence: 'high',
          startPrice,
          endPrice,
          projections: [w5Projection],
        };
      }
    }
    
    // Single triangle pattern
    if (targetEntries.length === 1) {
      return {
        sequence: 'triangle',
        suggestion: `🔺 ${targetDegree} Triangle - likely wave B/X/4 - need C/Y/5 wave to complete`,
        confidence: 'high',
        startPrice,
        endPrice,
      };
    }
    
    // Triangle after another pattern = wave B of correction
    if (targetEntries.length >= 2) {
      const priorPattern = targetEntries[targetEntries.length - 2];
      if (priorPattern.waveCount === 5) {
        // C wave extends from B triangle - project extensions from A wave
        const aDir = priorPattern.direction;
        const cProjection = calculateFibLevels(
          'C',
          priorPattern.startPrice,
          priorPattern.endPrice,
          aDir === 'up' ? 'down' : 'up' // C goes opposite to A
        );
        return {
          sequence: `5-triangle`,
          suggestion: `🔺 ${targetDegree}: A wave (5) + B triangle - need C wave (5) to complete ABC`,
          confidence: 'high',
          startPrice,
          endPrice,
          projections: [cProjection],
        };
      }
      if (priorPattern.waveCount === 3) {
        // Y/C wave projection
        const wDir = priorPattern.direction;
        const yProjection = calculateFibLevels(
          'Y',
          priorPattern.startPrice,
          priorPattern.endPrice,
          wDir // Y continues same direction as W
        );
        return {
          sequence: `3-triangle`,
          suggestion: `📐 ${targetDegree}: W/A (3) + X/B triangle - need Y/C wave to complete WXY or ABC`,
          confidence: 'high',
          startPrice,
          endPrice,
          projections: [yProjection],
        };
      }
    }
  }
  
  // ========== OPEN-ENDED PATTERN PROJECTIONS ==========
  // Find ALL open-ended patterns at ANY degree and generate projections
  // Complete patterns (3-3-3, 5-3-5-3-5, etc.) = no predictions
  // Open patterns (5-3, 3-3, 5, etc.) = show predictions for next move
  const openPatternProjections: ProjectionContext[] = [];
  const openPatternAnalyses: string[] = [];
  
  for (const degree of degreeOrder) {
    const patterns = byDegree[degree];
    if (!patterns || patterns.length === 0) continue;
    
    const sorted = [...patterns].sort((a, b) => a.startTime - b.startTime);
    const seq = sorted.map(e => e.waveCount).join('-');
    
    // Skip complete patterns - they don't need predictions
    const completePatterns = ['3-3-3', '5-3-5-3-5', '3-3-3-3-3', '5-3-5'];
    if (completePatterns.includes(seq)) continue;
    
    // 5-3 = W1-W2 or A-B - predict W3 or C
    if (seq === '5-3') {
      const impulsePattern = sorted[0];
      const correctionPattern = sorted[1];
      const impulseDir = impulsePattern.direction;
      const dir = impulseDir === 'up' ? '↑' : '↓';
      
      openPatternAnalyses.push(`${degree}: 5-3 ${dir} → predict W3/C`);
      
      // W3 projection
      const w3Proj = calculateFibLevels(
        'W3',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulseDir,
        correctionPattern.endPrice,
        `${degree} W1`
      );
      w3Proj.sourcePatternInfo = `${degree} W3`;
      openPatternProjections.push(w3Proj);
      
      // C wave projection
      const cProj = calculateFibLevels(
        'C',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulseDir,
        correctionPattern.endPrice,
        `${degree} A`
      );
      cProj.sourcePatternInfo = `${degree} C`;
      openPatternProjections.push(cProj);
    }
    // 3-3 = Could be Flat A-B (needs C) OR WXY W-X (needs Y)
    else if (seq === '3-3') {
      const firstPattern = sorted[0];
      const secondPattern = sorted[1];
      openPatternAnalyses.push(`${degree}: 3-3 → predict C/Y`);
      
      // C wave projection (for Flat: A-B → C)
      // C continues same direction as A, measured from B end
      const cProj = calculateFibLevels(
        'C',
        firstPattern.startPrice,
        firstPattern.endPrice,
        firstPattern.direction,
        secondPattern.endPrice,
        `${degree} A`
      );
      cProj.sourcePatternInfo = `${degree} C (flat)`;
      openPatternProjections.push(cProj);
      
      // Y wave projection (for WXY: W-X → Y)
      // Y continues same direction as W, measured from X end
      const yProj = calculateFibLevels(
        'Y',
        firstPattern.startPrice,
        firstPattern.endPrice,
        firstPattern.direction,
        secondPattern.endPrice,
        `${degree} W`
      );
      yProj.sourcePatternInfo = `${degree} Y (wxy)`;
      openPatternProjections.push(yProj);
    }
    // 5 = single impulse - predict W2
    else if (seq === '5') {
      const impulsePattern = sorted[0];
      openPatternAnalyses.push(`${degree}: W1/A → predict W2/B`);
      
      const w2Proj = calculateFibLevels(
        'W2',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulsePattern.direction === 'up' ? 'down' : 'up', // W2 goes opposite
        impulsePattern.endPrice,
        `${degree} W1`
      );
      w2Proj.sourcePatternInfo = `${degree} W2`;
      openPatternProjections.push(w2Proj);
    }
  }
  
  // 3-3-3 pattern = Complete WXY double correction
  if (sequence === '3-3-3') {
    const suggestion = openPatternAnalyses.length > 0
      ? `✅ ${targetDegree}: WXY complete | ${openPatternAnalyses.join(' | ')}`
      : `✅ ${targetDegree}: Complete WXY double correction (3-3-3) - could be W2, B, or 4 of higher degree`;
    
    return {
      sequence,
      suggestion,
      confidence: 'high',
      startPrice,
      endPrice,
      projections: openPatternProjections.length > 0 ? openPatternProjections : undefined,
    };
  }
  
  // 3-3-3-3-3 pattern = Complete WXYXZ triple correction
  if (sequence === '3-3-3-3-3') {
    return {
      sequence,
      suggestion: `✅ ${targetDegree}: Complete WXYXZ triple correction (3-3-3-3-3) - rare but valid`,
      confidence: 'high',
      startPrice,
      endPrice,
    };
  }
  
  // 3-3 pattern - could be building WXY or flat
  if (sequence === '3-3') {
    const firstPattern = targetEntries[0];
    const secondPattern = targetEntries[1];
    const firstDir = firstPattern.direction;
    const secondDir = secondPattern.direction;
    
    // Same direction = WXY in progress
    if (firstDir === secondDir) {
      // Y wave projection (continues same direction as W and X)
      const yProjection = calculateFibLevels(
        'Y',
        firstPattern.startPrice,
        firstPattern.endPrice,
        firstDir
      );
      return {
        sequence,
        suggestion: `${targetDegree}: W-X complete (3-3) - need Y wave to complete WXY`,
        confidence: 'medium',
        startPrice,
        endPrice,
        projections: [yProjection],
      };
    }
    
    // Alternating = Flat A-B in progress
    // C wave projection: uses A wave for measurement, continues A direction
    const cProjection = calculateFibLevels(
      'C',
      firstPattern.startPrice,
      firstPattern.endPrice,
      firstDir // C continues same direction as A in flat
    );
    return {
      sequence,
      suggestion: `${targetDegree}: Flat A-B building - need C wave (5) to complete`,
      confidence: 'medium',
      startPrice,
      endPrice,
      projections: [cProjection],
    };
  }
  
  // 3-5 pattern - WXY with X triangle or impulse C
  if (sequence === '3-5') {
    const firstPattern = targetEntries[0];
    const secondPattern = targetEntries[1];
    if (secondPattern.patternType === 'triangle') {
      // Y wave projection
      const yProjection = calculateFibLevels(
        'Y',
        firstPattern.startPrice,
        firstPattern.endPrice,
        firstPattern.direction
      );
      return {
        sequence: '3-triangle',
        suggestion: `📐 ${targetDegree}: W wave + X triangle - need Y wave to complete WXY`,
        confidence: 'high',
        startPrice,
        endPrice,
        projections: [yProjection],
      };
    }
    // Could be A-B or W-X - show both C and Y projections
    const cOrYProjection = calculateFibLevels(
      'C',
      firstPattern.startPrice,
      firstPattern.endPrice,
      firstPattern.direction
    );
    return {
      sequence,
      suggestion: `${targetDegree}: 3-5 pattern - could be A-B (need C) or W-X (need Y)`,
      confidence: 'medium',
      startPrice,
      endPrice,
      projections: [cOrYProjection],
    };
  }
  // ========== END TRIANGLE/WXY DETECTION ==========
  
  // Building patterns - partial matches
  if (sequence === '5') {
    // If we have open pattern projections from multiple degrees, include them
    const multiDegreeW2Info = openPatternAnalyses.length > 1 
      ? ` | Multi-degree: ${openPatternAnalyses.join(', ')}`
      : '';
    
    return {
      sequence,
      suggestion: `Single ${targetDegree} impulse - could be W1, W3, W5, or A/C${multiDegreeW2Info}`,
      confidence: 'low',
      startPrice,
      endPrice,
      projections: openPatternProjections.length > 0 ? openPatternProjections : undefined,
    };
  }
  
  if (sequence === '5-3') {
    // Check if the 3-wave is a triangle
    const correctionPattern = targetEntries[1];
    const impulsePattern = targetEntries[0];
    const impulseDir = impulsePattern.direction;
    
    // For 5-3 pattern: W5 high is impulsePattern.endPrice, W2 low is correctionPattern.endPrice
    const w5Price = impulsePattern.endPrice; // The peak of W1/impulse
    const w2Price = correctionPattern.endPrice; // The low of W2/correction
    
    if (correctionPattern && correctionPattern.patternType === 'triangle') {
      // C wave projects beyond B triangle - use A wave for extension
      const cProjection = calculateFibLevels(
        'C',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulseDir === 'up' ? 'down' : 'up' // C goes opposite to A
      );
      return {
        sequence: '5-triangle',
        suggestion: `🔺 ${targetDegree}: Impulse + Triangle (B) - need C wave to complete W2/B/4`,
        confidence: 'high',
        startPrice: w5Price, // Show W5 peak
        endPrice: w2Price,   // Show current W2 position
        projections: [cProjection],
      };
    }
    
    // 5-3 could be W1-W2 OR A-B - show both scenarios
    const w3Projection = calculateFibLevels(
      'W3',
      impulsePattern.startPrice,
      impulsePattern.endPrice,
      impulseDir, // W3 continues same direction as W1
      w2Price, // Launch from W2 end
      `${targetDegree} W1`
    );
    w3Projection.sourcePatternInfo = `${targetDegree} W3 (impulse)`;
    
    const cProjection = calculateFibLevels(
      'C',
      impulsePattern.startPrice,
      impulsePattern.endPrice,
      impulseDir, // C continues same direction as A
      w2Price, // Launch from B end
      `${targetDegree} A`
    );
    cProjection.sourcePatternInfo = `${targetDegree} C (ABC)`;
    
    return {
      sequence,
      suggestion: `${targetDegree}: W1-W2 or A-B - predict W3 or C`,
      confidence: 'medium',
      startPrice: w5Price,
      endPrice: w2Price,
      projections: [w3Projection, cProjection], // Show both possibilities
    };
  }
  
  if (sequence === '5-3-5') {
    return {
      sequence,
      suggestion: `${targetDegree}: Possible Zigzag or W1-W2-W3`,
      confidence: 'medium',
      startPrice,
      endPrice,
    };
  }
  
  if (sequence === '5-3-5-3') {
    return {
      sequence,
      suggestion: `${targetDegree}: Building impulse - waiting for W5`,
      confidence: 'medium',
      startPrice,
      endPrice,
    };
  }
  
  // After complete impulse, new patterns
  if (sequence.startsWith('5-3-5-3-5-')) {
    const remaining = sequence.substring(10); // After "5-3-5-3-5-"
    
    if (remaining === '5-3-5') {
      return {
        sequence,
        suggestion: `${targetDegree}: W1 complete + Possible W2 Zigzag`,
        confidence: 'high',
        startPrice,
        endPrice,
      };
    }
    
    if (remaining === '3-3-5') {
      return {
        sequence,
        suggestion: `${targetDegree}: W1 complete + Possible W2 Flat`,
        confidence: 'high',
        startPrice,
        endPrice,
      };
    }
    
    if (remaining === '5-3-5-3-5') {
      return {
        sequence,
        suggestion: `${targetDegree}: Possible W1-W2 complete of higher degree`,
        confidence: 'high',
        startPrice,
        endPrice,
      };
    }
  }
  
  // Generic pattern for longer sequences
  if (targetEntries.length > 5) {
    return {
      sequence,
      suggestion: `${targetDegree}: Complex pattern (${targetEntries.length} waves)`,
      confidence: 'low',
      startPrice,
      endPrice,
    };
  }
  
  // ========== MULTI-DEGREE PATTERN SUMMARY ==========
  // Collect analyses AND projections from ALL degrees with actionable patterns
  const degreeAnalyses: string[] = [];
  const allProjections: ProjectionContext[] = [];
  
  for (const degree of degreeOrder) {
    const patterns = byDegree[degree];
    if (!patterns || patterns.length === 0) continue;
    
    const sorted = patterns.sort((a, b) => a.startTime - b.startTime);
    const seq = sorted.map(e => e.waveCount).join('-');
    const lastPattern = sorted[sorted.length - 1];
    
    // Recognize patterns at each degree AND collect projections
    if (seq === '5-3') {
      const impulsePattern = sorted[0];
      const correctionPattern = sorted[1];
      const impulseDir = impulsePattern.direction;
      const dir = impulseDir === 'up' ? '↑' : '↓';
      degreeAnalyses.push(`${degree}: W1-W2 or A-B ${dir} (predict W3 or C)`);
      
      // Generate W3 projection for this degree (impulse scenario)
      const w3Proj = calculateFibLevels(
        'W3',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulseDir,
        correctionPattern.endPrice, // Launch from W2 end
        `${degree} W1: ${impulsePattern.startPrice.toFixed(4)} → ${impulsePattern.endPrice.toFixed(4)}`
      );
      w3Proj.sourcePatternInfo = `${degree} W3`;
      allProjections.push(w3Proj);
      
      // Generate C wave projection for this degree (ABC correction scenario)
      const cProj = calculateFibLevels(
        'C',
        impulsePattern.startPrice,
        impulsePattern.endPrice,
        impulseDir,
        correctionPattern.endPrice, // Launch from B end
        `${degree} A: ${impulsePattern.startPrice.toFixed(4)} → ${impulsePattern.endPrice.toFixed(4)}`
      );
      cProj.sourcePatternInfo = `${degree} C`;
      allProjections.push(cProj);
    } else if (seq === '5') {
      degreeAnalyses.push(`${degree}: W1 or A complete`);
    } else if (seq === '3') {
      degreeAnalyses.push(`${degree}: Correction (W2, B, or 4)`);
    } else if (seq === '5-3-5') {
      degreeAnalyses.push(`${degree}: Zigzag or W1-W2-W3`);
    } else if (seq === '5-3-5-3') {
      degreeAnalyses.push(`${degree}: Building W1-W2-W3-W4`);
    } else if (seq === '5-3-5-3-5') {
      degreeAnalyses.push(`${degree}: Complete impulse!`);
    } else if (seq === '3-3-3') {
      degreeAnalyses.push(`${degree}: ✅ WXY complete (W2/B/4)`);
    } else if (seq === '3-3-3-3-3') {
      degreeAnalyses.push(`${degree}: ✅ WXYXZ complete`);
    } else if (seq === '3-3') {
      degreeAnalyses.push(`${degree}: W-X (need Y)`);
      // Y projection
      const firstPattern = sorted[0];
      const yProj = calculateFibLevels(
        'Y',
        firstPattern.startPrice,
        firstPattern.endPrice,
        firstPattern.direction,
        sorted[1].endPrice,
        `${degree} W: ${firstPattern.startPrice.toFixed(4)} → ${firstPattern.endPrice.toFixed(4)}`
      );
      yProj.sourcePatternInfo = `${degree} Y`;
      allProjections.push(yProj);
    } else if (seq === '3-3-5') {
      degreeAnalyses.push(`${degree}: Flat correction`);
    } else if (lastPattern?.patternType === 'triangle') {
      degreeAnalyses.push(`${degree}: Triangle (B/X/4)`);
    } else if (lastPattern?.patternType === 'diagonal') {
      degreeAnalyses.push(`${degree}: Diagonal (ending)`);
    } else if (patterns.length > 0) {
      degreeAnalyses.push(`${degree}: ${seq} pattern`);
    }
  }
  
  if (degreeAnalyses.length > 0) {
    return {
      sequence,
      suggestion: degreeAnalyses.join(' | '),
      confidence: 'low',
      startPrice,
      endPrice,
      projections: allProjections.length > 0 ? allProjections : undefined,
    };
  }
  // ========== END MULTI-DEGREE ==========
  
  return {
    sequence,
    suggestion: `${targetDegree}: Add more waves for suggestions`,
    confidence: 'low',
    startPrice,
    endPrice,
  };
}

interface GrokWaveAnalysis {
  patternType: string;
  degree: string;
  confidence: number;
  currentWave: string;
  suggestedLabels: Array<{
    label: string;
    approximatePosition: string;
    priceLevel?: string;
    candleIndex?: number;
    snapTo?: 'high' | 'low';
  }>;
  originPoint?: {
    candleIndex: number;
    price: number;
    label: string;
  };
  endPoint?: {
    candleIndex: number;
    price: number;
    label: string;
  };
  continuation: {
    direction: 'up' | 'down' | 'sideways';
    targetDescription: string;
    fibonacciLevels?: string[];
    upTargets?: Array<{ level: string; price: number }>;
    downTargets?: Array<{ level: string; price: number }>;
  };
  analysis: string;
  alternativeCount?: string;
  riskFactors?: string[];
}

import { incrementTickerClick, getFavorites, isFalconTicker, isFalconCandleTimeframe } from '@/lib/tickerUtils';
import { FalconChartStatusBanner } from '@/components/falcon/FalconChartStatusBanner';
import { parseFalconCandleMeta } from '@/lib/falconChartStatus';
import { getFutureBarCount, getInitialVisibleFutureBarCount } from '@/lib/chart/timeUtils';
import { FavoritesOnlySelector } from '@/components/TickerSelector';
const TIMEFRAMES = [
  { label: '1 Month', value: '1M' },
  { label: '1 Week', value: '1w' },
  { label: '1 Day', value: '1d' },
  { label: '4 Hour', value: '4h' },
  { label: '1 Hour', value: '1h' },
  { label: '15 Min', value: '15m' },
];

const FALCON_ELLIOTT_TIMEFRAMES = [
  { label: '1 Hour', value: '1h' },
  { label: '15 Min', value: '15m' },
  { label: '5 Min', value: '5m' },
  { label: '1 Min', value: '1m' },
];

// Timeframe hierarchy for drill-down (only 1 level down allowed)
// Maps each timeframe to its one-level-lower timeframe and candle count
const TIMEFRAME_ONE_DOWN: Record<string, { tf: string; candleCount: number } | null> = {
  '1M': { tf: '1w', candleCount: 4 },   // Month → 4 weeks
  '1w': { tf: '1d', candleCount: 7 },   // Week → 7 days
  '1d': { tf: '4h', candleCount: 6 },   // Day → 6 x 4-hour candles
  '4h': { tf: '1h', candleCount: 4 },   // 4h → 4 hourly candles
  '1h': { tf: '15m', candleCount: 4 },  // 1h → 4 x 15-min candles
  '15m': null,                          // Lowest level - no drill-down
};

// Timeframe interval in milliseconds (for calculating candle ranges)
const TIMEFRAME_INTERVAL_MS: Record<string, number> = {
  '1M': 30 * 24 * 60 * 60 * 1000,  // ~30 days
  '1w': 7 * 24 * 60 * 60 * 1000,   // 7 days
  '1d': 24 * 60 * 60 * 1000,       // 24 hours
  '4h': 4 * 60 * 60 * 1000,        // 4 hours
  '1h': 60 * 60 * 1000,            // 1 hour
  '15m': 15 * 60 * 1000,           // 15 minutes
};

// Find adjusted price for a wave point when drilling down to lower timeframe
// Returns the highest high or lowest low from sub-candles based on snappedToHigh
const findAdjustedPrice = (
  pointTime: number,
  snappedToHigh: boolean,
  originalTf: string,
  subCandles: CandleData[]
): number | null => {
  const intervalMs = TIMEFRAME_INTERVAL_MS[originalTf.toLowerCase()] || TIMEFRAME_INTERVAL_MS[originalTf];
  if (!intervalMs || subCandles.length === 0) return null;
  
  // Find sub-candles within the original candle's time range
  // Original candle starts at pointTime (as Unix seconds)
  const startTime = pointTime;
  const endTime = pointTime + intervalMs / 1000; // Convert ms to seconds
  
  const relevantCandles = subCandles.filter(c => c.time >= startTime && c.time < endTime);
  
  if (relevantCandles.length === 0) return null;
  
  if (snappedToHigh) {
    // Find highest high
    return Math.max(...relevantCandles.map(c => c.high));
  } else {
    // Find lowest low
    return Math.min(...relevantCandles.map(c => c.low));
  }
};

// Get display label for a timeframe value
const getTimeframeLabel = (value: string): string => {
  const tf = TIMEFRAMES.find(t => t.value.toLowerCase() === value.toLowerCase());
  return tf?.label || value;
};

const PATTERN_TYPES = [
  { label: 'Impulse (12345)', value: 'impulse' },
  { label: 'Correction (ABC)', value: 'correction' },
  { label: 'Triangle (ABCDE)', value: 'triangle' },
  { label: 'Diagonal (12345)', value: 'diagonal' },
];

const FIBONACCI_MODES = [
  { label: 'Measured (Live %)', value: 'measured' },
  { label: 'Projected (Targets)', value: 'projected' },
  { label: 'Off', value: 'off' },
];

export default function CryptoElliottWave() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated, tier: rawTier, getToken, isAdmin } = useCryptoAuth();
  const localTier = isAdmin ? 'elite' : rawTier; // Admin gets unrestricted elite access
  const authReady = useEnsureAuthReady();
  const { toast } = useToast();
  // Scope all user-owned query caches so account switches never show another user's data
  const userScope = user?.id ?? (isDevelopment ? 'dev' : 'signed-out');
  
  usePageViewTracking('crypto-elliott-wave');
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<any>(null); // Store markers primitive for updates
  const fibLinesRef = useRef<any[]>([]); // Store Fib price lines for cleanup
  const fibProjectionPricesRef = useRef<{ price: number; label: string; color: string; correctionType?: 'flat' | 'zigzag'; diagonalType?: 'contracting' | 'expanding' }[]>([]); // Store active projection prices for future clicks
  const fibonacciModeRef = useRef<string>('measured'); // Track fib mode for click handler
  const detectedCorrectionTypeRef = useRef<'flat' | 'zigzag' | null>(null); // Track if user clicked flat or zigzag B target
  const detectedDiagonalTypeRef = useRef<'contracting' | 'expanding' | null>(null); // Track if user clicked contracting or expanding diagonal target
  const diagonalTrendlinesRef = useRef<any[]>([]); // Store diagonal trendline series for cleanup
  const futurePointsDataRef = useRef<WavePoint[]>([]); // Store future projection points for virtual candle updates
  const blueCandelSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null); // Blue simulation candles for future projections
  const blueCandleMarkersRef = useRef<any>(null); // Markers on blue candle series
  const touchStartTimeRef = useRef<number>(0); // Track when touch/click started for long-press detection
  const timeframeRef = useRef<string>('1d'); // Track timeframe for click handler window sizing
  const lastCrosshairParamRef = useRef<{ time: number; price: number; logicalX?: number; pointX?: number } | null>(null); // Store last crosshair position for crosshair-mode clicks
  const crosshairModeActiveRef = useRef<boolean>(false); // Persistent crosshair mode - stays on until tap places point
  const crosshairPositionLockedRef = useRef<boolean>(false); // Position is locked after user lifts finger (ready for confirming tap)
  const capturedCrosshairPositionRef = useRef<{ time: number; price: number; logicalX?: number; pointX?: number } | null>(null); // CAPTURED position when finger lifts - used for confirming tap
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for long-press activation
  const ignoreNextClickRef = useRef<boolean>(false); // Ignore the click from lifting the crosshair activation touch
  const markersDebounceRef = useRef<NodeJS.Timeout | null>(null); // Debounce marker updates during zoom
  const fibLinesDebounceRef = useRef<NodeJS.Timeout | null>(null); // Debounce fib line updates during zoom/pan
  const waveSnapCircleRef = useRef<HTMLDivElement | null>(null); // Visual feedback circle for wave snapping
  const showWaveSnapCircleRef = useRef<((x: number, y: number, isSnapped: boolean) => void) | null>(null); // Ref to access snap circle function from chart callbacks
  
  // Correction context: stores parent impulse data when starting ABC from predicted W5
  // Used to calculate Wave A retracement targets or C wave extension targets
  const correctionContextRef = useRef<{
    parentLabelId: string;
    parentDegree: string;
    parentPoints: WavePoint[];
    wave5Price: number;
    wave4Price: number;
    wave0Price: number;
    isUptrend: boolean;
    isCrossDegreeCWave?: boolean;  // True if drawing C wave from lower-degree B triangle
    aWaveStart?: number;           // A wave start price (for C wave extensions)
    aWaveEnd?: number;             // A wave end price (for C wave extensions)
  } | null>(null);
  
  // Dynamic click tolerances that scale with zoom level
  const dynamicTolerancesRef = useRef<{ barTolerance: number; priceTolerance: number }>({
    barTolerance: 3,      // Default: 3 candles
    priceTolerance: 0.08, // Default: 8% of price
  });

  const [symbol, setSymbol] = useState('XRPUSDT');
  const [timeframe, setTimeframe] = useState('15m');
  const visibleTimeframes = isFalconTicker(symbol) ? FALCON_ELLIOTT_TIMEFRAMES : TIMEFRAMES;
  useEffect(() => {
    if (isFalconTicker(symbol) && !isFalconCandleTimeframe(timeframe)) {
      setTimeframe('15m');
    }
  }, [symbol, timeframe]);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [waveAutoSnapEnabled, setWaveAutoSnapEnabled] = useState(true); // Auto-snap waves to highs/lows
  const waveAutoSnapEnabledRef = useRef(true); // Ref for chart callbacks
  const [selectedDegree, setSelectedDegree] = useState('Minor');
  const [patternType, setPatternType] = useState('impulse');
  const [fibonacciMode, setFibonacciMode] = useState('measured');
  const [currentPoints, setCurrentPoints] = useState<WavePoint[]>([]);
  const [waveDegrees, setWaveDegrees] = useState<WaveDegree[]>([
    { name: 'Grand Supercycle', color: '#FF6B6B', labels: ['(I)', '(II)', '(III)', '(IV)', '(V)'] },  // Bright coral
    { name: 'Supercycle', color: '#FFA94D', labels: ['(I)', '(II)', '(III)', '(IV)', '(V)'] },       // Bright orange
    { name: 'Cycle', color: '#FFE066', labels: ['I', 'II', 'III', 'IV', 'V'] },                      // Bright gold
    { name: 'Primary', color: '#69DB7C', labels: ['1', '2', '3', '4', '5'] },                        // Bright lime
    { name: 'Intermediate', color: '#38D9A9', labels: ['(1)', '(2)', '(3)', '(4)', '(5)'] },         // Bright teal
    { name: 'Minor', color: '#74C0FC', labels: ['1', '2', '3', '4', '5'] },                          // Bright sky blue
    { name: 'Minute', color: '#B197FC', labels: ['i', 'ii', 'iii', 'iv', 'v'] },                     // Bright violet
    { name: 'Minuette', color: '#F783AC', labels: ['(i)', '(ii)', '(iii)', '(iv)', '(v)'] },         // Bright pink
    { name: 'Subminuette', color: '#ADB5BD', labels: ['i', 'ii', 'iii', 'iv', 'v'] },                // Light gray
  ]);
  const [savedLabels, setSavedLabels] = useState<ElliottWaveLabel[]>([]);
  const [previewPoint, setPreviewPoint] = useState<{ time: number; price: number } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<GrokWaveAnalysis | null>(null);
  const [grokStackAnalysis, setGrokStackAnalysis] = useState<{
    synopsis: string;
    tableData: { degree: string; label: string; direction: string; startDate: string; endDate: string; startPrice: string; endPrice: string; pattern: string }[];
    rawResponse?: string;
  } | null>(null);
  // Detailed analysis state (uses lower timeframe data for sub-wave discovery)
  const [detailedAnalysis, setDetailedAnalysis] = useState<{
    synopsis: string;
    subWaves: any[];
    rawResponse?: string;
    analysisTimeframe?: string;
    pivotCount?: number;
  } | null>(null);
  // Chart analysis state (raw pattern detection without labels)
  const [chartAnalysis, setChartAnalysis] = useState<{
    synopsis: string;
    bestFitPattern: string;
    confidence: number;
    direction: 'up' | 'down' | 'sideways';
    possiblePatterns: { pattern: string; probability: number; reasoning: string }[];
    possibleOutcomes: { scenario: string; nextMove: string; targets?: string[] }[];
    fibonacciLevels?: { level: string; price: number; significance: string }[];
    rawResponse?: string;
  } | null>(null);
  
  // Clear chart analysis when symbol or timeframe changes
  useEffect(() => {
    setChartAnalysis(null);
  }, [symbol, timeframe]);
  
  // Derive selected wave for AI analysis from the table's selectedLabelId
  // Instead of separate state, we use the existing selection mechanism
  const [isCapturingChart, setIsCapturingChart] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null); // Index of point being dragged
  const [isDragging, setIsDragging] = useState(false);
  const [markersVersion, setMarkersVersion] = useState(0); // Force marker refresh
  const [visibleCandleCount, setVisibleCandleCount] = useState(0); // Track visible candles for counter display
  const [stackProjectionLines, setStackProjectionLines] = useState<{ price: number; color: string; lineWidth: number; lineStyle: number; axisLabelVisible: boolean; title: string }[]>([]); // Wave Stack projection lines
  const [waveProjectionMode, setWaveProjectionMode] = useState<'abc' | 'impulse'>('abc'); // ABC (WXY) vs 12345 (impulse) mode

  // Drawing tools state (for trendlines, horizontal lines, rectangles)
  type DrawingTool = 'trendline' | 'horizontal' | 'rectangle' | null;
  const [drawingMode, setDrawingMode] = useState<'off' | 'draw' | 'select'>('off');
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [tempDrawing, setTempDrawing] = useState<{points: {time: number; price: number}[]} | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [showDrawingSettings, setShowDrawingSettings] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(true);

  // Cooldown ref to prevent immediate placement after wave point pickup (1 second delay)
  const wavePointPickupTimeRef = useRef<number>(0);
  const WAVE_EDIT_PLACEMENT_COOLDOWN_MS = 1000;
  
  // Ref for gesture controller's findSnapPoint function (for wave point editing)
  const waveFindSnapPointRef = useRef<((clientX: number, clientY: number) => { time: any; price: number; snapType?: 'high' | 'low' | 'none' } | null) | null>(null);

  // Handle drawing point commits from gesture controller
  const handleDrawingPointCommit = useCallback((point: GesturePoint) => {
    const time = point.time as number;
    const price = point.price;
    
    if (!activeTool || drawingMode !== 'draw') return;
    
    console.log('[EW Drawing] Point commit:', { time, price, tool: activeTool, snapType: point.snapType });
    
    setTempDrawing(prev => {
      if (!prev) return { points: [{ time, price }] };
      
      const newPoints = [...prev.points, { time, price }];
      const requiredPoints = activeTool === 'horizontal' ? 1 : 2;
      
      if (newPoints.length >= requiredPoints) {
        const newDrawing = {
          id: `drawing-${Date.now()}`,
          type: activeTool,
          points: newPoints,
          style: { color: '#3b82f6', lineWidth: 2 }
        };
        setDrawings(d => [...d, newDrawing]);
        saveDrawingMutation.mutate(newDrawing);
        toast({ title: 'Drawing Saved', description: `${activeTool.replace('_', ' ')} added to chart` });
        return { points: [] };
      }
      return { points: newPoints };
    });
  }, [activeTool, drawingMode, toast]);

  // Gesture controller for drawing tools with smart snap
  const gestureController = useChartGestures({
    enabled: drawingMode === 'draw' && activeTool !== null,
    data: candles.map(c => ({ ...c, time: c.time as Time })) as BarData[],
    onPointCommit: handleDrawingPointCommit,
    onPreviewPoint: (point) => {
      if (point) {
        setPreviewPoint({ time: point.time as number, price: point.price });
      } else {
        setPreviewPoint(null);
      }
    },
    onCrosshairModeChange: (active) => {
      console.log('[EW Gesture] Crosshair mode:', active);
    },
    autoSnapEnabled,
  });

  // Connect findSnapPoint function to the ref for wave point editing
  useEffect(() => {
    waveFindSnapPointRef.current = gestureController.findSnapPoint;
  }, [gestureController.findSnapPoint]);

  // Waves Usage Guide collapsible state
  const [wavesTrainingOpen, setWavesTrainingOpen] = useState(false);
  const [fibModeGuideOpen, setFibModeGuideOpen] = useState(false);
  const [degreesGuideOpen, setDegreesGuideOpen] = useState(false);
  const [drawingTypesGuideOpen, setDrawingTypesGuideOpen] = useState(false);
  const [pointPlacementGuideOpen, setPointPlacementGuideOpen] = useState(false);
  const [waveStackGuideOpen, setWaveStackGuideOpen] = useState(false);
  const [trainingManualOpen, setTrainingManualOpen] = useState(false);

  // DEBUG MODE: Touch sensitivity testing panel (admin only)
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugSettings, setDebugSettings] = useState({
    baseBarTolerance: 3,        // Base candle tolerance when zoomed in
    maxBarTolerance: 30,        // Max candle tolerance when zoomed out
    basePriceTolerance: 0.08,   // Base price % tolerance (8%)
    maxPriceTolerance: 0.25,    // Max price % tolerance (25%)
    targetPixelRadius: 44,      // Mobile touch target size in pixels
    zoomThreshold1: 50,         // Candles visible for 1-candle precision
    zoomThreshold3: 100,        // Candles visible for 3-candle snap
    zoomThreshold5: 200,        // Candles visible for 5-candle snap
    zoomThreshold7: 300,        // Candles visible for 7-candle snap
  });
  // Ref to access debug settings in chart effect (must be after debugSettings declaration)
  const debugSettingsRef = useRef(debugSettings);
  debugSettingsRef.current = debugSettings;

  // Check subscription tier and Elliott Wave access
  const { data: subscription, isLoading: subLoading } = useQuery<{ tier: string; monthlyUsage?: { aiCredits: number; aiLimit: number; elliottCredits: number; elliottLimit: number } }>({
    queryKey: ['/api/crypto/my-subscription'],
  });

  // Elliott Wave chart tools are available to every signed-in user (no tier gate)
  const canUseElliottFeatures = true;
  const isElite = isAdmin || subscription?.tier === 'elite' || localTier === 'elite';
  const hasElliottAIAccess = isAuthenticated || isAdmin;
  
  // Computed access flag: In development = always allowed; In production = need auth + subscription + ready
  // Also requires auth and subscription loading to be complete to prevent premature mutations
  // CRITICAL: Admin users (beartec@beartec.uk) bypass all access checks immediately
  const authAndSubReady = authReady.ready && !authLoading && !subLoading;
  const hasElliottAccess = isDevelopment || isAdmin || (authAndSubReady && isAuthenticated && canUseElliottFeatures);

  // Fetch saved drawings from database (keyed by user so caches never cross accounts)
  const drawingsQueryKey = ['/api/crypto/chart-drawings', userScope, symbol, timeframe] as const;
  const { data: savedDrawings = [], refetch: refetchDrawings } = useQuery<any[]>({
    queryKey: drawingsQueryKey,
    queryFn: async () => {
      const response = await authenticatedApiRequest('GET', `/api/crypto/chart-drawings?symbol=${symbol}&timeframe=${timeframe}`);
      return response.json();
    },
    enabled: isAuthenticated && !authLoading && !!user?.id && !!symbol && !!timeframe,
  });
  
  // Load saved drawings into state when data changes; clear when signed out / user switch
  useEffect(() => {
    if (!user?.id && !isDevelopment) {
      setDrawings([]);
      return;
    }
    if (savedDrawings) {
      setDrawings(savedDrawings.map(d => ({
        id: d.id,
        type: d.drawing_type || d.drawingType,
        points: d.coordinates?.points || [],
        style: d.style || { color: '#3b82f6', lineWidth: 2 },
      })).filter(d => d.points.length > 0));
    }
  }, [savedDrawings, user?.id]);
  
  // Save drawing mutation
  const saveDrawingMutation = useMutation({
    mutationFn: async (drawing: any) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/chart-drawings', {
        symbol,
        timeframe,
        drawingType: drawing.type,
        coordinates: { points: drawing.points },
        style: drawing.style,
      });
      return { ...(await response.json()), localId: drawing.id };
    },
    onSuccess: (serverDrawing) => {
      setDrawings(prev => prev.map(d => 
        d.id === serverDrawing.localId 
          ? { ...d, id: serverDrawing.id }
          : d
      ));
      refetchDrawings();
    },
  });
  
  // Delete drawing mutation  
  const deleteDrawingMutation = useMutation({
    mutationFn: async (drawingId: string) => {
      const response = await authenticatedApiRequest('DELETE', `/api/crypto/chart-drawings/${drawingId}`);
      return response.json();
    },
    onSuccess: () => {
      refetchDrawings();
    },
  });
  
  // Clear all drawings mutation
  const clearDrawingsMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedApiRequest('DELETE', `/api/crypto/chart-drawings?symbol=${symbol}&timeframe=${timeframe}`);
      return response.json();
    },
    onSuccess: () => {
      setDrawings([]);
      refetchDrawings();
    },
  });
  
  // Update drawing mutation (for settings changes)
  const updateDrawingMutation = useMutation({
    mutationFn: async ({ id, style }: { id: string; style: any }) => {
      const response = await authenticatedApiRequest('PATCH', `/api/crypto/chart-drawings/${id}`, { style });
      return response.json();
    },
    onSuccess: () => {
      refetchDrawings();
    },
  });
  
  // Attach gesture controller to chart for drawing tools
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = chartContainerRef.current;
    
    if (!chart || !candleSeries || !container || !chartReady) return;
    
    console.log('[EW GestureAttach] Attaching gesture controller to chart');
    gestureController.attachToChart(chart, candleSeries, container);
    
    return () => {
      console.log('[EW GestureAttach] Detaching gesture controller');
      gestureController.detachFromChart();
    };
  }, [chartReady, gestureController]);
  
  // Show visual snap feedback circle for wave drawing
  const showWaveSnapCircle = useCallback((x: number, y: number, isSnapped: boolean) => {
    const container = chartContainerRef.current;
    if (!container) return;
    
    if (!waveSnapCircleRef.current) {
      const circle = document.createElement('div');
      circle.style.cssText = `
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid ${isSnapped ? '#22c55e' : '#ef4444'};
        background: ${isSnapped ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
        pointer-events: none;
        transform: translate(-50%, -50%);
        transition: opacity 0.3s ease-out;
        z-index: 50;
      `;
      container.appendChild(circle);
      waveSnapCircleRef.current = circle;
    }
    
    const circle = waveSnapCircleRef.current;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.borderColor = isSnapped ? '#22c55e' : '#ef4444';
    circle.style.background = isSnapped ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    circle.style.opacity = '1';
    
    setTimeout(() => {
      if (waveSnapCircleRef.current) {
        waveSnapCircleRef.current.style.opacity = '0';
      }
    }, 400);
  }, []);
  
  // Keep ref updated for chart callbacks
  showWaveSnapCircleRef.current = showWaveSnapCircle;
  
  // Render horizontal lines using price lines
  const drawingLinesRef = useRef<any[]>([]);
  
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || !chartReady) return;
    
    drawingLinesRef.current.forEach(line => {
      try { candleSeries.removePriceLine(line); } catch (e) { /* ignore */ }
    });
    drawingLinesRef.current = [];
    
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
        const line = candleSeries.createPriceLine({
          price: drawing.points[0].price,
          color: drawing.style?.color || '#3b82f6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: drawing.style?.label || 'H-Line',
        });
        if (line) drawingLinesRef.current.push(line);
      }
    });
  }, [drawings, chartReady, selectedDrawingId]);

  // Reset chart when symbol or timeframe changes
  useEffect(() => {
    // Destroy existing chart so it gets recreated with new data
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        // Chart may already be disposed
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      blueCandelSeriesRef.current = null;
    }
    // Clean up wave snap circle to prevent orphaned DOM elements
    if (waveSnapCircleRef.current && waveSnapCircleRef.current.parentNode) {
      waveSnapCircleRef.current.parentNode.removeChild(waveSnapCircleRef.current);
    }
    waveSnapCircleRef.current = null;
  }, [symbol, timeframe]);

  // Fetch wave degrees
  const { data: degreesData } = useQuery<{ degrees: WaveDegree[] }>({
    queryKey: ['/api/crypto/elliott-wave/degrees'],
  });

  useEffect(() => {
    if (degreesData?.degrees) {
      setWaveDegrees(degreesData.degrees);
    }
  }, [degreesData]);

  // Fetch extended historical data (1000 candles) - free for viewing
  const { data: historyData, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery<{
    candles: CandleData[];
    candleCount: number;
  }>({
    queryKey: ['/api/crypto/extended-history', symbol, timeframe],
    queryFn: async () => {
      console.log('📊 Fetching 1000 candles for', symbol, timeframe);
      const falcon = isFalconTicker(symbol);
      const response = await fetch(
        falcon
          ? `/api/crypto/falcon/candles?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=1000`
          : `/api/crypto/extended-history?symbol=${symbol}&timeframe=${timeframe}&limit=1000`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || `Failed to fetch history (${response.status})`);
      }
      const data = await response.json();
      console.log('📊 Loaded', data.candleCount, 'candles');
      return data;
    },
    retry: 1,
    refetchInterval: isFalconTicker(symbol) ? 15000 : false,
    enabled: !isFalconTicker(symbol) || isFalconCandleTimeframe(timeframe),
  });

  useEffect(() => {
    if (historyData?.candles) {
      setCandles(historyData.candles);
    }
  }, [historyData]);

  // Fetch saved wave labels (scoped by user so caches never cross accounts)
  // In development: open access, no auth required
  // In production: require isAuthenticated, and authReady
  const labelsQueryKey = ['/api/crypto/elliott-wave/labels', userScope, symbol, timeframe] as const;
  const { data: labelsData, refetch: refetchLabels } = useQuery<ElliottWaveLabel[]>({
    queryKey: labelsQueryKey,
    queryFn: async () => {
      const response = await authenticatedApiRequest('GET', `/api/crypto/elliott-wave/labels?symbol=${symbol}&timeframe=${timeframe}`);
      return response.json();
    },
    enabled: isDevelopment || (isAuthenticated && !!user?.id && canUseElliottFeatures && authReady.ready),
  });

  // Helper to snap a time to the nearest valid candle time (for data layer)
  // This is a stable version for use during data loading/processing
  const snapTimeToCandle = useCallback((time: number, candlesArray: CandleData[]): number => {
    if (candlesArray.length === 0) return time;
    
    // Binary search for the closest candle time
    let left = 0;
    let right = candlesArray.length - 1;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (candlesArray[mid].time < time) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    // Check if left or left-1 is closer
    const candleTime = candlesArray[left].time;
    if (left > 0) {
      const prevCandleTime = candlesArray[left - 1].time;
      if (Math.abs(time - prevCandleTime) < Math.abs(time - candleTime)) {
        return prevCandleTime;
      }
    }
    return candleTime;
  }, []);

  // Helper to snap all point times in a label to valid candle times
  // CRITICAL: Preserve future projection times - don't snap them to historical candles!
  const snapLabelPointTimes = useCallback((label: ElliottWaveLabel, candlesArray: CandleData[]): ElliottWaveLabel => {
    if (!label.points || candlesArray.length === 0) return label;
    
    const lastCandleTime = candlesArray[candlesArray.length - 1]?.time || 0;
    
    const snappedPoints = label.points.map(point => {
      // PRESERVE future projection times - don't snap to historical candles
      // A point is in the future if it has isFutureProjection flag OR its time is beyond last candle
      if (point.isFutureProjection || point.time > lastCandleTime) {
        return point; // Keep original time for future points
      }
      return {
        ...point,
        time: snapTimeToCandle(point.time, candlesArray),
      };
    });
    
    return { ...label, points: snappedPoints };
  }, [snapTimeToCandle]);

  useEffect(() => {
    if (!user?.id && !isDevelopment) {
      setSavedLabels([]);
      savedLabelsRef.current = [];
      return;
    }
    if (labelsData && candles.length > 0) {
      // CRITICAL: Snap all point times to valid candle times when loading
      // This prevents markers from disappearing during pan/zoom
      const snappedLabels = labelsData.map(label => snapLabelPointTimes(label, candles));
      setSavedLabels(snappedLabels);
      savedLabelsRef.current = snappedLabels; // Sync ref immediately for click handler
      console.log('📋 Loaded labels from DB, count:', snappedLabels.length, '(times snapped to candles)');
    } else if (labelsData && candles.length === 0) {
      // Candles not loaded yet, store labels unsnapped (will snap when candles load)
      setSavedLabels(labelsData);
      savedLabelsRef.current = labelsData;
      console.log('📋 Loaded labels from DB (unsnapped, waiting for candles)');
    }
  }, [labelsData, candles, snapLabelPointTimes, user?.id]);

  // Fetch ALL labels across all timeframes for Wave Stacking (scoped by user)
  const labelsAllQueryKey = ['/api/crypto/elliott-wave/labels-all', userScope, symbol] as const;
  const { data: allTimeframeLabels } = useQuery<ElliottWaveLabel[]>({
    queryKey: labelsAllQueryKey,
    queryFn: async () => {
      const response = await authenticatedApiRequest('GET', `/api/crypto/elliott-wave/labels?symbol=${symbol}&allTimeframes=true`);
      return response.json();
    },
    enabled: isDevelopment || (isAuthenticated && !!user?.id && canUseElliottFeatures && authReady.ready),
  });

  // Convert labels to stack entries for pattern analysis
  // CRITICAL: Normalize times so startTime is always MIN and endTime is always MAX
  // This handles "backward drawing" where user draws waves from end to start
  const waveStackEntries: WaveStackEntry[] = (allTimeframeLabels || [])
    .filter(label => label.points && label.points.length >= 2)
    .map(label => {
      const times = label.points.map(p => p.time);
      const prices = label.points.map(p => p.price);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      // Get prices at the time boundaries (for direction calculation)
      const priceAtMinTime = label.points.find(p => p.time === minTime)?.price || prices[0];
      const priceAtMaxTime = label.points.find(p => p.time === maxTime)?.price || prices[prices.length - 1];
      
      return {
        id: label.id,
        timeframe: label.timeframe,
        degree: label.degree,
        patternType: label.patternType,
        waveCount: getWaveCount(label.patternType),
        direction: (priceAtMaxTime > priceAtMinTime ? 'up' : 'down') as 'up' | 'down',
        startPrice: priceAtMinTime,
        endPrice: priceAtMaxTime,
        startTime: minTime,
        endTime: maxTime,
      };
    })
    .sort((a, b) => a.startTime - b.startTime); // Sort by start time

  // Analyze the wave stack for patterns
  const waveStackSuggestion = analyzeWaveStack(waveStackEntries);
  
  // Group waves into structures by degree
  const groupedStructures = computeCascadeScores(groupWaveStructures(waveStackEntries));
  
  // State for expanded/collapsed structure groups
  const [expandedStructures, setExpandedStructures] = useState<Set<string>>(new Set());
  
  // State for expanded/collapsed individual entries (for nested tree)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  
  // State for selected prediction type (W3 vs C) per structure
  // Maps structure.id to 'impulse' (W3/W5) or 'correction' (C/Y)
  const [selectedPredictionType, setSelectedPredictionType] = useState<Record<string, 'impulse' | 'correction' | null>>({});
  
  // State for B wave type selection (flat vs zigzag) when correction is selected
  const [selectedBWaveType, setSelectedBWaveType] = useState<Record<string, 'flat' | 'zigzag' | null>>({});
  
  // Toggle structure expansion
  const toggleStructure = (structureId: string) => {
    setExpandedStructures(prev => {
      const next = new Set(prev);
      if (next.has(structureId)) {
        next.delete(structureId);
      } else {
        next.add(structureId);
      }
      return next;
    });
  };
  
  // Toggle entry expansion (for recursive tree)
  const toggleEntry = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Save wave label mutation (with centralized auth)
  const saveLabel = useMutation({
    mutationFn: async (label: Partial<ElliottWaveLabel>) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/labels', label);
      return response.json();
    },
    onSuccess: (newLabel: ElliottWaveLabel) => {
      toast({
        title: 'Wave Label Saved',
        description: 'Pattern saved! Drawing mode disabled - scroll freely.',
      });
      
      // CRITICAL: Snap point times to valid candle times before adding to state
      // This prevents markers from disappearing during pan/zoom
      const snappedLabel = snapLabelPointTimes(newLabel, candles);
      
      // IMMEDIATELY add the snapped label to local state to prevent visual gaps
      // Use functional update to avoid stale closure issue
      console.log('💾 Save success - adding new label with', snappedLabel.points?.length, 'points (times snapped)');
      setSavedLabels(prev => {
        const updatedLabels = [...prev, snappedLabel];
        savedLabelsRef.current = updatedLabels;
        console.log('💾 Updated savedLabels count:', updatedLabels.length);
        return updatedLabels;
      });
      
      // Auto-select the newly saved label to keep trendlines visible
      setSelectedLabelId(newLabel.id);
      console.log('💾 Selected label ID:', newLabel.id);
      
      // Clear current drawing state
      setCurrentPoints([]);
      setIsDrawing(false); // Turn off drawing after save
      trendDirectionRef.current = null; // Clear cached direction for next pattern
      correctionContextRef.current = null; // Clear correction context (parent impulse data)
      
      // CRITICAL: Clear Fib projection data to prevent stale lines appearing on saved pattern
      fibProjectionPricesRef.current = [];
      // Also clean up any visible Fib lines from the chart
      if (candleSeriesRef.current) {
        fibLinesRef.current.forEach(line => {
          try { candleSeriesRef.current?.removePriceLine(line); } catch (e) { /* ignore */ }
        });
        fibLinesRef.current = [];
      }
      
      // Force marker refresh to show the new pattern
      setMarkersVersion(v => v + 1);
      
      // Update React Query cache directly instead of refetching
      // This prevents the race condition where refetch overwrites local state
      queryClient.setQueryData(
        labelsQueryKey,
        (oldData: ElliottWaveLabel[] | undefined) => {
          const existing = oldData || [];
          return [...existing, snappedLabel]; // Use snapped label in cache too
        }
      );
      
      // Invalidate all-timeframe query for Wave Stacking
      queryClient.invalidateQueries({ queryKey: labelsAllQueryKey });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          toast({
            title: 'Sign In Required',
            description: 'Please sign in to save wave patterns.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Save Failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Save Failed',
          description: error.message || 'Network error or unexpected failure.',
          variant: 'destructive',
        });
      }
    },
  });

  // Delete wave label mutation (with centralized auth)
  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedApiRequest('DELETE', `/api/crypto/elliott-wave/labels/${id}`);
      return response.json();
    },
    onSuccess: (_, deletedId) => {
      toast({
        title: 'Label Deleted',
        description: 'Pattern deleted. Select another or tap Select again to exit.',
      });
      // Immediately update local state to remove deleted pattern (don't wait for refetch)
      const updatedLabels = savedLabels.filter(l => l.id !== deletedId);
      setSavedLabels(updatedLabels);
      savedLabelsRef.current = updatedLabels; // Sync ref immediately
      setSelectedLabelId(null);
      
      // Detach old markers primitive first to remove from chart
      if (markersRef.current) {
        try {
          (markersRef.current as any).detach?.();
        } catch (e) { /* ignore */ }
        markersRef.current = null;
      }
      
      // Force markers useEffect to re-run with updated savedLabels
      setMarkersVersion(v => v + 1);
      
      // Update React Query cache directly instead of refetching
      queryClient.setQueryData(
        labelsQueryKey,
        (oldData: ElliottWaveLabel[] | undefined) => {
          return (oldData || []).filter(l => l.id !== deletedId);
        }
      );
      
      // Invalidate all-timeframe query for Wave Stacking
      queryClient.invalidateQueries({ queryKey: labelsAllQueryKey });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          toast({
            title: 'Sign In Required',
            description: 'Please sign in to delete wave patterns.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Delete Failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Delete Failed',
          description: error.message || 'Network error or unexpected failure.',
          variant: 'destructive',
        });
      }
    },
  });

  // Update wave label mutation (for drag-and-drop point editing, with centralized auth)
  const updateLabel = useMutation({
    mutationFn: async (data: { id: string; points?: WavePoint[]; degree?: string }) => {
      const body: any = {};
      if (data.points !== undefined) body.points = data.points;
      if (data.degree !== undefined) body.degree = data.degree;
      const response = await authenticatedApiRequest('PATCH', `/api/crypto/elliott-wave/labels/${data.id}`, body);
      return response.json();
    },
    onSuccess: () => {
      // Toast shown in click handler, just clear state here
      setIsDragging(false);
      setDraggedPointIndex(null);
      refetchLabels();
      // Invalidate all-timeframe query for Wave Stacking
      queryClient.invalidateQueries({ queryKey: labelsAllQueryKey });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          toast({
            title: 'Sign In Required',
            description: 'Please sign in to update wave patterns.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Update Failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Update Failed',
          description: error.message || 'Network error or unexpected failure.',
          variant: 'destructive',
        });
      }
      setIsDragging(false);
      setDraggedPointIndex(null);
    },
  });

  // === Saved Projection Lines ===
  // Query to fetch saved projection lines for current symbol (scoped by user)
  const { data: savedProjectionLinesData, refetch: refetchProjectionLines } = useQuery<SavedProjectionLine[]>({
    queryKey: ['/api/crypto/projection-lines', userScope, symbol],
    queryFn: async () => {
      const response = await authenticatedApiRequest('GET', `/api/crypto/projection-lines?symbol=${symbol}`);
      return response.json();
    },
    enabled: isDevelopment || (isAuthenticated && !!user?.id && canUseElliottFeatures && authReady.ready),
  });
  
  const savedProjectionLinesFromDB = savedProjectionLinesData || [];
  
  // Mutation to save a projection line
  const saveProjectionLine = useMutation({
    mutationFn: async (data: { 
      symbol: string; 
      timeframe: string; 
      structureId: string; 
      levelLabel: string; 
      price: number; 
      color: string;
      waveType: string;
    }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/projection-lines', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Target Saved', description: 'Projection line saved to chart' });
      refetchProjectionLines();
    },
    onError: (error: Error) => {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    },
  });
  
  // Mutation to delete a projection line
  const deleteProjectionLine = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedApiRequest('DELETE', `/api/crypto/projection-lines/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Target Removed', description: 'Projection line removed from chart' });
      refetchProjectionLines();
    },
    onError: (error: Error) => {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    },
  });
  
  // Mutation to toggle alert on a projection line
  const toggleProjectionAlert = useMutation({
    mutationFn: async (data: { id: string; alertEnabled: boolean }) => {
      // Include id in body as fallback for Vercel routing issues
      const response = await authenticatedApiRequest('PATCH', `/api/crypto/projection-lines/${data.id}`, { id: data.id, alertEnabled: data.alertEnabled });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: variables.alertEnabled ? 'Alert Enabled' : 'Alert Disabled', 
        description: variables.alertEnabled ? 'You will be notified when price hits this target' : 'Alert removed' 
      });
      refetchProjectionLines();
    },
    onError: (error: Error) => {
      toast({ title: 'Alert Update Failed', description: error.message, variant: 'destructive' });
    },
  });
  
  // Helper to check if a projection line is saved (match by structureId, levelLabel, symbol, AND price)
  // Allows same label+price from DIFFERENT structures (e.g., Minor W2 62% and Minute W2 62%)
  // Prevents duplicates within the SAME structure
  const isProjectionSaved = (structureId: string, levelLabel: string, price?: number): SavedProjectionLine | undefined => {
    return savedProjectionLinesFromDB.find(line => {
      // Must match symbol, label, AND structureId (allows same target from different degrees)
      if (line.levelLabel !== levelLabel || line.symbol !== symbol || line.structureId !== structureId) return false;
      // If price provided, also check price is within 0.1% tolerance (same target)
      if (price !== undefined) {
        const priceDiff = Math.abs(line.price - price) / price;
        return priceDiff < 0.001; // 0.1% tolerance
      }
      return true;
    });
  };
  
  // Load saved projection lines onto chart when data loads
  useEffect(() => {
    if (savedProjectionLinesFromDB.length > 0) {
      const linesToAdd = savedProjectionLinesFromDB
        .filter(line => line.symbol === symbol) // Only lines for current symbol
        .map(line => ({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: line.alertEnabled ? `🔔 ${line.levelLabel}` : `${line.levelLabel}`, // Bell icon if alert active
        }));
      
      // Merge with existing lines (avoiding duplicates by title)
      setStackProjectionLines(prev => {
        const existingTitles = new Set(prev.map(l => l.title));
        const newLines = linesToAdd.filter(l => !existingTitles.has(l.title));
        return [...prev, ...newLines];
      });
    }
  }, [savedProjectionLinesFromDB, symbol]);

  // Calculate validation instantly on client side (no API call)
  // Use current points if drawing, or selected saved label's points if in selection mode
  // Also check allTimeframeLabels for cross-timeframe selections from wave table
  const selectedLabel = selectedLabelId 
    ? (savedLabels.find(l => l.id === selectedLabelId) || 
       (allTimeframeLabels || []).find(l => l.id === selectedLabelId))
    : null;
  const validationPoints = currentPoints.length >= 3 
    ? currentPoints 
    : (selectedLabel?.points || []);
  const validationPatternType = currentPoints.length >= 3 
    ? patternType 
    : (selectedLabel?.patternType || patternType);
  const validation = validationPoints.length >= 3 
    ? runValidation(validationPoints, validationPatternType)
    : null;

  // Auto-analyze mutation (algorithmic, with centralized auth)
  const autoAnalyze = useMutation({
    mutationFn: async (data: { candles: CandleData[]; startIndex: number; endIndex: number }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/analyze', data);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.patterns && result.patterns.length > 0) {
        const pattern = result.patterns[0];
        setCurrentPoints(pattern.points);
        setPatternType(pattern.type);
        toast({
  title: 'Pattern Detected',
  description: `Found ${pattern.type} pattern with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
});
      } else {
        toast({
          title: 'No Pattern Found',
          description: 'Try adjusting the visible range or selecting different candles.',
        });
      }
    },
  });

  // AI-powered analysis mutation using Grok (with centralized auth)
const aiAnalyze = useMutation({
    mutationFn: async (data: { 
      chartImage?: string; 
      symbol: string; 
      timeframe: string; 
      existingLabels?: string; 
      degreeContext?: string; 
      visibleRange?: string;
      candles: CandleData[]; 
      visibleStartIndex: number; 
    }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/ai-analyze', data);
      return response.json();
    },
  onSuccess: (data: any) => {
  // Test mode returns { success: true, grokSaid: 'GROK IS ALIVE' }
  if (data.grokSaid || data.mock) {
    setAiAnalysis(null);
    toast({
      title: 'Grok Connection Test',
      description: data.grokSaid || 'Grok is alive and ready!',
    });
    return;
  }

  // Normal Grok response
  setAiAnalysis(data);
  toast({
    title: `AI: ${data.patternType?.charAt(0).toUpperCase() + data.patternType?.slice(1) || 'Unknown'} Pattern`,
    description: `${data.confidence?.toFixed(0) || '?'}% confidence - ${data.currentWave || 'Analyzing...'}`,
  });
},

  
    onError: (error: any) => {
      toast({
        title: 'AI Analysis Failed',
        description: error.message || 'Could not analyze chart',
        variant: 'destructive',
      });
    },
});

  // Calculate pivot points from candles (for AI analysis)
  const calculatePivots = (candleData: typeof candles, lookback: number = 5): Array<{time: number; price: number; type: 'H' | 'L'}> => {
    const pivots: Array<{time: number; price: number; type: 'H' | 'L'}> = [];
    if (candleData.length < lookback * 2 + 1) return pivots;
    
    for (let i = lookback; i < candleData.length - lookback; i++) {
      const current = candleData[i];
      let isPivotHigh = true;
      let isPivotLow = true;
      
      for (let j = 1; j <= lookback; j++) {
        if (candleData[i - j].high >= current.high || candleData[i + j].high >= current.high) {
          isPivotHigh = false;
        }
        if (candleData[i - j].low <= current.low || candleData[i + j].low <= current.low) {
          isPivotLow = false;
        }
      }
      
      if (isPivotHigh) pivots.push({ time: current.time, price: current.high, type: 'H' });
      if (isPivotLow) pivots.push({ time: current.time, price: current.low, type: 'L' });
    }
    
    return pivots.sort((a, b) => a.time - b.time);
  };

  // Grok Stack Analysis mutation (admin only)
  const grokStackAnalyze = useMutation({
    mutationFn: async (data: { 
      waveEntries: WaveStackEntry[]; 
      symbol: string; 
      pivots?: Array<{time: number; price: number; type: 'H' | 'L'}>;
      scopedWave?: { id: string; degree: string; label: string; startTime: number; endTime: number; startPrice: number; endPrice: number } | null;
      priorWaveContext?: { degree: string; type: string; direction: string; waveCount: number; startPrice: number; endPrice: number; priceChange: string } | null;
    }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/analyze-stack', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.analysis) {
        const { synopsis, tableData } = data.analysis;
        setGrokStackAnalysis({
          synopsis: synopsis || data.analysis.interpretation || 'No interpretation available',
          tableData: tableData || [],
          rawResponse: data.rawResponse,
        });
        toast({
          title: 'Grok Stack Analysis Complete',
          description: `Analyzed ${data.waveCount} waves`,
        });
      } else {
        setGrokStackAnalysis({
          synopsis: data.analysis?.interpretation || data.rawResponse || 'Analysis complete but no structured data',
          tableData: [],
          rawResponse: data.rawResponse,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Stack Analysis Failed',
        description: error.message || 'Could not analyze wave stack',
        variant: 'destructive',
      });
    },
  });

  // Timeframe hierarchy for detailed analysis
  const TIMEFRAME_HIERARCHY: Record<string, string> = {
    '1M': '1w', '1w': '1d', '1d': '4h', '4h': '1h', '1h': '15m', '15m': '5m', '5m': '1m',
  };

  // Detailed Sub-Wave Analysis mutation (uses lower timeframe data)
  const detailedAnalyze = useMutation({
    mutationFn: async (data: { 
      selectedWave: {
        id: string;
        degree: string;
        patternType: string;
        waveCount: number;
        direction: string;
        startTime: number;
        endTime: number;
        startPrice: number;
        endPrice: number;
        timeframe: string;
      };
      symbol: string;
      priorWaveContext?: { degree: string; type: string; direction: string; waveCount: number; startPrice: number; endPrice: number; priceChange: string; durationHours: number } | null;
    }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/analyze-detailed', data, { timeout: 150000 });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.analysis) {
        setDetailedAnalysis({
          synopsis: data.analysis.synopsis || 'Analysis complete',
          subWaves: data.analysis.subWaves || [],
          rawResponse: data.rawResponse,
          analysisTimeframe: data.analysisTimeframe,
          pivotCount: data.pivotCount,
        });
        toast({
          title: 'Detailed Analysis Complete',
          description: `Found ${data.analysis.subWaves?.length || 0} sub-waves using ${data.analysisTimeframe} data (${data.pivotCount} pivots)`,
        });
      } else {
        setDetailedAnalysis({
          synopsis: data.analysis?.synopsis || data.rawResponse || 'Analysis complete',
          subWaves: [],
          rawResponse: data.rawResponse,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Detailed Analysis Failed',
        description: error.message || 'Could not perform detailed sub-wave analysis',
        variant: 'destructive',
      });
    },
  });

  // Chart Data Analysis mutation (raw pattern detection without labels)
  const chartAnalyze = useMutation({
    mutationFn: async (data: { 
      symbol: string;
      timeframe: string;
      pivots: Array<{time: number; price: number; type: 'H' | 'L'}>;
      priceRange: { high: number; low: number; start: number; end: number };
    }) => {
      const response = await authenticatedApiRequest('POST', '/api/crypto/elliott-wave/analyze-chart', data, { timeout: 150000 });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.analysis) {
        setChartAnalysis({
          synopsis: data.analysis.synopsis || 'Analysis complete',
          bestFitPattern: data.analysis.bestFitPattern || 'unclear',
          confidence: data.analysis.confidence || 0,
          direction: data.analysis.direction || 'sideways',
          possiblePatterns: data.analysis.possiblePatterns || [],
          possibleOutcomes: data.analysis.possibleOutcomes || [],
          fibonacciLevels: data.analysis.fibonacciLevels,
          rawResponse: data.rawResponse,
        });
        toast({
          title: 'Chart Analysis Complete',
          description: `Best fit: ${data.analysis.bestFitPattern} (${data.analysis.confidence}% confidence)`,
        });
      } else {
        setChartAnalysis({
          synopsis: data.rawResponse || 'Analysis complete',
          bestFitPattern: 'unclear',
          confidence: 0,
          direction: 'sideways',
          possiblePatterns: [],
          possibleOutcomes: [],
          rawResponse: data.rawResponse,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Chart Analysis Failed',
        description: error.message || 'Could not analyze chart data',
        variant: 'destructive',
      });
    },
  });

  // Refs to hold current state values for click handler (avoids re-creating chart)
  const isDrawingRef = useRef(isDrawing);
  const selectedDegreeRef = useRef(selectedDegree);
  const patternTypeRef = useRef(patternType);
  const currentPointsRef = useRef(currentPoints);
  const waveDegreesRef = useRef(waveDegrees);
  const candlesRef = useRef(candles);
  const selectionModeRef = useRef(selectionMode);
  const visibleCandleCountRef = useRef(visibleCandleCount);
  const savedLabelsRef = useRef(savedLabels);
  const selectedLabelIdRef = useRef(selectedLabelId);
  const draggedPointIndexRef = useRef(draggedPointIndex);
  const isDraggingRef = useRef(isDragging);
  const updateLabelRef = useRef(updateLabel);
  const drawingModeRef = useRef(drawingMode); // For drawing tools crosshair mode
  
  // CRITICAL: Cache trend direction when point 0 is placed - used for all subsequent snaps
  const trendDirectionRef = useRef<'up' | 'down' | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isDrawingRef.current = isDrawing;
    selectedDegreeRef.current = selectedDegree;
    patternTypeRef.current = patternType;
    currentPointsRef.current = currentPoints;
    waveDegreesRef.current = waveDegrees;
    candlesRef.current = candles;
    selectionModeRef.current = selectionMode;
    visibleCandleCountRef.current = visibleCandleCount;
    savedLabelsRef.current = savedLabels;
    selectedLabelIdRef.current = selectedLabelId;
    draggedPointIndexRef.current = draggedPointIndex;
    isDraggingRef.current = isDragging;
    updateLabelRef.current = updateLabel;
    fibonacciModeRef.current = fibonacciMode;
    timeframeRef.current = timeframe;
    drawingModeRef.current = drawingMode;
    waveAutoSnapEnabledRef.current = waveAutoSnapEnabled;
  }, [isDrawing, selectedDegree, patternType, currentPoints, waveDegrees, candles, selectionMode, visibleCandleCount, savedLabels, selectedLabelId, draggedPointIndex, isDragging, updateLabel, fibonacciMode, timeframe, drawingMode, waveAutoSnapEnabled]);
  
  // Clear correction context when switching away from correction pattern type
  useEffect(() => {
    if (patternType !== 'correction' && patternType !== 'zigzag' && patternType !== 'flat') {
      correctionContextRef.current = null;
    }
  }, [patternType]);

  // Auto-save when pattern is complete AND validation is available
  useEffect(() => {
    // Guard: Don't auto-save if user lacks access
    if (!hasElliottAccess) {
      return;
    }
    
    const labels = patternType === 'impulse' ? ['0', '1', '2', '3', '4', '5'] :
                   patternType === 'correction' || patternType === 'zigzag' || patternType === 'flat' ? ['0', 'A', 'B', 'C'] :
                   patternType === 'triangle' ? ['0', 'A', 'B', 'C', 'D', 'E'] :
                   ['0', '1', '2', '3', '4', '5'];
    
    // Check if pattern is complete (all points placed)
    if (currentPoints.length === labels.length && currentPoints.length > 0 && !saveLabel.isPending) {
      // Auto-save the completed pattern (validation will be included if available)
      saveLabel.mutate({
        symbol,
        timeframe,
        degree: selectedDegree,
        patternType,
        points: currentPoints,
        isComplete: true,
        fibonacciMode,
        validationResult: validation || undefined,
      });
    }
  }, [currentPoints, patternType, symbol, timeframe, selectedDegree, fibonacciMode, validation, hasElliottAccess]);

  // Initialize chart - only recreate when candles data changes
  useEffect(() => {
    console.log('📊 Chart effect triggered, candles:', candles.length);
    if (!chartContainerRef.current) {
      console.log('📊 No chart container ref');
      return;
    }
    if (candles.length === 0) {
      console.log('📊 No candles data');
      return;
    }
    
    // Wait for container to have dimensions
    const containerWidth = chartContainerRef.current.clientWidth;
    const containerHeight = chartContainerRef.current.clientHeight;
    console.log('📊 Container dimensions:', containerWidth, 'x', containerHeight);
    
    if (containerWidth === 0) {
      // Container not ready yet, retry after a short delay
      console.log('📊 Container width is 0, retrying in 100ms');
      const retryTimer = setTimeout(() => {
        // Force re-run by toggling a temporary state
        setCandles(prev => [...prev]);
      }, 100);
      return () => clearTimeout(retryTimer);
    }

    const chartData = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Add virtual/invisible candles for future projection points so markers can be placed there
    const lastCandle = candles[candles.length - 1];
    const secondLastCandle = candles.length >= 2 ? candles[candles.length - 2] : candles[0];
    const candleInterval = lastCandle.time - secondLastCandle.time || 60;
    
    // Extend chart data with virtual future candles so drawings can land past the last bar.
    // 4h gets ~6 months of dated axis; only ~2 months are in the initial viewport.
    const futureBarCount = getFutureBarCount(timeframeRef.current);
    const initialVisibleFuture = getInitialVisibleFutureBarCount(timeframeRef.current);
    for (let i = 1; i <= futureBarCount; i++) {
      const futureTime = lastCandle.time + (candleInterval * i);
      chartData.push({
        time: futureTime as any,
        open: lastCandle.close,
        high: lastCandle.close,
        low: lastCandle.close,
        close: lastCandle.close,
      });
    }

    // If chart already exists, update data in-place
    if (chartRef.current && candleSeriesRef.current) {
      candleSeriesRef.current.setData(chartData);
      return;
    }

    // First time: create the chart
    console.log('📊 Creating new chart with', chartData.length, 'data points');
    const chart = createChart(chartContainerRef.current, {
      layout: {
        attributionLogo: true,
        background: { type: ColorType.Solid, color: '#0e0e0e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        rightOffset: 150, // Match Indicators page for consistent drawing tool behavior
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    candleSeries.setData(chartData);

    // Keep the initial zoom similar to before (historical + ~2 months on 4h).
    // Extra future dates are on the series — pan right to project further.
    chart.timeScale().setVisibleLogicalRange({
      from: 0,
      to: candles.length + initialVisibleFuture,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setChartReady(true);
    
    // Emit custom event for drawing tools click handler
    // IMPORTANT: Check crosshair mode first (matches Indicators page pattern)
    chart.subscribeClick((param) => {
      let time: number | undefined;
      let price: number | null = null;
      
      // Use crosshair mode coordinates if active (for precise mobile/touch placement)
      if (crosshairModeActiveRef.current && lastCrosshairParamRef.current) {
        time = lastCrosshairParamRef.current.time;
        price = lastCrosshairParamRef.current.price;
        // Note: Don't deactivate here - let the wave placement handler do it
      } else if (param.time && param.point) {
        time = param.time as number;
        price = candleSeries.coordinateToPrice(param.point.y);
      }
      
      if (time && price !== null) {
        const event = new CustomEvent('chartClick', { 
          detail: { time, price }
        });
        chartContainerRef.current?.dispatchEvent(event);
      }
    });
    
    // Create a secondary blue candlestick series for future projection candles
    // This allows markers to anchor at correct prices in the future area
    const blueCandleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00b4d8', // Cyan blue
      downColor: '#00b4d8',
      borderUpColor: '#0077b6',
      borderDownColor: '#0077b6',
      wickUpColor: '#0077b6',
      wickDownColor: '#0077b6',
    });
    blueCandleSeries.setData([]); // Start empty
    blueCandelSeriesRef.current = blueCandleSeries;

    // Handle chart click/tap for wave point selection - use refs for current state
    chart.subscribeClick((param) => {
      if (!param.point) {
        console.log('📍 Click rejected - no param.point');
        return;
      }
      
      // Skip click if it's the one from lifting the crosshair activation touch
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        console.log('📍 Click ignored - crosshair activation gesture');
        return;
      }
      
      // Skip Elliott Wave processing when drawing tools are active - they have their own handler
      const inDrawingToolsMode = drawingModeRef.current === 'draw';
      if (inDrawingToolsMode) {
        console.log('📍 Click skipped - drawing tools mode active');
        return;
      }
      
      // CROSSHAIR MODE: Check if persistent crosshair mode is active
      // When active, use stored crosshair position for placement, then deactivate
      // Note: Only check crosshairModeActiveRef - the long-press timer already validates
      // drawing mode before activating crosshair mode, so this is sufficient
      const isCrosshairMode = crosshairModeActiveRef.current;
      
      // If crosshair mode is active but user is panning (finger moved OR long touch), don't place
      // Only quick taps (< 400ms) should place points in crosshair mode
      const touchDuration = Date.now() - touchStartTimeRef.current;
      const TAP_THRESHOLD = 400; // ms - quick tap threshold (increased for easier use)
      
      if (isCrosshairMode) {
        // Calculate actual movement distance for this gesture
        const startX = (window as any).__touchStartX ?? 0;
        const startY = (window as any).__touchStartY ?? 0;
        const endX = param.point.x;
        const endY = param.point.y;
        const moveDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const TAP_MOVE_TOLERANCE = 25; // px - allow small movement during tap
        
        // Only block if significant movement AND long duration (panning)
        if ((window as any).__touchMoved && moveDistance > TAP_MOVE_TOLERANCE) {
          console.log('📍 Crosshair mode: panning (moved', moveDistance.toFixed(0), 'px) - waiting for tap');
          (window as any).__touchMoved = false;
          return;
        }
        if (touchDuration > TAP_THRESHOLD && moveDistance > TAP_MOVE_TOLERANCE) {
          console.log('📍 Crosshair mode: panning (slow touch', touchDuration, 'ms) - waiting for tap');
          return;
        }
      }

      // Determine effective position: use crosshair position in crosshair mode, touch position otherwise
      let effectiveTime: number | null = param.time as number | null;
      let clickedPrice: number | null = candleSeries.coordinateToPrice(param.point.y);
      
      if (isCrosshairMode) {
        // Use FROZEN crosshair position (captured when user lifted finger after positioning)
        // This is critical because subscribeCrosshairMove fires BEFORE subscribeClick,
        // so lastCrosshairParamRef would already have the TAP position by now
        if (capturedCrosshairPositionRef.current) {
          effectiveTime = capturedCrosshairPositionRef.current.time;
          clickedPrice = capturedCrosshairPositionRef.current.price;
          console.log('📍 CROSSHAIR MODE: Using FROZEN position at time:', effectiveTime, 'price:', clickedPrice);
        } else if (lastCrosshairParamRef.current) {
          // Fallback: use last known position (may be tap position, but better than nothing)
          effectiveTime = lastCrosshairParamRef.current.time;
          clickedPrice = lastCrosshairParamRef.current.price;
          console.log('📍 CROSSHAIR MODE: No frozen position, using lastCrosshairParam as fallback');
        } else {
          // Crosshair mode active but no stored position yet - use click position as fallback
          console.log('📍 CROSSHAIR MODE: No stored position, using click position as fallback');
        }
      } else {
        // Normal click: use param position
        // Try primary candle series first, then fallback to blue simulation series or price scale
        if (clickedPrice === null && blueCandelSeriesRef.current) {
          clickedPrice = blueCandelSeriesRef.current.coordinateToPrice(param.point.y);
          console.log('📍 Fallback to blue series, price:', clickedPrice);
        }
        if (clickedPrice === null) {
          // Final fallback: estimate price from visible price range and Y coordinate
          try {
            const visibleRange = candleSeries.priceScale().getVisibleRange();
            if (visibleRange) {
              // Get chart container height for calculation
              const container = chartContainerRef.current;
              if (container) {
                const chartHeight = container.clientHeight - 30; // Approximate header/margin
                const priceRange = visibleRange.to - visibleRange.from;
                const pricePerPixel = priceRange / chartHeight;
                clickedPrice = (visibleRange.to - (param.point.y * pricePerPixel)) as any;
                console.log('📍 Fallback to price scale calc, price:', clickedPrice);
              }
            }
          } catch (e) {
            console.log('📍 Fallback price calc failed:', e);
          }
        }
      }
      
      console.log('📍 Click at Y:', param.point.y, 'converted to price:', clickedPrice, 'crosshairMode:', isCrosshairMode);
      if (clickedPrice === null) {
        console.log('📍 Click rejected - all price conversion methods returned null');
        return;
      }

      // Check if clicking on existing candle or in future area (projected mode)
      const candleIndex = effectiveTime ? candlesRef.current.findIndex(c => c.time === effectiveTime) : -1;
      
      // ALSO check if click X position is beyond the last candle (chart may snap time to last candle)
      // In crosshair mode, use the crosshair X position instead of touch position
      const lastCandle = candlesRef.current[candlesRef.current.length - 1];
      const timeScale = chart.timeScale();
      const lastCandleX = timeScale.timeToCoordinate(lastCandle.time as any);
      // Use frozen crosshair position's pointX in crosshair mode (for detecting future clicks)
      const effectivePointX = isCrosshairMode && capturedCrosshairPositionRef.current?.pointX !== undefined
        ? capturedCrosshairPositionRef.current.pointX
        : (isCrosshairMode && lastCrosshairParamRef.current?.pointX !== undefined
          ? lastCrosshairParamRef.current.pointX
          : param.point.x);
      const isClickBeyondLastCandle = lastCandleX !== null && effectivePointX > lastCandleX + 10; // 10px buffer
      
      // DEBUG: Log click detection details
      console.log('📍 Click debug:', {
        clickX: param.point.x,
        lastCandleX,
        candleIndex,
        paramTime: param.time,
        isClickBeyondLastCandle,
        isDrawing: isDrawingRef.current,
        selectionMode: selectionModeRef.current,
        fibMode: fibonacciModeRef.current,
        fibPricesCount: fibProjectionPricesRef.current.length,
        savedLabelsCount: savedLabelsRef.current.length
      });
      
      const isClickingFuture = candleIndex === -1 || isClickBeyondLastCandle;
      
      // PRICE-BASED FIB SNAPPING: Allow clicking anywhere near a Fib price level to snap to it
      // This works regardless of X position - user can click on labels on the right side
      const canSnapToFib = isDrawingRef.current && 
        fibonacciModeRef.current === 'projected' && 
        fibProjectionPricesRef.current.length > 0;
      
      if (canSnapToFib) {
        // Find nearest Fib projection line by price
        const fibPrices = fibProjectionPricesRef.current;
        let nearestFib = fibPrices[0];
        let minDistance = Math.abs(clickedPrice - nearestFib.price);
        
        for (const fib of fibPrices) {
          const dist = Math.abs(clickedPrice - fib.price);
          if (dist < minDistance) {
            minDistance = dist;
            nearestFib = fib;
          }
        }
        
        // Check if click is close enough to the Fib line (within 3% of price)
        const tolerance = nearestFib.price * 0.03;
        console.log('🔮 Fib proximity check:', { clickedPrice, nearestFib: nearestFib.label, fibPrice: nearestFib.price, distance: minDistance, tolerance });
        
        if (minDistance <= tolerance) {
          // Detect if clicking on flat or zigzag target for corrections
          if (nearestFib.correctionType) {
            console.log('🎯 Detected correction type from Fib click:', nearestFib.correctionType);
            detectedCorrectionTypeRef.current = nearestFib.correctionType;
          }
          
          // Detect if clicking on contracting or expanding target for diagonals
          if (nearestFib.diagonalType) {
            console.log('🎯 Detected diagonal type from Fib click:', nearestFib.diagonalType);
            detectedDiagonalTypeRef.current = nearestFib.diagonalType;
          }
          
          // Get next label for the pattern
          const labels = patternTypeRef.current === 'impulse' ? ['0', '1', '2', '3', '4', '5'] :
                         patternTypeRef.current === 'correction' || patternTypeRef.current === 'zigzag' || patternTypeRef.current === 'flat' ? ['0', 'A', 'B', 'C'] :
                         patternTypeRef.current === 'triangle' ? ['0', 'A', 'B', 'C', 'D', 'E'] :
                         ['0', '1', '2', '3', '4', '5'];
          
          if (currentPointsRef.current.length >= labels.length) return;
          
          const nextLabel = labels[currentPointsRef.current.length];
          const isCorrection = ['2', '4', 'A', 'B', 'C', 'D', 'E'].includes(nextLabel);
          
          // Determine snappedToHigh based on trend AND wave label (not just isCorrection)
          const isDowntrend = trendDirectionRef.current === 'down';
          let snappedToHigh: boolean;
          if (['A', 'B', 'C', 'D', 'E'].includes(nextLabel)) {
            // Correction pattern labels
            if (isDowntrend) {
              // Downtrend: A/C/E go to lows (bottom), B/D go to highs (top)
              snappedToHigh = ['B', 'D'].includes(nextLabel);
            } else {
              // Uptrend: A/C/E go to highs (top), B/D go to lows (bottom)
              snappedToHigh = ['A', 'C', 'E'].includes(nextLabel);
            }
          } else {
            // Impulse pattern labels (1, 2, 3, 4, 5)
            const isOddWave = ['1', '3', '5'].includes(nextLabel);
            snappedToHigh = isDowntrend ? !isOddWave : isOddWave;
          }
          
          let pointTime: number;
          let pointIndex: number;
          let isFutureProjection: boolean;
          
          // CRITICAL: Check if clicking on existing candle or in future area
          if (isClickingFuture) {
            // Future area: calculate future time from logical position
            const secondLastCandle = candlesRef.current[candlesRef.current.length - 2];
            const candleInterval = lastCandle.time - secondLastCandle.time;
            const lastCandleIndex = candlesRef.current.length - 1;
            
            // Use crosshair's logical X when in crosshair mode, otherwise use click position
            const clickLogical = isCrosshairMode && lastCrosshairParamRef.current?.logicalX !== undefined
              ? lastCrosshairParamRef.current.logicalX
              : timeScale.coordinateToLogical(param.point.x);
            const barsAhead = clickLogical !== null 
              ? Math.max(1, Math.ceil(clickLogical - lastCandleIndex))
              : 5;
            
            pointTime = lastCandle.time + (candleInterval * barsAhead);
            pointIndex = candlesRef.current.length + barsAhead;
            isFutureProjection = true;
            
            console.log('📅 Future Fib snap:', { 
              clickLogical, barsAhead, 
              futureTime: new Date(pointTime * 1000).toISOString() 
            });
          } else {
            // Existing candle: use the candle's actual time
            const targetCandle = candlesRef.current[candleIndex];
            pointTime = targetCandle.time;
            pointIndex = candleIndex;
            isFutureProjection = false;
            
            console.log('📍 Existing candle Fib snap:', { 
              candleIndex, 
              candleTime: new Date(pointTime * 1000).toISOString() 
            });
          }
          
          console.log('🔮 Snapping to Fib:', nearestFib.label, 'at price', nearestFib.price, 
            isFutureProjection ? '(future)' : '(existing candle)');
          
          // Extract just the percentage from the label (e.g., "B zig 50%" -> "50%")
          const percentMatch = nearestFib.label.match(/(\d+(?:\.\d+)?%)/);
          const fibPercent = percentMatch ? percentMatch[1] : '';
          
          const newPoint: WavePoint = {
            index: pointIndex,
            time: pointTime,
            price: nearestFib.price,
            label: nextLabel,
            isCorrection: isCorrection,
            snappedToHigh,
            isFutureProjection,
            fibLabel: fibPercent // Store Fib label like "zig 50%" or "flat 127%"
          };
          
          const newPoints = [...currentPointsRef.current, newPoint];
          setCurrentPoints(newPoints);
          currentPointsRef.current = newPoints;
          console.log('✅ Added point via Fib snap:', newPoint);
          return; // Handled by Fib snap - don't continue to normal candle placement
        }
      }
      
      // In projected mode with Fib lines, also allow future clicks beyond last candle
      // BUT: Skip this if in selection mode - we need to check for future point selection first!
      if (isClickingFuture && !selectionModeRef.current) {
        // CHAIN PREDICTION: Check if clicking on a predicted point to start a new pattern
        // This allows starting an ABC correction from a predicted W5
        // Works when: drawing mode OFF, OR drawing mode ON with 0 points (fresh start)
        const predictedPoints = futurePointsDataRef.current;
        const canChainPredict = predictedPoints.length > 0 && 
          (!isDrawingRef.current || currentPointsRef.current.length === 0);
        if (canChainPredict) {
          // Find if click is near any predicted point
          for (const predictedPoint of predictedPoints) {
            const priceTolerance = predictedPoint.price * 0.02; // 2% tolerance
            const priceDiff = Math.abs(clickedPrice - predictedPoint.price);
            
            // Calculate time tolerance (within ~5 candles of the predicted point)
            const secondLastCandle = candlesRef.current[candlesRef.current.length - 2];
            const candleInterval = lastCandle.time - secondLastCandle.time;
            const timeTolerance = candleInterval * 5;
            
            // Use logical coordinates to get clicked time
            const clickLogical = timeScale.coordinateToLogical(param.point.x);
            const lastCandleIndex = candlesRef.current.length - 1;
            const barsFromLast = clickLogical !== null ? Math.ceil(clickLogical - lastCandleIndex) : 0;
            const estimatedClickTime = lastCandle.time + (candleInterval * barsFromLast);
            const timeDiff = Math.abs(estimatedClickTime - predictedPoint.time);
            
            if (priceDiff <= priceTolerance && timeDiff <= timeTolerance) {
              console.log('🔗 CHAIN PREDICTION: Clicked on predicted point:', predictedPoint.label, 
                'Looking for parent impulse pattern...');
              
              // FIND PARENT IMPULSE: First try same degree, then check for higher degree with lower corrective patterns
              // Scenario 1: Same degree impulse (e.g., Minor impulse → Minor correction)
              let parentImpulse = savedLabelsRef.current.find(label => {
                // Must be impulse or diagonal with 6 points (complete 5-wave: 0,1,2,3,4,5)
                const isCompleteImpulse = (label.patternType === 'impulse' || label.patternType === 'diagonal') 
                  && label.points.length >= 6;
                if (!isCompleteImpulse) return false;
                
                // Must be same degree
                if (label.degree !== selectedDegreeRef.current) return false;
                
                // W5 should be close to the predicted point's price (within 3%)
                const w5 = label.points[5];
                const w5PriceDiff = Math.abs(w5.price - predictedPoint.price) / predictedPoint.price;
                return w5PriceDiff < 0.03;
              });
              
              // Scenario 2: Cross-degree - Higher degree impulse with lower degree corrective patterns
              // Rule: Higher degree impulse present + 2 corrective moves in lower degree = C/Y wave can be drawn
              let isCrossDegreeCWave = false;
              if (!parentImpulse) {
                const selectedDegree = selectedDegreeRef.current;
                const degreeHierarchy = ['Primary', 'Intermediate', 'Minor', 'Minute', 'Minuette'];
                const currentDegreeIndex = degreeHierarchy.indexOf(selectedDegree);
                
                // Look for higher degree impulse (one step higher)
                if (currentDegreeIndex > 0) {
                  const higherDegree = degreeHierarchy[currentDegreeIndex - 1];
                  
                  // Find higher degree impulse
                  const higherImpulse = savedLabelsRef.current.find(label => {
                    const isCompleteImpulse = (label.patternType === 'impulse' || label.patternType === 'diagonal') 
                      && label.points.length >= 6;
                    return isCompleteImpulse && label.degree === higherDegree;
                  });
                  
                  if (higherImpulse) {
                    // Find lower degree corrective patterns after the higher impulse
                    const higherW5Time = higherImpulse.points[5]?.time || 0;
                    const lowerCorrections = savedLabelsRef.current.filter(label => {
                      if (label.degree !== selectedDegree) return false;
                      // Must be correction or triangle
                      if (label.patternType !== 'correction' && label.patternType !== 'triangle') return false;
                      // Must be after higher impulse W5
                      const labelStartTime = label.points[0]?.time || 0;
                      return labelStartTime >= higherW5Time;
                    });
                    
                    // Need A-B pattern (2 corrective moves) or just a triangle (which is wave B)
                    // If we have a triangle, that's the B wave - we need C wave
                    const hasTriangle = lowerCorrections.some(l => l.patternType === 'triangle');
                    const hasTwoCorrections = lowerCorrections.length >= 2;
                    
                    if (hasTriangle || hasTwoCorrections) {
                      console.log('✅ Cross-degree chain: Found', higherDegree, 'impulse + ', 
                        lowerCorrections.length, 'lower corrections');
                      parentImpulse = higherImpulse;
                      isCrossDegreeCWave = true;
                    }
                  }
                }
              }
              
              if (!parentImpulse) {
                console.log('🚫 No parent impulse found for chain prediction');
                toast({
                  title: 'No Parent Impulse Found',
                  description: `Need a complete impulse of ${selectedDegreeRef.current} or higher degree with corrective structure.`,
                  variant: 'destructive',
                });
                return;
              }
              
              console.log('✅ Found parent impulse:', parentImpulse.id, parentImpulse.degree);
              
              // VALIDATE parent points have all required indices before reading
              if (parentImpulse.points.length < 6) {
                console.log('🚫 Parent impulse missing required points, expected 6 got', parentImpulse.points.length);
                return;
              }
              
              // Store correction context for Wave A projections
              const w0 = parentImpulse.points[0];
              const w4 = parentImpulse.points[4];
              const w5 = parentImpulse.points[5];
              
              // Additional safety check for undefined points
              if (!w0 || !w4 || !w5) {
                console.log('🚫 Parent impulse has undefined points at required indices');
                return;
              }
              
              const isUptrend = w5.price > w0.price;
              
              // For cross-degree C wave, find the A wave to use for extension calculations
              let aWaveStart: number | undefined;
              let aWaveEnd: number | undefined;
              
              if (isCrossDegreeCWave) {
                const selectedDegree = selectedDegreeRef.current;
                const higherW5Time = parentImpulse.points[5]?.time || 0;
                
                // Find the first correction (A wave) after the higher impulse
                const aWavePattern = savedLabelsRef.current.find(label => {
                  if (label.degree !== selectedDegree) return false;
                  if (label.patternType !== 'correction' && label.patternType !== 'impulse') return false;
                  const labelStartTime = label.points[0]?.time || 0;
                  return labelStartTime >= higherW5Time;
                });
                
                if (aWavePattern && aWavePattern.points.length >= 2) {
                  aWaveStart = aWavePattern.points[0].price;
                  aWaveEnd = aWavePattern.points[aWavePattern.points.length - 1].price;
                  console.log('📊 Found A wave for C projection:', aWaveStart, '→', aWaveEnd);
                }
              }
              
              correctionContextRef.current = {
                parentLabelId: parentImpulse.id,
                parentDegree: parentImpulse.degree,
                parentPoints: parentImpulse.points,
                wave5Price: w5.price,
                wave4Price: w4.price,
                wave0Price: w0.price,
                isUptrend,
                isCrossDegreeCWave,
                aWaveStart,
                aWaveEnd,
              };
              
              // Start a new pattern from this predicted point
              setPatternType('correction');
              setIsDrawing(true);
              isDrawingRef.current = true;
              
              // For cross-degree C wave, we're starting C wave (not ABC)
              // The label should be 'B' since C comes after B in ABC pattern
              const startLabel = isCrossDegreeCWave ? 'B' : '0';
              
              // Use the predicted point's time and price as the starting point
              const newPoint: WavePoint = {
                index: predictedPoint.index,
                time: predictedPoint.time,
                price: predictedPoint.price,
                label: startLabel,
                isCorrection: isCrossDegreeCWave, // C wave is corrective
                snappedToHigh: predictedPoint.snappedToHigh,
                isFutureProjection: true,
              };
              
              setCurrentPoints([newPoint]);
              currentPointsRef.current = [newPoint];
              
              // Switch to projected mode to show targets
              setFibonacciMode('projected');
              fibonacciModeRef.current = 'projected';
              
              if (isCrossDegreeCWave) {
                toast({
                  title: 'C Wave Started',
                  description: `Drawing C wave from ${selectedDegreeRef.current} B triangle. C targets shown.`,
                });
              } else {
                toast({
                  title: 'Correction Started',
                  description: `Started ABC from ${parentImpulse.degree} W5. Wave A targets shown.`,
                });
              }
              
              return;
            }
          }
        }
        
        // Only allow future clicks if in drawing mode
        if (!isDrawingRef.current) {
          return;
        }
        
        // If no Fib lines available, just ignore future clicks
        if (fibonacciModeRef.current !== 'projected' || fibProjectionPricesRef.current.length === 0) {
          console.log('🎯 Future click ignored - no Fib projection lines');
          return;
        }
        
        // This section handles future clicks that weren't caught by price-based snapping above
        // Find nearest Fib projection line by price (with looser tolerance for area clicks)
        const fibPrices = fibProjectionPricesRef.current;
        let nearestFib = fibPrices[0];
        let minDistance = Math.abs(clickedPrice - nearestFib.price);
        
        for (const fib of fibPrices) {
          const dist = Math.abs(clickedPrice - fib.price);
          if (dist < minDistance) {
            minDistance = dist;
            nearestFib = fib;
          }
        }
        
        // Use looser tolerance (5%) for general future area clicks
        const tolerance = nearestFib.price * 0.05;
        if (minDistance > tolerance) {
          console.log('🎯 Future click too far from Fib lines, ignoring');
          return;
        }
        
        // Calculate future time based on logical bar position
        const secondLastCandle = candlesRef.current[candlesRef.current.length - 2];
        const candleInterval = lastCandle.time - secondLastCandle.time;
        const lastCandleIndex = candlesRef.current.length - 1;
        
        // Use logical coordinates to get bar position - this works beyond the data range
        const clickLogical = timeScale.coordinateToLogical(param.point.x);
        const barsAhead = clickLogical !== null 
          ? Math.max(1, Math.ceil(clickLogical - lastCandleIndex))
          : 5; // fallback
        
        const futureTime = lastCandle.time + (candleInterval * barsAhead);
        console.log('📅 Logical time calc (future):', { 
          clickX: param.point.x, 
          clickLogical, 
          lastCandleIndex,
          barsAhead, 
          futureTime: new Date(futureTime * 1000).toISOString() 
        });
        
        console.log('🔮 Future area click - snapping to Fib:', nearestFib.label, 'at price', nearestFib.price, 'time', futureTime);
        
        // Detect if clicking on flat or zigzag target for corrections
        if (nearestFib.correctionType) {
          console.log('🎯 Detected correction type from Fib click:', nearestFib.correctionType);
          detectedCorrectionTypeRef.current = nearestFib.correctionType;
        }
        
        // Detect if clicking on contracting or expanding target for diagonals
        if (nearestFib.diagonalType) {
          console.log('🎯 Detected diagonal type from Fib click:', nearestFib.diagonalType);
          detectedDiagonalTypeRef.current = nearestFib.diagonalType;
        }
        
        // Get next label for the pattern
        const labels = patternTypeRef.current === 'impulse' ? ['0', '1', '2', '3', '4', '5'] :
                       patternTypeRef.current === 'correction' || patternTypeRef.current === 'zigzag' || patternTypeRef.current === 'flat' ? ['0', 'A', 'B', 'C'] :
                       patternTypeRef.current === 'triangle' ? ['0', 'A', 'B', 'C', 'D', 'E'] :
                       ['0', '1', '2', '3', '4', '5'];
        
        if (currentPointsRef.current.length >= labels.length) return;
        
        const nextLabel = labels[currentPointsRef.current.length];
        const isCorrection = ['2', '4', 'A', 'B', 'C', 'D', 'E'].includes(nextLabel);
        
        // For future points, we can't snap to wick since there's no candle
        // Use the Fib line's price directly and determine snappedToHigh based on trend AND wave label
        const isDowntrend = trendDirectionRef.current === 'down';
        
        // CORRECT marker positioning based on wave label and trend:
        // - Motive waves (1, 3, 5, A, C): In uptrend → top (high), In downtrend → bottom (low)
        // - Corrective waves (2, 4, B, D): In uptrend → bottom (low), In downtrend → top (high)
        let snappedToHigh: boolean;
        if (['A', 'B', 'C', 'D', 'E'].includes(nextLabel)) {
          // Correction pattern labels
          if (isDowntrend) {
            // Downtrend: A/C/E go to lows (bottom), B/D go to highs (top)
            snappedToHigh = ['B', 'D'].includes(nextLabel);
          } else {
            // Uptrend: A/C/E go to highs (top), B/D go to lows (bottom)
            snappedToHigh = ['A', 'C', 'E'].includes(nextLabel);
          }
        } else {
          // Impulse pattern labels (1, 2, 3, 4, 5)
          const isOddWave = ['1', '3', '5'].includes(nextLabel);
          snappedToHigh = isDowntrend ? !isOddWave : isOddWave;
        }
        console.log('📍 Future point snappedToHigh:', { nextLabel, isDowntrend, snappedToHigh });
        
        // Extract just the percentage from the label (e.g., "C zig 127%" -> "127%")
        const percentMatch = nearestFib.label.match(/(\d+(?:\.\d+)?%)/);
        const fibPercent = percentMatch ? percentMatch[1] : '';
        
        const newPoint: WavePoint = {
          index: candlesRef.current.length + Math.floor((futureTime - lastCandle.time) / candleInterval),
          label: nextLabel,
          price: nearestFib.price,
          time: futureTime,
          isCorrection: isCorrection,
          snappedToHigh: snappedToHigh,
          isFutureProjection: true, // Mark this as a projected future point
          fibLabel: fibPercent // Store Fib label like "zig 127%" or "flat 161%"
        };
        
        const updatedPoints = [...currentPointsRef.current, newPoint];
        setCurrentPoints(updatedPoints);
        setPreviewPoint(null);
        return;
      }
      
      // Use dynamic tolerances that scale with zoom level
      const { barTolerance: clickThreshold, priceTolerance } = dynamicTolerancesRef.current;

      // DEBUG: Check if we're reaching the selection mode check
      console.log('📍 Checking selection mode:', {
        selectionMode: selectionModeRef.current,
        isClickingFuture,
        willEnterSelectionBlock: selectionModeRef.current
      });

      // SELECTION MODE: Select/deselect patterns OR drag-and-drop points
      // Handle this BEFORE accessing candle to support future point selection
      if (selectionModeRef.current) {
        const timeScale = chart.timeScale();
        const clickX = param.point?.x ?? 0;
        const selectClickPrice = candleSeries.coordinateToPrice(param.point?.y ?? 0);
        const selectedId = selectedLabelIdRef.current;
        const patternsCount = savedLabelsRef.current.length;
        console.log('🔧 Selection mode click:', { 
          selectedId, 
          isDragging: isDraggingRef.current, 
          draggedPointIndex: draggedPointIndexRef.current,
          candleIndex,
          patternsCount,
          clickX,
          clickPrice: selectClickPrice
        });
        
        // DEBUG: Show that click was detected in selection mode
        if (patternsCount === 0) {
          toast({
            title: 'No patterns to select',
            description: 'Draw a pattern first, then use selection mode to edit it.',
            variant: 'destructive',
          });
          return;
        }
        
        // If currently dragging a point, this click is the DROP
        if (isDraggingRef.current && selectedId !== null && draggedPointIndexRef.current !== null) {
          // Check cooldown - prevent placement within 1 second of pickup
          const timeSincePickup = Date.now() - wavePointPickupTimeRef.current;
          if (timeSincePickup < WAVE_EDIT_PLACEMENT_COOLDOWN_MS) {
            console.log('📍 Wave point placement blocked - cooldown active:', { timeSincePickup, required: WAVE_EDIT_PLACEMENT_COOLDOWN_MS });
            return;
          }
          
          console.log('📍 DROPPING point at candle:', candleIndex);
          const selectedLabel = savedLabelsRef.current.find(l => l.id === selectedId);
          if (selectedLabel) {
            const pointIndex = draggedPointIndexRef.current;
            const originalPoint = selectedLabel.points[pointIndex];
            
            // Infer snappedToHigh for legacy patterns that don't have this field
            // If undefined, infer from whether original price was closer to high or low
            let shouldSnapToHigh = originalPoint.snappedToHigh;
            if (shouldSnapToHigh === undefined) {
              // Find the original candle to infer wick direction
              const origCandle = candlesRef.current.find(c => c.time === originalPoint.time);
              if (origCandle) {
                // If original price was closer to high, it was snapped to high
                const distToHigh = Math.abs(originalPoint.price - origCandle.high);
                const distToLow = Math.abs(originalPoint.price - origCandle.low);
                shouldSnapToHigh = distToHigh < distToLow;
              } else {
                // Fallback: use point 0 to infer trend direction
                const firstPoint = selectedLabel.points[0];
                if (firstPoint) {
                  const firstCandle = candlesRef.current.find(c => c.time === firstPoint.time);
                  if (firstCandle) {
                    const isDowntrend = Math.abs(firstPoint.price - firstCandle.high) < Math.abs(firstPoint.price - firstCandle.low);
                    const isOddWave = ['1', '3', '5'].includes(originalPoint.label);
                    shouldSnapToHigh = isDowntrend ? !isOddWave : isOddWave;
                  }
                }
              }
            }
            
            // HANDLE FUTURE DROPS: If candleIndex is -1, we're dropping in the future area
            let updatedPoints: typeof selectedLabel.points;
            
            if (candleIndex < 0 || !candlesRef.current[candleIndex]) {
              // FUTURE DROP: Calculate future time and use click price directly
              console.log('🔮 FUTURE DROP detected - calculating future position');
              
              const lastCandle = candlesRef.current[candlesRef.current.length - 1];
              const secondLastCandle = candlesRef.current[candlesRef.current.length - 2];
              const candleInterval = lastCandle.time - secondLastCandle.time;
              const lastCandleIndex = candlesRef.current.length - 1;
              
              // Get logical position from click X coordinate
              const clickLogical = timeScale.coordinateToLogical(clickX);
              const barsAhead = clickLogical !== null 
                ? Math.max(1, Math.ceil(clickLogical - lastCandleIndex))
                : 5;
              
              const futureTime = lastCandle.time + (candleInterval * barsAhead);
              const futureIndex = candlesRef.current.length + barsAhead;
              const dropPrice = selectClickPrice ?? originalPoint.price;
              
              console.log('📅 Future drop calculated:', { 
                clickLogical, barsAhead, futureIndex,
                futureTime: new Date(futureTime * 1000).toISOString(),
                dropPrice
              });
              
              // Helper to recalculate fibLabel percentage based on wave position
              const recalculateFibLabel = (label: string, newPrice: number, points: typeof selectedLabel.points): string => {
                // For ABC corrections: B = retracement of A, C = extension from B
                // For impulse: 2 = retracement of 1, 3 = extension, 4 = retracement of 3, 5 = extension
                const point0 = points.find(p => p.label === '0');
                const pointA = points.find(p => p.label === 'A' || p.label === '1');
                const pointB = points.find(p => p.label === 'B' || p.label === '2');
                const point3 = points.find(p => p.label === '3');
                const point4 = points.find(p => p.label === '4');
                
                let percentage = 0;
                
                if (label === 'B' || label === '2') {
                  // Retracement from A (or 1) back toward 0
                  if (point0 && pointA) {
                    const wave1Range = Math.abs(pointA.price - point0.price);
                    if (wave1Range > 0) {
                      const retracement = Math.abs(newPrice - pointA.price);
                      percentage = (retracement / wave1Range) * 100;
                    }
                  }
                } else if (label === 'C' || label === '3') {
                  // Extension from B (or 2) relative to wave 1 range
                  if (point0 && pointA && pointB) {
                    const wave1Range = Math.abs(pointA.price - point0.price);
                    if (wave1Range > 0) {
                      const extension = Math.abs(newPrice - pointB.price);
                      percentage = (extension / wave1Range) * 100;
                    }
                  }
                } else if (label === '4') {
                  // Retracement of wave 3
                  if (pointB && point3) {
                    const wave3Range = Math.abs(point3.price - pointB.price);
                    if (wave3Range > 0) {
                      const retracement = Math.abs(newPrice - point3.price);
                      percentage = (retracement / wave3Range) * 100;
                    }
                  }
                } else if (label === '5') {
                  // Extension relative to W0→W3 distance, projected from W4
                  if (point0 && point3 && point4) {
                    const w0ToW3Distance = Math.abs(point3.price - point0.price);
                    if (w0ToW3Distance > 0) {
                      const extension = Math.abs(newPrice - point4.price);
                      percentage = (extension / w0ToW3Distance) * 100;
                    }
                  }
                }
                
                return percentage > 0 ? `${Math.round(percentage)}%` : '';
              };
              
              // Create updated points with future position
              updatedPoints = selectedLabel.points.map((p, i) => {
                if (i === pointIndex) {
                  // Recalculate the fibLabel based on new price position
                  const newFibLabel = recalculateFibLabel(p.label, dropPrice, selectedLabel.points);
                  console.log('📊 Recalculated fibLabel for', p.label, ':', newFibLabel);
                  
                  return {
                    ...p,
                    index: futureIndex,
                    time: futureTime as number,
                    price: dropPrice,
                    snappedToHigh: shouldSnapToHigh ?? false,
                    isFutureProjection: true,
                    fibLabel: newFibLabel || p.fibLabel, // Use new or keep old if calc failed
                  };
                }
                // Also backfill snappedToHigh for other points if missing
                if (p.snappedToHigh === undefined) {
                  const pCandle = candlesRef.current.find(c => c.time === p.time);
                  if (pCandle) {
                    const distH = Math.abs(p.price - pCandle.high);
                    const distL = Math.abs(p.price - pCandle.low);
                    return { ...p, snappedToHigh: distH < distL };
                  }
                }
                return p;
              });
            } else {
              // EXISTING CANDLE DROP: Dynamic window size based on visible candles
              const visibleCandles = visibleCandleCountRef.current || 100;
              let windowSize: number;
              if (visibleCandles <= 50) {
                windowSize = 1;
              } else if (visibleCandles <= 150) {
                windowSize = 3;
              } else if (visibleCandles <= 300) {
                windowSize = 5;
              } else if (visibleCandles <= 500) {
                windowSize = 7;
              } else {
                windowSize = 9;
              }
              const dropCandle = candlesRef.current[candleIndex];
              const startIdx = Math.max(0, candleIndex - windowSize);
              const endIdx = Math.min(candlesRef.current.length - 1, candleIndex + windowSize);
              
              let bestIdx = candleIndex;
              let bestPrice = shouldSnapToHigh ? dropCandle.high : dropCandle.low;
              
              for (let i = startIdx; i <= endIdx; i++) {
                const c = candlesRef.current[i];
                if (shouldSnapToHigh && c.high > bestPrice) {
                  bestPrice = c.high;
                  bestIdx = i;
                } else if (!shouldSnapToHigh && c.low < bestPrice) {
                  bestPrice = c.low;
                  bestIdx = i;
                }
              }
              
              const finalCandle = candlesRef.current[bestIdx];
              const snappedPrice = bestPrice;
              
              // Helper to recalculate fibLabel percentage based on wave position
              const recalculateFibLabel = (label: string, newPrice: number, points: typeof selectedLabel.points): string => {
                const point0 = points.find(p => p.label === '0');
                const pointA = points.find(p => p.label === 'A' || p.label === '1');
                const pointB = points.find(p => p.label === 'B' || p.label === '2');
                const point3 = points.find(p => p.label === '3');
                const point4 = points.find(p => p.label === '4');
                
                let percentage = 0;
                
                if (label === 'B' || label === '2') {
                  if (point0 && pointA) {
                    const wave1Range = Math.abs(pointA.price - point0.price);
                    if (wave1Range > 0) {
                      percentage = (Math.abs(newPrice - pointA.price) / wave1Range) * 100;
                    }
                  }
                } else if (label === 'C' || label === '3') {
                  if (point0 && pointA && pointB) {
                    const wave1Range = Math.abs(pointA.price - point0.price);
                    if (wave1Range > 0) {
                      percentage = (Math.abs(newPrice - pointB.price) / wave1Range) * 100;
                    }
                  }
                } else if (label === '4') {
                  if (pointB && point3) {
                    const wave3Range = Math.abs(point3.price - pointB.price);
                    if (wave3Range > 0) {
                      percentage = (Math.abs(newPrice - point3.price) / wave3Range) * 100;
                    }
                  }
                } else if (label === '5') {
                  // Extension relative to W0→W3 distance, projected from W4
                  if (point0 && point3 && point4) {
                    const w0ToW3Distance = Math.abs(point3.price - point0.price);
                    if (w0ToW3Distance > 0) {
                      percentage = (Math.abs(newPrice - point4.price) / w0ToW3Distance) * 100;
                    }
                  }
                }
                
                return percentage > 0 ? `${Math.round(percentage)}%` : '';
              };
              
              // Create updated points array with new position and ensure snappedToHigh is set
              updatedPoints = selectedLabel.points.map((p, i) => {
                if (i === pointIndex) {
                  // Recalculate the fibLabel based on new price position
                  const newFibLabel = recalculateFibLabel(p.label, snappedPrice, selectedLabel.points);
                  console.log('📊 Recalculated fibLabel for', p.label, ':', newFibLabel);
                  
                  return {
                    ...p,
                    index: bestIdx,
                    time: finalCandle.time as number,
                    price: snappedPrice,
                    snappedToHigh: shouldSnapToHigh ?? false,
                    isFutureProjection: false,
                    fibLabel: newFibLabel || p.fibLabel,
                  };
                }
                // Also backfill snappedToHigh for other points if missing
                if (p.snappedToHigh === undefined) {
                  const pCandle = candlesRef.current.find(c => c.time === p.time);
                  if (pCandle) {
                    const distH = Math.abs(p.price - pCandle.high);
                    const distL = Math.abs(p.price - pCandle.low);
                    return { ...p, snappedToHigh: distH < distL };
                  }
                }
                return p;
              });
            }
            
            // Update the label with new point position
            updateLabelRef.current.mutate({ id: selectedId, points: updatedPoints });
            
            // Also update local state immediately for smooth UI
            const updatedLabels = savedLabelsRef.current.map(l => {
              if (l.id === selectedId) {
                return { ...l, points: updatedPoints };
              }
              return l;
            });
            setSavedLabels(updatedLabels);
            savedLabelsRef.current = updatedLabels;
            
            // HAPTIC FEEDBACK: Vibrate on drop (if supported)
            if (navigator.vibrate) {
              navigator.vibrate([30, 30, 30]); // Double-pulse pattern for drop
            }
            
            // CRITICAL: Clear drag state, DESELECT pattern, and force marker refresh
            // Deselecting prevents accidental consecutive drags after a drop
            console.log('✅ Point dropped - clearing all state and re-validating');
            setIsDragging(false);
            setDraggedPointIndex(null);
            setSelectedLabelId(null); // DESELECT after drop to prevent accidental consecutive drags
            isDraggingRef.current = false;
            draggedPointIndexRef.current = null;
            selectedLabelIdRef.current = null;
            
            // CRITICAL: Detach the old markers primitive FIRST to prevent duplicates
            // Then use setTimeout to ensure state updates propagate before creating new markers
            if (markersRef.current) {
              markersRef.current.detach();
              markersRef.current = null;
            }
            setTimeout(() => {
              setMarkersVersion(v => v + 1);
            }, 50);
          }
          return;
        }
        
        // If a pattern is already selected, check if clicking EXACTLY on one of its points to drag
        // Must match BOTH X (candle) AND Y (price) to start a drag
        if (selectedId !== null) {
          const selectedLabel = savedLabelsRef.current.find(l => l.id === selectedId);
          if (selectedLabel) {
            // Use dynamic tolerance (slightly smaller for drag to prevent accidental drags)
            const dragThreshold = Math.max(2, Math.floor(clickThreshold * 0.7));
            // Get click price from chart coordinates
            const clickPrice = candleSeries.coordinateToPrice(param.point?.y ?? 0);
            const timeScale = chart.timeScale();
            const clickX = param.point?.x ?? 0;
            
            const clickedPointIndex = selectedLabel.points.findIndex(p => {
              // For future points, use X coordinate comparison instead of index
              const isFuturePoint = (p as any).isFutureProjection === true;
              const pointIsBeyondLastCandle = p.index >= candlesRef.current.length;
              let xMatch = false;
              
              if (isFuturePoint || pointIsBeyondLastCandle) {
                // Future points: compare X coordinates directly
                const pointX = timeScale.timeToCoordinate(p.time as any);
                if (pointX !== null) {
                  xMatch = Math.abs(clickX - pointX) <= 40; // 40px tolerance for future points

                  console.log('🔍 Future point check:', { pointX, clickX, diff: Math.abs(clickX - pointX), xMatch });
                } else {
                  // timeToCoordinate returned null - try logical index comparison
                  const clickLogical = timeScale.coordinateToLogical(clickX);
                  if (clickLogical !== null) {
                    // Compare logical bar positions with tolerance
                    xMatch = Math.abs(p.index - clickLogical) <= 2;
                    console.log('🔍 Future point logical check:', { pointIndex: p.index, clickLogical, diff: Math.abs(p.index - clickLogical), xMatch });
                  }
                }
              } else {
                // Regular points: ALWAYS use coordinate/time-based comparison
                // This is more reliable than index comparison since indices can become stale
                const pointX = timeScale.timeToCoordinate(p.time as any);
                if (pointX !== null) {
                  // Calculate pixel tolerance based on bar tolerance and chart width
                  const chartWidth = chartContainerRef.current?.clientWidth || 800;
                  const visibleRange = chart.timeScale().getVisibleLogicalRange();
                  const visibleBars = visibleRange ? Math.abs(visibleRange.to - visibleRange.from) : 100;
                  const pixelsPerBar = chartWidth / visibleBars;
                  const pixelTolerance = Math.max(20, dragThreshold * pixelsPerBar);
                  xMatch = Math.abs(clickX - pointX) <= pixelTolerance;
                  console.log('🔍 Point check (coord):', { pointX, clickX, diff: Math.abs(clickX - pointX), pixelTolerance, xMatch });
                } else {
                  // Fallback to logical position comparison
                  const clickLogical = timeScale.coordinateToLogical(clickX);
                  if (clickLogical !== null) {
                    xMatch = Math.abs(p.index - clickLogical) <= dragThreshold;
                    console.log('🔍 Point check (logical fallback):', { pointIndex: p.index, clickLogical, xMatch });
                  }
                }
              }
              
              if (!xMatch || clickPrice === null) return false;
              
              // Check Y-axis - use LARGER tolerance for future points since labels appear below markers
              const isFuture = isFuturePoint || pointIsBeyondLastCandle;
              const priceThreshold = isFuture 
                ? p.price * 0.25  // 25% tolerance for future points (label offset)
                : p.price * priceTolerance;
              const yMatch = Math.abs(p.price - clickPrice) <= priceThreshold;
              
              console.log('🎯 Point match check:', { label: p.label, isFuture, xMatch, yMatch, priceThreshold, priceDiff: Math.abs(p.price - clickPrice) });
              return xMatch && yMatch;
            });
            
            if (clickedPointIndex !== -1) {
              // SIMPLIFIED: Click on point to pick it up (no long-press required)
              console.log('🎯 PICKING UP point index:', clickedPointIndex);
              
              // HAPTIC FEEDBACK: Vibrate on grab (if supported)
              if (navigator.vibrate) {
                navigator.vibrate(50); // Short vibration
              }
              
              toast({
                title: 'Point Picked Up',
                description: 'Tap new location to drop the point',
                duration: 2000,
              });
              
              // Record pickup time for cooldown (prevents immediate placement on release)
              wavePointPickupTimeRef.current = Date.now();
              
              setDraggedPointIndex(clickedPointIndex);
              setIsDragging(true);
              isDraggingRef.current = true;
              draggedPointIndexRef.current = clickedPointIndex;
              return;
            } else {
              // Clicked away from points in selected pattern - DESELECT
              console.log('🔓 Deselecting pattern - click not on any point');
              setSelectedLabelId(null);
              setIsDragging(false);
              setDraggedPointIndex(null);
              return;
            }
          }
        }
        
        // Check if clicking on any saved label's points to select pattern
        // Must match BOTH X (candle) AND Y (price) using dynamic tolerances
        // (reuse selectClickPrice, timeScale, clickX from above)
        for (const label of savedLabelsRef.current) {
          const matchingPoint = label.points.find(p => {
            // For future points, use X coordinate comparison instead of index
            const isFuturePoint = (p as any).isFutureProjection === true;
            const pointIsBeyondLastCandle = p.index >= candlesRef.current.length;
            let xMatch = false;
            
            if (isFuturePoint || pointIsBeyondLastCandle) {
              // Future points: compare X coordinates directly
              const pointX = timeScale.timeToCoordinate(p.time as any);
              if (pointX !== null) {
                xMatch = Math.abs(clickX - pointX) <= 40; // 40px tolerance for future points
              } else {
                // timeToCoordinate returned null - try logical index comparison
                const clickLogical = timeScale.coordinateToLogical(clickX);
                if (clickLogical !== null) {
                  xMatch = Math.abs(p.index - clickLogical) <= 2;
                }
              }
            } else {
              // Regular points: ALWAYS use coordinate/time-based comparison
              // This is more reliable than index comparison since indices can become stale
              const pointX = timeScale.timeToCoordinate(p.time as any);
              if (pointX !== null) {
                // Calculate pixel tolerance based on bar tolerance and chart width
                const chartWidth = chartContainerRef.current?.clientWidth || 800;
                const visibleRange = chart.timeScale().getVisibleLogicalRange();
                const visibleBars = visibleRange ? Math.abs(visibleRange.to - visibleRange.from) : 100;
                const pixelsPerBar = chartWidth / visibleBars;
                const pixelTolerance = Math.max(20, clickThreshold * pixelsPerBar);
                xMatch = Math.abs(clickX - pointX) <= pixelTolerance;
              } else {
                // Fallback to logical position comparison
                const clickLogical = timeScale.coordinateToLogical(clickX);
                if (clickLogical !== null) {
                  xMatch = Math.abs(p.index - clickLogical) <= clickThreshold;
                }
              }
            }
            
            if (!xMatch || selectClickPrice === null) return false;
            
            // Check Y-axis - use LARGER tolerance for future points since labels appear below markers
            // Future points need ~25% tolerance to account for label text position
            const isFuture = isFuturePoint || pointIsBeyondLastCandle;
            const priceThreshold = isFuture 
              ? p.price * 0.25  // 25% tolerance for future points (label offset)
              : p.price * priceTolerance;
            const yMatch = Math.abs(p.price - selectClickPrice) <= priceThreshold;
            
            console.log('🔍 Selection match check:', { label: p.label, isFuture, xMatch, yMatch, priceDiff: Math.abs(p.price - selectClickPrice), priceThreshold });
            return xMatch && yMatch;
          });
          if (matchingPoint) {
            // Toggle selection of this entire pattern
            const isCurrentlySelected = selectedLabelIdRef.current === label.id;
            setSelectedLabelId(isCurrentlySelected ? null : label.id);
            setIsDragging(false);
            setDraggedPointIndex(null);
            toast({
              title: isCurrentlySelected ? 'Pattern Deselected' : 'Pattern Selected',
              description: isCurrentlySelected 
                ? 'Selection cleared'
                : `${label.patternType} - ${label.degree} degree. Tap a point to move it.`,
            });
            return;
          }
        }
        // Clicked empty space - deselect and cancel any drag
        setSelectedLabelId(null);
        setIsDragging(false);
        setDraggedPointIndex(null);
        return;
      }

      // Only process clicks if in drawing mode
      if (!isDrawingRef.current) return;
      
      // Get the candle at click position for drawing mode
      const candle = candlesRef.current[candleIndex];
      if (!candle) {
        console.log('❌ Cannot draw - no candle at index', candleIndex);
        return;
      }
      
      // Determine pattern labels
      const labels = patternTypeRef.current === 'impulse' ? ['0', '1', '2', '3', '4', '5'] :
                     patternTypeRef.current === 'correction' || patternTypeRef.current === 'zigzag' || patternTypeRef.current === 'flat' ? ['0', 'A', 'B', 'C'] :
                     patternTypeRef.current === 'triangle' ? ['0', 'A', 'B', 'C', 'D', 'E'] :
                     ['0', '1', '2', '3', '4', '5'];
      
      // Check if pattern is already complete - don't allow more clicks
      if (currentPointsRef.current.length >= labels.length) {
        // Pattern already complete - ignore further clicks
        return;
      }

      const degree = waveDegreesRef.current.find(d => d.name === selectedDegreeRef.current);
      const nextLabelIndex = currentPointsRef.current.length;

      const nextLabel = labels[nextLabelIndex];
      const isCorrection = ['2', '4', 'A', 'B', 'C', 'D', 'E'].includes(nextLabel);
      
      // SNAP TO WICK: Direction is determined by point 0 click position and CACHED
      // - If point 0 clicked above candle mid → DOWNTREND (0=high, 1=low, 2=high, 3=low, 4=high, 5=low)
      // - If point 0 clicked below candle mid → UPTREND (0=low, 1=high, 2=low, 3=high, 4=low, 5=high)
      
      // MAGNETIC SNAP: Find best candle within range and snap to nearest wick
      // Dynamic window size based on visible candles (scales with zoom level):
      // - 50 candles or fewer: 1 candle window (precise)
      // - 51-150 candles: 3 candle window
      // - 151-300 candles: 5 candle window
      // - 301-500 candles: 7 candle window
      // - 500+ candles: 9 candle window
      const visibleCandles = visibleCandleCountRef.current || 100; // Default to medium zoom
      let windowSize: number;
      if (visibleCandles <= 50) {
        windowSize = 1;
      } else if (visibleCandles <= 150) {
        windowSize = 3;
      } else if (visibleCandles <= 300) {
        windowSize = 5;
      } else if (visibleCandles <= 500) {
        windowSize = 7;
      } else {
        windowSize = 9;
      }
      const startIdx = Math.max(0, candleIndex - windowSize);
      const endIdx = Math.min(candlesRef.current.length - 1, candleIndex + windowSize);
      
      // Find the candle with the most extreme price in the window
      const findBestCandle = (snapToHigh: boolean) => {
        let bestIdx = candleIndex;
        let bestPrice = snapToHigh ? candle.high : candle.low;
        
        for (let i = startIdx; i <= endIdx; i++) {
          const c = candlesRef.current[i];
          if (snapToHigh && c.high > bestPrice) {
            bestPrice = c.high;
            bestIdx = i;
          } else if (!snapToHigh && c.low < bestPrice) {
            bestPrice = c.low;
            bestIdx = i;
          }
        }
        return { index: bestIdx, price: bestPrice, candle: candlesRef.current[bestIdx] };
      };
      
      // SMART SNAP: Also check if click is closer to a specific candle's wick
      // Find candle whose high/low is closest to clicked price
      const findNearestWick = (snapToHigh: boolean) => {
        let bestIdx = candleIndex;
        let bestPrice = snapToHigh ? candle.high : candle.low;
        let minDistance = Math.abs(clickedPrice - bestPrice);
        
        for (let i = startIdx; i <= endIdx; i++) {
          const c = candlesRef.current[i];
          const wickPrice = snapToHigh ? c.high : c.low;
          const distance = Math.abs(clickedPrice - wickPrice);
          if (distance < minDistance) {
            minDistance = distance;
            bestPrice = wickPrice;
            bestIdx = i;
          }
        }
        return { index: bestIdx, price: bestPrice, candle: candlesRef.current[bestIdx] };
      };
      
      const candleMid = (candle.high + candle.low) / 2;
      let snappedPrice: number;
      let finalCandleIndex = candleIndex;
      let finalCandle = candle;
      
      let snappedToHigh = false; // Track whether we snapped to high or low for marker positioning
      
      // Check if wave auto-snap is enabled
      const useWaveAutoSnap = waveAutoSnapEnabledRef.current;
      
      if (nextLabel === '0') {
        // First point - user click determines direction
        const isDowntrend = clickedPrice > candleMid;
        trendDirectionRef.current = isDowntrend ? 'down' : 'up';
        snappedToHigh = isDowntrend; // Point 0 in downtrend = high, uptrend = low
        
        if (useWaveAutoSnap) {
          // Snap to nearest wick
          const best = findNearestWick(snappedToHigh);
          finalCandleIndex = best.index;
          finalCandle = best.candle;
          snappedPrice = best.price;
        } else {
          // No snap - use clicked price directly
          snappedPrice = clickedPrice;
        }
        console.log('🎯 Point 0: Trend set to', trendDirectionRef.current, 'snapped to', snappedPrice, 'at candle', finalCandleIndex, 'high?', snappedToHigh, 'snap?', useWaveAutoSnap);
      } else if (patternTypeRef.current === 'impulse' || patternTypeRef.current === 'diagonal') {
        // Use CACHED trend direction from point 0
        const isDowntrend = trendDirectionRef.current === 'down';
        
        // In uptrend: odd (1,3,5) = high, even (2,4) = low
        // In downtrend: odd (1,3,5) = low, even (2,4) = high
        const isOddWave = ['1', '3', '5'].includes(nextLabel);
        if (isDowntrend) {
          snappedToHigh = !isOddWave; // In downtrend: even waves (2,4) snap to high
        } else {
          snappedToHigh = isOddWave; // In uptrend: odd waves (1,3,5) snap to high
        }
        
        if (useWaveAutoSnap) {
          // Use 5-candle window to find best snap point
          const best = findBestCandle(snappedToHigh);
          finalCandleIndex = best.index;
          finalCandle = best.candle;
          snappedPrice = best.price;
        } else {
          // No snap - use clicked price directly
          snappedPrice = clickedPrice;
        }
        console.log('🎯 Wave', nextLabel, ': Trend=', trendDirectionRef.current, 'isOdd=', isOddWave, 'snapped to', snappedPrice, 'at candle', finalCandleIndex, 'high?', snappedToHigh, 'snap?', useWaveAutoSnap);
      } else {
        // For corrections/triangles: use click position to determine high/low snap
        snappedToHigh = clickedPrice > candleMid;

        if (useWaveAutoSnap) {
          // Use 5-candle window to find best snap point
          const best = findBestCandle(snappedToHigh);
          finalCandleIndex = best.index;
          finalCandle = best.candle;
          snappedPrice = best.price;
        } else {
          // No snap - use clicked price directly
          snappedPrice = clickedPrice;
        }
      }

      const newPoint: WavePoint = {
        index: finalCandleIndex,
        label: nextLabel,
        price: snappedPrice,
        time: finalCandle.time as number,
        isCorrection: isCorrection,
        snappedToHigh: snappedToHigh, // Store for marker positioning
      };

      const updatedPoints = [...currentPointsRef.current, newPoint];
      setCurrentPoints(updatedPoints);
      setPreviewPoint(null); // Clear preview after placing
      
      // Show visual snap feedback at the snap location (only if snapping was used)
      if (useWaveAutoSnap) {
        const snapX = timeScale.timeToCoordinate(finalCandle.time as any);
        const snapY = candleSeries.priceToCoordinate(snappedPrice);
        if (snapX !== null && snapY !== null && showWaveSnapCircleRef.current) {
          showWaveSnapCircleRef.current(snapX, snapY, true);
        }
      }
      
      // Deactivate crosshair mode after placement and clear frozen position
      if (crosshairModeActiveRef.current) {
        crosshairModeActiveRef.current = false;
        capturedCrosshairPositionRef.current = null;
        console.log('🎯 Crosshair mode DEACTIVATED after placement, frozen position cleared');
      }
    });

    // Handle crosshair move for preview (works on both desktop and mobile)
    // Also store crosshair position for crosshair-mode clicks (long press)
    // SIMPLIFIED to match Indicators page approach - no complex locking
    chart.subscribeCrosshairMove((param) => {
      // Guard against chart being unmounted during teardown
      if (!chartRef.current || !candleSeriesRef.current) {
        return;
      }
      if (!param.point || !param.time) {
        // Don't clear stored crosshair position if in crosshair mode - we need it for the next tap!
        // This is the key to preserving position: when user lifts finger, position is kept
        if (!crosshairModeActiveRef.current) {
          lastCrosshairParamRef.current = null;
        }
        if (isDrawingRef.current) {
          setPreviewPoint(null);
        }
        return;
      }
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price !== null) {
        // Store crosshair position for crosshair mode (matches Indicators page exactly)
        const logicalX = chart.timeScale().coordinateToLogical(param.point.x);
        lastCrosshairParamRef.current = { 
          time: param.time as number, 
          price, 
          logicalX: logicalX ?? undefined,
          pointX: param.point.x 
        };
        
        if (isDrawingRef.current) {
          setPreviewPoint({ time: param.time as number, price });
        }
      }
    });

    // DYNAMIC CLICK TOLERANCE: Update tolerances based on zoom level
    // When zoomed out (more visible bars), increase tap area so points remain clickable
    // Uses debugSettings for adjustable parameters (admin debug mode)
    const updateTolerances = () => {
      if (!chartContainerRef.current || !chart) return;
      
      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      if (!visibleRange) return;
      
      const visibleBars = Math.abs(visibleRange.to - visibleRange.from);
      const chartWidth = chartContainerRef.current.clientWidth;
      
      // Calculate pixels per bar
      const pixelsPerBar = chartWidth / visibleBars;
      
      // Mobile touch target from debug settings (default ~44px)
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const targetPixelRadius = isMobile ? debugSettingsRef.current.targetPixelRadius : 24;
      
      // Bar tolerance: scales based on zoom level using debug thresholds
      // Zoomed in = precise (1 candle), zoomed out = wider snap area
      let barTolerance: number;
      const { zoomThreshold1, zoomThreshold3, zoomThreshold5, zoomThreshold7, baseBarTolerance, maxBarTolerance } = debugSettingsRef.current;
      
      if (visibleBars <= zoomThreshold1) {
        // Very zoomed in: precise 1-candle targeting
        barTolerance = 1;
      } else if (visibleBars <= zoomThreshold3) {
        // Moderately zoomed: 3-candle snap area
        barTolerance = 3;
      } else if (visibleBars <= zoomThreshold5) {
        // Zoomed out: 5-candle snap area
        barTolerance = 5;
      } else if (visibleBars <= zoomThreshold7) {
        // Very zoomed out: 7-candle snap area
        barTolerance = 7;
      } else {
        // Extremely zoomed out: use pixel-based calculation
        const calculatedBarTolerance = Math.ceil(targetPixelRadius / pixelsPerBar);
        barTolerance = Math.max(baseBarTolerance, Math.min(maxBarTolerance, calculatedBarTolerance));
      }
      
      // Price tolerance: scale based on visible price range
      const { basePriceTolerance, maxPriceTolerance } = debugSettingsRef.current;
      const zoomFactor = visibleBars / zoomThreshold1; // Normalize to first threshold
      const priceTolerance = Math.max(basePriceTolerance, Math.min(maxPriceTolerance, basePriceTolerance * Math.sqrt(zoomFactor)));
      
      dynamicTolerancesRef.current = { barTolerance, priceTolerance };
      
      // Log for debugging when panel is open
      if ((window as any).__debugTolerances) {
        console.log('📐 Tolerances updated:', { visibleBars, barTolerance, priceTolerance: (priceTolerance * 100).toFixed(1) + '%' });
      }
    };
    
    // Update tolerances on visible range change
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateTolerances);
    
    // Also update overlay positions and visible candle count when chart view changes (pan/zoom)
    // DEBOUNCED: Rapid zoom/pan was causing markers to disappear due to detach/recreate race condition
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      // Immediately update visible candle count (this doesn't cause issues)
      if (range) {
        const visibleCount = Math.round(Math.abs(range.to - range.from));
        setVisibleCandleCount(visibleCount);
      }
      
      // DEBOUNCE marker refresh to prevent rapid detach/create cycles during zoom
      // This fixes the issue where patterns disappear during zooming
      if (markersDebounceRef.current) {
        clearTimeout(markersDebounceRef.current);
      }
      markersDebounceRef.current = setTimeout(() => {
        setMarkersVersion(v => v + 1);
      }, 150); // 150ms debounce - enough to batch rapid zoom events
    });
    
    // Initial tolerance calculation and visible candle count
    setTimeout(() => {
      updateTolerances();
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) {
        setVisibleCandleCount(Math.round(Math.abs(range.to - range.from)));
      }
    }, 100);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        try {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        } catch (e) {
          // Chart may be disposed
        }
      }
    });

    resizeObserver.observe(chartContainerRef.current);
    
    // CROSSHAIR MODE: Long-press activates persistent crosshair mode
    // While active, user can pan/swipe freely, then TAP to place at crosshair position
    // After placement, mode deactivates and returns to normal drawing
    const container = chartContainerRef.current;
    const LONG_PRESS_THRESHOLD = 500; // ms to activate crosshair mode
    const MOVE_THRESHOLD = 15; // px movement tolerance
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartTimeRef.current = Date.now();
      
      if (e.touches.length === 1) {
        (window as any).__touchStartX = e.touches[0].clientX;
        (window as any).__touchStartY = e.touches[0].clientY;
        (window as any).__touchMoved = false;
        
        // Start long-press timer to activate crosshair mode (in Elliott wave drawing OR drawing tools mode)
        const inDrawingMode = isDrawingRef.current || drawingModeRef.current === 'draw';
        if (inDrawingMode && !crosshairModeActiveRef.current) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
          }
          longPressTimerRef.current = setTimeout(() => {
            // Activate crosshair mode
            crosshairModeActiveRef.current = true;
            ignoreNextClickRef.current = true; // Ignore the click from lifting this activation touch
            
            // CRITICAL FIX: Capture current crosshair position at activation time
            // This ensures lastCrosshairParamRef has a valid position for the first attempt
            // Convert touch coordinates to chart time/price
            const touchX = (window as any).__touchStartX;
            const touchY = (window as any).__touchStartY;
            if (touchX !== undefined && touchY !== undefined && chartContainerRef.current) {
              const containerRect = chartContainerRef.current.getBoundingClientRect();
              const chartX = touchX - containerRect.left;
              const chartY = touchY - containerRect.top;
              
              // Convert to time/price using chart APIs
              const timeCoord = chart.timeScale().coordinateToTime(chartX);
              const priceCoord = candleSeries.coordinateToPrice(chartY);
              const logicalX = chart.timeScale().coordinateToLogical(chartX);
              
              if (timeCoord !== null && priceCoord !== null) {
                lastCrosshairParamRef.current = {
                  time: timeCoord as number,
                  price: priceCoord,
                  logicalX: logicalX ?? undefined,
                  pointX: chartX
                };
                console.log('🎯 Crosshair mode ACTIVATED with position:', lastCrosshairParamRef.current);
              } else {
                console.log('🎯 Crosshair mode ACTIVATED - swipe to position, tap to place');
              }
            } else {
              console.log('🎯 Crosshair mode ACTIVATED - swipe to position, tap to place');
            }
          }, LONG_PRESS_THRESHOLD);
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const startX = (window as any).__touchStartX ?? 0;
        const startY = (window as any).__touchStartY ?? 0;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > MOVE_THRESHOLD) {
          (window as any).__touchMoved = true;
          // Cancel long-press timer if user is panning before activation
          if (longPressTimerRef.current && !crosshairModeActiveRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }
    };
    
    const handleTouchEnd = (_e: TouchEvent) => {
      // Cancel any pending long-press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      
      // CRITICAL FIX: When crosshair mode is active and user lifts finger,
      // FREEZE the current crosshair position so the subsequent tap can't overwrite it
      // (subscribeCrosshairMove fires BEFORE subscribeClick, so we must freeze here)
      if (crosshairModeActiveRef.current && lastCrosshairParamRef.current) {
        capturedCrosshairPositionRef.current = { ...lastCrosshairParamRef.current };
        console.log('🎯 Crosshair position FROZEN:', capturedCrosshairPositionRef.current);
      }
    };
    
    const handleMouseDown = () => {
      touchStartTimeRef.current = Date.now();
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('mousedown', handleMouseDown, { passive: true });
    
    console.log('📊 Chart created successfully');

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      // Clear any pending timers
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (markersDebounceRef.current) {
        clearTimeout(markersDebounceRef.current);
      }
    };
  }, [candles]); // Only recreate chart when candles data changes

  // Disable crosshair when a pattern is selected (prevents crosshair from interfering with point drag)
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (selectedLabelId !== null) {
      // Pattern selected - disable crosshair to allow point pickup
      chartRef.current.applyOptions({
        crosshair: {
          mode: CrosshairMode.Hidden,
        },
      });
      console.log('🎯 Crosshair disabled - pattern selected for editing');
    } else {
      // No pattern selected - restore normal crosshair
      chartRef.current.applyOptions({
        crosshair: {
          mode: CrosshairMode.Normal,
        },
      });
      console.log('🎯 Crosshair enabled - no pattern selected');
    }
  }, [selectedLabelId]);

  // Calculate Fibonacci ratios for wave points (used by markers for measured mode text)
  // Returns a Map keyed by point label (e.g., "2", "3", "A", "B") for lookup
  // For diagonals: Wave 5 is measured against Wave 3 only (not W1+W3)
  const calculateFibRatios = (points: WavePoint[], patternTypeForCalc?: string): Map<string, string> => {
    const ratios = new Map<string, string>();
    if (points.length < 3) return ratios;

    // Wave 2/B retracement of Wave 1/A
    const p0 = points[0], p1 = points[1], p2 = points[2];
    const wave1Range = Math.abs(p1.price - p0.price);
    if (wave1Range > 0) {
      const wave2Retrace = Math.abs(p2.price - p1.price);
      const ratio = (wave2Retrace / wave1Range) * 100;
      ratios.set(p2.label, `${ratio.toFixed(1)}%`);
    }

    // Wave 3/C extension of Wave 1/A
    if (points.length >= 4) {
      const p3 = points[3];
      const wave3Range = Math.abs(p3.price - p2.price);
      if (wave1Range > 0) {
        const extension = (wave3Range / wave1Range) * 100;
        ratios.set(p3.label, `${extension.toFixed(0)}%`);
      }
    }

    // Wave 4 retracement of Wave 3
    if (points.length >= 5) {
      const p3 = points[3], p4 = points[4];
      const wave3Range = Math.abs(p3.price - p2.price);
      if (wave3Range > 0) {
        const wave4Retrace = Math.abs(p4.price - p3.price);
        const ratio = (wave4Retrace / wave3Range) * 100;
        ratios.set(p4.label, `${ratio.toFixed(1)}%`);
      }
    }

    // Wave 5: % of W1 at every degree (impulse). Diagonals: % of W3.
    // Do NOT use W0→W3 net — a W5 that equals W1 would print ~50%.
    if (points.length >= 6) {
      const p3 = points[3], p4 = points[4], p5 = points[5];
      const wave5Range = Math.abs(p5.price - p4.price);
      const isDiag =
        patternTypeForCalc === 'diagonal' ||
        patternTypeForCalc === 'leading_diagonal' ||
        patternTypeForCalc === 'ending_diagonal';

      if (isDiag) {
        const wave3Range = Math.abs(p3.price - p2.price);
        if (wave3Range > 0) {
          const extension = (wave5Range / wave3Range) * 100;
          const text = `${extension.toFixed(0)}%`;
          ratios.set(p5.label, text);
          ratios.set('5', text);
          ratios.set('v', text);
          ratios.set('V', text);
        }
      } else if (wave1Range > 0) {
        const extension = (wave5Range / wave1Range) * 100;
        const text = `${extension.toFixed(0)}%`;
        ratios.set(p5.label, text);
        ratios.set('5', text);
        ratios.set('v', text);
        ratios.set('V', text);
      }
    }

    return ratios;
  };

  // Draw all wave markers (saved labels + current points + preview) - using v5 createSeriesMarkers API
  useEffect(() => {
    console.log('🌊 Markers effect running - savedLabels:', savedLabels.length, 'currentPoints:', currentPoints.length, 'candleSeries:', !!candleSeriesRef.current);
    
    if (!candleSeriesRef.current) {
      console.log('🌊 Skipping markers - series not ready');
      return;
    }

    // CRITICAL: If there are NO savedLabels and NO currentPoints, aggressively clear ALL markers
    if (savedLabels.length === 0 && currentPoints.length === 0 && !isDrawing && !previewPoint) {
      console.log('🧹 No labels or points - clearing all chart markers');
      // Clear main markers
      if (markersRef.current) {
        try {
          (markersRef.current as any).detach?.();
        } catch (e) { /* ignore */ }
        markersRef.current = null;
      }
      // Clear blue simulation candles
      if (blueCandelSeriesRef.current) {
        try {
          blueCandelSeriesRef.current.setData([]);
        } catch (e) { /* ignore */ }
      }
      // Clear blue simulation markers
      if (blueCandleMarkersRef.current) {
        try {
          (blueCandleMarkersRef.current as any).detach?.();
        } catch (e) { /* ignore */ }
        blueCandleMarkersRef.current = null;
      }
      // Clear future points data
      futurePointsDataRef.current = [];
      return; // Exit early - nothing to render
    }

    // Collect all future projection points - these need special rendering via the futurePointsSeries
    const allFuturePoints: { point: WavePoint; color: string; shape: 'circle' | 'square'; labelText: string }[] = [];
    
    // Helper to get last real candle time
    const lastRealCandleTime = candles.length > 0 ? candles[candles.length - 1].time : 0;
    
    // CRITICAL: Helper to snap a time to the nearest valid candle time
    // This prevents markers from disappearing during pan/zoom when their timestamps
    // don't exactly match candle times (lightweight-charts drops non-matching markers)
    const snapToNearestCandleTime = (time: number): number => {
      if (candles.length === 0) return time;
      
      // Binary search for the closest candle time
      let left = 0;
      let right = candles.length - 1;
      
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (candles[mid].time < time) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }
      
      // Check if left or left-1 is closer
      const candleTime = candles[left].time;
      if (left > 0) {
        const prevCandleTime = candles[left - 1].time;
        if (Math.abs(time - prevCandleTime) < Math.abs(time - candleTime)) {
          return prevCandleTime;
        }
      }
      return candleTime;
    };
    
    // DRILL-DOWN HELPER: When viewing at lower timeframe than label's original,
    // find the sub-candle with the highest high (or lowest low) within the original candle's range
    const snapToExtremeSubCandle = (
      originalTime: number,
      labelTimeframe: string,
      snappedToHigh: boolean
    ): number => {
      // Check if we're drilling down (current TF is lower than label's TF)
      const oneDown = TIMEFRAME_ONE_DOWN[labelTimeframe.toLowerCase()] || TIMEFRAME_ONE_DOWN[labelTimeframe];
      if (!oneDown || timeframe.toLowerCase() !== oneDown.tf.toLowerCase()) {
        // Not drilling down - use normal snap
        return snapToNearestCandleTime(originalTime);
      }
      
      // Find sub-candles within the original candle's time range
      const intervalMs = TIMEFRAME_INTERVAL_MS[labelTimeframe.toLowerCase()] || TIMEFRAME_INTERVAL_MS[labelTimeframe];
      if (!intervalMs || candles.length === 0) return snapToNearestCandleTime(originalTime);
      
      const startTime = originalTime;
      const endTime = originalTime + intervalMs / 1000; // Convert ms to seconds
      
      const subCandles = candles.filter(c => c.time >= startTime && c.time < endTime);
      if (subCandles.length === 0) return snapToNearestCandleTime(originalTime);
      
      // Find the candle with the extreme value
      if (snappedToHigh) {
        // Find candle with highest high
        const maxCandle = subCandles.reduce((max, c) => c.high > max.high ? c : max, subCandles[0]);
        return maxCandle.time;
      } else {
        // Find candle with lowest low
        const minCandle = subCandles.reduce((min, c) => c.low < min.low ? c : min, subCandles[0]);
        return minCandle.time;
      }
    };

    // Build markers from saved labels (highlight selected pattern, SKIP dragged point entirely)
    // Also collect future projection points separately for special rendering
    const savedMarkers = savedLabels.flatMap(label => {
      const degree = waveDegrees.find(d => d.name === label.degree);
      const baseColor = degree?.color || '#00c4b4';
      const isSelected = label.id === selectedLabelId;
      // Color distinction: Impulse uses degree color, Correction uses amber/orange tint
      const isCorrectivePattern = ['correction', 'abc', 'flat', 'zigzag', 'triangle'].includes(label.patternType);
      // For corrections, use warm amber (#FBBF24) instead of degree color for clear visual distinction
      const patternColor = isCorrectivePattern ? '#FBBF24' : baseColor;
      // Use bright cyan for selected pattern to stand out from both impulse and correction colors
      const color = isSelected ? '#22D3EE' : patternColor;
      
      // ALWAYS calculate Fib ratios for percentage display on ALL waves (not just measured mode)
      const fibRatios = calculateFibRatios(label.points, label.patternType);

      return label.points
        .map((point, pointIdx) => {
          // SKIP the dragged point entirely - don't render it at all while being moved
          const isBeingDragged = isSelected && isDragging && draggedPointIndex === pointIdx;
          if (isBeingDragged) {
            return null; // Remove from display
          }
          
          // Handle legacy patterns without snappedToHigh - infer from price vs candle
          let isHigh = point.snappedToHigh;
          if (isHigh === undefined) {
            const pointCandle = candles.find(c => c.time === point.time);
            if (pointCandle) {
              const distH = Math.abs(point.price - pointCandle.high);
              const distL = Math.abs(point.price - pointCandle.low);
              isHigh = distH < distL;
            } else {
              isHigh = false; // Default fallback
            }
          }
          
          // ALWAYS show Fib percentages on all waves (except point 0 and point 1)
          // Use stored fibLabel if available, otherwise calculate from actual wave positions
          let labelText = point.label;
          if (point.fibLabel) {
            // Show the Fib label that was stored when the point was placed on a projection line
            labelText = `${point.label} (${point.fibLabel})`;
          } else {
            // Calculate and show percentage for waves after wave 1 (B, C, 2, 3, 4, 5)
            const fibRatio =
              fibRatios.get(point.label) ||
              fibRatios.get(point.label.split('/')[0]) ||
              fibRatios.get(String(pointIdx));
            if (fibRatio) {
              labelText = `${point.label} (${fibRatio})`;
            }
          }
          
          // For future projection points, collect separately instead of making a marker
          if (point.isFutureProjection || point.time > lastRealCandleTime) {
            allFuturePoints.push({
              point,
              color,
              shape: isSelected ? 'square' : 'circle',
              labelText,
            });
            return null; // Don't create regular marker
          }
          
          // DRILL-DOWN SNAP: When viewing at lower timeframe, snap to the sub-candle
          // with the highest high (for highs) or lowest low (for lows)
          const snappedTime = snapToExtremeSubCandle(point.time, label.timeframe, isHigh);
          
          return {
            time: snappedTime as any,
            position: (isHigh ? 'aboveBar' : 'belowBar') as 'belowBar' | 'aboveBar',
            color: color,
            shape: (isSelected ? 'square' : 'circle') as 'square' | 'circle',
            text: labelText,
          };
        })
        .filter(Boolean); // Remove null entries (dragged points and future points)
    });

    // Build markers from current points being drawn (also collect future points separately)
    // ALWAYS calculate Fib ratios for percentage display
    const currentFibRatios = calculateFibRatios(currentPoints, patternType);
    const currentMarkers = currentPoints.map((point) => {
      const degree = waveDegrees.find(d => d.name === selectedDegree);
      const baseColor = degree?.color || '#00c4b4';
      // Color distinction: Impulse uses degree color, Correction uses amber for clear visual contrast
      const isCorrectivePatternType = ['correction', 'abc', 'flat', 'zigzag', 'triangle'].includes(patternType);
      const color = isCorrectivePatternType ? '#FBBF24' : baseColor;
      
      // ALWAYS show Fib percentages - use stored fibLabel or calculate from positions
      let labelText = point.label;
      if (point.fibLabel) {
        // Show the Fib label that was stored when the point was placed on a projection line
        labelText = `${point.label} (${point.fibLabel})`;
      } else {
        // Calculate and show percentage for waves after wave 1
        const fibRatio =
          currentFibRatios.get(point.label) ||
          currentFibRatios.get(point.label.split('/')[0]);
        if (fibRatio) {
          labelText = `${point.label} (${fibRatio})`;
        }
      }
      
      // For future projection points, collect separately instead of making a marker
      if (point.isFutureProjection || point.time > lastRealCandleTime) {
        allFuturePoints.push({
          point,
          color,
          shape: 'circle',
          labelText,
        });
        return null; // Don't create regular marker
      }
      
      // SNAP time to nearest candle to prevent markers disappearing on pan/zoom
      const snappedTime = snapToNearestCandleTime(point.time);
      
      return {
        time: snappedTime as any,
        // Use snappedToHigh for marker position - high = aboveBar, low = belowBar
        position: (point.snappedToHigh ? 'aboveBar' : 'belowBar') as 'belowBar' | 'aboveBar',
        color,
        shape: 'circle' as const,
        text: labelText,
      };
    }).filter(Boolean);

    // Build preview marker (ghost marker showing where next point will be placed)
    const previewMarkers: any[] = [];
    if (isDrawing && previewPoint) {
      const labels = patternType === 'impulse' ? ['0', '1', '2', '3', '4', '5'] :
                     patternType === 'correction' || patternType === 'zigzag' || patternType === 'flat' ? ['0', 'A', 'B', 'C'] :
                     patternType === 'triangle' ? ['0', 'A', 'B', 'C', 'D', 'E'] :
                     ['0', '1', '2', '3', '4', '5'];
      const nextLabel = labels[currentPoints.length] || '?';
      
      // SNAP time to nearest candle for preview marker too
      // For future times, snapToNearestCandleTime returns the last candle's time, which is valid
      const snappedPreviewTime = snapToNearestCandleTime(previewPoint.time);
      
      // Determine preview position based on cursor position relative to candle price
      // If cursor is ABOVE the candle midpoint, show label above; if below, show label below
      let previewSnappedToHigh = true; // Default above
      const previewCandle = candles.find(c => c.time === snappedPreviewTime);
      if (previewCandle) {
        const candleMid = (previewCandle.high + previewCandle.low) / 2;
        previewSnappedToHigh = previewPoint.price > candleMid;
      } else if (candles.length > 0) {
        // Fallback for future times: use last candle's midpoint
        const lastCandle = candles[candles.length - 1];
        const candleMid = (lastCandle.high + lastCandle.low) / 2;
        previewSnappedToHigh = previewPoint.price > candleMid;
      }
      
      previewMarkers.push({
        time: snappedPreviewTime as any,
        position: (previewSnappedToHigh ? 'aboveBar' : 'belowBar') as 'belowBar' | 'aboveBar',
        color: 'rgba(0, 196, 180, 0.5)', // Semi-transparent preview color
        shape: 'circle' as const,
        text: nextLabel,
      });
    }

    const rawMarkers = [...savedMarkers, ...currentMarkers, ...previewMarkers];

    // CRITICAL FIX: Don't merge markers by time+position as this causes markers to disappear
    // when multiple patterns overlap. Instead, keep ALL markers but offset overlapping ones slightly
    // by using a unique key that includes an index for each time+position combination.
    const positionCount = new Map<string, number>();
    const allMarkers = rawMarkers.map(marker => {
      const baseKey = `${marker.time}-${marker.position}`;
      const count = positionCount.get(baseKey) || 0;
      positionCount.set(baseKey, count + 1);
      
      // If this is the first marker at this position, return as-is
      // If there are overlapping markers, we still return all of them
      // lightweight-charts will handle stacking/overlapping visually
      return { ...marker };
    });
    
    // Debug: Log collision info
    const collisions = Array.from(positionCount.entries()).filter(([_, count]) => count > 1);
    if (collisions.length > 0) {
      console.log('📍 Marker collisions detected:', collisions.map(([key, count]) => `${key}: ${count} markers`));
    }
    
    // CRITICAL: Sort markers by time in ascending order - lightweight-charts REQUIRES this
    // Without sorting, some markers may not render correctly or disappear on zoom
    allMarkers.sort((a, b) => a.time - b.time);

    try {
      // ALWAYS detach old primitive first to prevent duplicates, then create new one
      if (markersRef.current) {
        try {
          // Detach removes the primitive from the series completely
          (markersRef.current as any).detach?.();
        } catch (e) {
          // May fail if already detached
        }
        markersRef.current = null;
      }
      
      // Debug: log all markers being rendered with their details
      console.log('🎨 Creating markers:', allMarkers.length, 'total (merged from', rawMarkers.length, ')');
      console.log('📍 Saved labels count:', savedLabels.length, 
        savedLabels.map(l => `${l.patternType}:${l.points?.length || 0}pts`));
      if (allMarkers.length > 0) {
        console.log('📍 First marker:', JSON.stringify(allMarkers[0]));
      }
      
      // Create fresh markers primitive each time
      if (allMarkers.length > 0) {
        markersRef.current = createSeriesMarkers(candleSeriesRef.current, allMarkers);
        console.log('✅ Markers primitive created successfully');
      } else {
        console.log('⚠️ No markers to create');
        markersRef.current = null;
      }
    } catch (e) {
      console.error('Failed to set wave markers:', e);
      markersRef.current = null;
    }
    
    // Generate blue simulation candles for future projection points
    // This creates a visible bridge from last real candle to each projection point
    if (blueCandelSeriesRef.current && allFuturePoints.length > 0 && candles.length > 1) {
      const lastRealCandle = candles[candles.length - 1];
      const secondLastCandle = candles[candles.length - 2];
      const candleInterval = lastRealCandle.time - secondLastCandle.time;
      
      // Collect all blue candles for all future points
      const allBlueCandles: { time: any; open: number; high: number; low: number; close: number }[] = [];
      const blueMarkers: any[] = [];
      
      // Sort future points by time so we can chain them properly
      const sortedFuturePoints = [...allFuturePoints].sort((a, b) => a.point.time - b.point.time);
      
      // Track where each segment should start
      // Start from the last real candle, but update if we find points on existing candles
      let prevTime = lastRealCandle.time;
      let prevPrice = lastRealCandle.close;
      
      // Check if there are points on existing candles that should be our starting point
      // (e.g., B placed on existing candle, C in future should start from B)
      const pointsOnExistingCandles = sortedFuturePoints.filter(fp => fp.point.time <= lastRealCandle.time);
      if (pointsOnExistingCandles.length > 0) {
        // Use the last point on existing candles as starting position
        const lastExistingPoint = pointsOnExistingCandles[pointsOnExistingCandles.length - 1];
        prevTime = lastExistingPoint.point.time;
        prevPrice = lastExistingPoint.point.price;
        console.log('📍 Starting blue candles from existing point', lastExistingPoint.labelText, 
          'at price', prevPrice.toFixed(0));
      }
      
      // Helper to generate wave-like candle pattern
      const generateWaveCandles = (
        startTime: number, 
        startPrice: number, 
        endTime: number, 
        endPrice: number, 
        waveCount: 3 | 5
      ) => {
        const totalBars = Math.round((endTime - startTime) / candleInterval);
        if (totalBars <= 0) return [];
        
        const totalMove = endPrice - startPrice;
        const isUptrend = totalMove > 0;
        const candles: typeof allBlueCandles = [];
        
        // Define wave proportions
        // 3-wave (abc): Wave a 40%, wave b retrace 50%, wave c 60%
        // 5-wave (12345): W1 20%, W2 retrace 50%, W3 40%, W4 retrace 38%, W5 remaining
        const waveTargets: number[] = [];
        
        if (waveCount === 3) {
          // 3-wave correction: a-b-c
          const waveA = totalMove * 0.5; // 50% of move
          const waveB = -waveA * 0.5;    // 50% retrace of wave A
          const waveC = totalMove - waveA - waveB; // Remaining
          waveTargets.push(waveA, waveB, waveC);
        } else {
          // 5-wave impulse: 1-2-3-4-5
          const wave1 = totalMove * 0.23;
          const wave2 = -wave1 * 0.618;  // 61.8% retrace
          const wave3 = totalMove * 0.45; // Longest wave
          const wave4 = -wave3 * 0.382;  // 38.2% retrace
          const wave5 = totalMove - wave1 - wave2 - wave3 - wave4; // Remaining
          waveTargets.push(wave1, wave2, wave3, wave4, wave5);
        }
        
        // Calculate bars per wave
        const barsPerWave = waveTargets.map((_, i) => {
          if (waveCount === 3) {
            // 3-wave: distribute as 35%, 20%, 45%
            return Math.max(1, Math.round(totalBars * [0.35, 0.20, 0.45][i]));
          } else {
            // 5-wave: distribute as 18%, 12%, 32%, 15%, 23%
            return Math.max(1, Math.round(totalBars * [0.18, 0.12, 0.32, 0.15, 0.23][i]));
          }
        });
        
        // Ensure total bars match
        const totalAssigned = barsPerWave.reduce((a, b) => a + b, 0);
        if (totalAssigned < totalBars) {
          barsPerWave[waveCount === 3 ? 2 : 2] += totalBars - totalAssigned; // Add extra to wave 3/c
        }
        
        let currentPrice = startPrice;
        let currentTime = startTime;
        
        waveTargets.forEach((waveDelta, waveIdx) => {
          const barsForWave = barsPerWave[waveIdx];
          const waveEndPrice = currentPrice + waveDelta;
          const pricePerBar = waveDelta / barsForWave;
          
          for (let i = 1; i <= barsForWave; i++) {
            const candleTime = currentTime + (candleInterval * i);
            // Add some randomness to candle sizes (±15%)
            const randomFactor = 0.85 + Math.random() * 0.3;
            const adjustedMove = pricePerBar * randomFactor;
            
            const candleOpen = currentPrice + pricePerBar * (i - 1);
            const candleClose = i === barsForWave ? waveEndPrice : candleOpen + adjustedMove;
            const isUp = candleClose >= candleOpen;
            
            // Add wicks for realism
            const wickSize = Math.abs(candleClose - candleOpen) * (0.2 + Math.random() * 0.3);
            
            candles.push({
              time: candleTime as any,
              open: candleOpen,
              close: candleClose,
              high: (isUp ? candleClose : candleOpen) + wickSize,
              low: (isUp ? candleOpen : candleClose) - wickSize,
            });
          }
          
          currentTime += candleInterval * barsForWave;
          currentPrice = waveEndPrice;
        });
        
        return candles;
      };
      
      sortedFuturePoints.forEach((fp, index) => {
        const targetTime = fp.point.time;
        const targetPrice = fp.point.price;
        
        // Check if point is actually in the future (beyond last real candle)
        const isActuallyInFuture = targetTime > lastRealCandle.time;
        
        // ALWAYS add a marker for points in allFuturePoints (they were filtered from regular markers)
        // This ensures points marked as isFutureProjection are ALWAYS rendered somewhere
        blueMarkers.push({
          time: targetTime as any,
          position: (fp.point.snappedToHigh ? 'aboveBar' : 'belowBar') as 'aboveBar' | 'belowBar',
          color: fp.color,
          shape: fp.shape as 'circle' | 'square',
          text: fp.labelText,
        });
        
        if (isActuallyInFuture) {
          // Determine wave count based on label and Elliott Wave structure
          // MOTIVE waves (1, 3, 5, A, C) = 5-wave sub-structure
          // CORRECTIVE waves (2, 4, B, D) = 3-wave sub-structure (a-b-c)
          const label = fp.point.label.toUpperCase();
          const isMotiveWave = ['1', '3', '5', 'A', 'C'].includes(label);
          const waveCount: 3 | 5 = isMotiveWave ? 5 : 3;
          
          // Generate wave-like candle pattern
          const waveCandles = generateWaveCandles(prevTime, prevPrice, targetTime, targetPrice, waveCount);
          allBlueCandles.push(...waveCandles);
          
          console.log('🔵 Generated', waveCount, '-wave pattern (', waveCandles.length, 'candles) for', fp.labelText, 
            'from', prevPrice.toFixed(0), 'to', targetPrice.toFixed(0));
        } else {
          // Point is on existing candle - no blue candles needed, but marker was already added above
          console.log('📍 Point', fp.labelText, 'is on existing candle, marker added without blue candles');
        }
        
        // Update previous point for next segment
        prevTime = targetTime;
        prevPrice = targetPrice;
      });
      
      // Remove duplicate candles at same time (keep the one closest to target for each time)
      const uniqueBlueCandles = allBlueCandles.reduce((acc, candle) => {
        const existing = acc.find(c => c.time === candle.time);
        if (!existing) {
          acc.push(candle);
        }
        return acc;
      }, [] as typeof allBlueCandles);
      
      // Sort by time
      uniqueBlueCandles.sort((a, b) => (a.time as number) - (b.time as number));
      
      // Set the blue candle data
      try {
        blueCandelSeriesRef.current.setData(uniqueBlueCandles);
        console.log('🔵 Set', uniqueBlueCandles.length, 'blue simulation candles');
        
        // Add markers to the blue candle series
        if (blueCandleMarkersRef.current) {
          (blueCandleMarkersRef.current as any).detach?.();
        }
        if (blueMarkers.length > 0) {
          blueCandleMarkersRef.current = createSeriesMarkers(blueCandelSeriesRef.current, blueMarkers);
          console.log('🔵 Added', blueMarkers.length, 'markers to blue candle series');
        }
      } catch (e: any) {
        console.error('Failed to set blue candles:', e?.message || e);
      }
    } else if (blueCandelSeriesRef.current) {
      // Clear blue candles if no future points
      try {
        blueCandelSeriesRef.current.setData([]);
        if (blueCandleMarkersRef.current) {
          (blueCandleMarkersRef.current as any).detach?.();
          blueCandleMarkersRef.current = null;
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Store future points in ref for potential re-use
    futurePointsDataRef.current = allFuturePoints.map(fp => fp.point);
  }, [savedLabels, currentPoints, selectedDegree, waveDegrees, isDrawing, previewPoint, patternType, selectedLabelId, isDragging, draggedPointIndex, markersVersion, candles, fibonacciMode]);

  // Draw Fibonacci projection lines on the chart (projected mode only)
  useEffect(() => {
    // Helper to clean up all existing Fib lines - uses ref to get current series
    const clearFibLines = () => {
      const series = candleSeriesRef.current;
      fibLinesRef.current.forEach(line => {
        try {
          series?.removePriceLine(line);
        } catch (e) { /* ignore - line may already be removed */ }
      });
      fibLinesRef.current = [];
    };

    // ALWAYS clear existing lines first to prevent stacking/duplicates
    clearFibLines();
    fibProjectionPricesRef.current = []; // Clear projection prices too

    // Cancel any pending debounced update
    if (fibLinesDebounceRef.current) {
      clearTimeout(fibLinesDebounceRef.current);
      fibLinesDebounceRef.current = null;
    }

    const candleSeries = candleSeriesRef.current;
    
    // Only draw lines in PROJECTED mode AND when actively drawing (not viewing completed patterns)
    // Exception: Also draw when dragging a point of a selected pattern (for repositioning)
    const hasActiveDrawing = currentPoints.length > 0;
    const isDraggingSelectedPattern = isDragging && draggedPointIndex !== null && selectedLabelId;
    
    if (!candleSeries || fibonacciMode !== 'projected') {
      return;
    }
    
    // CRITICAL: Only show projections when actively drawing OR dragging a point
    // Don't show projections just because a saved pattern is selected for viewing
    if (!hasActiveDrawing && !isDraggingSelectedPattern) {
      console.log('📊 Fib projections skipped - no active drawing and not dragging');
      return;
    }

    // Get the points to calculate Fib from
    // When dragging, use the selected pattern's points; otherwise use current drawing points
    let pointsToUse = isDraggingSelectedPattern
      ? savedLabels.find(l => l.id === selectedLabelId)?.points || []
      : currentPoints;
    
    // CRITICAL: When dragging a point, adjust pointsToUse to show correct targets
    // e.g., when dragging B (index 2), show B targets by using only points up to A
    if (isDragging && draggedPointIndex !== null && selectedLabelId) {
      // Show targets for the dragged point by excluding it and subsequent points
      pointsToUse = pointsToUse.slice(0, draggedPointIndex);
      console.log('📊 Fib targets adjusted for drag - showing targets for point', draggedPointIndex, 'using', pointsToUse.length, 'points');
    }
    
    // Get current pattern type:
    // - If actively drawing new points (hasActiveDrawing), use the patternType from the dropdown
    // - If dragging a saved pattern, use the saved pattern's type
    // - Otherwise fall back to patternType
    const currentPattern = isDraggingSelectedPattern
      ? savedLabels.find(l => l.id === selectedLabelId)?.patternType 
      : patternType; // Always use current patternType when drawing new points
    const isCorrection = currentPattern === 'correction' || currentPattern === 'abc' || currentPattern === 'zigzag' || currentPattern === 'flat';
    const isDiagonal = currentPattern === 'diagonal';
    
    const newLines: any[] = [];
    const newPrices: { price: number; label: string; color: string; correctionType?: 'flat' | 'zigzag'; diagonalType?: 'contracting' | 'expanding' }[] = [];
    
    // WAVE A or C PROJECTIONS: Show when we have 1 point and correction context from parent impulse
    if (isCorrection && pointsToUse.length === 1 && correctionContextRef.current) {
      const ctx = correctionContextRef.current;
      const p0 = pointsToUse[0];
      
      // CHECK: Is this a cross-degree C wave scenario?
      if (ctx.isCrossDegreeCWave && ctx.aWaveStart !== undefined && ctx.aWaveEnd !== undefined) {
        // C WAVE PROJECTIONS: Extensions of Wave A
        const aWaveRange = Math.abs(ctx.aWaveEnd - ctx.aWaveStart);
        const aWaveDirection = ctx.aWaveEnd < ctx.aWaveStart ? 'down' : 'up';
        
        console.log('📊 C Wave projections: A range', aWaveRange.toFixed(4), 'A direction:', aWaveDirection, 'from B at', p0.price);
        
        // C wave equals or extends A wave (61.8%, 100%, 127.2%, 161.8%)
        const cExtensionLevels = [0.618, 1.0, 1.272, 1.618];
        cExtensionLevels.forEach(level => {
          // C continues same direction as A (opposite to B)
          const fibPrice = aWaveDirection === 'down'
            ? p0.price - (aWaveRange * level)
            : p0.price + (aWaveRange * level);
          
          const label = `C ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#00CED1', // Cyan for C wave extensions
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#00CED1' });
          }
        });
        
        // Also show retracement of higher impulse (38.2%, 50%, 61.8%)
        const impulseRange = Math.abs(ctx.wave5Price - ctx.wave0Price);
        const impulseRetraceLevels = [0.382, 0.5, 0.618];
        impulseRetraceLevels.forEach(level => {
          const fibPrice = ctx.isUptrend 
            ? ctx.wave5Price - (impulseRange * level)
            : ctx.wave5Price + (impulseRange * level);
          
          const label = `${(level * 100).toFixed(0)}% imp`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#FF6B6B', // Red/coral for impulse retracements
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#FF6B6B' });
          }
        });
        
        // Store and return
        fibProjectionPricesRef.current = newPrices;
        fibLinesRef.current = newLines;
        return;
      }
      
      // WAVE A PROJECTIONS (standard same-degree scenario)
      // Wave A retraces the prior impulse - show retracement levels of full impulse and Wave 5
      // Direction is opposite to parent trend
      const impulseRange = Math.abs(ctx.wave5Price - ctx.wave0Price);
      const wave5Range = Math.abs(ctx.wave5Price - ctx.wave4Price);
      
      console.log('📊 Wave A projections: impulse range', impulseRange.toFixed(4), 'W5 range', wave5Range.toFixed(4), 'uptrend:', ctx.isUptrend);
      
      // Wave A targets based on full impulse retracement (38.2%, 50%, 61.8%)
      const impulseRetraceLevels = [0.382, 0.5, 0.618];
      impulseRetraceLevels.forEach(level => {
        // Correction moves OPPOSITE to impulse direction
        const fibPrice = ctx.isUptrend 
          ? ctx.wave5Price - (impulseRange * level)
          : ctx.wave5Price + (impulseRange * level);
        
        const label = `A ${(level * 100).toFixed(0)}% imp`;
        const line = candleSeries.createPriceLine({
          price: fibPrice,
          color: '#FF6B6B', // Red/coral for impulse retracements
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: label,
        });
        if (line) {
          newLines.push(line);
          newPrices.push({ price: fibPrice, label, color: '#FF6B6B' });
        }
      });
      
      // Wave A targets based on Wave 5 retracement (100%, 127.2%, 161.8%)
      const wave5RetraceLevels = [1.0, 1.272, 1.618];
      wave5RetraceLevels.forEach(level => {
        const fibPrice = ctx.isUptrend 
          ? ctx.wave5Price - (wave5Range * level)
          : ctx.wave5Price + (wave5Range * level);
        
        const label = `A ${(level * 100).toFixed(0)}% W5`;
        const line = candleSeries.createPriceLine({
          price: fibPrice,
          color: '#9B59B6', // Purple for W5 extensions
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: label,
        });
        if (line) {
          newLines.push(line);
          newPrices.push({ price: fibPrice, label, color: '#9B59B6' });
        }
      });
      
      // Also add W4 price as key support/resistance level
      const w4Label = `W4 level`;
      const w4Line = candleSeries.createPriceLine({
        price: ctx.wave4Price,
        color: '#3498DB', // Blue for W4
        lineWidth: 2,
        lineStyle: 0, // Solid line
        axisLabelVisible: true,
        title: w4Label,
      });
      if (w4Line) {
        newLines.push(w4Line);
        newPrices.push({ price: ctx.wave4Price, label: w4Label, color: '#3498DB' });
      }
      
      // Store and return
      fibProjectionPricesRef.current = newPrices;
      fibLinesRef.current = newLines;
      return;
    }
    
    // Need at least 2 points to project targets for non-Wave-A scenarios
    if (pointsToUse.length < 2) {
      return;
    }

    const p0 = pointsToUse[0];
    const p1 = pointsToUse[1];
    const wave1Range = Math.abs(p1.price - p0.price);
    const isUptrend = p1.price > p0.price;
    
    // CORRECTION PATTERNS: Show both flat and zigzag targets for Wave B
    if (isCorrection) {
      // Wave B targets after Wave A is placed (2 points: 0, A)
      if (pointsToUse.length === 2) {
        // ZIGZAG B targets (38.2% - 78.6% retracement) - YELLOW
        const zigzagBLevels = [0.382, 0.5, 0.618, 0.786];
        zigzagBLevels.forEach(level => {
          const fibPrice = isUptrend 
            ? p1.price - (wave1Range * level)
            : p1.price + (wave1Range * level);
          
          const label = `B zig ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#FFE66D', // Yellow for zigzag
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#FFE66D', correctionType: 'zigzag' });
          }
        });
        
        // FLAT B targets (90% - 138.6% retracement) - CYAN
        const flatBLevels = [0.90, 1.0, 1.236, 1.382];
        flatBLevels.forEach(level => {
          const fibPrice = isUptrend 
            ? p1.price - (wave1Range * level)
            : p1.price + (wave1Range * level);
          
          const label = `B flat ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#00CED1', // Cyan for flat
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#00CED1', correctionType: 'flat' });
          }
        });
      }
      
      // Wave C targets after Wave B is placed (3 points: 0, A, B)
      if (pointsToUse.length >= 3) {
        const p2 = pointsToUse[2]; // Wave B
        const waveBRange = Math.abs(p2.price - p1.price);
        const waveBRatio = waveBRange / wave1Range;
        
        // Determine if flat or zigzag based on B's retracement OR user's click
        const detectedType = detectedCorrectionTypeRef.current || (waveBRatio >= 0.90 ? 'flat' : 'zigzag');
        
        if (detectedType === 'flat') {
          // FLAT C targets: 100% - 161.8% extension of Wave A from B
          // C moves in SAME direction as A (if A went down, C goes down from B)
          const flatCLevels = [1.0, 1.236, 1.382, 1.618];
          flatCLevels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p2.price + (wave1Range * ext)  // A went UP, so C goes UP from B
              : p2.price - (wave1Range * ext); // A went DOWN, so C goes DOWN from B
            
            const label = `C flat ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#FF6B6B', // Red for C wave
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#FF6B6B', correctionType: 'flat' });
            }
          });
        } else {
          // ZIGZAG C targets: 100% - 161.8% extension of Wave A from B
          // C moves in SAME direction as A (if A went down, C goes down from B)
          const zigzagCLevels = [1.0, 1.272, 1.414, 1.618];
          zigzagCLevels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p2.price + (wave1Range * ext)  // A went UP, so C goes UP from B
              : p2.price - (wave1Range * ext); // A went DOWN, so C goes DOWN from B
            
            const label = `C zig ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#FF6B6B', // Red for C wave
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#FF6B6B', correctionType: 'zigzag' });
            }
          });
        }
      }
    } else if (isDiagonal) {
      // DIAGONAL PATTERNS: Show both contracting and expanding targets
      // Diagonals have overlapping waves and converging/diverging trendlines
      
      // Wave 2 targets after Wave 1 is placed (2 points: 0, 1)
      if (pointsToUse.length === 2) {
        // Diagonal Wave 2: 66% - 81% retracement (Frost/Prechter guideline)
        // CONTRACTING (shorter waves) - YELLOW
        const contractingW2Levels = [0.66, 0.707, 0.786];
        contractingW2Levels.forEach(level => {
          const fibPrice = isUptrend 
            ? p1.price - (wave1Range * level)
            : p1.price + (wave1Range * level);
          
          const label = `W2 con ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#FFE66D', // Yellow for contracting
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#FFE66D', diagonalType: 'contracting' });
          }
        });
        
        // EXPANDING (deeper retracement) - CYAN
        const expandingW2Levels = [0.786, 0.886];
        expandingW2Levels.forEach(level => {
          const fibPrice = isUptrend 
            ? p1.price - (wave1Range * level)
            : p1.price + (wave1Range * level);
          
          const label = `W2 exp ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#00CED1', // Cyan for expanding
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#00CED1', diagonalType: 'expanding' });
          }
        });
      }
      
      // Wave 3 targets after Wave 2 is placed (3 points: 0, 1, 2)
      if (pointsToUse.length >= 3) {
        const p2 = pointsToUse[2]; // Wave 2
        
        // Determine if contracting or expanding based on W2 depth OR user's click
        const wave2Range = Math.abs(p2.price - p1.price);
        const wave2Ratio = wave2Range / wave1Range;
        const detectedType = detectedDiagonalTypeRef.current || (wave2Ratio >= 0.75 ? 'expanding' : 'contracting');
        
        if (detectedType === 'contracting') {
          // Contracting W3: 61.8% - 100% of W1 (shorter waves)
          const contractingW3Levels = [0.618, 0.786, 1.0];
          contractingW3Levels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p2.price + (wave1Range * ext)
              : p2.price - (wave1Range * ext);
            
            const label = `W3 con ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#00CED1', // Cyan for wave 3
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#00CED1', diagonalType: 'contracting' });
            }
          });
        } else {
          // Expanding W3: 100% - 161.8% of W1 (longer waves)
          const expandingW3Levels = [1.0, 1.272, 1.618];
          expandingW3Levels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p2.price + (wave1Range * ext)
              : p2.price - (wave1Range * ext);
            
            const label = `W3 exp ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#00CED1', // Cyan for wave 3
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#00CED1', diagonalType: 'expanding' });
            }
          });
        }
      }
      
      // Wave 4 targets after Wave 3 is placed (4 points: 0, 1, 2, 3)
      if (pointsToUse.length >= 4) {
        const p2 = pointsToUse[2]; // Wave 2
        const p3 = pointsToUse[3]; // Wave 3
        const wave3Range = Math.abs(p3.price - p2.price);
        
        // Determine diagonal type from prior detection
        const wave2Range = Math.abs(p2.price - p1.price);
        const wave2Ratio = wave2Range / wave1Range;
        const detectedType = detectedDiagonalTypeRef.current || (wave2Ratio >= 0.75 ? 'expanding' : 'contracting');
        
        if (detectedType === 'contracting') {
          // Contracting W4: 66% - 81% retracement of W3 (Frost/Prechter guideline)
          const contractingW4Levels = [0.66, 0.707, 0.786];
          contractingW4Levels.forEach(level => {
            const fibPrice = isUptrend 
              ? p3.price - (wave3Range * level)
              : p3.price + (wave3Range * level);
            
            const label = `W4 con ${(level * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#9B59B6', // Purple for wave 4
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#9B59B6', diagonalType: 'contracting' });
            }
          });
        } else {
          // Expanding W4: 61.8% - 88.6% retracement of W3 (deeper)
          const expandingW4Levels = [0.618, 0.786, 0.886];
          expandingW4Levels.forEach(level => {
            const fibPrice = isUptrend 
              ? p3.price - (wave3Range * level)
              : p3.price + (wave3Range * level);
            
            const label = `W4 exp ${(level * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#9B59B6', // Purple for wave 4
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#9B59B6', diagonalType: 'expanding' });
            }
          });
        }
      }
      
      // Wave 5 targets after Wave 4 is placed (5 points: 0, 1, 2, 3, 4)
      if (pointsToUse.length >= 5) {
        const p2 = pointsToUse[2]; // Wave 2
        const p3 = pointsToUse[3]; // Wave 3
        const p4 = pointsToUse[4]; // Wave 4
        const wave3Range = Math.abs(p3.price - p2.price);
        
        // Determine diagonal type from prior detection
        const wave2Range = Math.abs(p2.price - p1.price);
        const wave2Ratio = wave2Range / wave1Range;
        const detectedType = detectedDiagonalTypeRef.current || (wave2Ratio >= 0.75 ? 'expanding' : 'contracting');
        
        if (detectedType === 'contracting') {
          // Contracting W5: 38.2% - 61.8% of W3 (shorter due to convergence)
          const contractingW5Levels = [0.382, 0.50, 0.618];
          contractingW5Levels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p4.price + (wave3Range * ext)
              : p4.price - (wave3Range * ext);
            
            const label = `W5 con ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#FF6B6B', // Red for wave 5
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#FF6B6B', diagonalType: 'contracting' });
            }
          });
        } else {
          // Expanding W5: 100% - 123.6% of W3 (longer due to divergence)
          const expandingW5Levels = [1.0, 1.13, 1.236];
          expandingW5Levels.forEach(ext => {
            const fibPrice = isUptrend 
              ? p4.price + (wave3Range * ext)
              : p4.price - (wave3Range * ext);
            
            const label = `W5 exp ${(ext * 100).toFixed(0)}%`;
            const line = candleSeries.createPriceLine({
              price: fibPrice,
              color: '#FF6B6B', // Red for wave 5
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: label,
            });
            if (line) {
              newLines.push(line);
              newPrices.push({ price: fibPrice, label, color: '#FF6B6B', diagonalType: 'expanding' });
            }
          });
        }
      }
    } else {
      // IMPULSE PATTERNS: Standard wave projections
      
      // Project Wave 2 targets (retracement of Wave 1)
      if (pointsToUse.length >= 2) {
        const w2Levels = [0.382, 0.5, 0.618];
        w2Levels.forEach(level => {
          const fibPrice = isUptrend 
            ? p1.price - (wave1Range * level)
            : p1.price + (wave1Range * level);
          
          const label = `W2 ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#FFE66D',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#FFE66D' });
          }
        });
      }

      // Project Wave 3 targets (extension of Wave 1 from Wave 2)
      // Frost/Prechter: W3 is typically 161.8% or 261.8% of W1, minimum 138.2%
      if (pointsToUse.length >= 3) {
        const p2 = pointsToUse[2];
        const w3Extensions = [1.382, 1.618, 2.0, 2.618];
        w3Extensions.forEach(ext => {
          const fibPrice = isUptrend 
            ? p2.price + (wave1Range * ext)
            : p2.price - (wave1Range * ext);
          
          const label = `W3 ${(ext * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#00CED1',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#00CED1' });
          }
        });
      }

      // Project Wave 4 targets (retracement of Wave 3)
      if (pointsToUse.length >= 4) {
        const p2 = pointsToUse[2];
        const p3 = pointsToUse[3];
        const wave3Range = Math.abs(p3.price - p2.price);
        const w4Levels = [0.236, 0.382, 0.5];
        w4Levels.forEach(level => {
          const fibPrice = isUptrend 
            ? p3.price - (wave3Range * level)
            : p3.price + (wave3Range * level);
          
          const label = `W4 ${(level * 100).toFixed(0)}%`;
          const line = candleSeries.createPriceLine({
            price: fibPrice,
            color: '#9B59B6',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: fibPrice, label, color: '#9B59B6' });
          }
        });
      }

      // Project Wave 5 from W4 — trend-based W1, plus W3 targets when W1 won't clear W3
      if (pointsToUse.length >= 5) {
        const p2 = pointsToUse[2];
        const p3 = pointsToUse[3];
        const p4 = pointsToUse[4];
        const w5Levels = calcW5ProjectionLevels(
          p0.price,
          p1.price,
          p2.price,
          p3.price,
          p4.price,
        );
        w5Levels.forEach(level => {
          const line = candleSeries.createPriceLine({
            price: level.price,
            color: level.color ?? '#FF6B6B',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: level.label,
          });
          if (line) {
            newLines.push(line);
            newPrices.push({ price: level.price, label: level.label, color: level.color ?? '#FF6B6B' });
          }
        });
      }
    }

    fibLinesRef.current = newLines;
    fibProjectionPricesRef.current = newPrices;

    // Cleanup function to remove lines when effect re-runs or component unmounts
    return () => {
      clearFibLines();
    };
  }, [fibonacciMode, currentPoints, savedLabels, selectedLabelId, candles, isDragging, draggedPointIndex]);

  // Stack Projection Lines - render Wave Stack-based projections on chart
  const stackProjectionLinesRef = useRef<any[]>([]);
  
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    
    // Clear existing stack projection lines
    stackProjectionLinesRef.current.forEach(line => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) { /* ignore */ }
    });
    stackProjectionLinesRef.current = [];
    
    // Add new projection lines
    stackProjectionLines.forEach(proj => {
      try {
        const line = candleSeries.createPriceLine({
          price: proj.price,
          color: proj.color,
          lineWidth: proj.lineWidth as LineWidth,
          lineStyle: proj.lineStyle,
          axisLabelVisible: proj.axisLabelVisible,
          title: proj.title,
        });
        if (line) {
          stackProjectionLinesRef.current.push(line);
        }
      } catch (e) {
        console.warn('Failed to create projection line:', e);
      }
    });
    
    // Cleanup when component unmounts or projections change
    return () => {
      stackProjectionLinesRef.current.forEach(line => {
        try {
          candleSeries.removePriceLine(line);
        } catch (e) { /* ignore */ }
      });
    };
  }, [stackProjectionLines]);

  // Draw diagonal trendlines (W2→W4 and W1→W3, extended to W5 candle time)
  // These form the wedge channel and allow visualization of over/underthrow at Wave 5
  useEffect(() => {
    const chart = chartRef.current;
    
    // Helper to clean up existing diagonal trendlines
    const clearDiagonalLines = () => {
      diagonalTrendlinesRef.current.forEach(series => {
        try {
          chart?.removeSeries(series);
        } catch (e) { /* ignore - series may already be removed */ }
      });
      diagonalTrendlinesRef.current = [];
    };

    // ALWAYS clear existing lines first
    clearDiagonalLines();

    if (!chart) return;

    // Get the points to use (either from selected saved label or current points)
    const pointsToUse = selectedLabelId 
      ? savedLabels.find(l => l.id === selectedLabelId)?.points || []
      : currentPoints;
    
    // Get pattern type
    const currentPattern = selectedLabelId 
      ? savedLabels.find(l => l.id === selectedLabelId)?.patternType 
      : patternType;
    
    // Only draw trendlines for diagonals with at least 5 points (0, 1, 2, 3, 4)
    // We need W2 and W4 for lower trendline
    const isDiagonal = currentPattern === 'diagonal';
    if (!isDiagonal || pointsToUse.length < 5) {
      return;
    }

    const newSeries: any[] = [];
    
    try {
      console.log('📐 Drawing diagonal trendlines, points:', pointsToUse.length);
      
      // Points: 0=start, 1=end of wave 1, 2=end of wave 2, 3=end of wave 3, 4=end of wave 4, 5=end of wave 5
      const p1 = pointsToUse[1]; // End of Wave 1
      const p2 = pointsToUse[2]; // End of Wave 2
      const p3 = pointsToUse[3]; // End of Wave 3
      const p4 = pointsToUse[4]; // End of Wave 4
      const p5 = pointsToUse.length >= 6 ? pointsToUse[5] : null; // End of Wave 5 (if exists)

      console.log('📐 Points - p1:', p1?.time, p1?.price, 'p2:', p2?.time, p2?.price, 'p3:', p3?.time, p3?.price, 'p4:', p4?.time, p4?.price);

      // Trendline color - semi-transparent white
      const trendlineColor = 'rgba(255, 255, 255, 0.5)';
      
      // Helper function to extend a trendline to a target time
      const extendLine = (startP: WavePoint, endP: WavePoint, targetTime: number): { time: number; value: number } => {
        const timeDiff = (endP.time as number) - (startP.time as number);
        const priceDiff = endP.price - startP.price;
        const slope = timeDiff !== 0 ? priceDiff / timeDiff : 0;
        const targetTimeDiff = targetTime - (startP.time as number);
        const targetPrice = startP.price + (slope * targetTimeDiff);
        return { time: targetTime, value: targetPrice };
      };

      // Determine how far to extend the lines
      // If we have W5, extend to W5. Otherwise extend a bit beyond W4
      const p4Time = p4.time as number;
      const p5Time = p5?.time as number | undefined;
      
      // If no W5, calculate estimated future extension (one candle interval beyond W4)
      // Get time interval from existing points
      const timeInterval = p4Time - (p3.time as number);
      const extendToTime = p5Time || (p4Time + Math.abs(timeInterval));

      // Draw lower trendline: W2 → W4 extended beyond
      // (Connects the correction wave endpoints - forms lower boundary of wedge)
      if (p2 && p4 && p2.time && p4.time && p2.time !== p4.time) {
        const extendedPoint = extendLine(p2, p4, extendToTime);
        
        // Only add extension point if it has a different time
        const dataLower: { time: any; value: number }[] = [
          { time: p2.time as any, value: p2.price },
          { time: p4.time as any, value: p4.price },
        ];
        
        // Add extended point only if time is different from p4
        if (extendedPoint.time !== p4Time) {
          dataLower.push({ time: extendedPoint.time as any, value: extendedPoint.value });
        }
        
        dataLower.sort((a, b) => (a.time as number) - (b.time as number));
        
        console.log('📐 Lower trendline data:', dataLower);
        
        const lineLower = chart.addSeries(LineSeries, {
          color: trendlineColor,
          lineWidth: 1,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        lineLower.setData(dataLower);
        newSeries.push(lineLower);
        console.log('📐 Lower trendline created successfully');
      }

      // Draw upper trendline: W1 → W3 extended beyond
      // (Connects the impulse wave peaks - forms upper boundary of wedge)
      if (p1 && p3 && p1.time && p3.time && p1.time !== p3.time) {
        const extendedPoint = extendLine(p1, p3, extendToTime);
        const p3Time = p3.time as number;
        
        // Only add extension point if it has a different time
        const dataUpper: { time: any; value: number }[] = [
          { time: p1.time as any, value: p1.price },
          { time: p3.time as any, value: p3.price },
        ];
        
        // Add extended point only if time is different from p3
        if (extendedPoint.time !== p3Time) {
          dataUpper.push({ time: extendedPoint.time as any, value: extendedPoint.value });
        }
        
        dataUpper.sort((a, b) => (a.time as number) - (b.time as number));
        
        console.log('📐 Upper trendline data:', dataUpper);
        
        const lineUpper = chart.addSeries(LineSeries, {
          color: trendlineColor,
          lineWidth: 1,
          lineStyle: 0, // Solid
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        lineUpper.setData(dataUpper);
        newSeries.push(lineUpper);
        console.log('📐 Upper trendline created successfully');
      }
    } catch (e: any) {
      console.warn('Failed to draw diagonal trendlines:', e?.message || e);
    }

    diagonalTrendlinesRef.current = newSeries;

    // Cleanup function
    return () => {
      clearDiagonalLines();
    };
  }, [currentPoints, savedLabels, selectedLabelId, patternType]);

  const handleSaveLabel = () => {
    // Guard: Check access before attempting save
    if (!hasElliottAccess) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to save wave patterns.',
        variant: 'destructive',
      });
      return;
    }
    
    if (currentPoints.length < 3) {
      toast({
        title: 'Not Enough Points',
        description: 'Please place at least 3 wave points before saving.',
        variant: 'destructive',
      });
      return;
    }

    saveLabel.mutate({
      symbol,
      timeframe,
      degree: selectedDegree,
      patternType,
      points: currentPoints,
      isComplete: true,
      fibonacciMode,
      validationResult: validation || undefined,
    });
  };

  const handleClearPoints = () => {
    setCurrentPoints([]);
    trendDirectionRef.current = null; // Clear cached direction for next pattern
    detectedCorrectionTypeRef.current = null; // Clear detected correction type
    detectedDiagonalTypeRef.current = null; // Clear detected diagonal type
    correctionContextRef.current = null; // Clear correction context (parent impulse data)
    
    // Clear Fib projection data when clearing points
    fibProjectionPricesRef.current = [];
    if (candleSeriesRef.current) {
      fibLinesRef.current.forEach(line => {
        try { candleSeriesRef.current?.removePriceLine(line); } catch (e) { /* ignore */ }
      });
      fibLinesRef.current = [];
    }
    // Keep drawing mode enabled so user can continue labeling
  };
  // ──────────────────────────────────────────────────────────────────────
  //  CHART SCREENSHOT CAPTURE – Built-in + Rock-Solid Fallback
  // ──────────────────────────────────────────────────────────────────────
  const captureChartScreenshot = async (): Promise<string | null> => {
    if (!chartRef.current || !chartContainerRef.current) return null;

    // 1. Try official lightweight-charts method first (fastest)
    try {
      const canvas = await chartRef.current.takeScreenshot();
      if (canvas) {
        const imageData = canvas.toDataURL('image/png');
        if (imageData && imageData.startsWith('data:') && imageData.length > 100) {
          console.log('[Screenshot] Built-in takeScreenshot() succeeded');
          return imageData; // Already perfect base64 PNG
        }
      }
    } catch (err) {
      console.warn('[Screenshot] Built-in method failed (continuing to fallback):', err);
      // Fall through to manual capture
    }
    // 2. Manual fallback – captures EVERY canvas (chart + price/time axes)
    try {
      const container = chartContainerRef.current!;
      const rect = container.getBoundingClientRect();

      // High-res temp canvas (2x for crispness)
      const tempCanvas = document.createElement('canvas');
      const scaleFactor = window.devicePixelRatio >= 2 ? 2 : 1.5;
      tempCanvas.width = rect.width * scaleFactor;
      tempCanvas.height = rect.height * scaleFactor;

      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw all canvas layers in correct order
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach((c) => {
        const cRect = c.getBoundingClientRect();
        const offsetX = cRect.left - rect.left;
        const offsetY = cRect.top - rect.top;
        ctx.drawImage(c, offsetX, offsetY);
      });

      // Resize down to sane limits (1200×800 max)
      const MAX_W = 1200;
      const MAX_H = 800;
      let { width, height } = tempCanvas;

      if (width > MAX_W) {
        height = (height * MAX_W) / width;
        width = MAX_W;
      }
      if (height > MAX_H) {
        width = (width * MAX_H) / height;
        height = MAX_H;
      }

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCtx.drawImage(tempCanvas, 0, 0, width, height);

      const jpeg = finalCanvas.toDataURL('image/jpeg', 0.85);
      console.log('[Screenshot] Fallback capture succeeded');
      return jpeg;
    } catch (err) {
      console.error('[Screenshot] Fallback completely failed:', err);
      return null;
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  //  AI AUTO-ANALYZE HANDLER – Clean & Final Version
  // ──────────────────────────────────────────────────────────────────────
  const handleAutoAnalyze = useCallback(async () => {
    // Guard: Check access before AI analysis
    if (!hasElliottAccess) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to use AI wave analysis.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!chartRef.current || !chartContainerRef.current) {
      toast({
        title: 'Chart not ready',
        description: 'Please wait for the chart to load.',
        variant: 'destructive',
      });
      return;
    }

    setIsCapturingChart(true);
    let chartImage: string | null = null;

    try {
      chartImage = await captureChartScreenshot();
      if (chartImage) {
        console.log('SCREENSHOT SUCCESS — Size:', (chartImage.length / 1024 / 1024).toFixed(2), 'MB');
      } else {
        console.log('SCREENSHOT FAILED — chartImage is null');
      }
    } finally {
      setIsCapturingChart(false);
    }

    // Candle data & visible range
    const allCandles = candlesRef.current || candles;
    if (allCandles.length === 0) {
      toast({ title: 'No data', description: 'No candle data available.', variant: 'destructive' });
      return;
    }

    const timeScale = chartRef.current!.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    if (!visibleRange) {
      toast({ title: 'Zoom required', description: 'Please zoom/pan the chart first.', variant: 'destructive' });
      return;
    }

    // Find first visible candle index
    let visibleStartIdx = allCandles.findIndex(c => c.time >= (visibleRange.from as number));
    if (visibleStartIdx === -1) visibleStartIdx = 0;

    const visibleCandles = allCandles.filter(
      c => c.time >= (visibleRange.from as number) && c.time <= (visibleRange.to as number)
    );

    if (visibleCandles.length < 10) {
      toast({ title: 'Zoom in', description: 'Need at least 10 visible candles.', variant: 'destructive' });
      return;
    }

    // ─── Prepare payload ───
    const degreeContextString = JSON.stringify(waveDegreesRef.current || []);
    const currentPoints = currentPointsRef.current || [];

    if (aiAnalyze.isPending) return;

    console.log('Sending AI analysis request...', {
      symbol,
      timeframe,
      visibleCandles: visibleCandles.length,
      hasImage: !!chartImage,
    });

    aiAnalyze.mutate({
      chartImage: chartImage || undefined,
      candles: visibleCandles,
      visibleStartIndex: visibleStartIdx,
      symbol,
      timeframe,
      degreeContext: degreeContextString || '',
      existingLabels:
        currentPoints.length > 0
          ? currentPoints
              .map(p => `${p.label} at [${p.index}] ${p.price.toFixed(4)}`)
              .join('\n')
          : undefined,
    });
  }, [
    symbol,
    timeframe,
    candles,
    aiAnalyze,
    toast,
    hasElliottAccess,
  ]);

  // ─── Auth redirect with returnTo ───
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const returnUrl = encodeURIComponent('/cryptoelliottwave');
      setLocation(`/cryptologin?returnTo=${returnUrl}`);
    }
  }, [authLoading, isAuthenticated, setLocation]);
  
  return (
  <div className="min-h-screen bg-[#0e0e0e] text-white pb-24">
    <Helmet>
      <title>Elliott Wave Analysis - Professional Trading | BearTec</title>
      <meta name="description" content="Professional Elliott Wave analysis with interactive wave labeling, Fibonacci ratios, pattern validation, and auto-detection. Elite trading tools for cryptocurrency markets." />
      <meta property="og:title" content="Elliott Wave Analysis | BearTec Crypto" />
      <meta property="og:description" content="Professional Elliott Wave analysis with 9-degree wave labeling, Fibonacci tools, and pattern validation for crypto trading." />
    </Helmet>

    {/* Header - Hidden on mobile, shown on desktop */}
    <div className="hidden lg:block lg:sticky lg:top-0 z-50 bg-[#0e0e0e]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cryptoindicators">
            <img src={bearTecLogoNew} alt="BearTec" className="h-8 cursor-pointer" />
          </Link>
          <h1 className="text-xl font-bold">Elliott Wave Analysis</h1>
        </div>

        <div className="flex items-center gap-4">
          <FavoritesOnlySelector 
            value={symbol} 
            onChange={(val) => { incrementTickerClick(val); setSymbol(val); }}
          />

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-28 bg-slate-800 border-slate-700" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleTimeframes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHistory()}
            disabled={historyLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
          </Button>

          <AuthButtons />
        </div>
      </div>
    </div>

    <div className="max-w-7xl mx-auto p-4 pt-32 lg:pt-4 flex flex-col gap-4">
      {/* Chart Area - Full Width */}
      <div className="w-full">
        {/* Mobile Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-slate-900/95 rounded-lg border border-slate-800 fixed top-0 left-0 right-0 z-40 mx-4 mt-1 lg:static lg:mx-0 lg:mt-0 backdrop-blur-sm">
          <div className="flex items-center gap-2 lg:hidden w-full pb-2 border-b border-slate-700 mb-2">
            <Link href="/cryptoindicators">
              <img src={bearTecLogoNew} alt="BearTec" className="h-8 cursor-pointer" />
            </Link>
            <FavoritesOnlySelector 
              value={symbol} 
              onChange={(val) => { incrementTickerClick(val); setSymbol(val); }}
            />
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">{visibleTimeframes.map(t => <SelectItem key={t.value} value={t.value} className="text-gray-200 hover:bg-slate-700 focus:bg-slate-700">{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 w-full lg:w-auto lg:gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`w-8 h-7 p-0 ${isDrawing ? 'bg-[#00c4b4] text-white hover:bg-[#00a89c]' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'}`}
              onClick={() => { 
                const newDrawing = !isDrawing;
                setIsDrawing(newDrawing); 
                isDrawingRef.current = newDrawing;
                setSelectionMode(false);
                selectionModeRef.current = false;
              }}
              title="Draw mode"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            
            {/* Wave Auto-Snap Toggle (Magnet) */}
            <Button
              variant="ghost"
              size="sm"
              className={`w-8 h-7 p-0 ${waveAutoSnapEnabled ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'}`}
              onClick={() => {
                setWaveAutoSnapEnabled(prev => !prev);
                toast({
                  title: waveAutoSnapEnabled ? 'Wave Snap OFF' : 'Wave Snap ON',
                  description: waveAutoSnapEnabled ? 'Points placed exactly where you tap' : 'Points snap to highs/lows automatically',
                });
              }}
              title={waveAutoSnapEnabled ? 'Wave snap ON (snaps to highs/lows)' : 'Wave snap OFF (exact placement)'}
              data-testid="btn-wave-auto-snap"
            >
              <Magnet className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`w-8 h-7 p-0 ${selectionMode ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'}`}
              onClick={() => { 
                const newSelection = !selectionMode;
                setSelectionMode(newSelection);
                selectionModeRef.current = newSelection;
                setIsDrawing(false);
                isDrawingRef.current = false;
                // CRITICAL: Use savedLabelsRef.current (always up-to-date via useEffect)
                // The closure-captured `savedLabels` may be stale from an earlier render
                const currentPatternCount = savedLabelsRef.current.length;
                console.log('🔘 SELECT BUTTON CLICKED:', { newSelection, patternCount: currentPatternCount });
                if (newSelection) {
                  toast({
                    title: 'Selection Mode ON',
                    description: `${currentPatternCount} pattern(s) available. Tap a wave point to select.`,
                  });
                }
              }}
              title="Select mode"
            >
              <MousePointer2 className="w-4 h-4" />
            </Button>

            <Select value={selectedDegree || 'Minor'} onValueChange={setSelectedDegree}>
              <SelectTrigger className="flex-1 min-w-0 lg:w-[100px] h-7 bg-slate-800 border-slate-700 text-xs px-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: waveDegrees.find(d => d.name === selectedDegree)?.color || '#ffa500' }} />
                  <span className="truncate">{(selectedDegree || 'Min').slice(0, 3)}</span>
                </span>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {(waveDegrees.length > 0 ? waveDegrees : [{ name: 'Minor', color: '#ffa500' }]).map(d => (
                  <SelectItem key={d.name} value={d.name} className="text-gray-200 hover:bg-slate-700 focus:bg-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={patternType} onValueChange={setPatternType}>
              <SelectTrigger className="flex-1 min-w-0 lg:w-[80px] h-7 bg-slate-800 border-slate-700 text-xs px-2">
                <span className="truncate">
                  {patternType === 'impulse' ? '12345' : patternType === 'diagonal' ? 'Diag' : patternType === 'zigzag' ? 'ZZ' : patternType === 'flat' ? 'Flat' : patternType === 'triangle' ? 'Tri' : 'ABC'}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {PATTERN_TYPES.map(p => <SelectItem key={p.value} value={p.value} className="text-gray-200 hover:bg-slate-700 focus:bg-slate-700">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={fibonacciMode} onValueChange={setFibonacciMode}>
              <SelectTrigger className="flex-1 min-w-0 lg:w-[70px] h-7 bg-slate-800 border-slate-700 text-xs px-2">
                <span className="truncate">{fibonacciMode === 'measured' ? 'M%' : fibonacciMode === 'projected' ? 'P%' : 'Off'}</span>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {FIBONACCI_MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-gray-200 hover:bg-slate-700 focus:bg-slate-700">{m.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button
              onClick={handleClearPoints}
              disabled={!isDrawing || currentPoints.length === 0}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-400 hover:bg-red-500/10"
              title="Clear points"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            {isDrawing && currentPoints.length >= 3 && (
              <Button 
                onClick={handleSaveLabel} 
                disabled={saveLabel.isPending || !hasElliottAccess} 
                size="sm" 
                className="h-7 px-2 bg-[#00c4b4] hover:bg-[#00a89c] disabled:opacity-50"
                title={!hasElliottAccess ? "Sign in to save patterns" : "Save pattern"}
              >
                {saveLabel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            )}

            {selectionMode && selectedLabelId && (
              <>
                <Select 
                  value={savedLabels.find(l => l.id === selectedLabelId)?.degree || 'Minor'} 
                  onValueChange={(newDegree) => {
                    updateLabel.mutate({ id: selectedLabelId, degree: newDegree });
                    toast({ title: 'Degree Updated', description: `Changed to ${newDegree}` });
                  }}
                >
                  <SelectTrigger className="w-[100px] h-7 bg-slate-800 border-amber-500/50 text-xs px-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: waveDegrees.find(d => d.name === savedLabels.find(l => l.id === selectedLabelId)?.degree)?.color || '#ffa500' }} />
                      <span className="truncate">{savedLabels.find(l => l.id === selectedLabelId)?.degree || 'Minor'}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {(waveDegrees.length > 0 ? waveDegrees : [{ name: 'Minor', color: '#ffa500' }]).map(d => (
                      <SelectItem key={d.name} value={d.name} className="text-gray-200 hover:bg-slate-700 focus:bg-slate-700">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => deleteLabel.mutate(selectedLabelId)} 
                  disabled={deleteLabel.isPending || !hasElliottAccess} 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  title={!hasElliottAccess ? "Sign in to delete patterns" : "Delete pattern"}
                >
                  {deleteLabel.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="text-xs text-gray-400 px-2 mb-1 flex items-center gap-2">
          {isDrawing ? (
            <span className="text-[#00c4b4]">Tap candles ({currentPoints.length}/{patternType === 'impulse' ? 6 : patternType === 'triangle' ? 6 : 4})</span>
          ) : selectionMode ? (
            <span className="text-amber-400">
              {selectedLabelId ? `Selected: ${savedLabels.find(l => l.id === selectedLabelId)?.patternType}` : "Tap a pattern"}
            </span>
          ) : (
            <span>View mode</span>
          )}
        </div>

        {/* Permission prompt for non-authorized users in production */}
        {!isDevelopment && !isAuthenticated && !authLoading && (
          <Card className="bg-amber-900/20 border-amber-500/50 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-300 font-medium">Sign in to access Elliott Wave features</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Elliott Wave analysis requires an account. Sign in to save and load your wave patterns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Chart */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-2">
            {isFalconTicker(symbol) && (
              <FalconChartStatusBanner
                className="mb-2"
                pair={symbol}
                candleCount={Array.isArray(historyData?.candles) ? historyData!.candles.length : 0}
                isLoading={historyLoading}
                error={(historyError as Error | null) ?? null}
                meta={historyData ? parseFalconCandleMeta(historyData, symbol) : null}
              />
            )}
            {historyLoading ? (
              <div className="h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00c4b4] mx-auto mb-2" />
                  <p className="text-gray-400">Loading extended history...</p>
                </div>
              </div>
            ) : historyError ? (
              <div className="h-[500px] flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-red-400 text-xl">!</span>
                  </div>
                  <p className="text-red-400 font-medium mb-2">Failed to load chart data</p>
                  <p className="text-gray-500 text-sm mb-4">{(historyError as Error).message}</p>
                  <Button onClick={() => refetchHistory()} variant="outline" size="sm">
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div ref={chartContainerRef} className={`w-full h-[500px] ${isDrawing ? 'cursor-crosshair ring-2 ring-[#00c4b4]/50 rounded' : ''}`} style={{ touchAction: isDrawing ? 'none' : 'pan-x pan-y pinch-zoom' }} />
                
                {/* SVG Overlay for Drawings */}
                <svg 
                  className={`absolute top-0 left-0 ${drawingMode === 'select' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                  style={{ width: '100%', height: '500px', zIndex: 10 }}
                  data-testid="drawing-overlay"
                  onClick={(e) => {
                    if (drawingMode === 'select' && (e.target as Element).tagName === 'svg') {
                      setSelectedDrawingId(null);
                    }
                  }}
                >
                  {drawings.map(drawing => {
                    if (!chartRef.current || !chartReady) return null;
                    const chart = chartRef.current;
                    const timeScale = chart.timeScale();
                    const chartWidth = timeScale.width() ?? 800;
                    
                    // Convert point to pixel coordinates, returning null if out of visible range
                    const toPixelRaw = (point: { time: number; price: number }) => {
                      const x = timeScale.timeToCoordinate(point.time as any);
                      const y = candleSeriesRef.current?.priceToCoordinate(point.price);
                      return { x, y };
                    };
                    
                    const color = drawing.style?.color || '#3b82f6';
                    const isSelected = drawing.id === selectedDrawingId;
                    const handleClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (drawingMode === 'select') {
                        setSelectedDrawingId(drawing.id === selectedDrawingId ? null : drawing.id);
                      }
                    };
                    
                    if (drawing.type === 'trendline' && drawing.points.length >= 2) {
                      const p1 = toPixelRaw(drawing.points[0]);
                      const p2 = toPixelRaw(drawing.points[1]);
                      // Skip if both points are out of view (null x)
                      if (p1.x === null && p2.x === null) return null;
                      // Clamp coordinates to chart bounds for partial visibility
                      const x1 = p1.x !== null ? p1.x : (drawing.points[0].time < drawing.points[1].time ? 0 : chartWidth);
                      const x2 = p2.x !== null ? p2.x : (drawing.points[1].time < drawing.points[0].time ? 0 : chartWidth);
                      const y1 = p1.y ?? 0;
                      const y2 = p2.y ?? 0;
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: drawingMode === 'select' ? 'pointer' : 'default' }}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isSelected ? '#22c55e' : color} strokeWidth={isSelected ? 3 : 2} />
                          {isSelected && (<><circle cx={x1} cy={y1} r={5} fill="#22c55e" /><circle cx={x2} cy={y2} r={5} fill="#22c55e" /></>)}
                        </g>
                      );
                    }
                    if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
                      const p1 = toPixelRaw(drawing.points[0]);
                      const p2 = toPixelRaw(drawing.points[1]);
                      // Skip if both points are completely out of view
                      if (p1.x === null && p2.x === null) return null;
                      // Clamp x coordinates to visible chart area
                      const x1 = p1.x !== null ? Math.max(0, Math.min(chartWidth, p1.x)) : (drawing.points[0].time < drawing.points[1].time ? 0 : chartWidth);
                      const x2 = p2.x !== null ? Math.max(0, Math.min(chartWidth, p2.x)) : (drawing.points[1].time < drawing.points[0].time ? 0 : chartWidth);
                      const y1 = p1.y ?? 0;
                      const y2 = p2.y ?? 0;
                      const x = Math.min(x1, x2);
                      const y = Math.min(y1, y2);
                      const w = Math.abs(x2 - x1);
                      const h = Math.abs(y2 - y1);
                      // Skip rendering if width or height is 0 (would be invisible)
                      if (w === 0 && h === 0) return null;
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: drawingMode === 'select' ? 'pointer' : 'default' }}>
                          <rect x={x} y={y} width={w} height={h} fill={`${color}20`} stroke={isSelected ? '#22c55e' : color} strokeWidth={isSelected ? 3 : 2} />
                        </g>
                      );
                    }
                    if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
                      const y = candleSeriesRef.current?.priceToCoordinate(drawing.points[0].price) ?? 0;
                      const chartWidth = chartRef.current?.timeScale().width() ?? 800;
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: drawingMode === 'select' ? 'pointer' : 'default' }}>
                          <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="transparent" strokeWidth={12} />
                          <line x1={0} y1={y} x2={chartWidth} y2={y} stroke={isSelected ? '#22c55e' : color} strokeWidth={isSelected ? 3 : 2} />
                          <text x={5} y={y - 5} fill={isSelected ? '#22c55e' : color} fontSize="11">${drawing.points[0].price.toFixed(4)}</text>
                          {isSelected && (<><circle cx={50} cy={y} r={5} fill="#22c55e" /><circle cx={chartWidth - 50} cy={y} r={5} fill="#22c55e" /></>)}
                        </g>
                      );
                    }
                    return null;
                  })}
                  
                  {/* Temp drawing preview */}
                  {tempDrawing && tempDrawing.points.length > 0 && chartReady && (
                    tempDrawing.points.map((point, i) => {
                      const x = chartRef.current?.timeScale().timeToCoordinate(point.time as any) ?? 0;
                      const y = candleSeriesRef.current?.priceToCoordinate(point.price) ?? 0;
                      return <circle key={i} cx={x} cy={y} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />;
                    })
                  )}
                </svg>
                
                {/* Drawing Tools Toolbar */}
                <div className="absolute top-2 left-2 z-20 flex gap-1">
                  <button onClick={() => setShowToolPicker(prev => !prev)} className={`p-2 rounded-lg transition-all ${drawingMode === 'draw' ? 'bg-blue-500 text-white' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`} title="Drawing Tools" data-testid="btn-drawing-tools">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setDrawingMode(prev => prev === 'select' ? 'off' : 'select'); setActiveTool(null); setShowToolPicker(false); }} className={`p-2 rounded-lg transition-all ${drawingMode === 'select' ? 'bg-green-500 text-white' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`} title="Select Drawings" data-testid="btn-select-drawings">
                    <MousePointer2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setDrawingMode('off'); setActiveTool(null); setShowToolPicker(false); setSelectedDrawingId(null); setTempDrawing(null); gestureController.cancelCrosshairMode(); }} className="p-2 rounded-lg bg-slate-800/90 text-gray-300 hover:bg-slate-700 transition-all" title="Exit Drawing Mode" data-testid="btn-deselect-drawing">
                    <X className="w-4 h-4" />
                  </button>
                  {drawingMode === 'draw' && (
                    <button 
                      onClick={() => setAutoSnapEnabled(prev => !prev)} 
                      className={`p-2 rounded-lg transition-all ${autoSnapEnabled ? 'bg-yellow-500 text-black' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`} 
                      title={autoSnapEnabled ? 'Auto-snap ON (snaps to highs/lows)' : 'Auto-snap OFF'} 
                      data-testid="btn-auto-snap"
                    >
                      <Magnet className="w-4 h-4" />
                    </button>
                  )}
                  {selectedDrawingId && (
                    <>
                      <button onClick={() => setShowDrawingSettings(prev => !prev)} className={`p-2 rounded-lg transition-all ${showDrawingSettings ? 'bg-purple-500 text-white' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`} title="Drawing Settings" data-testid="btn-drawing-settings">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => { deleteDrawingMutation.mutate(selectedDrawingId); setSelectedDrawingId(null); setShowDrawingSettings(false); toast({ title: 'Drawing Deleted' }); }} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all" title="Delete Selected" data-testid="btn-delete-selected">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {drawings.length > 0 && (
                    <button onClick={() => { if (confirm('Clear all drawings?')) { clearDrawingsMutation.mutate(); setSelectedDrawingId(null); toast({ title: 'Drawings Cleared' }); } }} className="p-2 rounded-lg bg-slate-800/90 text-gray-300 hover:bg-red-600 hover:text-white transition-all" title="Clear All" data-testid="btn-clear-drawings">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Tool Picker Popup */}
                {showToolPicker && (
                  <div className="absolute top-14 left-2 z-30 bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl min-w-[180px]">
                    <div className="text-xs text-gray-400 mb-2 px-2">Select Drawing Tool</div>
                    {[
                      { id: 'trendline', name: 'Trend Line', icon: '📈' },
                      { id: 'horizontal', name: 'Horizontal Line', icon: '➖' },
                      { id: 'rectangle', name: 'Rectangle', icon: '⬜' },
                    ].map(tool => (
                      <button key={tool.id} onClick={() => { setActiveTool(tool.id as DrawingTool); setDrawingMode('draw'); setShowToolPicker(false); setTempDrawing({ points: [] }); toast({ title: `${tool.name} Selected`, description: 'Click on chart to place points' }); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 transition-all text-left ${activeTool === tool.id ? 'bg-blue-500/30 text-blue-300' : 'text-gray-300'}`} data-testid={`tool-${tool.id}`}>
                        <span>{tool.icon}</span>
                        <span className="text-sm">{tool.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Drawing Settings Popup */}
                {showDrawingSettings && selectedDrawingId && (() => {
                  const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
                  if (!selectedDrawing) return null;
                  return (
                    <div className="absolute top-14 left-2 z-30 bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[220px]">
                      <div className="text-xs text-gray-400 mb-3 flex justify-between items-center">
                        <span>Drawing Settings</span>
                        <button onClick={() => setShowDrawingSettings(false)} className="text-gray-400 hover:text-white"><X className="w-3 h-3" /></button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Color</label>
                          <div className="flex gap-1 flex-wrap">
                            {['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ffffff'].map(c => (
                              <button key={c} onClick={() => {
                                const newStyle = { ...selectedDrawing.style, color: c };
                                setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, style: newStyle } : d));
                                updateDrawingMutation.mutate({ id: selectedDrawingId, style: newStyle });
                              }} className={`w-6 h-6 rounded border-2 ${selectedDrawing.style?.color === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} data-testid={`color-${c}`} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Label</label>
                          <input
                            type="text"
                            value={selectedDrawing.style?.label || ''}
                            onChange={(e) => {
                              const newStyle = { ...selectedDrawing.style, label: e.target.value };
                              setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, style: newStyle } : d));
                            }}
                            onBlur={(e) => {
                              const newStyle = { ...selectedDrawing.style, label: e.target.value };
                              updateDrawingMutation.mutate({ id: selectedDrawingId, style: newStyle });
                            }}
                            placeholder="Enter label..."
                            className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white placeholder-gray-500"
                            data-testid="input-drawing-label"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Drawing mode indicator */}
                {activeTool && drawingMode === 'draw' && (
                  <div className="absolute bottom-2 left-2 z-20 bg-blue-600/90 text-white text-xs px-3 py-1 rounded-lg">
                    Drawing: {activeTool.replace('_', ' ')} {tempDrawing && `(${tempDrawing.points.length}/${activeTool === 'horizontal' ? 1 : 2} points)`}
                  </div>
                )}
              </div>
            )}

            {currentPoints.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {currentPoints.map((point, idx) => (
                  <Badge key={idx} variant="outline" className="cursor-pointer hover:bg-red-500/20 text-xs" onClick={() => {
                    setCurrentPoints(prev => prev.filter((_, i) => i !== idx));
                  }}>
                    <span className="text-[#00c4b4]">{point.label}</span>
                    <span className="text-gray-400 ml-1">${point.price.toFixed(2)}</span>
                    <Trash2 className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-3">
        <CardTitle className="text-lg">Validation</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={aiAnalysis ? "ai" : "validation"}>
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="validation">Rules</TabsTrigger>
            <TabsTrigger value="fibonacci">Fib</TabsTrigger>
            <TabsTrigger value="stack" className={waveStackEntries.length > 0 ? 'text-cyan-400' : ''}>
              Stack {waveStackEntries.length > 0 && `(${waveStackEntries.length})`}
            </TabsTrigger>
            <TabsTrigger value="ai" className={aiAnalysis ? 'text-[#00c4b4]' : ''}>
              AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validation" className="mt-4">
            {validation ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className={`p-3 rounded-lg border ${validation.isValid ? 'bg-emerald-900/30 border-emerald-600/50' : 'bg-amber-900/30 border-amber-600/50'}`}>
                  <div className="flex items-center gap-2">
                    {validation.isValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    )}
                    <span className={`font-semibold ${validation.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {validation.isValid ? 'Valid Pattern' : 'Pattern Has Issues'}
                    </span>
                    {validation.detectedType && (
                      <Badge className="ml-auto text-xs bg-slate-700 text-white border border-slate-500 px-2 py-0.5">
                        {validation.detectedSubtype || validation.detectedType}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Errors
                    </h4>
                    {validation.errors.map((error, i) => (
                      <div key={i} className="text-sm text-red-300 bg-red-900/20 px-3 py-2 rounded border border-red-800/50">
                        {error}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-amber-400 flex items-center gap-1">
                      <Info className="w-4 h-4" /> Warnings
                    </h4>
                    {validation.warnings.map((warning, i) => (
                      <div key={i} className="text-sm text-amber-300 bg-amber-900/20 px-3 py-2 rounded border border-amber-800/50">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show pattern-specific rules that passed */}
                {validation.errors.length === 0 && validation.warnings.length === 0 && (() => {
                  // Use the selected label's pattern type, or detected type, or fallback to drawing mode
                  const displayPatternType = selectedLabel?.patternType || validation.detectedType || patternType;
                  return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 mb-3">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">All rules validated</span>
                    </div>
                    
                    {/* Impulse rules */}
                    {displayPatternType === 'impulse' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 2 does not retrace beyond start of Wave 1</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 3 is not the shortest wave in price</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 4 does not overlap Wave 1 price territory</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 5 extends beyond Wave 3 endpoint</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Diagonal rules */}
                    {displayPatternType === 'diagonal' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 2 retraces 50-88.6% of Wave 1</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 3 retraces 61.8-161.8% of Wave 2</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 4 retraces 50-78.6% of Wave 3</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Trendlines converge (contracting) or diverge (expanding)</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave 4 overlaps Wave 1 territory (diagonal rule)</span>
                        </div>
                      </div>
                    )}
                    
                    {/* ABC correction rules */}
                    {(displayPatternType === 'abc' || displayPatternType === 'zigzag' || displayPatternType === 'correction') && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave A establishes correction direction</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave B retraces 38.2-78.6% of Wave A</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave C extends beyond Wave A endpoint</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Flat correction rules */}
                    {displayPatternType === 'flat' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave A is a 3-wave structure</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave B retraces 90-138% of Wave A</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Wave C is approximately equal to Wave A in length</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Triangle rules */}
                    {displayPatternType === 'triangle' && (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Five overlapping waves (A-B-C-D-E)</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Each wave is smaller than the previous</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Trendlines converge toward apex</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {currentPoints.length >= 3 ? 'Validation will appear after pattern saves' : (selectedLabelId ? 'Loading validation...' : 'Place at least 3 points to see validation')}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fibonacci" className="mt-4">
            {validation?.fibonacciRatios && validation.fibonacciRatios.length > 0 ? (
              <div className="space-y-3">
                {validation.fibonacciRatios.map((fib, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00c4b4] font-medium">{fib.wave}</span>
                      <span className="text-gray-400 text-sm">Wave</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-lg ${
                        fib.quality === 'excellent' ? 'text-emerald-400' :
                        fib.quality === 'good' ? 'text-green-400' :
                        fib.quality === 'ok' ? 'text-yellow-400' :
                        fib.quality === 'valid' ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {fib.ratio.toFixed(1)}%
                      </span>
                      <Badge variant="outline" className={`text-xs ${
                        fib.quality === 'excellent' ? 'border-emerald-500 text-emerald-400' :
                        fib.quality === 'good' ? 'border-green-500 text-green-400' :
                        fib.quality === 'ok' ? 'border-yellow-500 text-yellow-400' :
                        fib.quality === 'valid' ? 'border-orange-500 text-orange-400' :
                        'border-red-500 text-red-400'
                      }`}>
                        {fib.quality}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Place at least 3 wave points to see Fibonacci analysis
              </div>
            )}
          </TabsContent>

          <TabsContent value="stack" className="mt-4">
            {/* Saved Projection Lines Manager */}
            {savedProjectionLinesFromDB.filter(l => l.symbol === symbol).length > 0 && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cyan-400">📍 Saved Target Lines ({savedProjectionLinesFromDB.filter(l => l.symbol === symbol).length})</span>
                  <button
                    onClick={() => {
                      // Delete all saved lines for this symbol
                      savedProjectionLinesFromDB
                        .filter(l => l.symbol === symbol)
                        .forEach(line => deleteProjectionLine.mutate(line.id));
                      setStackProjectionLines([]);
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    data-testid="delete-all-projection-lines"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedProjectionLinesFromDB
                    .filter(l => l.symbol === symbol)
                    .map(line => (
                      <div key={line.id} className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
                        <span className="text-xs font-mono" style={{ color: line.color }}>
                          {line.levelLabel}: ${line.price.toFixed(4)}
                        </span>
                        {line.alertEnabled && <Bell className="w-3 h-3 text-green-400" />}
                        <button
                          onClick={() => {
                            deleteProjectionLine.mutate(line.id);
                            setStackProjectionLines(prev => prev.filter(l => l.title !== line.levelLabel && l.title !== `🔔 ${line.levelLabel}`));
                          }}
                          className="ml-1 text-red-400 hover:text-red-300"
                          title="Delete this line"
                          data-testid={`delete-line-${line.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {waveStackEntries.length > 0 ? (
              <div className="space-y-4">
                {/* Cross-Degree Suggestion Banner */}
                {waveStackSuggestion && (
                  <div className={`rounded-lg p-3 border ${
                    waveStackSuggestion.confidence === 'high' 
                      ? 'bg-emerald-900/30 border-emerald-600' 
                      : waveStackSuggestion.confidence === 'medium'
                      ? 'bg-amber-900/30 border-amber-600'
                      : 'bg-slate-800/50 border-slate-600'
                  }`} data-testid="wave-stack-suggestion">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        waveStackSuggestion.confidence === 'high' 
                          ? 'text-emerald-400' 
                          : waveStackSuggestion.confidence === 'medium'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {waveStackSuggestion.suggestion}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Sequence: {waveStackSuggestion.sequence} | Confidence: {waveStackSuggestion.confidence}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Grouped Wave Structures - PURE HIERARCHICAL TREE */}
                {/* Only render ROOT structures (no parentId), children appear ONLY when parent entry is expanded */}
                <div className="space-y-3" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                  <div style={{ minWidth: '650px' }}>
                  {groupedStructures
                    .filter(s => !s.parentId) // Only root structures at top level
                    .map((structure) => {
                    const isExpanded = expandedStructures.has(structure.id);
                    const degreeColor = waveDegrees.find(d => d.name === structure.degree)?.color || '#74C0FC';
                    
                    return (
                      <div key={structure.id} className="rounded-lg border border-slate-700 overflow-hidden">
                        {/* Structure Header Row */}
                        <div 
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/50 transition-all min-w-max"
                          style={{ backgroundColor: `${degreeColor}15`, borderLeft: `3px solid ${degreeColor}` }}
                          onClick={() => toggleStructure(structure.id)}
                          data-testid={`structure-${structure.id}`}
                        >
                          {/* Expand/Collapse */}
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          
                          {/* Degree */}
                          <span className="font-medium text-sm" style={{ color: degreeColor }}>
                            {structure.degree}
                          </span>
                          
                          {/* Archetype Badge */}
                          <Badge variant="outline" className={`text-xs ${
                            structure.archetype === 'Impulse' ? 'border-emerald-500 text-emerald-400' :
                            structure.archetype.includes('WXY') ? 'border-amber-500 text-amber-400' :
                            structure.archetype === 'Zigzag' ? 'border-purple-500 text-purple-400' :
                            'border-gray-500 text-gray-400'
                          }`}>
                            {structure.archetype}
                          </Badge>
                          
                          {/* Completeness Status Badge */}
                          <Badge variant="outline" className={`text-xs ${
                            structure.isForming 
                              ? 'border-amber-500 text-amber-400 bg-amber-500/10' 
                              : 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                          }`}>
                            {structure.isForming ? 'Forming' : 'Complete'}
                          </Badge>
                          
                          {/* Forming Next Wave Badge - shows expected next wave when pattern is partial */}
                          {structure.isForming && structure.predictiveContext?.sourcePatternInfo && (
                            <Badge variant="outline" className="text-xs border-cyan-500 text-cyan-400 animate-pulse">
                              → {structure.predictiveContext.sourcePatternInfo.split(' ').slice(1).join(' ')}
                            </Badge>
                          )}
                          
                          {/* Sequence */}
                          <span className="font-mono text-xs text-gray-500">{structure.sequence}</span>
                          
                          {/* Direction */}
                          <span className={structure.direction === 'up' ? 'text-green-400' : 'text-red-400'}>
                            {structure.direction === 'up' ? '↑' : '↓'}
                          </span>
                          
                          {/* Validity Score */}
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-gray-400">{structure.percentMove.toFixed(1)}%</span>
                            <Badge variant="outline" className={`text-xs ${
                              structure.validityTier === 'excellent' ? 'border-emerald-500 text-emerald-400' :
                              structure.validityTier === 'good' ? 'border-green-500 text-green-400' :
                              structure.validityTier === 'fair' ? 'border-yellow-500 text-yellow-400' :
                              'border-red-500 text-red-400'
                            }`}>
                              {structure.cascadedScore ?? structure.validityScore}%
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Expanded: Recursive Wave Tree */}
                        {isExpanded && (
                          <div className="border-t border-slate-700">
                            {/* Render entries with recursive children */}
                            {structure.entries.map((entry, idx) => (
                              <WaveEntryRow
                                key={entry.id}
                                entry={entry}
                                parentStructure={structure}
                                entryIndex={idx}
                                allStructures={groupedStructures}
                                depth={0}
                                expandedEntries={expandedEntries}
                                toggleEntry={toggleEntry}
                                selectedLabelId={selectedLabelId}
                                setSelectedLabelId={setSelectedLabelId}
                                deleteLabel={deleteLabel}
                                updateLabel={updateLabel}
                                toast={toast}
                                waveDegrees={waveDegrees}
                                timeframe={timeframe}
                                setTimeframe={setTimeframe}
                              />
                            ))}
                            
                            {/* Predictive Projections for forming patterns */}
                            {structure.isForming && structure.predictiveContext && (
                              <div className="px-3 py-2 bg-cyan-900/20 border-t border-cyan-700/30">
                                {/* Check if this is a dual interpretation (W2/B or W3/C) */}
                                {(() => {
                                  const hasImpulseLevels = structure.predictiveContext!.levels.some(l => 
                                    l.label.startsWith('W2') || l.label.startsWith('W3') || l.label.startsWith('W5'));
                                  const hasCorrectionLevels = structure.predictiveContext!.levels.some(l => 
                                    l.label.startsWith('B') || l.label.startsWith('C') || l.label.startsWith('Y'));
                                  const isDualInterpretation = hasImpulseLevels && hasCorrectionLevels;
                                  
                                  // Determine which wave types are present for button labels
                                  const hasW2 = structure.predictiveContext!.levels.some(l => l.label.startsWith('W2'));
                                  const hasW3 = structure.predictiveContext!.levels.some(l => l.label.startsWith('W3'));
                                  const hasW5 = structure.predictiveContext!.levels.some(l => l.label.startsWith('W5'));
                                  const hasB = structure.predictiveContext!.levels.some(l => l.label.startsWith('B'));
                                  const hasC = structure.predictiveContext!.levels.some(l => l.label.startsWith('C'));
                                  const hasY = structure.predictiveContext!.levels.some(l => l.label.startsWith('Y'));
                                  
                                  const impulseLabel = hasW2 ? 'Wave 2' : hasW3 && hasW5 ? 'Wave 3/5' : hasW3 ? 'Wave 3' : 'Wave 5';
                                  const correctionLabel = hasB ? 'Wave B' : hasC && hasY ? 'Wave C/Y' : hasC ? 'Wave C' : 'Wave Y';
                                  const selectedType = selectedPredictionType[structure.id];
                                  
                                  // Filter levels based on selection
                                  const bWaveType = selectedBWaveType[structure.id];
                                  const filteredLevels = selectedType 
                                    ? structure.predictiveContext!.levels.filter(l => {
                                        if (selectedType === 'impulse') {
                                          return l.label.startsWith('W2') || l.label.startsWith('W3') || l.label.startsWith('W5');
                                        }
                                        // For correction with B wave type selected, filter by ratio
                                        if (l.label.startsWith('B ') && bWaveType) {
                                          // Extract ratio from label (e.g., "B 38%" -> 38)
                                          const ratioMatch = l.label.match(/(\d+)%/);
                                          if (ratioMatch) {
                                            const ratio = parseInt(ratioMatch[1]);
                                            // Flat: 88-138% (deep retracement to beyond origin)
                                            // Zigzag: 38-79% (shallow retracement)
                                            if (bWaveType === 'flat') {
                                              return ratio >= 88;
                                            } else if (bWaveType === 'zigzag') {
                                              return ratio <= 79;
                                            }
                                          }
                                        }
                                        return l.label.startsWith('B') || l.label.startsWith('C') || l.label.startsWith('Y');
                                      })
                                    : structure.predictiveContext!.levels;
                                  
                                  return (
                                    <>
                                      {/* Selection buttons for dual interpretations - always show as toggles */}
                                      {isDualInterpretation && (
                                        <div className="mb-3">
                                          <span className="text-xs text-amber-400 font-semibold mb-2 block">
                                            🔮 What are you predicting?
                                          </span>
                                          <div className="flex gap-2 flex-wrap items-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPredictionType(prev => ({
                                                  ...prev, 
                                                  [structure.id]: prev[structure.id] === 'impulse' ? null : 'impulse'
                                                }));
                                              }}
                                              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                                selectedType === 'impulse'
                                                  ? 'bg-cyan-600 text-white border-cyan-400 ring-2 ring-cyan-400/50'
                                                  : 'bg-cyan-700/40 text-cyan-300 border-cyan-500/50 hover:bg-cyan-600/50'
                                              }`}
                                              data-testid={`select-impulse-${structure.id}`}
                                            >
                                              ⚡ {impulseLabel} (Impulse)
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPredictionType(prev => ({
                                                  ...prev, 
                                                  [structure.id]: prev[structure.id] === 'correction' ? null : 'correction'
                                                }));
                                              }}
                                              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                                selectedType === 'correction'
                                                  ? 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-400/50'
                                                  : 'bg-amber-700/40 text-amber-300 border-amber-500/50 hover:bg-amber-600/50'
                                              }`}
                                              data-testid={`select-correction-${structure.id}`}
                                            >
                                              🔄 {correctionLabel} (Correction)
                                            </button>
                                            {/* Test Push Notification Button - enables notifications if needed, then sends test */}
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  // Check if notifications are supported
                                                  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                                                    toast({ title: 'Not Supported', description: 'Push notifications not supported on this device', variant: 'destructive' });
                                                    return;
                                                  }
                                                  
                                                  // Request permission if not granted
                                                  if (Notification.permission !== 'granted') {
                                                    const permission = await Notification.requestPermission();
                                                    if (permission !== 'granted') {
                                                      toast({ title: 'Permission Denied', description: 'Please allow notifications in browser settings', variant: 'destructive' });
                                                      return;
                                                    }
                                                  }
                                                  
                                                  // Register service worker if needed
                                                  let registration = await navigator.serviceWorker.getRegistration();
                                                  if (!registration) {
                                                    registration = await navigator.serviceWorker.register('/sw.js');
                                                    await navigator.serviceWorker.ready;
                                                  }
                                                  
                                                  // Fetch VAPID key from server
                                                  const vapidResponse = await fetch('/api/crypto/vapid-key');
                                                  if (!vapidResponse.ok) {
                                                    toast({ title: 'Config Error', description: 'Failed to get VAPID key', variant: 'destructive' });
                                                    return;
                                                  }
                                                  const { publicKey: vapidKey } = await vapidResponse.json();
                                                  if (!vapidKey) {
                                                    toast({ title: 'Config Error', description: 'VAPID key not configured', variant: 'destructive' });
                                                    return;
                                                  }
                                                  
                                                  // Convert VAPID key to Uint8Array
                                                  const padding = '='.repeat((4 - vapidKey.length % 4) % 4);
                                                  const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                                                  const rawData = window.atob(base64);
                                                  const vapidKeyArray = new Uint8Array(rawData.length);
                                                  for (let i = 0; i < rawData.length; ++i) {
                                                    vapidKeyArray[i] = rawData.charCodeAt(i);
                                                  }
                                                  
                                                  // Unsubscribe from old subscription (may have wrong VAPID key)
                                                  const oldSubscription = await registration.pushManager.getSubscription();
                                                  if (oldSubscription) {
                                                    await oldSubscription.unsubscribe();
                                                  }
                                                  
                                                  // Create new subscription with correct VAPID key
                                                  const subscription = await registration.pushManager.subscribe({
                                                    userVisibleOnly: true,
                                                    applicationServerKey: vapidKeyArray
                                                  });
                                                  
                                                  // Save subscription to server
                                                  const subJson = subscription.toJSON();
                                                  await authenticatedApiRequest('POST', '/api/crypto/push-subscribe', {
                                                    endpoint: subJson.endpoint,
                                                    p256dh: subJson.keys?.p256dh,
                                                    auth: subJson.keys?.auth
                                                  });
                                                  toast({ title: '✅ Notifications Enabled', description: 'Sending test...' });
                                                  
                                                  // Now send test push
                                                  const response = await authenticatedApiRequest('POST', '/api/crypto/test-push');
                                                  const result = await response.json();
                                                  if (result.success) {
                                                    toast({ title: '🔔 Test Sent!', description: 'Check your notifications' });
                                                  } else {
                                                    toast({ title: 'Test Failed', description: result.error || 'Unknown error', variant: 'destructive' });
                                                  }
                                                } catch (error: any) {
                                                  toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
                                                }
                                              }}
                                              className="px-3 py-1.5 rounded text-xs font-medium border bg-green-700/40 text-green-300 border-green-500/50 hover:bg-green-600/50 transition-all"
                                              data-testid="test-push-notification"
                                            >
                                              <Bell className="w-3 h-3 inline mr-1" />
                                              Test Push
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Secondary toggle for B wave type when correction is selected and hasB */}
                                      {selectedType === 'correction' && hasB && (
                                        <div className="mb-3 ml-4">
                                          <span className="text-xs text-purple-400 font-semibold mb-2 block">
                                            📐 What type of B wave?
                                          </span>
                                          <div className="flex gap-2 flex-wrap">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedBWaveType(prev => ({
                                                  ...prev,
                                                  [structure.id]: prev[structure.id] === 'flat' ? null : 'flat'
                                                }));
                                              }}
                                              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                                selectedBWaveType[structure.id] === 'flat'
                                                  ? 'bg-purple-600 text-white border-purple-400 ring-2 ring-purple-400/50'
                                                  : 'bg-purple-700/40 text-purple-300 border-purple-500/50 hover:bg-purple-600/50'
                                              }`}
                                              data-testid={`select-flat-${structure.id}`}
                                            >
                                              📊 Flat (88-138%)
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedBWaveType(prev => ({
                                                  ...prev,
                                                  [structure.id]: prev[structure.id] === 'zigzag' ? null : 'zigzag'
                                                }));
                                              }}
                                              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                                selectedBWaveType[structure.id] === 'zigzag'
                                                  ? 'bg-pink-600 text-white border-pink-400 ring-2 ring-pink-400/50'
                                                  : 'bg-pink-700/40 text-pink-300 border-pink-500/50 hover:bg-pink-600/50'
                                              }`}
                                              data-testid={`select-zigzag-${structure.id}`}
                                            >
                                              ⚡ Zigzag (50-78.6%)
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Show targets only after selection (for dual interpretation) or always for single options */}
                                      {(isDualInterpretation ? selectedType : true) && (
                                        <>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-cyan-400 font-semibold">
                                              📈 {selectedType === 'impulse' ? impulseLabel : selectedType === 'correction' ? correctionLabel : structure.expectedNextWave} Targets
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              (Click to add projection line)
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {filteredLevels.map((level, levelIdx) => {
                                              const savedLine = isProjectionSaved(structure.id, level.label, level.price);
                                              const isSaved = !!savedLine;
                                              const isAlertEnabled = savedLine?.alertEnabled || false;
                                              const isImpulse = level.label.startsWith('W');
                                              const lineColor = isImpulse ? '#00CED1' : '#FBBF24';
                                              
                                              return (
                                                <div key={levelIdx} className="flex items-center gap-0.5">
                                                  {/* Price target button - toggle save */}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const lineTitle = `${level.label}`;
                                                      
                                                      if (isSaved) {
                                                        // Delete from DB
                                                        deleteProjectionLine.mutate(savedLine.id);
                                                        // Remove from chart
                                                        setStackProjectionLines(prev => prev.filter(l => l.title !== lineTitle));
                                                      } else {
                                                        // Save to DB
                                                        saveProjectionLine.mutate({
                                                          symbol,
                                                          timeframe,
                                                          structureId: structure.id,
                                                          levelLabel: level.label,
                                                          price: level.price,
                                                          color: lineColor,
                                                          waveType: isImpulse ? 'impulse' : 'correction',
                                                        });
                                                        // Add to chart
                                                        setStackProjectionLines(prev => {
                                                          if (prev.some(l => l.title === lineTitle)) return prev;
                                                          return [...prev, {
                                                            price: level.price,
                                                            color: lineColor,
                                                            lineWidth: 1,
                                                            lineStyle: 2,
                                                            axisLabelVisible: true,
                                                            title: lineTitle,
                                                          }];
                                                        });
                                                      }
                                                    }}
                                                    className={`px-2 py-1 rounded-l text-xs font-mono transition-all hover:scale-105 ${
                                                      isSaved 
                                                        ? (isImpulse 
                                                            ? 'bg-cyan-600 text-white border border-cyan-400 ring-1 ring-cyan-400/50'
                                                            : 'bg-amber-600 text-white border border-amber-400 ring-1 ring-amber-400/50')
                                                        : (isImpulse 
                                                            ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-600/40'
                                                            : 'bg-amber-900/40 text-amber-400 border border-amber-600/40')
                                                    }`}
                                                    data-testid={`predictive-${structure.expectedNextWave}-${level.label}`}
                                                  >
                                                    {level.label}: ${level.price.toFixed(4)}
                                                  </button>
                                                  
                                                  {/* Alert toggle button - only show if saved */}
                                                  {isSaved && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleProjectionAlert.mutate({
                                                          id: savedLine.id,
                                                          alertEnabled: !isAlertEnabled,
                                                        });
                                                      }}
                                                      className={`px-1.5 py-1 rounded-r text-xs transition-all ${
                                                        isAlertEnabled
                                                          ? 'bg-green-600 text-white border border-green-400'
                                                          : 'bg-slate-700 text-gray-400 border border-slate-600 hover:bg-slate-600'
                                                      }`}
                                                      title={isAlertEnabled ? 'Alert enabled - click to disable' : 'Click to enable price alert'}
                                                      data-testid={`alert-${structure.expectedNextWave}-${level.label}`}
                                                    >
                                                      {isAlertEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                                                    </button>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center mt-2">
                  Grouped by degree. Click to expand. {symbol} patterns across all timeframes.
                </p>

              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p>No waves saved yet</p>
                <p className="text-xs mt-1">Draw and save patterns to build your wave stack</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            {hasElliottAIAccess ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Wave Analysis
                  </span>
                  {subscription?.monthlyUsage && subscription.monthlyUsage.elliottLimit > 0 && (
                    <span className="text-xs text-purple-400" data-testid="text-elliott-credits">
                      Elliott AI: {subscription.monthlyUsage.elliottLimit - subscription.monthlyUsage.elliottCredits} of {subscription.monthlyUsage.elliottLimit} remaining
                    </span>
                  )}
                </div>
                
                {(() => {
                  const selectedEntry = selectedLabelId ? waveStackEntries.find(e => e.id === selectedLabelId) : null;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        {selectedEntry ? 'Selected wave from Stack tab:' : 'Click a wave row in Stack tab to scope analysis, or analyze full stack:'}
                      </p>
                      {selectedEntry ? (
                        <div className="text-xs bg-cyan-900/30 border border-cyan-700/50 rounded p-2 flex items-center justify-between">
                          <div>
                            <span className="text-cyan-400">Analyzing: </span>
                            <span className="text-white font-medium">{selectedEntry.degree} {selectedEntry.patternType} {selectedEntry.waveCount}</span>
                            <span className="text-gray-400 ml-2">
                              ${selectedEntry.startPrice.toFixed(4)} → ${selectedEntry.endPrice.toFixed(4)}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedLabelId(null)}
                            className="text-xs text-gray-400 hover:text-white px-2"
                            data-testid="button-clear-wave-selection-ai"
                          >
                            ✕ Clear
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs bg-purple-900/30 border border-purple-700/50 rounded p-2">
                          <span className="text-purple-400">Mode: </span>
                          <span className="text-white font-medium">Full Stack Analysis</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                <Button
                  size="sm"
                  onClick={() => {
                    const selectedWave = selectedLabelId ? waveStackEntries.find(e => e.id === selectedLabelId) : null;
                    let pivotsToSend = calculatePivots(candles, 5);
                    let entriesToSend = waveStackEntries;
                    let priorWaveContext = null;
                    let scopedWaveInfo = null;
                    
                    if (selectedWave) {
                      scopedWaveInfo = { id: selectedWave.id, degree: selectedWave.degree, label: `${selectedWave.patternType} ${selectedWave.waveCount}`, startTime: selectedWave.startTime, endTime: selectedWave.endTime, startPrice: selectedWave.startPrice, endPrice: selectedWave.endPrice };
                      const waveDuration = selectedWave.endTime - selectedWave.startTime;
                      const timeTolerance = waveDuration * 0.1;
                      pivotsToSend = pivotsToSend.filter(p => p.time >= (selectedWave.startTime - timeTolerance) && p.time <= (selectedWave.endTime + timeTolerance));
                      entriesToSend = waveStackEntries.filter(e => { if (e.id === selectedWave.id) return false; const overlapStart = Math.max(e.startTime, selectedWave.startTime - timeTolerance); const overlapEnd = Math.min(e.endTime, selectedWave.endTime + timeTolerance); return overlapEnd > overlapStart; });
                      entriesToSend = [selectedWave, ...entriesToSend];
                      const sameDegreeWaves = waveStackEntries.filter(e => e.id !== selectedWave.id && e.degree === selectedWave.degree && e.endTime <= selectedWave.startTime + timeTolerance).sort((a, b) => b.endTime - a.endTime);
                      if (sameDegreeWaves.length > 0) {
                        const priorEntry = sameDegreeWaves[0];
                        priorWaveContext = { degree: priorEntry.degree, type: priorEntry.patternType, direction: priorEntry.direction, waveCount: priorEntry.waveCount, startPrice: priorEntry.startPrice, endPrice: priorEntry.endPrice, priceChange: ((priorEntry.endPrice - priorEntry.startPrice) / priorEntry.startPrice * 100).toFixed(2) };
                      }
                    }
                    grokStackAnalyze.mutate({ waveEntries: entriesToSend, symbol, pivots: pivotsToSend, scopedWave: scopedWaveInfo, priorWaveContext });
                  }}
                  disabled={grokStackAnalyze.isPending || waveStackEntries.length === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-xs"
                  data-testid="grok-analyze-stack-ai-tab"
                >
                  {grokStackAnalyze.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</> : <><Wand2 className="w-3 h-3 mr-1" /> {selectedLabelId && waveStackEntries.find(e => e.id === selectedLabelId) ? `Analyze ${waveStackEntries.find(e => e.id === selectedLabelId)?.degree.slice(0, 3)}` : 'Analyze Full Stack'}</>}
                </Button>

                {selectedLabelId && waveStackEntries.find(e => e.id === selectedLabelId) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const selectedWave = waveStackEntries.find(e => e.id === selectedLabelId);
                      if (!selectedWave) return;
                      const lowerTF = TIMEFRAME_HIERARCHY[timeframe] || timeframe;
                      const waveDuration = selectedWave.endTime - selectedWave.startTime;
                      const timeTolerance = waveDuration * 0.1;
                      const sameDegreeWaves = waveStackEntries.filter(e => e.id !== selectedWave.id && e.degree === selectedWave.degree && e.endTime <= selectedWave.startTime + timeTolerance).sort((a, b) => b.endTime - a.endTime);
                      const priorWaveContext = sameDegreeWaves.length > 0 ? { degree: sameDegreeWaves[0].degree, type: sameDegreeWaves[0].patternType, direction: sameDegreeWaves[0].direction, waveCount: sameDegreeWaves[0].waveCount, startPrice: sameDegreeWaves[0].startPrice, endPrice: sameDegreeWaves[0].endPrice, priceChange: ((sameDegreeWaves[0].endPrice - sameDegreeWaves[0].startPrice) / sameDegreeWaves[0].startPrice * 100).toFixed(2), durationHours: Math.round((sameDegreeWaves[0].endTime - sameDegreeWaves[0].startTime) / 3600) } : null;
                      detailedAnalyze.mutate({ selectedWave: { id: selectedWave.id, degree: selectedWave.degree, patternType: selectedWave.patternType, waveCount: selectedWave.waveCount, direction: selectedWave.direction, startTime: selectedWave.startTime, endTime: selectedWave.endTime, startPrice: selectedWave.startPrice, endPrice: selectedWave.endPrice, timeframe }, symbol, priorWaveContext });
                    }}
                    disabled={detailedAnalyze.isPending}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-xs"
                    data-testid="detailed-analysis-btn-ai-tab"
                  >
                    {detailedAnalyze.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing {TIMEFRAME_HIERARCHY[timeframe] || timeframe}...</> : <><Target className="w-3 h-3 mr-1" /> Detailed ({TIMEFRAME_HIERARCHY[timeframe] || timeframe})</>}
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    if (!chartRef.current) { toast({ title: 'Chart not ready', description: 'Please wait for chart to load', variant: 'destructive' }); return; }
                    const timeScale = chartRef.current.timeScale();
                    const visibleRange = timeScale.getVisibleRange();
                    if (!visibleRange) { toast({ title: 'Zoom required', description: 'Please zoom/pan the chart first', variant: 'destructive' }); return; }
                    const allCandles = candlesRef.current || candles;
                    const lastRealCandleTime = allCandles.length > 0 ? allCandles[allCandles.length - 1].time : 0;
                    const visibleCandles = allCandles.filter(c => c.time >= (visibleRange.from as number) && c.time <= Math.min((visibleRange.to as number), lastRealCandleTime));
                    if (visibleCandles.length < 10) { toast({ title: 'Not enough data', description: `Only ${visibleCandles.length} visible candles. Need at least 10.`, variant: 'destructive' }); return; }
                    const dynamicPivotLength = Math.max(3, Math.min(20, Math.floor(visibleCandles.length / 40)));
                    const pivotsToSend = calculatePivots(visibleCandles, dynamicPivotLength);
                    if (pivotsToSend.length < 3) { toast({ title: 'Not enough pivots', description: `Only ${pivotsToSend.length} pivots. Try zooming out.`, variant: 'destructive' }); return; }
                    const priceRange = { high: Math.max(...visibleCandles.map(c => c.high)), low: Math.min(...visibleCandles.map(c => c.low)), start: visibleCandles[0]?.close || 0, end: visibleCandles[visibleCandles.length - 1]?.close || 0 };
                    chartAnalyze.mutate({ symbol, timeframe, pivots: pivotsToSend, priceRange });
                  }}
                  disabled={chartAnalyze.isPending || candles.length === 0}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-xs"
                  data-testid="chart-analyze-btn-ai-tab"
                >
                  {chartAnalyze.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing Chart...</> : <><BarChart2 className="w-3 h-3 mr-1" /> Analyze Visible Chart</>}
                </Button>
                <p className="text-xs text-gray-500 text-center">Detect patterns from visible candles only (ignores your labels)</p>

                {chartAnalysis && (
                  <div className="space-y-3 bg-slate-800/50 rounded-lg p-3 border border-teal-700/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-teal-400">Chart Pattern Analysis</span>
                      <button onClick={() => setChartAnalysis(null)} className="text-xs text-gray-400 hover:text-white">Clear</button>
                    </div>
                    <div className="bg-teal-900/20 rounded p-3 border border-teal-600/30"><p className="text-sm text-gray-200">{chartAnalysis.synopsis}</p></div>
                    <div className="flex items-center justify-between bg-slate-700/50 rounded p-2">
                      <div><span className="text-xs text-gray-400">Best Fit:</span><span className="text-sm font-bold text-teal-300 ml-2">{chartAnalysis.bestFitPattern}</span></div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${chartAnalysis.direction === 'up' ? 'bg-green-600' : chartAnalysis.direction === 'down' ? 'bg-red-600' : 'bg-gray-600'}`}>{chartAnalysis.direction === 'up' ? '↑ UP' : chartAnalysis.direction === 'down' ? '↓ DOWN' : '↔ SIDEWAYS'}</span>
                        <span className="text-xs text-gray-400">{chartAnalysis.confidence}% conf</span>
                      </div>
                    </div>
                    {chartAnalysis.possiblePatterns.length > 0 && (<div className="space-y-1"><p className="text-xs font-medium text-purple-400">Possible Patterns:</p>{chartAnalysis.possiblePatterns.map((p: any, idx: number) => (<div key={idx} className="bg-slate-700/30 rounded p-2 text-xs"><div className="flex items-center justify-between"><span className="text-cyan-300 font-medium">{p.pattern}</span><span className="text-gray-400">{p.probability}%</span></div><p className="text-gray-400 mt-1">{p.reasoning}</p></div>))}</div>)}
                    {chartAnalysis.possibleOutcomes.length > 0 && (<div className="space-y-1"><p className="text-xs font-medium text-amber-400">Possible Outcomes:</p>{chartAnalysis.possibleOutcomes.map((o: any, idx: number) => (<div key={idx} className="bg-amber-900/20 rounded p-2 text-xs border border-amber-700/30"><p className="text-amber-300">{o.scenario}</p><p className="text-gray-300 mt-1">→ {o.nextMove}</p>{o.targets && o.targets.length > 0 && (<p className="text-green-400 mt-1">Targets: {o.targets.join(', ')}</p>)}</div>))}</div>)}
                  </div>
                )}

                {grokStackAnalysis && (() => {
                  const rawAnalysis = grokStackAnalysis.rawResponse ? (() => { try { return JSON.parse(grokStackAnalysis.rawResponse.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { return {}; } })() : {};
                  return (
                    <div className="space-y-3 bg-slate-800/50 rounded-lg p-3 border border-purple-700/30">
                      <div className="bg-purple-900/20 rounded p-3 border border-purple-600/30"><p className="text-sm text-gray-200">{rawAnalysis.synopsis || grokStackAnalysis.synopsis}</p></div>
                      {rawAnalysis.aiBestFit && rawAnalysis.aiBestFit.length > 0 && (<div className="overflow-x-auto"><p className="text-xs font-medium text-purple-400 mb-1">AI Best Fit Structure:</p><table className="w-full text-xs"><thead><tr className="text-gray-400 border-b border-slate-700"><th className="text-left py-1 px-1">#</th><th className="text-left py-1 px-1">Degree</th><th className="text-left py-1 px-1">Label</th><th className="text-left py-1 px-1">Dir</th><th className="text-left py-1 px-1">Reasoning</th></tr></thead><tbody>{rawAnalysis.aiBestFit.map((a: any, idx: number) => (<tr key={idx} className="border-b border-slate-800"><td className="py-1 px-1 text-gray-500 font-mono">{a.uiIndex}</td><td className="py-1 px-1 text-purple-300">{a.degree}</td><td className="py-1 px-1 text-cyan-300 font-medium">{a.suggestedLabel}</td><td className={`py-1 px-1 ${a.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>{a.direction === 'up' ? '↑' : '↓'}</td><td className="py-1 px-1 text-gray-400 text-xs">{a.reasoning}</td></tr>))}</tbody></table></div>)}
                      {rawAnalysis.comparison && rawAnalysis.comparison.length > 0 && (<div className="overflow-x-auto"><p className="text-xs font-medium text-cyan-400 mb-1">Your Labels vs AI Analysis:</p><table className="w-full text-xs"><thead><tr className="text-gray-400 border-b border-slate-700"><th className="text-left py-1 px-1">#</th><th className="text-left py-1 px-1">Your Label</th><th className="text-left py-1 px-1">AI Label</th><th className="text-center py-1 px-1">Match</th><th className="text-left py-1 px-1">Note</th></tr></thead><tbody>{rawAnalysis.comparison.map((c: any, idx: number) => (<tr key={idx} className={`border-b border-slate-800 ${c.match === false ? 'bg-yellow-900/20' : ''}`}><td className="py-1 px-1 text-gray-500 font-mono">{c.uiIndex}</td><td className="py-1 px-1 text-purple-300">{c.userLabel}</td><td className="py-1 px-1 text-cyan-300">{c.aiLabel}</td><td className={`py-1 px-1 text-center ${c.match ? 'text-green-400' : 'text-yellow-400'}`}>{c.match ? '✓' : '?'}</td><td className="py-1 px-1 text-gray-400 text-xs">{c.note}</td></tr>))}</tbody></table></div>)}
                      {rawAnalysis.priceIssues && rawAnalysis.priceIssues.length > 0 && (<div className="space-y-2"><p className="text-xs font-medium text-red-400">Price Relationship Issues:</p>{rawAnalysis.priceIssues.map((p: any, idx: number) => (<div key={idx} className={`rounded p-2 border text-xs ${p.severity === 'CRITICAL' ? 'bg-red-900/30 border-red-600/50' : 'bg-yellow-900/30 border-yellow-600/50'}`}><div className="flex items-center gap-2"><span className={`text-xs font-bold ${p.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`}>{p.severity}</span><span className="text-gray-300">{p.issue}</span></div></div>))}</div>)}
                      {rawAnalysis.prediction && (<div className="bg-cyan-900/20 rounded p-2 border border-cyan-600/30"><span className="text-xs text-cyan-400">Next: </span><span className="text-xs text-white font-medium">{rawAnalysis.prediction.nextMove}</span><span className="text-xs text-cyan-400 ml-2">{rawAnalysis.prediction.confidence}% conf</span>{rawAnalysis.prediction.targets && (<div className="mt-1 text-xs text-gray-400">Targets: {rawAnalysis.prediction.targets.join(', ')}</div>)}</div>)}
                      <button onClick={() => setGrokStackAnalysis(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear stack analysis</button>
                    </div>
                  );
                })()}

                {detailedAnalysis && (() => {
                  const rawAnalysis = detailedAnalysis.rawResponse ? (() => { try { return JSON.parse(detailedAnalysis.rawResponse.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { return {}; } })() : {};
                  return (
                    <div className="space-y-3 bg-slate-800/50 rounded-lg p-3 border border-amber-700/30">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-amber-400">Detailed Sub-Wave Analysis</span></div>
                      <div className="bg-amber-900/20 rounded p-3 border border-amber-600/30"><p className="text-sm text-gray-200">{rawAnalysis.synopsis || detailedAnalysis.synopsis}</p></div>
                      {rawAnalysis.subWaveBreakdown && rawAnalysis.subWaveBreakdown.length > 0 && (<div className="overflow-x-auto"><p className="text-xs font-medium text-amber-400 mb-1">Sub-Wave Breakdown:</p><table className="w-full text-xs"><thead><tr className="text-gray-400 border-b border-slate-700"><th className="text-left py-1 px-1">Sub-Wave</th><th className="text-left py-1 px-1">Type</th><th className="text-left py-1 px-1">Price</th><th className="text-left py-1 px-1">Fib%</th><th className="text-left py-1 px-1">Notes</th></tr></thead><tbody>{rawAnalysis.subWaveBreakdown.map((s: any, idx: number) => (<tr key={idx} className="border-b border-slate-800"><td className="py-1 px-1 text-amber-300 font-medium">{s.label}</td><td className="py-1 px-1 text-purple-300">{s.type}</td><td className="py-1 px-1 text-gray-300 font-mono text-xs">${s.startPrice?.toFixed(4)} → ${s.endPrice?.toFixed(4)}</td><td className="py-1 px-1 text-cyan-300">{s.fibPercent}%</td><td className="py-1 px-1 text-gray-400 text-xs">{s.notes}</td></tr>))}</tbody></table></div>)}
                      {rawAnalysis.internalStructure && (<div className="bg-purple-900/20 rounded p-2 border border-purple-600/30"><span className="text-xs text-purple-400">Internal Structure: </span><span className="text-xs text-white">{rawAnalysis.internalStructure}</span></div>)}
                      {rawAnalysis.alternateCount && (<div className="bg-slate-700/50 rounded p-2"><span className="text-xs text-gray-400">Alternate Count: </span><span className="text-xs text-cyan-300">{rawAnalysis.alternateCount}</span></div>)}
                      {rawAnalysis.prediction && (<div className="bg-cyan-900/20 rounded p-2 border border-cyan-600/30"><span className="text-xs text-cyan-400">Next: </span><span className="text-xs text-white font-medium">{rawAnalysis.prediction.nextMove}</span><span className="text-xs text-cyan-400 ml-2">{rawAnalysis.prediction.confidence}% conf</span>{rawAnalysis.prediction.targets && (<div className="mt-1 text-xs text-gray-400">Targets: {rawAnalysis.prediction.targets.join(', ')}</div>)}</div>)}
                      <button onClick={() => setDetailedAnalysis(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear detailed results</button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-slate-900/90 to-cyan-900/80" />
                <div className="relative text-center py-12 px-6">
                  <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-white">Sign in to access Elliott Wave AI analysis</p>
                  <p className="text-sm mt-2 text-gray-300">Create an account to unlock AI-powered wave analysis</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

      {/* Waves Usage Training Section */}
      <Card className="bg-slate-900/90 border-slate-700">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setWavesTrainingOpen(!wavesTrainingOpen)}>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2 text-cyan-400">
              <Wand2 className="w-5 h-5" />
              Waves Usage Guide
            </span>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${wavesTrainingOpen ? '' : '-rotate-90'}`} />
          </CardTitle>
        </CardHeader>
        {wavesTrainingOpen && (
          <CardContent className="space-y-4">
            {/* Fibonacci Mode */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                onClick={() => setFibModeGuideOpen(!fibModeGuideOpen)}
              >
                <span className="font-medium text-amber-400">Fibonacci Mode (M% / P%)</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fibModeGuideOpen ? '' : '-rotate-90'}`} />
              </div>
              {fibModeGuideOpen && (
                <div className="p-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-slate-700 text-white shrink-0">M%</Badge>
                    <span><strong>Measured Mode</strong> - Shows live Fibonacci % for each wave relative to Elliott Wave targets (e.g., W3 at 161.8% is ideal)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-700 text-white shrink-0">P%</Badge>
                    <span><strong>Projected Mode</strong> - Shows future target lines where waves typically complete. Snap your points to these Fib levels.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-gray-600 text-white shrink-0">Off</Badge>
                    <span>Hides all Fibonacci measurements and projections</span>
                  </div>
                </div>
              )}
            </div>

            {/* Wave Degrees */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                onClick={() => setDegreesGuideOpen(!degreesGuideOpen)}
              >
                <span className="font-medium text-amber-400">Wave Degrees</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${degreesGuideOpen ? '' : '-rotate-90'}`} />
              </div>
              {degreesGuideOpen && (
                <div className="p-3 text-sm text-gray-300">
                  <p className="mb-2">Each degree has a unique color. Use higher degrees for longer timeframes:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {waveDegrees.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs">{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawing Types */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                onClick={() => setDrawingTypesGuideOpen(!drawingTypesGuideOpen)}
              >
                <span className="font-medium text-amber-400">Drawing Types</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${drawingTypesGuideOpen ? '' : '-rotate-90'}`} />
              </div>
              {drawingTypesGuideOpen && (
                <div className="p-3 space-y-2 text-sm text-gray-300">
                  <div><strong className="text-emerald-400">Impulse (12345)</strong> - 5-wave motive pattern. W2: 50-61.8%, W3: 161.8%, W4: 38.2%, W5: 100%</div>
                  <div><strong className="text-amber-400">Correction (ABC)</strong> - 3-wave corrective. B: 38-78% (zigzag) or 90-138% (flat), C: 100-161.8%</div>
                  <div><strong className="text-purple-400">Triangle (ABCDE)</strong> - 5-wave sideways pattern with converging trendlines</div>
                  <div><strong className="text-cyan-400">Diagonal (12345)</strong> - Wedge pattern with overlapping waves, 66-81% retracements</div>
                </div>
              )}
            </div>

            {/* Point Placement */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                onClick={() => setPointPlacementGuideOpen(!pointPlacementGuideOpen)}
              >
                <span className="font-medium text-amber-400">Point Placement</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pointPlacementGuideOpen ? '' : '-rotate-90'}`} />
              </div>
              {pointPlacementGuideOpen && (
                <div className="p-3 space-y-2 text-sm text-gray-300">
                  <div><strong>Crosshair Mode</strong> - Precise placement using the crosshair cursor</div>
                  <div><strong>Tap/Touch Mode</strong> - Tap directly on candles to place wave points</div>
                  <div><strong>Projected Mode</strong> - Future points snap to Fib projection lines (shown as colored horizontal lines)</div>
                  <div className="text-cyan-400 mt-2">Price levels appear at bottom of screen showing each placed point's value</div>
                </div>
              )}
            </div>

            {/* Wave Stack */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer"
                onClick={() => setWaveStackGuideOpen(!waveStackGuideOpen)}
              >
                <span className="font-medium text-amber-400">Wave Stack</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${waveStackGuideOpen ? '' : '-rotate-90'}`} />
              </div>
              {waveStackGuideOpen && (
                <div className="p-3 space-y-2 text-sm text-gray-300">
                  <div><strong>Saved waves</strong> are organized into Stack folders grouped by degree</div>
                  <div>Each structure shows: Degree, Pattern Type (W1/A), Expected Next Wave (→ W2/B), Wave Count, Direction</div>
                  <div><strong>Validity Score</strong> - 0-100% based on how well the pattern matches Elliott Wave rules</div>
                  <div><strong>Saved Target Lines</strong> - Quick access to saved Fibonacci levels with prices</div>
                  <div className="pt-2 border-t border-slate-700 mt-2">
                    <strong className="text-cyan-400">Prediction Buttons:</strong>
                    <div className="mt-1">"What are you predicting?" suggests what wave comes next (Wave 2/Impulse or Wave B/Correction)</div>
                    <div>"Test Push" sends a test notification to verify alerts work</div>
                  </div>

                  <div className="pt-4 border-t border-slate-700 mt-4 space-y-6">
                    <h4 className="text-cyan-400 font-semibold text-base">Training Examples</h4>

                    <div className="space-y-3">
                      <h5 className="text-emerald-400 font-medium">1. Higher Degree Suggestion</h5>
                      <p className="text-gray-400 text-xs">When you complete a 5-wave impulse at one degree, the Wave Stack suggests the higher degree wave it belongs to (e.g., Intermediate 1/A).</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Chart: Intermediate impulse 12345</p>
                          <img src={trainingChartImpulse} alt="Chart showing Intermediate 12345 impulse pattern" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Stack: Shows "1/A + 2/B" with predictions</p>
                          <img src={trainingStackPrediction} alt="Wave Stack showing W1-W2 or A-B structure with predictions" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-emerald-400 font-medium">2. Lower Degree Breakdown (1 Deep)</h5>
                      <p className="text-gray-400 text-xs">The Wave Stack shows how lower degree patterns fit inside higher degree waves. Here Minor WXY correction forms inside Intermediate 2/B.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Chart: Minor ABC inside Intermediate 2/B</p>
                          <img src={trainingChart1Deep} alt="Chart showing Minor ABC correction inside Intermediate wave 2/B" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Stack: 1-deep hierarchy (Minor inside Intermediate)</p>
                          <img src={trainingStack1Deep} alt="Wave Stack showing 1-deep hierarchy with Minor inside Intermediate 2/B" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h5 className="text-emerald-400 font-medium">3. Full Hierarchy Tree (2 Deep)</h5>
                      <p className="text-gray-400 text-xs">Three degrees of waves visible: Intermediate → Minor WXY → Minute Zigzag with diagonal C wave. The Stack shows the complete nested structure.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Chart: 3 degrees visible on chart</p>
                          <img src={trainingChart2Deep} alt="Chart showing 3 degrees of Elliott Wave patterns" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500 text-xs">Stack: 2-deep hierarchy tree</p>
                          <img src={trainingStack2Deep} alt="Wave Stack showing 2-deep hierarchy with Minute Zigzag inside Minor Y" className="rounded-lg border border-slate-600 w-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>

      {/* Elliott Wave Reference Book Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="bg-slate-900/90 border-slate-700">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setTrainingManualOpen(!trainingManualOpen)}>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2 text-cyan-400">
                <TrendingUp className="w-5 h-5" />
                Elliott Wave Reference Book
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${trainingManualOpen ? '' : '-rotate-90'}`} />
            </CardTitle>
            <p className="text-sm text-gray-400">
              Learn to identify and label Elliott Wave patterns with visual examples
            </p>
          </CardHeader>
          {trainingManualOpen && (
          <CardContent className="space-y-8">
            
            {/* Impulse Pattern */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-emerald-400 mb-3">Impulse Wave (5-Wave Motive)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="h-56 relative flex items-center justify-center">
                    {/* Impulse with proper 5-3-5-3-5 structure and Fib ratios */}
                    {/* W1=base(30pts), W2=61.8%(18pts), W3=161.8%(49pts), W4=38.2%(19pts), W5=100%(30pts) */}
                    <svg viewBox="0 0 340 180" className="w-full h-full">
                      
                      {/* WAVE 1: 5 sub-waves UP from 160 to 130 (30pts) */}
                      {/* i */}
                      <line x1="10" y1="155" x2="10" y2="163" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="7" y="156" width="5" height="5" fill="#00b4d8" rx="1"/>
                      {/* ii */}
                      <line x1="17" y1="154" x2="17" y2="162" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="14" y="157" width="5" height="3" fill="#0077b6" rx="1"/>
                      {/* iii */}
                      <line x1="24" y1="145" x2="24" y2="158" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="21" y="147" width="5" height="8" fill="#00b4d8" rx="1"/>
                      {/* iv */}
                      <line x1="31" y1="148" x2="31" y2="155" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="28" y="150" width="5" height="3" fill="#0077b6" rx="1"/>
                      {/* v */}
                      <line x1="38" y1="138" x2="38" y2="152" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="35" y="140" width="5" height="9" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE 2: 3 sub-waves DOWN (61.8% = 18pts) from 130 to 148 */}
                      {/* a */}
                      <line x1="45" y1="145" x2="45" y2="158" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="42" y="148" width="5" height="7" fill="#0077b6" rx="1"/>
                      {/* b */}
                      <line x1="52" y1="145" x2="52" y2="155" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="49" y="147" width="5" height="5" fill="#00b4d8" rx="1"/>
                      {/* c */}
                      <line x1="59" y1="152" x2="59" y2="165" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="56" y="155" width="5" height="7" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE 3: 5 sub-waves UP (161.8% = 49pts) from 148 to 99 - LONGEST */}
                      {/* i */}
                      <line x1="66" y1="145" x2="66" y2="160" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="63" y="147" width="5" height="10" fill="#00b4d8" rx="1"/>
                      {/* ii */}
                      <line x1="73" y1="148" x2="73" y2="158" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="70" y="151" width="5" height="5" fill="#0077b6" rx="1"/>
                      {/* iii (extended - largest candles) */}
                      <line x1="80" y1="130" x2="80" y2="155" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="77" y="132" width="5" height="18" fill="#00b4d8" rx="1"/>

                      <line x1="87" y1="112" x2="87" y2="138" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="84" y="115" width="5" height="18" fill="#00b4d8" rx="1"/>
                      <line x1="94" y1="95" x2="94" y2="120" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="91" y="98" width="5" height="18" fill="#00b4d8" rx="1"/>
                      {/* iv */}
                      <line x1="101" y1="100" x2="101" y2="115" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="98" y="103" width="5" height="9" fill="#0077b6" rx="1"/>
                      {/* v */}
                      <line x1="108" y1="82" x2="108" y2="105" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="105" y="85" width="5" height="15" fill="#00b4d8" rx="1"/>
                      <line x1="115" y1="68" x2="115" y2="88" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="112" y="70" width="5" height="14" fill="#00b4d8" rx="1"/>
                      <line x1="122" y1="55" x2="122" y2="75" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="119" y="58" width="5" height="12" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE 4: 3 sub-waves DOWN (38.2% of W3 = 19pts) from 99 to 118 */}
                      {/* a */}
                      <line x1="129" y1="65" x2="129" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="126" y="68" width="5" height="11" fill="#0077b6" rx="1"/>
                      {/* b */}
                      <line x1="136" y1="62" x2="136" y2="75" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="133" y="65" width="5" height="7" fill="#00b4d8" rx="1"/>
                      {/* c */}
                      <line x1="143" y1="72" x2="143" y2="88" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="140" y="75" width="5" height="10" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE 5: 5 sub-waves UP (100% of W1 = 30pts) from 118 to 88 */}
                      {/* i */}
                      <line x1="150" y1="70" x2="150" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="147" y="72" width="5" height="7" fill="#00b4d8" rx="1"/>
                      {/* ii */}
                      <line x1="157" y1="73" x2="157" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="154" y="76" width="5" height="4" fill="#0077b6" rx="1"/>
                      {/* iii */}
                      <line x1="164" y1="58" x2="164" y2="78" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="161" y="60" width="5" height="14" fill="#00b4d8" rx="1"/>
                      <line x1="171" y1="48" x2="171" y2="65" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="168" y="50" width="5" height="12" fill="#00b4d8" rx="1"/>
                      {/* iv */}
                      <line x1="178" y1="52" x2="178" y2="62" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="175" y="55" width="5" height="5" fill="#0077b6" rx="1"/>
                      {/* v */}
                      <line x1="185" y1="42" x2="185" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="182" y="44" width="5" height="11" fill="#00b4d8" rx="1"/>
                      <line x1="192" y1="35" x2="192" y2="48" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="189" y="37" width="5" height="9" fill="#00b4d8" rx="1"/>
                      
                      {/* Wave labels at major pivots */}
                      <text x="5" y="175" fill="#00b4d8" fontSize="10" fontWeight="bold">0</text>
                      <text x="34" y="132" fill="#00b4d8" fontSize="10" fontWeight="bold">1</text>
                      <text x="54" y="175" fill="#fbbf24" fontSize="10" fontWeight="bold">2</text>
                      <text x="118" y="50" fill="#00b4d8" fontSize="10" fontWeight="bold">3</text>
                      <text x="138" y="95" fill="#fbbf24" fontSize="10" fontWeight="bold">4</text>
                      <text x="188" y="30" fill="#00b4d8" fontSize="10" fontWeight="bold">5</text>
                      
                      {/* Wave path connecting major pivots */}
                      <polyline points="10,160 38,140 59,162 122,58 143,85 192,37" fill="none" stroke="#00b4d8" strokeWidth="1.5" strokeDasharray="3" opacity="0.5"/>
                      
                      {/* Legend showing ratios */}
                      <text x="210" y="55" fill="#94a3b8" fontSize="7">W1: Base (5 waves)</text>
                      <text x="210" y="67" fill="#fbbf24" fontSize="7">W2: 61.8% (3 waves)</text>
                      <text x="210" y="79" fill="#00b4d8" fontSize="7">W3: 161.8% (5 waves)</text>
                      <text x="210" y="91" fill="#fbbf24" fontSize="7">W4: 38.2% (3 waves)</text>
                      <text x="210" y="103" fill="#00b4d8" fontSize="7">W5: 100% (5 waves)</text>
                      <text x="210" y="120" fill="#a855f7" fontSize="8" fontWeight="bold">5-3-5-3-5</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Impulse: 5-3-5-3-5 with W3=161.8%, W2=61.8%, W4=38.2%</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Rules</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li>Wave 2 never retraces more than 100% of Wave 1</li>
                      <li>Wave 3 is never the shortest motive wave</li>
                      <li>Wave 4 never enters Wave 1 territory</li>
                      <li>Waves 1, 3, 5 are motive (trend direction)</li>
                      <li>Waves 2, 4 are corrective (counter-trend)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Fibonacci Targets</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      <li><span className="text-yellow-400">Wave 2:</span> 50% - 61.8% of Wave 1</li>
                      <li><span className="text-cyan-400">Wave 3:</span> 161.8% - 261.8% of Wave 1</li>
                      <li><span className="text-yellow-400">Wave 4:</span> 38.2% - 50% of Wave 3</li>
                      <li><span className="text-cyan-400">Wave 5:</span> 61.8% - 100% of (W1+W3)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagonal Pattern */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Diagonal (Ending/Leading)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="h-56 relative flex items-center justify-center">
                    {/* Diagonal with proper Fib ratios and trendlines connecting 1-3 and 2-4 */}
                    <svg viewBox="0 0 320 180" className="w-full h-full">
                      
                      {/* WAVE 1: a-b-c UP from 155 to 120 */}
                      <line x1="12" y1="148" x2="12" y2="158" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="9" y="150" width="5" height="6" fill="#00b4d8" rx="1"/>
                      <line x1="19" y1="140" x2="19" y2="152" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="16" y="142" width="5" height="8" fill="#00b4d8" rx="1"/>
                      <line x1="26" y1="142" x2="26" y2="152" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="23" y="145" width="5" height="5" fill="#0077b6" rx="1"/>
                      <line x1="33" y1="130" x2="33" y2="148" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="30" y="132" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="40" y1="118" x2="40" y2="135" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="37" y="120" width="5" height="12" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE 2: a-b-c DOWN from 120 to 148 */}
                      <line x1="47" y1="125" x2="47" y2="138" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="44" y="127" width="5" height="9" fill="#0077b6" rx="1"/>
                      <line x1="54" y1="132" x2="54" y2="145" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="51" y="135" width="5" height="8" fill="#0077b6" rx="1"/>
                      <line x1="61" y1="128" x2="61" y2="140" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="58" y="130" width="5" height="7" fill="#00b4d8" rx="1"/>
                      <line x1="68" y1="138" x2="68" y2="152" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="65" y="140" width="5" height="9" fill="#0077b6" rx="1"/>
                      <line x1="75" y1="145" x2="75" y2="158" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="72" y="147" width="5" height="8" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE 3: a-b-c UP from 148 to 78 */}
                      <line x1="82" y1="132" x2="82" y2="150" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="79" y="134" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="89" y1="118" x2="89" y2="138" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="86" y="120" width="5" height="14" fill="#00b4d8" rx="1"/>
                      <line x1="96" y1="122" x2="96" y2="135" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="93" y="125" width="5" height="7" fill="#0077b6" rx="1"/>
                      <line x1="103" y1="105" x2="103" y2="128" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="100" y="108" width="5" height="15" fill="#00b4d8" rx="1"/>
                      <line x1="110" y1="88" x2="110" y2="112" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="107" y="90" width="5" height="18" fill="#00b4d8" rx="1"/>
                      <line x1="117" y1="72" x2="117" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="114" y="75" width="5" height="15" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE 4: a-b-c DOWN from 78 to 115 */}
                      <line x1="124" y1="82" x2="124" y2="98" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="121" y="85" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="131" y1="92" x2="131" y2="108" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="128" y="95" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="138" y1="88" x2="138" y2="102" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="135" y="90" width="5" height="8" fill="#00b4d8" rx="1"/>
                      <line x1="145" y1="98" x2="145" y2="115" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="142" y="100" width="5" height="12" fill="#0077b6" rx="1"/>
                      <line x1="152" y1="108" x2="152" y2="125" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="149" y="110" width="5" height="12" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE 5: a-b-c UP from 115 to 65 */}
                      <line x1="159" y1="100" x2="159" y2="118" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="156" y="102" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="166" y1="88" x2="166" y2="105" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="163" y="90" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="173" y1="92" x2="173" y2="105" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="170" y="94" width="5" height="8" fill="#0077b6" rx="1"/>
                      <line x1="180" y1="78" x2="180" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="177" y="80" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="187" y1="62" x2="187" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="184" y="65" width="5" height="14" fill="#00b4d8" rx="1"/>
                      
                      {/* Converging trendlines - connect 1-3 (upper) and 2-4 (lower) */}
                      {/* Upper: W1 top (40,120) to W3 top (117,75) extended */}
                      <line x1="40" y1="120" x2="200" y2="55" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4" opacity="0.7"/>
                      {/* Lower: W2 bottom (75,155) to W4 bottom (152,122) extended */}
                      <line x1="75" y1="155" x2="200" y2="105" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4" opacity="0.7"/>
                      
                      {/* Wave labels at pivots */}
                      <text x="6" y="168" fill="#00b4d8" fontSize="10" fontWeight="bold">0</text>
                      <text x="36" y="112" fill="#00b4d8" fontSize="10" fontWeight="bold">1</text>
                      <text x="70" y="168" fill="#fbbf24" fontSize="10" fontWeight="bold">2</text>
                      <text x="112" y="66" fill="#00b4d8" fontSize="10" fontWeight="bold">3</text>
                      <text x="147" y="132" fill="#fbbf24" fontSize="10" fontWeight="bold">4</text>
                      <text x="182" y="58" fill="#00b4d8" fontSize="10" fontWeight="bold">5</text>
                      
                      {/* Wave path connecting major pivots */}
                      <polyline points="12,155 40,120 75,155 117,75 152,122 187,65" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3" opacity="0.5"/>
                      
                      {/* Legend */}
                      <text x="205" y="80" fill="#94a3b8" fontSize="8">Each wave = a-b-c</text>
                      <text x="205" y="92" fill="#a855f7" fontSize="9" fontWeight="bold">3-3-3-3-3</text>
                      <text x="205" y="108" fill="#fbbf24" fontSize="7">1-3 line (upper)</text>
                      <text x="205" y="118" fill="#fbbf24" fontSize="7">2-4 line (lower)</text>
                      <text x="205" y="132" fill="#94a3b8" fontSize="7">W5 &lt; W3 &lt; W1</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Diagonal: Trendlines connect 1-3 and 2-4 (converging)</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Types & Positions</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li><span className="text-purple-400">Ending Diagonal:</span> Wave 5 or C (exhaustion)</li>
                      <li><span className="text-emerald-400">Leading Diagonal:</span> Wave 1 or A (new trend)</li>
                      <li><span className="text-gray-400">Contracting:</span> W5 &lt; W3 &lt; W1 (common)</li>
                      <li><span className="text-gray-400">Expanding:</span> W5 &gt; W3 &gt; W1 (rare)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Key Rules</h4>
                    <ul className="text-xs text-gray-300 space-y-0.5 list-disc list-inside">
                      <li>All 5 waves = 3-wave (a-b-c) structures</li>
                      <li>1-3 trendline connects W1 &amp; W3 tops</li>
                      <li>2-4 trendline connects W2 &amp; W4 bottoms</li>
                      <li>Wave 4 CAN enter Wave 1 territory</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Fibonacci Targets</h4>
                    <ul className="text-xs text-gray-300 space-y-0.5">
                      <li><span className="text-yellow-400">W2:</span> 50-88.6% of W1</li>
                      <li><span className="text-cyan-400">W3:</span> 61.8-161.8% of W1</li>
                      <li><span className="text-yellow-400">W4:</span> 50-78.6% of W3</li>
                      <li><span className="text-cyan-400">W5:</span> 38.2-123.6% of W3</li>
                    </ul>
                  </div>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded">
                    <p className="text-xs text-emerald-300"><span className="font-semibold">Wave 1 Diagonal:</span> Leading diagonal in W1 signals powerful new trend. Expect deep W2 (61.8-78.6%) then extended W3.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Zigzag Correction */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-orange-400 mb-3">Zigzag Correction (A-B-C)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="h-56 relative flex items-center justify-center">
                    {/* Zigzag with proper 5-3-5 internal structure */}
                    {/* A=5 waves down, B=3 waves up (50% retrace), C=5 waves down (100-161.8% of A) */}
                    <svg viewBox="0 0 280 180" className="w-full h-full">
                      
                      {/* Starting point 0 */}
                      <line x1="10" y1="18" x2="10" y2="28" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="7" y="20" width="5" height="5" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE A: 5 sub-waves DOWN from 20 to 110 (90pts) */}
                      {/* i */}
                      <line x1="17" y1="28" x2="17" y2="45" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="14" y="30" width="5" height="12" fill="#0077b6" rx="1"/>
                      {/* ii */}
                      <line x1="24" y1="32" x2="24" y2="42" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="21" y="34" width="5" height="5" fill="#00b4d8" rx="1"/>
                      {/* iii (extended - biggest move) */}
                      <line x1="31" y1="45" x2="31" y2="68" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="28" y="48" width="5" height="16" fill="#0077b6" rx="1"/>
                      <line x1="38" y1="62" x2="38" y2="85" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="35" y="65" width="5" height="16" fill="#0077b6" rx="1"/>
                      <line x1="45" y1="78" x2="45" y2="98" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="42" y="80" width="5" height="14" fill="#0077b6" rx="1"/>
                      {/* iv */}
                      <line x1="52" y1="85" x2="52" y2="98" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="49" y="87" width="5" height="8" fill="#00b4d8" rx="1"/>
                      {/* v */}
                      <line x1="59" y1="95" x2="59" y2="115" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="56" y="98" width="5" height="12" fill="#0077b6" rx="1"/>
                      <line x1="66" y1="108" x2="66" y2="128" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="63" y="110" width="5" height="14" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE B: 3 sub-waves UP (50% retrace = 45pts) from 110 to 65 */}
                      {/* a */}
                      <line x1="73" y1="95" x2="73" y2="118" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="70" y="98" width="5" height="15" fill="#00b4d8" rx="1"/>
                      <line x1="80" y1="82" x2="80" y2="102" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="77" y="85" width="5" height="12" fill="#00b4d8" rx="1"/>
                      {/* b */}
                      <line x1="87" y1="88" x2="87" y2="102" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="84" y="92" width="5" height="7" fill="#0077b6" rx="1"/>
                      {/* c */}
                      <line x1="94" y1="72" x2="94" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="91" y="75" width="5" height="15" fill="#00b4d8" rx="1"/>
                      <line x1="101" y1="58" x2="101" y2="78" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="98" y="60" width="5" height="14" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE C: 5 sub-waves DOWN (100% of A = 90pts) from 65 to 155 - LOWER than A */}
                      {/* i */}
                      <line x1="108" y1="72" x2="108" y2="92" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="105" y="75" width="5" height="13" fill="#0077b6" rx="1"/>
                      {/* ii */}
                      <line x1="115" y1="78" x2="115" y2="90" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="112" y="80" width="5" height="7" fill="#00b4d8" rx="1"/>
                      {/* iii (extended - biggest) */}
                      <line x1="122" y1="92" x2="122" y2="115" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="119" y="95" width="5" height="16" fill="#0077b6" rx="1"/>
                      <line x1="129" y1="108" x2="129" y2="132" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="126" y="110" width="5" height="18" fill="#0077b6" rx="1"/>
                      <line x1="136" y1="125" x2="136" y2="148" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="133" y="128" width="5" height="16" fill="#0077b6" rx="1"/>
                      {/* iv */}
                      <line x1="143" y1="135" x2="143" y2="150" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="140" y="138" width="5" height="8" fill="#00b4d8" rx="1"/>
                      {/* v */}
                      <line x1="150" y1="148" x2="150" y2="168" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="147" y="150" width="5" height="14" fill="#0077b6" rx="1"/>
                      <line x1="157" y1="158" x2="157" y2="175" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="154" y="160" width="5" height="12" fill="#0077b6" rx="1"/>
                      
                      {/* Wave labels */}
                      <text x="5" y="15" fill="#00b4d8" fontSize="10" fontWeight="bold">0</text>
                      <text x="62" y="138" fill="#ef4444" fontSize="10" fontWeight="bold">A</text>
                      <text x="96" y="52" fill="#fbbf24" fontSize="10" fontWeight="bold">B</text>
                      <text x="152" y="178" fill="#ef4444" fontSize="10" fontWeight="bold">C</text>
                      
                      {/* Wave path */}
                      <polyline points="10,20 66,124 101,60 157,172" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3" opacity="0.6"/>
                      
                      {/* Horizontal reference showing C lower than A */}
                      <line x1="60" y1="124" x2="165" y2="124" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2" opacity="0.4"/>
                      <text x="168" y="127" fill="#ef4444" fontSize="6" opacity="0.7">A level</text>
                      
                      {/* Legend */}
                      <text x="185" y="60" fill="#94a3b8" fontSize="7">A: 5 waves down</text>
                      <text x="185" y="72" fill="#fbbf24" fontSize="7">B: 3 waves (50%)</text>
                      <text x="185" y="84" fill="#94a3b8" fontSize="7">C: 5 waves down</text>
                      <text x="185" y="100" fill="#f97316" fontSize="8" fontWeight="bold">5-3-5</text>
                      <text x="185" y="115" fill="#ef4444" fontSize="6">C extends past A</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Zigzag: 5-3-5 with C extending beyond A</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Characteristics</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li>Sharp, impulsive move in Wave A</li>
                      <li>Wave B is typically shallow (38-62% of A)</li>
                      <li>Wave C often equals Wave A in length</li>
                      <li>Internal structure: 5-3-5</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Fibonacci Targets</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      <li><span className="text-yellow-400">Wave B:</span> 38.2% - 61.8% of Wave A</li>
                      <li><span className="text-red-400">Wave C:</span> 100% - 161.8% of Wave A</li>
                    </ul>
                  </div>
                  <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                    <p className="text-xs text-orange-300">Zigzags are the sharpest corrections. Often seen in Wave 2 positions.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Flat Correction */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">Flat Correction (A-B-C)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="h-56 relative flex items-center justify-center">
                    {/* Regular Flat with proper 3-3-5 internal structure */}
                    {/* A=3 waves, B=3 waves (deep 90-100%), C=5 waves ending at A level */}
                    <svg viewBox="0 0 280 160" className="w-full h-full">
                      
                      {/* Starting point 0 */}
                      <line x1="10" y1="28" x2="10" y2="38" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="7" y="30" width="5" height="5" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE A: 3 sub-waves (a-b-c) DOWN from 30 to 100 */}
                      {/* a down */}
                      <line x1="17" y1="40" x2="17" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="14" y="42" width="5" height="13" fill="#0077b6" rx="1"/>
                      <line x1="24" y1="52" x2="24" y2="72" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="21" y="55" width="5" height="14" fill="#0077b6" rx="1"/>
                      {/* b up */}
                      <line x1="31" y1="58" x2="31" y2="72" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="28" y="60" width="5" height="9" fill="#00b4d8" rx="1"/>
                      {/* c down */}
                      <line x1="38" y1="68" x2="38" y2="88" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="35" y="70" width="5" height="14" fill="#0077b6" rx="1"/>
                      <line x1="45" y1="82" x2="45" y2="105" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="42" y="85" width="5" height="16" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE B: 3 sub-waves (a-b-c) UP - deep retrace (90-100%) from 100 to ~35 */}
                      {/* a up */}
                      <line x1="52" y1="70" x2="52" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="49" y="72" width="5" height="18" fill="#00b4d8" rx="1"/>
                      <line x1="59" y1="55" x2="59" y2="78" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="56" y="58" width="5" height="16" fill="#00b4d8" rx="1"/>
                      {/* b down */}
                      <line x1="66" y1="62" x2="66" y2="78" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="63" y="65" width="5" height="10" fill="#0077b6" rx="1"/>
                      {/* c up - reaches near start */}
                      <line x1="73" y1="45" x2="73" y2="68" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="70" y="48" width="5" height="16" fill="#00b4d8" rx="1"/>
                      <line x1="80" y1="32" x2="80" y2="52" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="77" y="35" width="5" height="14" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE C: 5 sub-waves (i-ii-iii-iv-v) DOWN - ends at A level (~100) */}
                      {/* i */}
                      <line x1="87" y1="42" x2="87" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="84" y="45" width="5" height="10" fill="#0077b6" rx="1"/>
                      {/* ii */}
                      <line x1="94" y1="48" x2="94" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="91" y="50" width="5" height="5" fill="#00b4d8" rx="1"/>
                      {/* iii */}
                      <line x1="101" y1="55" x2="101" y2="72" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="98" y="58" width="5" height="11" fill="#0077b6" rx="1"/>
                      <line x1="108" y1="68" x2="108" y2="85" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="105" y="70" width="5" height="12" fill="#0077b6" rx="1"/>
                      {/* iv */}
                      <line x1="115" y1="75" x2="115" y2="85" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="112" y="77" width="5" height="5" fill="#00b4d8" rx="1"/>
                      {/* v - ends at A level */}
                      <line x1="122" y1="82" x2="122" y2="98" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="119" y="85" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="129" y1="92" x2="129" y2="105" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="126" y="95" width="5" height="7" fill="#0077b6" rx="1"/>
                      
                      {/* Wave labels */}
                      <text x="5" y="25" fill="#00b4d8" fontSize="10" fontWeight="bold">0</text>
                      <text x="40" y="115" fill="#ef4444" fontSize="10" fontWeight="bold">A</text>
                      <text x="76" y="28" fill="#fbbf24" fontSize="10" fontWeight="bold">B</text>
                      <text x="124" y="115" fill="#ef4444" fontSize="10" fontWeight="bold">C</text>
                      
                      {/* Wave path - C ends at same level as A */}
                      <polyline points="10,30 45,101 80,35 129,101" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3" opacity="0.6"/>
                      
                      {/* Horizontal reference lines showing "flat" nature */}
                      <line x1="5" y1="30" x2="90" y2="30" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2" opacity="0.4"/>
                      <text x="55" y="27" fill="#3b82f6" fontSize="6" opacity="0.6">0 level</text>
                      <line x1="5" y1="101" x2="145" y2="101" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="2" opacity="0.6"/>
                      <text x="55" y="98" fill="#ef4444" fontSize="6" opacity="0.6">A = C level</text>
                      
                      {/* 161% extension zone indicator */}
                      <line x1="5" y1="145" x2="145" y2="145" stroke="#f97316" strokeWidth="0.5" strokeDasharray="4" opacity="0.4"/>
                      <text x="55" y="142" fill="#f97316" fontSize="5" opacity="0.6">161% extension</text>
                      
                      {/* Legend */}
                      <text x="155" y="35" fill="#94a3b8" fontSize="7">A: 3 waves (a-b-c)</text>
                      <text x="155" y="47" fill="#fbbf24" fontSize="7">B: 3 waves (90-100%)</text>
                      <text x="155" y="59" fill="#94a3b8" fontSize="7">C: 5 waves (i-ii-iii-iv-v)</text>
                      <text x="155" y="75" fill="#3b82f6" fontSize="8" fontWeight="bold">REGULAR FLAT</text>
                      <text x="155" y="88" fill="#fbbf24" fontSize="6">B nearly reaches 0</text>
                      <text x="155" y="100" fill="#ef4444" fontSize="6">C = ~100% of A</text>
                      <text x="155" y="115" fill="#f97316" fontSize="6">Can extend to 161%</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Regular Flat: 3-3-5 with B near start, C ends at A level (can extend to 161%)</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Types of Flats</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li><span className="text-blue-400">Regular:</span> B ends near start of A, C ends near end of A</li>
                      <li><span className="text-yellow-400">Expanded:</span> B exceeds start of A, C exceeds end of A</li>
                      <li><span className="text-gray-400">Running:</span> B exceeds start of A, C doesn't reach end of A</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Fibonacci Targets</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      <li><span className="text-yellow-400">Wave B:</span> 78.6% - 138.2% of Wave A</li>
                      <li><span className="text-red-400">Wave C:</span> 100% - 161.8% of Wave A</li>
                    </ul>
                  </div>
                  <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                    <p className="text-xs text-blue-300">Flats are sideways corrections. Wave B nearly or fully retraces Wave A. Often in Wave 4.</p>
                  </div>
                </div>
              </div>

              {/* Flat Type Variants - Expanded and Running */}
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {/* Expanded Flat */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-2">Expanded Flat (3-3-5)</h4>
                  <div className="h-48 relative flex items-center justify-center">
                    <svg viewBox="0 0 240 160" className="w-full h-full">
                      {/* Starting point 0 */}
                      <line x1="10" y1="48" x2="10" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="7" y="50" width="5" height="5" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE A: 3 waves down (a-b-c) from 50 to 90 */}
                      <line x1="17" y1="58" x2="17" y2="72" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="14" y="60" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="24" y1="65" x2="24" y2="75" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="21" y="67" width="5" height="5" fill="#00b4d8" rx="1"/>
                      <line x1="31" y1="75" x2="31" y2="92" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="28" y="78" width="5" height="10" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE B: 3 waves UP - exceeds start (>100%) from 90 to 35 */}
                      <line x1="38" y1="68" x2="38" y2="88" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="35" y="70" width="5" height="14" fill="#00b4d8" rx="1"/>
                      <line x1="45" y1="55" x2="45" y2="72" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="42" y="58" width="5" height="10" fill="#00b4d8" rx="1"/>
                      <line x1="52" y1="48" x2="52" y2="60" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="49" y="50" width="5" height="7" fill="#0077b6" rx="1"/>
                      <line x1="59" y1="32" x2="59" y2="52" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="56" y="35" width="5" height="14" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE C: 5 waves DOWN - exceeds A (>100%) from 35 to 130 */}
                      <line x1="66" y1="45" x2="66" y2="60" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="63" y="48" width="5" height="9" fill="#0077b6" rx="1"/>
                      <line x1="73" y1="52" x2="73" y2="62" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="70" y="54" width="5" height="5" fill="#00b4d8" rx="1"/>
                      <line x1="80" y1="62" x2="80" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="77" y="65" width="5" height="13" fill="#0077b6" rx="1"/>
                      <line x1="87" y1="78" x2="87" y2="100" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="84" y="80" width="5" height="16" fill="#0077b6" rx="1"/>
                      <line x1="94" y1="95" x2="94" y2="118" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="91" y="98" width="5" height="16" fill="#0077b6" rx="1"/>
                      <line x1="101" y1="108" x2="101" y2="120" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="98" y="110" width="5" height="7" fill="#00b4d8" rx="1"/>
                      <line x1="108" y1="118" x2="108" y2="138" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="105" y="120" width="5" height="14" fill="#0077b6" rx="1"/>
                      
                      {/* Wave labels */}
                      <text x="5" y="45" fill="#00b4d8" fontSize="9" fontWeight="bold">0</text>
                      <text x="26" y="100" fill="#ef4444" fontSize="9" fontWeight="bold">A</text>
                      <text x="54" y="28" fill="#fbbf24" fontSize="9" fontWeight="bold">B</text>
                      <text x="103" y="148" fill="#ef4444" fontSize="9" fontWeight="bold">C</text>
                      
                      {/* Reference lines */}
                      <line x1="5" y1="50" x2="70" y2="50" stroke="#00b4d8" strokeWidth="0.5" strokeDasharray="2" opacity="0.5"/>
                      <text x="3" y="47" fill="#00b4d8" fontSize="5">0</text>
                      <line x1="5" y1="90" x2="115" y2="90" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2" opacity="0.5"/>
                      <text x="3" y="87" fill="#ef4444" fontSize="5">A</text>
                      
                      {/* Wave path */}
                      <polyline points="10,50 31,90 59,35 108,134" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3" opacity="0.6"/>
                      
                      {/* Legend */}
                      <text x="130" y="45" fill="#fbbf24" fontSize="8" fontWeight="bold">EXPANDED</text>
                      <text x="130" y="58" fill="#94a3b8" fontSize="6">{"B > 100% of A"}</text>
                      <text x="130" y="68" fill="#94a3b8" fontSize="6">{"C > 100% of A"}</text>
                      <text x="130" y="82" fill="#fbbf24" fontSize="7">B exceeds 0</text>
                      <text x="130" y="92" fill="#ef4444" fontSize="7">C exceeds A</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-1">B breaks above start, C breaks below A</p>
                </div>

                {/* Running Flat */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-gray-500/30">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Running Flat (3-3-5)</h4>
                  <div className="h-48 relative flex items-center justify-center">
                    <svg viewBox="0 0 240 160" className="w-full h-full">
                      {/* Starting point 0 */}
                      <line x1="10" y1="58" x2="10" y2="68" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="7" y="60" width="5" height="5" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE A: 3 waves down (a-b-c) from 60 to 100 */}
                      <line x1="17" y1="68" x2="17" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="14" y="70" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="24" y1="75" x2="24" y2="85" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="21" y="77" width="5" height="5" fill="#00b4d8" rx="1"/>
                      <line x1="31" y1="85" x2="31" y2="102" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="28" y="88" width="5" height="10" fill="#0077b6" rx="1"/>
                      
                      {/* WAVE B: 3 waves UP - exceeds start (>100%) from 100 to 40 */}
                      <line x1="38" y1="78" x2="38" y2="98" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="35" y="80" width="5" height="14" fill="#00b4d8" rx="1"/>
                      <line x1="45" y1="62" x2="45" y2="82" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="42" y="65" width="5" height="12" fill="#00b4d8" rx="1"/>
                      <line x1="52" y1="52" x2="52" y2="68" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="49" y="55" width="5" height="9" fill="#0077b6" rx="1"/>
                      <line x1="59" y1="38" x2="59" y2="58" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="56" y="40" width="5" height="14" fill="#00b4d8" rx="1"/>
                      
                      {/* WAVE C: 5 waves DOWN - does NOT reach A from 40 to 85 */}
                      <line x1="66" y1="48" x2="66" y2="62" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="63" y="50" width="5" height="9" fill="#0077b6" rx="1"/>
                      <line x1="73" y1="55" x2="73" y2="65" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="70" y="57" width="5" height="5" fill="#00b4d8" rx="1"/>
                      <line x1="80" y1="62" x2="80" y2="78" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="77" y="65" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="87" y1="72" x2="87" y2="88" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="84" y="75" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="94" y1="80" x2="94" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="91" y="82" width="5" height="10" fill="#0077b6" rx="1"/>
                      <line x1="101" y1="85" x2="101" y2="95" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="98" y="87" width="5" height="5" fill="#00b4d8" rx="1"/>
                      <line x1="108" y1="88" x2="108" y2="100" stroke="#0077b6" strokeWidth="1"/>
                      <rect x="105" y="90" width="5" height="7" fill="#0077b6" rx="1"/>
                      
                      {/* Wave labels */}
                      <text x="5" y="55" fill="#00b4d8" fontSize="9" fontWeight="bold">0</text>
                      <text x="26" y="110" fill="#ef4444" fontSize="9" fontWeight="bold">A</text>
                      <text x="54" y="33" fill="#fbbf24" fontSize="9" fontWeight="bold">B</text>
                      <text x="103" y="108" fill="#ef4444" fontSize="9" fontWeight="bold">C</text>
                      
                      {/* Reference lines */}
                      <line x1="5" y1="60" x2="70" y2="60" stroke="#00b4d8" strokeWidth="0.5" strokeDasharray="2" opacity="0.5"/>
                      <text x="3" y="57" fill="#00b4d8" fontSize="5">0</text>
                      <line x1="5" y1="100" x2="115" y2="100" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2" opacity="0.5"/>
                      <text x="3" y="97" fill="#ef4444" fontSize="5">A</text>
                      
                      {/* Wave path - C stays above A level */}
                      <polyline points="10,60 31,100 59,40 108,97" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3" opacity="0.6"/>
                      
                      {/* Legend */}
                      <text x="130" y="45" fill="#94a3b8" fontSize="8" fontWeight="bold">RUNNING</text>
                      <text x="130" y="58" fill="#94a3b8" fontSize="6">{"B > 100% of A"}</text>
                      <text x="130" y="68" fill="#22c55e" fontSize="6">{"C < 100% of A"}</text>
                      <text x="130" y="82" fill="#fbbf24" fontSize="7">B exceeds 0</text>
                      <text x="130" y="92" fill="#22c55e" fontSize="7">C fails to reach A</text>
                      <text x="130" y="108" fill="#60a5fa" fontSize="6">Strong trend signal</text>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-1">B breaks start, C fails to reach A (bullish)</p>
                </div>
              </div>
            </div>

            {/* Triangle Pattern */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-teal-400 mb-3">Triangle (A-B-C-D-E)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="h-48 relative flex items-center justify-center">
                    {/* Visual triangle using SVG with blue simulated candles */}
                    <svg viewBox="0 0 220 140" className="w-full h-full">
                      {/* Converging trendlines */}
                      <line x1="10" y1="20" x2="200" y2="55" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4" opacity="0.5"/>
                      <line x1="10" y1="120" x2="200" y2="85" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4" opacity="0.5"/>
                      {/* Wave 0 - Starting point */}
                      <rect x="15" y="15" width="5" height="25" fill="#00b4d8" rx="1"/>
                      {/* Wave A - Down */}
                      <rect x="25" y="35" width="5" height="30" fill="#0077b6" rx="1"/>
                      <rect x="33" y="55" width="5" height="35" fill="#0077b6" rx="1"/>
                      <rect x="41" y="75" width="5" height="35" fill="#0077b6" rx="1"/>
                      {/* Wave B - Up */}
                      <rect x="51" y="55" width="5" height="35" fill="#00b4d8" rx="1"/>
                      <rect x="59" y="35" width="5" height="30" fill="#00b4d8" rx="1"/>
                      <rect x="67" y="25" width="5" height="25" fill="#00b4d8" rx="1"/>
                      {/* Wave C - Down (smaller) */}
                      <rect x="77" y="45" width="5" height="30" fill="#0077b6" rx="1"/>
                      <rect x="85" y="60" width="5" height="30" fill="#0077b6" rx="1"/>
                      <rect x="93" y="70" width="5" height="25" fill="#0077b6" rx="1"/>
                      {/* Wave D - Up (smaller) */}
                      <rect x="103" y="55" width="5" height="25" fill="#00b4d8" rx="1"/>
                      <rect x="111" y="42" width="5" height="25" fill="#00b4d8" rx="1"/>
                      <rect x="119" y="35" width="5" height="20" fill="#00b4d8" rx="1"/>
                      {/* Wave E - Down (smallest) */}
                      <rect x="129" y="50" width="5" height="22" fill="#0077b6" rx="1"/>
                      <rect x="137" y="58" width="5" height="20" fill="#0077b6" rx="1"/>
                      <rect x="145" y="65" width="5" height="18" fill="#0077b6" rx="1"/>
                      {/* Wave labels */}
                      <text x="13" y="10" fill="#00b4d8" fontSize="11" fontWeight="bold">0</text>
                      <text x="39" y="120" fill="#ef4444" fontSize="11" fontWeight="bold">A</text>
                      <text x="65" y="18" fill="#fbbf24" fontSize="11" fontWeight="bold">B</text>
                      <text x="91" y="105" fill="#ef4444" fontSize="11" fontWeight="bold">C</text>
                      <text x="117" y="28" fill="#fbbf24" fontSize="11" fontWeight="bold">D</text>
                      <text x="143" y="93" fill="#ef4444" fontSize="11" fontWeight="bold">E</text>
                      {/* Wave path */}
                      <polyline points="18,15 44,110 70,25 96,95 122,35 148,83" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="3" opacity="0.7"/>
                    </svg>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-2">Contracting Triangle: Each wave smaller (Blue = Projected Candles)</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Characteristics</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li>5 waves labeled A-B-C-D-E</li>
                      <li>Each wave is a 3-wave correction</li>
                      <li>Only appears in Wave 4 or Wave B positions</li>
                      <li>Trendlines converge (contracting) or diverge (expanding)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">Fibonacci Targets</h4>
                    <ul className="text-xs text-gray-300 space-y-1">
                      <li><span className="text-yellow-400">Wave B:</span> 50% - 85% of Wave A</li>
                      <li><span className="text-red-400">Wave C:</span> 50% - 85% of Wave B</li>
                      <li><span className="text-yellow-400">Wave D:</span> 50% - 85% of Wave C</li>
                      <li><span className="text-red-400">Wave E:</span> 50% - 85% of Wave D</li>
                    </ul>
                  </div>
                  <div className="p-2 bg-teal-500/10 border border-teal-500/30 rounded">
                    <p className="text-xs text-teal-300">Triangles show decreasing momentum. After E, expect a thrust in the direction of the larger trend.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Complex Corrections - Double & Triple Patterns */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Complex Corrections (W-X-Y / W-X-Y-X-Z)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-purple-300 mb-2">Double Zigzag (W-X-Y)</h4>
                    <div className="h-64 relative flex items-center justify-center mb-2">
                      <svg viewBox="0 0 400 180" className="w-full h-full">
                        {/* Starting point */}
                        <line x1="8" y1="8" x2="8" y2="18" stroke="#0077b6" strokeWidth="1"/>
                        <rect x="5" y="10" width="4" height="4" fill="#00b4d8" rx="1"/>
                        
                        {/* ========== W ZIGZAG (5-3-5) ========== */}
                        {/* W-A wave (8 candles - impulsive down) */}
                        <rect x="12" y="18" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="18" y="26" width="4" height="10" fill="#0077b6" rx="1"/>
                        <rect x="24" y="32" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="30" y="36" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="36" y="46" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="42" y="54" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="48" y="58" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="54" y="68" width="4" height="12" fill="#0077b6" rx="1"/>
                        
                        {/* W-B wave (5 candles - corrective up) */}
                        <rect x="60" y="62" width="4" height="14" fill="#00b4d8" rx="1"/>
                        <rect x="66" y="52" width="4" height="12" fill="#00b4d8" rx="1"/>
                        <rect x="72" y="56" width="4" height="6" fill="#0077b6" rx="1"/>
                        <rect x="78" y="46" width="4" height="12" fill="#00b4d8" rx="1"/>
                        <rect x="84" y="38" width="4" height="10" fill="#00b4d8" rx="1"/>
                        
                        {/* W-C wave (8 candles - impulsive down) */}
                        <rect x="90" y="46" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="96" y="56" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="102" y="64" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="108" y="68" width="4" height="16" fill="#0077b6" rx="1"/>
                        <rect x="114" y="80" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="120" y="90" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="126" y="94" width="4" height="16" fill="#0077b6" rx="1"/>
                        <rect x="132" y="106" width="4" height="14" fill="#0077b6" rx="1"/>
                        
                        {/* W sub-labels - larger and clearer */}
                        <text x="50" y="90" fill="#ef4444" fontSize="9" fontWeight="bold">A</text>
                        <text x="80" y="32" fill="#fbbf24" fontSize="9" fontWeight="bold">B</text>
                        <text x="128" y="130" fill="#ef4444" fontSize="9" fontWeight="bold">C</text>
                        
                        {/* ========== X WAVE (connector - 8 candles up with a-b-c structure) ========== */}
                        {/* X-a up */}
                        <rect x="138" y="100" width="4" height="16" fill="#00b4d8" rx="1"/>
                        <rect x="144" y="86" width="4" height="16" fill="#00b4d8" rx="1"/>
                        <rect x="150" y="74" width="4" height="14" fill="#00b4d8" rx="1"/>
                        {/* X-b down */}
                        <rect x="156" y="78" width="4" height="10" fill="#0077b6" rx="1"/>
                        <rect x="162" y="84" width="4" height="8" fill="#0077b6" rx="1"/>
                        {/* X-c up */}
                        <rect x="168" y="72" width="4" height="14" fill="#00b4d8" rx="1"/>
                        <rect x="174" y="60" width="4" height="14" fill="#00b4d8" rx="1"/>
                        <rect x="180" y="50" width="4" height="12" fill="#00b4d8" rx="1"/>
                        
                        {/* ========== Y ZIGZAG (5-3-5) ========== */}
                        {/* Y-A wave (8 candles - impulsive down) */}
                        <rect x="186" y="58" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="192" y="66" width="4" height="10" fill="#0077b6" rx="1"/>
                        <rect x="198" y="72" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="204" y="76" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="210" y="86" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="216" y="94" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="222" y="98" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="228" y="108" width="4" height="12" fill="#0077b6" rx="1"/>
                        
                        {/* Y-B wave (5 candles - corrective up) */}
                        <rect x="234" y="102" width="4" height="14" fill="#00b4d8" rx="1"/>
                        <rect x="240" y="92" width="4" height="12" fill="#00b4d8" rx="1"/>
                        <rect x="246" y="96" width="4" height="6" fill="#0077b6" rx="1"/>
                        <rect x="252" y="86" width="4" height="12" fill="#00b4d8" rx="1"/>
                        <rect x="258" y="78" width="4" height="10" fill="#00b4d8" rx="1"/>
                        
                        {/* Y-C wave (8 candles - impulsive down) */}
                        <rect x="264" y="86" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="270" y="96" width="4" height="12" fill="#0077b6" rx="1"/>
                        <rect x="276" y="104" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="282" y="108" width="4" height="16" fill="#0077b6" rx="1"/>
                        <rect x="288" y="120" width="4" height="14" fill="#0077b6" rx="1"/>
                        <rect x="294" y="130" width="4" height="6" fill="#00b4d8" rx="1"/>
                        <rect x="300" y="134" width="4" height="16" fill="#0077b6" rx="1"/>
                        <rect x="306" y="146" width="4" height="14" fill="#0077b6" rx="1"/>
                        
                        {/* Y sub-labels - larger and clearer */}
                        <text x="224" y="128" fill="#ef4444" fontSize="9" fontWeight="bold">A</text>
                        <text x="254" y="72" fill="#fbbf24" fontSize="9" fontWeight="bold">B</text>
                        <text x="302" y="170" fill="#ef4444" fontSize="9" fontWeight="bold">C</text>
                        
                        {/* Main W-X-Y Labels - positioned at end points */}
                        <text x="75" y="135" fill="#f97316" fontSize="14" fontWeight="bold">W</text>
                        <text x="175" y="42" fill="#fbbf24" fontSize="12" fontWeight="bold">X</text>
                        <text x="248" y="170" fill="#f97316" fontSize="14" fontWeight="bold">Y</text>
                        
                        {/* Wave path - connects end points */}
                        <polyline points="8,10 134,120 182,50 308,160" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3" opacity="0.7"/>
                        
                        {/* Legend */}
                        <text x="310" y="30" fill="#94a3b8" fontSize="8">W = Zigzag (5-3-5)</text>
                        <text x="310" y="45" fill="#fbbf24" fontSize="8">X = Connector (3)</text>
                        <text x="310" y="60" fill="#94a3b8" fontSize="8">Y = Zigzag (5-3-5)</text>
                        <text x="310" y="85" fill="#a855f7" fontSize="8" fontWeight="bold">Used when single</text>
                        <text x="310" y="100" fill="#a855f7" fontSize="8" fontWeight="bold">zigzag too shallow</text>
                        <text x="310" y="125" fill="#ef4444" fontSize="7">A,C = 5 waves each</text>
                        <text x="310" y="140" fill="#fbbf24" fontSize="7">B = 3 waves</text>
                        <text x="310" y="160" fill="#94a3b8" fontSize="6">Each zigzag = 13 waves</text>
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400">Two zigzags connected by X wave. Each zigzag shows clear A-B-C (5-3-5) internal structure.</p>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-purple-300 mb-2">Triple Zigzag (W-X-Y-X-Z)</h4>
                    <p className="text-xs text-gray-300 mb-2">Three zigzags connected by two X waves. Very rare - occurs when even double zigzag doesn't complete the correction.</p>
                    <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                      <li>W, Y, Z = Three separate zigzags (each 5-3-5)</li>
                      <li>X waves = Connectors (each is 3-wave pattern)</li>
                      <li>Creates extended sideways correction</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-indigo-300 mb-2">Combination (Double Three)</h4>
                    <p className="text-xs text-gray-300 mb-2">Mix of different correction types connected by X waves:</p>
                    <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                      <li><span className="text-orange-400">Zigzag + Flat:</span> Sharp move then sideways</li>
                      <li><span className="text-blue-400">Flat + Zigzag:</span> Sideways then sharp move</li>
                      <li><span className="text-teal-400">Zigzag + Triangle:</span> Sharp then contracting</li>
                      <li><span className="text-purple-400">Flat + Triangle:</span> Sideways then contracting</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                    <h4 className="text-sm font-medium text-purple-300 mb-2">Key Rules for Complex Corrections</h4>
                    <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                      <li>Maximum of 3 simple patterns (W-X-Y-X-Z)</li>
                      <li>X waves are always 3-wave structures</li>
                      <li>Triangle can only appear as final pattern (Y or Z)</li>
                      <li>Each W/Y/Z must be a complete correction</li>
                      <li>Complex corrections = extended time, not necessarily price</li>
                    </ul>
                  </div>

                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded">
                    <p className="text-xs text-indigo-300">Complex corrections often form in Wave 4 positions or in B waves of larger patterns. They indicate indecision and are common in ranging markets.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ABC Summary Reference */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">ABC Correction Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded p-3 border border-orange-500/30">
                  <h4 className="text-sm font-semibold text-orange-400">Zigzag</h4>
                  <p className="text-xs text-gray-300 mt-1">5-3-5 structure</p>
                  <p className="text-xs text-gray-400">Sharp, impulsive A</p>
                  <p className="text-xs text-gray-400">B: 38-78% retrace</p>
                  <p className="text-xs text-gray-400">C extends past A</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3 border border-blue-500/30">
                  <h4 className="text-sm font-semibold text-blue-400">Regular Flat</h4>
                  <p className="text-xs text-gray-300 mt-1">3-3-5 structure</p>
                  <p className="text-xs text-gray-400">B: 90-100% of A</p>
                  <p className="text-xs text-gray-400">C: ~100% of A</p>
                  <p className="text-xs text-gray-400">Sideways pattern</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3 border border-yellow-500/30">
                  <h4 className="text-sm font-semibold text-yellow-400">Expanded Flat</h4>
                  <p className="text-xs text-gray-300 mt-1">3-3-5 structure</p>
                  <p className="text-xs text-gray-400">{"B > 100% of A"}</p>
                  <p className="text-xs text-gray-400">{"C > 100% of A"}</p>
                  <p className="text-xs text-gray-400">B exceeds start</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3 border border-gray-500/30">
                  <h4 className="text-sm font-semibold text-gray-300">Running Flat</h4>
                  <p className="text-xs text-gray-300 mt-1">3-3-5 structure</p>
                  <p className="text-xs text-gray-400">{"B > 100% of A"}</p>
                  <p className="text-xs text-gray-400">{"C < 100% of A"}</p>
                  <p className="text-xs text-gray-400">Strong trend signal</p>
                </div>
              </div>
            </div>

            {/* Feature Guide */}
            <div className="border border-cyan-500/30 rounded-lg p-4 bg-cyan-500/5">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Using the Elliott Wave Tools</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-emerald-400" /> Drawing Waves
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Select pattern type (Impulse, Correction, etc.)</li>
                    <li>Click "Draw" to enter drawing mode</li>
                    <li>Tap candle wicks to place points</li>
                    <li>Points auto-snap to high/low</li>
                    <li>Long-press to pan (won't place markers)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <MousePointer2 className="w-4 h-4 text-yellow-400" /> Editing & Selecting
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Click "Select" to enter selection mode</li>
                    <li>Tap a pattern to select it</li>
                    <li>Drag any point to reposition</li>
                    <li>Drop on future area for projections</li>
                    <li>Blue candles simulate future waves</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" /> Fibonacci Modes
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li><span className="text-cyan-400">M%:</span> Measured - shows actual Fib ratios</li>
                    <li><span className="text-purple-400">Proj:</span> Projected - shows target lines</li>
                    <li>Click on Fib lines to snap points</li>
                    <li>Validation panel shows rating quality</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Validation Ratings
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li><span className="text-emerald-400">Excellent:</span> Within 2% of ideal target</li>
                    <li><span className="text-green-400">Good:</span> Within 4% of ideal target</li>
                    <li><span className="text-yellow-400">OK:</span> Within 6% of ideal target</li>
                    <li><span className="text-blue-400">Valid:</span> Within allowed range</li>
                    <li><span className="text-red-400">Poor:</span> Outside valid range</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-cyan-400" /> AI Analysis
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>Click "AI Auto" for automatic analysis</li>
                    <li>AI identifies patterns on the chart</li>
                    <li>Provides confidence score</li>
                    <li>Suggests alternative counts</li>
                    <li>Highlights risk factors</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" /> Wave Degrees
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                    <li>9 degrees from Grand Supercycle to Subminuette</li>
                    <li>Each degree has unique color coding</li>
                    <li>Higher degrees = longer timeframes</li>
                    <li>Nest patterns within larger degrees</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Reference Table */}
            <div className="border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Reference: Fibonacci Ratios</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-2 px-2 text-gray-400">Pattern</th>
                      <th className="text-left py-2 px-2 text-gray-400">Wave</th>
                      <th className="text-left py-2 px-2 text-gray-400">Ideal Target</th>
                      <th className="text-left py-2 px-2 text-gray-400">Valid Range</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2 text-emerald-400" rowSpan={4}>Impulse</td>
                      <td className="py-2 px-2">Wave 2</td>
                      <td className="py-2 px-2">50% - 61.8%</td>
                      <td className="py-2 px-2">38.2% - 78.6%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Wave 3</td>
                      <td className="py-2 px-2">161.8%</td>
                      <td className="py-2 px-2">100% - 261.8%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Wave 4</td>
                      <td className="py-2 px-2">38.2%</td>
                      <td className="py-2 px-2">23.6% - 50%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Wave 5</td>
                      <td className="py-2 px-2">61.8% - 100%</td>
                      <td className="py-2 px-2">38.2% - 161.8%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2 text-orange-400" rowSpan={2}>Zigzag</td>
                      <td className="py-2 px-2">Wave B</td>
                      <td className="py-2 px-2">50%</td>
                      <td className="py-2 px-2">38.2% - 61.8%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Wave C</td>
                      <td className="py-2 px-2">100% - 127%</td>
                      <td className="py-2 px-2">100% - 161.8%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2 text-blue-400" rowSpan={2}>Flat</td>
                      <td className="py-2 px-2">Wave B</td>
                      <td className="py-2 px-2">90% - 100%</td>
                      <td className="py-2 px-2">78.6% - 138.2%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Wave C</td>
                      <td className="py-2 px-2">100% - 127%</td>
                      <td className="py-2 px-2">100% - 161.8%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-teal-400">Triangle</td>
                      <td className="py-2 px-2">Each Wave</td>
                      <td className="py-2 px-2">61.8% - 78.6%</td>
                      <td className="py-2 px-2">50% - 85%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </CardContent>
          )}
        </Card>
      </div>

      <CryptoNavigation />
      
      {/* DEBUG PANEL: Touch sensitivity testing (admin only) */}
      {isAdmin && (
        <>
          {/* Toggle button */}
          <button
            onClick={() => {
              setShowDebugPanel(v => !v);
              (window as any).__debugTolerances = !showDebugPanel;
            }}
            className="fixed bottom-20 right-4 z-50 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs shadow-lg"
            data-testid="button-toggle-debug"
          >
            {showDebugPanel ? 'Hide Debug' : '🔧 Debug'}
          </button>
          
          {/* Debug panel */}
          {showDebugPanel && (
            <div className="fixed bottom-32 right-4 z-50 bg-slate-900/95 border border-purple-500 rounded-lg p-4 w-80 max-h-[60vh] overflow-y-auto shadow-xl" data-testid="panel-debug">
              <h3 className="text-purple-400 font-bold mb-3 text-sm">Touch Sensitivity Debug</h3>
              
              {/* Current status */}
              <div className="bg-slate-800 rounded p-2 mb-3 text-xs">
                <div className="text-gray-400">Visible Candles: <span className="text-white font-mono">{visibleCandleCount}</span></div>
                <div className="text-gray-400">Current Bar Tolerance: <span className="text-emerald-400 font-mono">{dynamicTolerancesRef.current.barTolerance}</span></div>
                <div className="text-gray-400">Current Price Tolerance: <span className="text-emerald-400 font-mono">{(dynamicTolerancesRef.current.priceTolerance * 100).toFixed(1)}%</span></div>
                <div className="text-gray-400">Selected Pattern: <span className="text-yellow-400 font-mono">{selectedLabelId ? 'Yes' : 'No'}</span></div>
                <div className="text-gray-400">Dragging: <span className="text-yellow-400 font-mono">{isDragging ? `Point ${draggedPointIndex}` : 'No'}</span></div>
              </div>
              
              {/* Adjustable settings */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">Zoom Threshold 1 (1-candle): {debugSettings.zoomThreshold1}</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={debugSettings.zoomThreshold1}
                    onChange={(e) => setDebugSettings(s => ({ ...s, zoomThreshold1: Number(e.target.value) }))}
                    className="w-full"
                    data-testid="slider-zoom1"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Zoom Threshold 3 (3-candle): {debugSettings.zoomThreshold3}</label>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={debugSettings.zoomThreshold3}
                    onChange={(e) => setDebugSettings(s => ({ ...s, zoomThreshold3: Number(e.target.value) }))}
                    className="w-full"
                    data-testid="slider-zoom3"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Zoom Threshold 5 (5-candle): {debugSettings.zoomThreshold5}</label>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    value={debugSettings.zoomThreshold5}
                    onChange={(e) => setDebugSettings(s => ({ ...s, zoomThreshold5: Number(e.target.value) }))}
                    className="w-full"
                    data-testid="slider-zoom5"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Zoom Threshold 7 (7-candle): {debugSettings.zoomThreshold7}</label>
                  <input
                    type="range"
                    min="200"
                    max="600"
                    value={debugSettings.zoomThreshold7}
                    onChange={(e) => setDebugSettings(s => ({ ...s, zoomThreshold7: Number(e.target.value) }))}
                    className="w-full"
                    data-testid="slider-zoom7"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Touch Target Radius (px): {debugSettings.targetPixelRadius}</label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={debugSettings.targetPixelRadius}
                    onChange={(e) => setDebugSettings(s => ({ ...s, targetPixelRadius: Number(e.target.value) }))}
                    className="w-full"
                    data-testid="slider-touchradius"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Base Price Tolerance: {(debugSettings.basePriceTolerance * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={debugSettings.basePriceTolerance * 100}
                    onChange={(e) => setDebugSettings(s => ({ ...s, basePriceTolerance: Number(e.target.value) / 100 }))}
                    className="w-full"
                    data-testid="slider-baseprice"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 block mb-1">Max Price Tolerance: {(debugSettings.maxPriceTolerance * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    value={debugSettings.maxPriceTolerance * 100}
                    onChange={(e) => setDebugSettings(s => ({ ...s, maxPriceTolerance: Number(e.target.value) / 100 }))}
                    className="w-full"
                    data-testid="slider-maxprice"
                  />
                </div>
              </div>
              
              {/* Reset button */}
              <button
                onClick={() => setDebugSettings({
                  baseBarTolerance: 3,
                  maxBarTolerance: 30,
                  basePriceTolerance: 0.08,
                  maxPriceTolerance: 0.25,
                  targetPixelRadius: 44,
                  zoomThreshold1: 50,
                  zoomThreshold3: 100,
                  zoomThreshold5: 200,
                  zoomThreshold7: 300,
                })}
                className="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-white py-1 rounded text-xs"
                data-testid="button-reset-debug"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
