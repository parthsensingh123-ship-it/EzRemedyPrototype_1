import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { chatApi, billingApi } from '../lib/api';
import Modal from './Modal';

export default function ConsultationSuiteModal({ appointment, currentUser, initialTab = 'chat', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, appointment?.id]);

  // Load & subscribe to real-time chat messages
  useEffect(() => {
    if (!appointment?.id) return undefined;

    chatApi.list(appointment.id).then(setMessages).catch(() => {});

    const channel = supabase
      .channel(`chat-room-${appointment.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `appointment_id=eq.${appointment.id}`
        },
        () => {
          chatApi.list(appointment.id).then(setMessages).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointment?.id]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  // Fetch or generate billing receipt when Receipt tab is opened
  useEffect(() => {
    if (!appointment?.id || activeTab !== 'receipt') return;
    setLoadingInvoice(true);
    billingApi
      .getByAppointment(appointment)
      .then(setInvoice)
      .catch(() => {})
      .finally(() => setLoadingInvoice(false));
  }, [appointment, activeTab]);

  if (!appointment) return null;

  const isPatient = currentUser?.role === 'patient';
  const counterpartName = isPatient
    ? `Dr. ${appointment.doctor?.full_name || 'Doctor'}`
    : appointment.patient?.full_name || 'Patient';
  const receiverId = isPatient
    ? appointment.doctor_id || appointment.doctor?.id
    : appointment.patient_id || appointment.patient?.id;

  const videoRoomUrl =
    appointment.meeting_link || `https://meet.jit.si/EzRemedy-${appointment.id.slice(0, 8)}`;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const sent = await chatApi.send(appointment.id, newMessage, receiverId);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setNewMessage('');
    } catch (err) {
      alert(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} onClose={onClose} title={`Consultation · ${counterpartName}`}>
      {/* Sub-navigation Tabs */}
      <div className="flex gap-2 border-b border-hairline mb-4">
        {[
          { id: 'chat', label: 'Live Chat' },
          { id: 'video', label: 'Video Call' },
          { id: 'receipt', label: 'Billing Receipt' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: REAL-TIME DOCTOR-PATIENT CHATBOX */}
      {activeTab === 'chat' && (
        <div>
          <div className="h-64 overflow-y-auto bg-paper border border-hairline rounded p-3 mb-3 space-y-2.5">
            {messages.length === 0 ? (
              <p className="text-xs text-muted text-center py-16">
                No messages yet. Start the consultation chat with {counterpartName}.
              </p>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === currentUser?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-faint mb-0.5">
                      {isMine ? 'You' : msg.sender?.full_name || counterpartName} ·{' '}
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded text-xs leading-relaxed ${
                        isMine
                          ? 'bg-accent text-paper'
                          : 'bg-panel text-ink border border-hairline'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder={`Message ${counterpartName}…`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="field-input flex-1 text-xs"
            />
            <button type="submit" disabled={sending} className="btn-primary text-xs px-4">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: EMBEDDED VIDEO CALL ROOM */}
      {activeTab === 'video' && (
        <div>
          <div className="w-full h-72 rounded overflow-hidden border border-hairline bg-ink mb-3">
            <iframe
              title="EzRemedy Teleconsultation Video Room"
              src={`${videoRoomUrl}#config.prejoinPageEnabled=false`}
              allow="camera; microphone; fullscreen; display-capture"
              className="w-full h-full border-0"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">End-to-end encrypted WebRTC room</span>
            <a
              href={videoRoomUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent font-medium hover:underline"
            >
              Open in full screen tab ↗
            </a>
          </div>
        </div>
      )}

      {/* TAB 3: ITEMIZED GST BILLING RECEIPT */}
      {activeTab === 'receipt' && (
        <div>
          {loadingInvoice ? (
            <p className="text-xs text-muted py-10 text-center">Generating official invoice receipt…</p>
          ) : invoice ? (
            <div>
              <div className="bg-paper border border-hairline rounded p-4 mb-4 text-xs">
                <div className="flex justify-between items-start border-b border-hairline pb-3 mb-3">
                  <div>
                    <p className="font-display text-base font-semibold text-ink">EzRemedy Health Pvt. Ltd.</p>
                    <p className="text-muted">Tax Invoice & Consultation Receipt</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-ink">{invoice.invoice_number}</p>
                    <p className="text-status-approved font-medium uppercase">{invoice.payment_status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-muted">
                  <div>
                    <p><strong className="text-ink">Patient:</strong> {invoice.patient?.full_name || appointment.patient?.full_name}</p>
                    <p><strong className="text-ink">Doctor:</strong> Dr. {invoice.doctor?.full_name || appointment.doctor?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p><strong className="text-ink">Date:</strong> {new Date(invoice.issued_at).toLocaleDateString('en-IN')}</p>
                    <p><strong className="text-ink">Txn Ref:</strong> {invoice.transaction_ref}</p>
                  </div>
                </div>

                <div className="border-t border-hairline pt-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted">Specialist Consultation Fee</span>
                    <span className="text-ink">₹{Number(invoice.consultation_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Digital Care & Platform Fee</span>
                    <span className="text-ink">₹{Number(invoice.platform_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">GST (5%)</span>
                    <span className="text-ink">₹{Number(invoice.tax_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-hairline pt-2 font-semibold text-sm text-ink">
                    <span>Total Paid ({invoice.payment_method})</span>
                    <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button onClick={() => window.print()} className="btn-primary w-full text-xs">
                Print / Download PDF Receipt
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted py-6 text-center">Unable to load invoice details.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
