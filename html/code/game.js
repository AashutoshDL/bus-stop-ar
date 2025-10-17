const video = document.getElementById("camera");
const canvas = document.getElementById("arrowCanvas");
const directionText = document.getElementById("direction-text");
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug-info");

let deviceHeading = 0;
let deviceTilt = 0;
let deviceRoll = 0;
let modelLoaded = false;
let currentLocation = null;
let hasArrived = false;

// Smoothing for compass readings
let headingHistory = [];
const HEADING_SMOOTH_FACTOR = 5;

// Destination
const destination = {
    name: "Islington College",
    lat: 27.7113,
    lng: 85.3263,
};
let routeData = null;
let currentStepIndex = 0;

// ---------------- CAMERA ----------------
navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then((stream) => {
        video.srcObject = stream;
        startLocationTracking();
    })
    .catch((err) => {
        console.error(err);
        statusEl.textContent = "Camera access denied!";
    });

// ---------------- DIRECTIONS API ----------------
async function fetchDirections(fromLat, fromLng, toLat, toLng) {
    try {
        const url = `https://graphhopper.com/api/1/route?point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=car&locale=en&key=6bdfea34-eccd-4b3b-83f6-add8d1b3ed33&instructions=true&points_encoded=false`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.paths && data.paths.length > 0) {
            const path = data.paths[0];

            const allSteps = [];

            if (path.instructions) {
                path.instructions.forEach((instruction) => {
                    const pointIndex = instruction.interval[0];
                    const coords = path.points.coordinates[pointIndex];

                    allSteps.push({
                        instruction: instruction.text || "Continue",
                        distance: instruction.distance,
                        location: coords, // [lng, lat]
                        bearing: 0,
                    });
                });
            }

            routeData = {
                distance: path.distance,
                duration: path.time,
                steps: allSteps,
            };

            currentStepIndex = 0;
            updateNavigationInfo();
            statusEl.textContent = `Route found: ${(path.distance / 1000).toFixed(
                1
            )}km`;
            console.log("Route loaded with", allSteps.length, "steps");
        } else {
            statusEl.textContent = "Route not found";
            useFallbackNavigation();
        }
    } catch (error) {
        console.error("Direction API error:", error);
        statusEl.textContent = "Failed to get directions";
        useFallbackNavigation();
    }
}

function useFallbackNavigation() {
    routeData = {
        distance: calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            destination.lat,
            destination.lng
        ),
        duration: 0,
        steps: [
            {
                instruction: `Head towards ${destination.name}`,
                distance: calculateDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    destination.lat,
                    destination.lng
                ),
                location: [destination.lng, destination.lat],
                bearing: 0,
            },
        ],
    };
    currentStepIndex = 0;
}

// ---------------- GEOLOCATION ----------------
function startLocationTracking() {
    if (!navigator.geolocation) {
        statusEl.textContent = "Geolocation not supported!";
        return;
    }

    statusEl.textContent = "Getting your location...";
    navigator.geolocation.watchPosition(
        (pos) => {
            const newLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
            };

            if (!currentLocation || !routeData) {
                currentLocation = newLocation;
                fetchDirections(
                    currentLocation.lat,
                    currentLocation.lng,
                    destination.lat,
                    destination.lng
                );
            } else {
                currentLocation = newLocation;

                if (routeData && routeData.steps[currentStepIndex]) {
                    const distToCurrentStep = calculateDistance(
                        currentLocation.lat,
                        currentLocation.lng,
                        routeData.steps[currentStepIndex].location[1],
                        routeData.steps[currentStepIndex].location[0]
                    );

                    if (
                        distToCurrentStep < 15 &&
                        currentStepIndex < routeData.steps.length - 1
                    ) {
                        currentStepIndex++;
                        updateNavigationInfo();
                        console.log("Advanced to step", currentStepIndex);
                    }
                }
            }

            const distToDestination = calculateDistance(
                currentLocation.lat,
                currentLocation.lng,
                destination.lat,
                destination.lng
            );

            if (distToDestination < 15) {
                if (!hasArrived) {
                    showCelebration();
                    hasArrived = true;
                }
                statusEl.textContent = `You've arrived at ${destination.name}!`;
            } else {
                statusEl.textContent = `${distToDestination.toFixed(0)}m to ${destination.name
                    }`;
            }
        },
        (err) => {
            console.error(err);
            statusEl.textContent = "Location access denied!";
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
            distanceFilter: 1,
        }
    );
}

// ---------------- CELEBRATION ----------------
function showCelebration() {
    const celebrationEl = document.getElementById("celebration");
    celebrationEl.classList.add("show");
    arrow.visible = false;
    setTimeout(() => {
        celebrationEl.classList.remove("show");
    }, 5000);
}

// ---------------- MATH ----------------
function calculateBearing(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = (d) => (d * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lng2 - lng1);
    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------- THREE.JS ----------------
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const arrowContainer = new THREE.Group();
scene.add(arrowContainer);
const arrow = new THREE.Group();
arrowContainer.add(arrow);

camera3D.position.z = 3;

// ---------------- LOAD ARROW ----------------
const loader = new THREE.GLTFLoader();
loader.load(
    "../models/forward_direction_arrow.glb",
    (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.5, 0.5, 0.5);
        model.rotation.set(0, 0, 0);
        arrow.add(model);
        modelLoaded = true;
        statusEl.textContent = "Model loaded!";
    },
    undefined,
    (err) => {
        console.error(err);
        createFallbackArrow();
    }
);

function createFallbackArrow() {
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.8, 0.05),
        new THREE.MeshPhongMaterial({ color: 0x00ff88 })
    );
    const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.4, 8),
        new THREE.MeshPhongMaterial({ color: 0x00ff88 })
    );
    head.position.y = 0.6;
    arrow.add(body);
    arrow.add(head);
    modelLoaded = true;
    statusEl.textContent = "Fallback arrow ready!";
}

window.addEventListener("resize", () => {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- DEVICE ORIENTATION ----------------
function smoothHeading(newHeading) {
    headingHistory.push(newHeading);
    if (headingHistory.length > HEADING_SMOOTH_FACTOR) headingHistory.shift();

    let sumSin = 0,
        sumCos = 0;
    headingHistory.forEach((h) => {
        sumSin += Math.sin((h * Math.PI) / 180);
        sumCos += Math.cos((h * Math.PI) / 180);
    });

    let avgHeading =
        (Math.atan2(sumSin / headingHistory.length, sumCos / headingHistory.length) *
            180) /
        Math.PI;
    if (avgHeading < 0) avgHeading += 360;

    return avgHeading;
}

function handleOrientation(event) {
    if (event.alpha === null) return;

    let rawHeading;
    if (event.webkitCompassHeading !== undefined) {
        rawHeading = event.webkitCompassHeading;
    } else if (event.absolute && event.alpha !== null) {
        rawHeading = 360 - event.alpha;
    } else {
        rawHeading = 360 - event.alpha;
    }

    deviceHeading = smoothHeading(rawHeading);
    deviceTilt = event.beta || 0;
    deviceRoll = event.gamma || 0;
    updateArrow();
}

if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
) {
    DeviceOrientationEvent.requestPermission()
        .then((res) => {
            if (res === "granted") {
                window.addEventListener("deviceorientationabsolute", handleOrientation, true);
                window.addEventListener("deviceorientation", handleOrientation, true);
            } else {
                statusEl.textContent = "Compass access denied!";
            }
        })
        .catch(console.error);
} else {
    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);
}

// ---------------- ARROW UPDATE ----------------
function updateNavigationInfo() {
    if (!routeData || !currentLocation) return;

    const currentStep = routeData.steps[currentStepIndex];
    const distanceToStep = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        currentStep.location[1],
        currentStep.location[0]
    );

    const totalDistance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        destination.lat,
        destination.lng
    );

    directionText.innerHTML = `
    <strong>${currentStep.instruction}</strong><br>
    In ${distanceToStep.toFixed(0)}m | Total: ${totalDistance.toFixed(0)}m<br>
    Step ${currentStepIndex + 1} of ${routeData.steps.length}
  `;
}

function updateArrow() {
    if (!modelLoaded || !currentLocation || !routeData || hasArrived) return;

    const currentStep = routeData.steps[currentStepIndex];
    const bearingToWaypoint = calculateBearing(
        currentLocation.lat,
        currentLocation.lng,
        currentStep.location[1],
        currentStep.location[0]
    );

    let relativeAngle = bearingToWaypoint - deviceHeading;
    if (relativeAngle > 180) relativeAngle -= 360;
    if (relativeAngle < -180) relativeAngle += 360;

    arrowContainer.rotation.set(THREE.MathUtils.degToRad(-90), 0, 0);
    arrow.rotation.z = THREE.MathUtils.degToRad(-relativeAngle);

    debugEl.innerHTML = `
    Device Heading: ${deviceHeading.toFixed(0)}°<br>
    Target Bearing: ${bearingToWaypoint.toFixed(0)}°<br>
    Relative Angle: ${relativeAngle.toFixed(0)}°<br>
    Lat: ${currentLocation.lat.toFixed(6)}<br>
    Lng: ${currentLocation.lng.toFixed(6)}<br>
    Step: ${currentStepIndex + 1}/${routeData.steps.length}
  `;

    updateNavigationInfo();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3D);
}
animate();
