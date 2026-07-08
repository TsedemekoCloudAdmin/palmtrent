import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, UploadCloud, ExternalLink } from 'lucide-react';
import { bookingsAPI, resolveApiUrl } from '../services/api';

const DOC_TYPES = [
  { id: 'purchase_order', label: 'Purchase Order', hint: 'Confirms the customer order' },
  { id: 'delivery_note', label: 'Delivery Note', hint: 'Lists items, quantities, and units' },
  { id: 'grv', label: 'Goods Received Voucher', hint: 'Acknowledges receipt of goods' },
];

const labelForType = (type) => DOC_TYPES.find(d => d.id === type)?.label || String(type || 'Document').replace(/_/g, ' ');

// Modal for attaching/viewing business documents (PO, Delivery Note, GRV) on a
// booking. Uploads the file to storage, then links it to the booking.
const BusinessDocuments = ({ bookingId, bookingRef, onClose }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);
  const [message, setMessage] = useState('');
  const fileInputs = useRef({});

  const load = async () => {
    if (!bookingId) { setLoading(false); return; }
    try {
      setLoading(true);
      const response = await bookingsAPI.getDocuments(bookingId);
      setDocuments(response.data || []);
    } catch (error) {
      setMessage(error.message || 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bookingId]);

  const handleFile = async (docType, file) => {
    if (!file) return;
    try {
      setUploadingType(docType.id);
      setMessage('');
      const uploadRes = await bookingsAPI.uploadDocumentFile(file);
      const url = uploadRes.data?.url || uploadRes.data?.path;
      if (!url) throw new Error('Upload did not return a file URL.');
      await bookingsAPI.addDocument(bookingId, { type: docType.id, name: docType.label, url });
      await load();
      setMessage(`${docType.label} uploaded.`);
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Business Documents</h3>
            {bookingRef ? <p style={styles.sub}>Booking {bookingRef}</p> : null}
          </div>
          <button type="button" style={styles.close} onClick={onClose}><X size={18} /></button>
        </div>

        {message ? <p style={styles.message}>{message}</p> : null}
        {loading ? <p style={styles.message}>Loading documents…</p> : null}

        {DOC_TYPES.map((docType) => {
          const existing = documents.filter(d => d.type === docType.id);
          const isUploading = uploadingType === docType.id;
          return (
            <div key={docType.id} style={styles.card}>
              <div style={styles.cardTop}>
                <FileText size={18} color="#0C2D48" />
                <div style={{ flex: 1 }}>
                  <div style={styles.cardTitle}>{docType.label}</div>
                  <div style={styles.cardHint}>{docType.hint}</div>
                </div>
              </div>

              {existing.map((doc, i) => (
                <a key={i} href={resolveApiUrl(doc.url)} target="_blank" rel="noreferrer" style={styles.docRow}>
                  <FileText size={15} color="#16a34a" />
                  <span style={styles.docRowText}>
                    {doc.name || labelForType(doc.type)}
                    {doc.uploadedAt ? ` • ${new Date(doc.uploadedAt).toLocaleDateString()}` : ''}
                  </span>
                  <ExternalLink size={14} color="#6b7280" />
                </a>
              ))}

              <input
                ref={(el) => { fileInputs.current[docType.id] = el; }}
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e) => { handleFile(docType, e.target.files?.[0]); e.target.value = ''; }}
              />
              <button
                type="button"
                style={styles.uploadBtn}
                disabled={isUploading || !bookingId}
                onClick={() => fileInputs.current[docType.id]?.click()}
              >
                <UploadCloud size={16} />
                {isUploading ? 'Uploading…' : (existing.length ? 'Add another' : `Upload ${docType.label}`)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0C2D48' },
  sub: { margin: '2px 0 0', fontSize: 13, color: '#6b7280' },
  close: { background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  message: { color: '#6b7280', fontSize: 13, marginBottom: 12 },
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#111827' },
  cardHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  docRow: { display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 8, textDecoration: 'none' },
  docRowText: { flex: 1, fontSize: 13, color: '#166534' },
  uploadBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: '1px dashed #0C2D48', background: '#fff', borderRadius: 8, padding: '10px 12px', color: '#0C2D48', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
};

export default BusinessDocuments;
