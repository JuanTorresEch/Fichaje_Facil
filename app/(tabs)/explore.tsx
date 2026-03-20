import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, RefreshControl } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

// Configurar calendario en español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

export default function HistorialScreen() {
  const { session, profile } = useAuth();
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMinutosMes, setTotalMinutosMes] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM
  const [refreshing, setRefreshing] = useState(false);

  // Admin: Selección de empleado
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (session && !selectedProfileId) {
      setSelectedProfileId(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    if (session && profile?.rol === 'admin') {
      fetchProfiles();
    }
  }, [session, profile]);

  useEffect(() => {
    if (session && selectedProfileId) {
      fetchHistorialMes(currentMonth);
    }
  }, [session, currentMonth, selectedProfileId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistorialMes(currentMonth);
    setRefreshing(false);
  };

  const recordsForSelectedDate = registros.filter(r => r.fecha === selectedDate);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, username')
        .order('nombre');
      if (error) throw error;
      setPerfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchHistorialMes = async (monthYYYYMM: string) => {
    if (!selectedProfileId) return;
    setLoading(true);
    try {
      const [year, month] = monthYYYYMM.split('-');
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0);

      const startDateStr = `${year}-${month}-01`;
      const endDateStr = `${year}-${month}-${endOfMonth.getDate().toString().padStart(2, '0')}`;

      let query = supabase
        .from('registros')
        .select('*, perfiles(nombre)')
        .gte('fecha', startDateStr)
        .lte('fecha', endDateStr);

      if (selectedProfileId !== 'all') {
        query = query.eq('perfil_id', selectedProfileId);
      }

      const { data, error } = await query.order('hora_inicio', { ascending: true });

      if (error) throw error;
      
      setRegistros(data || []);
      
      let total = 0;
      data?.forEach(reg => {
        if (reg.total_minutos) total += reg.total_minutos;
      });
      setTotalMinutosMes(total);

    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutos = (mins: number) => {
    const horas = Math.floor(mins / 60);
    const minRestantes = mins % 60;
    return `${horas}h ${minRestantes}m`;
  };

  const exportarCSV = async () => {
    if (registros.length === 0) {
      Alert.alert('Sin datos', 'No hay registros para exportar en este mes.');
      return;
    }

    try {
      // 1. Generar CABECERA y FILAS
      const header = 'Empleado,Fecha,H. Inicio,H. Fin,Concepto,Total Minutos,Total Horas\n';
      const rows = registros.map(r => {
        const nombre = r.perfiles?.nombre || 'Desconocido';
        const fecha = r.fecha;
        const hInicio = new Date(r.hora_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const hFin = r.hora_fin ? new Date(r.hora_fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Activo';
        const concepto = (r.concepto || 'Fichaje').replace(/,/g, ' '); // Evitar comas que rompan el CSV
        const totalMin = r.total_minutos || 0;
        const totalHoras = formatMinutos(totalMin);
        
        return `${nombre},${fecha},${hInicio},${hFin},${concepto},${totalMin},${totalHoras}`;
      }).join('\n');

      const csvContent = header + rows;
      const fileName = `Fichajes_${currentMonth}_${selectedProfileId === 'all' ? 'Todos' : 'Empleado'}.csv`;

      // 2. Exportar según plataforma
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // @ts-ignore - Propiedades dinámicas de expo-file-system
        const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        const fileUri = `${cacheDir}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { 
          encoding: 'utf8' 
        });
        
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Exportar Fichajes',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert('Error', 'La función de compartir no está disponible en este dispositivo.');
        }
      }
    } catch (error: any) {
      console.error('Error al exportar:', error);
      Alert.alert('Error', 'No se pudo generar el archivo de exportación.');
    }
  };

  const confirmarEliminacion = (id: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este fichaje?');
      if (confirmed) eliminarRegistro(id);
    } else {
      Alert.alert(
        'Eliminar Fichaje',
        '¿Estás seguro de que quieres eliminar este fichaje?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => eliminarRegistro(id) }
        ]
      );
    }
  };

  const eliminarRegistro = async (id: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('registros')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Actualizar estado local
      const deletedRecord = registros.find(r => r.id === id);
      setRegistros(prev => prev.filter(r => r.id !== id));
      
      if (deletedRecord?.total_minutos) {
        setTotalMinutosMes(prev => prev - deletedRecord.total_minutos);
      }

    } catch (error: any) {
      console.error(error);
      if (Platform.OS === 'web') window.alert('Error al eliminar: ' + error.message);
      else Alert.alert('Error', 'No se pudo eliminar el registro.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDay = ({ date, state }: any) => {
    const isToday = state === 'today';
    const isDisabled = state === 'disabled';
    const isSelected = selectedDate === date.dateString;
    const dayRecords = registros.filter(r => r.fecha === date.dateString);

    return (
      <TouchableOpacity 
        style={[
          styles.dayCell, 
          isToday && styles.todayCell, 
          isSelected && styles.selectedCell
        ]}
        onPress={() => setSelectedDate(date.dateString)}
      >
        <Text style={[
          styles.dayText, 
          isDisabled && styles.disabledText, 
          isToday && styles.todayText,
          isSelected && styles.selectedText
        ]}>
          {date.day}
        </Text>
        
        <View style={styles.eventsContainer}>
          {dayRecords.map((r, i) => (
            <View key={i} style={styles.eventBadge}>
              <Text style={styles.eventTime}>
                {new Date(r.hora_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Historial {profile?.rol === 'admin' ? '(Modo Admin)' : ''}</Text>
      
      {profile?.rol === 'admin' && perfiles.length > 0 && (
        <View style={styles.adminFilterContainer}>
          <Text style={styles.filterLabel}>Filtrar por empleado:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profilesScroll}>
            <TouchableOpacity 
              style={[
                styles.profileTab, 
                selectedProfileId === 'all' && styles.activeProfileTab,
                { backgroundColor: selectedProfileId === 'all' ? '#10b981' : '#f3f4f6' }
              ]}
              onPress={() => setSelectedProfileId('all')}
            >
              <Text style={[
                styles.profileTabText, 
                selectedProfileId === 'all' && styles.activeProfileTabText
              ]}>
                🌍 Ver Todos
              </Text>
            </TouchableOpacity>
            
            {perfiles.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={[
                  styles.profileTab, 
                  selectedProfileId === p.id && styles.activeProfileTab
                ]}
                onPress={() => setSelectedProfileId(p.id)}
              >
                <Text style={[
                  styles.profileTabText, 
                  selectedProfileId === p.id && styles.activeProfileTabText
                ]}>
                  {p.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <View>
            <Text style={styles.summaryLabel}>Total trabajado este mes</Text>
            <Text style={styles.summaryValue}>{formatMinutos(totalMinutosMes)}</Text>
          </View>
          {profile?.rol === 'admin' && (
            <TouchableOpacity style={styles.exportButton} onPress={exportarCSV}>
              <Ionicons name="download-outline" size={24} color="#fff" />
              <Text style={styles.exportButtonText}>CSV</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
        }
      >
        {loading ? (
           <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
        ) : (
          <>
            <Calendar
              current={currentMonth + '-01'} 
              onMonthChange={(month: any) => {
                setCurrentMonth(month.dateString.substring(0, 7));
              }}
              firstDay={1}
              dayComponent={renderDay}
              theme={{
                calendarBackground: '#ffffff',
                // @ts-ignore - Propiedad interna de react-native-calendars
                'stylesheet.calendar.main': {
                  week: {
                    marginTop: 0,
                    marginBottom: 0,
                    flexDirection: 'row',
                    paddingHorizontal: 0, 
                    borderBottomWidth: 0.5,
                    borderColor: '#e5e7eb',
                    justifyContent: 'space-between'
                  },
                  dayContainer: {
                    flex: 1, 
                    alignItems: 'stretch'
                  }
                }
              }}
              style={styles.calendar}
            />

            <View style={styles.detailsContainer}>
              <Text style={styles.detailsTitle}>
                Detalles del: {new Date(selectedDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              
              {recordsForSelectedDate.length === 0 ? (
                <Text style={styles.noRecordsText}>No hay fichajes para este día.</Text>
              ) : (
                recordsForSelectedDate.map((r) => (
                  <View key={r.id} style={styles.recordItem}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.recordConcept}>{r.concepto || 'Fichaje'}</Text>
                        {selectedProfileId === 'all' && (
                          <View style={styles.employeeTag}>
                            <Text style={styles.employeeTagText}>{r.perfiles?.nombre || '?'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.recordTime}>
                        {new Date(r.hora_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} 
                        {r.hora_fin ? ` - ${new Date(r.hora_fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ' (Activo)'}
                        {r.total_minutos ? ` [${formatMinutos(r.total_minutos)}]` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteButton} 
                      onPress={() => confirmarEliminacion(r.id)}
                      disabled={isDeleting}
                    >
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingTop: 45,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 4,
  },
  summaryLabel: {
    color: '#eff6ff',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  calendar: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    width: '100%', 
    alignSelf: 'center',
  },
  dayCell: {
    width: '100%',
    minHeight: Platform.OS === 'web' ? 110 : 70,
    borderRightWidth: 0.5,
    borderColor: '#e5e7eb',
    padding: 6,
    alignItems: 'flex-start',
    backgroundColor: '#fff',
  },
  todayCell: {
    backgroundColor: '#eff6ff',
  },
  selectedCell: {
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    backgroundColor: '#f8fafc',
  },
  dayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4b5563',
    alignSelf: 'center',
    marginBottom: 2,
  },
  disabledText: {
    color: '#d1d5db',
  },
  todayText: {
    color: '#3b82f6',
  },
  selectedText: {
    color: '#1d4ed8',
  },
  eventsContainer: {
    width: '100%',
    flex: 1,
  },
  eventBadge: {
    backgroundColor: '#10b981',
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 2,
    marginBottom: 2,
    overflow: 'hidden',
  },
  eventTime: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 15,
  },
  noRecordsText: {
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recordConcept: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  recordTime: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  deleteButton: {
    padding: 10,
    marginLeft: 10,
  },
  // Estilo para filtro de admin
  adminFilterContainer: {
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  profilesScroll: {
    flexDirection: 'row',
  },
  profileTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeProfileTab: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  profileTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeProfileTabText: {
    color: '#fff',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  employeeTag: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  employeeTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
