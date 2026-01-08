import { create } from 'zustand';

export type RightSidebarTab = 'asset' | 'config' | 'history' | 'remediation';

interface RightSidebarState {
    activeTab: RightSidebarTab | null;
    isOpen: boolean;

    // Actions
    setActiveTab: (tab: RightSidebarTab | null) => void;
    toggleTab: (tab: RightSidebarTab) => void;
    close: () => void;
}

export const useRightSidebarStore = create<RightSidebarState>((set, get) => ({
    activeTab: null,
    isOpen: false,

    setActiveTab: (tab: RightSidebarTab | null) => {
        set({ activeTab: tab, isOpen: tab !== null });
    },

    toggleTab: (tab: RightSidebarTab) => {
        const { activeTab, isOpen } = get();
        if (activeTab === tab && isOpen) {
            set({ isOpen: false, activeTab: null });
        } else {
            set({ activeTab: tab, isOpen: true });
        }
    },

    close: () => {
        set({ isOpen: false, activeTab: null });
    },
}));
