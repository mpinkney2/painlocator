import {
  DEMO_EVENTS, DEMO_PATIENT, KIND_LABELS, sortEvents,
  normalizePainLocatorSession, normalizeFhirR4Bundle
} from "./model.js";

/** Isolated demonstration. No EHR network calls, server, PHI storage, or write-back. */
const $ = id => document.getElementById(id);
const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
);
const fmtDate = date => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
}).format(new Date(date));
const fmtShort = date => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", timeZone: "UTC"
}).format(new Date(date));
const icons = { visit: "✚", lab: "◈", procedure: "✦", medication: "✜", symptom: "●", communication: "✉", diagnosis: "◇" };
const state = {
  events: [...DEMO_EVENTS], imported: [], anatomyModel: "adult-male",
  selectedId: "e05", kind: "all", query: "", viewMode: "patient",
  bodyView: "front", trend: "pain"
};

const events = () => sortEvents([...state.events, ...state.imported]);
const byId = id => events().find(event => event.id === id);
const allPain = () => events().filter(event => event.kind === "symptom" && typeof event.intensity === "number");
const selectedEvent = () => byId(state.selectedId) || events()[0];

function filteredEvents() {
  const term = state.query.toLowerCase().trim();
  return events().filter(event => (
    (state.kind === "all" || event.kind === state.kind) &&
    (!term || [event.title, event.summary, event.clinician, event.source?.label, event.note, event.test]
      .join(" ").toLowerCase().includes(term))
  ));
}

function renderHeader() {
  $("countEvents").textContent = events().length;
  $("countSymptoms").textContent = allPain().length;
  $("countSources").textContent = events().filter(event => event.source?.id).length;
  $("patientName").textContent = state.events.length ? DEMO_PATIENT.name : "Imported fictional dataset";
  $("patientEpisode").textContent = state.events.length ? DEMO_PATIENT.episode + " · " + DEMO_PATIENT.subtitle : "Local file · Unverified records · Not combined with demo patient";
}

function eventMarkup(event) {
  const active = event.id === state.selectedId;
  const extra = event.kind === "symptom" && typeof event.intensity === "number"
    ? '<span class="tag">Severity ' + esc(event.intensity) + '/10</span>' : "";
  return '<div class="event-row" role="listitem">' +
    '<span class="event-icon ' + esc(event.kind) + '" aria-hidden="true">' + (icons[event.kind] || "○") + '</span>' +
    '<button type="button" class="event-card ' + (active ? "selected" : "") + '" aria-pressed="' + active +
    '" data-event-id="' + esc(event.id) + '">' +
    '<span class="event-top"><span class="event-date">' + esc(fmtDate(event.date)) +
    '</span><span class="event-type ' + esc(event.kind) + '">' + esc(KIND_LABELS[event.kind] || "Record") + '</span></span>' +
    '<span class="event-title">' + esc(event.title) + '</span>' +
    '<span class="event-summary">' + esc(event.summary) + '</span>' +
    '<span class="event-footer">' + extra + '<span class="event-source">' +
    esc(event.source?.label || "Source not provided") + '</span></span></button></div>';
}

function renderTimeline() {
  const found = filteredEvents();
  $("resultSummary").textContent = found.length + " event" + (found.length !== 1 ? "s" : "") + " in view · Earliest first";
  $("eventList").innerHTML = found.map(eventMarkup).join("");
  $("emptyState").hidden = found.length !== 0;
}

function renderDetails() {
  const e = selectedEvent();
  if (!e) { $("eventDetails").textContent = "No event selected."; return; }
  const clinically = state.viewMode === "clinician";
  const patientLabel = (KIND_LABELS[e.kind] || "Record") + " · " + fmtDate(e.date);
  const detailRows = [
    ["Date", fmtDate(e.date)],
    ["Recorded as", e.kind === "symptom" ? "Patient-reported symptom" : "Imported or fictional source event"]
  ];
  if (e.intensity !== undefined) detailRows.push(["Pain severity", e.intensity + " / 10"]);
  if (e.quality?.length) detailRows.push(["Description", e.quality.join(", ")]);
  if (e.note) detailRows.push(["Patient note", e.note]);
  if (e.clinician) detailRows.push(["Care team", e.clinician]);
  if (e.value !== undefined) detailRows.push(["Recorded lab value", e.value + " " + (e.unit || "")]);
  if (clinically && e.test) detailRows.push(["Lab analyte", e.test]);
  if (clinically && e.code) detailRows.push(["Code", e.code]);
  if (clinically && e.regions?.length) detailRows.push(["Anatomical annotations", e.regions.length + " anchored region(s)"]);
  $("eventDetails").innerHTML =
    '<span class="detail-category">' + esc(patientLabel) + '</span>' +
    '<h3 class="detail-title">' + esc(e.title) + '</h3>' +
    '<p class="detail-summary">' + esc(e.summary) + '</p>' +
    '<dl class="detail-grid">' + detailRows.map(row =>
      '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>'
    ).join("") + '</dl>' +
    '<div class="provenance"><strong>Original source / provenance</strong><span>' +
    esc(e.source?.label || "Not supplied") + '</span><span>Reference: ' +
    esc(e.source?.id || "None") + '</span><span>' +
    (e.source?.verified ? "Source-verified" : "Source not clinically verified") +
    '</span></div>';
}

function renderAnatomy() {
  const s = selectedEvent();
  const pain = s?.kind === "symptom" ? s : allPain().at(-1);
  const view = state.bodyView;
  const img = $("anatomyImage");
  const src = "/anatomy/" + state.anatomyModel + "/" + view + ".png";
  if (!img.src.endsWith(src)) img.src = src;
  img.alt = view + "-view clinical body illustration with symptom overlays";
  document.querySelectorAll("[data-view]").forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("selected", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  $("anatomyTitle").textContent = pain?.regions?.[0]?.label || "No mapped symptom";
  $("anatomyDesc").textContent = !pain
    ? "Select a PainLocator entry to show a reported location."
    : (s?.kind === "symptom" ? "Selected report" : "Most recent PainLocator report") +
      " · " + fmtDate(pain.date) +
      (pain.note ? " · " + pain.note : "");
  $("selectedSeverity").innerHTML = pain && typeof pain.intensity === "number"
    ? esc(pain.intensity) + '<span>/10</span>' : '—<span>/10</span>';
  $("severityBar").style.width = pain ? (pain.intensity * 10) + "%" : "0%";
  // Plate and marks are positioned in the same normalized image coordinate frame.
  // Recalculate after image load, layout change, or selected record change.
  placeMarkers();
}

function placeMarkers() {
  const current = selectedEvent();
  const pain = current?.kind === "symptom" ? current : allPain().at(-1);
  const markers = $("painMarkers");
  markers.replaceChildren();
  if (!pain || !Array.isArray(pain.regions)) return;
  const image = $("anatomyImage");
  const frame = $("anatomyFigure");
  const imageRect = image.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  if (!imageRect.width || !imageRect.height || !frameRect.width || !frameRect.height) return;
  const xOffset = imageRect.left - frameRect.left;
  const yOffset = imageRect.top - frameRect.top;
  const sx = imageRect.width / frameRect.width;
  const sy = imageRect.height / frameRect.height;
  for (const region of pain.regions) {
    if (region.view !== state.bodyView) continue;
    const anchors = region.anchors || [];
    if (!anchors.length) continue;
    const cx = anchors.reduce((sum, a) => sum + a.x, 0) / anchors.length;
    const cy = anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const marker = document.createElement("span");
    marker.className = "pain-marker";
    marker.style.left = ((xOffset / frameRect.width + cx * sx) * 100) + "%";
    marker.style.top = ((yOffset / frameRect.height + cy * sy) * 100) + "%";
    marker.title = region.label || "Reported location";
    markers.appendChild(marker);
  }
}

function seriesForTrend() {
  if (state.trend === "pain") return {
    label: "Patient-reported severity", unit: "/10",
    values: allPain().map(e => ({ date: e.date, value: e.intensity })),
    min: 0, max: 10, color: "#298b9e"
  };
  const values = events().filter(e => e.kind === "lab" && typeof e.value === "number" && /hemoglobin/i.test(e.test || e.title))
    .map(e => ({ date: e.date, value: e.value }));
  const low = values.length ? Math.min(...values.map(v => v.value)) : 0;
  const high = values.length ? Math.max(...values.map(v => v.value)) : 10;
  return { label: "Hemoglobin", unit: " g/dL", values,
    min: Math.max(0, Math.floor(low - 1)), max: Math.ceil(high + 1), color: "#298b9e" };
}

function renderTrends() {
  $("trendPain").classList.toggle("selected", state.trend === "pain");
  $("trendLab").classList.toggle("selected", state.trend === "lab");
  $("trendPain").setAttribute("aria-pressed", String(state.trend === "pain"));
  $("trendLab").setAttribute("aria-pressed", String(state.trend === "lab"));
  const series = seriesForTrend();
  const points = series.values;
  const target = $("chartContainer");
  if (!points.length) {
    target.innerHTML = '<p class="small-muted">No observations available for this trend.</p>';
    $("trendDetails").textContent = "No chart data available";
    target.setAttribute("aria-label", "No trend values available");
    return;
  }
  const W=450, H=195, L=32, T=16, R=18, B=33;
  const chartW=W-L-R, chartH=H-T-B, range=Math.max(1,series.max-series.min);
  const x = i => L+(points.length === 1 ? chartW/2 : chartW*i/(points.length-1));
  const y = val => T+chartH-(val-series.min)/range*chartH;
  const xy = points.map((p,i) => [x(i), y(p.value)]);
  const path = xy.map((p,i) => (i ? "L" : "M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
  const area = path+" L"+xy.at(-1)[0].toFixed(1)+","+(T+chartH)+" L"+xy[0][0].toFixed(1)+","+(T+chartH)+" Z";
  const grids = [0,.25,.5,.75,1].map(f => {
    const val=series.max-f*range, yy=T+f*chartH;
    return '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" class="gridline"/>' +
      '<text class="axis" x="'+(L-9)+'" y="'+(yy+3)+'" text-anchor="end">'+
      esc(Number.isInteger(val)?val:val.toFixed(1))+'</text>';
  }).join("");
  const circles = xy.map((p,i) => '<circle class="trend-dot" cx="'+p[0]+'" cy="'+p[1]+'" r="4.2"><title>'+
    esc(fmtDate(points[i].date)+" · "+points[i].value+series.unit)+'</title></circle>').join("");
  const indices = [...new Set([0, Math.floor((points.length-1)/2), points.length-1])];
  const labels = indices.map(i => '<text class="axis" x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+
    esc(fmtShort(points[i].date))+'</text>').join("");
  target.innerHTML = '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    grids+'<path class="trend-area" d="'+area+'"/><path class="trend-line" d="'+path+'"/>'+circles+labels+'</svg>';
  target.setAttribute("aria-label", series.label+": "+points.map(p=>fmtDate(p.date)+" "+p.value+series.unit).join("; "));
  const first = points[0], last=points.at(-1);
  $("trendDetails").innerHTML = '<span>'+esc(series.label)+'</span><strong>'+esc(first.value+series.unit)+
    ' → '+esc(last.value+series.unit)+'</strong><span>'+points.length+' results</span>';
}

function render() {
  renderHeader();
  renderTimeline();
  renderDetails();
  renderAnatomy();
  renderTrends();
}

function selectEvent(id) {
  if (!byId(id)) return;
  state.selectedId = id;
  render();
}
function resetDemo() {
  state.events = [...DEMO_EVENTS];
  state.imported = [];
  state.anatomyModel = "adult-male";
  state.selectedId = "e05";
  state.kind = "all";
  state.query = "";
  state.bodyView = "front";
  state.trend = "pain";
  $("filterKind").value = "all";
  $("searchEvents").value = "";
  $("importFile").value = "";
  $("fictionalConfirm").checked = false;
  $("importStatus").textContent = "";
  $("importStatus").classList.remove("error");
  render();
}

function setMode(mode) {
  state.viewMode = mode;
  document.body.classList.toggle("clinician-view", mode === "clinician");
  for (const [id, current] of [["patientMode", "patient"], ["clinicianMode", "clinician"]]) {
    const active = current === mode;
    $(id).classList.toggle("selected", active);
    $(id).setAttribute("aria-pressed", String(active));
  }
  renderDetails();
}

async function importDemoFile(file) {
  const status = $("importStatus");
  status.classList.remove("error");
  if (!$("fictionalConfirm").checked) throw new Error("Please confirm the file contains fictional, non-patient data.");
  if (!file || file.size > 2_000_000) throw new Error("Select a JSON file smaller than 2 MB.");
  const content = JSON.parse(await file.text());
  let imported;
  if (content.resourceType === "Bundle") imported = normalizeFhirR4Bundle(content);
  else imported = normalizePainLocatorSession(content);
  if (!imported.length) throw new Error("The file has no supported, dated events.");
  state.events = []; // Never mix an imported dataset with a different sample patient.
  state.imported = imported;
  const anatomyModel = content?.patient?.model || content?.entries?.[0]?.patientModel;
  state.anatomyModel = ["adult-male","adult-female","child","teen","senior"].includes(anatomyModel) ? anatomyModel : "adult-male";
  state.selectedId = imported[0].id;
  state.kind = "all";
  state.query = "";
  $("filterKind").value = "all";
  $("searchEvents").value = "";
  status.textContent = imported.length + " fictional-data event(s) displayed separately from the example patient. Nothing was uploaded or saved.";
  render();
}

$("eventList").addEventListener("click", e => {
  const button = e.target.closest("button[data-event-id]");
  if (button) selectEvent(button.dataset.eventId);
});
$("searchEvents").addEventListener("input", e => { state.query = e.target.value; renderTimeline(); });
$("filterKind").addEventListener("change", e => { state.kind = e.target.value; renderTimeline(); });
$("patientMode").addEventListener("click", () => setMode("patient"));
$("clinicianMode").addEventListener("click", () => setMode("clinician"));
$("viewFront").addEventListener("click", () => { state.bodyView="front"; renderAnatomy(); });
$("viewBack").addEventListener("click", () => { state.bodyView="back"; renderAnatomy(); });
$("trendPain").addEventListener("click", () => { state.trend="pain"; renderTrends(); });
$("trendLab").addEventListener("click", () => { state.trend="lab"; renderTrends(); });
$("resetExample").addEventListener("click", resetDemo);
$("integrationInfo").addEventListener("click", () => $("integrationDialog").showModal());
$("importFile").addEventListener("change", async e => {
  try { if (e.target.files?.[0]) await importDemoFile(e.target.files[0]); }
  catch (error) {
    $("importStatus").textContent = error?.message || "Unable to read this JSON file.";
    $("importStatus").classList.add("error");
  } finally { e.target.value = ""; }
});
$("anatomyImage").addEventListener("load", placeMarkers);
window.addEventListener("resize", placeMarkers);
render();
