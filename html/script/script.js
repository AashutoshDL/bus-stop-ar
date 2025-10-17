function createARExperience() {
    // --- State ---
    let targetFound = false;
    let buildingModel = null;
    let target = null;
    let modelContainer = null;
    let videoElement = null;

    // --- Elements ---
    const loadingScreen = document.getElementById("loadingScreen");
    const loadingStatus = document.getElementById("loadingStatus");
    const errorContainer = document.getElementById("errorContainer");
    const statusIndicator = document.getElementById("statusIndicator");
    const arScene = document.getElementById("arScene");
    const arButton = document.getElementById("arActionButton");

    // --- Initialization ---
    async function init() {
        try {
            await requestCameraPermission();
            setupEventListeners();
            updateLoadingStatus("Setting up AR scene...");
        } catch (error) {
            handleError("Failed to initialize AR experience", error);
        }
    }

    // --- Camera Permission ---
    async function requestCameraPermission() {
        updateLoadingStatus("Requesting camera permission...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });

            console.log("Camera access granted");
            updateLoadingStatus("Camera access granted ✓");

            // Stop the stream (MindAR will handle camera access)
            stream.getTracks().forEach((track) => track.stop());
            return true;
        } catch (error) {
            console.error("Camera access denied", error);
            showError(
                "Camera access is required for AR experience. Please enable camera access and refresh the page.",
                error
            );
            throw error;
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        arScene.addEventListener("loaded", onSceneLoaded);
        arScene.addEventListener("error", (event) =>
            handleError("AR scene failed to load", event.detail)
        );

        if (arButton) {
            arButton.addEventListener("click", () => {
                alert("You have now begun the AR Quest !!!");
            });
        }
    }

    // --- Scene Loaded ---
    function onSceneLoaded() {
        try {
            buildingModel = document.getElementById("buildingModel");
            modelContainer = document.getElementById("modelContainer");
            target = document.getElementById("target");
            videoElement = document.getElementById("videoAsset");

            if (!buildingModel || !target || !modelContainer) {
                throw new Error("Required AR elements not found");
            }

            setupTargetEvents();
            hideLoadingScreen();
            showStatusIndicator();
            console.log("AR experience ready");
        } catch (error) {
            handleError("Failed to setup AR components", error);
        }
    }

    // --- Target Events ---
    function setupTargetEvents() {
        target.addEventListener("targetFound", () => {
            console.log("Target found");
            targetFound = true;
            showModel();
            updateStatusIndicator("Target Found!", "status-found");
            if (arButton) arButton.style.display = "block";
        });

        target.addEventListener("targetLost", () => {
            console.log("Target lost");
            targetFound = false;
            hideModel();
            updateStatusIndicator("Searching for target...", "status-searching");
            if (arButton) arButton.style.display = "none";
        });
    }

    // --- Model Display ---
    function showModel() {
        if (buildingModel && modelContainer) {
            buildingModel.setAttribute("visible", "true");
            buildingModel.setAttribute("material", "opacity: 1; transparent: true");

            stopModelAnimations();
            setTimeout(playModelAnimations, 100);
        }
    }

    function hideModel() {
        if (buildingModel) {
            buildingModel.setAttribute("visible", "false");
            stopModelAnimations();
        }
    }

    // --- Animations ---
    function playModelAnimations() {
        if (buildingModel) {
            buildingModel.setAttribute("animation-mixer", {
                clip: "*",
                loop: "once",
                repetitions: 1,
                timeScale: 1,
                clampWhenFinished: true,
            });
            console.log("Model GLTF animations started (play once, will stay at final frame)");
        }
    }

    function stopModelAnimations() {
        if (buildingModel) {
            buildingModel.removeAttribute("animation-mixer");
        }
        console.log("Model animations stopped");
    }

    // --- UI Helpers ---
    function updateLoadingStatus(message) {
        if (loadingStatus) {
            loadingStatus.textContent = message;
            console.log("Loading status:", message);
        }
    }

    function hideLoadingScreen() {
        if (loadingScreen) {
            loadingScreen.classList.add("fade-out");
            setTimeout(() => {
                loadingScreen.style.display = "none";
            }, 500);
        }
    }

    function showStatusIndicator() {
        if (statusIndicator) {
            statusIndicator.style.display = "block";
            updateStatusIndicator("Searching for target...", "status-searching");
        }
    }

    function updateStatusIndicator(text, statusClass) {
        if (statusIndicator) {
            statusIndicator.textContent = text;
            statusIndicator.className = `status-indicator ${statusClass}`;
        }
    }

    function showError(message, error = null) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.innerHTML = `
            <strong>Error:</strong> ${message}
            ${error ? `<br><small>Technical details: ${error.message || error}</small>` : ""}
        `;
        if (errorContainer) {
            errorContainer.appendChild(errorDiv);
        }
    }

    function handleError(message, error) {
        console.error(message, error);
        showError(message, error);
        updateLoadingStatus("❌ " + message);
    }

    // --- Return exposed controls (optional) ---
    return {
        init,
        showModel,
        hideModel,
        playModelAnimations,
        stopModelAnimations,
    };
}

// Initialize AR experience when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    const arExperience = createARExperience();
    arExperience.init();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
    const scene = document.getElementById("arScene");
    if (scene) {
        if (document.hidden) {
            console.log("Page hidden - pausing AR");
            scene.pause();
        } else {
            console.log("Page visible - resuming AR");
            scene.play();
        }
    }
});

// Handle orientation changes
window.addEventListener("orientationchange", () => {
    setTimeout(() => {
        const scene = document.getElementById("arScene");
        if (scene && scene.resize) {
            scene.resize();
        }
    }, 500);
});
