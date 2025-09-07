(()=> {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const stateKeys = ["curTxt","prevTxt","spot","histCsv","nfpDate","cpiDate","pceDate","fomcStart","fomcEnd","macroNotes"];

  function fmt(n){ return (n==null||!isFinite(n))? "—" : n.toLocaleString('fr-FR'); }
  function pct(n,d){ if(!d) return 0; return 100*(n/d); }
  function parseHistoryCSV(csv){
    if(!csv) return [];
    return csv.split(/\r?\n/).map(l=>{
      const [date,netRaw] = l.split(/,|;|\t/);
      const net = parseFloat((netRaw||"").replace(/\s/g,""));
      if(isFinite(net)) return {date:(date||"").trim(), net};
      return null;
    }).filter(Boolean);
  }
  function cotIndex(mmNet, arr, win=156){
    if(mmNet==null || !arr?.length) return null;
    const nets = arr.map(r=>r.net).filter(v=>typeof v==="number");
    const slice = nets.slice(-win);
    if(!slice.length) return null;
    const mn = Math.min(...slice), mx = Math.max(...slice);
    if(mx===mn) return 50;
    return 100*(mmNet-mn)/(mx-mn);
  }

  function parseCotDisaggregated(raw){
    if(!raw) return null;
    const lineIdx = raw.indexOf("Positions");
    const part = lineIdx>=0 ? raw.slice(lineIdx) : raw;
    const m = part.match(/^\s*All\s*:.*$/im);
    const allLine = m ? m[0] : null;
    if(!allLine) return null;
    const nums = (allLine.match(/-?\d[\d,]*/g)||[]).map(s=>parseInt(s.replace(/,/g,""),10));
    if(nums.length < 14) return null;
    const [openInterest, pmL,pmS, swL,swS,swSp, mmL,mmS,mmSp, oL,oS,oSp, nrL,nrS] = nums.slice(0,14);
    return {
      openInterest,
      producer:{long:pmL, short:pmS},
      swaps:{long:swL, short:swS, spread:swSp},
      mm:{long:mmL, short:mmS, spread:mmSp},
      other:{long:oL, short:oS, spread:oSp},
      nonrep:{long:nrL, short:nrS},
    };
  }
  function deltas(cur, prev){
    if(!cur||!prev) return null;
    const d=(a,b)=> (a??0)-(b??0);
    return {
      openInterest: d(cur.openInterest, prev.openInterest),
      producer:{ long:d(cur.producer.long,prev.producer.long), short:d(cur.producer.short,prev.producer.short) },
      swaps:{ long:d(cur.swaps.long,prev.swaps.long), short:d(cur.swaps.short,prev.swaps.short) },
      mm:{ long:d(cur.mm.long,prev.mm.long), short:d(cur.mm.short,prev.mm.short) },
      other:{ long:d(cur.other.long,prev.other.long), short:d(cur.other.short,prev.other.short) },
      nonrep:{ long:d(cur.nonrep.long,prev.nonrep.long), short:d(cur.nonrep.short,prev.nonrep.short) },
    };
  }
  function levels(spot){
    const p = Number(spot);
    if(!isFinite(p) || p<=0) return null;
    const up=[.006,.015,.03], dn=[.006,.015,.03];
    return {
      R: up.map(x=>+(p*(1+x)).toFixed(1)),
      S: dn.map(x=>+(p*(1-x)).toFixed(1))
    };
  }
  function inferBias(cur, prev){
    if(!cur||!prev) return null;
    const dNet = (cur.mm.long-cur.mm.short) - (prev.mm.long-prev.mm.short);
    const dOI = cur.openInterest - prev.openInterest;
    if(dNet>10000 && dOI>0) return { bias:"Haussier renforcé", reason:`MM Net +${fmt(dNet)} et OI +${fmt(dOI)}` };
    if(dNet<-10000) return { bias:"Prudence / défensif", reason:`MM Net ${fmt(dNet)}` };
    return { bias:"Neutre-haussier", reason:`Flux MM modéré (${fmt(dNet)}), OI ${dOI>0?"+":""}${fmt(dOI)}` };
  }

  let chartBars=null, chartDelta=null;
  function renderCharts(cur, prev){
    const ctx1 = $("#chartBars").getContext("2d");
    const ctx2 = $("#chartDelta").getContext("2d");
    if(chartBars){ chartBars.destroy(); chartBars=null; }
    if(chartDelta){ chartDelta.destroy(); chartDelta=null; }

    const mmL = cur.mm.long, mmS = cur.mm.short, mmN = mmL - mmS;
    chartBars = new Chart(ctx1, {
      type:"bar",
      data:{
        labels:["Long","Short","Net"],
        datasets:[{label:"Contrats", data:[mmL,mmS,mmN]}]
      },
      options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true } } }
    });

    const prevN = prev? (prev.mm.long-prev.mm.short) : 0;
    chartDelta = new Chart(ctx2, {
      type:"bar",
      data:{ labels:["S-1","S"], datasets:[{ label:"Net", data:[prevN,mmN] }] },
      options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true } } }
    });
  }

  function renderTable(cur, prev, d){
    const el = $("#tableCot");
    if(!cur){ el.innerHTML = "<tbody><tr><td>Aucune donnée.</td></tr></tbody>"; return; }
    const row = (label, L,S, dL,dS) => {
      const N = L - S;
      const dN = (dL!=null && dS!=null)? (dL-dS): null;
      return `<tr>
        <td>${label}</td>
        <td>${fmt(L)}</td>
        <td>${fmt(S)}</td>
        <td>${fmt(N)}</td>
        <td>${dL==null?"—":fmt(dL)}</td>
        <td>${dS==null?"—":fmt(dS)}</td>
        <td>${dN==null?"—":fmt(dN)}</td>
      </tr>`;
    };
    const body = [
      row("Managed Money", cur.mm.long, cur.mm.short, d?.mm.long, d?.mm.short),
      row("Swap Dealers", cur.swaps.long, cur.swaps.short, d?.swaps.long, d?.swaps.short),
      row("Producer/Merchant", cur.producer.long, cur.producer.short, d?.producer.long, d?.producer.short),
      row("Other Reportables", cur.other.long, cur.other.short, d?.other.long, d?.other.short),
      row("Non-reportables", cur.nonrep.long, cur.nonrep.short, d?.nonrep.long, d?.nonrep.short),
      `<tr style="background:#0c1322"><td><b>Open Interest</b></td><td>${fmt(cur.openInterest)}</td><td>—</td><td>—</td><td>${fmt(d?.openInterest)}</td><td>—</td><td>—</td></tr>`
    ].join("");
    el.innerHTML = `<thead>
      <tr><th>Catégorie</th><th>Long</th><th>Short</th><th>Net</th><th>Δ Long</th><th>Δ Short</th><th>Δ Net</th></tr>
      </thead><tbody>${body}</tbody>`;
  }

  function renderKpis(cur, prev, histArr, spotVal){
    const box = $("#kpis"); box.innerHTML = "";
    if(!cur){ return; }
    const mmNet = cur.mm.long - cur.mm.short;
    const mmPct = pct(mmNet, cur.openInterest);
    const mmIdx = cotIndex(mmNet, histArr, 156);
    const dOI = prev? (cur.openInterest - prev.openInterest) : null;
    const add = (txt, cls="pill")=>{
      const s = document.createElement("span"); s.className=cls; s.textContent=txt; box.appendChild(s);
    };
    add(`MM Net : ${fmt(mmNet)}`);
    add(`Net %OI : ${isFinite(mmPct)? mmPct.toFixed(2)+"%":"—"}`);
    if(mmIdx!=null) add(`COT Index(156) : ${mmIdx.toFixed(0)}`);
    add(`Open Interest : ${fmt(cur.openInterest)}`);
    if(dOI!=null) add(`Δ OI : ${dOI>0?"+":""}${fmt(dOI)}`, dOI>0?"pill ok":(dOI<0?"pill bad":"pill"));
    if(spotVal){
      const lvl = levels(spotVal);
      if(lvl){
        add(`R1 ${lvl.R[0]} • R2 ${lvl.R[1]} • R3 ${lvl.R[2]}`, "pill warn");
        add(`S1 ${lvl.S[0]} • S2 ${lvl.S[1]} • S3 ${lvl.S[2]}`, "pill warn");
      }
    }
  }

  function renderRS(spotVal){
    const box = $("#rsBox"); box.innerHTML = "";
    const lvl = levels(spotVal);
    if(!lvl){ box.innerHTML = `<div class="muted">Renseigne le spot pour générer R/S.</div>`; return; }
    const mk = (title, arr)=> `<div class="box"><b>${title}</b><ul style="margin:6px 0 0 18px">${arr.map((v,i)=>`<li>${title[0]}${i+1}: <b>${v}</b></li>`).join("")}</ul></div>`;
    box.innerHTML = mk("Résistances",lvl.R)+mk("Supports",lvl.S);
  }

  function fillAgendaHeuristics(){
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
    const fmt=d=>d? d.toISOString().slice(0,10):"";
    const biz=(n)=>{const d=new Date(Date.UTC(y,m,1)); let c=0; while(d.getUTCMonth()===m){const wd=d.getUTCDay(); if(wd>=1&&wd<=5){c++; if(c===n) return new Date(d);} d.setUTCDate(d.getUTCDate()+1);} return null;};
    const nth=(wd,n)=>{const d=new Date(Date.UTC(y,m,1)); let c=0; while(d.getUTCMonth()===m){ if(d.getUTCDay()===wd){c++; if(c===n) return new Date(d);} d.setUTCDate(d.getUTCDate()+1);} return null;};
    const eomWeekday=(wd)=>{const d=new Date(Date.UTC(y,m+1,0)); while(d.getUTCDay()!==wd){ d.setUTCDate(d.getUTCDate()-1);} return d;};
    $("#nfpDate").value = fmt(biz(5));          // 1er vendredi ouvré ~ NFP
    $("#cpiDate").value = fmt(nth(3,2));        // CPI ~ 2e mercredi (3=Wed)
    $("#pceDate").value = fmt(eomWeekday(5));   // PCE core ~ dernier vendredi (5=Fri)
    $("#fomcStart").value = "";                 // dates à ajuster
    $("#fomcEnd").value = "";
  }

  async function exportPDF(){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:"portrait",unit:"pt",format:"a4"});
    const pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight();
    const margin=28, maxW=pageW-2*margin, maxH=pageH-2*margin;
    const chunks = $$(".print-chunk");
    let page=0;
    for(const el of chunks){
      const canvas = await html2canvas(el, {scale:2, backgroundColor:"#ffffff"});
      const img = canvas.toDataURL("image/png");
      const r = Math.min(maxW/canvas.width, maxH/canvas.height);
      const w=canvas.width*r, h=canvas.height*r;
      if(page>0) pdf.addPage();
      pdf.addImage(img,"PNG",margin,margin,w,h);
      pdf.setFontSize(9); pdf.setTextColor(120);
      pdf.text("XAU/USD – Brief COT (auto)", margin, pageH-12);
      pdf.text(String(page+1), pageW-margin, pageH-12, {align:"right"});
      page++;
    }
    const name = `XAUUSD_COT_Brief_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(name);
  }

  function analyse(){
    const cur = parseCotDisaggregated($("#curTxt").value);
    const prev = parseCotDisaggregated($("#prevTxt").value);
    if(!cur){ alert("Impossible de lire la ligne « All : … » dans le rapport actuel."); return; }
    const d = deltas(cur, prev);
    const mmNet = cur.mm.long - cur.mm.short;
    const mmPct = pct(mmNet, cur.openInterest);
    const histArr = parseHistoryCSV($("#histCsv").value);
    const mmIdx = cotIndex(mmNet, histArr, 156);
    const bias = prev? inferBias(cur, prev) : null;

    $("#resume").innerHTML = `
      <b>Résumé</b> — ${bias? `<b>${bias.bias}</b> • ${bias.reason}.` : `en attente de S-1 pour Δ net.`}
      ${isFinite(mmPct)? ` Net %OI (MM) ≈ <b>${mmPct.toFixed(2)}%</b>.`:""}
      ${mmIdx!=null? ` COT Index(156) ≈ <b>${mmIdx.toFixed(0)}</b>.`:""}
      <div class="hint">Le COT reflète le mardi et paraît le vendredi → filtre hebdomadaire, pas de timing intraday.</div>
    `;
    renderKpis(cur, prev, histArr, $("#spot").value);
    renderTable(cur, prev, d);
    renderRS($("#spot").value);
    renderCharts(cur, prev);
  }

  function saveState(){
    const o={}; stateKeys.forEach(k=> o[k] = $("#"+k)?.value ?? "");
    localStorage.setItem("xau_cot_state", JSON.stringify(o));
    alert("État sauvegardé localement.");
  }
  function loadState(){
    try{
      const o = JSON.parse(localStorage.getItem("xau_cot_state")||"{}");
      stateKeys.forEach(k=> { if($("#"+k) && o[k]!=null) $("#"+k).value = o[k]; });
      if(o.curTxt) analyse();
    }catch(e){}
  }

  // Agenda export ICS
  function exportICS(){
    const items = [
      ["NFP US", $("#nfpDate").value],
      ["CPI US", $("#cpiDate").value],
      ["PCE core", $("#pceDate").value],
      ["FOMC Start", $("#fomcStart").value],
      ["FOMC End", $("#fomcEnd").value]
    ].filter(x=>x[1] && x[1].length===10);
    if(!items.length) { alert("Aucune date valide pour ICS."); return; }
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//XAU COT//EN\n";
    items.forEach(([t,d])=>{
      ics += `BEGIN:VEVENT\nDTSTART:${d.replace(/-/g,"")}\nSUMMARY:${t}\nEND:VEVENT\n`;
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics],{type:"text/calendar"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agenda_macro.ics";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  }

  // Bind
  $("#btnAnalyse").addEventListener("click", analyse);
  $("#btnExportPDF").addEventListener("click", exportPDF);
  $("#btnSave").addEventListener("click", saveState);
  $("#btnLoad").addEventListener("click", loadState);
  $("#btnFillAgenda").addEventListener("click", fillAgendaHeuristics);
  $("#btnExportICS").addEventListener("click", exportICS);

  // Auto-load persisted state
  loadState();
})();
