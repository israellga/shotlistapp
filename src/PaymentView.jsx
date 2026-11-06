import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, CheckCircle2, Circle, RefreshCw, Copy, Check, Upload, QrCode, Barcode } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import ShotlistMark from "./ShotlistMark";
import ShotlistLogo from "./ShotlistLogo";
import { C, FONT_DISPLAY, FONT_MONO, FONT_BODY } from "./theme";
import { formatBRL } from "./finance";

const SAFETY_POLL_MS = 60000;

function CopyBtn({ text, label = "Copiar" }) {
  const [ok, setOk] = useState(false);
  async function go() {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} document.body.removeChild(t); }
    setOk(true); setTimeout(() => setOk(false), 1800);
  }
  return (
    <button onClick={go} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${ok ? C.sage : C.amber}`, background: ok ? C.sageDim : C.amberDim, color: ok ? C.sage : C.amber, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Copiado" : label}
    </button>
  );
}

function ComprovanteBtn({ planId, parcela, onDone }) {
  const ref = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErr("Arquivo acima de 8 MB."); return; }
    setBusy(true); setErr("");
    try {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const path = `plan/${planId}/${parcela.id}-${Date.now()}.${ext}`;
      const { error: up } = await supabase.storage.from("comprovantes").upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (up) throw new Error("Não consegui enviar. Use foto ou PDF de até 8 MB.");
      const { data: ok, error } = await supabase.rpc("submit_comprovante", { pid: planId, parcela_id: parcela.id, file_path: path, file_name: f.name });
      if (error || !ok) throw new Error("Não consegui registrar o comprovante.");
      onDone();
    } catch (e2) { setErr(e2.message || "Falha ao enviar."); }
    setBusy(false);
  }
  return (
    <div>
      <button onClick={() => ref.current?.click()} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1px solid ${C.line}`, background: "transparent", color: C.paper, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />} Enviar comprovante
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" onChange={pick} style={{ display: "none" }} />
      {err && <div style={{ color: C.brick, fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

export default function PaymentView({ id }) {
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [live, setLive] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setState("error");
      setErrorDetail("Site não conectado ao banco de dados.");
      return;
    }
    try {
      const { data: result, error } = await Promise.race([
        supabase.rpc("get_shared_payment_plan", { pid: id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo esgotado ao buscar os dados.")), 10000)),
      ]);
      if (error) {
        setState("error");
        setErrorDetail(error.message || String(error));
        return;
      }
      if (!result) {
        setState("notfound");
        return;
      }
      setData(result);
      setState("ok");
      setLastFetch(new Date());
    } catch (e) {
      setState("error");
      setErrorDetail(e?.message || String(e));
    }
  }, [id]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`payment:${id}`)
      .on("broadcast", { event: "payment_update" }, (msg) => {
        setData(msg.payload);
        setState("ok");
        setLastFetch(new Date());
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    const interval = setInterval(load, SAFETY_POLL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load, id]);

  if (state === "loading") {
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", height: 300, color: C.faint }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </Shell>
    );
  }

  if (state === "notfound" || state === "error") {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center", color: C.muted }}>
          <AlertCircle size={26} color={C.brick} />
          <div style={{ fontSize: 14.5, maxWidth: 320, lineHeight: 1.6 }}>
            {state === "notfound"
              ? "Esse link não está mais disponível ou o acompanhamento foi desativado."
              : "Não consegui carregar essas informações agora. Tente atualizar a página em instantes."}
          </div>
          {state === "error" && errorDetail && (
            <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO, maxWidth: 320, wordBreak: "break-word", marginTop: -4 }}>
              {errorDetail}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const parcelas = [...(data.parcelas || [])].sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const total = Number(data.valorTotal) || parcelas.reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const pago = parcelas.filter((p) => p.pago).reduce((a, p) => a + (Number(p.valor) || 0), 0);
  const restante = total - pago;
  const countPagas = parcelas.filter((p) => p.pago).length;
  const proxima = parcelas.filter((p) => !p.pago).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))[0];
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;

  return (
    <Shell>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.paper }}>
          {data.titulo || "Pagamento"}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint, marginTop: 4 }}>
          {countPagas}/{parcelas.length} parcelas pagas
        </div>
      </div>

      <div className="glass" style={{ borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO }}>PAGO</div>
            <div style={{ fontSize: 18, color: C.sage, fontWeight: 700 }}>{formatBRL(pago)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.faint, fontFamily: FONT_MONO }}>RESTANTE</div>
            <div style={{ fontSize: 18, color: C.paper, fontWeight: 700 }}>{formatBRL(restante)}</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: C.lineSoft, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.sage, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 11.5, color: C.faint, textAlign: "right" }}>de {formatBRL(total)} no total</div>
      </div>

      {proxima && (
        <div style={{ background: C.amberDim, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.amber }}>Próxima parcela</span>
          <span style={{ fontSize: 13, color: C.amber, fontFamily: FONT_MONO, fontWeight: 600 }}>
            {formatBRL(proxima.valor)}{proxima.vencimento && ` · vence ${proxima.vencimento.split("-").reverse().join("/")}`}
          </span>
        </div>
      )}

      {data.pagamento?.pix && (
        <div className="glass" style={{ borderRadius: 18, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <QrCode size={16} color={C.amber} /><span style={{ fontSize: 14, fontWeight: 600, color: C.paper }}>Pagar por Pix</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: C.paper, wordBreak: "break-all", marginBottom: 4 }}>{data.pagamento.pix}</div>
          {data.pagamento.favorecido && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>Favorecido: {data.pagamento.favorecido}</div>}
          <CopyBtn text={data.pagamento.pix} label="Copiar chave Pix" />
          {data.pagamento.instrucoes && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>{data.pagamento.instrucoes}</div>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {parcelas.map((p) => (
          <div key={p.numero} className="glass" style={{ borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {p.pago ? <CheckCircle2 size={17} color={C.sage} /> : <Circle size={17} color={C.faint} />}
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.faint, width: 24 }}>{String(p.numero).padStart(2, "0")}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: p.pago ? C.faint : C.paper, textDecoration: p.pago ? "line-through" : "none" }}>
                {formatBRL(p.valor)}
              </span>
              {p.vencimento && (
                <span style={{ fontSize: 12, color: C.faint, fontFamily: FONT_MONO }}>{p.vencimento.split("-").reverse().join("/")}</span>
              )}
            </div>
            {!p.pago && p.boleto && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, marginBottom: 4 }}><Barcode size={13} /> LINHA DIGITÁVEL DO BOLETO</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.paper, wordBreak: "break-all", marginBottom: 8 }}>{p.boleto}</div>
                <CopyBtn text={p.boleto.replace(/[^\d]/g, "")} label="Copiar linha digitável" />
              </div>
            )}
            {!p.pago && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <ComprovanteBtn planId={id} parcela={p} onDone={load} />
                {Number(p.comprovantes) > 0 && <span style={{ fontSize: 12.5, color: C.sage }}>{p.comprovantes} comprovante{p.comprovantes > 1 ? "s" : ""} enviado{p.comprovantes > 1 ? "s" : ""}, aguardando confirmação</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {lastFetch && (
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: C.faint, fontFamily: FONT_MONO, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span className={live ? "live-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: live ? C.sage : C.faint, display: "inline-block" }} />
          {live ? "Ao vivo" : "Atualizado"} às {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT_BODY, padding: "24px 16px 60px", paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(60px, env(safe-area-inset-bottom))" }}>
      <div style={{ maxWidth: 560, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <ShotlistLogo size={24} />
        <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, color: C.faint }}>
          Acompanhamento de pagamento
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button { font-family: inherit; }`}</style>
    </div>
  );
}
