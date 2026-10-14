/**
 * Sem Playbook · VAB 21 de outubro de 2026
 * Backend da plataforma (Google Apps Script, publicado como web app).
 *
 * Planilha: "Sem Playbook · VAB" com as abas criadas por setup():
 *   config, inscritos, checkin, votos, recomendacoes, pos, colheita, joao, caso
 *
 * Propriedades do script (Extensões > Apps Script > Configurações do projeto > Propriedades):
 *   ANTHROPIC_KEY   chave da API do modelo
 *   OPERATOR_TOKEN  senha do painel (qualquer texto; vai na URL do painel e do telão: ?k=...)
 *   MODEL           opcional; padrão abaixo
 *
 * Implantar: Implantar > Nova implantação > App da Web > Executar como "eu", acesso "Qualquer pessoa".
 * Copiar a URL /exec para a constante ENDPOINT em sp.js.
 */

const MODEL_DEFAULT = "claude-sonnet-4-5";
const SHEETS = {
  config: ["chave", "valor"],
  inscritos: ["Grupo", "Nome", "E-mail", "Empresa", "Função", "Papel sugerido", "Picos"],
  checkin: ["ts", "nome", "mesa", "dilema", "consent"],
  votos: ["ts", "nome", "mesa", "voto"],
  recomendacoes: ["ts", "mesa", "rec", "cond1", "cond2", "cond3", "porque", "risco_sim", "risco_nao", "divergente", "indicador", "enviado_por"],
  pos: ["ts", "mesa", "sobrevive", "o_que_muda", "nova_rec", "instrucao", "enviado_por"],
  colheita: ["ts", "nome", "mesa", "frase"],
  joao: ["id", "ts", "modo", "mesa", "texto", "status"],
  caso: ["texto"]
};
const CONFIG_DEFAULT = {
  tela_celular: "checkin",   // checkin | mesa | voto | recomendacao | reviravolta | colheita | fechado
  tela_telao: "chegada",     // chegada | mesas | voto | aguardando | placar | joao | reviravolta | placar2 | plenaria | casoB | checklist
  n_mesas: "5",
  mesas_escolhidas: "",      // ex.: "2,5"
  joao_atual: "",            // id da fala do João que o telão deve tocar
  prazo: ""                  // ISO do fim do tempo da rodada (telão mostra contagem)
};

/* ---------- utilidades ---------- */
function ss() { return SpreadsheetApp.getActive(); }
function sheet(name) {
  let s = ss().getSheetByName(name);
  if (!s) { s = ss().insertSheet(name); s.appendRow(SHEETS[name]); s.setFrozenRows(1); }
  return s;
}
function rows(name) {
  const s = sheet(name); const v = s.getDataRange().getValues(); if (v.length < 2) return [];
  const h = v[0]; return v.slice(1).filter(r => r.join("") !== "").map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
}
function append(name, obj) { const h = SHEETS[name]; sheet(name).appendRow(h.map(k => obj[k] === undefined ? "" : obj[k])); }
function config() { const o = Object.assign({}, CONFIG_DEFAULT); rows("config").forEach(r => o[r.chave] = String(r.valor)); return o; }
function setConfig(k, v) {
  const s = sheet("config"); const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (data[i][0] === k) { s.getRange(i + 1, 2).setValue(v); return; }
  s.appendRow([k, v]);
}
function now() { return Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ""; }
function clip(s, n) { s = String(s || "").trim(); return s.length > n ? s.slice(0, n) : s; }
function nmesa(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

/* ---------- primeira execução ---------- */
function setup() {
  Object.keys(SHEETS).forEach(sheet);
  Object.keys(CONFIG_DEFAULT).forEach(k => { if (!rows("config").some(r => r.chave === k)) sheet("config").appendRow([k, CONFIG_DEFAULT[k]]); });
  const c = sheet("caso"); if (c.getLastRow() < 2) c.appendRow(["COLE AQUI O TEXTO INTEGRAL DO CASO (A)"]);
}

/* ---------- entrada ---------- */
function doGet(e) { return out({ ok: true, app: "Sem Playbook", config: config() }); }
function doPost(e) {
  let b = {}; try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, erro: "json" }); }
  const lock = LockService.getScriptLock(); lock.tryLock(8000);
  try { return out(handle(b)); }
  catch (err) { return out({ ok: false, erro: String(err) }); }
  finally { lock.releaseLock(); }
}

function handle(b) {
  const a = b.a; const cfg = config();
  const isOp = b.k && b.k === prop("OPERATOR_TOKEN");

  /* --- leitura --- */
  if (a === "state") return { ok: true, config: cfg, t: now() };
  if (a === "inscritos") return { ok: true, lista: rows("inscritos").map(r => ({ nome: r["Nome"], mesa: nmesa(r["Grupo"]), empresa: r["Empresa"] })) };
  if (a === "mesa") {
    const m = nmesa(b.mesa);
    const quem = rows("inscritos").filter(r => nmesa(r["Grupo"]) === m).map(r => r["Nome"]);
    const rec = rows("recomendacoes").find(r => nmesa(r.mesa) === m) || null;
    const pos = rows("pos").find(r => nmesa(r.mesa) === m) || null;
    return { ok: true, mesa: m, quem, rec, pos };
  }
  if (a === "telao") return Object.assign({ ok: true, config: cfg, t: now() }, telaoData(cfg));
  if (a === "painel") { if (!isOp) return { ok: false, erro: "token" }; return Object.assign({ ok: true, config: cfg, t: now() }, telaoData(cfg), { joao: rows("joao").slice(-20), inscritos: rows("inscritos").length }); }

  /* --- escrita do participante --- */
  if (a === "checkin") {
    if (!b.nome) return { ok: false, erro: "nome" };
    const m = nmesa(b.mesa) || mesaDe(b.nome);
    append("checkin", { ts: now(), nome: clip(b.nome, 80), mesa: m, dilema: clip(b.dilema, 140), consent: b.consent ? 1 : 0 });
    return { ok: true, mesa: m };
  }
  if (a === "voto") {
    if (!["aprovar", "rejeitar", "condicoes"].includes(b.voto)) return { ok: false, erro: "voto" };
    const nome = clip(b.nome, 80); const m = nmesa(b.mesa);
    if (rows("votos").some(r => r.nome === nome)) return { ok: true, repetido: true };
    append("votos", { ts: now(), nome, mesa: m, voto: b.voto }); return { ok: true };
  }
  if (a === "recomendacao") {
    const m = nmesa(b.mesa); if (!m) return { ok: false, erro: "mesa" };
    if (rows("recomendacoes").some(r => nmesa(r.mesa) === m)) return { ok: false, locked: true };
    if (!["aprovar", "rejeitar", "condicoes"].includes(b.rec)) return { ok: false, erro: "rec" };
    if (!b.porque || !b.risco_sim || !b.risco_nao) return { ok: false, erro: "campos" };
    append("recomendacoes", { ts: now(), mesa: m, rec: b.rec, cond1: clip(b.cond1, 100), cond2: clip(b.cond2, 100), cond3: clip(b.cond3, 100), porque: clip(b.porque, 200), risco_sim: clip(b.risco_sim, 120), risco_nao: clip(b.risco_nao, 120), divergente: clip(b.divergente, 100), indicador: clip(b.indicador, 80), enviado_por: clip(b.nome, 80) });
    return { ok: true };
  }
  if (a === "pos") {
    const m = nmesa(b.mesa); if (!m) return { ok: false, erro: "mesa" };
    if (rows("pos").some(r => nmesa(r.mesa) === m)) return { ok: false, locked: true };
    if (!["mantemos", "mudamos"].includes(b.sobrevive) || !b.instrucao) return { ok: false, erro: "campos" };
    append("pos", { ts: now(), mesa: m, sobrevive: b.sobrevive, o_que_muda: clip(b.o_que_muda, 200), nova_rec: b.sobrevive === "mudamos" ? (b.nova_rec || "") : "", instrucao: clip(b.instrucao, 140), enviado_por: clip(b.nome, 80) });
    return { ok: true };
  }
  if (a === "colheita") {
    if (!b.frase) return { ok: false, erro: "frase" };
    append("colheita", { ts: now(), nome: clip(b.nome, 80), mesa: nmesa(b.mesa), frase: clip(b.frase, 140) }); return { ok: true };
  }

  /* --- operador --- */
  if (!isOp) return { ok: false, erro: "token" };
  if (a === "set") { Object.keys(b.set || {}).forEach(k => setConfig(k, String(b.set[k]))); return { ok: true, config: config() }; }
  if (a === "joao_gerar") return joaoGerar(b, cfg);
  if (a === "joao_tocar") { setConfig("joao_atual", String(b.id)); setConfig("tela_telao", b.tela || "joao"); marcarJoao(b.id, "tocado"); return { ok: true }; }
  if (a === "joao_texto") { // operador editou o texto antes de tocar
    const s = sheet("joao"); const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) if (String(d[i][0]) === String(b.id)) { s.getRange(i + 1, 5).setValue(clip(b.texto, 1200)); return { ok: true }; }
    return { ok: false, erro: "id" };
  }
  if (a === "reset_rodada") { // apaga só o que a rodada produziu (para o ensaio)
    ["checkin", "votos", "recomendacoes", "pos", "colheita", "joao"].forEach(n => { const s = sheet(n); if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1); });
    Object.keys(CONFIG_DEFAULT).forEach(k => setConfig(k, CONFIG_DEFAULT[k])); return { ok: true };
  }
  return { ok: false, erro: "acao" };
}

function mesaDe(nome) { const r = rows("inscritos").find(x => String(x["Nome"]).trim().toLowerCase() === String(nome).trim().toLowerCase()); return r ? nmesa(r["Grupo"]) : 0; }

/* ---------- dados agregados do telão ---------- */
function telaoData(cfg) {
  const n = nmesa(cfg.n_mesas) || 5;
  const ins = rows("inscritos"), ck = rows("checkin"), vt = rows("votos"), rc = rows("recomendacoes"), ps = rows("pos"), co = rows("colheita");
  const mesas = []; for (let m = 1; m <= n; m++) mesas.push({ mesa: m, quem: ins.filter(r => nmesa(r["Grupo"]) === m).map(r => r["Nome"]), rec: rc.find(r => nmesa(r.mesa) === m) || null, pos: ps.find(r => nmesa(r.mesa) === m) || null });
  const tally = o => ({ aprovar: o.filter(x => x === "aprovar").length, rejeitar: o.filter(x => x === "rejeitar").length, condicoes: o.filter(x => x === "condicoes").length });
  const j = rows("joao"); const atual = cfg.joao_atual ? j.find(x => String(x.id) === String(cfg.joao_atual)) : null;
  return {
    n_mesas: n,
    frases: ck.filter(r => r.consent && r.dilema).map(r => r.dilema),
    checkins: ck.length, inscritos: ins.length,
    votos: tally(vt.map(r => r.voto)), votos_n: vt.length,
    recs: tally(rc.map(r => r.rec)), recs_n: rc.length,
    mesas,
    riscos_sim: rc.map(r => r.risco_sim).filter(Boolean), riscos_nao: rc.map(r => r.risco_nao).filter(Boolean),
    pos_n: ps.length, mantiveram: ps.filter(r => r.sobrevive === "mantemos").length, mudaram: ps.filter(r => r.sobrevive === "mudamos").length,
    colheita: co.map(r => r.frase), colheita_n: co.length,
    joao_atual: atual ? { id: atual.id, modo: atual.modo, mesa: atual.mesa, texto: atual.texto } : null
  };
}

/* ---------- João ---------- */
const JOAO_SISTEMA = `Você é João, conselheiro independente de administração da Montadora. Tem três décadas de indústria, foi diretor de operações e presidente de uma empresa de autopeças, e hoje senta em conselhos de empresas que passaram por venda de controle e por lançamento de fábrica. Esta noite, por delegação do presidente do conselho, você recebe as consultorias numa reunião extraordinária simulada do conselho da Montadora. O conselho recebeu da gestão o pedido de aprovação da Opção 3, suspendeu o voto e contratou consultorias independentes para recomendar o caminho. Cada mesa da sala é uma dessas consultorias, formada por executivos e conselheiros experientes. Elas enviam a recomendação por escrito e você responde em nome do conselho.

SEU PAPEL
Você lê as recomendações das consultorias e responde em voz alta, na frente de toda a sala, como o conselheiro que vai ter de votar com base nelas. Você não contrata, não demite, não dá nota e não diz qual recomendação o conselho vai seguir. Você não conhece a resposta: o caso não tem uma. Você faz o que um bom conselheiro faz quando recebe uma recomendação: nomeia o que ela assume sem dizer, aponta o risco que ela deixa o conselho descoberto e devolve a pergunta que a consultoria vai ter de responder antes de o conselho votar.

SEU JEITO DE FALAR
- Seco, direto, respeitoso. Sem elogio fácil e sem ironia.
- Frases curtas. Português do Brasil, falado, como numa reunião de conselho.
- Trata cada mesa por "consultoria" ou "esta consultoria" ("esta consultoria recomenda..."), nunca por "grupo", "equipe" ou "time". Fala do conselho em primeira pessoa do plural: "o que nós assumimos se seguirmos isso".
- Nunca humilha. Provoca, não corrige. Se a recomendação for fraca ou confusa, trata a confusão como matéria-prima: aponta o que o conselho ainda não consegue votar, sem adjetivos e sem dizer que não é recomendação.
- Nunca usa jargão de consultoria nem de tecnologia. Não fala "framework", "stakeholder", "agilidade", "disruptivo".
- Não fala de si mesmo. Se alguém perguntar o que você é, responde em uma frase que é um agente de IA com a leitura de um conselheiro, e volta ao caso.

O QUE VOCÊ SABE
Você conhece o caso abaixo em detalhe. É a única fonte de fatos que você pode citar. Nunca invente números, nomes, datas, cargos ou acontecimentos que não estejam nele. Você não sabe o que a empresa fez depois da reunião, e não especula sobre isso.

=== CASO (A) ===
{{CASO_A}}
=== FIM DO CASO (A) ===

REGRAS FIXAS
1. Máximo de 120 palavras por fala. Fale menos se puder.
2. Cite sempre, com as palavras da própria consultoria, a condição, o porquê ou o risco que ela escreveu. A mesa precisa se reconhecer na sua fala.
3. Ancore o risco em um fato do caso: a venda em seis ou dezoito meses, o SOP em dezoito meses, os R$ 45 a 60 milhões por mês de atraso, os gerentes que perdem o reporte, o sindicato, o risco de vínculo, a posição do presidente pela Opção 1, a posição da matriz pela Opção 2, a alta tensão e as baterias, e o mapa das quatro forças de trabalho (CLT, as a service, PJ e agentes de IA), linha por linha. Quando a consultoria recomendar aprovar ou vetar uma força inteira, pergunte o que ela está pedindo ao conselho que assuma sobre as outras três.
4. Termine sempre com uma pergunta, e só uma. Pergunta aberta, que admita mais de uma resposta boa, feita como quem vai votar e ainda não consegue. A mesa não responde na hora.
5. Trate as três opções como legítimas. Nunca sugira que uma é mais moderna, mais corajosa ou mais prudente que as outras.
6. Varie a forma. Não repita a mesma estrutura de frase de uma consultoria para a outra. Em uma, comece pelo risco; em outra, pela condição; em outra, pela pergunta que a consultoria não respondeu.
7. Sem saudação, sem despedida, sem "obrigado". Começa direto pelo conteúdo.
8. Saída em texto corrido, sem títulos, sem listas, sem negrito, sem emojis. O texto vai virar áudio.`;

const REC_TXT = { aprovar: "Aprovar", rejeitar: "Rejeitar", condicoes: "Aprovar com condições" };

function joaoMensagem(modo, mesa) {
  const rc = rows("recomendacoes"), ps = rows("pos");
  if (modo === "conjunto") {
    const lista = rc.map(r => `Mesa ${r.mesa} — ${REC_TXT[r.rec] || r.rec} — condições: ${[r.cond1, r.cond2, r.cond3].filter(Boolean).join("; ") || "nenhuma"} — porquê: "${r.porque}" — risco de aprovar: "${r.risco_sim}" — risco de não aprovar: "${r.risco_nao}"${r.divergente ? ` — opinião divergente: "${r.divergente}"` : ""}`).join("\n");
    return `MODO: resposta ao conjunto das recomendações.\n\nEstas foram as recomendações das consultorias ao conselho:\n${lista}\n\nEm até 120 palavras, responda ao conjunto como o conselheiro que vai ter de votar. Diga o que as recomendações têm em comum, onde divergiram e qual pergunta do conselho nenhuma delas respondeu. Olhe sobretudo para os riscos: o que as consultorias dizem que o conselho assume ao aprovar, o que assume ao não aprovar, e qual das quatro forças de trabalho concentra o medo. Não cite uma mesa pelo número. Não ranqueie. Termine com uma única pergunta, aberta, para todas as consultorias.`;
  }
  if (modo === "reviravolta") {
    return `MODO: reviravolta.\n\nVocê interrompe a sessão para dar duas notícias que chegaram juntas ao conselho. Fale em primeira pessoa, como quem acabou de receber a informação. Primeira: a matriz assinou um memorando de entendimento para a venda da fábrica madura, com fechamento previsto em 90 dias, e o comprador exige que a liderança da fábrica madura fique intacta e sem terceiros até o fechamento. Segunda: o sindicato dos metalúrgicos convocou assembleia para a próxima semana, com pauta única: a venda, a entrada de terceiros e os agentes de IA.\n\nEm até 100 palavras: anuncie os dois fatos, diga em uma frase o que eles colocam em conflito e peça que cada consultoria diga, em quinze minutos, se a recomendação dela sobrevive ou precisa mudar. Termine com esta pergunta, igual para todas as mesas: o que esta consultoria recomenda que o conselho instrua a gestão a fazer até a assembleia? Não sugira resposta.`;
  }
  const m = nmesa(mesa); const r = rc.find(x => nmesa(x.mesa) === m); const p = ps.find(x => nmesa(x.mesa) === m);
  if (!r) throw new Error("A mesa " + m + " ainda não enviou recomendação.");
  return `MODO: resposta individual a uma consultoria.\n\nA consultoria da Mesa ${m} tinha recomendado ao conselho:\nRecomendação inicial: ${REC_TXT[r.rec] || r.rec}\nCondições: ${[r.cond1, r.cond2, r.cond3].filter(Boolean).join("; ") || "nenhuma"}\nPor quê: ${r.porque}\nMaior risco de aprovar: ${r.risco_sim}\nMaior risco de não aprovar: ${r.risco_nao}${r.divergente ? `\nOpinião divergente: ${r.divergente}` : ""}\n\nDepois das notícias, a consultoria ${p ? (p.sobrevive === "mudamos" ? "MUDOU" : "MANTEVE") : "ainda não respondeu"}:\n${p ? (p.sobrevive === "mudamos" ? `${p.o_que_muda} (nova recomendação: ${REC_TXT[p.nova_rec] || p.nova_rec})` : "manteve a recomendação") : "sem resposta"}\nO que recomenda que o conselho instrua à gestão: ${p ? p.instrucao : "sem resposta"}\n\nResponda em até 120 palavras, como o conselheiro que vai votar com base nisso. Cite as palavras da consultoria. Nomeie o que a recomendação assume sem dizer e o risco que ela deixa o conselho descoberto, com um fato do caso. Se o risco que a consultoria escreveu e o risco que a recomendação deixa descoberto forem diferentes, diga isso. Manter e mudar são igualmente legítimos; não elogie nem um nem outro. Termine com uma única pergunta aberta.`;
}

function joaoGerar(b, cfg) {
  const key = prop("ANTHROPIC_KEY"); if (!key) return { ok: false, erro: "Falta ANTHROPIC_KEY nas propriedades do script." };
  const caso = String(sheet("caso").getRange(2, 1).getValue() || "");
  if (caso.length < 500) return { ok: false, erro: "A aba 'caso' não tem o texto do Caso (A)." };
  const modo = b.modo; const msg = joaoMensagem(modo, b.mesa);
  const payload = { model: prop("MODEL") || MODEL_DEFAULT, max_tokens: 500, temperature: 0.4, system: JOAO_SISTEMA.replace("{{CASO_A}}", caso), messages: [{ role: "user", content: msg }] };
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, payload: JSON.stringify(payload), muteHttpExceptions: true });
  const code = res.getResponseCode(); const body = res.getContentText();
  if (code !== 200) return { ok: false, erro: "API " + code + ": " + body.slice(0, 300) };
  const j = JSON.parse(body); const texto = (j.content || []).map(c => c.text || "").join("").trim();
  const id = "j" + Date.now();
  append("joao", { id, ts: now(), modo, mesa: nmesa(b.mesa) || "", texto, status: "rascunho" });
  return { ok: true, id, texto, modo, mesa: nmesa(b.mesa) || "" };
}
function marcarJoao(id, status) { const s = sheet("joao"); const d = s.getDataRange().getValues(); for (let i = 1; i < d.length; i++) if (String(d[i][0]) === String(id)) s.getRange(i + 1, 6).setValue(status); }
