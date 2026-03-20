import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const { session } = useAuth();
  const [activos, setActivos] = useState<any[]>([]);
  const [totalMinutosMes, setTotalMinutosMes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Empleados trabajando ahora (hora_fin is null)
      const { data: dataActivos, error: errActivos } = await supabase
        .from('registros')
        .select(`
          id,
          hora_inicio,
          perfiles ( nombre )
        `)
        .is('hora_fin', null);

      if (errActivos) throw errActivos;
      setActivos(dataActivos || []);

      // Total horas del mes actual
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
      
      const { data: dataMensual, error: errMensual } = await supabase
        .from('registros')
        .select('total_minutos')
        .gte('fecha', inicioMes.split('T')[0]);

      if (errMensual) throw errMensual;

      const total = dataMensual?.reduce((acc, curr) => acc + (curr.total_minutos || 0), 0) || 0;
      setTotalMinutosMes(total);

    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderActivo = ({ item }: { item: any }) => {
    const inicio = new Date(item.hora_inicio);
    return (
      <View style={styles.card}>
        <Text style={styles.cardName}>{item.perfiles?.nombre || 'Desconocido'}</Text>
        <Text style={styles.cardTime}>Entrada: {inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    );
  };

  const formatMinutos = (mins: number) => {
    const horas = Math.floor(mins / 60);
    const min = mins % 60;
    return `${horas}h ${min}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Horas Totales Equipo (Este Mes)</Text>
        <Text style={styles.summaryValue}>{formatMinutos(totalMinutosMes)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Trabajando Ahora ({activos.length})</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={activos}
          keyExtractor={(item) => item.id}
          renderItem={renderActivo}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nadie está trabajando en este momento.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 20 },
  summaryCard: {
    backgroundColor: '#3b82f6',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 4,
  },
  summaryLabel: { color: '#eff6ff', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#1f2937' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardTime: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  emptyText: { color: '#6b7280', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
});
