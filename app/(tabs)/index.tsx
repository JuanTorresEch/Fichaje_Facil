import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';

export default function FichajeScreen() {
  const { session, profile } = useAuth();
  const [activeJornada, setActiveJornada] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // Estados
  const [modo, setModo] = useState<'vivo' | 'manual'>('manual');
  const [concepto, setConcepto] = useState('');
  
  // Estados para el modo manual
  const [fechaManual, setFechaManual] = useState(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [horaManual, setHoraManual] = useState('09:00');
  const [minutosManual, setMinutosManual] = useState('');

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session) {
      checkActiveJornada();
    } else {
      setLoading(false);
    }
  }, [session]);

  // Helper para alertas compatible con Web y Móvil
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const checkActiveJornada = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('perfil_id', session.user.id)
        .is('hora_fin', null)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setActiveJornada(data || null);
      if (data?.concepto) {
        setConcepto(data.concepto);
      }
    } catch (error: any) {
      console.error('Error al verificar jornada:', error);
      showAlert('Error', 'No se pudo verificar si tienes una jornada activa.');
    } finally {
      setLoading(false);
    }
  };

  const inciarJornada = async () => {
    if (!session?.user?.id) {
       showAlert('Error', 'No hay una sesión activa. Por favor, reidentifícate.');
       return;
    }

    if (!profile) {
       showAlert('Perfil faltante', 'No hemos encontrado tu perfil en el sistema. Contacta con soporte.');
       return;
    }

    if (!concepto.trim()) {
      showAlert('Aviso', 'Por favor, escribe un concepto o descripción para iniciar.');
      return;
    }

    setLoading(true);
    console.log('Iniciando jornada para:', session.user.id, 'con:', concepto.trim());
    try {
      const { data, error } = await supabase
        .from('registros')
        .insert([{ 
          perfil_id: session.user.id, 
          concepto: concepto.trim() 
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error Supabase (Inicio):', error);
        throw error;
      }
      setActiveJornada(data);
      showAlert('Éxito', 'Jornada iniciada correctamente');
    } catch (error: any) {
      const msg = error.message || 'Error desconocido';
      const code = error.code || 'NN';
      showAlert('Error al iniciar', `[${code}] ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const finalizarJornada = async () => {
    if (!activeJornada) return;
    setLoading(true);
    try {
      const horaInicio = new Date(activeJornada.hora_inicio);
      const horaFin = new Date();
      const diffMs = horaFin.getTime() - horaInicio.getTime();
      const totalMinutos = Math.floor(diffMs / 60000);

      const { error } = await supabase
        .from('registros')
        .update({
          hora_fin: horaFin.toISOString(),
          total_minutos: totalMinutos
        })
        .eq('id', activeJornada.id);

      if (error) {
        console.error('Error Supabase (Fin):', error);
        throw error;
      }
      setActiveJornada(null);
      setConcepto('');
      showAlert('Éxito', `Jornada finalizada. Total: ${totalMinutos} minutos.`);
    } catch (error: any) {
      const msg = error.message || 'Error al cerrar el registro';
      const code = error.code || 'NN';
      showAlert('Error al finalizar', `[${code}] ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const guardarJornadaManual = async () => {
    if (!session?.user?.id || !profile) {
        showAlert('Error', 'Sesión o Perfil no detectado. Reintenta el login.');
        return;
    }

    if (!fechaManual || !horaManual || !minutosManual || !concepto.trim()) {
      showAlert('Aviso', 'Por favor completa la fecha, la hora, los minutos y el concepto.');
      return;
    }

    // Validar fecha (DD/MM/AAAA)
    const regexFecha = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(20)\d\d$/;
    if (!regexFecha.test(fechaManual)) {
      showAlert('Aviso', 'El formato de fecha debe ser DD/MM/AAAA.');
      return;
    }

    // Validar formato hora (HH:MM)
    const regexHora = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!regexHora.test(horaManual)) {
      showAlert('Aviso', 'Formato de hora inválido. Usa HH:MM (ej. 09:30).');
      return;
    }

    const minsInt = parseInt(minutosManual, 10);
    if (isNaN(minsInt) || minsInt <= 0) {
      showAlert('Aviso', 'Los minutos trabajados deben ser un número de al menos 1.');
      return;
    }

    setLoading(true);
    try {
      const [dia, mes, anio] = fechaManual.split('/');
      const [horas, minutos] = horaManual.split(':');
      
      const fechaInicial = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia), parseInt(horas), parseInt(minutos), 0);
      
      if (isNaN(fechaInicial.getTime())) {
        showAlert('Aviso', 'Fecha u hora inválida.');
        setLoading(false);
        return;
      }

      // Calcular hora final sumando los minutos
      const horaFin = new Date(fechaInicial.getTime() + minsInt * 60000);

      console.log('Guardando fichaje manual:', { fecha: `${anio}-${mes}-${dia}`, minsInt });

      const { error } = await supabase
        .from('registros')
        .insert([{
          perfil_id: session.user.id,
          fecha: `${anio}-${mes}-${dia}`,
          hora_inicio: fechaInicial.toISOString(),
          hora_fin: horaFin.toISOString(),
          total_minutos: minsInt,
          concepto: concepto.trim()
        }]);

      if (error) {
        console.error('Error Supabase (Manual):', error);
        throw error;
      }

      showAlert('Éxito', `Fichaje del ${fechaManual} guardado correctamente.`);
      setMinutosManual(''); 
      setConcepto('');
    } catch (error: any) {
      const msg = error.message || 'La base de datos rechazó el registro.';
      const code = error.code || 'NN';
      showAlert('Error al guardar', `[${code}] ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const formatElapsedTime = () => {
    if (!activeJornada) return '00:00:00';
    const inicio = new Date(activeJornada.hora_inicio).getTime();
    const ahora = currentTime.getTime();
    const diff = Math.max(0, ahora - inicio);

    const matchHours = Math.floor(diff / 3600000);
    const matchMinutes = Math.floor((diff % 3600000) / 60000);
    const matchSeconds = Math.floor((diff % 60000) / 1000);

    return `${matchHours.toString().padStart(2, '0')}:${matchMinutes.toString().padStart(2, '0')}:${matchSeconds.toString().padStart(2, '0')}`;
  };

  if (!mounted) return null;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.welcomeText}>Hola, {profile?.nombre || 'Empleado'}</Text>

        {/* Selector de modo */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, modo === 'vivo' && styles.toggleActive]} 
            onPress={() => setModo('vivo')}
          >
            <Text style={[styles.toggleText, modo === 'vivo' && styles.toggleTextActive]}>En Vivo</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, modo === 'manual' && styles.toggleActive]} 
            onPress={() => setModo('manual')}
          >
            <Text style={[styles.toggleText, modo === 'manual' && styles.toggleTextActive]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {modo === 'vivo' ? (
          // CONTENIDO: MODO EN VIVO
          <>
            <View style={styles.timeCard}>
              <Text style={styles.dateText}>
                {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <Text style={styles.timeText}>
                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <View style={styles.statusContainer}>
              {loading && !activeJornada ? (
                <ActivityIndicator size="large" color="#10b981" />
              ) : activeJornada ? (
                <>
                  <Text style={styles.statusLabel}>Tiempo transcurrido</Text>
                  <Text style={styles.elapsedTime}>{formatElapsedTime()}</Text>
                </>
              ) : (
                <Text style={styles.statusLabel}>No estás trabajando actualmente</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Concepto del trabajo *</Text>
              <TextInput 
                style={[styles.input, activeJornada && styles.inputDisabled]}
                value={concepto}
                onChangeText={setConcepto}
                placeholder="Ej. Clase de piano"
                editable={!activeJornada}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, activeJornada ? styles.buttonStop : styles.buttonStart]}
              onPress={activeJornada ? finalizarJornada : inciarJornada}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {activeJornada ? 'Finalizar Jornada' : 'Iniciar Jornada'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          // CONTENIDO: MODO MANUAL
          <View style={styles.manualContainer}>
            <Text style={styles.manualDescription}>
              Introduce el trabajo realizado, la fecha, la hora de entrada y la cantidad de tiempo total trabajado.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Concepto del trabajo *</Text>
              <TextInput 
                style={styles.input}
                value={concepto}
                onChangeText={setConcepto}
                placeholder="Ej. Clase de inglés"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha (DD/MM/AAAA)</Text>
              <TextInput 
                style={styles.input}
                value={fechaManual}
                onChangeText={setFechaManual}
                placeholder="Ej. 18/03/2026"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Hora Inicio</Text>
                <TextInput 
                  style={styles.input}
                  value={horaManual}
                  onChangeText={setHoraManual}
                  placeholder="09:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Minutos totales</Text>
                <TextInput 
                  style={styles.input}
                  value={minutosManual}
                  onChangeText={setMinutosManual}
                  placeholder="Ej. 120"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#3b82f6', marginTop: 10 }]}
              onPress={guardarJornadaManual}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Añadir Fichaje</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#f9fafb',
    minHeight: '100%',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
    marginBottom: 30,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#1f2937',
  },
  timeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 30,
  },
  dateText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -1,
  },
  statusContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  elapsedTime: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
  },
  button: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 4,
  },
  buttonStart: {
    backgroundColor: '#10b981',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  manualContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  manualDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  inputDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
  }
});
