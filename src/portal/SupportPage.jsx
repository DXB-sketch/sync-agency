import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABELS = { open: "Open", answered: "Answered", closed: "Closed" };

export default function SupportPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadTickets() {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", activeId)
        .order("created_at");
      setMessages(data ?? []);
    })();
  }, [activeId]);

  async function createTicket(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .insert({ member_id: profile.id, subject: subject.trim() })
      .select()
      .single();
    if (tErr) {
      setError(tErr.message);
      setBusy(false);
      return;
    }
    const { error: mErr } = await supabase
      .from("support_messages")
      .insert({ ticket_id: ticket.id, sender_id: profile.id, body: body.trim() });
    if (mErr) setError(mErr.message);
    setSubject("");
    setBody("");
    setShowNew(false);
    setBusy(false);
    await loadTickets();
    setActiveId(ticket.id);
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    const { error: mErr } = await supabase
      .from("support_messages")
      .insert({ ticket_id: activeId, sender_id: profile.id, body: reply.trim() });
    if (mErr) {
      setError(mErr.message);
    } else {
      setReply("");
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", activeId)
        .order("created_at");
      setMessages(data ?? []);
      await loadTickets();
    }
    setBusy(false);
  }

  const active = tickets.find((t) => t.id === activeId);

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Support</h1>
        <p className="portal-sub">
          Stuck, or need something from the Sync team — a bonus product, a consult call, a store
          audit? Open a ticket and we'll get back to you.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="support-layout">
        <div className="support-list">
          <button className="btn-gold support-new-btn" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancel" : "New ticket"}
          </button>

          {showNew && (
            <form className="support-new-form" onSubmit={createTicket}>
              <input
                className="auth-input"
                placeholder="Subject (e.g. Consult call, Store audit)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
              />
              <textarea
                className="auth-input support-textarea"
                placeholder="Tell us what you need…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                required
              />
              <button className="btn-gold" disabled={busy}>
                {busy ? "Sending…" : "Create ticket"}
              </button>
            </form>
          )}

          {tickets.length === 0 && !showNew && (
            <p className="dash-card-sub">No tickets yet.</p>
          )}
          {tickets.map((t) => (
            <button
              key={t.id}
              className={`support-ticket-row${t.id === activeId ? " active" : ""}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className="support-ticket-subject">{t.subject}</span>
              <span className={`support-status support-status-${t.status}`}>
                {STATUS_LABELS[t.status]}
              </span>
            </button>
          ))}
        </div>

        <div className="support-thread">
          {!active ? (
            <p className="dash-card-sub">Select a ticket to view the conversation.</p>
          ) : (
            <>
              <div className="support-thread-head">
                <h2 className="support-thread-title">{active.subject}</h2>
                <span className={`support-status support-status-${active.status}`}>
                  {STATUS_LABELS[active.status]}
                </span>
              </div>
              <div className="support-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support-msg${m.sender_id === profile.id ? " mine" : " theirs"}`}
                  >
                    <span className="support-msg-who">
                      {m.sender_id === profile.id ? "You" : "Sync team"}
                    </span>
                    <p className="support-msg-body">{m.body}</p>
                    <span className="support-msg-time">
                      {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {active.status !== "closed" ? (
                <form className="support-reply" onSubmit={sendReply}>
                  <textarea
                    className="auth-input support-textarea"
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    required
                  />
                  <button className="btn-gold" disabled={busy}>
                    {busy ? "Sending…" : "Send"}
                  </button>
                </form>
              ) : (
                <p className="dash-card-sub">This ticket is closed. Open a new one if you need more help.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
