let myRole = "", myName = "", sessionRef = null, gameActive = false;
let selectedLevelIdx = null;
let isAIGame = false; 
const levelNames = ["МЕХАНИКА", "МОЛЕКУЛАЛЫК ФИЗИКА", "ЭЛЕКТРОДИНАМИКА", "ТЕРМЕЛҮҮЛӨР", "ОПТИКА", "АТОМДУК ФИЗИКА", "АСТРОНОМИЯ"];

// --- МУЗЫКА ---
function playMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Музыка ойноо катасы"));
    }
}
function stopMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music) { music.pause(); }
}
function playGameMusic() {
    const gMusic = document.getElementById('gameMusic');
    if (gMusic) { gMusic.volume = 0.5; gMusic.play().catch(e => {}); }
}
function stopGameMusic() {
    const gMusic = document.getElementById('gameMusic');
    if (gMusic) { gMusic.pause(); gMusic.currentTime = 0; }
}

// --- ЭМОЦИЯЛАР ---
function sendEmoji(emoji) {
    if (!sessionRef) return;
    sessionRef.child('reactions').set({
        sender: myRole,
        emoji: emoji,
        time: Date.now()
    });
}

function listenReactions() {
    sessionRef.child('reactions').on('value', s => {
        const data = s.val();
        if (!data) return;
        const containerId = data.sender === "boy" ? "boy-container" : "girl-container";
        const container = document.getElementById(containerId);
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'emoji-pop';
        el.innerText = data.emoji;
        el.style.cssText = `position: absolute; top: -60px; left: 50%; transform: translateX(-50%); font-size: 50px; animation: floatUp 1.5s forwards; z-index: 1000;`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    });
}

// --- МЕНЮ ЛОГИКАСЫ ---
function selectLevel(idx) {
    selectedLevelIdx = idx;
    isAIGame = false;
    playMenuMusic();
    document.getElementById('level-screen').style.display = "none";
    document.getElementById('setup-screen').style.display = "flex";
    document.getElementById('display-level-name').innerText = levelNames[idx];
}

// --- GEMINI AI ИНТЕГРАЦИЯСЫ ---
async function generateAIQuiz() {
    let GEMINI_API_KEY = "";
    if (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) {
        GEMINI_API_KEY = CONFIG.GEMINI_API_KEY.trim();
    }
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_")) {
        alert("API ачкычы туура эмес! config.js файлын текшериңиз.");
        return;
    }

    const subjectEl = document.getElementById('ai-subject');
    const topicInputEl = document.getElementById('ai-topic');
    const loading = document.getElementById('loading-ai');
    const btn = document.getElementById('ai-generate-btn') || (event ? event.target : null);

    const subject = subjectEl ? subjectEl.value : "Физика";
    const topic = (topicInputEl && topicInputEl.value.trim()) ? topicInputEl.value.trim() : "Жалпы суроолор";

    if (loading) loading.style.display = 'block';
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Генерацияланууда...";
    }
    isAIGame = true;

    const prompt = `Сен кыргыз тилдүү профессионал мугалимсиң. ${subject} предметинен "${topic}" темасына 20 суроодон турган тест түз. 
    Формат ТАЗА JSON болушу керек, Markdown (```json) колдонбо, башка эч кандай текст кошпо: [{"q": "суроо", "a": ["вариант1", "вариант2", "вариант3"], "c": "туура жооптун тексти"}]`;

    // v1beta версиясы туруктуураак иштеши үчүн URL жаңыртылды
    const url = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Байланыш үзүлдү.");
        }

        const data = await response.json();
        let textResponse = data.candidates[0].content.parts[0].text;
        
        // JSON'ду тазалоо үчүн RegExp колдонуу
        const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("ИИ туура эмес форматта жооп берди.");
        
        const aiQuestions = JSON.parse(jsonMatch[0]);
        window.tempAIQuestions = aiQuestions;
        
        if (loading) loading.style.display = 'none';
        document.getElementById('ai-setup-screen').style.display = "none";
        document.getElementById('setup-screen').style.display = "flex";
        document.getElementById('display-level-name').innerText = `ИИ ТЕСТ: ${topic}`;

    } catch (error) {
        console.error("Ката:", error);
        alert("Ката кетти: " + error.message);
        if (loading) loading.style.display = 'none';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Тест түзүү жана баштоо";
        }
    }
}

function createRoom() {
    myName = document.getElementById('player-name').value.trim();
    if (!myName) return alert("Атыңызды жазыңыз!");
    myRole = "boy";
    const code = Math.floor(100 + Math.random() * 899);
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `БӨЛМӨ КОДУ: <b>${code}</b><br>Кызды күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    
    let roomData = { 
        players: { boy: myName }, 
        sync: { boy: false, girl: false }, 
        pos: { boy: 0, girl: 0 }, 
        level: selectedLevelIdx, 
        turn: "boy",
        isAI: isAIGame
    };

    if (isAIGame && window.tempAIQuestions) {
        roomData.aiQuestions = window.tempAIQuestions;
    }

    sessionRef.set(roomData);
    sessionRef.child('players/girl').on('value', s => { if(s.exists()) startSync(); });
}

function joinRoom() {
    myName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-input').value.trim();
    if (!myName || !code) return alert("Атыңызды жана кодду жазыңыз!");
    myRole = "girl";
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.once('value', s => {
        const data = s.val();
        if (s.exists() && data.players && !data.players.girl) {
            selectedLevelIdx = data.level;
            isAIGame = data.isAI || false;
            if (isAIGame) window.tempAIQuestions = data.aiQuestions;
            sessionRef.child('players/girl').set(myName);
            startSync();
        } else { alert("Бөлмө табылган жок же толгон!"); }
    });
}

function startSync() {
    document.getElementById('setup-screen').style.display = "none";
    document.getElementById('sync-overlay').style.display = "flex";
    sessionRef.child('sync').on('value', s => {
        const sync = s.val();
        if (sync && sync.boy && sync.girl && !gameActive) startCountdown();
    });
}

function triggerReady() { 
    document.getElementById('ready-btn').innerText = "КҮТҮҮ...";
    sessionRef.child('sync/' + myRole).set(true); 
}

function startCountdown() {
    gameActive = true;
    let c = 3;
    const timer = setInterval(() => {
        document.getElementById('countdown').innerText = c > 0 ? c : "АЛГА!";
        if (c === 0) { clearInterval(timer); setTimeout(launch, 500); }
        c--;
    }, 1000);
}

function launch() {
    stopMenuMusic();
    playGameMusic();
    listenReactions();
    document.getElementById('sync-overlay').style.display = "none";
    document.getElementById('game-field').style.display = "block";
    document.getElementById('ui-bottom').style.display = "flex";
    
    ["boyVideo", "girlVideo"].forEach(id => {
        const v = document.getElementById(id);
        if (v) v.play().catch(() => {});
    });
    
    renderGame();
}

function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const currentQuestions = isAIGame ? window.tempAIQuestions : (allQuestions[selectedLevelIdx] || []).slice(0, 30); 

    function showQ() {
        if (gameFinished) return;
        sessionRef.child('turn').once('value', s => {
            const turn = s.val();
            const q = currentQuestions[qIdx];
            if (!q) return checkWinner("Суроолор бүттү!");
            
            const optArea = document.getElementById('options');
            const qText = document.getElementById('q-text');
            if (!optArea || !qText) return;

            optArea.innerHTML = "";
            if (turn === myRole) {
                optArea.classList.remove('disabled-overlay');
                qText.innerText = q.q;
                [...q.a].sort(() => Math.random() - 0.5).forEach(txt => {
                    const b = document.createElement('button');
                    b.className = 'btn opt-btn';
                    b.innerText = txt;
                    b.onclick = () => {
                        let step = (txt === q.c) ? 4 : -2;
                        sessionRef.update({
                            ['pos/' + myRole]: firebase.database.ServerValue.increment(step),
                            turn: myRole === "boy" ? "girl" : "boy",
                            lastQ: qIdx
                        });
                    };
                    optArea.appendChild(b);
                });
            } else {
                optArea.classList.add('disabled-overlay');
                qText.innerText = "АТААНДАШТЫ КҮТҮҮ...";
            }
        });
    }

    sessionRef.child('turn').on('value', () => {
        sessionRef.child('lastQ').once('value', s => {
            qIdx = (s.val() || 0) + 1;
            showQ();
        });
    });

    sessionRef.child('pos').on('value', s => {
        const p = s.val() || {boy:0, girl:0};
        const bPos = 5 + (p.boy || 0);
        const gPos = 45 + (p.girl || 0);
        const bCont = document.getElementById('boy-container');
        const gCont = document.getElementById('girl-container');
        if (bCont) bCont.style.left = bPos + "%";
        if (gCont) gCont.style.left = gPos + "%";
        
        if (bPos >= (gPos - 2)) checkWinner("Жигит кызга жетти! 🏇");
        else if (gPos >= 90) checkWinner("Кыз качып кетти! 🐎");
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        sessionRef.child('pos').off();
        sessionRef.child('turn').off();
        stopGameMusic();
        playMenuMusic(); 

        sessionRef.child('players').once('value', snapshot => {
            const players = snapshot.val() || { boy: "Жигит", girl: "Кыз" };
            const isBoyWin = reason.includes("жетти");
            const winnerName = isBoyWin ? players.boy : players.girl;
            const loserName = isBoyWin ? players.girl : players.boy;

            document.getElementById('game-field').style.display = "none";
            document.getElementById('ui-bottom').style.display = "none";

            const lb = document.getElementById('leaderboard-screen');
            if (!lb) return;
            lb.style.display = "flex";
            lb.style.cssText = "display:flex; z-index:10000; position:fixed; top:0; left:0; width:100%; height:100%;";

            let winnerImg = isBoyWin ? "boy_run.png" : "girl_run.png";

            lb.innerHTML = `
                <div style="background: rgba(0,0,0,0.95); width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center;">
                    <div style="position: relative; margin-bottom: 30px;">
                        <div style="width: 250px; height: 250px; border-radius: 50%; overflow: hidden; border: 8px solid #f1c40f; box-shadow: 0 0 30px #f1c40f;">
                            <img src="${winnerImg}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="position: absolute; bottom: 0; right: 0; background: #f1c40f; color: black; padding: 10px 20px; border-radius: 30px; font-weight: bold;">🏆 УТТУ!</div>
                    </div>
                    <h1 style="font-size: 45px; color: #f1c40f;">${winnerName}</h1>
                    <p style="font-size: 24px; margin-bottom: 40px;">${isBoyWin ? winnerName + " " + loserName + " аттуу кызды кууп жетти!" : winnerName + " " + loserName + " аттуу жигиттен качып кетти!"}</p>
                    <button onclick="location.reload()" style="background: #f1c40f; color: black; font-size: 24px; padding: 15px 50px; border-radius: 50px; font-weight: bold; cursor: pointer; border: none;">🔄 КАЙРА БАШТОО</button>
                </div>`;
        });
    }
}
