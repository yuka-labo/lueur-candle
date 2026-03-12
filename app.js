/**
 * Lueur — Main Application
 * 世界の愛の詩を灯すキャンドルアプリ
 */

// ========================================
// DOM Elements
// ========================================
const background = document.getElementById('background');
const flame = document.getElementById('flame');
const messageArea = document.getElementById('message-area');
const messageText = document.getElementById('message-text');
const authorLabel = document.getElementById('author-label');
const guide = document.getElementById('guide');
const micButton = document.getElementById('mic-button');

// ========================================
// Audio Context & Microphone
// ========================================
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let animationFrameId = null;

// Blow detection settings
const BLOW_THRESHOLD = 25;
const BLOW_DURATION_THRESHOLD = 300; // ms
let blowStartTime = null;
let lastMessageTime = 0;
const MESSAGE_COOLDOWN = 2000; // ms

// ========================================
// Time of Day
// ========================================
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 23) return 'evening';
    return 'latenight';
}

function setBackground() {
    const timeOfDay = getTimeOfDay();
    background.className = `background bg-${timeOfDay}`;
}

// ========================================
// Microphone Setup
// ========================================
async function initMicrophone() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;

        microphone.connect(analyser);

        isListening = true;
        micButton.classList.add('hidden');
        guide.classList.add('visible');

        detectBlow();

    } catch (error) {
        console.error('Microphone access denied:', error);
        // マイクが使えない場合はタップモードに切り替え
        enableTapMode();
    }
}

// ========================================
// Tap Mode (Fallback)
// ========================================
let tapModeEnabled = false;

function enableTapMode() {
    tapModeEnabled = true;
    micButton.classList.add('hidden');
    guide.innerHTML = '<p>キャンドルをタップしてね</p>';
    guide.classList.add('visible');

    // キャンドルエリアをタップ可能に
    const candleWrapper = document.querySelector('.candle-wrapper');
    candleWrapper.style.cursor = 'pointer';
    candleWrapper.addEventListener('click', onCandleTap);
    candleWrapper.addEventListener('touchstart', onCandleTap);
}

function onCandleTap(e) {
    e.preventDefault();
    const now = Date.now();

    if (now - lastMessageTime < MESSAGE_COOLDOWN) return;

    // 炎を揺らすアニメーション
    flame.classList.add('intense');
    setTimeout(() => flame.classList.remove('intense'), 500);

    // メッセージ表示
    showMessage();
    lastMessageTime = now;
}

// ========================================
// Blow Detection
// ========================================
function detectBlow() {
    if (!isListening) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // 低周波数帯域（息の音）の平均を計算
    const lowFreqEnd = Math.floor(dataArray.length * 0.3);
    let sum = 0;
    for (let i = 0; i < lowFreqEnd; i++) {
        sum += dataArray[i];
    }
    const averageVolume = sum / lowFreqEnd;

    const now = Date.now();

    if (averageVolume > BLOW_THRESHOLD) {
        // 息を検知
        if (!blowStartTime) {
            blowStartTime = now;
        }

        // 炎を激しく揺らす
        flame.classList.add('intense');

        // 一定時間以上息が続いたらメッセージ表示
        if (now - blowStartTime > BLOW_DURATION_THRESHOLD) {
            if (now - lastMessageTime > MESSAGE_COOLDOWN) {
                showMessage();
                lastMessageTime = now;
            }
        }
    } else {
        // 息が止まった
        blowStartTime = null;
        flame.classList.remove('intense');
    }

    animationFrameId = requestAnimationFrame(detectBlow);
}

// ========================================
// Message Display
// ========================================
function showMessage() {
    const data = getRandomMessage();

    // フェードアウト
    messageArea.classList.remove('visible');

    setTimeout(() => {
        // 詩のテキスト更新
        messageText.textContent = data.text;
        recordPoemView(data.text, data.author);

        // 作者名を表示
        if (data.author) {
            authorLabel.textContent = `— ${data.author}`;
            authorLabel.classList.remove('hidden');
        } else {
            authorLabel.classList.add('hidden');
        }

        // フェードイン
        messageArea.classList.add('visible');
    }, 400);
}

// ========================================
// Event Listeners
// ========================================
micButton.addEventListener('click', initMicrophone);

// 画面タッチでもマイク起動（iOS対応）
document.addEventListener('touchstart', function initOnTouch() {
    if (!isListening && audioContext === null) {
        initMicrophone();
    }
    document.removeEventListener('touchstart', initOnTouch);
}, { once: true });

// ========================================
// Initialize
// ========================================
function init() {
    // 背景設定
    setBackground();

    // 1時間ごとに背景を更新
    setInterval(setBackground, 60 * 60 * 1000);

    // コレクション機能初期化
    initCollection();
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);

// Service Worker登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}
