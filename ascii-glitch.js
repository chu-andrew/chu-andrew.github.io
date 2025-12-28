window.initASCIIAnimation = function (element, options = {}) {
    if (!element) return;

    const config = {
        activeColor: options.activeColor || "#fff",
        rippleRadius: options.rippleRadius || 50,
        glitchDuration: options.glitchDuration || 1000,
        maxGlitchIterations: 4,
        glitchSpeed: 120, // ms
        glitchChars: "!@#$%^&*()_+:,.?/~`|",
        enableRandomGlitch: options.enableRandomGlitch !== undefined ? options.enableRandomGlitch : true,
        randomGlitchInterval: options.randomGlitchInterval || 240, // ms
        randomGlitchChance: options.randomGlitchChance || 0.5,
        ...options,
    };

    const originalText = options.text || element.textContent;

    element.innerHTML = "";

    const lines = originalText.split("\n");
    const allWrappers = [];

    lines.forEach((line) => {
        const lineDiv = document.createElement("div");
        lineDiv.style.whiteSpace = "pre";
        lineDiv.style.whiteSpace = "pre";

        const chars = line.split("");
        chars.forEach((char) => {
            const wrapper = document.createElement("span");
            wrapper.className = "char-wrapper";
            wrapper.style.display = "inline-block";
            wrapper.style.verticalAlign = "bottom";
            wrapper.style.whiteSpace = "pre";
            wrapper.style.textAlign = "center";

            const charSpan = document.createElement("span");
            charSpan.className = "char";
            charSpan.dataset.original = char;
            charSpan.textContent = char;

            wrapper.appendChild(charSpan);
            lineDiv.appendChild(wrapper);
            allWrappers.push(wrapper);
        });

        element.appendChild(lineDiv);
    });

    requestAnimationFrame(() => {
        const fontSize = parseFloat(window.getComputedStyle(element).fontSize);

        allWrappers.forEach((wrapper) => {
            const rect = wrapper.getBoundingClientRect();
            wrapper.style.width = `${rect.width / fontSize}em`;
            wrapper.style.height = `${rect.height / fontSize}em`;
            wrapper.style.overflow = "hidden";
        });
    });

    const wrappedChars = element.querySelectorAll(".char");

    function simpleGlitch(charElement) {
        if (charElement.isGlitching) return;
        charElement.isGlitching = true;

        const originalChar = charElement.dataset.original;
        let iterations = 0;

        const interval = setInterval(() => {
            if (originalChar === " " || originalChar === "⠀") {
                charElement.textContent = originalChar;
            } else {
                charElement.textContent =
                    config.glitchChars[
                        Math.floor(Math.random() * config.glitchChars.length)
                        ];
                charElement.style.color = config.activeColor;
                charElement.style.fontWeight = "bold";
            }

            iterations++;

            if (iterations >= config.maxGlitchIterations) {
                clearInterval(interval);
                charElement.textContent = originalChar;
                charElement.style.color = "";
                charElement.style.fontWeight = "";
                charElement.isGlitching = false;
            }
        }, config.glitchSpeed);
    }

    function findNearbyChars(sourceChar, radius) {
        const sourceRect = sourceChar.getBoundingClientRect();
        const sourceCenter = {
            x: sourceRect.left + sourceRect.width / 2,
            y: sourceRect.top + sourceRect.height / 2,
        };

        const nearby = [];
        wrappedChars.forEach((char) => {
            if (char === sourceChar) return;
            const rect = char.getBoundingClientRect();
            if (Math.abs(rect.top - sourceCenter.y) > radius) return;
            if (Math.abs(rect.left - sourceCenter.x) > radius) return;

            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
            const distance = Math.sqrt(
                Math.pow(center.x - sourceCenter.x, 2) +
                Math.pow(center.y - sourceCenter.y, 2),
            );
            if (distance <= radius) {
                nearby.push({char, distance});
            }
        });

        return nearby
            .sort((a, b) => a.distance - b.distance)
            .map((item) => item.char);
    }

    const cleanupParams = [];

    wrappedChars.forEach((char) => {
        const handleMouseEnter = () => {
            simpleGlitch(char);

            const nearby = findNearbyChars(char, config.rippleRadius);
            nearby.forEach((nearChar, i) => {
                setTimeout(
                    () => {
                        simpleGlitch(nearChar);
                    },
                    i * (500 / (nearby.length || 1)),
                ); // distribute ripple over 500ms
            });
        };

        char.addEventListener("mouseenter", handleMouseEnter);
        cleanupParams.push({char, listener: handleMouseEnter});
    });

    if (config.enableRandomGlitch) {
        const randomGlitchIntervalId = setInterval(() => {
            if (Math.random() < config.randomGlitchChance) {
                if (wrappedChars.length > 0) {
                    const randomIndex = Math.floor(Math.random() * wrappedChars.length);
                    const randomChar = wrappedChars[randomIndex];
                    simpleGlitch(randomChar);
                    
                    const nearby = findNearbyChars(randomChar, config.rippleRadius / 2);
                    nearby.forEach((nearChar, i) => {
                        setTimeout(() => simpleGlitch(nearChar), i * 50);
                    });
                }
            }
        }, config.randomGlitchInterval);

        cleanupParams.push({
            type: 'interval',
            id: randomGlitchIntervalId
        });
    }

    return () => {
        cleanupParams.forEach((item) => {
            if (item.type === 'interval') {
                clearInterval(item.id);
            } else {
                item.char.removeEventListener("mouseenter", item.listener);
            }
        });
    };
};
