import React, { useState } from 'react';
import { Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Para el registro
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Aviso', 'Por favor, ingresa correo y contraseña');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error de autenticación', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email || !password || !nombre || !username) {
      Alert.alert('Aviso', 'Por favor, completa todos los datos obligatorios.');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Aviso', 'El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // 1. Validar unicidad del username antes de proceder
      const { data: existingUser, error: checkError } = await supabase
        .from('perfiles')
        .select('username')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();

      if (checkError) throw checkError;
      
      if (existingUser) {
        Alert.alert('Usuario no disponible', 'Este nombre de usuario ya está en uso. Por favor elige otro.');
        setLoading(false);
        return;
      }

      // 2. Intentar registro en Auth
      const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            nombre: nombre.trim(),
            username: username.trim().toLowerCase(),
            // No pasamos rol, el trigger lo asignará por email
          }
        }
      });

      if (error) {
        Alert.alert('Error al registrar', error.message);
      } else {
        Alert.alert('Cuenta Creada', '¡Te has registrado con éxito! Ya puedes iniciar sesión.');
        setIsLogin(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Hubo un problema al validar los datos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardView} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.headerText}>Fichaje Fácil</Text>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, isLogin && styles.activeTab]} 
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, !isLogin && styles.activeTab]} 
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Registro</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {!isLogin && (
              <>
                <Text style={styles.label}>Nombre completo *</Text>
                <TextInput
                  onChangeText={setNombre}
                  value={nombre}
                  placeholder="Ej. Juan Pérez"
                  style={styles.input}
                />
                
                <Text style={styles.label}>Nombre de usuario *</Text>
                <TextInput
                  onChangeText={setUsername}
                  value={username}
                  placeholder="Ej. juanito_perez"
                  style={styles.input}
                  autoCapitalize="none"
                />
              </>
            )}

            <Text style={styles.label}>Correo electrónico *</Text>
            <TextInput
              onChangeText={setEmail}
              value={email}
              placeholder="nombre@ejemplo.com"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Contraseña *</Text>
            <TextInput
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              placeholder="Mínimo 6 caracteres"
              style={styles.input}
              autoCapitalize="none"
            />

            <TouchableOpacity 
              style={styles.mainButton} 
              onPress={isLogin ? signInWithEmail : signUpWithEmail} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>{isLogin ? 'Entrar a mi cuenta' : 'Crear mi cuenta ahora'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#f3f4f6', 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 500, // Restringe el ancho en pantallas grandes (Web/Desktop)
    width: '100%',
    alignSelf: 'center',
  },
  headerText: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 30,
    color: '#111827',
    letterSpacing: -1,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1f2937',
  },
  formContainer: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: -8, // Usa el gap del formContainer para separar
  },
  input: {
    height: 52,
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  roleActiveEmpleado: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  roleActiveAdmin: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleTextActive: {
    color: '#111827',
  },
  mainButton: {
    backgroundColor: '#1f2937', // Oscuro neutro universal
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
