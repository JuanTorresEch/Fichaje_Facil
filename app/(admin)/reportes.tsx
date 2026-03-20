import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function ReportesScreen() {
  const [fichajes, setFichajes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFichajesRecientes();
  }, []);

  const fetchFichajesRecientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registros')
        .select('*, perfiles(nombre)')
        .order('hora_inicio', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setFichajes(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatMinutos = (mins: number) => {
    if (!mins) return 'En curso';
    const horas = Math.floor(mins / 60);
    const min = mins % 60;
    return `${horas}h ${min}m`;
  };

  const renderItem = ({ item }: { item: any }) => {
    const d = new Date(item.fecha);
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardName}>{item.perfiles?.nombre || '?'}</Text>
          <Text style={styles.cardDate}>{d.toLocaleDateString('es-ES')}</Text>
        </View>
        <Text style={styles.cardTime}>
          {new Date(item.hora_inicio).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})} - 
          {item.hora_fin ? new Date(item.hora_fin).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) : ' ...'}
        </Text>
        <Text style={styles.cardConcept}>{item.concepto || 'Sin concepto'}</Text>
        <Text style={styles.cardTotal}>Total: {formatMinutos(item.total_minutos)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Últimos 50 Fichajes</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={fichajes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay fichajes en el sistema.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1f2937' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardDate: { fontSize: 14, color: '#4b5563' },
  cardTime: { fontSize: 14, color: '#6b7280' },
  cardConcept: { fontSize: 13, color: '#4b5563', fontStyle: 'italic', marginTop: 4 },
  cardTotal: { fontSize: 14, fontWeight: 'bold', color: '#3b82f6', marginTop: 4, textAlign: 'right' },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 20 },
});
