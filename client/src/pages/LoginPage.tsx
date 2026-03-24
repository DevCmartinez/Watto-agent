/**
 * @origin [client/src/pages/LoginPage.tsx]
 * @calledBy Configurado en [App.tsx] como la ruta inicial y pública `/login`.
 * @description Página de autenticación de nivel empresarial. Incluye diseño 'Glassmorphism', 
 * validación robusta con Zod y manejo de estados de carga/error.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ShieldCheck, Mail, Lock } from 'lucide-react';

/**
 * Esquema de validación para el formulario de acceso.
 * Define las reglas de negocio para los campos de email y contraseña.
 */
const loginSchema = z.object({
    email: z.string().email('Debe ingresar un correo institucional válido'),
    password: z.string().min(8, 'La contraseña es obligatoria. Verifique sus credenciales.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
    // Hook personalizado para lógica de autenticación (proveniente de useAuth.ts)
    const { login, loginCargando, loginError } = useAuth();

    // Inicialización de React Hook Form con validación Zod
    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    /**
     * Procesa el envío del formulario.
     * @param data Datos validados del formulario.
     */
    const onSubmit = (data: LoginForm) => login(data);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-premium p-6 overflow-hidden">
            {/* Control Flotante de Apariencia */}
            <div className="fixed top-6 right-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <ThemeToggle />
            </div>

            <div className="w-full max-w-lg animate-fade-in">
                {/* Contenedor Principal con efecto Glassmorphism */}
                <div className="glass rounded-3xl p-8 sm:p-12 transition-all duration-500 hover:scale-[1.01]">
                    
                    {/* Encabezado Corporativo */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-(--bubble-user) shadow-lg shadow-(--bubble-user)/30 mb-6 group transition-transform hover:rotate-6">
                            <ShieldCheck className="w-10 h-10 text-(--bubble-user-text)" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-(--text) tracking-tight">
                            {import.meta.env.VITE_AGENT_NAME || 'Watto Agent'}
                        </h1>
                        <p className="text-(--text-muted) text-sm mt-3 uppercase tracking-widest font-semibold">
                            Acceso Institucional
                        </p>
                    </div>

                    {/* Formulario de Login */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        
                        {/* Campo: Correo Electrónico */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-(--text-muted) uppercase ml-1">
                                Identificación de Usuario
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted) transition-colors group-focus-within:text-(--bubble-user)" />
                                <input
                                    {...register('email')}
                                    type="email"
                                    placeholder="usuario@compañia.com"
                                    disabled={loginCargando}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-(--border) bg-(--input-bg)/50 text-(--text) placeholder:text-(--text-muted)/50 focus:outline-none focus:ring-2 focus:ring-(--bubble-user)/50 focus:bg-(--input-bg) transition-all"
                                />
                            </div>
                            {errors.email && (
                                <p className="text-red-500 text-xs font-medium mt-1 animate-fade-in">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Campo: Contraseña */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-(--text-muted) uppercase ml-1">
                                Credencial de Seguridad
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted) transition-colors group-focus-within:text-(--bubble-user)" />
                                <input
                                    {...register('password')}
                                    type="password"
                                    placeholder="••••••••••••"
                                    disabled={loginCargando}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-(--border) bg-(--input-bg)/50 text-(--text) placeholder:text-(--text-muted)/50 focus:outline-none focus:ring-2 focus:ring-(--bubble-user)/50 focus:bg-(--input-bg) transition-all"
                                />
                            </div>
                            {errors.password && (
                                <p className="text-red-500 text-xs font-medium mt-1 animate-fade-in">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Alerta de Error del Servidor */}
                        {loginError && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium animate-fade-in">
                                {loginError}
                            </div>
                        )}

                        {/* Botón de Acción Principal */}
                        <div className="pt-2">
                            <Button
                                type="submit"
                                cargando={loginCargando}
                                className="w-full shadow-lg shadow-(--bubble-user)/20 transition-transform active:scale-95"
                                tamano="lg"
                            >
                                Ingresar al Sistema
                            </Button>
                        </div>
                    </form>

                    {/* Pie de página del Login */}
                    <div className="mt-10 pt-6 border-t border-(--border)/50 text-center">
                        <p className="text-xs text-(--text-muted) italic">
                            Sistema de Inteligencia Autónoma — Watto v0.0.1
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}