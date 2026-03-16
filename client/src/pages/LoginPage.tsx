import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

// Schema de validacion con Zod
const loginSchema = z.object({
    email: z.email('Email invalido'),
    password: z.string().min(8, 'Minimo 8 caracteres, Una mayuscula, Un numero y Un simbolo'),
});
type LoginForm = z.infer<typeof loginSchema>;
export function LoginPage() {
    const { login, loginCargando, loginError } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });
    const onSubmit = (data: LoginForm) => login(data);
    return (
        <div className="min-h-screen flex items-center justify-center bg-(--bg) p-4">
            {/* Boton de tema en esquina superior derecha */}
            <div className="fixed top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-sm">
                {/* Logo / Nombre del agente */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-(--bubble-user) mb-4">
                        <span className="text-2xl font-bold text-(--bubble-user-text)">W</span>
                    </div>
                    <h1 className="text-2xl font-bold text-(--text)">
                        {import.meta.env.VITE_AGENT_NAME || 'Watto'}
                    </h1>
                    <p className="text-(--text-muted) text-sm mt-1">
                        Inicia sesion para continuar
                    </p>
                </div>
                {/* Formulario */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-(--text) mb-1">
                            Email
                        </label>
                        <input
                            {...register('email')}
                            type="email"
                            placeholder="tu@email.com"
                            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--input-bg) text-(--text) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--bubble-user) transition-colors"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-(--text) mb-1">
                            Password
                        </label>
                        <input
                            {...register('password')}
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--input-bg) text-(--text) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--bubble-user) transition-colors"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                        )}
                    </div>
                    {/* Error del servidor */}
                    {loginError && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {loginError}
                        </div>
                    )}
                    <Button
                        type="submit"
                        cargando={loginCargando}
                        className="w-full"
                        tamano="lg"
                    >
                        Iniciar sesion
                    </Button>
                </form>
            </div>
        </div>
    );
}