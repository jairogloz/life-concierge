import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '@/lib/useApi';
import type { AISuggestion } from '@/types';

type Phase = 'input' | 'review' | 'done';

export default function CaptureScreen() {
  const api = useApi();
  const [phase, setPhase] = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!rawText.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<AISuggestion>('/tasks/inbox', {
        raw_text: rawText.trim(),
      });
      setSuggestion(res.data);
      setPhase('review');
    } catch {
      Alert.alert('Error', 'Failed to process your note. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!suggestion) return;
    setLoading(true);
    try {
      await api.post(`/tasks/inbox/${suggestion.id}/accept`);
      setPhase('done');
    } catch {
      Alert.alert('Error', 'Failed to accept suggestion.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!suggestion) return;
    setLoading(true);
    try {
      await api.post(`/tasks/inbox/${suggestion.id}/reject`);
      reset();
    } catch {
      Alert.alert('Error', 'Failed to reject suggestion.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRawText('');
    setSuggestion(null);
    setPhase('input');
  }

  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={72} color="#10b981" />
        <Text style={styles.doneTitle}>Task Created!</Text>
        <Text style={styles.doneSub}>It's now in your ranked list.</Text>
        <TouchableOpacity style={styles.btn} onPress={reset}>
          <Text style={styles.btnText}>Capture Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {phase === 'input' && (
          <View>
            <Text style={styles.heading}>Quick Capture</Text>
            <Text style={styles.subheading}>
              Describe a task in plain language — AI will structure it for you.
            </Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Call mom this Sunday, important for marriage role"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              value={rawText}
              onChangeText={setRawText}
            />
            <TouchableOpacity
              style={[styles.btn, (!rawText.trim() || loading) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!rawText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Parse with AI →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {phase === 'review' && suggestion && (
          <View>
            <Text style={styles.heading}>Review Suggestion</Text>
            <Text style={styles.subheading}>AI interpretation — accept or reject below.</Text>

            <SuggestionField label="Title" value={suggestion.suggestion.title} />
            <SuggestionField label="Description" value={suggestion.suggestion.description} />
            <SuggestionField label="Commitment type" value={suggestion.suggestion.commitment_type} />
            <SuggestionField label="Urgency" value={String(suggestion.suggestion.urgency)} />
            {suggestion.suggestion.deadline_hint && (
              <SuggestionField label="Deadline hint" value={suggestion.suggestion.deadline_hint} />
            )}
            {suggestion.suggestion.context_tags?.length > 0 && (
              <SuggestionField
                label="Context tags"
                value={suggestion.suggestion.context_tags.join(', ')}
              />
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnAccept, loading && styles.btnDisabled]}
                onPress={handleAccept}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>✓ Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject, loading && styles.btnDisabled]}
                onPress={handleReject}
                disabled={loading}
              >
                <Text style={[styles.btnText, { color: '#ef4444' }]}>✗ Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SuggestionField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  textarea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnAccept: { backgroundColor: '#10b981', flex: 1 },
  btnReject: { backgroundColor: '#fee2e2', flex: 1 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  field: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: '#111827' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  doneSub: { fontSize: 14, color: '#6b7280' },
});
