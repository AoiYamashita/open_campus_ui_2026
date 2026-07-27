const hudBody = document.getElementById('hudBody');
const viewport = document.getElementById('viewport');
const cameraWindow = document.getElementById('cameraWindow');
const bookBg = document.getElementById('bookBg');
const pupilL = document.getElementById('pupilL');
const pupilR = document.getElementById('pupilR');
const camTitle = document.getElementById('camTitle');

// タイマー用の変数
const timerContainer = document.getElementById('timerDisplayContainer');
const timerDisplay = document.getElementById('timerDisplay');
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

let scanInterval = null;
let isScanning = false;
let isPaused = false;

let currentJitterX = -50;
let currentJitterY = -50;
let currentEyeX = 0;
let currentEyeY = 0;

const maxOffset = 18;

const designWidth = 1920;
const designHeight = 1080;

function updateUiScale() {
    const widthScale = window.innerWidth / designWidth;
    const heightScale = window.innerHeight / designHeight;
    const scale = Math.min(widthScale, heightScale, 1);
    document.documentElement.style.setProperty('--ui-scale', String(scale));
}

updateUiScale();
window.addEventListener('resize', updateUiScale);

// Create ros object to communicate over your Rosbridge connection
const ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090',
    options: {
        ros_domain_id: '0' // ROS_DOMAIN_IDを設定する
    }
});

// Rosbridgeサーバに接続されたらsuccessful
ros.on('connection', function () {
    // document.getElementById('hat_text').style.color = "white";
    console.log('Connected to ROSBridge WebSocket server.');
});

// Rosbridgeサーバに接続できなかったらerror
ros.on('error', function (error) {
    // document.getElementById('hat_text').style.color = "red";
    document.getElementById('hat_text').innerHTML = "ERROR HAS OCCURRED...";
    console.log('Error connecting to ROSBridge WebSocket server: ', error);
});

// Rosbridgeサーバから切断されたらclose
ros.on('close', function () {
    // document.getElementById('hat_text').style.color = "red";
    document.getElementById('hat_text').innerHTML = "CONNECTION HAS BEEN LOST...";
    console.log('Connection to ROSBridge WebSocket server closed.');
});

var button = new ROSLIB.Topic({
    ros: ros,
    name: '/state',
    messageType: 'std_msgs/UInt8'
})

var image_sub = new ROSLIB.Topic({
    ros: ros,
    name: '/webimage',
    messageType: 'std_msgs/msg/String'
})

// 画像トピックの購読，表示
image_sub.subscribe(function (message) {
    console.log("get_images");
    var data = "data:image/png;base64," + message.data;
    setBlob(data)
})

let prevSrc = '';

async function setBlob(data_uri) {
    const blob = await (await fetch(data_uri)).blob();
    let nowSrc = window.URL.createObjectURL(blob);
    document.getElementById('bookBg').src = nowSrc;
    if (prevSrc !== '') window.URL.revokeObjectURL(prevSrc);
    prevSrc = nowSrc;
}

function setPupilTransform(x, y, scale = 1) {
    const transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
    pupilL.style.transform = transform;
    pupilR.style.transform = transform;
}

function updateSystem() {
    const positions = [
        { x: 0, y: 0 },
        { x: -maxOffset, y: 0 },
        { x: maxOffset, y: 0 },
        { x: 0, y: -maxOffset * 0.7 },
        { x: 0, y: maxOffset * 0.7 },
        { x: -maxOffset * 0.6, y: -maxOffset * 0.6 },
        { x: maxOffset * 0.6, y: maxOffset * 0.6 }
    ];
    const targetPos = positions[Math.floor(Math.random() * positions.length)];
    currentEyeX = targetPos.x;
    currentEyeY = targetPos.y;

    setPupilTransform(currentEyeX, currentEyeY);

    currentJitterX = (Math.random() - 0.5) * 140;
    currentJitterY = (Math.random() - 0.5) * 90;
    // bookBg.style.transform = `translate(${currentJitterX}px, ${currentJitterY}px)`;

}

// タイマー表示更新関数
function updateTimer() {
    const now = Date.now();
    const diff = now - startTime + elapsedTime;

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const ms = Math.floor((diff % 1000) / 10);

    const minStr = String(minutes).padStart(2, '0');
    const secStr = String(seconds).padStart(2, '0');
    const msStr = String(ms).padStart(2, '0');

    timerDisplay.textContent = `${minStr}:${secStr}.${msStr}`;
}


// 0が通常，1がスタート，2がポーズ・ストップ，3がリセットにする

// 1. スタート
function startSystem() {
    if (isScanning && !isPaused) return;

    isScanning = true;
    isPaused = false;

    hudBody.classList.remove('lock-active');
    viewport.classList.remove('lock-active');
    viewport.classList.add('scanning-active');

    clearInterval(scanInterval);
    updateSystem();
    scanInterval = setInterval(updateSystem, 400);

    // タイマーの開始・再開
    if (!timerInterval) {
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 33); // 約30FPSで滑らかに更新
    }

    var msg = new ROSLIB.Message({
        data: 1
    });

    button.publish(msg);
    console.log('Published message on ' + button.name + ': ' + msg.data);
}

// 2. ポーズ
function pauseSystem() {
    if (!isScanning || isPaused) return;

    isPaused = true;
    clearInterval(scanInterval);

    viewport.classList.remove('scanning-active');

    setPupilTransform(currentEyeX, currentEyeY);
    // bookBg.style.transform = `translate(${currentJitterX}px, ${currentJitterY}px)`;

    // タイマーの一時停止
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
    }

    var msg = new ROSLIB.Message({
        data: 2
    });

    button.publish(msg);
    console.log('Published message on ' + button.name + ': ' + msg.data);
}

// 3. 発見
function foundSystem() {
    isScanning = false;
    isPaused = false;
    clearInterval(scanInterval);

    viewport.classList.remove('scanning-active');
    viewport.classList.add('lock-active');
    hudBody.classList.add('lock-active');

    setPupilTransform(0, 0, 1.1);
    // bookBg.style.transform = 'translate(0px, 0px)';

    // タイマーの停止と確定
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
    }
}

// 4. リセット
function resetSystem() {
    isScanning = false;
    isPaused = false;
    clearInterval(scanInterval);

    viewport.classList.remove('scanning-active', 'lock-active');
    hudBody.classList.remove('lock-active');

    setPupilTransform(0, 0, 1);
    // bookBg.style.transform = 'translate(-25%, -25%)';

    // タイマーのリセット
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    elapsedTime = 0;
    timerDisplay.textContent = '00:00.00';

    var msg = new ROSLIB.Message({
        data: 3
    });
    button.publish(msg);
    console.log('Published message on ' + button.name + ': ' + msg.data);
}