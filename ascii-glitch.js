window.initASCIIAnimation = function (element, options = {}) {
    if (!element) return;

    const config = {
        activeColor: "#fff",
        rippleRadius: 25, // px
        rippleDuration: 500, // ms
        glitchDuration: 1000, // ms
        maxGlitchIterations: 4,
        glitchSpeed: 120, // ms
        glitchChars: "!@#$%^&*()_+:,.?/~`|",
        enableRandomGlitch: true,
        randomGlitchInterval: 120, // ms
        randomGlitchChance: 0.1,
        randomGlitchRippleDivisor: 1.2,
        randomGlitchFollowDelay: 80, // ms
        ...options,
    };

    const originalText = options.text || element.textContent;
    const cleanups = [];
    const allWrappers = [];

    element.innerHTML = "";

    originalText.split("\n").forEach((line) => {
        const lineDiv = document.createElement("div");
        lineDiv.style.whiteSpace = "pre";

        line.split("").forEach((char) => {
            const wrapper = document.createElement("span");
            const charSpan = document.createElement("span");

            Object.assign(wrapper.style, {
                display: "inline-block",
                verticalAlign: "bottom",
                whiteSpace: "pre",
                textAlign: "center"
            });
            wrapper.className = "char-wrapper";

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
            Object.assign(wrapper.style, {
                width: `${rect.width / fontSize}em`,
                height: `${rect.height / fontSize}em`,
                overflow: "hidden"
            });
        });
    });

    const wrappedChars = Array.from(element.querySelectorAll(".char"));

    const simpleGlitch = (charElement) => {
        if (charElement.isGlitching) return;
        charElement.isGlitching = true;

        const originalChar = charElement.dataset.original;
        let iterations = 0;

        const interval = setInterval(() => {
            if (originalChar === " " || originalChar === "⠀") {
                charElement.textContent = originalChar;
            } else {
                charElement.textContent = config.glitchChars[Math.floor(Math.random() * config.glitchChars.length)];
                charElement.style.color = config.activeColor;
                charElement.style.fontWeight = "bold";
            }

            if (++iterations >= config.maxGlitchIterations) {
                clearInterval(interval);
                charElement.textContent = originalChar;
                charElement.style.color = "";
                charElement.style.fontWeight = "";
                charElement.isGlitching = false;
            }
        }, config.glitchSpeed);
    };

    const findNearbyChars = (sourceChar, radius) => {
        const sourceRect = sourceChar.getBoundingClientRect();
        const sourceCenter = {
            x: sourceRect.left + sourceRect.width / 2,
            y: sourceRect.top + sourceRect.height / 2,
        };

        return wrappedChars
            .filter(char => char !== sourceChar)
            .map(char => {
                const rect = char.getBoundingClientRect();
                const center = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
                const distance = Math.sqrt(
                    Math.pow(center.x - sourceCenter.x, 2) +
                    Math.pow(center.y - sourceCenter.y, 2)
                );
                return {char, distance};
            })
            .filter(item => item.distance <= radius)
            .sort((a, b) => a.distance - b.distance)
            .map(item => item.char);
    };

    wrappedChars.forEach((char) => {
        const handleMouseEnter = () => {
            simpleGlitch(char);
            const nearby = findNearbyChars(char, config.rippleRadius);
            nearby.forEach((nearChar, i) => {
                setTimeout(() => simpleGlitch(nearChar), i * (config.rippleDuration / (nearby.length || 1)));
            });
        };

        char.addEventListener("mouseenter", handleMouseEnter);
        cleanups.push(() => char.removeEventListener("mouseenter", handleMouseEnter));
    });

    if (config.enableRandomGlitch) {
        const intervalId = setInterval(() => {
            if (Math.random() < config.randomGlitchChance && wrappedChars.length) {
                const randomChar = wrappedChars[Math.floor(Math.random() * wrappedChars.length)];
                simpleGlitch(randomChar);
                findNearbyChars(randomChar, config.rippleRadius / config.randomGlitchRippleDivisor).forEach((nearChar, i) => {
                    setTimeout(() => simpleGlitch(nearChar), i * config.randomGlitchFollowDelay);
                });
            }
        }, config.randomGlitchInterval);

        cleanups.push(() => clearInterval(intervalId));
    }

    return () => cleanups.forEach(fn => fn());
};