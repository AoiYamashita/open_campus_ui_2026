const hudBody = document.getElementById('hudBody');
const viewport = document.getElementById('viewport');
const cameraWindow = document.getElementById('cameraWindow');
const bookBg = document.getElementById('bookBg');
const pupilL = document.getElementById('pupilL');
const pupilR = document.getElementById('pupilR');
const camTitle = document.getElementById('camTitle');

// BGM
const se_detect = new Audio("./sounds/detected.mp3");

// 繧ｿ繧､繝槭�逕ｨ縺ｮ螟画焚
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
        ros_domain_id: '0' // ROS_DOMAIN_ID繧定ｨｭ螳壹☆繧�
    }
});

// Rosbridge繧ｵ繝ｼ繝舌↓謗･邯壹＆繧後◆繧鋭uccessful
ros.on('connection', function () {
    // document.getElementById('hat_text').style.color = "white";
    console.log('Connected to ROSBridge WebSocket server.');
});

// Rosbridge繧ｵ繝ｼ繝舌↓謗･邯壹〒縺阪↑縺九▲縺溘ｉerror
ros.on('error', function (error) {
    // document.getElementById('hat_text').style.color = "red";
    document.getElementById('hat_text').innerHTML = "ERROR HAS OCCURRED...";
    console.log('Error connecting to ROSBridge WebSocket server: ', error);
});

// Rosbridge繧ｵ繝ｼ繝舌°繧牙�譁ｭ縺輔ｌ縺溘ｉclose
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

// 逕ｻ蜒上ヨ繝斐ャ繧ｯ縺ｮ雉ｼ隱ｭ�瑚｡ｨ遉ｺ
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

// 繧ｿ繧､繝槭�陦ｨ遉ｺ譖ｴ譁ｰ髢｢謨ｰ
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


// 0縺碁壼ｸｸ��1縺後せ繧ｿ繝ｼ繝茨ｼ�2縺後�繝ｼ繧ｺ繝ｻ繧ｹ繝医ャ繝暦ｼ�3縺後Μ繧ｻ繝�ヨ縺ｫ縺吶ｋ

// 1. 繧ｹ繧ｿ繝ｼ繝�
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

    // 繧ｿ繧､繝槭�縺ｮ髢句ｧ九�蜀埼幕
    if (!timerInterval) {
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 33); // 邏�30FPS縺ｧ貊代ｉ縺九↓譖ｴ譁ｰ
    }

    var msg = new ROSLIB.Message({
        data: 1
    });

    button.publish(msg);
    console.log('Published message on ' + button.name + ': ' + msg.data);
}

// 2. 繝昴�繧ｺ
function pauseSystem() {
    if (!isScanning || isPaused) return;

    isPaused = true;
    clearInterval(scanInterval);

    viewport.classList.remove('scanning-active');

    setPupilTransform(currentEyeX, currentEyeY);
    // bookBg.style.transform = `translate(${currentJitterX}px, ${currentJitterY}px)`;

    // 繧ｿ繧､繝槭�縺ｮ荳譎ょ●豁｢
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

// 3. 逋ｺ隕�
function foundSystem() {
    isScanning = false;
    isPaused = false;
    clearInterval(scanInterval);
    se_detect.play();

    viewport.classList.remove('scanning-active');
    viewport.classList.add('lock-active');
    hudBody.classList.add('lock-active');

    setPupilTransform(0, 0, 1.1);
    // bookBg.style.transform = 'translate(0px, 0px)';

    // 繧ｿ繧､繝槭�縺ｮ蛛懈ｭ｢縺ｨ遒ｺ螳�
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedTime += Date.now() - startTime;
    }
}

// 4. 繝ｪ繧ｻ繝�ヨ
function resetSystem() {
    isScanning = false;
    isPaused = false;
    clearInterval(scanInterval);

    se_detect.pause();

    viewport.classList.remove('scanning-active', 'lock-active');
    hudBody.classList.remove('lock-active');

    setPupilTransform(0, 0, 1);
    // bookBg.style.transform = 'translate(-25%, -25%)';

    // 繧ｿ繧､繝槭�縺ｮ繝ｪ繧ｻ繝�ヨ
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
