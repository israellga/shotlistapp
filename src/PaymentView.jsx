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
  const [more, setMore] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (data?.titulo) document.title = `${data.titulo} · Pagamento`;
  }, [data?.titulo]);

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
  const restante = Math.max(0, total - pago);
  const countPagas = parcelas.filter((p) => p.pago).length;
  const proxima = parcelas.filter((p) => !p.pago).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))[0];
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const atrasada = proxima && proxima.vencimento && proxima.vencimento < hoje;
  const br = (iso) => (iso || "").split("-").reverse().join("/");
  const pg = data.pagamento || {};

  return (
    <Shell>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.paper, lineHeight: 1.2, marginBottom: 14 }}>
        {data.titulo || "Pagamento"}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: C.muted, marginBottom: 8 }}>
          <span>{countPagas} de {parcelas.length} parcelas pagas</span>
          {restante > 0 && <span>Falta {formatBRL(restante)}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.sage, transition: "width 0.3s" }} />
        </div>
      </div>

      {!proxima ? (
        <div className="glass" style={{ borderRadius: 20, padding: "22px 20px", textAlign: "center", marginBottom: 22 }}>
          <CheckCircle2 size={28} color={C.sage} />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.paper, marginTop: 8 }}>Tudo pago</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Obrigado!</div>
        </div>
      ) : (
        <div className="glass glass-edge" style={{ borderRadius: 22, padding: "20px 20px 18px", marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: atrasada ? C.brick : C.muted, marginBottom: 4 }}>
            {atrasada ? "Parcela em atraso" : "Próxima parcela"} · {String(proxima.numero).padStart(2, "0")} de {String(parcelas.length).padStart(2, "0")}
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 700, color: C.paper, lineHeight: 1.1 }}>{formatBRL(proxima.valor)}</div>
          {proxima.vencimento && <div style={{ fontSize: 14, color: atrasada ? C.brick : C.muted, marginTop: 4 }}>{atrasada ? "Venceu em" : "Vence em"} {br(proxima.vencimento)}</div>}

          {proxima.asaasUrl ? (
            <a href={proxima.asaasUrl} target="_blank" rel="noreferrer" className="btn-glass-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 26, marginTop: 18, textDecoration: "none", fontSize: 16, fontWeight: 700 }}>
              Pagar agora
            </a>
          ) : pg.pix ? (
            <div style={{ marginTop: 18 }}><CopyBtn text={pg.pix} label="Copiar chave Pix" /></div>
          ) : null}
          {proxima.asaasUrl && <div style={{ fontSize: 12.5, color: C.faint, textAlign: "center", marginTop: 8 }}>Pix, boleto ou cartão</div>}

          <button onClick={() => setMore((v) => !v)} style={{ display: "block", width: "100%", minHeight: 44, marginTop: 10, background: "transparent", border: "none", color: C.muted, fontSize: 13.5, cursor: "pointer" }}>
            {more ? "Ocultar" : "Outras formas de pagar e comprovante"}
          </button>

          {more && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}` }}>
              {proxima.pixCopia && (
                <div>
                  <div style={miniLabel}><QrCode size={13} /> PIX COPIA E COLA</div>
                  <CopyBtn text={proxima.pixCopia} label="Copiar código Pix" />
                </div>
              )}
              {pg.pix && (
                <div>
                  <div style={miniLabel}><QrCode size={13} /> CHAVE PIX</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: C.paper, wordBreak: "break-all", marginBottom: 6 }}>{pg.pix}</div>
                  {pg.favorecido && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>Favorecido: {pg.favorecido}</div>}
                  <CopyBtn text={pg.pix} label="Copiar chave Pix" />
                  {pg.instrucoes && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{pg.instrucoes}</div>}
                </div>
              )}
              {proxima.boleto && (
                <div>
                  <div style={miniLabel}><Barcode size={13} /> BOLETO</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: C.paper, wordBreak: "break-all", marginBottom: 8 }}>{proxima.boleto}</div>
                  <CopyBtn text={proxima.boleto.replace(/[^\d]/g, "")} label="Copiar linha digitável" />
                </div>
              )}
              <div>
                <div style={miniLabel}><Upload size={13} /> JÁ PAGOU?</div>
                <ComprovanteBtn planId={id} parcela={proxima} onDone={load} />
                {Number(proxima.comprovantes) > 0 && <div style={{ fontSize: 12.5, color: C.sage, marginTop: 8 }}>{proxima.comprovantes} comprovante{proxima.comprovantes > 1 ? "s" : ""} enviado{proxima.comprovantes > 1 ? "s" : ""}, aguardando confirmação.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {parcelas.length > 1 && (
        <div>
          <button onClick={() => setShowAll((v) => !v)} style={{ display: "block", width: "100%", minHeight: 44, background: "transparent", border: "none", color: C.muted, fontSize: 13.5, cursor: "pointer", textAlign: "left", padding: 0 }}>
            {showAll ? "Ocultar parcelas" : `Ver todas as parcelas (${parcelas.length})`}
          </button>
          {showAll && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              {parcelas.map((p) => (
                <div key={p.numero} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, borderBottom: `1px solid ${C.lineSoft}`, opacity: p.pago ? 0.55 : 1 }}>
                  {p.pago ? <CheckCircle2 size={16} color={C.sage} /> : <Circle size={16} color={C.faint} />}
                  <span style={{ flex: 1, fontSize: 14, color: C.paper }}>{formatBRL(p.valor)}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{p.pago ? "Pago" : p.vencimento ? br(p.vencimento) : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lastFetch && (
        <div style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: C.faint, fontFamily: FONT_MONO, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span className={live ? "live-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: live ? C.sage : C.faint, display: "inline-block" }} />
          {live ? "Ao vivo" : "Atualizado"} às {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </Shell>
  );
}

const miniLabel = { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.faint, fontFamily: FONT_MONO, letterSpacing: 0.4, marginBottom: 8 };

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "transparent", fontFamily: FONT_BODY, padding: "24px 16px 60px", paddingTop: "max(24px, env(safe-area-inset-top))", paddingBottom: "max(60px, env(safe-area-inset-bottom))" }}>
      <div style={{ maxWidth: 560, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <ShotlistLogo size={24} />
        <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: 0.5, color: C.faint }}>
          Pagamento
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button { font-family: inherit; }`}</style>
    </div>
  );
}
