import { create } from 'zustand';

type ToastTipo = 'exito' | 'error' | 'info';
interface ToastStore {
    visible: boolean;
    mensaje: string;
    tipo: ToastTipo;
    mostrarToast: (mensaje: string, tipo?: ToastTipo) => void;
    ocultarToast: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    visible: false,
    mensaje: '',
    tipo: 'exito',
    mostrarToast: (mensaje, tipo = 'exito') =>
        set({ visible: true, mensaje, tipo }),
    ocultarToast: () =>
        set({ visible: false }),
}));