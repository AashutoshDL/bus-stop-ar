const video = document.getElementById("camera");
const arrow = document.getElementById("arrow");
const stopBtn = document.getElementById("stop-navigation");
const status = document.getElementById("status");
const navigationInfo = document.getElementById("navigation-info");
const currentInstruction = document.getElementById("current-instruction");
const directionText = document.getElementById("direction-text");
const distanceToTurn = document.getElementById("distance-to-turn");
const totalDistance = document.getElementById("total-distance");
const currentStepEl = document.getElementById("current-step");
const headingValue = document.getElementById("heading-value");
const stepBearing = document.getElementById("step-bearing");
const relativeAngle = document.getElementById("relative-angle");

let userLocation = null;
let destination = { lat: 27.709238899431625, lng: 85.32558477122376 };
let deviceHeading = 0;
let watchId = null;
let isNavigating = false;
let routeSteps = [];
let currentStepIndex = 0;
let totalRouteDistance = 0;

// Get simple direction text based on relative angle
function getSimpleDirectionText(relativeAngle) {
    // Normalize angle to 0-360
    relativeAngle = ((relativeAngle % 360) + 360) % 360;

    // Remove previous direction classes
    directionText.classList.remove(
        "direction-straight",
        "direction-left",
        "direction-right"
    );

    if (relativeAngle >= 345 || relativeAngle <= 15) {
        directionText.classList.add("direction-straight");
        return "Go Straight";
    } else if (relativeAngle > 15 && relativeAngle <= 45) {
        directionText.classList.add("direction-right");
        return "Turn Slight Right";
    } else if (relativeAngle > 45 && relativeAngle <= 135) {
        directionText.classList.add("direction-right");
        return "Turn Right";
    } else if (relativeAngle > 135 && relativeAngle <= 180) {
        directionText.classList.add("direction-right");
        return "Turn Sharp Right";
    } else if (relativeAngle > 180 && relativeAngle <= 225) {
        directionText.classList.add("direction-left");
        return "Turn Sharp Left";
    } else if (relativeAngle > 225 && relativeAngle <= 315) {
        directionText.classList.add("direction-left");
        return "Turn Left";
    } else if (relativeAngle > 315 && relativeAngle < 345) {
        directionText.classList.add("direction-left");
        return "Turn Slight Left";
    }

    directionText.classList.add("direction-straight");
    return "Continue Straight";
}

// Start camera feed
navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then((stream) => {
        video.srcObject = stream;
    })
    .catch((err) => {
        console.error(err);
        showError("Camera access denied");
    });

// Get user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                resolve(userLocation);
            },
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// Get route from OpenRouteService
async function getRoute(startLat, startLng, endLat, endLng) {
    try {
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf6248YOUR_API_KEY&start=${startLng},${startLat}&end=${endLng},${endLat}&instructions=true&geometry=true`;

        // Fallback to OSRM if OpenRouteService fails
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson`;

        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            throw new Error("No route found");
        }

        const route = data.routes[0];
        const steps = route.legs[0].steps;

        return {
            steps: steps.map((step) => ({
                instruction:
                    step.maneuver.instruction ||
                    getInstructionFromType(step.maneuver.type),
                distance: step.distance,
                duration: step.duration,
                geometry: step.geometry,
                maneuver: step.maneuver,
                location: step.maneuver.location,
            })),
            totalDistance: route.distance,
            totalDuration: route.duration,
        };
    } catch (error) {
        console.error("Route calculation failed:", error);
        throw new Error("Failed to calculate route");
    }
}

function getInstructionFromType(type) {
    const typeMap = {
        "turn-right": "Turn right",
        "turn-left": "Turn left",
        "turn-sharp-right": "Turn sharp right",
        "turn-sharp-left": "Turn sharp left",
        "turn-slight-right": "Turn slight right",
        "turn-slight-left": "Turn slight left",
        straight: "Continue straight",
        arrive: "Arrive at destination",
    };
    return typeMap[type] || "Continue";
}

// Calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x =
        Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

// Find current navigation step
function getCurrentStep() {
    if (!routeSteps.length || !userLocation) return null;

    let closestStepIndex = 0;
    let minDistance = Infinity;

    // Find the closest step to current location
    for (let i = currentStepIndex; i < routeSteps.length; i++) {
        const step = routeSteps[i];
        const stepLat = step.location[1];
        const stepLng = step.location[0];

        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            stepLat,
            stepLng
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestStepIndex = i;
        }
    }

    // If we're very close to the current step, move to the next one
    if (
        minDistance < 20 &&
        closestStepIndex === currentStepIndex &&
        currentStepIndex < routeSteps.length - 1
    ) {
        currentStepIndex++;
        return routeSteps[currentStepIndex];
    }

    currentStepIndex = closestStepIndex;
    return routeSteps[currentStepIndex];
}

// Update navigation UI and arrow
function updateNavigation() {
    if (!isNavigating || !userLocation || !routeSteps.length) return;

    const currentStep = getCurrentStep();
    if (!currentStep) return;

    // Calculate distance to next maneuver
    const stepLat = currentStep.location[1];
    const stepLng = currentStep.location[0];
    const distanceToStep = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        stepLat,
        stepLng
    );

    // Calculate bearing to next maneuver
    const bearingToStep = calculateBearing(
        userLocation.lat,
        userLocation.lng,
        stepLat,
        stepLng
    );

    // Calculate relative angle (difference between where we need to go and where we're facing)
    let relativeAngleToStep = bearingToStep - deviceHeading;
    relativeAngleToStep = ((relativeAngleToStep % 360) + 360) % 360;

    // Update arrow rotation
    let arrowRotation = relativeAngleToStep;

    // Get simple direction text based on relative angle
    const directionInstruction =
        getSimpleDirectionText(relativeAngleToStep);

    // Update UI
    arrow.style.transform = `translate(-50%, -50%) rotate(${arrowRotation}deg)`;
    currentInstruction.textContent = currentStep.instruction;
    directionText.textContent = directionInstruction;

    if (distanceToStep < 1000) {
        distanceToTurn.textContent = `In ${Math.round(
            distanceToStep
        )} meters`;
    } else {
        distanceToTurn.textContent = `In ${(distanceToStep / 1000).toFixed(
            1
        )} km`;
    }

    // Update debug info
    currentStepEl.textContent = `${currentStepIndex + 1}/${routeSteps.length
        }`;
    headingValue.textContent = deviceHeading.toFixed(1);
    stepBearing.textContent = bearingToStep.toFixed(1);
    relativeAngle.textContent = relativeAngleToStep.toFixed(1);

    // Check if arrived
    if (currentStepIndex === routeSteps.length - 1 && distanceToStep < 50) {
        currentInstruction.textContent = "Arrived at Islington College!";
        directionText.textContent = "You have reached your destination";
        distanceToTurn.textContent = "You have reached your destination";
        directionText.className = "direction-straight"; // Reset to neutral color
    }
}

// Handle device orientation
function handleOrientation(event) {
    let alpha = event.alpha;

    if (alpha !== null) {
        if (event.webkitCompassHeading) {
            deviceHeading = event.webkitCompassHeading;
        } else {
            deviceHeading = alpha;
        }

        updateNavigation();
    }
}

// Set up device orientation listeners
if (window.DeviceOrientationEvent) {
    if ("ondeviceorientationabsolute" in window) {
        window.addEventListener(
            "deviceorientationabsolute",
            handleOrientation
        );
    } else {
        window.addEventListener("deviceorientation", handleOrientation);
    }

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then((response) => {
                if (response === "granted") {
                    window.addEventListener(
                        "deviceorientationabsolute",
                        handleOrientation
                    );
                }
            })
            .catch(console.error);
    }
}

// Start location tracking
function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                updateNavigation();
            },
            (error) => console.error("Location tracking error:", error),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
        );
    }
}

function stopLocationTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function showError(message) {
    status.textContent = `Error: ${message}`;
    status.classList.add("error");
    setTimeout(() => {
        status.classList.remove("error");
    }, 5000);
}

// Auto-start navigation to Islington College
async function startNavigation() {
    status.textContent = "Getting your location...";

    try {
        // Get current location
        await getCurrentLocation();
        status.textContent = "Calculating route to Islington College...";

        // Get route
        const route = await getRoute(
            userLocation.lat,
            userLocation.lng,
            destination.lat,
            destination.lng
        );

        routeSteps = route.steps;
        totalRouteDistance = route.totalDistance;
        currentStepIndex = 0;

        // Start navigation
        isNavigating = true;
        startLocationTracking();

        status.textContent = "Navigating to Islington College";
        navigationInfo.style.display = "block";

        totalDistance.textContent = `Total distance: ${(
            totalRouteDistance / 1000
        ).toFixed(1)} km`;

        updateNavigation();
    } catch (error) {
        showError(error.message);
    }
}

// Stop navigation
stopBtn.addEventListener("click", () => {
    isNavigating = false;
    stopLocationTracking();
    routeSteps = [];
    currentStepIndex = 0;

    arrow.style.transform = "translate(-50%, -50%) rotate(0deg)";
    navigationInfo.style.display = "none";
    status.textContent = "Navigation stopped";
    directionText.classList.remove(
        "direction-straight",
        "direction-left",
        "direction-right"
    );
});

// Auto-start navigation on page load
startNavigation();