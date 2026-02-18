/* Fluteschool Suite v2.5 - Independent Phasing & Round Robin */

// --- 1. CORE SETUP ---
function formatFileName(note) { return note.replace("#", "s") + ".wav"; }
const notesList = ["C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1", "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2"];
const audioFiles = {};
notesList.forEach(note => { audioFiles[note] = formatFileName(note); });

const masterVol = new Tone.Volume(-12).toDestination();

// Nodes
const pan1 = new Tone.Panner(-0.6).connect(masterVol);
const pan2 = new Tone.Panner(0.6).connect(masterVol);
const shift1 = new Tone.PitchShift(0).connect(pan1);
const shift2 = new Tone.PitchShift(0).connect(pan2);

const dayanPitch = new Tone.PitchShift(0).connect(masterVol);
const bayanGain = new Tone.Gain(1.0).connect(masterVol);
const dayanPlayer = new Tone.Player().connect(dayanPitch);
const bayanPlayer = new Tone.Player().connect(bayanGain);
dayanPlayer.loop = true; bayanPlayer.loop = true;

const sampler1 = new Tone.Sampler({ urls: audioFiles, baseUrl: "./samples/", release: 6, onload: checkReady }).connect(shift1);
const sampler2 = new Tone.Sampler({ urls: audioFiles, baseUrl: "./samples/", release: 6, onload: checkReady }).connect(shift2);

let loadedCount = 0;
function checkReady() {
    loadedCount++;
    if (loadedCount >= 2) {
        document.getElementById("appContainer").classList.remove("loading");
        document.getElementById("appContainer").classList.add("ready");
        document.querySelectorAll('.chan-btn').forEach(btn => btn.disabled = false);
        Tone.Transport.bpm.value = 78;
    }
}

// --- 2. ENGINE LOGIC ---
function getPattern(key, n1, n2) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let idx = notes.indexOf(key);
    const calc = (v) => {
        if (v === "none" || !v) return null;
        let shift = parseInt(v);
        let noteIdx = (idx + shift) % 12;
        let octave = (shift >= 12 || (idx + shift) >= 12) ? "2" : "1";
        return notes[noteIdx] + octave;
    };
    return [calc(n1), calc(n2), key + "2", key + "2", key + "1", null];
}

let t1Step = 0, t2Step = 0;
const t1Loop = new Tone.Loop((time) => {
    const key = document.getElementById("scaleSelect").value;
    const pattern = getPattern(key, document.getElementById("t1Tune1").value, document.getElementById("t1Tune2").value);
    const note = pattern[t1Step % 6];
    if (note) sampler1.triggerAttack(note, time + (Math.random()-0.5)*0.05, 0.7);
    t1Step++;
}, "4n");

const t2Loop = new Tone.Loop((time) => {
    const key = document.getElementById("scaleSelect").value;
    const pattern = getPattern(key, document.getElementById("t2Tune1").value, document.getElementById("t2Tune2").value);
    const note = pattern[t2Step % 6];
    if (note) sampler2.triggerAttack(note, time + (Math.random()-0.5)*0.05, 0.7);
    t2Step++;
}, "4n");

// --- 3. TABLA ENGINE ---
const taalAnchors = {
    "TEENTAAL": [40, 80, 160, 320], "DADRA": [75, 150, 300],
    "ROOPAK": [50, 100, 200], "JHAPTAL": [50, 100, 200], "EKTAL": [50, 75, 100, 150, 300]
};
const variantMap = {
    "TEENTAAL": { 40: [""], 80: [" A", " B"], 160: [" A", " B", " D", " V"], 320: [" A", " B", " C", " D"] },
    "DADRA": { 75: [""], 150: [""], 300: [""] },
    "ROOPAK": { 50: [" A", " B"], 100: [" A", " B", " C", " D"], 200: [" A", " B", " C", " D"] },
    "JHAPTAL": { 50: [" A", " B"], 100: [" A", " B", " C", " D"], 200: [" A", " B", " C", " D"] },
    "EKTAL": { 50: [""], 75: [" A", " B"], 100: [""], 150: [" A", " B"], 300: [" A", " B", " C", " D"] }
};

let currentVariantIndex = 0, tablaSwapTimeout = null;

async function updateTablaSamples(isInitialLoad = false) {
    const taal = document.getElementById("taalSelect").value.toUpperCase();
    const currentBpm = parseInt(document.getElementById("tablaTempo").value);
    const list = taalAnchors[taal] || [80];
    const anchor = list.reduce((p, c) => Math.abs(c - currentBpm) < Math.abs(p - currentBpm) ? c : p);
    
    const available = variantMap[taal]?.[anchor] || [""];
    if (!isInitialLoad) currentVariantIndex = (currentVariantIndex + 1) % available.length;
    const suffix = available[currentVariantIndex];

    const dUrl = `samples/${taal}/TABLA CHATI ${taal} ${anchor}BPM${suffix}.wav`;
    const bUrl = `samples/${taal}/TABLA BAYA ${taal} ${anchor}BPM${suffix}.wav`;

    try {
        await Promise.all([dayanPlayer.load(dUrl), bayanPlayer.load(bUrl)]);
        const pRate = currentBpm / anchor;
        dayanPlayer.playbackRate = pRate;
        bayanPlayer.playbackRate = pRate;

        if (dayanPlayer.state === "started") {
            const duration = (dayanPlayer.buffer.duration / pRate) * 1000;
            if (tablaSwapTimeout) clearTimeout(tablaSwapTimeout);
            tablaSwapTimeout = setTimeout(() => updateTablaSamples(false), duration - 50);
        }
        return true;
    } catch (e) { return false; }
}

// --- 4. CONTROLS ---
async function wakeUp() {
    if (Tone.context.state !== 'running') await Tone.context.resume();
    await Tone.start();
    Tone.Transport.start();
}

document.getElementById("t1Btn").onclick = async () => {
    await wakeUp();
    if (t1Loop.state !== "started") { t1Step = 0; t1Loop.start(0); document.getElementById("t1Btn").classList.add("active"); }
    else { t1Loop.stop(); document.getElementById("t1Btn").classList.remove("active"); }
};

document.getElementById("t2Btn").onclick = async () => {
    await wakeUp();
    if (t2Loop.state !== "started") { t2Step = 0; t2Loop.start(0); document.getElementById("t2Btn").classList.add("active"); }
    else { t2Loop.stop(); document.getElementById("t2Btn").classList.remove("active"); }
};

document.getElementById("tablaBtn").onclick = async () => {
    await wakeUp();
    const btn = document.getElementById("tablaBtn");
    if (dayanPlayer.state !== "started") {
        btn.innerText = "Loading...";
        currentVariantIndex = 0;
        const ok = await updateTablaSamples(true);
        if (ok) {
            dayanPlayer.start(); bayanPlayer.start();
            btn.innerText = "Stop"; btn.classList.add("active");
        } else {
            btn.innerText = "Error!";
            setTimeout(() => btn.innerText = "Tabla Start", 2000);
        }
    } else {
        if (tablaSwapTimeout) clearTimeout(tablaSwapTimeout);
        dayanPlayer.stop(); bayanPlayer.stop();
        btn.innerText = "Tabla Start"; btn.classList.remove("active");
    }
};

function updateUI(id) {
    const s = document.getElementById(id); if (!s) return;
    const v = parseFloat(s.value);
    if (id === 'tuneSlider') {
        document.getElementById("tuneValue").innerText = `+${v} cents`;
        shift1.pitch = shift2.pitch = dayanPitch.pitch = v / 100;
    } else if (id === 'tempoSlider') {
        document.getElementById("tempoValue").innerText = `${v} BPM`;
        Tone.Transport.bpm.value = v;
    } else if (id === 'volSlider') {
        document.getElementById("volValue").innerText = `${v} dB`;
        masterVol.volume.value = v;
    } else if (id === 'tablaTempo') {
        document.getElementById("tablaTempoValue").innerText = `${v} BPM`;
        if (dayanPlayer.state === "started") updateTablaSamples();
    } else if (id === 'bayanVol') {
        document.getElementById("bayanVolValue").innerText = `${v} dB`;
        bayanGain.gain.value = Tone.dbToGain(v);
    } else if (id.startsWith('pan')) {
        const d = Math.round(v * 50);
        document.getElementById(id + "Value").innerText = d === 0 ? "C" : (d < 0 ? "L" + Math.abs(d) : "R" + d);
        if (id === 'pan1') pan1.pan.value = v; else pan2.pan.value = v;
    }
}

const sliders = ['tuneSlider', 'tempoSlider', 'volSlider', 'pan1', 'pan2', 'tablaTempo', 'bayanVol'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => updateUI(id);
});