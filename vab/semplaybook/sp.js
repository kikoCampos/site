/* Sem Playbook · cliente comum (celular, telão, painel) */
window.SP = (() => {
  /* URL /exec do Apps Script (Code.gs). Vazio = modo demonstração local, sem servidor. */
  const ENDPOINT = "";
  const DEMO = !ENDPOINT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get: k => { try { return JSON.parse(localStorage.getItem("sp_" + k)); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem("sp_" + k, JSON.stringify(v)); } catch (e) { } },
    del: k => { try { localStorage.removeItem("sp_" + k); } catch (e) { } }
  };
  const qs = new URLSearchParams(location.search);
  const token = qs.get("k") || store.get("token") || "";
  if (qs.get("k")) store.set("token", qs.get("k"));

  let toastT; function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
  }

  async function api(a, body = {}) {
    if (DEMO) return demo(a, body);
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ a, k: token }, body)) });
    return r.json();
  }

  /* contador de caracteres */
  function counters(root = document) {
    $$("[maxlength]", root).forEach(el => {
      const c = document.createElement("div"); c.className = "count"; el.insertAdjacentElement("afterend", c);
      const up = () => { c.textContent = el.value.length + " / " + el.maxLength; c.classList.toggle("over", el.value.length >= el.maxLength); };
      el.addEventListener("input", up); up();
    });
  }

  /* ---------- modo demonstração: simula o servidor no próprio navegador ---------- */
  const DK = "sp_demo_db";
  function db() { return store.get("demo_db") || { config: { tela_celular: "checkin", tela_telao: "chegada", n_mesas: "5", mesas_escolhidas: "", joao_atual: "", prazo: "" }, inscritos: [], checkin: [], votos: [], recomendacoes: [], pos: [], colheita: [], joao: [] }; }
  function save(d) { store.set("demo_db", d); }
  const REC_TXT = { aprovar: "Aprovar", rejeitar: "Rejeitar", condicoes: "Aprovar com condições" };
  function tally(o) { return { aprovar: o.filter(x => x === "aprovar").length, rejeitar: o.filter(x => x === "rejeitar").length, condicoes: o.filter(x => x === "condicoes").length }; }
  function telaoData(d) {
    const n = parseInt(d.config.n_mesas, 10) || 5; const mesas = [];
    for (let m = 1; m <= n; m++) mesas.push({ mesa: m, quem: d.inscritos.filter(r => r.mesa === m).map(r => r.nome), rec: d.recomendacoes.find(r => r.mesa === m) || null, pos: d.pos.find(r => r.mesa === m) || null });
    const atual = d.config.joao_atual ? d.joao.find(x => x.id === d.config.joao_atual) : null;
    return { n_mesas: n, frases: d.checkin.filter(r => r.consent && r.dilema).map(r => r.dilema), checkins: d.checkin.length, inscritos: d.inscritos.length, votos: tally(d.votos.map(r => r.voto)), votos_n: d.votos.length, recs: tally(d.recomendacoes.map(r => r.rec)), recs_n: d.recomendacoes.length, mesas, riscos_sim: d.recomendacoes.map(r => r.risco_sim), riscos_nao: d.recomendacoes.map(r => r.risco_nao), pos_n: d.pos.length, mantiveram: d.pos.filter(r => r.sobrevive === "mantemos").length, mudaram: d.pos.filter(r => r.sobrevive === "mudamos").length, colheita: d.colheita.map(r => r.frase), colheita_n: d.colheita.length, joao_atual: atual || null };
  }
  async function demo(a, b) {
    await new Promise(r => setTimeout(r, 120));
    const d = db(); const m = parseInt(b.mesa, 10) || 0; const ts = new Date().toISOString();
    switch (a) {
      case "state": return { ok: true, config: d.config, demo: true };
      case "inscritos": return { ok: true, lista: d.inscritos };
      case "mesa": return { ok: true, mesa: m, quem: d.inscritos.filter(r => r.mesa === m).map(r => r.nome), rec: d.recomendacoes.find(r => r.mesa === m) || null, pos: d.pos.find(r => r.mesa === m) || null };
      case "telao": return Object.assign({ ok: true, config: d.config, demo: true }, telaoData(d));
      case "painel": return Object.assign({ ok: true, config: d.config, demo: true }, telaoData(d), { joao: d.joao.slice(-20) });
      case "checkin": d.checkin.push({ ts, nome: b.nome, mesa: m, dilema: b.dilema || "", consent: !!b.consent }); save(d); return { ok: true, mesa: m };
      case "voto": if (!d.votos.some(r => r.nome === b.nome)) d.votos.push({ ts, nome: b.nome, mesa: m, voto: b.voto }); save(d); return { ok: true };
      case "recomendacao": if (d.recomendacoes.some(r => r.mesa === m)) return { ok: false, locked: true }; d.recomendacoes.push(Object.assign({ ts, mesa: m }, b)); save(d); return { ok: true };
      case "pos": if (d.pos.some(r => r.mesa === m)) return { ok: false, locked: true }; d.pos.push(Object.assign({ ts, mesa: m }, b)); save(d); return { ok: true };
      case "colheita": d.colheita.push({ ts, nome: b.nome, mesa: m, frase: b.frase }); save(d); return { ok: true };
      case "set": Object.assign(d.config, b.set || {}); save(d); return { ok: true, config: d.config };
      case "joao_gerar": { const id = "j" + Date.now(); const texto = b.modo === "reviravolta" ? "Preciso interromper. Chegaram duas notícias ao conselho. A matriz assinou memorando de entendimento para a venda da fábrica madura, com fechamento em noventa dias, e o comprador exige a liderança intacta e sem terceiros até o fechamento. E o sindicato convocou assembleia para a semana que vem, com pauta única: a venda, os terceiros e os agentes de IA. O comprador quer que nada mude. O sindicato quer saber o que vai mudar. Cada consultoria tem quinze minutos para dizer se a recomendação que fez sobrevive. A pergunta é a mesma para todas: o que esta consultoria recomenda que o conselho instrua a gestão a fazer até a assembleia?" : "[Demonstração, sem modelo de linguagem] Esta consultoria recomendou, e escreveu o porquê e os riscos. O que eu não vi na recomendação foi quem perde com ela. No caso há gerentes que deixam de reportar ao vice-presidente, um sindicato que lê venda, terceiros e IA como um pacote só, e um presidente que preferia outro caminho. Minha pergunta: qual dessas três pessoas esta consultoria recomenda que o conselho ouça antes do anúncio, e quem vai ouvir?"; d.joao.push({ id, ts, modo: b.modo, mesa: m || "", texto, status: "rascunho" }); save(d); return { ok: true, id, texto, modo: b.modo, mesa: m || "" }; }
      case "joao_tocar": d.config.joao_atual = b.id; d.config.tela_telao = b.tela || "joao"; const jj = d.joao.find(x => x.id === b.id); if (jj) jj.status = "tocado"; save(d); return { ok: true };
      case "joao_texto": { const j = d.joao.find(x => x.id === b.id); if (j) j.texto = b.texto; save(d); return { ok: true }; }
      case "reset_rodada": store.del("demo_db"); return { ok: true };
      case "demo_inscritos": d.inscritos = b.lista; save(d); return { ok: true };
    }
    return { ok: false, erro: "acao" };
  }

  return { ENDPOINT, DEMO, $, $$, esc, store, qs, token, toast, api, counters, REC_TXT };
})();
