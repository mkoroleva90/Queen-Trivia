import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL } from '@/lib/apiBase';
import { COPY } from '@workspace/copy';

type ReportReason = 'hateful' | 'sexual' | 'harassment' | 'spam' | 'other';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'hateful',    label: COPY.report.reasons.hateful },
  { value: 'sexual',     label: COPY.report.reasons.sexual },
  { value: 'harassment', label: COPY.report.reasons.harassment },
  { value: 'spam',       label: COPY.report.reasons.spam },
  { value: 'other',      label: COPY.report.reasons.other },
];

interface ReportModalProps {
  visible: boolean;
  gameId: number;
  /** ID of the question currently on screen, if applicable. */
  questionId?: number;
  onClose: () => void;
}

export function ReportModal({ visible, gameId, questionId, onClose }: ReportModalProps) {
  const colors = useColors();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setReason(null);
    setNote('');
    setSubmitted(false);
    setError(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!reason || loading) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { gameId, reason };
      if (questionId) body.questionId = questionId;
      if (note.trim()) body.note = note.trim();

      const r = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        if (json.code === 'content_filtered') {
          setError(COPY.contentFilter.reportNote);
        } else {
          setError(COPY.report.submitError);
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setError(COPY.report.submitError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to dismiss */}
        <TouchableOpacity
          style={styles.backdrop}
          onPress={resetAndClose}
          activeOpacity={1}
        />

        {/* Sheet */}
        <View style={[styles.sheet, { backgroundColor: '#0f1724', borderColor: 'rgba(255,255,255,.12)' }]}>
          {submitted ? (
            /* ── Confirmation state ── */
            <View style={styles.confirmContainer}>
              <View style={[styles.confirmIconWrap, { backgroundColor: 'rgba(34,197,94,.15)' }]}>
                <Ionicons name="checkmark" size={26} color="#22c55e" />
              </View>
              <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
                {COPY.report.confirmTitle}
              </Text>
              <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
                {COPY.report.confirmBody}
              </Text>
              <TouchableOpacity
                onPress={resetAndClose}
                style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.12)' }]}
              >
                <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Form state ── */
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.title, { color: colors.foreground }]}>
                {COPY.report.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {COPY.report.subtitle}
              </Text>

              {/* Reason selector */}
              <View style={styles.reasons}>
                {REASONS.map((r) => {
                  const selected = reason === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setReason(r.value)}
                      style={[
                        styles.reasonBtn,
                        {
                          backgroundColor: selected
                            ? 'rgba(255,45,142,.18)'
                            : 'rgba(255,255,255,.05)',
                          borderColor: selected
                            ? 'rgba(255,45,142,.6)'
                            : 'rgba(255,255,255,.09)',
                        },
                      ]}
                    >
                      <Text style={[styles.reasonText, { color: selected ? '#ff5aa8' : colors.foreground }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional note */}
              <TextInput
                value={note}
                onChangeText={(v) => { setNote(v); setError(null); }}
                maxLength={1000}
                placeholder={COPY.report.notePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: 'rgba(255,255,255,.05)',
                    borderColor: 'rgba(255,255,255,.09)',
                    color: colors.foreground,
                  },
                ]}
              />

              {/* Inline error */}
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={resetAndClose}
                  disabled={loading}
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.09)' },
                  ]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
                    {COPY.report.cancel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!reason || loading}
                  style={[
                    styles.submitBtn,
                    { backgroundColor: reason && !loading ? '#ff2d8e' : 'rgba(255,255,255,.1)' },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.submitBtnText, { color: reason ? '#fff' : '#666' }]}>
                      {COPY.report.submit}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.62)',
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '88%',
  },
  title:    { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '500', marginBottom: 16 },
  reasons:  { gap: 8, marginBottom: 14 },
  reasonBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  reasonText: { fontSize: 14, fontWeight: '600' },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '800' },
  confirmContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { fontSize: 17, fontWeight: '800' },
  confirmBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
});
