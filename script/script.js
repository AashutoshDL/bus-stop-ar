class ARExperience {
    constructor() {
        this.isInitialized = false;
        this.targetFound = false;
        this.loadingScreen = document.getElementById("loadingScreen");
        this.loadingStatus = document.getElementById("loadingStatus");
        this.errorContainer = document.getElementById("errorContainer");
        this.statusIndicator = document.getElementById("statusIndicator");
        this.buildingModel = null;
        this.target = null;
        this.modelContainer = null;
        this.arScene = document.getElementById("arScene");
        this.arButton = document.getElementById("arActionButton");

        this.init();
    }

    async init() {
        try {
            await this.requestCameraPermission();
            this.setupEventListeners();
            this.updateLoadingStatus("Setting up AR scene...");
        } catch (error) {
            this.handleError("Failed to initialize AR experience", error);
        }
    }

    async requestCameraPermission() {
        this.updateLoadingStatus("Requesting camera permission...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Prefer rear camera for AR
                },
            });

            console.log("Camera access granted");
            this.updateLoadingStatus("Camera access granted ✓");

            // Stop the stream as MindAR will handle camera access
            stream.getTracks().forEach((track) => track.stop());

            return true;
        } catch (error) {
            console.error("Camera access denied", error);
            this.showError(
                "Camera access is required for AR experience. Please enable camera access and refresh the page.",
                error
            );
            throw error;
        }
    }

    setupEventListeners() {
        // Wait for scene to be ready before accessing entities
        this.arScene.addEventListener("loaded", () => {
            this.onSceneLoaded();
        });

        // Handle scene loading errors
        this.arScene.addEventListener("error", (event) => {
            this.handleError("AR scene failed to load", event.detail);
        });

        this.arButton.addEventListener("click", () => {
            alert("You have now begun the AR Quest !!!")
        });
    }

    onSceneLoaded() {
        try {
            this.buildingModel = document.getElementById("buildingModel");
            this.modelContainer = document.getElementById("modelContainer");
            this.target = document.getElementById("target");
            this.videoElement = document.getElementById("videoAsset");

            if (!this.buildingModel || !this.target || !this.modelContainer) {
                throw new Error("Required AR elements not found");
            }

            this.setupTargetEvents();
            this.hideLoadingScreen();
            this.showStatusIndicator();

            console.log("AR experience ready");
        } catch (error) {
            this.handleError("Failed to setup AR components", error);
        }
    }

    setupTargetEvents() {
        // Target found event
        this.target.addEventListener("targetFound", (event) => {
            console.log("Target found");
            this.targetFound = true;
            this.showModel();
            this.updateStatusIndicator("Target Found!", "status-found");
            if (this.arButton) {
                this.arButton.style.display = "block";
            }
        });

        // Target lost event
        this.target.addEventListener("targetLost", (event) => {
            console.log("Target lost");
            this.targetFound = false;
            this.hideModel();
            this.updateStatusIndicator(
                "Searching for target...",
                "status-searching"
            );
            if (this.arButton) {
                this.arButton.style.display = "none";
            }
        });
    }

    showModel() {
        if (this.buildingModel && this.modelContainer) {
            this.buildingModel.setAttribute("visible", "true");

            this.buildingModel.setAttribute("material", "opacity: 1; transparent: true");

            // Stop any currently running animations first
            this.stopModelAnimations();

            // Start only the model's pre-baked GLTF animations (play once)
            setTimeout(() => {
                this.playModelAnimations();
            }, 100); // Small delay to ensure model is visible
        }
    }

    hideModel() {
        if (this.buildingModel) {
            this.buildingModel.setAttribute("visible", "false");
            // Stop animations when target is lost
            this.stopModelAnimations();
        }
    }

    playModelAnimations() {
        // Play only the model's built-in GLTF animations once
        if (this.buildingModel) {
            this.buildingModel.setAttribute("animation-mixer", {
                clip: "*", // Play all animation clips in the model
                loop: "once", // Play only once
                repetitions: 1,
                timeScale: 1,
                clampWhenFinished: true // Keep the final frame when animation completes
            });
            console.log("Model GLTF animations started (play once, will stay at final frame)");
        }
        // Note: No spinning animation added to the container
    }

    stopModelAnimations() {
        // Stop only the model's GLTF animations
        if (this.buildingModel) {
            this.buildingModel.removeAttribute("animation-mixer");
        }
        console.log("Model animations stopped");
    }

    updateLoadingStatus(message) {
        if (this.loadingStatus) {
            this.loadingStatus.textContent = message;
            console.log("Loading status:", message);
        }
    }

    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add("fade-out");
            setTimeout(() => {
                this.loadingScreen.style.display = "none";
            }, 500);
        }
    }

    showStatusIndicator() {
        if (this.statusIndicator) {
            this.statusIndicator.style.display = "block";
            this.updateStatusIndicator(
                "Searching for target...",
                "status-searching"
            );
        }
    }

    updateStatusIndicator(text, statusClass) {
        if (this.statusIndicator) {
            this.statusIndicator.textContent = text;
            this.statusIndicator.className = `status-indicator ${statusClass}`;
        }
    }

    showError(message, error = null) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.innerHTML = `
            <strong>Error:</strong> ${message}
            ${error
                ? `<br><small>Technical details: ${error.message || error
                }</small>`
                : ""
            }
          `;

        if (this.errorContainer) {
            this.errorContainer.appendChild(errorDiv);
        }
    }

    handleError(message, error) {
        console.error(message, error);
        this.showError(message, error);
        this.updateLoadingStatus("❌ " + message);
    }
}

// Initialize AR experience when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    new ARExperience();
});

// Handle page visibility changes to pause/resume AR
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