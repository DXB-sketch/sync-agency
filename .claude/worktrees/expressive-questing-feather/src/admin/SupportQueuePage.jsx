import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABELS = { open: "Open", answered: "Answered", closed: "Closed" };

export default function SupportQueuePage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadTickets() {
    const { data } = await supabase
      .from("support_tickets")
      .select("*, profiles(full_name, email)")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadMessages(ticketId) {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at");
    setMessages(data ?? []);
  }

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

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
      await Promise.all([loadMessages(activeId), loadTickets()]);
    }
    setBusy(false);
  }

  async function setStatus(status) {
    setBusy(true);
    const { error: uErr } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", activeId);
    if (uErr) setError(uErr.message);
    await loadTickets();
    setBusy(false);
  }

  const active = tickets.find((t) => t.id === activeId);

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Support Queue</h1>
        <p className="portal-sub">Member tickets — reply, resolve, close.</p>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="support-layout">
        <div className="support-list">
          {tickets.length === 0 && <p className="dash-card-sub">No tickets yet.</p>}
          {tickets.map((t) => (
            <button
              key={t.id}
              className={`support-ticket-row${t.id === activeId ? " active" : ""}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className="support-ticket-subject">
                {t.subject}
                <span className="support-ticket-member">
                  {t.profiles?.full_name || t.profiles?.email}
                </span>
              </span>
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
                <div>
                  <h2 className="support-thread-title">{active.subject}</h2>
                  <p className="dash-card-sub">
                    {active.profiles?.full_name || "—"} · {active.profiles?.email}
                  </p>
                </div>
                <div className="support-thread-tools">
                  <span className={`support-status support-status-${active.status}`}>
                    {STATUS_LABELS[active.status]}
                  </span>
                  {active.status !== "closed" ? (
                    <button className="btn-ghost" disabled={busy} onClick={() => setStatus("closed")}>
                      Close
                    </button>
                  ) : (
                    <button className="btn-ghost" disabled={busy} onClick={() => setStatus("open")}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>
              <div className="support-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support-msg${m.sender_id === profile.id ? " mine" : " theirs"}`}
                  >
                    <span className="support-msg-who">
                      {m.sender_id === active.member_id ? "Member" : "Sync team"}
                    </span>
                    <p className="support-msg-body">{m.body}</p>
                    <span className="support-msg-time">
                      {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {active.status !== "closed" && (
                <form className="support-reply" onSubmit={sendReply}>
                  <textarea
                    className="auth-input support-textarea"
                    placeholder="Reply as the Sync team…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    required
                  />
                  <button className="btn-gold" disabled={busy}>
                    {busy ? "Sending…" : "Send reply"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
