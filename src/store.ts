import { create } from 'zustand';
import type { Route } from './routes';

interface NavigationState {
  currentRoute: Route;
  popup: string | null;
  navigate: (route: Route) => void;
  openPopup: (hash: string) => void;
  closePopup: () => void;
  goBack: () => void;
}

export const useNavigation = create<NavigationState>((set) => ({
  currentRoute: 'overview',
  popup: null,
  navigate: (route) => set({ currentRoute: route, popup: null }),
  openPopup: (hash) => set({ popup: hash }),
  closePopup: () => set({ popup: null }),
  goBack: () => set({ currentRoute: 'overview', popup: null }),
}));
