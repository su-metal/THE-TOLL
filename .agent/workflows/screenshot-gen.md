---
description: Scaffold a Chrome Store Screenshot Generator
---

This workflow creates a `tools/screenshot-generator` directory and populates it with a customizable HTML template for creating Chrome Store screenshots.

1. Create the directory
```bash
mkdir -p tools/screenshot-generator
```

2. Create the generator HTML file
// turbo
<file path="tools/screenshot-generator/index.html">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chrome Store Screenshot Generator</title>
    <style>
        :root {
            /* Customize these colors for your brand */
            --bg-gradient-start: #6a11cb;
            --bg-gradient-end: #2575fc;
            --text-color: #ffffff;
            --font-family: 'Inter', sans-serif;
            --card-radius: 20px;
            --card-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            font-family: var(--font-family);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .canvas-container {
            width: 1280px;
            height: 800px;
            background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: center;
            padding: 80px;
            box-sizing: border-box;
        }

        .text-content {
            display: flex;
            flex-direction: column;
            gap: 24px;
            max-width: 500px;
            z-index: 2;
        }

        /* Layout Variations */
        .layout-right-text {
            grid-template-columns: 1fr 1fr;
            direction: rtl; 
        }
        .layout-right-text .text-content {
            direction: ltr;
            order: 2;
        }
        .layout-right-text .visual-content {
            order: 1;
        }

        /* Image Cropping & Mockups */
        .img-crop-container, .mobile-mockup, .popup-mockup {
            box-shadow: 0 15px 40px rgba(0,0,0,0.4);
            overflow: hidden;
            position: relative;
            background: #000;
        }

        .img-crop-container.pc-screen {
            width: 800px;
            height: 450px; /* 16:9 Aspect Ratio */
            border-radius: 4px;
            border-top: 12px solid #222;
            border-left: 12px solid #222;
            border-right: 12px solid #222;
            border-bottom: 30px solid #222; /* Chin */
            position: relative;
            background: #000;
        }

        /* Monitor Stand */
        .img-crop-container.pc-screen::after {
            content: '';
            position: absolute;
            bottom: -50px; /* Stand height */
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 20px;
            background: #333;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
        }
        
        .img-crop-container.pc-screen::before {
             content: '';
             position: absolute;
             bottom: -60px;
             left: 50%;
             transform: translateX(-50%);
             width: 200px;
             height: 10px;
             background: #222;
             border-radius: 4px;
        }

        .mobile-mockup {
            /* 9:21 Aspect Ratio */
            width: 290px;
            height: 680px; 
            border-radius: 40px;
            border: 8px solid #222;
        }

        .popup-mockup {
            width: 400px;
            height: 600px;
            border-radius: 8px;
            border: 1px solid #444;
        }

        .crop-window {
            width: 100%;
            height: 100%;
            background-repeat: no-repeat;
            background-size: cover;
            background-position: center;
        }

        /* 
           PLACEHOLDER IMAGES 
           Replace 'image_01.png' etc with your actual files in the tools/screenshot-generator folder.
        */
        .pc-crop { background-image: url('image_01.png'); }
        .mobile-unlock-crop { background-image: url('image_02.png'); }
        .mobile-squat-crop { background-image: url('image_03.png'); }
        .mobile-success-crop { background-image: url('image_04.png'); }
        .popup-crop { background-image: url('image_05.png'); }

        .title br { display: block; }
        .title {
            font-size: 72px;
            font-weight: 800;
            color: var(--text-color);
            line-height: 1.1;
            margin: 0;
            text-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .subtitle {
            font-size: 24px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.5;
            margin: 0;
        }

        .features {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 20px;
        }

        .feature-pill {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            color: white;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .visual-content {
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            z-index: 1;
        }

        .controls {
            background: #333;
            padding: 20px;
            border-radius: 8px;
            color: white;
            width: 1280px;
            box-sizing: border-box;
        }
        
        .controls-overlay {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 8px;
            z-index: 100;
            display: flex;
            gap: 10px;
            color: white;
            font-size: 12px;
        }
        .controls-overlay label {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body>

    <div class="controls">
        <h3>Screenshot Generator</h3>
        <p>1. Place your images (image_01.png to image_05.png) in this folder.</p>
        <p>2. Open this file via Local Server (e.g. `python -m http.server`) to enable downloads.</p>
        <p>3. Customize the text in the HTML below.</p>
    </div>

    <!-- 1. MAIN FEATURE (PC) -->
    <div class="canvas-container" id="shot-1">
        <div class="controls-overlay">
            <label>Zoom: <input type="range" min="100" max="500" value="100" oninput="updateBg(this, '.pc-crop', 'size')"></label>
            <label>Pan X: <input type="range" min="0" max="100" value="50" oninput="updateBg(this, '.pc-crop', 'x')"></label>
            <label>Pan Y: <input type="range" min="0" max="100" value="50" oninput="updateBg(this, '.pc-crop', 'y')"></label>
        </div>
        <div class="text-content">
            <h1 class="title">HELLO WORLD.<br>APP NAME.</h1>
            <p class="subtitle">
                Your catchy subheadline goes here.<br>Explain the value proposition.
            </p>
            <div class="features">
                <div class="feature-pill">🚀 Fast</div>
                <div class="feature-pill">✨ Secure</div>
            </div>
        </div>
        <div class="visual-content">
            <div class="img-crop-container pc-screen">
                <div class="crop-window pc-crop"></div>
            </div>
        </div>
    </div>

    <!-- 2. MOBILE FEATURE (Left Text) -->
    <div class="canvas-container layout-right-text" id="shot-2">
         <div class="controls-overlay">
            <label>Zoom: <input type="range" min="100" max="500" value="300" oninput="updateBg(this, '.mobile-unlock-crop', 'size')"></label>
            <label>Pan X: <input type="range" min="0" max="100" value="0" oninput="updateBg(this, '.mobile-unlock-crop', 'x')"></label>
            <label>Pan Y: <input type="range" min="0" max="100" value="0" oninput="updateBg(this, '.mobile-unlock-crop', 'y')"></label>
        </div>
        <div class="visual-content">
            <div class="mobile-mockup">
                <div class="crop-window mobile-unlock-crop"></div>
            </div>
        </div>
        <div class="text-content">
            <h1 class="title">FEATURE<br>TWO.</h1>
            <p class="subtitle">
                Describe the mobile adaptability.<br>Or another key benefit.
            </p>
            <div class="features">
                <div class="feature-pill">📱 Mobile Ready</div>
                <div class="feature-pill">⚡ Instant</div>
            </div>
        </div>
    </div>

    <!-- 3. MOBILE FEATURE (Right Text) -->
    <div class="canvas-container" id="shot-3">
         <div class="controls-overlay">
            <label>Zoom: <input type="range" min="100" max="500" value="300" oninput="updateBg(this, '.mobile-squat-crop', 'size')"></label>
            <label>Pan X: <input type="range" min="0" max="100" value="50" oninput="updateBg(this, '.mobile-squat-crop', 'x')"></label>
            <label>Pan Y: <input type="range" min="0" max="100" value="0" oninput="updateBg(this, '.mobile-squat-crop', 'y')"></label>
        </div>
        <div class="text-content">
            <h1 class="title">FEATURE<br>THREE.</h1>
            <p class="subtitle">
                Another cool feature explanation.<br>Keep it punchy.
            </p>
            <div class="features">
                <div class="feature-pill">🔥 Hot Feature</div>
                <div class="feature-pill">💡 Smart Info</div>
            </div>
        </div>
        <div class="visual-content">
            <div class="mobile-mockup">
                <div class="crop-window mobile-squat-crop"></div>
            </div>
        </div>
    </div>

     <!-- 4. ANOTHER MOBILE (Left Text) -->
     <div class="canvas-container layout-right-text" id="shot-4">
         <div class="controls-overlay">
            <label>Zoom: <input type="range" min="100" max="500" value="300" oninput="updateBg(this, '.mobile-success-crop', 'size')"></label>
            <label>Pan X: <input type="range" min="0" max="100" value="100" oninput="updateBg(this, '.mobile-success-crop', 'x')"></label>
            <label>Pan Y: <input type="range" min="0" max="100" value="0" oninput="updateBg(this, '.mobile-success-crop', 'y')"></label>
        </div>
        <div class="visual-content">
            <div class="mobile-mockup">
               <div class="crop-window mobile-success-crop"></div>
           </div>
        </div>
        <div class="text-content">
            <h1 class="title">FEATURE<br>FOUR.</h1>
            <p class="subtitle">
                Almost there.<br>One more selling point.
            </p>
            <div class="features">
                <div class="feature-pill">✅ Verified</div>
                <div class="feature-pill">🏆 Award Winning</div>
            </div>
        </div>
    </div>

    <!-- 5. FINAL (Popup/PC) -->
    <div class="canvas-container" id="shot-5">
         <div class="controls-overlay">
            <label>Zoom: <input type="range" min="100" max="500" value="200" oninput="updateBg(this, '.popup-crop', 'size')"></label>
            <label>Pan X: <input type="range" min="0" max="100" value="100" oninput="updateBg(this, '.popup-crop', 'x')"></label>
            <label>Pan Y: <input type="range" min="0" max="100" value="20" oninput="updateBg(this, '.popup-crop', 'y')"></label>
        </div>
        <div class="text-content">
            <h1 class="title">TOTAL<br>CONTROL.</h1>
            <p class="subtitle">
                Final call to action.<br>Download now.
            </p>
            <div class="features">
                <div class="feature-pill">⚙️ Settings</div>
                <div class="feature-pill">🛠️ Tools</div>
            </div>
        </div>
        <div class="visual-content">
            <div class="popup-mockup">
                <div class="crop-window popup-crop"></div>
            </div>
        </div>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script>
        function updateBg(input, selector, type) {
            const container = input.closest('.canvas-container');
            const el = container.querySelector(selector);
            
            // Get current values
            let size = container.querySelector('input[oninput*="size"]').value;
            let x = container.querySelector('input[oninput*="x"]').value;
            let y = container.querySelector('input[oninput*="y"]').value;
            
            el.style.backgroundSize = `${size}% auto`; 
            el.style.backgroundPosition = `${x}% ${y}%`;
            
            // Save to LocalStorage
            const id = container.id;
            localStorage.setItem(`${id}-size`, size);
            localStorage.setItem(`${id}-x`, x);
            localStorage.setItem(`${id}-y`, y);
        }

        function downloadShot(id) {
            const element = document.getElementById(id);
            const controls = element.querySelector('.controls-overlay');
            
            // Temporary styles to remove artifacts
            const originalShadow = element.style.boxShadow;
            element.style.boxShadow = 'none';
            element.style.transform = 'none'; 
            controls.style.display = 'none';
            
            window.scrollTo(0, 0);

            html2canvas(element, {
                width: 1280,
                height: 800,
                scale: 1, 
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: null 
            }).then(canvas => {
                element.style.boxShadow = originalShadow;
                controls.style.display = 'flex';
                
                const link = document.createElement('a');
                link.download = `${id}_1280x800.png`;
                link.href = canvas.toDataURL();
                link.click();
            }).catch(err => {
                console.error(err);
                element.style.boxShadow = originalShadow;
                controls.style.display = 'flex';
                alert('Error generating screenshot. Check console.');
            });
        }

        window.addEventListener('load', () => {
            const sections = ['shot-1', 'shot-2', 'shot-3', 'shot-4', 'shot-5'];
            const selectors = {
                'shot-1': '.pc-crop',
                'shot-2': '.mobile-unlock-crop',
                'shot-3': '.mobile-squat-crop',
                'shot-4': '.mobile-success-crop',
                'shot-5': '.popup-crop'
            };

            sections.forEach(id => {
                const container = document.getElementById(id);
                if (!container) return;
                
                const overlay = container.querySelector('.controls-overlay');
                if (overlay) {
                    const btn = document.createElement('button');
                    btn.textContent = '📸 Download';
                    btn.style.marginLeft = '10px';
                    btn.style.cursor = 'pointer';
                    btn.onclick = () => downloadShot(id);
                    overlay.appendChild(btn);
                }

                const sizeInput = container.querySelector('input[oninput*="size"]');
                const xInput = container.querySelector('input[oninput*="x"]');
                const yInput = container.querySelector('input[oninput*="y"]');
                const selector = selectors[id];

                if (localStorage.getItem(`${id}-size`)) sizeInput.value = localStorage.getItem(`${id}-size`);
                if (localStorage.getItem(`${id}-x`)) xInput.value = localStorage.getItem(`${id}-x`);
                if (localStorage.getItem(`${id}-y`)) yInput.value = localStorage.getItem(`${id}-y`);

                updateBg(sizeInput, selector, 'load'); 
            });
        });
    </script>
</body>
</html>
</file>
