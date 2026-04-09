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
        <div className="min-h-screen flex items-center justify-center bg-gradient-premium p-6 overflow-hidden relative">
            {/* Orbes de Fondo Animados */}
            <div className="orb w-64 h-64 bg-primary/20 top-[-5%] left-[-5%] opacity-60" />
            <div className="orb w-96 h-96 bg-accent/10 bottom-[-10%] right-[-10%] opacity-40 [animation-delay:-5s]" />
            <div className="orb w-48 h-48 bg-primary/30 top-[20%] right-[10%] opacity-30 [animation-delay:-10s]" />

            {/* Control Flotante de Apariencia */}
            <div className="fixed top-6 right-6 animate-fade-in z-50" style={{ animationDelay: '0.1s' }}>
                <ThemeToggle />
            </div>

            <div className="w-full max-w-lg animate-fade-in relative z-10">
                {/* Contenedor Principal con efecto Glassmorphism */}
                <div className="glass rounded-[40px] p-8 sm:p-12 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-accent/10">

                    {/* Encabezado Corporativo Premium */}
                    <div className="text-center mb-10">
                        <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary shadow-2xl shadow-primary/40 mb-8 group transition-all hover:rotate-6">
                            <div className="absolute inset-0 rounded-3xl bg-linear-to-tr from-accent/40 to-transparent animate-pulse" />
                            <ShieldCheck className="w-12 h-12 text-white relative z-10" />
                        </div>
                        <h1 className="text-4xl font-black text-(--text) tracking-tighter mb-2">
                            {import.meta.env.VITE_AGENT_NAME || 'WATTO'}
                        </h1>
                        <div className="h-1 w-12 bg-accent mx-auto rounded-full mb-4" />
                        <p className="text-(--text-muted) text-[10px] uppercase tracking-[0.3em] font-black opacity-60">
                            Suite Empresarial Inteligente
                        </p>
                    </div>

                    {/* Formulario de Login */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                        {/* Campo: Correo Electrónico */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-(--text-muted) uppercase ml-1 tracking-wider opacity-60">
                                Usuario
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted) transition-colors group-focus-within:text-accent" />
                                <input
                                    {...register('email')}
                                    type="email"
                                    placeholder="email@ejemplo.com"
                                    disabled={loginCargando}
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl outline-none"
                                />
                            </div>
                            {errors.email && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 animate-fade-in">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Campo: Contraseña */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-(--text-muted) uppercase ml-1 tracking-wider opacity-60">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted) transition-colors group-focus-within:text-accent" />
                                <input
                                    {...register('password')}
                                    type="password"
                                    placeholder="••••••••••••"
                                    disabled={loginCargando}
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl outline-none"
                                />
                            </div>
                            {errors.password && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 animate-fade-in">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Alerta de Error del Servidor */}
                        {loginError && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-fade-in flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                {loginError}
                            </div>
                        )}

                        {/* Botón de Acción Principal */}
                        <div className="pt-4">
                            <Button
                                type="submit"
                                cargando={loginCargando}
                                className="w-full py-6 rounded-2xl shadow-xl shadow-primary/20 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all bg-primary"
                                tamano="lg"
                            >
                                Ingresar
                            </Button>
                        </div>
                    </form>

                    {/* Pie de página del Login */}
                    <div className="mt-12 pt-8 border-t border-(--border)/30 text-center">
                        <p className="text-[9px] text-(--text-muted) font-bold uppercase tracking-[0.2em] opacity-40">
                            Powered by Watto AI Autonomous Core v0.0.39-ALPHA
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

}