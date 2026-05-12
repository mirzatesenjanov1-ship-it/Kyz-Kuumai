let myRole = "", myName = "", sessionRef = null, gameActive = false;
let selectedLevelIdx = null;
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
    playMenuMusic();
    document.getElementById('level-screen').style.display = "none";
    document.getElementById('setup-screen').style.display = "flex";
    document.getElementById('display-level-name').innerText = levelNames[idx];
}

function createRoom() {
    myName = document.getElementById('player-name').value.trim();
    if (!myName) return alert("Атыңызды жазыңыз!");
    myRole = "boy";
    const code = Math.floor(100 + Math.random() * 899);
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `БӨЛМӨ КОДУ: <b>${code}</b><br>Кызды күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.set({ 
        players: { boy: myName }, sync: { boy: false, girl: false }, 
        pos: { boy: 0, girl: 0 }, level: selectedLevelIdx, turn: "boy" 
    });
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
            sessionRef.child('players/girl').set(myName);
            startSync();
        } else { alert("Бөлмө табылган жок!"); }
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
    document.getElementById('boyVideo').play();
    document.getElementById('girlVideo').play();
    renderGame();
}

// --- ОЮНДУН ӨЗӨГҮ ---
function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];
    const currentQuestions = questions.slice(0, 30); 

    // Варианттарды аралаштыруучу функция
    function shuffleOptions(array) {
        let arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function showQ() {
        if (gameFinished) return;
        sessionRef.child('turn').once('value', s => {
            const turn = s.val();
            const q = currentQuestions[qIdx];
            if (!q) return checkWinner("Суроолор бүттү!");
            const optArea = document.getElementById('options');
            const qText = document.getElementById('q-text');
            optArea.innerHTML = "";
            if (turn === myRole) {
                optArea.classList.remove('disabled-overlay');
                qText.innerText = q.q;

                // Варианттарды аралаштырып чыгаруу
                const shuffled = shuffleOptions(q.a);

                shuffled.forEach(txt => {
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
        const bPos = 5 + p.boy;
        const gPos = 45 + p.girl;
        document.getElementById('boy-container').style.left = bPos + "%";
        document.getElementById('girl-container').style.left = gPos + "%";
        
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

        // Оюнчулардын аттарын базадан алуу
        sessionRef.child('players').once('value', snapshot => {
            const players = snapshot.val() || { boy: "Жигит", girl: "Кыз" };
            const isBoyWin = reason.includes("жетти");
            const winnerName = isBoyWin ? players.boy : players.girl;
            const loserName = isBoyWin ? players.girl : players.boy;

            document.getElementById('game-field').style.display = "none";
            document.getElementById('ui-bottom').style.display = "none";

            const lb = document.getElementById('leaderboard-screen');
            lb.style.display = "flex";
            lb.style.zIndex = "10000";
            lb.style.position = "fixed";
            lb.style.top = "0";
            lb.style.left = "0";
            lb.style.width = "100%";
            lb.style.height = "100%";

            let winnerImg = isBoyWin ? "boy_run.png" : "girl_run.png";

            lb.innerHTML = `
                <div style="background: rgba(0,0,0,0.95); width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center; font-family: sans-serif;">
                    <div style="position: relative; margin-bottom: 30px;">
                        <div style="width: 250px; height: 250px; border-radius: 50%; overflow: hidden; border: 8px solid #f1c40f; box-shadow: 0 0 30px #f1c40f;">
                            <img src="${winnerImg}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="position: absolute; bottom: 0; right: 0; background: #f1c40f; color: black; padding: 10px 20px; border-radius: 30px; font-weight: bold; font-size: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                            🏆 УТТУ!
                        </div>
                    </div>
                    
                    <h1 style="font-size: 45px; color: #f1c40f; margin: 10px 0; text-transform: uppercase; letter-spacing: 2px;">
                        ${winnerName}
                    </h1>
                    
                    <p style="font-size: 24px; color: #ffffff; margin-bottom: 40px; opacity: 0.9; padding: 0 20px;">
                        ${isBoyWin ? winnerName + " " + loserName + " аттуу кызды кууп жетти!" : winnerName + " " + loserName + " аттуу жигиттен качып кетти!"}
                    </p>

                    <button onclick="location.reload()" style="
                        background: #f1c40f; 
                        color: black; 
                        font-size: 24px; 
                        padding: 15px 50px; 
                        border-radius: 50px; 
                        font-weight: bold; 
                        cursor: pointer; 
                        border: none; 
                        transition: transform 0.2s;
                        box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4);
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        🔄 КАЙРА БАШТОО
                    </button>
                </div>
            `;
        });
    }
}
