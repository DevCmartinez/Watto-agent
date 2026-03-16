import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tema = 'light' | 'dark';
interface ThemeStore {
    tema: Tema;
    toggleTema: () => void;
    setTema: (tema: Tema) => void;
}
export const useThemeStore = create<ThemeStore>()(
    persist(
        (set, get) => ({
            tema: 'dark', // Tema por defecto
            toggleTema: () => {
                const nuevoTema = get().tema === 'dark' ? 'light' : 'dark';
                set({ tema: nuevoTema });
                // Aplicar la clase al elemento raiz del DOM
                document.documentElement.classList.toggle('dark', nuevoTema === 'dark');
            },
            setTema: (tema) => {
                set({ tema });
                document.documentElement.classList.toggle('dark', tema === 'dark');
            },
        }),
        {
            name: 'watto-theme',
            // Al hidratar el store desde localStorage, aplicar la clase al DOM
            onRehydrateStorage: () => (state) => {
                if (state) {
                    document.documentElement.classList.toggle('dark', state.tema === 'dark');
                }
            },
        }
    )
);