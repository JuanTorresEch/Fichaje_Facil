-- Activar extensión pgcrypto (útil si se necesitan UUIDs)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla de Perfiles
-- Se enlaza con auth.users de Supabase
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles:
-- Los empleados solo pueden ver su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON public.perfiles FOR SELECT 
USING ( auth.uid() = id );

-- Los admins pueden ver todos los perfiles
CREATE POLICY "Los administradores pueden ver todos los perfiles" 
ON public.perfiles FOR SELECT 
USING ( (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin' );

-- Disparador (Trigger) para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), 
    COALESCE(new.raw_user_meta_data->>'rol', 'empleado')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mapear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Tabla de Registros (Fichajes)
CREATE TABLE IF NOT EXISTS public.registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID REFERENCES public.perfiles(id) ON DELETE CASCADE NOT NULL,
    fecha DATE DEFAULT current_date NOT NULL,
    hora_inicio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    hora_fin TIMESTAMP WITH TIME ZONE,
    total_minutos INTEGER,
    concepto TEXT
);

-- Habilitar RLS en registros
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

-- Políticas para registros (empleados):
-- 1. Empleados ven sus propios registros
CREATE POLICY "Empleados ven sus registros" 
ON public.registros FOR SELECT 
USING ( auth.uid() = perfil_id );

-- 2. Empleados pueden insertar (fichar entrada) solo para ellos mismos
CREATE POLICY "Empleados pueden insertar su fichaje" 
ON public.registros FOR INSERT 
WITH CHECK ( auth.uid() = perfil_id );

-- 3. Empleados pueden actualizar (fichar salida) solo su registro activo
CREATE POLICY "Empleados pueden actualizar su fichaje" 
ON public.registros FOR UPDATE 
USING ( auth.uid() = perfil_id AND hora_fin IS NULL )
WITH CHECK ( auth.uid() = perfil_id );

-- Políticas para registros (admins):
-- Los admins pueden ver, insertar, actualizar y eliminar todo
CREATE POLICY "Admins tienen acceso total" 
ON public.registros FOR ALL 
USING ( (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin' );
