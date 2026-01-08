import { create } from 'zustand';
import type { RowDimension, Measure, MeasureDisplayMode } from '../types/pivot';

interface PivotConfigState {
    rowDimensions: RowDimension[];
    measures: Measure[];
    measureDisplayModes: Map<Measure, MeasureDisplayMode>;
    setRowDimensions: (dimensions: RowDimension[]) => void;
    setMeasures: (measures: Measure[]) => void;
    setMeasureDisplayMode: (measure: Measure, mode: MeasureDisplayMode) => void;
    setMeasureDisplayModes: (modes: Map<Measure, MeasureDisplayMode>) => void;
    resetConfig: () => void;
}

export const usePivotConfigStore = create<PivotConfigState>((set) => ({
    rowDimensions: ['connection', 'database', 'schema', 'type'],
    measures: ['assetCount', 'completeness', 'accuracy', 'overall'],
    measureDisplayModes: new Map<Measure, MeasureDisplayMode>(),
    setRowDimensions: (dimensions) => set({ rowDimensions: dimensions }),
    setMeasures: (measures) => set({ measures: measures }),
    setMeasureDisplayMode: (measure, mode) => set((state) => {
        const next = new Map(state.measureDisplayModes);
        next.set(measure, mode);
        return { measureDisplayModes: next };
    }),
    setMeasureDisplayModes: (modes) => set({ measureDisplayModes: modes }),
    resetConfig: () => set({
        rowDimensions: ['connection', 'database', 'schema', 'type'],
        measures: ['assetCount', 'completeness', 'accuracy', 'overall'],
        measureDisplayModes: new Map<Measure, MeasureDisplayMode>(),
    }),
}));
